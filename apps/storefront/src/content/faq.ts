/* BORRADOR — Validar con la clienta antes de publicar */

export interface FaqItem {
  question: string;
  answer: string;
  category: string;
}

export const FAQS: FaqItem[] = [
  {
    category: 'Encargos y Tiempos',
    question: '¿Cómo funciona la compra por encargo a China?',
    answer: 'Al realizar el pedido abonás una seña del 50% para reservar la producción en fábrica. Cuando el lote llega a la Argentina (~20 días hábiles), abonás el 50% restante más el costo de envío y despachamos tu paquete.',
  },
  {
    category: 'Encargos y Tiempos',
    question: '¿Qué pasa si el lote se demora en aduana?',
    answer: 'Los plazos son estimados y dependen del proceso aduanero. Si ocurre algún retraso, te mantenemos informado de forma proactiva a través de email y estado del pedido.',
  },
  {
    category: 'Talles y Calce',
    question: '¿Los talles chinos son más chicos que los locales?',
    answer: 'Sí. Por lo general las camisetas de versión Jugador son entalladas y recomendamos pedir un talle más del habitual. Consultá nuestra Guía de Talles para comparar largo y ancho exacto.',
  },
  {
    category: 'Personalización',
    question: '¿Puedo personalizar la camiseta con mi propio nombre y número?',
    answer: '¡Sí! Podés colocar tu nombre o el de tu jugador favorito y cualquier número del 1 al 99. Usamos las tipografías oficiales stamping de cada liga.',
  },
  {
    category: 'Personalización',
    question: '¿Se pueden cambiar las camisetas personalizadas?',
    answer: 'De acuerdo a las leyes de defensa del consumidor, los productos confeccionados a medida o personalizados con nombre/dorsal único no tienen cambio ni devolución, salvo por falla de fabricación.',
  },
  {
    category: 'Pagos y Envíos',
    question: '¿Qué medios de pago puedo utilizar?',
    answer: 'Aceptamos tarjeta de crédito, débito y dinero en cuenta vía Mercado Pago, así como transferencia bancaria directa.',
  },
];
