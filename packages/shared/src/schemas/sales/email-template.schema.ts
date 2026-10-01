import { z } from 'zod';

/**
 * Plantillas de los correos, editables desde el panel.
 *
 * El texto vive en la base; si una plantilla no fue editada nunca, se usa la
 * que trae el código. Así el correo nunca queda vacío por un error de carga, y
 * "Restaurar original" es simplemente borrar la fila.
 *
 * Las variables se escriben `{{asi}}` y se reemplazan por texto escapado. Las
 * marcadas `isHtml` son bloques que arma el sistema (la tabla de productos, por
 * ejemplo) y se insertan tal cual; no se pueden escribir a mano.
 */
export const EMAIL_TEMPLATE_KEYS = [
  'ORDER_CONFIRMATION',
  'SALE_ALERT',
  'BALANCE_REQUEST',
  'BALANCE_REMINDER',
  'EMAIL_VERIFICATION',
  'PASSWORD_RESET',
  'ABANDONED_CART',
  'SHIPMENT',
] as const;

export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

export interface EmailTemplateVariable {
  name: string;
  description: string;
  /** Bloque de HTML que arma el sistema: se inserta sin escapar. */
  isHtml?: boolean;
}

export interface EmailTemplateInfo {
  label: string;
  description: string;
  audience: 'cliente' | 'dueño';
  variables: EmailTemplateVariable[];
}

const NOMBRE: EmailTemplateVariable = { name: 'nombre', description: 'Nombre de quien recibe el correo' };
const NUMERO: EmailTemplateVariable = { name: 'numero_pedido', description: 'Número del pedido, por ejemplo #2234' };
const DETALLE: EmailTemplateVariable = {
  name: 'detalle_pedido',
  description: 'Tabla con los productos, talles, personalización, totales y envío',
  isHtml: true,
};

export const EMAIL_TEMPLATE_CATALOG: Record<EmailTemplateKey, EmailTemplateInfo> = {
  ORDER_CONFIRMATION: {
    label: 'Confirmación de pedido',
    description: 'Se envía al cliente cuando el pago se aprueba.',
    audience: 'cliente',
    variables: [
      NOMBRE,
      NUMERO,
      { name: 'total', description: 'Total del pedido' },
      { name: 'monto_pagado', description: 'Lo que abonó hoy (seña o total)' },
      { name: 'saldo', description: 'Saldo pendiente, vacío si pagó todo' },
      DETALLE,
    ],
  },
  SALE_ALERT: {
    label: 'Aviso de venta (al dueño)',
    description: 'Llega a la casilla de la tienda cuando entra un pago.',
    audience: 'dueño',
    variables: [
      { name: 'evento', description: 'Pago aprobado / Saldo cobrado' },
      NUMERO,
      { name: 'cliente', description: 'Nombre del cliente' },
      { name: 'email', description: 'Email del cliente' },
      { name: 'telefono', description: 'Teléfono del cliente' },
      { name: 'plan', description: 'Pago total o Seña + saldo' },
      { name: 'total', description: 'Total del pedido' },
      DETALLE,
    ],
  },
  BALANCE_REQUEST: {
    label: 'Pedido de saldo',
    description: 'Avisa que el encargo llegó y hay que abonar el saldo más el envío.',
    audience: 'cliente',
    variables: [
      NOMBRE,
      NUMERO,
      { name: 'saldo', description: 'Saldo del pedido' },
      { name: 'envio', description: 'Costo del envío' },
      { name: 'total', description: 'Total a abonar' },
      { name: 'link', description: 'Dirección del link de pago' },
      { name: 'vence', description: 'Fecha de vencimiento del link' },
    ],
  },
  BALANCE_REMINDER: {
    label: 'Recordatorio de saldo',
    description: 'Se manda si el saldo sigue impago y el link está por vencer.',
    audience: 'cliente',
    variables: [
      NOMBRE,
      NUMERO,
      { name: 'total', description: 'Total a abonar' },
      { name: 'link', description: 'Dirección del link de pago' },
      { name: 'dias_restantes', description: 'Días que faltan para que venza' },
    ],
  },
  EMAIL_VERIFICATION: {
    label: 'Verificación de email',
    description: 'Código que se manda al crear la cuenta.',
    audience: 'cliente',
    variables: [
      { name: 'codigo', description: 'Código de 6 dígitos' },
      { name: 'link', description: 'Dirección de la pantalla de verificación' },
    ],
  },
  PASSWORD_RESET: {
    label: 'Recuperar contraseña',
    description: 'Código para restablecer la contraseña.',
    audience: 'cliente',
    variables: [{ name: 'codigo', description: 'Código de 6 dígitos' }],
  },
  ABANDONED_CART: {
    label: 'Carrito abandonado',
    description: 'Recordatorio para quien dejó productos sin comprar.',
    audience: 'cliente',
    variables: [
      NOMBRE,
      { name: 'cantidad', description: 'Cantidad de productos en el carrito' },
      { name: 'productos', description: 'Nombres de los productos, separados por coma' },
      { name: 'link', description: 'Dirección para retomar la compra' },
    ],
  },
  SHIPMENT: {
    label: 'Pedido despachado',
    description: 'Avisa que el pedido salió, con el código de seguimiento.',
    audience: 'cliente',
    variables: [
      NOMBRE,
      NUMERO,
      { name: 'correo', description: 'Empresa de correo' },
      { name: 'seguimiento', description: 'Código de seguimiento' },
    ],
  },
};

export const updateEmailTemplateSchema = z.object({
  subject: z.string().trim().min(1, 'El asunto no puede quedar vacío').max(200),
  bodyHtml: z.string().trim().min(1, 'El cuerpo no puede quedar vacío').max(20_000),
});
export type UpdateEmailTemplateInput = z.infer<typeof updateEmailTemplateSchema>;

export const emailTemplateDtoSchema = z.object({
  key: z.enum(EMAIL_TEMPLATE_KEYS),
  subject: z.string(),
  bodyHtml: z.string(),
  /** false = nunca se editó, se está usando el texto que trae el sistema. */
  personalizada: z.boolean(),
  updatedAt: z.string().nullable(),
});
export type EmailTemplateDto = z.infer<typeof emailTemplateDtoSchema>;

/**
 * Reemplaza `{{variable}}` por su valor. Es sustitución de texto y nada más: no
 * evalúa nada, así que una plantilla mal escrita no puede ejecutar código.
 * Las variables desconocidas se dejan como están para que se vean en la
 * previsualización en vez de desaparecer sin aviso.
 */
export function renderEmailTemplate(plantilla: string, valores: Record<string, string>): string {
  return plantilla.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (original: string, nombre: string): string => {
    const valor = valores[nombre];
    return valor === undefined ? original : valor;
  });
}
