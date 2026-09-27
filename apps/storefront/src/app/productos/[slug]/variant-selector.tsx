'use client';

import { formatCentsAsArs, type ProductDetailDto } from '@tienda/shared';
import { buttonVariants, Sheet, SheetContent, SheetHeader, SheetTitle } from '@tienda/ui';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Ruler, ShieldCheck, RefreshCw } from 'lucide-react';
import Image from 'next/image';

import { useCart } from '@/lib/cart-context';
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

export function VariantSelector({ product }: { product: ProductDetailDto }) {
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
  const optionValueIdsWithImage = useMemo(
    () => new Set(images.map((img) => img.optionValueId).filter((id): id is string => !!id)),
    [images],
  );

  const totalCents = activeVariant ? activeVariant.priceCents + customizationValue.extraCents : undefined;
  const canBuy = !!activeVariant && activeVariant.inventory.available > 0 && customizationValue.valid;
  const canPreorder = !!activeVariant && activeVariant.inventory.allowPreorder && customizationValue.valid;
  const isPreorderMode = activeVariant && activeVariant.inventory.available === 0 && activeVariant.inventory.allowPreorder;

  async function handleAddToCart() {
    if (!activeVariant) return;
    setAddError(null);
    setIsAdding(true);
    try {
      const hasCustomization = !!customizationValue.playerName || customizationValue.playerNumber !== undefined || customizationValue.patchIds.length > 0;
      await addItem({
        variantId: activeVariant.id,
        quantity: 1,
        customization: hasCustomization
          ? {
              playerName: customizationValue.playerName,
              playerNumber: customizationValue.playerNumber,
              fontId: product.customization?.font?.id ?? null,
              patchIds: customizationValue.patchIds,
            }
          : undefined,
      });
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

        {customizationValue.extraCents > 0 && activeVariant && (
          <p className="mt-1 text-xs text-muted-foreground">
            {formatCentsAsArs(activeVariant.priceCents)} base + {formatCentsAsArs(customizationValue.extraCents)} de personalización
          </p>
        )}

        {/* Options (Size, Version, etc) */}
        {product.options.map((option) => (
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
                return (
                  <button
                    key={value.id}
                    type="button"
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
                        : 'border-input bg-background text-foreground hover:bg-secondary')
                    }
                  >
                    {value.value}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Availability Badge */}
        <div className="mt-6">
          <AvailabilityBadge product={product} variant={activeVariant} />
        </div>

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
              ? 'Agregar al carrito'
              : canPreorder
                ? 'Pedir por encargo (Seña 50%)'
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

  if (variant.inventory.available > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        <ShieldCheck className="h-3.5 w-3.5" /> Entrega Inmediata (Stock Local)
      </span>
    );
  }

  if (variant.inventory.allowPreorder) {
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
