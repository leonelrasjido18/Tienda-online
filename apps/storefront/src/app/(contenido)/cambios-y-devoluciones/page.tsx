import { RETURNS_POLICY } from '@/content/returns-policy';
import { Card, CardContent } from '@tienda/ui';

export const metadata = {
  title: 'Políticas de Cambios y Devoluciones',
  description: 'Conocé nuestras políticas de cambio de talle, devoluciones y garantía por fallas de fábrica.',
};

export default function CambiosYDevolucionesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{RETURNS_POLICY.title}</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Transparencia y claridad sobre cómo gestionamos cambios y devoluciones.
        </p>
      </div>

      <div className="space-y-6">
        {RETURNS_POLICY.sections.map((section, idx) => (
          <Card key={idx} className="border border-border">
            <CardContent className="p-6">
              <h2 className="text-lg font-bold text-foreground">{section.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                {section.content}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
