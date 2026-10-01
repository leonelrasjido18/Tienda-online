import { InjectQueue } from '@nestjs/bullmq';
import { randomBytes } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  calculateCustomizationExtraCents,
  calculatePaymentDiscountCents,
  resolvePaymentDiscount,
  applyDiscountToPlan,
  calculatePaymentPlan,
  formatCentsAsArs,
  formatOrderNumber,
  type CartCustomizationDraft,
  type CreateOrderInput,
  type CreateOrderResponse,
  type PaymentPlanLineItem,
  type ResolvedFulfillment,
  type CheckoutPaymentMethod,
  OFFLINE_PAYMENT_METHODS,
  resolveFulfillment,
  shippingDueAtCheckout,
} from '@tienda/shared';
import type { Prisma } from '@prisma/client';
import type { Queue } from 'bullmq';

// Métodos sin pasarela (transferencia, efectivo): no generan checkout de tarjeta,
// se confirman a mano al recibir el pago. Los distingue de los pagos con tarjeta.
const isOfflineMethod = (method: CheckoutPaymentMethod): boolean =>
  (OFFLINE_PAYMENT_METHODS as readonly string[]).includes(method);

import { RenderService } from '../../catalog/customization/render.service';
import { UploadsService } from '../../catalog/uploads/uploads.service';
import type { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from '../notifications/push.service';
import { PaymentProviderRegistry } from '../payments/payment-provider.registry';
import { ShippingService } from '../../shipping/shipping.service';
import { SettingsService } from '../settings/settings.service';
import { STOCK_RESERVATION_QUEUE, type StockReservationJobData } from '../stock/reservation-queue.constants';
import { StockReservationService } from '../stock/stock-reservation.service';

const CART_ITEM_INCLUDE = {
  variant: {
    include: {
      product: {
        include: {
          images: { orderBy: { position: 'asc' as const }, take: 1 },
          customization: { include: { patchOptions: { include: { patch: true } } } },
        },
      },
      inventory: true,
      optionValues: { include: { value: true } },
    },
  },
} satisfies Prisma.CartItemInclude;

type CartItemWithRelations = Prisma.CartItemGetPayload<{ include: typeof CART_ITEM_INCLUDE }>;

interface PreparedLine {
  item: CartItemWithRelations;
  extraCents: number;
  totalCents: number;
  productionImageUrl: string | null;
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly stock: StockReservationService,
    private readonly render: RenderService,
    private readonly uploads: UploadsService,
    private readonly payments: PaymentProviderRegistry,
    private readonly push: PushService,
    private readonly shipping: ShippingService,
    private readonly config: ConfigService<Env, true>,
    @InjectQueue(STOCK_RESERVATION_QUEUE) private readonly reservationQueue: Queue<StockReservationJobData>,
  ) {}

  async createOrder(cartId: string, input: CreateOrderInput): Promise<CreateOrderResponse> {
    const rawItems = await this.prisma.cartItem.findMany({
      where: { cartId },
      include: CART_ITEM_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });

    if (rawItems.length === 0) {
      throw new BadRequestException('El carrito está vacío');
    }
    // Segunda barrera: el precio pudo quedar en cero DESPUÉS de agregarlo al
    // carrito. Cobrar $0 por un pedido real no se puede deshacer.
    const sinPrecio = rawItems.find((item) => item.variant.priceCents <= 0);
    if (sinPrecio) {
      throw new BadRequestException(
        `${sinPrecio.variant.product.name} todavía no tiene precio cargado. Sacalo del carrito para continuar.`,
      );
    }

    const storeSettings = await this.settings.get();
    const preparedLines = await this.prepareLines(rawItems);

    // El pedido queda enlazado a la cuenta del cliente si existe una con ese
    // email. Sin esto `Order.customerId` quedaba siempre vacio: "Mis pedidos"
    // salia vacio y no habia contra que controlar el limite por cliente.
    const cliente = await this.prisma.customer.findUnique({
      where: { email: input.contact.email.toLowerCase().trim() },
      select: { id: true },
    });
    const customerId = cliente?.id ?? null;

    const order = await this.prisma.$transaction(async (tx) => {
      const variantIds = rawItems.map((i) => i.variantId);
      const locked = await this.stock.lockInventory(tx, variantIds);

      const resolutions = preparedLines.map((line) => {
        const product = line.item.variant.product;
        const inv = locked.get(line.item.variantId);
        const available = Math.max(0, (inv?.quantity ?? 0) - (inv?.reserved ?? 0));
        const allowPreorder = line.item.variant.inventory?.allowPreorder ?? false;

        // La misma funcion que usan la ficha y el checkout de la tienda, para que
        // lo que se promete en pantalla sea lo que se cobra.
        const decision = resolveFulfillment({
          fulfillmentMode: product.fulfillmentMode,
          available,
          quantity: line.item.quantity,
          allowPreorder,
        });
        if (decision.kind === 'UNAVAILABLE') {
          throw new ConflictException(`No hay stock suficiente de ${product.name}`);
        }

        return { line, resolved: decision.kind satisfies ResolvedFulfillment };
      });

      await this.stock.reserve(
        tx,
        resolutions
          .filter((r) => r.resolved === 'IN_STOCK')
          .map((r) => ({ variantId: r.line.item.variantId, quantity: r.line.item.quantity })),
      );

      const planLines: PaymentPlanLineItem[] = resolutions.map(({ line, resolved }) => ({
        totalCents: line.totalCents,
        fulfillment: resolved,
      }));
      const plan = calculatePaymentPlan(planLines, storeSettings.defaultDepositPercent);

      // Cupón: se revalida y consume del lado del servidor SIEMPRE, con el subtotal
      // recalculado acá. Nunca se confía en el descuento que pudo mostrar el cliente.
      let couponId: string | null = null;
      let discountCents = 0;
      let envioGratisPorCupon = false;
      let effectivePlan = plan;
      if (input.couponCode) {
        const applied = await this.resolveAndConsumeCoupon(tx, input.couponCode, plan.subtotalCents, customerId);
        couponId = applied.couponId;
        discountCents = applied.discountCents;
        envioGratisPorCupon = applied.freeShipping;
        effectivePlan = applyDiscountToPlan(plan, discountCents, storeSettings.defaultDepositPercent);
      }
      // Descuento por el medio de pago (transferencia o efectivo). Se calcula
      // sobre lo que queda DESPUÉS del cupón: si no, dos descuentos sobre el
      // precio de lista podrían sumar más que el producto.
      const baseParaMedioDePago = plan.subtotalCents - discountCents;
      const paymentDiscountCents = calculatePaymentDiscountCents(
        baseParaMedioDePago,
        resolvePaymentDiscount(input.paymentMethod, SettingsService.toPaymentDiscounts(storeSettings)),
      );
      if (paymentDiscountCents > 0) {
        effectivePlan = applyDiscountToPlan(
          plan,
          discountCents + paymentDiscountCents,
          storeSettings.defaultDepositPercent,
        );
      }

      // Envío. Se cotiza del lado del servidor aunque la tienda ya lo haya
      // mostrado: el precio que llega del navegador no se mira nunca.
      //
      // Hasta acá el envío a domicilio de un pedido con stock inmediato salía
      // gratis — el checkout guardaba la dirección y nada más, y shippingCents
      // sólo se escribía al cobrar el saldo de un encargo. Con tarifas de hasta
      // $10.000 cargadas, cada venta de stock se iba con el envío regalado.
      const envio = input.shipping.method === 'delivery' ? input.shipping : null;
      let shippingCents: number | null = null;
      if (envio && shippingDueAtCheckout(effectivePlan.plan, { pickupInStore: false })) {
        const quote = await this.shipping.quoteForItems(
          {
            postalCode: envio.postalCode,
            province: envio.province,
            city: envio.city,
          },
          resolutions.map(({ line }) => ({
            quantity: line.item.quantity,
            priceCents: line.item.variant.priceCents,
            weightGrams: line.item.variant.weightGrams,
          })),
        );
        // Un cupón de envío gratis se resuelve acá, que es donde por fin hay un
        // envío que descontar.
        shippingCents = envioGratisPorCupon ? 0 : quote.priceCents;
      }

      const netTotalCents = baseParaMedioDePago - paymentDiscountCents + (shippingCents ?? 0);

      // Los métodos offline dan más tiempo: el cliente va al banco o paga al retirar.
      const reservationMinutes =
        isOfflineMethod(input.paymentMethod)
          ? this.config.get('BANK_TRANSFER_RESERVATION_TTL_HOURS') * 60
          : this.config.get('CHECKOUT_RESERVATION_TTL_MINUTES');
      const expiresAt = new Date(Date.now() + reservationMinutes * 60_000);

      const shippingFields =
        input.shipping.method === 'delivery'
          ? {
              pickupInStore: false,
              shippingStreet: input.shipping.street,
              shippingNumber: input.shipping.number ?? null,
              shippingFloor: input.shipping.floor ?? null,
              shippingCity: input.shipping.city,
              shippingProvince: input.shipping.province,
              shippingPostalCode: input.shipping.postalCode,
              shippingNotes: input.shipping.notes ?? null,
            }
          : { pickupInStore: true };

      const created = await tx.order.create({
        data: {
          publicToken: randomBytes(32).toString('base64url'),
          customerId,
          contactName: input.contact.name,
          contactEmail: input.contact.email,
          contactPhone: input.contact.phone ?? null,
          ...shippingFields,
          paymentPlan: effectivePlan.plan,
          subtotalCents: plan.subtotalCents,
          discountCents,
          paymentDiscountCents,
          couponId,
          depositCents: effectivePlan.depositCents,
          balanceCents: effectivePlan.balanceCents,
          shippingCents,
          totalCents: netTotalCents,
          notes: input.notes ?? null,
          expiresAt,
          items: {
            create: resolutions.map(({ line, resolved }) => ({
              variantId: line.item.variantId,
              productName: line.item.variant.product.name,
              variantSku: line.item.variant.sku,
              optionsLabel: this.optionsLabel(line.item) || null,
              imageUrl: line.productionImageUrl ?? line.item.variant.product.images[0]?.url ?? null,
              unitPriceCents: line.item.variant.priceCents,
              quantity: line.item.quantity,
              totalCents: line.totalCents,
              fulfillmentMode: resolved,
              customization: this.draftOf(line.item)
                ? {
                    create: {
                      playerName: this.draftOf(line.item)?.playerName ?? null,
                      playerNumber: this.draftOf(line.item)?.playerNumber ?? null,
                      fontId: this.draftOf(line.item)?.fontId ?? null,
                      patchIds: this.draftOf(line.item)?.patchIds ?? [],
                      extraCents: line.extraCents,
                      previewImageUrl: line.productionImageUrl,
                      productionImageUrl: line.productionImageUrl,
                    },
                  }
                : undefined,
            })),
          },
          events: { create: { type: 'created', message: 'Pedido creado' } },
          payments: {
            create: {
              kind: effectivePlan.plan === 'FULL' ? 'FULL' : 'DEPOSIT',
              provider: input.paymentMethod,
              amountCents: effectivePlan.dueTodayCents,
            },
          },
        },
        include: { payments: true },
      });

      // Registro de uso del cupon. La tabla existia en el esquema desde el
      // principio pero nadie escribia en ella, asi que el limite por cliente
      // nunca podia cumplirse. Se crea despues de la orden porque necesita su id.
      if (couponId && customerId) {
        await tx.couponCustomerUse.create({ data: { couponId, customerId, orderId: created.id } });
      }

      return created;
    });

    const payment = order.payments[0];
    if (!payment) {
      throw new BadRequestException('No se pudo crear el pago del pedido');
    }
    let redirectUrl: string | null = null;

    try {
      if (!isOfflineMethod(input.paymentMethod)) {
        const provider = this.payments.active();
        const checkout = await provider.createCheckout({
          paymentId: payment.id,
          orderId: order.id,
          orderToken: order.publicToken,
          orderNumber: order.number,
          kindLabel: payment.kind === 'FULL' ? 'Pago total' : 'Seña',
          amountCents: payment.amountCents,
        });
        redirectUrl = checkout.redirectUrl;
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { provider: provider.name, rawPayload: { providerRef: checkout.providerRef } },
        });
      }
    } catch (error) {
      // No se borra el carrito hasta contar con un checkout válido. Si la
      // pasarela falla se libera la reserva y la persona puede reintentar.
      await this.failOrderAndReleaseReservation(order.id);
      throw error;
    }

    await this.prisma.cartItem.deleteMany({ where: { cartId } });
    await this.reservationQueue.add(
      'expire',
      { orderId: order.id },
      { delay: order.expiresAt ? order.expiresAt.getTime() - Date.now() : undefined, jobId: order.id },
    );

    // Acá NO se manda mail. La confirmación sale cuando el pago se aprueba
    // (`OrdersService.onPaymentApproved`): mandarla al crear el pedido hacía que
    // el cliente y el dueño recibieran "pedido confirmado" por compras que
    // después quedaban pendientes o fallidas.
    // El push sí se manda igual: es el aviso interno de que entró un intento.
    await this.push.broadcast({
      title: `Nuevo pedido ${formatOrderNumber(order.number)}`,
      body: `${order.contactName} — ${payment.kind === 'FULL' ? 'pago total' : 'seña'} pendiente`,
      // La ruta del panel es /dashboard/pedidos/:id; sin el prefijo, tocar la
      // notificación del sistema abría una página que no existe.
      url: `/dashboard/pedidos/${order.id}`,
      orderId: order.id,
    });

    return {
      orderId: order.id,
      orderToken: order.publicToken,
      displayNumber: formatOrderNumber(order.number),
      paymentMethod: input.paymentMethod,
      redirectUrl,
      bankTransferInstructions: input.paymentMethod === 'bank_transfer' ? storeSettings.bankTransferInstructions : null,
      dueTodayCents: payment.amountCents,
    };
  }

  async retryPayment(orderToken: string, paymentMethod: CheckoutPaymentMethod): Promise<CreateOrderResponse> {
    const order = await this.prisma.order.findUnique({
      where: { publicToken: orderToken },
      include: { payments: { orderBy: { createdAt: 'asc' } } },
    });

    if (!order) {
      throw new NotFoundException('El pedido no existe');
    }

    const storeSettings = await this.settings.get();

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${order.id} FOR UPDATE`;

      const freshOrder = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { payments: true },
      });

      if (freshOrder.financialStatus !== 'PENDING') {
        throw new BadRequestException(`El pedido no puede ser pagado porque su estado actual es ${freshOrder.financialStatus}`);
      }

      if (freshOrder.expiresAt && freshOrder.expiresAt < new Date()) {
        throw new BadRequestException('El pedido ha expirado. Por favor, realiza una nueva compra.');
      }

      // Cancel in-flight pending payments to avoid duplicate payment creations on same kind
      await tx.payment.updateMany({
        where: { orderId: order.id, kind: { in: ['DEPOSIT', 'FULL'] }, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });

      // Update reservation expiration time if they chose an offline method vs card
      let expiresAt = freshOrder.expiresAt;
      if (isOfflineMethod(paymentMethod)) {
        const reservationMinutes = this.config.get('BANK_TRANSFER_RESERVATION_TTL_HOURS') * 60;
        expiresAt = new Date(Date.now() + reservationMinutes * 60_000);
      } else {
        const reservationMinutes = this.config.get('CHECKOUT_RESERVATION_TTL_MINUTES');
        expiresAt = new Date(Date.now() + reservationMinutes * 60_000);
      }

      await tx.order.update({
        where: { id: order.id },
        data: { expiresAt },
      });

      const paymentKind = freshOrder.paymentPlan === 'FULL' ? 'FULL' : 'DEPOSIT';
      const dueTodayCents = freshOrder.paymentPlan === 'DEPOSIT_BALANCE' && freshOrder.depositCents
        ? freshOrder.depositCents
        : freshOrder.subtotalCents;

      const createdPayment = await tx.payment.create({
        data: {
          orderId: order.id,
          kind: paymentKind,
          provider: paymentMethod,
          amountCents: dueTodayCents,
        },
      });

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: 'payment_retry_started',
          message: `Intento de reintento de pago iniciado con ${paymentMethod}`,
        },
      });

      return { payment: createdPayment, expiresAt };
    });

    const payment = result.payment;
    let redirectUrl: string | null = null;

    try {
      if (!isOfflineMethod(paymentMethod)) {
        const provider = this.payments.active();
        const checkout = await provider.createCheckout({
          paymentId: payment.id,
          orderId: order.id,
          orderToken: order.publicToken,
          orderNumber: order.number,
          kindLabel: payment.kind === 'FULL' ? 'Pago total (reintento)' : 'Seña (reintento)',
          amountCents: payment.amountCents,
        });
        redirectUrl = checkout.redirectUrl;
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { provider: provider.name, rawPayload: { providerRef: checkout.providerRef } },
        });
      }
    } catch (error) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'REJECTED' },
      });
      throw error;
    }

    const job = await this.reservationQueue.getJob(order.id);
    if (job) {
      await job.remove().catch(() => undefined);
    }
    await this.reservationQueue.add(
      'expire',
      { orderId: order.id },
      { delay: Math.max(0, result.expiresAt ? result.expiresAt.getTime() - Date.now() : 0), jobId: order.id },
    );

    return {
      orderId: order.id,
      orderToken: order.publicToken,
      displayNumber: formatOrderNumber(order.number),
      paymentMethod,
      redirectUrl,
      bankTransferInstructions: paymentMethod === 'bank_transfer' ? storeSettings.bankTransferInstructions : null,
      dueTodayCents: payment.amountCents,
    };
  }

  /**
   * Revalida el cupón contra la base y lo consume dentro de la transacción del
   * checkout. Toma un lock `FOR UPDATE` sobre la fila para que dos checkouts
   * simultáneos no puedan pasarse del `maxUses`. Devuelve el descuento sobre el
   * subtotal; el envío gratis no descuenta acá (se resuelve al cotizar el envío),
   * sólo deja el cupón asociado para que `balance.service` lo honre.
   */
  private async resolveAndConsumeCoupon(
    tx: Prisma.TransactionClient,
    code: string,
    subtotalCents: number,
    customerId: string | null,
  ): Promise<{ couponId: string; discountCents: number; freeShipping: boolean }> {
    const normalized = code.toUpperCase().trim();
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM coupons WHERE code = ${normalized} FOR UPDATE`;
    const row = locked[0];
    if (!row) {
      throw new BadRequestException('El código de cupón no existe.');
    }

    const coupon = await tx.coupon.findUniqueOrThrow({ where: { id: row.id } });
    if (!coupon.isActive) {
      throw new BadRequestException('Este cupón ya no está vigente.');
    }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new BadRequestException('Este cupón ha expirado.');
    }
    if (coupon.maxUses !== null && coupon.uses >= coupon.maxUses) {
      throw new BadRequestException('Este cupón ya alcanzó el límite de usos.');
    }
    if (subtotalCents < coupon.minPurchaseCents) {
      throw new BadRequestException(
        `El monto mínimo de compra para este cupón es ${formatCentsAsArs(coupon.minPurchaseCents)}.`,
      );
    }
    if (coupon.oncePerCustomer) {
      if (!customerId) {
        throw new BadRequestException('Este cupón es de un solo uso por cliente: iniciá sesión para aplicarlo.');
      }
      const yaUsado = await tx.couponCustomerUse.findFirst({
        where: { couponId: coupon.id, customerId },
        select: { id: true },
      });
      if (yaUsado) {
        throw new BadRequestException('Ya usaste este cupón.');
      }
    }

    let discountCents = 0;
    switch (coupon.type) {
      case 'PERCENTAGE':
        discountCents = Math.round((subtotalCents * coupon.value) / 100);
        break;
      case 'FIXED_AMOUNT':
        discountCents = Math.min(coupon.value, subtotalCents);
        break;
      case 'FREE_SHIPPING':
        // No toca el subtotal: se descuenta sobre el envío, más abajo.
        discountCents = 0;
        break;
    }
    // Nunca más que el subtotal. El plan de pago ya recortaba, pero el total del
    // pedido se calculaba con este valor en crudo: un cupón mal cargado (más de
    // 100%) dejaba el pedido guardado con total negativo.
    discountCents = Math.min(discountCents, subtotalCents);

    await tx.coupon.update({ where: { id: coupon.id }, data: { uses: { increment: 1 } } });
    return { couponId: coupon.id, discountCents, freeShipping: coupon.type === 'FREE_SHIPPING' };
  }

  private async prepareLines(items: CartItemWithRelations[]): Promise<PreparedLine[]> {
    const results: PreparedLine[] = [];
    for (const item of items) {
      if (item.variant.product.status !== 'ACTIVE') {
        throw new BadRequestException(`El producto ${item.variant.product.name} ya no está disponible`);
      }
      const draft = this.draftOf(item);
      const extraCents = this.computeExtraCents(draft, item.variant.product.customization);
      const totalCents = (item.variant.priceCents + extraCents) * item.quantity;

      if (!draft) {
        results.push({ item, extraCents, totalCents, productionImageUrl: null });
        continue;
      }

      const buffer = await this.render.renderProductCustomization(item.variant.product.id, {
        playerName: draft.playerName,
        playerNumber: draft.playerNumber,
        patchIds: draft.patchIds ?? [],
      });
      const stored = await this.uploads.storeGeneratedPng(buffer, 'orders');
      results.push({ item, extraCents, totalCents, productionImageUrl: stored.url });
    }
    return results;
  }

  private async failOrderAndReleaseReservation(orderId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order || order.financialStatus !== 'PENDING') return;
      const reservedLines = order.items
        .filter((item) => item.fulfillmentMode === 'IN_STOCK' && item.variantId)
        .map((item) => ({ variantId: item.variantId as string, quantity: item.quantity }));
      await this.stock.lockInventory(tx, reservedLines.map((line) => line.variantId));
      await this.stock.release(tx, reservedLines);
      // El cupon se consumio al crear el pedido; si el pedido no prospera hay
      // que devolverlo. Sin esto, diez carritos abandonados agotaban un cupon
      // de diez usos sin una sola venta.
      if (order.couponId) {
        await tx.coupon.update({ where: { id: order.couponId }, data: { uses: { decrement: 1 } } });
        await tx.couponCustomerUse.deleteMany({ where: { orderId } });
      }

      await tx.order.update({
        where: { id: orderId },
        data: { financialStatus: 'FAILED', fulfillmentStatus: 'CANCELLED', expiresAt: null },
      });
      await tx.orderEvent.create({
        data: { orderId, type: 'payment_setup_failed', message: 'No se pudo iniciar el checkout' },
      });
    });
  }

  private draftOf(item: CartItemWithRelations): CartCustomizationDraft | null {
    const draft = item.customizationDraft as CartCustomizationDraft | null;
    if (!draft) return null;
    const hasContent = !!draft.playerName || draft.playerNumber !== undefined || (draft.patchIds ?? []).length > 0;
    return hasContent ? draft : null;
  }

  /**
   * Delegado en `@tienda/shared` a propósito: este cálculo estaba duplicado en
   * el carrito y en el checkout, y dos copias del precio son dos precios.
   */
  private computeExtraCents(
    draft: CartCustomizationDraft | null,
    template: CartItemWithRelations['variant']['product']['customization'],
  ): number {
    return calculateCustomizationExtraCents(draft, template);
  }

  private optionsLabel(item: CartItemWithRelations): string {
    return item.variant.optionValues.map((ov) => ov.value.value).join(' / ');
  }
}
