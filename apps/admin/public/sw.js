self.addEventListener('push', (event) => {
  if (!event.data) return;

  const payload = event.data.json();
  const url = payload.url ?? '/dashboard';

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: '/icon',
        data: { url },
      });

      // Si el panel esta abierto, ademas del aviso del sistema se le manda el
      // dato para que muestre el cartel adentro de la pantalla, sin esperar al
      // sondeo.
      const clientes = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const cliente of clientes) {
        cliente.postMessage({
          tipo: 'pedido-nuevo',
          titulo: payload.title,
          cuerpo: payload.body,
          url,
          orderId: payload.orderId,
        });
      }
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
