'use client';

import { Button } from '@tienda/ui';
import { useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth-context';
import { getPushSubscriptionState, subscribeToPush, unsubscribeFromPush } from '@/lib/push';

export function PushSubscribeButton() {
  const { accessToken } = useAuth();
  const [state, setState] = useState<'unsupported' | 'subscribed' | 'unsubscribed' | 'loading'>('loading');

  useEffect(() => {
    getPushSubscriptionState().then(setState);
  }, []);

  if (state === 'unsupported' || state === 'loading') {
    return null;
  }

  const handleClick = async () => {
    setState('loading');
    try {
      if (state === 'subscribed') {
        await unsubscribeFromPush(accessToken);
        setState('unsubscribed');
      } else {
        await subscribeToPush(accessToken);
        setState('subscribed');
      }
    } catch {
      setState(await getPushSubscriptionState());
    }
  };

  return (
    <Button variant="outline" size="sm" className="w-full" onClick={() => void handleClick()}>
      {state === 'subscribed' ? 'Notificaciones activadas' : 'Activar notificaciones'}
    </Button>
  );
}
