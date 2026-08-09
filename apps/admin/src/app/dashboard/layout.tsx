'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { AdminShell } from '@/components/admin-shell';
import { useAuth } from '@/lib/auth-context';

export default function DashboardLayout({ children }: LayoutProps<'/dashboard'>) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Cargando…
      </div>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
