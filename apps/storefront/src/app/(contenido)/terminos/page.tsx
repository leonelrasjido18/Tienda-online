import { TERMS_AND_CONDITIONS } from '@/content/terms';
import { Card, CardContent } from '@tienda/ui';

export const metadata = {
  title: 'Términos y Condiciones de Venta',
  description: 'Términos y condiciones legales, política de señas y derecho de revocación según Ley N° 24.240.',
};

export default function TerminosPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Términos y Condiciones</h1>
        <p className="mt-2 text-xs text-muted-foreground">Última actualización: {TERMS_AND_CONDITIONS.lastUpdated}</p>
      </div>

      <div className="space-y-6">
        {TERMS_AND_CONDITIONS.sections.map((sec, idx) => (
          <Card key={idx} className="border border-border">
            <CardContent className="p-6">
              <h2 className="text-base font-bold text-foreground">{sec.title}</h2>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground whitespace-pre-line">{sec.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
