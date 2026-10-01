'use client';

import {
  bestPaymentDiscount,
  resolveFulfillment,
  formatCentsAsArs,
  PAYMENT_METHOD_LABELS,
  type ProductDetailDto,
  type StoreSettingsDto,
} from '@tienda/shared';
import { buttonVariants, Sheet, SheetContent, SheetHeader, SheetTitle } from '@tienda/ui';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Ruler, ShieldCheck, RefreshCw } from 'lucide-react';
import Image from 'next/image';

import { useCart } from '@/lib/cart-context';
import { AccionesProducto } from './acciones-producto';
import { resolveImageUrl } from '@/lib/media';
import { CustomizationBlock, type CustomizationValue } from './customization-block';
import { SIZE_GUIDES } from '@/content/size-guides';

type VariantDto = ProductDetailDto['variants'][number];

function combinationKey(ids: string[]): string {
  return [...ids].sort().join('|');
}

/** Sin acentos y en minúscula: los nombres de opción los escribe el vendedor a mano. */
function normalizeName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** "talle", "talle y manga", "talle, manga y color"… para los textos de ayuda. */
function optionsPrompt(options: ProductDetailDto['options']): string {
  const names = options.map((o) => o.name.toLowerCase());
  if (names.length === 0) return 'las opciones';
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]!}`;
}

export function VariantSelector({
  product,
  settings,
}: {
  product: ProductDetailDto;
  settings: StoreSettingsDto;
}) {
  const router = useRouter();
  const { addItem } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  const firstVariant = product.variants[0];
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    if (!firstVariant) return {};
    const map: Record<string, string> = {};
    for (const option of product.options) {
      const value = option.values.find((v) => firstVariant.optionValueIds.includes(v.id));
      if (value) map[option.id] = value.id;
    }
    return map;
  });

  const [customizationValue, setCustomizationValue] = useState<CustomizationValue>({
    patchIds: [],
    extraCents: 0,
    valid: true,
  });

  const variantByKey = useMemo(() => {
    const map = new Map<string, VariantDto>();
    for (const variant of product.variants) {
      map.set(combinationKey(variant.optionValueIds), variant);
    }
    return map;
  }, [product.variants]);

  const selectedIds = Object.values(selected);
  const hasFullSelection = selectedIds.length === product.options.length;
  const activeVariant = hasFullSelection ? variantByKey.get(combinationKey(selectedIds)) : undefined;

  const images = product.images;
  const [activeImageId, setActiveImageId] = useState<string | null>(null);

  const selectedImage =
    images.find((img) => img.id === activeImageId) ??
    images.find((img) => img.optionValueId && selectedIds.includes(img.optionValueId)) ??
    images[0];

  const customizationImage =
    images.find((img) => img.id === product.customization?.customizationImageId) ?? images[0];

  // Mangas largas. Hay dos formas de tenerlas y son muy distintas para el cliente:
  //
  //   1. Como OPCIÓN de compra ("Manga: Corta / Larga"). Genera una variante por
  //      cada talle, así que cada combinación lleva su propio stock y su propio
  //      precio: se puede tener manga larga con entrega inmediata y la corta por
  //      encargo, o al revés. No necesita nada especial acá, porque la opción se
  //      dibuja sola con el resto y la foto la cambia el vínculo imagen→opción.
  //
  //   2. Solo como FOTO marcada `isLongSleeve`, sin variante detrás. No se puede
  //      comprar por separado, así que lo único honesto es un toggle que cambia
  //      la foto que se está mirando y nada más.
  //
  // Si el producto tiene la opción, el toggle sobra y confunde: daría a entender
  // que se elige algo cuando el que decide la compra es el selector de opciones.
  const sleeveOption = product.options.find((o) => normalizeName(o.name).includes('manga'));
  const longSleeveImage = images.find((img) => img.isLongSleeve);
  const shortSleeveImage = images.find((img) => !img.isLongSleeve) ?? images[0];
  // Se le pregunta a la foto que se esta mirando, no si es "la primera de manga
  // larga": cuando hay frente y espalda las dos van marcadas, y comparar contra
  // la primera dejaba el boton en "Manga corta" al pasar a la segunda.
  const isLongSleeveActive = !!selectedImage?.isLongSleeve;
  const showSleeveToggle = !sleeveOption && !!longSleeveImage;

  // Valores de opción que mandan sobre la foto principal (manga, color…). Sirve
  // para saber cuándo hay que soltar la miniatura elegida a mano: si no, el
  // cliente toca una miniatura y a partir de ahí cambiar de manga no hace nada.
  /**
   * Valores que no se pueden comprar con lo que hay elegido ahora.
   *
   * Se mira contra la selección de las DEMÁS opciones: si elegiste manga larga,
   * el talle M puede estar agotado en larga y disponible en corta, y tacharlo
   * siempre sería mentira. Un producto por encargo no tacha nada, porque sus
   * variantes admiten preventa.
   */
  const valoresSinStock = useMemo(() => {
    const fuera = new Set<string>();
    for (const option of product.options) {
      for (const value of option.values) {
        const candidatas = product.variants.filter((variant) => {
          if (!variant.optionValueIds.includes(value.id)) return false;
          return product.options.every(
            (otra) =>
              otra.id === option.id ||
              !selected[otra.id] ||
              variant.optionValueIds.includes(selected[otra.id] as string),
          );
        });
        const comprable = candidatas.some(
          (variant) => variant.inventory.available > 0 || variant.inventory.allowPreorder,
        );
        if (!comprable) fuera.add(value.id);
      }
    }
    return fuera;
  }, [product, selected]);

  const optionValueIdsWithImage = useMemo(
    () => new Set(images.map((img) => img.optionValueId).filter((id): id is string => !!id)),
    [images],
  );

  // ---------------------------------------------------------------------------
  // Talles: elección por modalidad y cantidad por talle.
  //
  // El talle es la única opción que se compra de a varios a la vez (dos M y un
  // L). Las demás (manga, color) siguen siendo de a una: son el producto, no la
  // cantidad.
  // ---------------------------------------------------------------------------
  const sizeOption = product.options.find((o) => normalizeName(o.name).includes('talle'));
  const otrasOpciones = useMemo(
    () => product.options.filter((o) => o.id !== sizeOption?.id),
    [product.options, sizeOption],
  );

  const [modalidadElegida, setModalidadElegida] = useState<'stock' | 'encargo' | null>(null);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});

  /**
   * Qué se puede hacer con cada talle, ya combinado con las otras opciones
   * elegidas (manga larga M puede estar agotada y la corta no).
   *
   * Un talle CON stock no se ofrece por encargo a propósito. Si se ofreciera, el
   * cliente elegiría "por encargo", pagaría una seña y esperaría veinte días por
   * algo que está en el depósito — y además el servidor lo resolvería como
   * entrega inmediata, así que terminaría pagando un total distinto del que vio.
   */
  const talles = useMemo(() => {
    if (!sizeOption) return [];
    return sizeOption.values.map((value) => {
      const ids = [
        ...otrasOpciones.map((o) => selected[o.id]).filter((id): id is string => !!id),
        value.id,
      ];
      const variant =
        ids.length === product.options.length ? variantByKey.get(combinationKey(ids)) : undefined;
      const available = variant?.inventory.available ?? 0;
      const allowPreorder = variant?.inventory.allowPreorder ?? false;
      return {
        value,
        variant,
        available,
        enStock: product.fulfillmentMode !== 'PREORDER' && available > 0,
        porEncargo: product.fulfillmentMode !== 'IN_STOCK' && allowPreorder && available === 0,
      };
    });
  }, [sizeOption, otrasOpciones, selected, variantByKey, product.options.length, product.fulfillmentMode]);

  const ofreceStock = talles.some((t) => t.enStock);
  const ofreceEncargo = talles.some((t) => t.porEncargo);
  // Con una sola modalidad posible no hay nada que elegir: el selector sobra.
  const hayQueElegirModalidad = ofreceStock && ofreceEncargo;
  const modalidad = modalidadElegida ?? (ofreceStock ? 'stock' : 'encargo');

  const disponibleEnModalidad = (t: (typeof talles)[number]) =>
    modalidad === 'stock' ? t.enStock : t.porEncargo;

  function cambiarModalidad(nueva: 'stock' | 'encargo') {
    setModalidadElegida(nueva);
    // Las cantidades son de los talles de la otra modalidad: arrastrarlas haría
    // que el botón diga "Agregar 3" sin que se vea ninguno elegido.
    setCantidades({});
    setAddError(null);
  }

  /**
   * Cuántas unidades hay pedidas de un talle, nunca más de las que se pueden
   * llevar. El tope se recalcula al cambiar de manga o de modalidad: si alguien
   * pide tres M de manga corta y después pasa a larga, donde queda una, lo
   * elegido se recorta solo en vez de que el servidor rechace el pedido al final.
   */
  const topeDe = (t: (typeof talles)[number]) => (modalidad === 'stock' ? t.available : 99);
  const cantidadDe = (t: (typeof talles)[number]) =>
    Math.min(cantidades[t.value.id] ?? 0, topeDe(t));

  const lineas = useMemo(
    () =>
      talles
        .filter((t) => disponibleEnModalidad(t) && t.variant && cantidadDe(t) > 0)
        .map((t) => ({ talle: t, cantidad: cantidadDe(t) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [talles, cantidades, modalidad],
  );

  const unidadesElegidas = lineas.reduce((n, l) => n + l.cantidad, 0);

  /**
   * La variante de la que se muestra el precio. Con talles, es la del primer
   * talle elegido, y si todavía no eligió ninguno, la del primero que podría
   * elegir: así la ficha muestra un precio desde que se abre.
   */
  const variantePrecio = sizeOption
    ? (lineas[0]?.talle.variant ??
      talles.find((t) => disponibleEnModalidad(t))?.variant ??
      product.variants[0])
    : activeVariant;

  const totalCents = variantePrecio ? variantePrecio.priceCents + customizationValue.extraCents : undefined;

  /** Lo que suma todo lo elegido, para no obligar a multiplicar de cabeza. */
  const totalPedidoCents = lineas.reduce(
    (suma, l) => suma + (l.talle.variant!.priceCents + customizationValue.extraCents) * l.cantidad,
    0,
  );

  /**
   * Precio promocional por pagar sin pasarela. Se calcula sobre el total que se
   * está mostrando (incluida la personalización), que es lo que el cliente va a
   * pagar de verdad: anunciarlo sobre el precio base sería prometer de menos.
   */
  const promo = useMemo(() => {
    if (totalCents === undefined) return null;
    const mejor = bestPaymentDiscount(totalCents, {
      bank_transfer: settings.bankTransferDiscount,
      cash: settings.cashDiscount,
    });
    return mejor ? { ...mejor, baseCents: totalCents } : null;
  }, [totalCents, settings]);

  // Con talles manda lo elegido en la grilla; sin talles, la variante única.
  const canBuy = sizeOption
    ? modalidad === 'stock' && unidadesElegidas > 0 && customizationValue.valid
    : !!activeVariant && activeVariant.inventory.available > 0 && customizationValue.valid;
  const canPreorder = sizeOption
    ? modalidad === 'encargo' && unidadesElegidas > 0 && customizationValue.valid
    : !!activeVariant && activeVariant.inventory.allowPreorder && customizationValue.valid;
  const isPreorderMode = sizeOption
    ? modalidad === 'encargo'
    : activeVariant && activeVariant.inventory.available === 0 && activeVariant.inventory.allowPreorder;

  async function handleAddToCart() {
    // Con talles se agregan todas las líneas elegidas; sin talles, la variante única.
    const aAgregar = sizeOption
      ? lineas.map((l) => ({ variantId: l.talle.variant!.id, quantity: l.cantidad }))
      : activeVariant
        ? [{ variantId: activeVariant.id, quantity: 1 }]
        : [];
    if (aAgregar.length === 0) return;

    setAddError(null);
    setIsAdding(true);
    try {
      const hasCustomization = !!customizationValue.playerName || customizationValue.playerNumber !== undefined || customizationValue.patchIds.length > 0;
      const customization = hasCustomization
        ? {
            playerName: customizationValue.playerName,
            playerNumber: customizationValue.playerNumber,
            fontId: product.customization?.font?.id ?? null,
            patchIds: customizationValue.patchIds,
          }
        : undefined;

      // De a uno y en orden: el carrito reserva stock, y mandarlos en paralelo
      // haría competir a dos reservas por las mismas unidades.
      for (const linea of aAgregar) {
        await addItem({ ...linea, customization });
      }
      router.push('/carrito');
    } catch {
      setAddError('No pudimos agregarlo al carrito. Probá de nuevo.');
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,440px)_minmax(0,1fr)] md:items-start">
      {/* Product Image Gallery */}
      <div className="md:sticky md:top-6">
        <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-muted">
          {selectedImage ? (
            <Image
              src={resolveImageUrl(selectedImage.url)}
              alt={selectedImage.alt ?? product.name}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 600px"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sin foto disponible</div>
          )}
        </div>

        {showSleeveToggle && longSleeveImage && (
          <div className="mt-4 inline-flex rounded-lg border border-border p-1">
            <button
              type="button"
              onClick={() => setActiveImageId(shortSleeveImage?.id ?? null)}
              className={
                'rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ' +
                (!isLongSleeveActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground')
              }
            >
              Manga corta
            </button>
            <button
              type="button"
              onClick={() => setActiveImageId(longSleeveImage.id)}
              className={
                'rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ' +
                (isLongSleeveActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground')
              }
            >
              Mangas largas
            </button>
          </div>
        )}

        {images.length > 1 && (
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
            {images.map((image) => (
              <button
                key={image.id}
                type="button"
                onClick={() => setActiveImageId(image.id)}
                className={
                  'relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border transition-all ' +
                  (selectedImage?.id === image.id ? 'border-accent ring-2 ring-accent' : 'border-border opacity-70 hover:opacity-100')
                }
              >
                <Image
                  src={resolveImageUrl(image.url)}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product Details & Selection Form */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">
          {[product.league?.name, product.team?.name, product.season?.label].filter(Boolean).join(' · ')}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">{product.name}</h1>

        <div className="mt-4 flex items-baseline gap-3">
          <span className="text-3xl font-extrabold text-foreground">
            {totalCents !== undefined ? formatCentsAsArs(totalCents) : 'Elegí tus opciones'}
          </span>
          {activeVariant?.compareAtPriceCents && (
            <span className="text-lg text-muted-foreground line-through">
              {formatCentsAsArs(activeVariant.compareAtPriceCents)}
            </span>
          )}
        </div>

        {promo && (
          <div className="mt-3 rounded-lg border border-accent/40 bg-accent/10 p-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {/* Tachado en diagonal, de arriba hacia abajo: se distingue del
                  line-through fino y lee como precio "de antes". */}
              <span className="relative text-lg text-muted-foreground">
                {formatCentsAsArs(promo.baseCents)}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom_right,transparent_46%,currentColor_46%,currentColor_54%,transparent_54%)]"
                />
              </span>
              <span className="text-2xl font-extrabold text-accent">{formatCentsAsArs(promo.finalCents)}</span>
            </div>
            <p className="mt-1 text-sm font-medium text-foreground">
              Pagando con {PAYMENT_METHOD_LABELS[promo.method].toLowerCase()} ahorrás{' '}
              {formatCentsAsArs(promo.discountCents)}
            </p>
          </div>
        )}

        {customizationValue.extraCents > 0 && activeVariant && (
          <p className="mt-1 text-xs text-muted-foreground">
            {formatCentsAsArs(activeVariant.priceCents)} base + {formatCentsAsArs(customizationValue.extraCents)} de personalización
          </p>
        )}

        <AccionesProducto product={product} />

        {/* Modalidad: sólo si el producto realmente se puede comprar de las dos formas. */}
        {hayQueElegirModalidad && (
          <div className="mt-6">
            <span className="mb-2 block text-sm font-semibold text-foreground">
              ¿Cómo lo querés?
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => cambiarModalidad('stock')}
                className={
                  'rounded-lg border p-3 text-left transition-all ' +
                  (modalidad === 'stock'
                    ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500'
                    : 'border-input bg-background hover:bg-secondary')
                }
              >
                <span className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Stock inmediato
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Lo tenemos acá. Pagás el total y se envía.
                </span>
              </button>

              <button
                type="button"
                onClick={() => cambiarModalidad('encargo')}
                className={
                  'rounded-lg border p-3 text-left transition-all ' +
                  (modalidad === 'encargo'
                    ? 'border-accent bg-accent/10 ring-1 ring-accent'
                    : 'border-input bg-background hover:bg-secondary')
                }
              >
                <span className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                  <RefreshCw className="h-4 w-4 text-accent" />
                  Por encargo
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Se pide a China. Seña del 50% ahora.
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Talles: cantidad por talle, según la modalidad elegida. */}
        {sizeOption && (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">{sizeOption.name}</span>
              <button
                type="button"
                onClick={() => setSizeGuideOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                <Ruler className="h-3.5 w-3.5" /> Tabla de medidas
              </button>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              {modalidad === 'stock'
                ? 'Elegí cuántas unidades querés de cada talle. Los tachados no tienen stock.'
                : 'Elegí cuántas unidades querés de cada talle. Los tachados ya los tenemos acá: están en “Stock inmediato”.'}
            </p>

            <div className="space-y-2">
              {talles.map((t) => {
                const disponible = disponibleEnModalidad(t);
                // Con stock no se puede pedir más de lo que hay; por encargo no hay tope.
                const tope = topeDe(t);
                const cantidad = cantidadDe(t);
                return (
                  <div
                    key={t.value.id}
                    className={
                      'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ' +
                      (!disponible
                        ? 'border-dashed border-input/60 bg-muted/30'
                        : cantidad > 0
                          ? 'border-primary bg-primary/5'
                          : 'border-input bg-background')
                    }
                  >
                    <div className="min-w-0">
                      <span
                        className={
                          'text-sm font-semibold ' +
                          (disponible ? 'text-foreground' : 'text-muted-foreground/60 line-through')
                        }
                      >
                        {t.value.value}
                      </span>
                      {disponible && modalidad === 'stock' && t.available <= 2 && (
                        <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                          {t.available === 1 ? '¡Última unidad!' : `¡Quedan ${t.available}!`}
                        </span>
                      )}
                      {!disponible && (
                        <span className="ml-2 text-[11px] text-muted-foreground">
                          {modalidad === 'stock' ? 'sin stock' : 'disponible con entrega inmediata'}
                        </span>
                      )}
                    </div>

                    {disponible && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Quitar una unidad de ${t.value.value}`}
                          disabled={cantidad === 0}
                          onClick={() =>
                            setCantidades((c) => ({ ...c, [t.value.id]: Math.max(0, cantidad - 1) }))
                          }
                          className="h-8 w-8 rounded-md border border-input text-base font-bold text-foreground disabled:opacity-30 hover:bg-secondary"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm font-bold tabular-nums">{cantidad}</span>
                        <button
                          type="button"
                          aria-label={`Agregar una unidad de ${t.value.value}`}
                          disabled={cantidad >= tope}
                          onClick={() =>
                            setCantidades((c) => ({ ...c, [t.value.id]: Math.min(tope, cantidad + 1) }))
                          }
                          className="h-8 w-8 rounded-md border border-input text-base font-bold text-foreground disabled:opacity-30 hover:bg-secondary"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {unidadesElegidas > 0 && (
              <p className="mt-3 text-sm font-semibold text-foreground">
                {unidadesElegidas} {unidadesElegidas === 1 ? 'unidad' : 'unidades'} ·{' '}
                {formatCentsAsArs(totalPedidoCents)}
              </p>
            )}
            {unidadesElegidas > 1 && customizationValue.extraCents > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                La personalización que elijas se aplica a las {unidadesElegidas} unidades.
              </p>
            )}
          </div>
        )}

        {/* Otras opciones (manga, color…): siguen siendo de a una. */}
        {otrasOpciones.map((option) => (
          <div key={option.id} className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">{option.name}</span>
              {option.name.toLowerCase().includes('talle') && (
                <button
                  type="button"
                  onClick={() => setSizeGuideOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                >
                  <Ruler className="h-3.5 w-3.5" /> Tabla de medidas
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {option.values.map((value) => {
                const active = selected[option.id] === value.id;
                const agotado = valoresSinStock.has(value.id);
                return (
                  <button
                    key={value.id}
                    type="button"
                    // Se deja clickeable a propósito: al elegirlo, el cartel de
                    // abajo explica por qué no se puede comprar.
                    title={agotado ? `${value.value} — sin stock` : undefined}
                    onClick={() => {
                      setSelected((s) => ({ ...s, [option.id]: value.id }));
                      // Solo para las opciones que tienen foto propia: cambiar de
                      // talle no debería sacarte de la foto que estabas mirando.
                      if (optionValueIdsWithImage.has(value.id)) setActiveImageId(null);
                    }}
                    className={
                      'rounded-lg border px-4 py-2 text-sm font-medium transition-all ' +
                      (active
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                        : agotado
                          ? 'border-dashed border-input/60 bg-muted/40 text-muted-foreground/60 line-through hover:bg-muted/60'
                          : 'border-input bg-background text-foreground hover:bg-secondary')
                    }
                  >
                    {value.value}
                    {agotado && <span className="sr-only"> (sin stock)</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Availability Badge. Con talles la modalidad ya está dicha arriba y el
            cartel sólo repetiría; se muestra únicamente si no hay nada elegido. */}
        {!sizeOption && (
          <div className="mt-6">
            <AvailabilityBadge product={product} variant={activeVariant} />
          </div>
        )}

        {/* Preorder Callout Banner */}
        {isPreorderMode && (
          <div className="mt-4 rounded-lg border border-accent/30 bg-accent/10 p-3.5 text-xs text-foreground">
            <div className="flex items-start gap-2">
              <RefreshCw className="mt-0.5 h-4 w-4 text-accent shrink-0" />
              <div>
                <p className="font-semibold text-accent">Producto por encargo</p>
                <p className="mt-0.5 leading-relaxed text-muted-foreground">
                  Se paga una seña del 50% para iniciar la importación desde China. El 50% restante + envío se abonará cuando el producto llegue a nuestro depósito (plazo de ~20 días).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          type="button"
          disabled={(!canBuy && !canPreorder) || isAdding}
          onClick={() => void handleAddToCart()}
          className={buttonVariants({ size: 'lg', className: 'mt-6 w-full font-bold' })}
        >
          {isAdding
            ? 'Agregando…'
            : canBuy
              ? sizeOption && unidadesElegidas > 1
                ? `Agregar ${unidadesElegidas} al carrito`
                : 'Agregar al carrito'
              : canPreorder
                ? sizeOption && unidadesElegidas > 1
                  ? `Pedir ${unidadesElegidas} por encargo (Seña 50%)`
                  : 'Pedir por encargo (Seña 50%)'
                : sizeOption
                  ? talles.some((t) => disponibleEnModalidad(t))
                    ? 'Elegí al menos un talle'
                    : modalidad === 'stock'
                      ? 'Sin stock disponible'
                      : 'No disponible por encargo'
                  : activeVariant
                    ? 'Sin stock disponible'
                    : hasFullSelection
                      ? 'Opción no disponible'
                      : `Elegí ${optionsPrompt(product.options)}`}
        </button>

        {addError && <p className="mt-2 text-sm text-destructive">{addError}</p>}

        {/* Live Customizer.
            Requiere tipografía asignada: el render de producción del servidor la exige, así que
            sin fuente el cliente podría personalizar y recibir un 400 recién al confirmar el pedido. */}
        {product.customization?.font && customizationImage && (
          <CustomizationBlock
            customization={product.customization}
            imageUrl={resolveImageUrl(customizationImage.url)}
            onChange={setCustomizationValue}
          />
        )}

        {/* Description */}
        {product.description && (
          <div className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
            <h3 className="font-semibold text-foreground mb-2">Detalles del producto</h3>
            <p className="whitespace-pre-line leading-relaxed text-xs sm:text-sm">{product.description}</p>
          </div>
        )}
      </div>

      {/* Size Guide Sheet Modal */}
      <Sheet open={sizeGuideOpen} onOpenChange={setSizeGuideOpen}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Ruler className="h-5 w-5 text-accent" /> Guía de Talles
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <p className="text-xs text-muted-foreground">
              Las medidas son aproximadas expresadas en centímetros (largo × ancho). Te recomendamos medir una camiseta tuya sobre una superficie plana.
            </p>

            {Object.entries(SIZE_GUIDES).map(([key, guide]) => (
              <div key={key} className="space-y-2">
                <h4 className="text-sm font-bold text-foreground">{guide.title}</h4>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted text-muted-foreground font-semibold">
                      <tr>
                        <th className="p-2">Talle</th>
                        <th className="p-2">Ancho (axila a axila)</th>
                        <th className="p-2">Largo (hombro a cintura)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-foreground">
                      {guide.rows.map((row) => (
                        <tr key={row.size}>
                          <td className="p-2 font-bold">{row.size}</td>
                          <td className="p-2">{row.chestCm} cm</td>
                          <td className="p-2">{row.lengthCm} cm</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AvailabilityBadge({ product, variant }: { product: ProductDetailDto; variant: VariantDto | undefined }) {
  if (!variant) {
    return product.variants.length === 0 ? (
      <p className="text-xs text-muted-foreground">Próximamente disponible.</p>
    ) : (
      <p className="text-xs text-muted-foreground">
        Seleccioná {optionsPrompt(product.options)} para ver stock y modalidad.
      </p>
    );
  }

  // Se resuelve con la misma función que el checkout. Antes acá se miraba sólo el
  // stock: un producto marcado "sólo por encargo" con una unidad suelta prometía
  // entrega inmediata y después cobraba seña, sin envío.
  const decision = resolveFulfillment({
    fulfillmentMode: product.fulfillmentMode,
    available: variant.inventory.available,
    quantity: 1,
    allowPreorder: variant.inventory.allowPreorder,
  });

  if (decision.kind === 'IN_STOCK') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        <ShieldCheck className="h-3.5 w-3.5" /> Entrega Inmediata (Stock Local)
      </span>
    );
  }

  if (decision.kind === 'PREORDER') {
    const days = variant.inventory.preorderLeadDays ?? product.preorderLeadDays ?? 20;
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
        <RefreshCw className="h-3.5 w-3.5" /> Por encargo a China (~{days} días)
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1 text-xs font-semibold text-destructive">
      Sin stock disponible
    </span>
  );
}
