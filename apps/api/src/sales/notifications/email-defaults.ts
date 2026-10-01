import type { EmailTemplateKey } from '@tienda/shared';

/**
 * Texto original de cada correo. Es lo que se usa mientras nadie edite la
 * plantilla desde el panel, y a lo que se vuelve al tocar "Restaurar original".
 *
 * Se mantiene acá y no en la base a propósito: si la tabla queda vacía por un
 * error de migración o alguien borra una fila, los correos siguen saliendo.
 */
export const EMAIL_DEFAULTS: Record<EmailTemplateKey, { subject: string; bodyHtml: string }> = {
  ORDER_CONFIRMATION: {
    subject: 'Confirmamos tu pedido {{numero_pedido}}',
    bodyHtml: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;">
  <p style="font-size:15px;color:#374151;">Hola {{nombre}},</p>
  <p style="font-size:15px;color:#374151;">
    Recibimos tu pago de <strong>{{monto_pagado}}</strong> y tu pedido <strong>{{numero_pedido}}</strong> ya está confirmado.
  </p>
  {{detalle_pedido}}
  <p style="margin-top:22px;font-size:13px;color:#6B7280;">
    Cualquier duda respondé este correo y te ayudamos.
  </p>
</div>`,
  },

  SALE_ALERT: {
    subject: '{{evento}}: pedido {{numero_pedido}} — {{total}}',
    bodyHtml: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;">
  <p style="font-size:16px;color:#111827;"><strong>{{evento}} — {{numero_pedido}}</strong></p>
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px;font-size:14px;color:#374151;">
    <tr><td style="padding:2px 12px 2px 0;color:#6B7280;">Cliente</td><td style="padding:2px 0;">{{cliente}}</td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#6B7280;">Email</td><td style="padding:2px 0;">{{email}}</td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#6B7280;">Teléfono</td><td style="padding:2px 0;">{{telefono}}</td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#6B7280;">Plan</td><td style="padding:2px 0;">{{plan}}</td></tr>
  </table>
  {{detalle_pedido}}
</div>`,
  },

  BALANCE_REQUEST: {
    subject: '¡Llegó tu pedido {{numero_pedido}}! Resta abonar {{total}}',
    bodyHtml: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;">
  <p>Hola {{nombre}},</p>
  <p>Tu pedido <strong>{{numero_pedido}}</strong> ya llegó y está listo para despacharse.</p>
  <p>
    Saldo: {{saldo}}<br/>
    Envío: {{envio}}<br/>
    <strong>Total a pagar: {{total}}</strong>
  </p>
  <p style="text-align:center;margin:28px 0;">
    <a href="{{link}}" style="background:#111827;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;display:inline-block;">Pagar ahora</a>
  </p>
  <p style="font-size:13px;color:#6B7280;">El link vence el {{vence}}.</p>
</div>`,
  },

  BALANCE_REMINDER: {
    subject: 'Recordatorio: te falta abonar el pedido {{numero_pedido}}',
    bodyHtml: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;">
  <p>Hola {{nombre}},</p>
  <p>Tu pedido <strong>{{numero_pedido}}</strong> sigue esperando el pago del saldo.</p>
  <p><strong>Total a pagar: {{total}}</strong></p>
  <p style="text-align:center;margin:28px 0;">
    <a href="{{link}}" style="background:#111827;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;display:inline-block;">Pagar ahora</a>
  </p>
  <p style="font-size:13px;color:#6B7280;">{{dias_restantes}}</p>
</div>`,
  },

  EMAIL_VERIFICATION: {
    subject: 'Verificá tu email: {{codigo}}',
    bodyHtml: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;">
  <p>Hola,</p>
  <p>Usá este código para verificar tu email y activar tu cuenta:</p>
  <p style="font-size:24px;font-weight:bold;letter-spacing:4px;text-align:center;margin:20px 0;">{{codigo}}</p>
  <p style="text-align:center;margin:28px 0;">
    <a href="{{link}}" style="background:#111827;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;display:inline-block;">Verificar mi email</a>
  </p>
  <p style="font-size:13px;color:#6b7280;">Si el botón no funciona, copiá este enlace:<br/><a href="{{link}}">{{link}}</a></p>
  <p>Este código expira en 30 minutos. Si no creaste una cuenta, ignorá este mensaje.</p>
</div>`,
  },

  PASSWORD_RESET: {
    subject: 'Restablecé tu contraseña: {{codigo}}',
    bodyHtml: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;">
  <p>Hola,</p>
  <p>Recibimos un pedido para restablecer la contraseña de tu cuenta. Usá este código:</p>
  <p style="font-size:24px;font-weight:bold;letter-spacing:4px;text-align:center;margin:20px 0;">{{codigo}}</p>
  <p>Este código expira en 30 minutos. Si no lo pediste, ignorá este mensaje: tu contraseña no cambia sola.</p>
</div>`,
  },

  ABANDONED_CART: {
    subject: 'Te quedaron {{cantidad}} producto(s) en el carrito',
    bodyHtml: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;">
  <p>Hola {{nombre}},</p>
  <p>Dejaste estos productos en el carrito: {{productos}}.</p>
  <p style="text-align:center;margin:28px 0;">
    <a href="{{link}}" style="background:#111827;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;display:inline-block;">Retomar mi compra</a>
  </p>
</div>`,
  },

  SHIPMENT: {
    subject: 'Tu pedido {{numero_pedido}} fue despachado',
    bodyHtml: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;">
  <p>Hola {{nombre}},</p>
  <p>Te avisamos que tu pedido <strong>{{numero_pedido}}</strong> ya fue despachado.</p>
  <p>
    Empresa de correo: <strong>{{correo}}</strong><br/>
    Código de seguimiento: <strong>{{seguimiento}}</strong>
  </p>
  <p>Podés hacer el seguimiento con el código en la página del correo correspondiente.</p>
</div>`,
  },
};
