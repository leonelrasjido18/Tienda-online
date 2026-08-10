import Link from 'next/link';
import { buttonVariants } from '@tienda/ui';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center justify-center px-4 py-20 text-center">
      <span className="text-6xl font-extrabold text-muted-foreground/30">404</span>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">Página no encontrada</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        La página que estás buscando no existe o fue movida.
      </p>
      <Link href="/" className={buttonVariants({ className: 'mt-6' })}>
        Volver al inicio
      </Link>
    </div>
  );
}
