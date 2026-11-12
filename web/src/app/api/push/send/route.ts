import { NextResponse } from "next/server";
import { authorize } from "@/lib/nubankBalance";
import {
  dispatchPushNotifications,
  isVapidConfigured,
  type PushDispatchPayload,
} from "@/lib/pushServer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const auth = await authorize(["MASTER", "FINANCEIRO", "GESTOR"], req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (!isVapidConfigured()) {
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
    }: PushDispatchPayload = await req.json();

    if (!title || !body) {
      return NextResponse.json(
        { error: "Campos 'title' e 'body' são obrigatórios." },
        { status: 400 }
      );
    }

    const result = await dispatchPushNotifications({
      title,
      body,
      url,
      tag,
      targetRoles,
      targetUserIds,
      excludeUserId: auth.userId,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Erro na rota /api/push/send:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
