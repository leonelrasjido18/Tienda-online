import { Button } from '@tienda/ui';

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">La tienda está en construcción</h1>
      <p className="max-w-md text-muted-foreground">
        Muy pronto vas a poder ver y comprar acá las camisetas y pantalones.
      </p>
      <Button disabled>Próximamente</Button>
    </main>
  );
}
