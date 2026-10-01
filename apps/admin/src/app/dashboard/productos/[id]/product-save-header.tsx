'use client';

import { Button } from '@tienda/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ApiError } from '@/lib/api';
import { useProductSaveBus } from './product-save-bus';

/** Guarda las secciones con cambios pendientes y vuelve al listado. */
export function ProductSaveHeader({ productId }: { productId: string }) {
  const { saveAll } = useProductSaveBus();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const guardarYVolver = async () => {
    setGuardando(true);
    setError(null);
    setAviso(null);
    try {
      const { variantesOmitidas } = await saveAll();

      if (variantesOmitidas) {
        // No se navega: los precios que escribió quedaron sin guardar y tiene
        // que revisarlos sobre las variantes nuevas.
        setAviso(
          'Se guardaron las opciones y eso regeneró las variantes. Revisá los precios de la grilla y volvé a guardar.',
        );
        await queryClient.invalidateQueries({ queryKey: ['admin', 'products', productId] });
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      router.push('/dashboard/productos');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron guardar los cambios');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Button type="button" onClick={guardarYVolver} disabled={guardando} className="shrink-0">
        {guardando ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Guardando…
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            Guardar y volver
          </>
        )}
      </Button>

      {error && <p className="max-w-xs text-sm text-destructive sm:text-right">{error}</p>}
      {aviso && (
        <p className="flex max-w-xs items-start gap-1.5 text-sm text-amber-600 sm:text-right dark:text-amber-500">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          {aviso}
        </p>
      )}
    </div>
  );
}
