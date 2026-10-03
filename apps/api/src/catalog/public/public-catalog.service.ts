import { Injectable, NotFoundException } from '@nestjs/common';
import type { ProductDetailDto, ProductFacetsDto, ProductListItemDto, ProductListQuery } from '@tienda/shared';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { TemplatesService } from '../customization/templates.service';

// El ordenamiento por precio (mínimo entre variantes) se resuelve en memoria sobre
// un lote acotado, en vez de armar un ORDER BY agregado en SQL crudo. El tope cubre
// catálogos de hasta ~2000 productos con holgura (1000 productos ≈ pocos MB, ordena
// en milisegundos). Si el catálogo creciera más allá de eso, conviene denormalizar
// un `minPriceCents` indexado en Product y ordenar directo en la base.
const MAX_SORTABLE_PRODUCTS = 2000;

// El talle es la única opción que el storefront muestra como faceta propia; se asume
// que la clienta la nombra "Talle" al cargar el producto (documentado en el panel).
const SIZE_OPTION_NAME = 'Talle';

type FacetFilters = Pick<
  ProductListQuery,
  | 'q'
  | 'leagueSlug'
  | 'teamSlug'
  | 'categorySlug'
  | 'seasonId'
  | 'size'
  | 'minPrice'
  | 'maxPrice'
  | 'disponibilidad'
>;

