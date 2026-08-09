'use client';

import { Button } from '@tienda/ui';

import { useAuth } from '@/lib/auth-context';

export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Hola, {user?.name}</h1>
          <p className="text-sm text-muted-foreground">
            {user?.email} · {user?.role === 'OWNER' ? 'Dueña' : 'Staff'}
          </p>
        </div>
        <Button variant="outline" onClick={() => void logout()}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
