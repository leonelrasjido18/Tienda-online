import type { EmailTemplateKey } from '@tienda/shared';

/**
 * Datos de mentira para la previsualización del panel. Están escritos con
 * valores realistas a propósito: un ejemplo con "Lorem ipsum" no deja ver si el
 * correo se rompe con un nombre largo o un precio de seis cifras.
 */
const DETALLE_EJEMPLO = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:18px;">
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #E5E7EB;vertical-align:top;width:80px;">
        <div style="width:64px;height:64px;border-radius:6px;border:1px solid #E5E7EB;background:#F3F4F6;"></div>
      </td>
      <td style="padding:14px 0;border-bottom:1px solid #E5E7EB;vertical-align:top;font-size:14px;color:#374151;">
        <strong>Camiseta Boca Juniors – Titular – 2026-27</strong><br/>
        <span style="font-size:13px;color:#4B5563;">Talle: <strong>L</strong> &nbsp;·&nbsp; Manga: <strong>Corta</strong></span><br/>
        <span style="font-size:12px;color:#6B7280;">Por encargo &nbsp;·&nbsp; Cantidad: 1</span>
        <div style="margin-top:8px;padding:8px 10px;background:#FEF3C7;border-left:3px solid #D97706;font-size:13px;color:#78350F;">
          <strong style="text-transform:uppercase;letter-spacing:.04em;font-size:11px;">Personalizada</strong><br/>
          Nombre: <strong>PAREDES</strong><br/>Número: <strong>5</strong>
        </div>
      </td>
      <td style="padding:14px 0;border-bottom:1px solid #E5E7EB;vertical-align:top;text-align:right;font-size:14px;color:#111827;white-space:nowrap;">$ 44.500,00</td>
    </tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">
    <tr><td style="padding:4px 0;font-size:14px;color:#4B5563;">Subtotal</td><td style="padding:4px 0;text-align:right;font-size:14px;color:#4B5563;">$ 44.500,00</td></tr>
    <tr><td style="padding:4px 0;font-size:15px;color:#111827;font-weight:bold;">Total</td><td style="padding:4px 0;text-align:right;font-size:15px;color:#111827;font-weight:bold;">$ 44.500,00</td></tr>
  </table>
  <div style="margin-top:22px;padding-top:16px;border-top:1px solid #E5E7EB;">
    <p style="margin:0 0 6px;font-size:14px;color:#374151;"><strong>Envío a domicilio</strong></p>
    <p style="margin:0;font-size:14px;color:#4B5563;line-height:1.6;">Corrientes 1234<br/>Paraná<br/>Entre Ríos<br/>CP 3100</p>
  </div>`;

export const EJEMPLOS_PREVISUALIZACION: Record<EmailTemplateKey, Record<string, string>> = {
  ORDER_CONFIRMATION: {
    nombre: 'Leonel Rasjido',
    numero_pedido: '#2234',
    total: '$ 44.500,00',
    monto_pagado: '$ 22.250,00',
    saldo: '$ 22.250,00',
    detalle_pedido: DETALLE_EJEMPLO,
  },
  SALE_ALERT: {
    evento: 'Pago aprobado',
    numero_pedido: '#2234',
    cliente: 'Leonel Rasjido',
    email: 'cliente@ejemplo.com',
    telefono: '343 555-0000',
    plan: 'Seña + saldo',
    total: '$ 44.500,00',
    detalle_pedido: DETALLE_EJEMPLO,
  },
  BALANCE_REQUEST: {
    nombre: 'Leonel Rasjido',
    numero_pedido: '#2234',
    saldo: '$ 22.250,00',
    envio: '$ 8.500,00',
    total: '$ 30.750,00',
    link: 'https://remerasdelarea.com/saldo/ejemplo',
    vence: '15/10/2026',
  },
  BALANCE_REMINDER: {
    nombre: 'Leonel Rasjido',
    numero_pedido: '#2234',
    total: '$ 30.750,00',
    link: 'https://remerasdelarea.com/saldo/ejemplo',
    dias_restantes: 'Te quedan 3 día(s) antes de que venza el link.',
  },
  EMAIL_VERIFICATION: {
    codigo: '117558',
    link: 'https://remerasdelarea.com/verificar?email=cliente%40ejemplo.com',
  },
  PASSWORD_RESET: {
    codigo: '482910',
  },
  ABANDONED_CART: {
    nombre: 'Leonel Rasjido',
    cantidad: '2',
    productos: 'Camiseta River Plate Titular 2026-27, Camiseta PSG Titular 2026-27',
    link: 'https://remerasdelarea.com/carrito?recuperar=ejemplo',
  },
  SHIPMENT: {
    nombre: 'Leonel Rasjido',
    numero_pedido: '#2234',
    correo: 'Correo Argentino',
    seguimiento: 'CA123456789AR',
  },
};
