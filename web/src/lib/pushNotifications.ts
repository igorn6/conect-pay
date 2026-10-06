// Utilitário para gerenciamento de Web Push Notifications no Frontend

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    return registration;
  } catch (error) {
    console.error("Falha ao registrar Service Worker:", error);
    return null;
  }
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  const registration = await navigator.serviceWorker.ready;
  return await registration.pushManager.getSubscription();
}

export async function subscribeToPush(userId: string): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    alert("Seu navegador não suporta notificações Web Push nativas.");
    return false;
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    console.error("NEXT_PUBLIC_VAPID_PUBLIC_KEY não configurada.");
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      alert("A permissão para notificações foi negada no navegador.");
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });
    }

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        userId,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao salvar subscrição");
    }

    return true;
  } catch (err: any) {
    console.error("Erro ao ativar Web Push:", err);
    throw err;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`, {
        method: "DELETE",
      });
    }

    return true;
  } catch (err) {
    console.error("Erro ao desinscrever:", err);
    return false;
  }
}

export async function sendPushNotification({
  title,
  body,
  url = "/kanban",
  targetRoles = ["MASTER", "FINANCEIRO"],
  excludeUserId,
}: {
  title: string;
  body: string;
  url?: string;
  targetRoles?: ("MASTER" | "FINANCEIRO" | "GESTOR" | "SOLICITANTE")[];
  excludeUserId?: string;
}) {
  try {
    const res = await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        body,
        url,
        targetRoles,
        excludeUserId,
      }),
    });
    return await res.json();
  } catch (err) {
    console.warn("Erro ao disparar push:", err);
    return null;
  }
}
