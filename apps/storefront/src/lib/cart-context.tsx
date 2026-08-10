'use client';

import type { AddCartItemInput, CartDto } from '@tienda/shared';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { clientFetch } from './client-api';

interface CartContextValue {
  cart: CartDto | null;
  isLoading: boolean;
  addItem: (input: AddCartItemInput) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await clientFetch<CartDto>('/cart');
    setCart(data);
  }, []);

  useEffect(() => {
    let cancelled = false;

    clientFetch<CartDto>('/cart')
      .then((data) => {
        if (!cancelled) setCart(data);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const addItem = useCallback(async (input: AddCartItemInput) => {
    const data = await clientFetch<CartDto>('/cart/items', { method: 'POST', body: JSON.stringify(input) });
    setCart(data);
  }, []);

  const updateItem = useCallback(async (itemId: string, quantity: number) => {
    const data = await clientFetch<CartDto>(`/cart/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    });
    setCart(data);
  }, []);

  const removeItem = useCallback(async (itemId: string) => {
    const data = await clientFetch<CartDto>(`/cart/items/${itemId}`, { method: 'DELETE' });
    setCart(data);
  }, []);

  return (
    <CartContext.Provider value={{ cart, isLoading, addItem, updateItem, removeItem, refresh }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart debe usarse dentro de <CartProvider>');
  }
  return ctx;
}
