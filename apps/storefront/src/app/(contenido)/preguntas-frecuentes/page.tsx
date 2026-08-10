import { FAQS } from '@/content/faq';

export const metadata = {
  title: 'Preguntas Frecuentes (FAQ)',
  description: 'Respuestas a todas las preguntas frecuentes sobre encargos, envíos, medios de pago y personalización.',
};

export default function PreguntasFrecuentesPage() {
  const categories = Array.from(new Set(FAQS.map((f) => f.category)));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Preguntas Frecuentes</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Encontrá respuestas rápidas sobre cómo comprar, señas, envíos y talles.
        </p>
      </div>

      <div className="space-y-8">
        {categories.map((cat) => (
          <div key={cat} className="space-y-4">
            <h2 className="text-xl font-bold text-foreground border-b border-border pb-2">{cat}</h2>
            <div className="space-y-3">
              {FAQS.filter((f) => f.category === cat).map((faq, i) => (
                <details
                  key={i}
                  name={`faq-${cat}`}
                  className="group rounded-lg border border-border bg-card p-4 transition-colors [&[open]]:bg-muted/30"
                >
                  <summary className="flex cursor-pointer items-center justify-between text-base font-semibold text-foreground list-none select-none">
                    <span>{faq.question}</span>
                    <span className="ml-2 text-muted-foreground transition-transform group-open:rotate-180">↓</span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
