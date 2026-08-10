import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tu Carrito de Compras',
  description: 'Revisá las camisetas elegidas, personalización y calculá tu seña.',
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
