// Service Worker para Conect Pay - Notificações Web Push em segundo plano

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {
    title: "Conect Pay",
    body: "Nova solicitação de pagamento recebida!",
    icon: "/logo-dark.png",
    url: "/kanban",
    tag: "conectpay-notification",
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = { ...data, ...payload };
    }
  } catch (err) {
    console.error("Erro ao decodificar payload push:", err);
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || "/logo-dark.png",
    badge: "/logo-dark.png",
    vibrate: [200, 100, 200, 100, 200],
    tag: data.tag || "payment-alert",
    renotify: true,
    requireInteraction: true, // Mantém a notificação na tela até o usuário interagir
    data: {
      url: data.url || "/kanban",
      dateOfArrival: Date.now(),
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Conect Pay", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/kanban";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client && client.url.includes(self.location.origin)) {
          if ("navigate" in client && !client.url.includes(targetUrl)) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
