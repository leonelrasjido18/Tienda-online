import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { formatOrderNumber } from '@tienda/shared';

@Injectable()
export class ProductionSheetService {
  constructor(private readonly prisma: PrismaService) {}

  async generateBatchSheetHtml(batchId: string): Promise<string> {
    const batch = await this.prisma.importBatch.findUnique({
      where: { id: batchId },
      include: {
        orders: {
          include: {
            items: {
              include: {
                customization: true,
              },
            },
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Lote no encontrado');
    }

    const itemsToPrint: Array<{
      orderNumber: string;
      customerName: string;
      productName: string;
      options: string;
      quantity: number;
      playerName: string;
      playerNumber: string;
      patches: string[];
      previewUrl: string | null;
      productionUrl: string | null;
    }> = [];

    for (const order of batch.orders) {
      for (const item of order.items) {
        if (item.customization) {
          let patchNames: string[] = [];
          const patchIds = item.customization.patchIds;
          if (Array.isArray(patchIds) && patchIds.every((id): id is string => typeof id === 'string') && patchIds.length > 0) {
            const patches = await this.prisma.patch.findMany({ where: { id: { in: patchIds } } });
            patchNames = patches.map((p) => p.name);
          }

          itemsToPrint.push({
            orderNumber: formatOrderNumber(order.number),
            customerName: order.contactName,
            productName: item.productName,
            options: item.optionsLabel ?? '',
            quantity: item.quantity,
            playerName: item.customization.playerName ?? '-',
            playerNumber: item.customization.playerNumber !== null ? String(item.customization.playerNumber) : '-',
            patches: patchNames,
            previewUrl: item.customization.previewImageUrl,
            productionUrl: item.customization.productionImageUrl,
          });
        }
      }
    }

    let rowsHtml = '';
    if (itemsToPrint.length === 0) {
      rowsHtml = '<tr><td colspan="7" style="text-align: center; padding: 20px;">No hay camisetas personalizadas en este lote.</td></tr>';
    } else {
      for (const item of itemsToPrint) {
        rowsHtml += `
          <tr>
            <td><strong>${item.orderNumber}</strong><br><span style="font-size: 11px; color: #555;">${item.customerName}</span></td>
            <td>${item.productName}<br><span style="font-size: 11px; color: #666;">${item.options}</span></td>
            <td style="text-align: center;">${item.quantity}</td>
            <td style="font-family: monospace; font-size: 16px; font-weight: bold;">${item.playerName}</td>
            <td style="font-family: monospace; font-size: 20px; font-weight: bold; text-align: center;">${item.playerNumber}</td>
            <td>${item.patches.join(', ') || '-'}</td>
            <td style="text-align: center;">
              ${item.productionUrl ? `<img src="${item.productionUrl}" style="max-height: 80px; max-width: 80px; border: 1px solid #ddd; border-radius: 4px;" />` : item.previewUrl ? `<img src="${item.previewUrl}" style="max-height: 80px; max-width: 80px; border: 1px solid #ddd; border-radius: 4px;" />` : '-'}
            </td>
          </tr>
        `;
      }
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Hoja de Producción - Lote ${batch.code}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #333; margin: 20px; }
            h1 { font-size: 22px; margin-bottom: 5px; }
            .meta { font-size: 14px; color: #666; margin-bottom: 20px; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ddd; padding: 10px 12px; text-align: left; vertical-align: middle; }
            th { background-color: #f5f5f5; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
            tr:nth-child(even) { background-color: #fafafa; }
            @media print {
              body { margin: 10px; font-size: 12px; }
              button { display: none; }
              @page { size: A4 landscape; margin: 1cm; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; page-break-after: auto; }
            }
            .no-print-btn {
              background-color: #0b1f4d; color: white; border: none; padding: 8px 16px; border-radius: 4px;
              font-weight: bold; cursor: pointer; margin-bottom: 15px;
            }
            .no-print-btn:hover { background-color: #123075; }
          </style>
        </head>
        <body>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h1>Hoja de Producción — Lote: ${batch.code}</h1>
            <button class="no-print-btn" onclick="window.print()">Imprimir PDF / Hoja</button>
          </div>
          <div class="meta">
            Proveedor: <strong>${batch.supplier ?? 'No asignado'}</strong> | 
            Estado: <strong>${batch.status}</strong> | 
            Camisetas personalizadas a producir: <strong>${itemsToPrint.length}</strong>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 12%;">Pedido</th>
                <th style="width: 25%;">Camiseta</th>
                <th style="width: 6%; text-align: center;">Cant</th>
                <th style="width: 15%;">Nombre</th>
                <th style="width: 8%; text-align: center;">Número</th>
                <th style="width: 18%;">Parches</th>
                <th style="width: 16%; text-align: center;">Diseño</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `;
  }

  async generateOrderReceiptHtml(orderId: string): Promise<string> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            customization: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    let itemsHtml = '';
    for (const item of order.items) {
      const customText = item.customization
        ? `<div style="font-size: 11px; margin-top: 4px; color: #555;">Dorsal: <strong>${item.customization.playerName ?? '-'} (${item.customization.playerNumber ?? '-'})</strong></div>`
        : '';
      itemsHtml += `
        <tr>
          <td>
            <strong>${item.productName}</strong>
            <div style="font-size: 11px; color: #666;">${item.optionsLabel ?? ''}</div>
            ${customText}
          </td>
          <td style="text-align: center;">${item.quantity}</td>
          <td style="text-align: right;">$${(item.unitPriceCents / 100).toFixed(2)}</td>
          <td style="text-align: right;">$${(item.totalCents / 100).toFixed(2)}</td>
        </tr>
      `;
    }

    const shippingInfo = order.pickupInStore
      ? '<p>Método de entrega: <strong>Retiro en sucursal</strong></p>'
      : `
        <p>Método de entrega: <strong>Envío a domicilio</strong></p>
        <p>
          Dirección: <strong>${order.shippingStreet} ${order.shippingNumber ?? ''}</strong><br/>
          ${order.shippingFloor ? `Piso/Depto: ${order.shippingFloor}<br/>` : ''}
          Código Postal: ${order.shippingPostalCode ?? ''} — ${order.shippingCity ?? ''}, ${order.shippingProvince ?? ''}
        </p>
      `;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Remito - Pedido ${formatOrderNumber(order.number)}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #333; margin: 40px; font-size: 14px; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0b1f4d; padding-bottom: 15px; margin-bottom: 20px; }
            .brand { font-size: 24px; font-weight: bold; color: #0b1f4d; }
            .title { font-size: 20px; font-weight: bold; text-align: right; }
            .info-block { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .info-col { width: 48%; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th, td { border-bottom: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f9f9f9; font-weight: 600; color: #555; }
            .totals { width: 300px; margin-left: auto; margin-right: 0; }
            .totals table { margin-bottom: 0; }
            .totals td { border: none; padding: 6px 12px; }
            .totals tr.grand-total td { font-weight: bold; font-size: 16px; border-top: 1px solid #0b1f4d; color: #0b1f4d; padding-top: 10px; }
            @media print {
              body { margin: 15px; }
              button { display: none; }
              @page { size: A4; margin: 1cm; }
            }
            .no-print-btn {
              background-color: #0b1f4d; color: white; border: none; padding: 8px 16px; border-radius: 4px;
              font-weight: bold; cursor: pointer; margin-bottom: 15px;
            }
          </style>
        </head>
        <body>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div class="brand">Remeras del Área</div>
            <button class="no-print-btn" onclick="window.print()">Imprimir Remito</button>
          </div>
          <div class="header">
            <div>
              <span class="title">Remito de Pedido</span>
            </div>
            <div style="text-align: right;">
              Pedido: <strong>${formatOrderNumber(order.number)}</strong><br/>
              Fecha: ${order.createdAt.toLocaleDateString('es-AR')}<br/>
              Plan de pago: ${order.paymentPlan === 'DEPOSIT_BALANCE' ? 'Seña + Saldo' : 'Pago Completo'}
            </div>
          </div>
          <div class="info-block">
            <div class="info-col">
              <h3 style="margin-top: 0; border-bottom: 1px solid #eee; padding-bottom: 5px;">Datos del Cliente</h3>
              <p>
                Nombre: <strong>${order.contactName}</strong><br/>
                Email: ${order.contactEmail}<br/>
                Teléfono: ${order.contactPhone ?? '-'}
              </p>
            </div>
            <div class="info-col">
              <h3 style="margin-top: 0; border-bottom: 1px solid #eee; padding-bottom: 5px;">Detalles de Entrega</h3>
              ${shippingInfo}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th style="text-align: center; width: 10%;">Cant</th>
                <th style="text-align: right; width: 15%;">Unitario</th>
                <th style="text-align: right; width: 15%;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="totals">
            <table>
              <tr>
                <td>Subtotal:</td>
                <td style="text-align: right;">$${(order.subtotalCents / 100).toFixed(2)}</td>
              </tr>
              ${order.shippingCents !== null ? `
              <tr>
                <td>Envío:</td>
                <td style="text-align: right;">$${(order.shippingCents / 100).toFixed(2)}</td>
              </tr>` : ''}
              <tr class="grand-total">
                <td>Total:</td>
                <td style="text-align: right;">$${(order.totalCents / 100).toFixed(2)}</td>
              </tr>
              ${order.depositCents !== null ? `
              <tr style="font-size: 13px; color: #666;">
                <td>Seña pagada:</td>
                <td style="text-align: right;">$${(order.depositCents / 100).toFixed(2)}</td>
              </tr>
              <tr style="font-size: 13px; color: #666;">
                <td>Saldo pendiente:</td>
                <td style="text-align: right;">$${((order.balanceCents ?? 0) / 100).toFixed(2)}</td>
              </tr>` : ''}
            </table>
          </div>

          ${order.notes ? `
          <div style="margin-top: 40px; border: 1px dashed #ccc; padding: 15px; border-radius: 4px;">
            <strong style="font-size: 13px;">Notas del Pedido:</strong>
            <p style="margin: 5px 0 0 0; font-size: 13px; color: #555;">${order.notes}</p>
          </div>` : ''}
        </body>
      </html>
    `;
  }
}
