import { notFound } from 'next/navigation';
import DOMPurify from 'isomorphic-dompurify';
import type { Metadata } from 'next';

interface StaticPage {
  id: string;
  title: string;
  slug: string;
  contentHtml: string;
  isActive: boolean;
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function fetchPage(slug: string): Promise<StaticPage | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  try {
    const res = await fetch(`${apiUrl}/pages/${slug}`, { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`Error fetching page ${slug}:`, err);
    return null;
  }
}

/** Generación dinámica de metadatos SEO basados en el título de la página. */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchPage(slug);

  if (!page) {
    return {
      title: 'Página no encontrada',
    };
  }

  return {
    title: `${page.title}`,
    description: `Información oficial sobre ${page.title.toLowerCase()} en Remeras del Área.`,
  };
}

export default async function CMSStaticPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await fetchPage(slug);

  if (!page) {
    notFound();
  }

  return (
    <div className="relative min-h-[60vh] px-4 py-12 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[300px] h-[300px] rounded-full bg-primary/5 blur-[80px]" />
      </div>

      <article className="relative z-10 space-y-6">
        <header className="border-b border-border/60 pb-6 mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            {page.title}
          </h1>
          <p className="text-xs text-muted-foreground mt-2 font-mono">
            Remeras del Área — Página Informativa
          </p>
        </header>

        {/* Contenido Renderizado y Sanitizado de la Página */}
        <div
          className="prose prose-neutral dark:prose-invert max-w-none text-foreground leading-relaxed space-y-4 text-sm sm:text-base prose-headings:font-bold prose-a:text-primary hover:prose-a:underline"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(page.contentHtml) }}
        />
      </article>
    </div>
  );
}
