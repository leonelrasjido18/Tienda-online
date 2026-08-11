import { randomUUID } from 'node:crypto';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AddCartItemInput, CartCustomizationDraft, CartDto, CartItemDto } from '@tienda/shared';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

const CART_TTL_DAYS = 30;

const CART_ITEM_INCLUDE = {
  variant: {
    include: {
      product: {
        include: {
          images: { orderBy: { position: 'asc' as const }, take: 1 },
          customization: { include: { patchOptions: { include: { patch: true } } } },
        },
      },
      optionValues: { include: { value: true } },
      inventory: true,
    },
  },
} satisfies Prisma.CartItemInclude;

type CartItemWithRelations = Prisma.CartItemGetPayload<{ include: typeof CART_ITEM_INCLUDE }>;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async createCart() {
    return this.prisma.cart.create({
      data: { sessionToken: randomUUID(), expiresAt: this.newExpiry() },
    });
  }

  async findValidCart(sessionToken: string | undefined) {
    if (!sessionToken) return null;
    const cart = await this.prisma.cart.findUnique({ where: { sessionToken } });
    if (!cart || cart.expiresAt < new Date()) return null;
    return cart;
  }

  async getCartDto(cartId: string): Promise<CartDto> {
    const items = await this.prisma.cartItem.findMany({
      where: { cartId },
      include: CART_ITEM_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });

    const dtoItems = items.map((item) => this.toItemDto(item));
    const subtotalCents = dtoItems.reduce((sum, item) => sum + item.totalCents, 0);
    const requiresDeposit = dtoItems.some((item) => item.available < item.quantity && item.allowPreorder);

    return { id: cartId, items: dtoItems, subtotalCents, requiresDeposit };
  }

  async addItem(cartId: string, input: AddCartItemInput): Promise<CartDto> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: input.variantId },
      include: { product: true },
    });
    if (!variant || variant.product.status !== 'ACTIVE') {
      throw new NotFoundException('La variante no existe');
    }

    const hasCustomization = !!input.customization && Object.keys(input.customization).length > 0;

    if (!hasCustomization) {
      const existing = await this.prisma.cartItem.findFirst({
        where: { cartId, variantId: input.variantId, customizationDraft: { equals: Prisma.DbNull } },
      });
      if (existing) {
        await this.prisma.cartItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + input.quantity },
        });
        await this.touchCart(cartId);
        return this.getCartDto(cartId);
      }
    }

    await this.prisma.cartItem.create({
      data: {
        cartId,
        variantId: input.variantId,
        quantity: input.quantity,
        priceCentsAtAdd: variant.priceCents,
        customizationDraft: hasCustomization ? (input.customization as Prisma.InputJsonValue) : Prisma.DbNull,
      },
    });
    await this.touchCart(cartId);
    return this.getCartDto(cartId);
  }

  async updateItemQuantity(cartId: string, itemId: string, quantity: number): Promise<CartDto> {
    if (quantity <= 0) {
      return this.removeItem(cartId, itemId);
    }
    await this.prisma.cartItem.update({ where: { id: itemId, cartId }, data: { quantity } });
    await this.touchCart(cartId);
    return this.getCartDto(cartId);
  }

  async removeItem(cartId: string, itemId: string): Promise<CartDto> {
    await this.prisma.cartItem.delete({ where: { id: itemId, cartId } }).catch(() => {
      throw new BadRequestException('El item ya no está en el carrito');
    });
    await this.touchCart(cartId);
    return this.getCartDto(cartId);
  }

  async clearCart(cartId: string) {
    await this.prisma.cartItem.deleteMany({ where: { cartId } });
  }

  /** Vincula un carrito anónimo (por token de sesión) con el cliente autenticado. */
  async mergeAnonymousCartWithCustomer(sessionToken: string, customerId: string): Promise<void> {
    const anonymousCart = await this.prisma.cart.findUnique({
      where: { sessionToken },
      include: { items: true },
    });

    if (!anonymousCart || anonymousCart.expiresAt < new Date()) {
      return;
    }

    // Buscar si el cliente ya tiene un carrito activo
    const customerCart = await this.prisma.cart.findFirst({
      where: {
        customerId,
        expiresAt: { gte: new Date() },
      },
      include: { items: true },
    });

    if (!customerCart) {
      // Si el cliente no tiene carrito, simplemente le asignamos el anónimo
      await this.prisma.cart.update({
        where: { id: anonymousCart.id },
        data: { customerId },
      });
      return;
    }

    // Si ambos carritos existen, fusionamos los ítems del anónimo al del cliente
    for (const anonItem of anonymousCart.items) {
      if (!anonItem.variantId) continue;
      const isCustomized = anonItem.customizationDraft && Object.keys(anonItem.customizationDraft).length > 0;

      let matchedItem = null;
      if (!isCustomized) {
        matchedItem = customerCart.items.find(
          (item) => item.variantId === anonItem.variantId && !item.customizationDraft,
        );
      } else {
        matchedItem = customerCart.items.find(
          (item) =>
            item.variantId === anonItem.variantId &&
            JSON.stringify(item.customizationDraft) === JSON.stringify(anonItem.customizationDraft),
        );
      }

      if (matchedItem) {
        // Si el ítem ya existe, acumulamos cantidad
        await this.prisma.cartItem.update({
          where: { id: matchedItem.id },
          data: { quantity: matchedItem.quantity + anonItem.quantity },
        });
      } else {
        // Si no existe, lo insertamos en el carrito del cliente
        await this.prisma.cartItem.create({
          data: {
            cartId: customerCart.id,
            variantId: anonItem.variantId,
            quantity: anonItem.quantity,
            priceCentsAtAdd: anonItem.priceCentsAtAdd,
            customizationDraft: anonItem.customizationDraft ?? Prisma.DbNull,
          },
        });
      }
    }

    // Eliminamos el carrito anónimo ahora vacío
    await this.prisma.cart.delete({
      where: { id: anonymousCart.id },
    });
  }

  private async touchCart(cartId: string) {
    await this.prisma.cart.update({ where: { id: cartId }, data: { expiresAt: this.newExpiry() } });
  }

  private newExpiry() {
    return new Date(Date.now() + CART_TTL_DAYS * 24 * 60 * 60 * 1000);
  }

  private toItemDto(item: CartItemWithRelations): CartItemDto {
    const variant = item.variant;
    const product = variant.product;
    const optionsLabel = variant.optionValues.map((ov) => ov.value.value).join(' / ') || null;
    const available = Math.max(0, (variant.inventory?.quantity ?? 0) - (variant.inventory?.reserved ?? 0));
    const allowPreorder = variant.inventory?.allowPreorder ?? false;
    const draft = item.customizationDraft as unknown as CartCustomizationDraft | null;
    const extraCents = this.computeExtraCents(draft, product.customization);

    return {
      id: item.id,
      variantId: variant.id,
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      optionsLabel,
      imageUrl: product.images[0]?.url ?? null,
      sku: variant.sku,
      quantity: item.quantity,
      unitPriceCents: variant.priceCents,
      extraCents,
      totalCents: (variant.priceCents + extraCents) * item.quantity,
      fulfillmentMode: product.fulfillmentMode,
      available,
      allowPreorder,
      customization: draft,
    };
  }

  private computeExtraCents(
    draft: CartCustomizationDraft | null,
    template: CartItemWithRelations['variant']['product']['customization'],
  ): number {
    if (!draft || !template) return 0;
    let extra = 0;
    if (draft.playerName) extra += template.nameExtraCents;
    if (draft.playerNumber !== undefined) extra += template.numberExtraCents;
    for (const patchId of draft.patchIds ?? []) {
      const option = template.patchOptions.find((po) => po.patchId === patchId);
      if (option) extra += option.patch.priceCents;
    }
    return extra;
  }
}
