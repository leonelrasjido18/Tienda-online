'use client';

import { Badge, Button, Card, CardContent } from '@tienda/ui';
import type { AdminReviewDto } from '@tienda/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Star } from 'lucide-react';

import { useApi } from '@/lib/use-api';

type Filter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'APPROVED', label: 'Aprobadas' },
  { value: 'REJECTED', label: 'Rechazadas' },
  { value: 'ALL', label: 'Todas' },
];

const STATUS_LABEL: Record<string, string> = { PENDING: 'Pendiente', APPROVED: 'Aprobada', REJECTED: 'Rechazada' };

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} width={14} height={14} className={i <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'} />
      ))}
    </span>
  );
}

export default function ReviewsModerationPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('PENDING');

  const { data: reviews, isLoading } = useQuery({
    queryKey: ['admin', 'reviews', filter],
    queryFn: () => api<AdminReviewDto[]>(`/admin/reviews${filter === 'ALL' ? '' : `?status=${filter}`}`),
  });

  const moderate = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      api(`/admin/reviews/${id}/${action}`, { method: 'POST' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] }),
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Reseñas</h1>
        <p className="text-sm text-muted-foreground">Moderá las opiniones de compradores antes de publicarlas.</p>
      </div>

      <div className="mb-4 flex gap-2">
        {FILTERS.map((f) => (
          <Button key={f.value} variant={filter === f.value ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f.value)}>
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {reviews?.length === 0 && <p className="text-sm text-muted-foreground">No hay reseñas en este estado.</p>}

      <div className="space-y-3">
        {reviews?.map((r) => (
          <Card key={r.id} className="border border-border">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Stars value={r.rating} />
                  <Badge variant={r.status === 'APPROVED' ? 'default' : r.status === 'REJECTED' ? 'destructive' : 'secondary'}>
                    {STATUS_LABEL[r.status]}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString('es-AR')}</span>
              </div>

              {r.title && <p className="mt-2 font-semibold">{r.title}</p>}
              <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {r.authorName} ({r.authorEmail}) · sobre <span className="font-medium text-foreground">{r.productName}</span>
              </p>

              <div className="mt-3 flex gap-2">
                {r.status !== 'APPROVED' && (
                  <Button size="sm" onClick={() => moderate.mutate({ id: r.id, action: 'approve' })} disabled={moderate.isPending}>
                    Aprobar
                  </Button>
                )}
                {r.status !== 'REJECTED' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => moderate.mutate({ id: r.id, action: 'reject' })}
                    disabled={moderate.isPending}
                  >
                    Rechazar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
