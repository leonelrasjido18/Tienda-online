'use client';

import { Button } from '@tienda/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { useAuth } from '@/lib/auth-context';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Inicio' },
  { href: '/dashboard/productos', label: 'Productos' },
  { href: '/dashboard/ligas', label: 'Ligas' },
  { href: '/dashboard/equipos', label: 'Equipos' },
  { href: '/dashboard/temporadas', label: 'Temporadas' },
  { href: '/dashboard/marcas', label: 'Marcas' },
  { href: '/dashboard/categorias', label: 'Categorías' },
  { href: '/dashboard/tipografias', label: 'Tipografías' },
  { href: '/dashboard/parches', label: 'Parches' },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-background">
        <div className="border-b border-border px-4 py-4">
          <p className="text-sm font-semibold">Panel de la tienda</p>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {NAV_LINKS.map((link) => {
            const active = link.href === '/dashboard' ? pathname === link.href : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  'block rounded-md px-3 py-2 text-sm ' +
                  (active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent')
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          <Button variant="ghost" size="sm" className="mt-2 w-full justify-start px-0" onClick={() => void logout()}>
            Cerrar sesión
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden bg-muted/30 p-6">{children}</main>
    </div>
  );
}
