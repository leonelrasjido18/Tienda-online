'use client';

import { useCallback } from 'react';

import { apiFetch } from './api';
import { useAuth } from './auth-context';

/** apiFetch con el access token de la sesión adjunto como Authorization: Bearer. */
export function useApi() {
  const { accessToken } = useAuth();

  return useCallback(
    <T,>(path: string, options: RequestInit = {}) =>
      apiFetch<T>(path, {
        ...options,
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...options.headers,
        },
      }),
    [accessToken],
  );
}
