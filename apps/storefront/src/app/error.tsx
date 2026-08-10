'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@tienda/ui';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center justify-center px-4 py-20 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Ocurrió un error inesperado</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        No pudimos cargar esta sección. Por favor, intentá de nuevo.
      </p>
      <div className="mt-6 flex gap-3">
        <Button onClick={() => reset()} variant="default">
          Reintentar
        </Button>

        <Button onClick={() => router.push('/')} variant="outline">
          Ir al inicio
        </Button>
      </div>
    </div>
  );
}
