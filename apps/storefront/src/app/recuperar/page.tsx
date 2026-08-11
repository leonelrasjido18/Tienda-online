'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, KeyRound, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button, Input, Label, Card, CardContent, Turnstile } from '@tienda/ui';
import { clientFetch } from '@/lib/client-api';

type Step = 'request' | 'reset' | 'done';

export default function RecoverPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setError(null);
    setIsLoading(true);
    try {
      await clientFetch('/customers/auth/request-reset', {
        method: 'POST',
        headers: { 'x-turnstile-token': turnstileToken || '' },
        body: JSON.stringify({ email }),
      });
      // La respuesta es siempre exitosa (no revela si el email existe).
      setStep('reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos procesar el pedido. Intentá de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !newPassword) return;
    setError(null);
    setIsLoading(true);
    try {
      await clientFetch('/customers/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, code, newPassword }),
      });
      setStep('done');
      setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido o vencido.');
    } finally {
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
              {step === 'done' ? <CheckCircle2 className="h-7 w-7" /> : <KeyRound className="h-7 w-7" />}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {step === 'done' ? '¡Listo!' : 'Recuperar contraseña'}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xs">
              {step === 'request' && 'Ingresá tu email y, si tenés cuenta, te enviaremos un código para restablecerla.'}
              {step === 'reset' && `Ingresá el código que enviamos a ${email} y tu nueva contraseña.`}
              {step === 'done' && 'Tu contraseña se cambió. Te llevamos al ingreso…'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center font-medium animate-shake">
              {error}
            </div>
          )}

          {step === 'request' && (
            <form onSubmit={handleRequest} className="space-y-5">
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
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Enviando…
                  </>
                ) : (
                  <>
                    Enviar código <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={handleReset} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="code" className="text-sm font-semibold tracking-wide text-center block">
                  Código (6 dígitos)
                </Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  required
                  disabled={isLoading}
                  className="h-12 text-center text-2xl font-bold tracking-[8px] bg-background/50 border-muted-foreground/20 focus:border-primary/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-sm font-semibold tracking-wide">
                  Nueva contraseña
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Al menos 8 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={isLoading}
                  className="h-11 bg-background/50 border-muted-foreground/20 focus:border-primary/50"
                />
              </div>

              <Button type="submit" disabled={isLoading || code.length !== 6 || newPassword.length < 8} className="w-full h-11 text-base font-semibold">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cambiando…
                  </>
                ) : (
                  'Cambiar contraseña'
                )}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Volver al ingreso
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
