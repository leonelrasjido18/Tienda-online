'use client';

import {
  buildCustomizationInputSchema,
  calculateCustomizationExtraCents,
  computeFontSizeForBox,
  formatCentsAsArs,
  personalizationBaseCents,
  resolvePrintArea,
  type ProductCustomizationDto,
} from '@tienda/shared';
import { Input, Label } from '@tienda/ui';
import { useEffect, useMemo, useState } from 'react';

import { resolveImageUrl } from '@/lib/media';

const CANVAS_WIDTH = 1200;

export interface CustomizationValue {
  playerName?: string;
  playerNumber?: number;
  patchIds: string[];
  extraCents: number;
  valid: boolean;
}

export function CustomizationBlock({
  customization,
  imageUrl,
  onChange,
}: {
  customization: ProductCustomizationDto;
  imageUrl: string;
  onChange: (value: CustomizationValue) => void;
}) {
  const [playerName, setPlayerName] = useState('');
  const [playerNumber, setPlayerNumber] = useState('');
  const [patchIds, setPatchIds] = useState<string[]>([]);

  // Precio único de personalizar: nombre, dorsal o los dos cuestan lo mismo.
  const precioPersonalizacion = personalizationBaseCents({
    nameExtraCents: customization.nameExtraCents,
    numberExtraCents: customization.numberExtraCents,
    patchOptions: [],
  });
  const [canvasHeight, setCanvasHeight] = useState(Math.round(CANVAS_WIDTH * 1.2));

  const schema = useMemo(
    () =>
      buildCustomizationInputSchema({
        maxNameLength: customization.maxNameLength,
        minNumber: customization.minNumber,
        maxNumber: customization.maxNumber,
      }),
    [customization.maxNameLength, customization.minNumber, customization.maxNumber],
  );

  const parsed = schema.safeParse({
    playerName: playerName || undefined,
    playerNumber: playerNumber || undefined,
    fontId: customization.font?.id ?? null,
    patchIds,
  });

  useEffect(() => {
    // El mismo calculo que usa el servidor al cobrar: nombre y dorsal van
    // juntos, una sola vez. Antes esto estaba escrito aparte y podia mostrar un
    // precio distinto al que terminaba cobrando el checkout.
    const extraCents = calculateCustomizationExtraCents(
      {
        playerName: customization.enableName ? playerName : undefined,
        playerNumber: customization.enableNumber && playerNumber ? Number(playerNumber) : undefined,
        patchIds,
      },
      {
        nameExtraCents: customization.nameExtraCents,
        numberExtraCents: customization.numberExtraCents,
        patchOptions: customization.patches.map((p) => ({ patchId: p.id, patch: { priceCents: p.priceCents } })),
      },
    );

    onChange({
      playerName: parsed.success ? parsed.data.playerName : undefined,
      playerNumber: parsed.success ? parsed.data.playerNumber : undefined,
      patchIds,
      extraCents,
      valid: parsed.success,
    });
    // onChange se recrea en cada render del padre; sólo interesa reaccionar a los
    // cambios reales de la personalización, no a la identidad de la función.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerName, playerNumber, patchIds, parsed.success]);

  function togglePatch(patchId: string) {
    setPatchIds((ids) => (ids.includes(patchId) ? ids.filter((id) => id !== patchId) : [...ids, patchId]));
  }

  const nameBox = resolvePrintArea(customization.namePrintArea, CANVAS_WIDTH, canvasHeight);
  const numberBox = resolvePrintArea(customization.numberPrintArea, CANVAS_WIDTH, canvasHeight);
  const nameFontSize = playerName ? computeFontSizeForBox(playerName.toUpperCase(), nameBox) : 0;
  const numberFontSize = playerNumber ? computeFontSizeForBox(playerNumber, numberBox) : 0;
  const fontFamily = customization.font?.name ?? 'sans-serif';

  return (
    <div className="mt-8 space-y-4 border-t border-border pt-6">
      {customization.font && (
        <style>{`@font-face { font-family: '${fontFamily}'; src: url('${resolveImageUrl(customization.font.fontFileUrl)}'); }`}</style>
      )}

      <h2 className="text-sm font-semibold">Personalizá tu camiseta</h2>

      <div className="relative aspect-[1200/1467] w-full max-w-xs overflow-hidden rounded-lg bg-muted" style={{ aspectRatio: `${CANVAS_WIDTH} / ${canvasHeight}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth > 0) {
              setCanvasHeight(Math.round((img.naturalHeight / img.naturalWidth) * CANVAS_WIDTH));
            }
          }}
        />
        <svg viewBox={`0 0 ${CANVAS_WIDTH} ${canvasHeight}`} className="absolute inset-0 h-full w-full">
          {customization.enableName && playerName && (
            <text
              x={nameBox.left + nameBox.width / 2}
              y={nameBox.top + nameBox.height / 2}
              fontSize={nameFontSize}
              fontFamily={fontFamily}
              fill={customization.fillColor}
              stroke={customization.strokeColor ?? 'none'}
              strokeWidth={customization.strokeWidthPx}
              letterSpacing={customization.letterSpacingPx}
              paintOrder="stroke"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {playerName.toUpperCase()}
            </text>
          )}
          {customization.enableNumber && playerNumber && (
            <text
              x={numberBox.left + numberBox.width / 2}
              y={numberBox.top + numberBox.height / 2}
              fontSize={numberFontSize}
              fontFamily={fontFamily}
              fill={customization.fillColor}
              stroke={customization.strokeColor ?? 'none'}
              strokeWidth={customization.strokeWidthPx}
              letterSpacing={customization.letterSpacingPx}
              paintOrder="stroke"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {playerNumber}
            </text>
          )}
        </svg>
      </div>

      {(customization.enableName || customization.enableNumber) && precioPersonalizacion > 0 && (
        <p className="rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
          Nombre y dorsal: <span className="font-semibold text-foreground">+{formatCentsAsArs(precioPersonalizacion)}</span>{' '}
          — el precio es el mismo si ponés uno solo o los dos.
        </p>
      )}

      {customization.enableName && (
        <div className="space-y-1">
          <Label htmlFor="playerName">Nombre</Label>
          <Input
            id="playerName"
            maxLength={customization.maxNameLength}
            placeholder="MESSI"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />
        </div>
      )}

      {customization.enableNumber && (
        <div className="space-y-1">
          <Label htmlFor="playerNumber">
            Dorsal ({customization.minNumber}-{customization.maxNumber})
          </Label>
          <Input
            id="playerNumber"
            type="number"
            min={customization.minNumber}
            max={customization.maxNumber}
            placeholder="10"
            value={playerNumber}
            onChange={(e) => setPlayerNumber(e.target.value)}
          />
        </div>
      )}

      {customization.enablePatches && customization.patches.length > 0 && (
        <div className="space-y-1">
          <Label>Parches</Label>
          {customization.patches.map((patch) => (
            <label key={patch.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2">
                <input type="checkbox" checked={patchIds.includes(patch.id)} onChange={() => togglePatch(patch.id)} />
                {patch.name}
              </span>
              <span className="text-muted-foreground">+{formatCentsAsArs(patch.priceCents)}</span>
            </label>
          ))}
        </div>
      )}

      {!parsed.success && (playerName || playerNumber) && (
        <p className="text-sm text-destructive">Revisá el nombre y el dorsal cargados.</p>
      )}
    </div>
  );
}
