import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export default function ContenidoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground transition-colors">
          Inicio
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="font-medium text-foreground">Información</span>
      </nav>
      {children}
    </div>
  );
}
