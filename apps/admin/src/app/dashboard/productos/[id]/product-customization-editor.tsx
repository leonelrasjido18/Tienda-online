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
} from '@tienda/ui';
import {
  formatCentsAsArs,
  parseArsToCents,
  type LeagueDto,
  type LeagueFontDto,
  type PatchDto,
  type PrintArea,
  type ProductDetailDto,
  type UpsertCustomizationTemplateInput,
} from '@tienda/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Rnd } from 'react-rnd';

import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';

const PREVIEW_WIDTH = 480;
const NONE = 'none';

function defaultNameArea(): PrintArea {
  return { x: 0.3, y: 0.2, width: 0.4, height: 0.08, rotation: 0, align: 'center' };
}
function defaultNumberArea(): PrintArea {
  return { x: 0.35, y: 0.3, width: 0.3, height: 0.16, rotation: 0, align: 'center' };
}
function defaultPatchArea(): PrintArea {
  return { x: 0.08, y: 0.08, width: 0.16, height: 0.16, rotation: 0, align: 'center' };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function ProductCustomizationEditor({
  productId,
  product,
}: {
  productId: string;
  product: ProductDetailDto;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const coverImage = product.images[0];
  const c = product.customization;

  const { data: fonts } = useQuery({ queryKey: ['admin', 'fonts'], queryFn: () => api<LeagueFontDto[]>('/admin/fonts') });
  const { data: leagues } = useQuery({ queryKey: ['admin', 'leagues'], queryFn: () => api<LeagueDto[]>('/admin/leagues') });
  const { data: allPatches } = useQuery({ queryKey: ['admin', 'patches'], queryFn: () => api<PatchDto[]>('/admin/patches') });
  const leagueById = new Map((leagues ?? []).map((l) => [l.id, l]));

  const [enableName, setEnableName] = useState(c?.enableName ?? true);
  const [enableNumber, setEnableNumber] = useState(c?.enableNumber ?? true);
  const [enablePatches, setEnablePatches] = useState(c?.enablePatches ?? false);
  const [maxNameLength, setMaxNameLength] = useState(c?.maxNameLength ?? 12);
  const [minNumber, setMinNumber] = useState(c?.minNumber ?? 1);
  const [maxNumber, setMaxNumber] = useState(c?.maxNumber ?? 99);
  const [nameExtraText, setNameExtraText] = useState(((c?.nameExtraCents ?? 0) / 100).toString());
  const [numberExtraText, setNumberExtraText] = useState(((c?.numberExtraCents ?? 0) / 100).toString());
  const [fontId, setFontId] = useState<string | null>(c?.font?.id ?? null);
  const [patchIds, setPatchIds] = useState<string[]>(c?.patches.map((p) => p.id) ?? []);
  const [nameArea, setNameArea] = useState<PrintArea>(c?.namePrintArea ?? defaultNameArea());
  const [numberArea, setNumberArea] = useState<PrintArea>(c?.numberPrintArea ?? defaultNumberArea());
  const [patchArea, setPatchArea] = useState<PrintArea>(c?.patchPrintArea ?? defaultPatchArea());
  const [error, setError] = useState<string | null>(null);
  const [previewHeight, setPreviewHeight] = useState(Math.round(PREVIEW_WIDTH * 1.2));

  const saveMutation = useMutation({
    mutationFn: () => {
      let nameExtraCents: number;
      let numberExtraCents: number;
      try {
        nameExtraCents = parseArsToCents(nameExtraText);
        numberExtraCents = parseArsToCents(numberExtraText);
      } catch {
        throw new Error('invalid-price');
      }
      const body: UpsertCustomizationTemplateInput = {
        enableName,
        enableNumber,
        enablePatches,
        maxNameLength,
        minNumber,
        maxNumber,
        nameExtraCents,
        numberExtraCents,
        fontId,
        namePrintArea: nameArea,
        numberPrintArea: numberArea,
        patchPrintArea: enablePatches ? patchArea : null,
        patchIds: enablePatches ? patchIds : [],
      };
      return api(`/admin/products/${productId}/customization`, { method: 'PUT', body: JSON.stringify(body) });
    },
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products', productId] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Revisá los precios extra: tienen que ser números.');
    },
  });

  function pxFromArea(area: PrintArea) {
    return {
      x: area.x * PREVIEW_WIDTH,
      y: area.y * previewHeight,
      width: area.width * PREVIEW_WIDTH,
      height: area.height * previewHeight,
    };
  }

  function areaFromPx(px: { x: number; y: number; width: number; height: number }, rotation: number): PrintArea {
    return {
      x: clamp01(px.x / PREVIEW_WIDTH),
      y: clamp01(px.y / previewHeight),
      width: clamp01(px.width / PREVIEW_WIDTH),
      height: clamp01(px.height / previewHeight),
      rotation,
      align: 'center',
    };
  }

  function togglePatch(patchId: string) {
    setPatchIds((ids) => (ids.includes(patchId) ? ids.filter((id) => id !== patchId) : [...ids, patchId]));
  }

  if (!coverImage) {
    return (
      <p className="text-sm text-muted-foreground">
        Subí al menos una foto en la sección de Fotos antes de configurar la personalización.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[480px_1fr]">
        <div
          className="relative overflow-hidden rounded-lg border border-border bg-muted"
          style={{ width: PREVIEW_WIDTH, height: previewHeight }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverImage.url}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth > 0) {
                setPreviewHeight(Math.round((img.naturalHeight / img.naturalWidth) * PREVIEW_WIDTH));
              }
            }}
          />

          {enableName && (
            <PrintAreaBox
              label="Nombre"
              colorClass="border-blue-500 bg-blue-500/20 text-blue-950"
              box={pxFromArea(nameArea)}
              onChange={(px) => setNameArea((a) => areaFromPx(px, a.rotation))}
            />
          )}
          {enableNumber && (
            <PrintAreaBox
              label="Dorsal"
              colorClass="border-emerald-500 bg-emerald-500/20 text-emerald-950"
              box={pxFromArea(numberArea)}
              onChange={(px) => setNumberArea((a) => areaFromPx(px, a.rotation))}
            />
          )}
          {enablePatches && (
            <PrintAreaBox
              label="Parches"
              colorClass="border-amber-500 bg-amber-500/20 text-amber-950"
              box={pxFromArea(patchArea)}
              onChange={(px) => setPatchArea((a) => areaFromPx(px, a.rotation))}
            />
          )}
        </div>

        <div className="space-y-5">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={enableName} onChange={(e) => setEnableName(e.target.checked)} />
              Permitir nombre
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={enableNumber} onChange={(e) => setEnableNumber(e.target.checked)} />
              Permitir dorsal
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={enablePatches} onChange={(e) => setEnablePatches(e.target.checked)} />
              Permitir parches
            </label>
          </div>

          <div className="space-y-2">
            <Label>Tipografía</Label>
            <Select value={fontId ?? NONE} onValueChange={(v) => setFontId(v === NONE ? null : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Elegí una tipografía" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin tipografía</SelectItem>
                {fonts?.map((font) => (
                  <SelectItem key={font.id} value={font.id}>
                    {font.name} ({leagueById.get(font.leagueId)?.name ?? '—'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxNameLength">Largo máx. del nombre</Label>
              <Input
                id="maxNameLength"
                type="number"
                min={1}
                value={maxNameLength}
                onChange={(e) => setMaxNameLength(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nameExtra">Costo extra nombre (ARS)</Label>
              <Input id="nameExtra" inputMode="decimal" value={nameExtraText} onChange={(e) => setNameExtraText(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minNumber">Dorsal mínimo</Label>
              <Input id="minNumber" type="number" min={0} value={minNumber} onChange={(e) => setMinNumber(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxNumber">Dorsal máximo</Label>
              <Input id="maxNumber" type="number" min={0} value={maxNumber} onChange={(e) => setMaxNumber(Number(e.target.value))} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="numberExtra">Costo extra dorsal (ARS)</Label>
              <Input
                id="numberExtra"
                inputMode="decimal"
                value={numberExtraText}
                onChange={(e) => setNumberExtraText(e.target.value)}
              />
            </div>
          </div>

          {enablePatches && (
            <div className="space-y-2">
              <Label>Parches disponibles para este producto</Label>
              <div className="space-y-1">
                {allPatches?.map((patch) => (
                  <label key={patch.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2">
                      <input type="checkbox" checked={patchIds.includes(patch.id)} onChange={() => togglePatch(patch.id)} />
                      {patch.name}
                    </span>
                    <span className="text-muted-foreground">{formatCentsAsArs(patch.priceCents)}</span>
                  </label>
                ))}
                {allPatches?.length === 0 && <p className="text-xs text-muted-foreground">No hay parches cargados todavía.</p>}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Guardando…' : 'Guardar personalización'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PrintAreaBox({
  label,
  colorClass,
  box,
  onChange,
}: {
  label: string;
  colorClass: string;
  box: { x: number; y: number; width: number; height: number };
  onChange: (box: { x: number; y: number; width: number; height: number }) => void;
}) {
  return (
    <Rnd
      bounds="parent"
      size={{ width: box.width, height: box.height }}
      position={{ x: box.x, y: box.y }}
      onDragStop={(_e, d) => onChange({ x: d.x, y: d.y, width: box.width, height: box.height })}
      onResizeStop={(_e, _direction, ref, _delta, position) =>
        onChange({ x: position.x, y: position.y, width: ref.offsetWidth, height: ref.offsetHeight })
      }
      className={`flex items-center justify-center border-2 border-dashed text-xs font-semibold ${colorClass}`}
    >
      {label}
    </Rnd>
  );
}
