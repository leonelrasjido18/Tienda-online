import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Finalizar Compra',
  description: 'Ingresá tus datos de envío y aboná mediante Mercado Pago o Transferencia Bancaria.',
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
