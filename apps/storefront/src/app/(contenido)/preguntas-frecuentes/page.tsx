import DOMPurify from 'isomorphic-dompurify';

export const metadata = {
  title: 'Preguntas Frecuentes (FAQ)',
  description: 'Respuestas a todas las preguntas frecuentes sobre encargos, envíos, medios de pago y personalización.',
};

interface FAQ {
  id: string;
  question: string;
  answerHtml: string;
  category: string;
  isActive: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  envios: 'Envíos y Entregas',
  pagos: 'Pagos y Señales',
  talles: 'Talles y Personalización',
};

async function fetchFaqs(): Promise<FAQ[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  try {
    const res = await fetch(`${apiUrl}/faqs`, { cache: 'no-store' });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error('Error fetching FAQs:', err);
    return [];
  }
}

export default async function PreguntasFrecuentesPage() {
  const faqs = await fetchFaqs();
  const categories = Array.from(new Set(faqs.map((f) => f.category)));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Preguntas Frecuentes</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Encontrá respuestas rápidas sobre cómo comprar, señas, envíos y talles.
        </p>
      </div>

      <div className="space-y-8">
        {categories.length > 0 ? (
          categories.map((cat) => (
            <div key={cat} className="space-y-4">
              <h2 className="text-xl font-bold text-foreground border-b border-border pb-2">
                {CATEGORY_LABELS[cat] || cat}
              </h2>
              <div className="space-y-3">
                {faqs
                  .filter((f) => f.category === cat)
                  .map((faq) => (
                    <details
                      key={faq.id}
                      name={`faq-${cat}`}
                      className="group rounded-xl border border-border bg-card p-4 transition-all duration-300 [&[open]]:bg-muted/30 [&[open]]:shadow-sm"
                    >
                      <summary className="flex cursor-pointer items-center justify-between text-base font-semibold text-foreground list-none select-none">
                        <span>{faq.question}</span>
                        <span className="ml-2 text-muted-foreground transition-transform duration-300 group-open:rotate-180">
                          ↓
                        </span>
                      </summary>
                      <div
                        className="mt-3 text-sm leading-relaxed text-muted-foreground prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(faq.answerHtml) }}
                      />
                    </details>
                  ))}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground italic text-center py-8">
            No hay preguntas frecuentes registradas todavía.
          </p>
        )}
      </div>
    </div>
  );
}
