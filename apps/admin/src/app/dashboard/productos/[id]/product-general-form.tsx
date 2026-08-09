'use client';

import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@tienda/ui';
import {
  FULFILLMENT_MODES,
  PRODUCT_STATUSES,
  type BrandDto,
  type CategoryDto,
  type LeagueDto,
  type ProductDetailDto,
  type SeasonDto,
  type TeamDto,
  type UpsertProductInput,
} from '@tienda/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';

const NONE = 'none';

const STATUS_LABELS: Record<(typeof PRODUCT_STATUSES)[number], string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activo',
  ARCHIVED: 'Archivado',
};

const FULFILLMENT_LABELS: Record<(typeof FULFILLMENT_MODES)[number], string> = {
  IN_STOCK: 'Solo con stock',
  PREORDER: 'Solo por encargo',
  BOTH: 'Con stock y por encargo',
};

function toFormInput(product: ProductDetailDto): UpsertProductInput {
  return {
    name: product.name,
    slug: product.slug,
    description: product.description,
    status: product.status,
    fulfillmentMode: product.fulfillmentMode,
    preorderLeadDays: product.preorderLeadDays,
    brandId: product.brandId,
    categoryId: product.categoryId,
    leagueId: product.leagueId,
    teamId: product.teamId,
    seasonId: product.seasonId,
    sizeGuideId: product.sizeGuideId,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    position: product.position,
  };
}

export function ProductGeneralForm({ productId, product }: { productId: string; product: ProductDetailDto }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<UpsertProductInput>(toFormInput(product));
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const { data: leagues } = useQuery({ queryKey: ['admin', 'leagues'], queryFn: () => api<LeagueDto[]>('/admin/leagues') });
  const { data: teams } = useQuery({
    queryKey: ['admin', 'teams', form.leagueId],
    queryFn: () => api<TeamDto[]>(`/admin/teams${form.leagueId ? `?leagueId=${form.leagueId}` : ''}`),
  });
  const { data: seasons } = useQuery({ queryKey: ['admin', 'seasons'], queryFn: () => api<SeasonDto[]>('/admin/seasons') });
  const { data: brands } = useQuery({ queryKey: ['admin', 'brands'], queryFn: () => api<BrandDto[]>('/admin/brands') });
  const { data: categories } = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => api<CategoryDto[]>('/admin/categories'),
  });

  const saveMutation = useMutation({
    mutationFn: () => api<ProductDetailDto>(`/admin/products/${productId}`, { method: 'PUT', body: JSON.stringify(form) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products', productId] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      setError(null);
      setSavedAt(Date.now());
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar'),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        saveMutation.mutate();
      }}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" required value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          rows={4}
          value={form.description ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value || null }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Estado</Label>
          <Select value={form.status} onValueChange={(status) => setForm((f) => ({ ...f, status: status as UpsertProductInput['status'] }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Disponibilidad</Label>
          <Select
            value={form.fulfillmentMode}
            onValueChange={(mode) => setForm((f) => ({ ...f, fulfillmentMode: mode as UpsertProductInput['fulfillmentMode'] }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FULFILLMENT_MODES.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {FULFILLMENT_LABELS[mode]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {form.fulfillmentMode !== 'IN_STOCK' && (
        <div className="space-y-2">
          <Label htmlFor="preorderLeadDays">Días estimados de espera (por encargo)</Label>
          <Input
            id="preorderLeadDays"
            type="number"
            min={1}
            value={form.preorderLeadDays ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, preorderLeadDays: e.target.value ? Number(e.target.value) : null }))}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <TaxonomySelect
          label="Marca"
          value={form.brandId}
          onChange={(brandId) => setForm((f) => ({ ...f, brandId }))}
          options={(brands ?? []).map((b) => ({ id: b.id, name: b.name }))}
        />
        <TaxonomySelect
          label="Categoría"
          value={form.categoryId}
          onChange={(categoryId) => setForm((f) => ({ ...f, categoryId }))}
          options={(categories ?? []).map((c) => ({ id: c.id, name: c.name }))}
        />
        <TaxonomySelect
          label="Liga"
          value={form.leagueId}
          onChange={(leagueId) => setForm((f) => ({ ...f, leagueId, teamId: null }))}
          options={(leagues ?? []).map((l) => ({ id: l.id, name: l.name }))}
        />
        <TaxonomySelect
          label="Equipo"
          value={form.teamId}
          onChange={(teamId) => setForm((f) => ({ ...f, teamId }))}
          options={(teams ?? []).map((t) => ({ id: t.id, name: t.name }))}
        />
        <TaxonomySelect
          label="Temporada"
          value={form.seasonId}
          onChange={(seasonId) => setForm((f) => ({ ...f, seasonId }))}
          options={(seasons ?? []).map((s) => ({ id: s.id, name: s.label }))}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {savedAt && !error && <p className="text-sm text-muted-foreground">Guardado.</p>}

      <Button type="submit" disabled={saveMutation.isPending}>
        {saveMutation.isPending ? 'Guardando…' : 'Guardar datos generales'}
      </Button>
    </form>
  );
}

function TaxonomySelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  options: { id: string; name: string }[];
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Sin {label.toLowerCase()}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
