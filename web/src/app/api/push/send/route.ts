import { NextResponse } from "next/server";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

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

interface PushSendRequestBody {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  targetRoles?: ("MASTER" | "FINANCEIRO" | "GESTOR" | "SOLICITANTE")[];
  targetUserIds?: string[];
  excludeUserId?: string;
}

export async function POST(req: Request) {
  try {
    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json(
        { error: "Chaves VAPID não configuradas no servidor." },
        { status: 500 }
      );
    }

    const {
      title,
      body,
      url = "/kanban",
      tag = "payment-alert",
      targetRoles,
      targetUserIds,
      excludeUserId,
    }: PushSendRequestBody = await req.json();

    if (!title || !body) {
      return NextResponse.json(
        { error: "Campos 'title' e 'body' são obrigatórios." },
        { status: 400 }
      );
    }

    // 1. Determinar lista de IDs de usuários alvo
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
      // Padrão: Notificar MASTER e FINANCEIRO
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .in("role", ["MASTER", "FINANCEIRO"]);

      if (profiles) {
        allowedUserIds = profiles.map((p) => p.id);
      }
    }

    // Remover excludeUserId se fornecido (ex: quem criou a solicitação não precisa receber push de si mesmo)
    if (excludeUserId) {
      allowedUserIds = allowedUserIds.filter((id) => id !== excludeUserId);
    }

    if (allowedUserIds.length === 0) {
      return NextResponse.json({
        success: true,
        sentCount: 0,
        message: "Nenhum usuário alvo encontrado.",
      });
    }

    // 2. Buscar inscrições ativas no banco para esses usuários
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, user_id")
      .in("user_id", allowedUserIds);

    if (subError || !subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        sentCount: 0,
        message: "Nenhuma inscrição ativa de notificação encontrada.",
      });
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

    // 3. Enviar as notificações em paralelo
    const sendPromises = subscriptions.map(async (sub) => {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushConfig, payload, {
          TTL: 86400, // 24 horas de validade no gateway push
          urgency: "high",
        });
        sentCount++;
      } catch (err: any) {
        // Se o endpoint não existe mais (410 Gone ou 404 Not Found), marca para limpeza
        if (err.statusCode === 410 || err.statusCode === 404) {
          expiredEndpoints.push(sub.endpoint);
        } else {
          console.warn("Falha ao enviar push para endpoint:", err.message);
        }
      }
    });

    await Promise.all(sendPromises);

    // 4. Limpar subscrições expiradas
    if (expiredEndpoints.length > 0) {
      await supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints);
    }

    return NextResponse.json({
      success: true,
      sentCount,
      totalSubscriptions: subscriptions.length,
    });
  } catch (err: any) {
    console.error("Erro na rota /api/push/send:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
