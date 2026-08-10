import { SIZE_GUIDES } from '@/content/size-guides';
import { Card, CardContent } from '@tienda/ui';
import { Ruler } from 'lucide-react';

export const metadata = {
  title: 'Tabla de Medidas y Guía de Talles',
  description: 'Guía de talles de camisetas de fútbol versión Fan y versión Jugador expresadas en centímetros.',
};

export default function GuiaDeTallesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Guía de Talles y Medidas</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Te recomendamos medir una camiseta de tu uso cotidiano extendida sobre una mesa y comparar largo × ancho.
        </p>
      </div>

      <div className="space-y-8">
        {Object.entries(SIZE_GUIDES).map(([key, guide]) => (
          <Card key={key} className="border border-border">
            <CardContent className="p-6">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Ruler className="h-5 w-5 text-accent" /> {guide.title}
              </h2>
              <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted text-muted-foreground font-semibold">
                    <tr>
                      <th className="p-3">Talle</th>
                      <th className="p-3">Ancho de axila a axila (cm)</th>
                      <th className="p-3">Largo de hombro a cintura (cm)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-foreground">
                    {guide.rows.map((row) => (
                      <tr key={row.size}>
                        <td className="p-3 font-bold">{row.size}</td>
                        <td className="p-3">{row.chestCm} cm</td>
                        <td className="p-3">{row.lengthCm} cm</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