@Injectable()
export class PublicCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: TemplatesService,
  ) {}

  /**
   * Si hay que ampliar la búsqueda a los nombres de liga.
   *
   * Sólo cuando buscar por nombre y equipo no encuentra nada. Así "argentina"
   * devuelve las camisetas de la selección y no toda la Liga Argentina, y
   * "premier" —que no aparece en ningún nombre de producto— sigue encontrando
   * la Premier League.
   *
   * El listado y las facetas tienen que tomar la MISMA decisión, o los números
   * de los filtros no coinciden con los productos que se ven.
   */
  private async buscaTambienPorLiga(filters: FacetFilters): Promise<boolean> {
    if (!filters.q) return false;
    const porNombreOEquipo = await this.prisma.product.count({
      where: this.buildWhere(filters, false),
    });
    return porNombreOEquipo === 0;
  }

  async listProducts(query: ProductListQuery) {
    const where = this.buildWhere(query, await this.buscaTambienPorLiga(query));
    const needsInMemorySort = query.sort === 'price_asc' || query.sort === 'price_desc';

    if (!needsInMemorySort) {
      const orderBy: Prisma.ProductOrderByWithRelationInput = { publishedAt: 'desc' };

      const [rows, total] = await this.prisma.$transaction([
        this.prisma.product.findMany({
          where,
          orderBy,
          skip: (query.page - 1) * query.perPage,
          take: query.perPage,
          include: this.listInclude(),
        }),
        this.prisma.product.count({ where }),
      ]);

      return this.paginate(rows.map((r) => this.toListItem(r)), query, total);
    }

    const rows = await this.prisma.product.findMany({
      where,
      take: MAX_SORTABLE_PRODUCTS,
      include: this.listInclude(),
    });

    const items = rows.map((r) => this.toListItem(r));
    items.sort((a, b) => {
      const priceA = a.minPriceCents ?? 0;
      const priceB = b.minPriceCents ?? 0;
      return query.sort === 'price_asc' ? priceA - priceB : priceB - priceA;
    });

    const start = (query.page - 1) * query.perPage;
    return this.paginate(items.slice(start, start + query.perPage), query, items.length);
  }

  async getFacets(filters: FacetFilters): Promise<ProductFacetsDto> {
    // La misma decisión que toma el listado, o las facetas contarían productos
    // que la búsqueda no devuelve.
    const porLiga = await this.buscaTambienPorLiga(filters);
    const where = this.buildWhere(filters, porLiga);

    const [leagueGroups, teamGroups, seasonGroups, priceAgg, sizeRows] = await Promise.all([
      this.prisma.product.groupBy({ by: ['leagueId'], where: { ...where, leagueId: { not: null } }, _count: true }),
      this.prisma.product.groupBy({ by: ['teamId'], where: { ...where, teamId: { not: null } }, _count: true }),
      this.prisma.product.groupBy({ by: ['seasonId'], where: { ...where, seasonId: { not: null } }, _count: true }),
      this.prisma.productVariant.aggregate({
        where: { product: where },
        _min: { priceCents: true },
        _max: { priceCents: true },
      }),
      this.getSizeFacet(filters, porLiga),
    ]);

    const leagueIds = leagueGroups.map((g) => g.leagueId).filter((id): id is string => id !== null);
    const teamIds = teamGroups.map((g) => g.teamId).filter((id): id is string => id !== null);
    const seasonIds = seasonGroups.map((g) => g.seasonId).filter((id): id is string => id !== null);

    const [leagues, teams, seasons] = await Promise.all([
      this.prisma.league.findMany({ where: { id: { in: leagueIds } } }),
      this.prisma.team.findMany({ where: { id: { in: teamIds } } }),
      this.prisma.season.findMany({ where: { id: { in: seasonIds } } }),
    ]);

    const leagueCountById = new Map(leagueGroups.map((g) => [g.leagueId, g._count]));
    const teamCountById = new Map(teamGroups.map((g) => [g.teamId, g._count]));
    const seasonCountById = new Map(seasonGroups.map((g) => [g.seasonId, g._count]));

    return {
      leagues: leagues.map((l) => ({ value: l.slug, label: l.name, count: leagueCountById.get(l.id) ?? 0 })),
      teams: teams.map((t) => ({ value: t.slug, label: t.name, count: teamCountById.get(t.id) ?? 0 })),
      seasons: seasons.map((s) => ({ value: s.id, label: s.label, count: seasonCountById.get(s.id) ?? 0 })),
      sizes: sizeRows.map((row) => ({ value: row.value, label: row.value, count: Number(row.count) })),
      priceRange: {
        min: priceAgg._min.priceCents ?? 0,
        max: priceAgg._max.priceCents ?? 0,
      },
    };
  }

  async getBySlug(slug: string): Promise<ProductDetailDto> {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: 'ACTIVE' },
      include: {
        brand: true,
        category: true,
        league: true,
        team: true,
        season: true,
        options: { include: { values: true }, orderBy: { position: 'asc' } },
        images: { orderBy: { position: 'asc' } },
        variants: { include: { optionValues: true, inventory: true }, orderBy: { position: 'asc' } },
      },
    });

    if (!product) {
      throw new NotFoundException('El producto no existe');
    }

    const customization = await this.templates.get(product.id);

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
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
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      publishedAt: product.publishedAt?.toISOString() ?? null,
      brand: product.brand ? { id: product.brand.id, name: product.brand.name, slug: product.brand.slug } : null,
      category: product.category
        ? { id: product.category.id, name: product.category.name, slug: product.category.slug }
        : null,
      league: product.league
        ? { id: product.league.id, name: product.league.name, slug: product.league.slug }
        : null,
      team: product.team ? { id: product.team.id, name: product.team.name, slug: product.team.slug } : null,
      season: product.season ? { id: product.season.id, label: product.season.label } : null,
      options: product.options.map((option) => ({
        id: option.id,
        name: option.name,
        position: option.position,
        values: option.values.map((value) => ({ id: value.id, value: value.value, position: value.position })),
      })),
      images: product.images.map((image) => ({
        id: image.id,
        url: image.url,
        alt: image.alt,
        position: image.position,
        optionValueId: image.optionValueId,
        isLongSleeve: image.isLongSleeve,
      })),
      variants: product.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        priceCents: variant.priceCents,
        compareAtPriceCents: variant.compareAtPriceCents,
        costCents: null,
        weightGrams: variant.weightGrams,
        barcode: variant.barcode,
        position: variant.position,
        optionValueIds: variant.optionValues.map((ov) => ov.valueId),
        inventory: {
          quantity: variant.inventory?.quantity ?? 0,
          reserved: variant.inventory?.reserved ?? 0,
          available: (variant.inventory?.quantity ?? 0) - (variant.inventory?.reserved ?? 0),
          trackInventory: variant.inventory?.trackInventory ?? true,
          allowPreorder: variant.inventory?.allowPreorder ?? false,
          preorderLeadDays: variant.inventory?.preorderLeadDays ?? null,
        },
      })),
      customization,
    };
  }

  private buildWhere(filters: FacetFilters, incluirLiga = false): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = { status: 'ACTIVE' };
    // Todas las condiciones van por AND: varias usan la misma clave
    // (`variants`) y la ultima en escribir pisaba a la anterior.
    const condiciones: Prisma.ProductWhereInput[] = [];

    if (filters.q) {
      // Cada palabra tiene que aparecer en el nombre o en el equipo.
      // Antes se buscaba la frase entera dentro del nombre, asi que "boca
      // titular" no encontraba nada: el producto se llama "Camiseta Boca
      // Juniors - Titular - 2026-27" y la frase exacta nunca esta.
      //
      // La LIGA solo entra como ultimo recurso (ver `buscaTambienPorLiga`). Si
      // entrara siempre, buscar "argentina" traeria las 83 camisetas de la Liga
      // Argentina —Boca, River, Colo-Colo— encima de las de la seleccion, que es
      // lo que se estaba buscando. Al reves pasa con "premier": ningun producto
      // se llama asi, y ahi la liga es la unica forma de encontrarlo.
      const palabras = filters.q.split(/\s+/).filter(Boolean).slice(0, 6);
      for (const palabra of palabras) {
        const alternativas: Prisma.ProductWhereInput[] = [
          { name: { contains: palabra, mode: 'insensitive' } },
          { team: { name: { contains: palabra, mode: 'insensitive' } } },
        ];
        if (incluirLiga) {
          alternativas.push({ league: { name: { contains: palabra, mode: 'insensitive' } } });
        }
        condiciones.push({ OR: alternativas });
      }
    }
    if (filters.leagueSlug) {
      where.league = { slug: filters.leagueSlug };
    }
    if (filters.teamSlug) {
      where.team = { slug: filters.teamSlug };
    }
    if (filters.categorySlug) {
      where.category = { slug: filters.categorySlug };
    }
    if (filters.seasonId) {
      where.seasonId = filters.seasonId;
    }

    // Talle, precio y stock filtran sobre la MISMA variante: tiene que existir una
    // variante que cumpla las tres condiciones a la vez, no tres variantes distintas
    // que cumplan una cada una.
    //
    // El stock vivia aparte y por eso "Stock inmediato + talle XL" devolvia camisetas
    // sin XL: alcanzaba con que el producto tuviera stock de cualquier talle y ofreciera
    // XL en el catalogo. Los cinco talles daban 95, el total de productos con algo de
    // stock. Los reales son L 49, M 34, S 12, XL 55, XXL 51.
    const variantWhere: Prisma.ProductVariantWhereInput = {};
    if (filters.size) {
      variantWhere.optionValues = {
        some: { value: { value: { equals: filters.size, mode: 'insensitive' } } },
      };
    }
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      // minPrice/maxPrice llegan en pesos desde el storefront; se convierten a centavos.
      variantWhere.priceCents = {
        ...(filters.minPrice !== undefined ? { gte: filters.minPrice * 100 } : {}),
        ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice * 100 } : {}),
      };
    }

    // Stock inmediato = hay unidades fisicas disponibles ahora. Se mira el
    // inventario real y no fulfillmentMode, porque ese campo dice como se PUEDE
    // vender, no si hay mercaderia: un producto marcado "en stock" con 0
    // unidades entraria igual al apartado y el cliente no podria comprarlo.
    if (filters.disponibilidad === 'stock') {
      variantWhere.inventory = { quantity: { gt: 0 } };
    } else if (filters.disponibilidad === 'encargo') {
      // Por encargo sigue siendo a nivel producto: no hay stock de ningun talle.
      condiciones.push({ variants: { none: { inventory: { quantity: { gt: 0 } } } } });
    }

    if (Object.keys(variantWhere).length > 0) {
      condiciones.push({ variants: { some: variantWhere } });
    }
    if (condiciones.length > 0) {
      where.AND = condiciones;
    }

    return where;
  }

  /** Colecciones activas (con al menos un producto activo) para el storefront. */
  async listCollections() {
    const collections = await this.prisma.collection.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { products: { where: { product: { status: 'ACTIVE' } } } } },
      },
    });
    return collections
      .filter((c) => c._count.products > 0)
      .map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        imageUrl: c.imageUrl,
        position: c.position,
        productCount: c._count.products,
      }));
  }

  /** Una colección por slug con sus productos activos, en el orden definido. */
  async getCollectionBySlug(slug: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { slug },
      include: {
        products: {
          orderBy: { position: 'asc' },
          include: { product: { include: this.listInclude() } },
        },
      },
    });
    if (!collection) {
      throw new NotFoundException('La colección no existe');
    }
    return {
      id: collection.id,
      name: collection.name,
      slug: collection.slug,
      description: collection.description,
      imageUrl: collection.imageUrl,
      products: collection.products
        .filter((pc) => pc.product.status === 'ACTIVE')
        .map((pc) => this.toListItem(pc.product)),
    };
  }

  /**
   * Productos relacionados a uno dado: primero los que comparten colección; si no
   * alcanzan, se completa con el mismo equipo y luego la misma liga. Nunca incluye
   * el producto original ni inactivos.
   */
  async getRelated(slug: string, limit = 8): Promise<ProductListItemDto[]> {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: 'ACTIVE' },
      select: { id: true, teamId: true, leagueId: true, collections: { select: { collectionId: true } } },
    });
    if (!product) {
      throw new NotFoundException('El producto no existe');
    }

    const collectionIds = product.collections.map((c) => c.collectionId);
    const collected = new Map<string, Prisma.ProductGetPayload<{ include: ReturnType<PublicCatalogService['listInclude']> }>>();

    const pushWhere = async (where: Prisma.ProductWhereInput) => {
      if (collected.size >= limit) return;
      const rows = await this.prisma.product.findMany({
        where: { ...where, status: 'ACTIVE', id: { not: product.id } },
        include: this.listInclude(),
        take: limit,
      });
      for (const row of rows) {
        if (!collected.has(row.id)) collected.set(row.id, row);
      }
    };

    if (collectionIds.length > 0) {
      await pushWhere({ collections: { some: { collectionId: { in: collectionIds } } } });
    }
    if (product.teamId) await pushWhere({ teamId: product.teamId });
    if (product.leagueId) await pushWhere({ leagueId: product.leagueId });

    return Array.from(collected.values())
      .slice(0, limit)
      .map((p) => this.toListItem(p));
  }

  private listInclude() {
    return {
      brand: true,
      league: true,
      team: true,
      season: true,
      images: { orderBy: { position: 'asc' as const }, take: 1 },
      variants: { select: { priceCents: true, inventory: true } },
    } satisfies Prisma.ProductInclude;
  }

  private toListItem(
    product: Prisma.ProductGetPayload<{ include: ReturnType<PublicCatalogService['listInclude']> }>,
  ): ProductListItemDto {
    const prices = product.variants.map((v) => v.priceCents);
    const totalAvailable = product.variants.reduce(
      (sum, v) => sum + Math.max(0, (v.inventory?.quantity ?? 0) - (v.inventory?.reserved ?? 0)),
      0,
    );

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      status: product.status,
      fulfillmentMode: product.fulfillmentMode,
      brandName: product.brand?.name ?? null,
      leagueName: product.league?.name ?? null,
      teamName: product.team?.name ?? null,
      seasonLabel: product.season?.label ?? null,
      minPriceCents: prices.length ? Math.min(...prices) : null,
      maxPriceCents: prices.length ? Math.max(...prices) : null,
      coverImageUrl: product.images[0]?.url ?? null,
      totalAvailable,
    };
  }

  private async getSizeFacet(
    filters: FacetFilters,
    incluirLiga = false,
  ): Promise<{ value: string; count: bigint }[]> {
    // Build dynamic WHERE conditions respecting active filters.
    const conditions: string[] = [`p.status = 'ACTIVE'`];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filters.q) {
      // Palabra por palabra sobre nombre y equipo, igual que `buildWhere`. Acá
      // se buscaba la frase entera y sólo en el nombre, así que en la pestaña de
      // stock "boca titular" contaba 0 talles mientras el listado devolvía 26.
      const palabras = filters.q.split(/\s+/).filter(Boolean).slice(0, 6);
      for (const palabra of palabras) {
        const alternativas = [`p.name ILIKE $${paramIdx}`, `t.name ILIKE $${paramIdx}`];
        if (incluirLiga) alternativas.push(`l.name ILIKE $${paramIdx}`);
        conditions.push(`(${alternativas.join(' OR ')})`);
        params.push(`%${palabra}%`);
        paramIdx++;
      }
    }
    if (filters.leagueSlug) {
      conditions.push(`l.slug = $${paramIdx}`);
      params.push(filters.leagueSlug);
      paramIdx++;
    }
    if (filters.teamSlug) {
      conditions.push(`t.slug = $${paramIdx}`);
      params.push(filters.teamSlug);
      paramIdx++;
    }
    if (filters.categorySlug) {
      conditions.push(`c.slug = $${paramIdx}`);
      params.push(filters.categorySlug);
      paramIdx++;
    }
    if (filters.seasonId) {
      conditions.push(`p."seasonId" = $${paramIdx}`);
      params.push(filters.seasonId);
      paramIdx++;
    }
    // El stock se mide sobre la variante que se esta contando (pv), no sobre el
    // producto. Preguntando por producto, una camiseta con stock solo en XL hacia
    // contar TODOS sus talles, y la faceta mostraba el mismo numero en los cinco
    // (95, el total de productos con algo de stock) en vez de L 49, M 34, S 12,
    // XL 55, XXL 51. Tiene que coincidir con buildWhere, que filtra por variante.
    if (filters.disponibilidad === 'stock') {
      conditions.push(`EXISTS (
        SELECT 1 FROM inventory_items si
        WHERE si."variantId" = pv.id AND si.quantity > 0
      )`);
    } else if (filters.disponibilidad === 'encargo') {
      // Por encargo sigue siendo a nivel producto: no hay stock de ningun talle.
      conditions.push(`NOT EXISTS (
        SELECT 1 FROM product_variants sv
        JOIN inventory_items si ON si."variantId" = sv.id
        WHERE sv."productId" = p.id AND si.quantity > 0
      )`);
    }
    // El precio se mide sobre la MISMA variante, igual que en el listado: que
    // exista una variante dentro del rango, no dos que lo cumplan por separado.
    if (filters.minPrice !== undefined) {
      conditions.push(`pv."priceCents" >= $${paramIdx}`);
      params.push(filters.minPrice * 100);
      paramIdx++;
    }
    if (filters.maxPrice !== undefined) {
      conditions.push(`pv."priceCents" <= $${paramIdx}`);
      params.push(filters.maxPrice * 100);
      paramIdx++;
    }

    const whereClause = conditions.join(' AND ');

    const query = `
      SELECT pov.value AS value, COUNT(DISTINCT p.id) AS count
      FROM products p
      JOIN product_variants pv ON pv."productId" = p.id
      JOIN variant_option_values vov ON vov."variantId" = pv.id
      JOIN product_option_values pov ON pov.id = vov."valueId"
      JOIN product_options po ON po.id = pov."optionId" AND po.name = '${SIZE_OPTION_NAME}'
      LEFT JOIN leagues l ON l.id = p."leagueId"
      LEFT JOIN teams t ON t.id = p."teamId"
      LEFT JOIN categories c ON c.id = p."categoryId"
      WHERE ${whereClause}
      GROUP BY pov.value
      ORDER BY pov.value ASC
    `;

    return this.prisma.$queryRawUnsafe<{ value: string; count: bigint }[]>(query, ...params);
  }

  private paginate<T>(items: T[], query: Pick<ProductListQuery, 'page' | 'perPage'>, total: number) {
    return {
      items,
      page: query.page,
      perPage: query.perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    };
  }
}
