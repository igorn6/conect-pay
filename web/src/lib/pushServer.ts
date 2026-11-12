import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:suporte@conectsol.com";

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch (err) {
    console.error("Erro ao configurar VAPID details:", err);
  }
}

export interface PushDispatchPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  targetRoles?: ("MASTER" | "FINANCEIRO" | "GESTOR" | "SOLICITANTE")[];
  targetUserIds?: string[];
  excludeUserId?: string;
}

export function isVapidConfigured(): boolean {
  return Boolean(vapidPublicKey && vapidPrivateKey);
}

/**
 * Envia Web Push server-side usando supabaseAdmin para os usuários alvo.
 */
export async function dispatchPushNotifications({
  title,
  body,
  url = "/kanban",
  tag = "payment-alert",
  targetRoles,
  targetUserIds,
  excludeUserId,
}: PushDispatchPayload) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error("Chaves VAPID não configuradas no servidor.");
  }

  let allowedUserIds: string[] = [];

  if (targetUserIds && targetUserIds.length > 0) {
    allowedUserIds = targetUserIds;
  } else if (targetRoles && targetRoles.length > 0) {
    const { data: profiles, error: profError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .in("role", targetRoles);

    if (profError) {
      console.error("Erro ao buscar perfis por role:", profError);
    } else if (profiles) {
      allowedUserIds = profiles.map((p) => p.id);
    }
  } else {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .in("role", ["MASTER", "FINANCEIRO"]);

    if (profiles) {
      allowedUserIds = profiles.map((p) => p.id);
    }
  }

  if (excludeUserId) {
    allowedUserIds = allowedUserIds.filter((id) => id !== excludeUserId);
  }

  if (allowedUserIds.length === 0) {
    return { success: true, sentCount: 0, message: "Nenhum usuário alvo encontrado." };
  }

  const { data: subscriptions, error: subError } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, user_id")
    .in("user_id", allowedUserIds);

  if (subError || !subscriptions || subscriptions.length === 0) {
    return {
      success: true,
      sentCount: 0,
      message: "Nenhuma inscrição ativa de notificação encontrada.",
    };
  }

  const payload = JSON.stringify({
    title,
    body,
    url,
    tag,
    timestamp: Date.now(),
  });

  let sentCount = 0;
  const expiredEndpoints: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          { TTL: 86400, urgency: "high" }
        );
        sentCount++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          expiredEndpoints.push(sub.endpoint);
        } else {
          console.warn("Falha ao enviar push para endpoint:", err.message);
        }
      }
    })
  );

  if (expiredEndpoints.length > 0) {
    await supabaseAdmin
      .from("push_subscriptions")
      .delete()
      .in("endpoint", expiredEndpoints);
  }

  return {
    success: true,
    sentCount,
    totalSubscriptions: subscriptions.length,
  };
}

