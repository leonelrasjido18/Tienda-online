'use client';

import { useCallback } from 'react';

import { ApiError, apiFetch } from './api';
import { useAuth } from './auth-context';

/**
 * apiFetch con el access token de la sesión adjunto como Authorization: Bearer.
 * Si una petición devuelve 401 (el access token de vida corta venció), renueva el
 * token con la cookie de refresh y reintenta una vez, de forma transparente.
 */
export function useApi() {
  const { accessToken, refresh } = useAuth();

  return useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      const run = (token: string | null) =>
        apiFetch<T>(path, {
          ...options,
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
          },
        });

      try {
        return await run(accessToken);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          const fresh = await refresh();
          if (fresh) {
            return run(fresh);
          }
        }
        throw err;
      }
    },
    [accessToken, refresh],
  );
}
