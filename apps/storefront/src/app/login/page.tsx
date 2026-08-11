'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';
import { Button, Input, Label, Card, CardContent, Turnstile } from '@tienda/ui';
import { clientFetch } from '@/lib/client-api';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(searchParams.get('mode') === 'register' ? 'register' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo = searchParams.get('redirect') || '/mi-cuenta';

  // Guardar el código de referido en cookie si viene en la URL (para el registro).
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      document.cookie = `referral_code=${ref}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
    }
  }, [searchParams]);

  const getReferralCookie = () => {
    if (typeof document === 'undefined') return undefined;
    return document.cookie
      .split('; ')
      .find((row) => row.startsWith('referral_code='))
      ?.split('=')[1];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setError(null);
    setIsLoading(true);

    try {
      if (mode === 'register') {
        await clientFetch('/customers/auth/register', {
          method: 'POST',
          headers: { 'x-turnstile-token': turnstileToken || '' },
          body: JSON.stringify({
            email,
            password,
            name: name || undefined,
            referredByCode: getReferralCookie(),
          }),
        });
      } else {
        await clientFetch('/customers/auth/login', {
          method: 'POST',
          headers: { 'x-turnstile-token': turnstileToken || '' },
          body: JSON.stringify({ email, password }),
        });
      }
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : mode === 'register'
            ? 'No pudimos crear tu cuenta. Revisá los datos e intentá de nuevo.'
            : 'Email o contraseña incorrectos.',
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-[80vh] flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[500px] h-[500px] rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[500px] h-[500px] rounded-full bg-accent/10 blur-[100px]" />
      </div>

      <Card className="w-full max-w-md border-border/45 bg-card/60 backdrop-blur-xl shadow-2xl relative z-10">
        <CardContent className="pt-8 pb-10 px-6 sm:px-8">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="p-3 bg-primary/10 text-primary rounded-2xl mb-4">
              <Lock className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {mode === 'login' ? 'Ingresá a tu cuenta' : 'Creá tu cuenta'}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xs">
              {mode === 'login'
                ? 'Ingresá con tu email y contraseña para ver tus pedidos y saldos.'
                : 'Registrate para seguir tus pedidos, encargos y direcciones guardadas.'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center font-medium animate-shake">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'register' && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-semibold tracking-wide">
                  Nombre
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Tu nombre"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isLoading}
                    className="pl-9 h-11 bg-background/50 border-muted-foreground/20 focus:border-primary/50"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold tracking-wide">
                Correo electrónico
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="ejemplo@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pl-9 h-11 bg-background/50 border-muted-foreground/20 focus:border-primary/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold tracking-wide">
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder={mode === 'register' ? 'Al menos 8 caracteres' : 'Tu contraseña'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={mode === 'register' ? 8 : undefined}
                  disabled={isLoading}
                  className="pl-9 h-11 bg-background/50 border-muted-foreground/20 focus:border-primary/50"
                />
              </div>
              {mode === 'login' && (
                <div className="text-right">
                  <Link href="/recuperar" className="text-xs font-medium text-primary hover:underline">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
              )}
            </div>

            <div className="flex justify-center my-4 min-h-[65px]">
              <Turnstile
                onSuccess={setTurnstileToken}
                onError={() => setTurnstileToken(null)}
                onExpire={() => setTurnstileToken(null)}
              />
            </div>

            <Button type="submit" disabled={isLoading || !turnstileToken} className="w-full h-11 text-base font-semibold group">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {mode === 'register' ? 'Creando cuenta…' : 'Ingresando…'}
                </>
              ) : (
                <>
                  {mode === 'register' ? 'Crear cuenta' : 'Ingresar'}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === 'login' ? (
              <>
                ¿No tenés cuenta?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                  className="font-semibold text-primary hover:underline"
                >
                  Registrate
                </button>
              </>
            ) : (
              <>
                ¿Ya tenés cuenta?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className="font-semibold text-primary hover:underline"
                >
                  Ingresá
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
