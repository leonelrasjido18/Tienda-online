'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, MailCheck, Loader2, CheckCircle2, RotateCcw } from 'lucide-react';
import { Button, Input, Label, Card, CardContent, Turnstile } from '@tienda/ui';
import { clientFetch } from '@/lib/client-api';

type Step = 'verify' | 'done';

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>('verify');
  // El mail llega por la query desde el enlace del correo. Si alguien entra a
  // /verificar a mano, el campo arranca vacío y lo completa.
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El reenvío se muestra recién cuando lo piden: es la acción que manda un
  // mail, así que no conviene tenerla a un clic de distancia por accidente.
  const [showResend, setShowResend] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || code.length !== 6) return;
    setError(null);
    setIsLoading(true);
    try {
      await clientFetch('/customers/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });
      setStep('done');
      setTimeout(() => {
        router.push('/mi-cuenta');
        router.refresh();
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido o vencido.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email || !turnstileToken) return;
    setError(null);
    setIsResending(true);
    try {
      await clientFetch('/customers/auth/resend-verification', {
        method: 'POST',
        headers: { 'x-turnstile-token': turnstileToken },
        body: JSON.stringify({ email }),
      });
      // La respuesta es siempre exitosa (no revela si el email tiene cuenta).
      setResendDone(true);
      setShowResend(false);
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos reenviar el código. Probá en unos minutos.');
    } finally {
      setIsResending(false);
      setTurnstileToken(null);
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
              {step === 'done' ? <CheckCircle2 className="h-7 w-7" /> : <MailCheck className="h-7 w-7" />}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {step === 'done' ? '¡Email verificado!' : 'Verificá tu email'}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xs">
              {step === 'verify'
                ? 'Te enviamos un código de 6 dígitos. Ingresalo para activar tu cuenta.'
                : 'Tu cuenta quedó activada. Te llevamos a tu perfil…'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center font-medium animate-shake">
              {error}
            </div>
          )}

          {resendDone && step === 'verify' && (
            <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm text-center font-medium">
              Listo. Si esa dirección tiene una cuenta sin verificar, le mandamos un código nuevo.
            </div>
          )}

          {step === 'verify' && (
            <form onSubmit={handleVerify} className="space-y-5">
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
                <Label htmlFor="code" className="text-sm font-semibold tracking-wide text-center block">
                  Código (6 dígitos)
                </Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  required
                  disabled={isLoading}
                  className="h-12 text-center text-2xl font-bold tracking-[8px] bg-background/50 border-muted-foreground/20 focus:border-primary/50"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading || !email || code.length !== 6}
                className="w-full h-11 text-base font-semibold"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Verificando…
                  </>
                ) : (
                  'Verificar email'
                )}
              </Button>
            </form>
          )}

          {step === 'verify' && (
            <div className="mt-6 pt-6 border-t border-border/40">
              {!showResend ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowResend(true);
                    setResendDone(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  ¿No te llegó el código? Reenviar
                </button>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Te reenviamos el código a <span className="font-semibold text-foreground">{email || 'tu email'}</span>.
                  </p>
                  <div className="flex justify-center min-h-[65px]">
                    <Turnstile
                      onSuccess={setTurnstileToken}
                      onError={() => setTurnstileToken(null)}
                      onExpire={() => setTurnstileToken(null)}
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowResend(false);
                        setTurnstileToken(null);
                      }}
                      className="flex-1 h-10"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      onClick={handleResend}
                      disabled={isResending || !email || !turnstileToken}
                      className="flex-1 h-10"
                    >
                      {isResending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reenviar'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/mi-cuenta" className="font-semibold text-primary hover:underline">
              Verificar más tarde
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <VerifyEmailForm />
    </Suspense>
  );
}
