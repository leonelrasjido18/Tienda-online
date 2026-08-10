import { SHIPPING_POLICY } from '@/content/shipping-policy';
import { Card, CardContent } from '@tienda/ui';

export const metadata = {
  title: 'Información de Envíos y Entregas',
  description: 'Detalles sobre envíos a todo el país, retiro en local y código de seguimiento.',
};

export default function EnviosPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{SHIPPING_POLICY.title}</h1>
        <p className="mt-2 text-base text-muted-foreground">{SHIPPING_POLICY.intro}</p>
      </div>

      <div className="space-y-6">
        {SHIPPING_POLICY.sections.map((sec, idx) => (
          <Card key={idx} className="border border-border">
            <CardContent className="p-6">
              <h2 className="text-lg font-bold text-foreground">{sec.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{sec.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
