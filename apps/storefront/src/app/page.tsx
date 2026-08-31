import { Suspense } from 'react';
import {
  HeroSection,
  TrustBar,
  ProductRail,
  LeagueGrid,
  HowItWorks,
  CustomizationShowcase,
  FaqSection,
  ContactCta,
} from '@/components/home-sections';
import { ProductRailSkeleton } from '@/components/product-rail-skeleton';
import { HOME_RAILS } from '@/lib/site-config';

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* 1. Hero */}
      <HeroSection />

      {/* 2. Trust Bar */}
      <TrustBar />

      {/* 3. Comprá por liga (banner de ligas, clickeable) */}
      <Suspense fallback={<div className="h-48 bg-card animate-pulse py-12" />}>
        <LeagueGrid />
      </Suspense>

      {/* 4. Lo último que llegó (Latest products) */}
      <Suspense fallback={<ProductRailSkeleton title="Lo último que llegó" />}>
        <ProductRail
          title="Lo último que llegó"
          subtitle="Nuevos ingresos y reposiciones en stock"
          qs="sort=newest&perPage=8"
          viewAllHref="/productos"
        />
      </Suspense>

      {/* 5. Rails por liga configurados en site-config */}
      {HOME_RAILS.map((rail) => (
        <Suspense key={rail.leagueSlug} fallback={<ProductRailSkeleton title={rail.title} />}>
          <ProductRail
            title={rail.title}
            subtitle={`Camisetas destacadas de ${rail.title}`}
            qs={`leagueSlug=${rail.leagueSlug}&perPage=8`}
            viewAllHref={`/productos?leagueSlug=${rail.leagueSlug}`}
          />
        </Suspense>
      ))}

      {/* 6. Cómo funciona el encargo */}
      <HowItWorks />

      {/* 7. Showcase de personalización */}
      <CustomizationShowcase />

      {/* 8. FAQ corta */}
      <FaqSection />

      {/* 9. Contact CTA */}
      <Suspense fallback={<div className="h-32 bg-primary animate-pulse" />}>
        <ContactCta />
      </Suspense>
    </div>
  );
}
