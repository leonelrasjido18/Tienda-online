'use client';

import type { StaffUserDto } from '@tienda/shared';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { apiFetch } from './api';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: StaffUserDto | null;
  accessToken: string | null;
  status: AuthStatus;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string, turnstileToken?: string) => Promise<void>;
  logout: () => Promise<void>;
}

interface LoginResponse {
  accessToken: string;
  user: StaffUserDto;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    status: 'loading',
  });

  // Al montar, intenta renovar la sesión con la cookie httpOnly de refresh.
  // Si no hay una válida, queda "unauthenticated" y el layout protegido redirige a /login.
  useEffect(() => {
    let cancelled = false;

    apiFetch<LoginResponse>('/auth/refresh', { method: 'POST' })
      .then((res) => {
        if (!cancelled) {
          setState({ user: res.user, accessToken: res.accessToken, status: 'authenticated' });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ user: null, accessToken: null, status: 'unauthenticated' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string, turnstileToken?: string) => {
    const res = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      headers: turnstileToken ? { 'x-turnstile-token': turnstileToken } : undefined,
      body: JSON.stringify({ email, password }),
    });
    setState({ user: res.user, accessToken: res.accessToken, status: 'authenticated' });
  }, []);

  const logout = useCallback(async () => {
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
    setState({ user: null, accessToken: null, status: 'unauthenticated' });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return ctx;
}
