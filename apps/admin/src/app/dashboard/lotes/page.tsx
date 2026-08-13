'use client';

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tienda/ui';
import {
  formatCentsAsArs,
  IMPORT_BATCH_STATUS_LABELS,
  type CreateImportBatchInput,
  type ImportBatchSummaryDto,
} from '@tienda/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';

export default function BatchesPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [supplier, setSupplier] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: batches, isLoading } = useQuery({
    queryKey: ['admin', 'batches'],
    queryFn: () => api<ImportBatchSummaryDto[]>('/admin/batches'),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const body: CreateImportBatchInput = { code: code.trim(), supplier: supplier.trim() || null };
      return api<ImportBatchSummaryDto>('/admin/batches', { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: () => {
      setOpen(false);
      setCode('');
      setSupplier('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'batches'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo crear el lote'),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Lotes de importación</h1>
          <p className="text-sm text-muted-foreground">
            Agrupá los pedidos por encargo que viajan juntos. Al marcar el lote como recibido se les cobra el
            saldo automáticamente.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>Nuevo lote</Button>
      </div>

      <div className="rounded-lg border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Pedidos</TableHead>
              <TableHead>Saldo pendiente</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead className="w-16 text-right">Editar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {batches?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Todavía no hay lotes. Creá uno cuando tengas pedidos por encargo para agrupar.
                </TableCell>
              </TableRow>
            )}
            {batches?.map((batch) => (
              <TableRow key={batch.id}>
                <TableCell>
                  <Link href={`/dashboard/lotes/${batch.id}`} className="font-medium hover:underline">
                    {batch.code}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{batch.supplier ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={batch.status === 'RECEIVED' || batch.status === 'CLOSED' ? 'default' : 'secondary'}>
                    {IMPORT_BATCH_STATUS_LABELS[batch.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{batch.orderCount}</TableCell>
                <TableCell className="text-muted-foreground">{formatCentsAsArs(batch.pendingBalanceCents)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(batch.createdAt).toLocaleDateString('es-AR')}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/dashboard/lotes/${batch.id}`}
                    title="Editar lote"
                    aria-label="Editar lote"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo lote</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="code">Código</Label>
              <Input
                id="code"
                required
                placeholder="LOTE-2026-03"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier">Proveedor (opcional)</Label>
              <Input id="supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creando…' : 'Crear lote'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
