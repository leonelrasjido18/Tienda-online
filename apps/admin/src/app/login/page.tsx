'use client';

import { Button, Input, Label, Turnstile } from '@tienda/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const { login, status } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [status, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password, turnstileToken || undefined);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-background p-6 shadow-sm"
      >
        <div className="space-y-1 text-center">
          <h1 className="text-lg font-semibold">Panel de administración</h1>
          <p className="text-sm text-muted-foreground">Ingresá con tu cuenta de staff</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Turnstile
          onSuccess={setTurnstileToken}
          onExpire={() => setTurnstileToken(null)}
          onError={() => setTurnstileToken(null)}
          className="flex justify-center"
        />

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Ingresando…' : 'Ingresar'}
        </Button>
      </form>
    </div>
  );
}
