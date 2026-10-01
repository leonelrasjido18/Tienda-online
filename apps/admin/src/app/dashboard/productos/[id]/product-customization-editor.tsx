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
  type CustomizationAnalysisResult,
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
import { resolveImageUrl } from '@/lib/media';
import { useApi } from '@/lib/use-api';

const PREVIEW_WIDTH = 480;
const NONE = 'none';

// Proporciones de una camiseta de fútbol real: el nombre es una franja ancha bajo
// el cuello y el dorsal ocupa el centro de la espalda, bastante más grande.
// Posición estándar para las fotos de espalda lisa (maniquí centrado), ajustada a
// mano sobre una camiseta real. Es la base para todo el catálogo.
function defaultNameArea(): PrintArea {
  return { x: 0.266, y: 0.232, width: 0.467, height: 0.104, rotation: 0, align: 'center' };
}
function defaultNumberArea(): PrintArea {
  return { x: 0.308, y: 0.383, width: 0.4, height: 0.3, rotation: 0, align: 'center' };
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
  // Un único importe: nombre y dorsal se cobran juntos. En la base siguen los
  // dos campos, así que se muestra la suma y se guarda entera en el primero.
  const [personalizacionText, setPersonalizacionText] = useState(
    (((c?.nameExtraCents ?? 0) + (c?.numberExtraCents ?? 0)) / 100).toString(),
  );
  const [fontId, setFontId] = useState<string | null>(c?.font?.id ?? null);
  const [fillColor, setFillColor] = useState(c?.fillColor ?? '#FFFFFF');
  const [strokeEnabled, setStrokeEnabled] = useState((c?.strokeWidthPx ?? 0) > 0);
  const [strokeColor, setStrokeColor] = useState(c?.strokeColor ?? '#000000');
  const [strokeWidthPx, setStrokeWidthPx] = useState(c?.strokeWidthPx ?? 0);
  const [letterSpacingPx, setLetterSpacingPx] = useState(c?.letterSpacingPx ?? 0);
  const [customizationImageId, setCustomizationImageId] = useState<string | null>(
    // Por defecto la 2ª foto: es la espalda, que es donde va el estampado.
    c?.customizationImageId ?? product.images[1]?.id ?? product.images[0]?.id ?? null,
  );
  const coverImage = product.images.find((img) => img.id === customizationImageId) ?? product.images[0];
  const [patchIds, setPatchIds] = useState<string[]>(c?.patches.map((p) => p.id) ?? []);
  const [nameArea, setNameArea] = useState<PrintArea>(c?.namePrintArea ?? defaultNameArea());
  const [numberArea, setNumberArea] = useState<PrintArea>(c?.numberPrintArea ?? defaultNumberArea());
  const [patchArea, setPatchArea] = useState<PrintArea>(c?.patchPrintArea ?? defaultPatchArea());
  const [error, setError] = useState<string | null>(null);
  const [analysisNote, setAnalysisNote] = useState<string | null>(null);
  const [previewHeight, setPreviewHeight] = useState(Math.round(PREVIEW_WIDTH * 1.2));

  const saveMutation = useMutation({
    mutationFn: () => {
      let nameExtraCents: number;
      let numberExtraCents: number;
      try {
        nameExtraCents = parseArsToCents(personalizacionText);
        numberExtraCents = 0;
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
        fillColor,
        strokeColor: strokeEnabled ? strokeColor : null,
        strokeWidthPx: strokeEnabled ? strokeWidthPx : 0,
        letterSpacingPx,
        customizationImageId,
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

  // Analiza la foto elegida con IA y pre-rellena color, contorno, interletrado y las
  // cajas de nombre/dorsal. El operador siempre puede ajustar antes de guardar.
  const analyzeMutation = useMutation({
    mutationFn: () => {
      if (!customizationImageId) throw new Error('Elegí una foto para analizar.');
      return api<CustomizationAnalysisResult>(`/admin/products/${productId}/customization/analyze`, {
        method: 'POST',
        body: JSON.stringify({ imageId: customizationImageId }),
      });
    },
    onSuccess: (res) => {
      setFillColor(res.fillColor);
      if (res.strokeColor && res.strokeWidthPx > 0) {
        setStrokeEnabled(true);
        setStrokeColor(res.strokeColor);
        setStrokeWidthPx(res.strokeWidthPx);
      } else {
        setStrokeEnabled(false);
      }
      setLetterSpacingPx(res.letterSpacingPx);
      // Las posiciones NO se tocan: se usan las medidas estándar, que son más
      // confiables que la estimación de la IA sobre una espalda lisa.
      if (res.suggestedFontId) setFontId(res.suggestedFontId);
      setAnalysisNote(res.notes);
      setError(null);
    },
    onError: (err) => {
      setAnalysisNote(null);
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'No se pudo analizar la imagen.');
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
        <div>
          {product.images.length > 1 && (
            <div className="mb-3">
              <Label>Foto donde va la personalización</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Elegí la foto de la espalda con el nombre/dorsal de ejemplo: es la que analiza la IA.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {product.images.map((image) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setCustomizationImageId(image.id)}
                    className={`h-16 w-16 overflow-hidden rounded border-2 ${
                      image.id === customizationImageId ? 'border-primary' : 'border-transparent'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resolveImageUrl(image.url)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mb-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => analyzeMutation.mutate()}
                disabled={analyzeMutation.isPending || !customizationImageId}
              >
                {analyzeMutation.isPending ? 'Analizando…' : '✨ Analizar con IA'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setNameArea(defaultNameArea());
                  setNumberArea(defaultNumberArea());
                }}
              >
                Usar medidas estándar
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              La IA completa <strong>color, contorno y tipografía</strong> desde la foto elegida. Las posiciones no las
              toca: se usan las medidas estándar. “Usar medidas estándar” vuelve a colocar el nombre y el dorsal en la
              posición de referencia, sin costo.
            </p>
            {analysisNote && <p className="mt-1 text-xs text-emerald-600">IA: {analysisNote}</p>}
          </div>
          <div
            className="relative overflow-hidden rounded-lg border border-border bg-muted"
            style={{ width: PREVIEW_WIDTH, height: previewHeight }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolveImageUrl(coverImage.url)}
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
            {!fontId && (
              <p className="text-xs text-amber-600">
                Sin tipografía asignada el personalizador no se muestra en la tienda: elegí una para
                que los clientes puedan poner nombre y dorsal.
              </p>
            )}
          </div>

          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <Label>Estilo del estampado</Label>
              <span className="text-xs text-muted-foreground">Color del nombre y el dorsal</span>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="color"
                value={fillColor}
                onChange={(e) => setFillColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent"
                aria-label="Color de relleno"
              />
              <div className="space-y-1">
                <Label htmlFor="fillColorHex" className="text-xs">Color de relleno</Label>
                <Input
                  id="fillColorHex"
                  value={fillColor}
                  onChange={(e) => setFillColor(e.target.value)}
                  className="w-28 font-mono text-xs uppercase"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={strokeEnabled} onChange={(e) => setStrokeEnabled(e.target.checked)} />
              Con contorno
            </label>

            {strokeEnabled && (
              <div className="flex items-end gap-3">
                <input
                  type="color"
                  value={strokeColor}
                  onChange={(e) => setStrokeColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent"
                  aria-label="Color del contorno"
                />
                <div className="space-y-1">
                  <Label htmlFor="strokeColorHex" className="text-xs">Color del contorno</Label>
                  <Input
                    id="strokeColorHex"
                    value={strokeColor}
                    onChange={(e) => setStrokeColor(e.target.value)}
                    className="w-28 font-mono text-xs uppercase"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="strokeWidth" className="text-xs">Grosor (px)</Label>
                  <Input
                    id="strokeWidth"
                    type="number"
                    min={0}
                    max={20}
                    value={strokeWidthPx}
                    onChange={(e) => setStrokeWidthPx(Number(e.target.value))}
                    className="w-20"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="letterSpacing" className="text-xs">Interletrado (px)</Label>
              <Input
                id="letterSpacing"
                type="number"
                min={-10}
                max={50}
                value={letterSpacingPx}
                onChange={(e) => setLetterSpacingPx(Number(e.target.value))}
                className="w-20"
              />
            </div>
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
            <div className="col-span-2 space-y-2">
              <Label htmlFor="personalizacionExtra">Costo de personalización (ARS)</Label>
              <Input
                id="personalizacionExtra"
                inputMode="decimal"
                value={personalizacionText}
                onChange={(e) => setPersonalizacionText(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Se cobra una sola vez: cuesta lo mismo poner el nombre, el dorsal o los dos. Los parches se
                cobran aparte.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="minNumber">Dorsal mínimo</Label>
              <Input id="minNumber" type="number" min={0} value={minNumber} onChange={(e) => setMinNumber(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxNumber">Dorsal máximo</Label>
              <Input id="maxNumber" type="number" min={0} value={maxNumber} onChange={(e) => setMaxNumber(Number(e.target.value))} />
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
