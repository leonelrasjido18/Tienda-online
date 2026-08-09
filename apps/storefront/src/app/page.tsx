import { buttonVariants } from '@tienda/ui';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Camisetas y ropa deportiva</h1>
      <p className="max-w-md text-muted-foreground">
        Camisetas oficiales y por encargo, con personalización de nombre y dorsal.
      </p>
      <Link href="/productos" className={buttonVariants()}>
        Ver productos
      </Link>
    </main>
  );
}
