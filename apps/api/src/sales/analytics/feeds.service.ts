import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';

/** Escapa lo mínimo para que el texto sea XML válido. */
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

@Injectable()
export class FeedsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Feed de productos para Google Merchant Center (RSS 2.0). Un ítem por producto
   * activo, con el precio mínimo entre sus variantes. La clienta sólo tiene que
   * enviar la URL de este endpoint a Merchant Center.
   */
  async googleMerchantXml(): Promise<string> {
    const storeUrl = this.config.get('STOREFRONT_URL');
    const apiUrl = this.config.get('API_PUBLIC_URL');
    const brand = this.config.get('MERCHANT_FEED_BRAND');

    const products = await this.prisma.product.findMany({
      where: { status: 'ACTIVE' },
      include: {
        brand: true,
        images: { orderBy: { position: 'asc' }, take: 1 },
        variants: { select: { priceCents: true, inventory: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const items = products
      .filter((p) => p.variants.length > 0 && p.images[0])
      .map((p) => {
        const minPriceCents = Math.min(...p.variants.map((v) => v.priceCents));
        const totalAvailable = p.variants.reduce(
          (sum, v) => sum + Math.max(0, (v.inventory?.quantity ?? 0) - (v.inventory?.reserved ?? 0)),
          0,
        );
        // Preventa o sin stock → "preorder"; con stock → "in stock".
        const availability = p.fulfillmentMode === 'PREORDER' || totalAvailable === 0 ? 'preorder' : 'in stock';
        const imageUrl = this.absolute(p.images[0]!.url, apiUrl);
        const description = p.seoDescription ?? p.description ?? p.name;

        return [
          '    <item>',
          `      <g:id>${xmlEscape(p.id)}</g:id>`,
          `      <g:title>${xmlEscape(p.name)}</g:title>`,
          `      <g:description>${xmlEscape(description)}</g:description>`,
          `      <g:link>${xmlEscape(`${storeUrl}/productos/${p.slug}`)}</g:link>`,
          `      <g:image_link>${xmlEscape(imageUrl)}</g:image_link>`,
          `      <g:availability>${availability}</g:availability>`,
          `      <g:price>${(minPriceCents / 100).toFixed(2)} ARS</g:price>`,
          `      <g:brand>${xmlEscape(p.brand?.name ?? brand)}</g:brand>`,
          '      <g:condition>new</g:condition>',
          '      <g:identifier_exists>no</g:identifier_exists>',
          '    </item>',
        ].join('\n');
      })
      .join('\n');

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
      '  <channel>',
      `    <title>${xmlEscape(brand)}</title>`,
      `    <link>${xmlEscape(storeUrl)}</link>`,
      '    <description>Catálogo de productos</description>',
      items,
      '  </channel>',
      '</rss>',
    ].join('\n');
  }

  private absolute(path: string, apiUrl: string): string {
    if (path.startsWith('http')) return path;
    return `${apiUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  }
}
