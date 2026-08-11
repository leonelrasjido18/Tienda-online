'use client';

import { Button } from '@tienda/ui';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { useAuth } from '@/lib/auth-context';
import { PushSubscribeButton } from './push-subscribe-button';

interface NavItem {
  href: string;
  label: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

type NavEntry = NavItem | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return 'items' in entry;
}

// Se agrupan las taxonomías del catálogo y el contenido para que la barra no sea
// una lista interminable. Lo del día a día (inicio, pedidos, lotes) queda arriba.
const NAV: NavEntry[] = [
  { href: '/dashboard', label: 'Inicio' },
  { href: '/dashboard/pedidos', label: 'Pedidos' },
  { href: '/dashboard/lotes', label: 'Lotes' },
  {
    label: 'Catálogo',
    items: [
      { href: '/dashboard/productos', label: 'Productos' },
      { href: '/dashboard/ligas', label: 'Ligas' },
      { href: '/dashboard/equipos', label: 'Equipos' },
      { href: '/dashboard/temporadas', label: 'Temporadas' },
      { href: '/dashboard/marcas', label: 'Marcas' },
      { href: '/dashboard/categorias', label: 'Categorías' },
      { href: '/dashboard/colecciones', label: 'Colecciones' },
      { href: '/dashboard/tipografias', label: 'Tipografías' },
      { href: '/dashboard/parches', label: 'Parches' },
    ],
  },
  {
    label: 'Contenido',
    items: [
      { href: '/dashboard/preguntas', label: 'FAQs' },
      { href: '/dashboard/resenas', label: 'Reseñas' },
    ],
  },
  { href: '/dashboard/cupones', label: 'Cupones' },
  { href: '/dashboard/envios', label: 'Envíos' },
  { href: '/dashboard/ajustes', label: 'Ajustes' },
];

function itemClasses(active: boolean): string {
  return (
    'block rounded-md px-3 py-2 text-sm ' +
    (active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent')
  );
}

function NavGroupSection({ group, pathname }: { group: NavGroup; pathname: string }) {
  const hasActive = group.items.some((item) => pathname.startsWith(item.href));
  const [open, setOpen] = useState(hasActive);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        {group.label}
        <ChevronDown className={'h-4 w-4 transition-transform ' + (open ? '' : '-rotate-90')} />
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5 pl-2">
          {group.items.map((item) => (
            <Link key={item.href} href={item.href} className={itemClasses(pathname.startsWith(item.href))}>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  return (
    // Altura fija de pantalla + overflow oculto: la barra lateral queda fija y sólo
    // el contenido principal hace scroll. Así el pie (email, notificaciones, salir)
    // está siempre visible, haya o no scroll.
    <div className="flex h-screen overflow-hidden">
      <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-border bg-background">
        <div className="border-b border-border px-4 py-4">
          <p className="text-sm font-semibold">Panel de la tienda</p>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {NAV.map((entry) => {
            if (isGroup(entry)) {
              return <NavGroupSection key={entry.label} group={entry} pathname={pathname} />;
            }
            const active = entry.href === '/dashboard' ? pathname === entry.href : pathname.startsWith(entry.href);
            return (
              <Link key={entry.href} href={entry.href} className={itemClasses(active)}>
                {entry.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-2 border-t border-border p-3">
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          <PushSubscribeButton />
          <Button variant="ghost" size="sm" className="w-full justify-start px-0" onClick={() => void logout()}>
            Cerrar sesión
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-muted/30 p-6">{children}</main>
    </div>
  );
}
