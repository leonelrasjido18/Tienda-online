import Link from 'next/link';
import { HOW_IT_WORKS_CONTENT } from '@/content/how-it-works';
import { buttonVariants, Card, CardContent } from '@tienda/ui';

export const metadata = {
  title: 'Cómo Funciona la Seña y el Encargo',
  description: 'Conocé el proceso paso a paso de encargo y seña del 50% para importar tu camiseta de fútbol.',
};

export default function ComoFuncionaPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{HOW_IT_WORKS_CONTENT.title}</h1>
        <p className="mt-2 text-base text-muted-foreground">{HOW_IT_WORKS_CONTENT.subtitle}</p>
      </div>

      <div className="space-y-6">
        {HOW_IT_WORKS_CONTENT.steps.map((step) => (
          <Card key={step.step} className="overflow-hidden border border-border">
            <CardContent className="flex items-start gap-4 p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground font-bold text-lg">
                {step.step}
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="pt-6 text-center">
        <Link href="/productos" className={buttonVariants({ size: 'lg' })}>
          Ver camisetas disponibles
        </Link>
      </div>
    </div>
  );
}
