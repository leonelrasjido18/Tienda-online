/**
 * Costo de personalizar una camiseta.
 *
 * El nombre y el dorsal se cobran JUNTOS, una sola vez: poner los dos, solo el
 * nombre o solo el dorsal cuesta lo mismo. Antes se sumaban por separado, así
 * que quien ponía solo el dorsal pagaba la mitad que quien ponía los dos.
 *
 * Los parches sí se cobran uno por uno: son piezas físicas distintas.
 */
export interface CustomizationPriceTemplate {
  nameExtraCents: number;
  numberExtraCents: number;
  patchOptions: { patchId: string; patch: { priceCents: number } }[];
}

export interface CustomizationPriceDraft {
  playerName?: string | null;
  playerNumber?: number | null;
  patchIds?: string[] | null;
}

/**
 * El cargo por nombre/dorsal es la suma de los dos campos de la plantilla, pero
 * aplicada una vez. Se mantienen los dos campos para no migrar 2702 plantillas:
 * el panel ahora edita un único importe y lo guarda entero en `nameExtraCents`.
 */
export function personalizationBaseCents(template: CustomizationPriceTemplate): number {
  return template.nameExtraCents + template.numberExtraCents;
}

export function calculateCustomizationExtraCents(
  draft: CustomizationPriceDraft | null,
  template: CustomizationPriceTemplate | null,
): number {
  if (!draft || !template) return 0;

  // `playerNumber` puede venir como 0, que es un dorsal válido.
  const tieneNombre = !!draft.playerName;
  const tieneDorsal = draft.playerNumber !== undefined && draft.playerNumber !== null;

  let extra = tieneNombre || tieneDorsal ? personalizationBaseCents(template) : 0;

  for (const patchId of draft.patchIds ?? []) {
    const opcion = template.patchOptions.find((po) => po.patchId === patchId);
    if (opcion) extra += opcion.patch.priceCents;
  }

  return extra;
}
