import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Detalle de Pedido',
  description: 'Confirmación y estado de tu pedido de camisetas.',
};

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
