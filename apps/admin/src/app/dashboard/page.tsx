'use client';

import { useAuth } from '@/lib/auth-context';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold">Hola, {user?.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {user?.email} · {user?.role === 'OWNER' ? 'Dueña' : 'Staff'}
      </p>
      <p className="mt-6 text-sm text-muted-foreground">
        Usá el menú de la izquierda para cargar productos, ligas, equipos, temporadas, marcas y categorías.
      </p>
    </div>
  );
}
