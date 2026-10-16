export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { authorize } from "@/lib/nubankBalance";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { v4 as uuidv4 } from "uuid";
import { sendPushNotification } from "@/lib/pushNotifications";

const RECHARGE_PIX_OWNER = "Lima e Trindade";
const RECHARGE_CNPJ = "CNPJ 2";
const RECHARGE_AMOUNT = 1500.00;

export async function POST() {
  try {
    const auth = await authorize(["MASTER", "FINANCEIRO"]);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    // Identificar o nome do solicitante
    let requesterName = "Solicitante";
    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", auth.userId)
      .maybeSingle();

    if (profile?.name) {
      requesterName = profile.name;
    }

    // Due date (D+3 úteis)
    const d = new Date();
    let added = 0;
    while (added < 3) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) added++;
    }

    const splitId = uuidv4();
    const cardData = {
      title: "Recarga Nubank",
      notes: "Recarga de Saldo Nubank",
      amount: RECHARGE_AMOUNT,
      category: "Recarga de Saldo",
      cnpj: RECHARGE_CNPJ,
      payment_method: "PIX",
      payment_type: "PIX",
      pix_name: RECHARGE_PIX_OWNER,
      pix_key: "",
      status: "NOVA_SOLICITACAO",
      stage_history: [
        {
          stage: "NOVA_SOLICITACAO",
          entered_at: new Date().toISOString(),
          left_at: null,
          duration_seconds: null,
          moved_by: auth.userId,
        },
      ],
      created_by: auth.userId,
      real_requester_id: auth.userId,
      due_date: d.toISOString(),
      request_kind: "RECARGA_NUBANK",
      balance_processed: false,
      splits: [
        {
          id: splitId,
          payment_type: "PIX",
          amount: RECHARGE_AMOUNT,
          pix_owner: RECHARGE_PIX_OWNER,
          pix_key: "",
          caju_phone: null,
          boleto_barcode: null,
          boleto_due_date: null,
          boleto_notes: null,
        },
      ],
    };

    const { data: inserted, error: insertError } = await supabase
      .from("payment_requests")
      .insert([cardData])
      .select()
      .single();

    if (insertError) {
      console.error("[API request-recharge] Erro ao inserir card:", insertError);
      return NextResponse.json({ error: "Falha ao criar solicitação no Kanban." }, { status: 500 });
    }

    // Disparar Push Notification
    sendPushNotification({
      title: "Nova Solicitação de Recarga Nubank!",
      body: `Recarga Nubank - R$ 1.500,00 por ${requesterName}`,
      url: "/kanban",
      targetRoles: ["MASTER", "FINANCEIRO"],
      excludeUserId: auth.userId,
    }).catch((e) => console.warn("Falha no push de recarga:", e));

    // Formatar e-mail padronizado para Tássio
    const currentHour = new Date().getHours();
    const greeting = currentHour < 12 ? "Bom dia" : "Boa tarde";
    const subject = `Pagamento Ref. Recarga Nubank | ${RECHARGE_CNPJ}`;
    const body = `--\n${greeting}, Tassio!\n\nSolicito por meio deste o pagamento:\n\nMotivo: Recarga saldo Nubank\nValor: R$ 1.500,00\nChave pix / Linha digitável:\nTitular: ${RECHARGE_PIX_OWNER}\nSolicitante: ${requesterName}`;

    return NextResponse.json({
      ok: true,
      card: inserted,
      email: {
        to: "tassiolimacs@gmail.com",
        subject,
        body,
        encodedSubject: encodeURIComponent(subject),
        encodedBody: encodeURIComponent(body),
      },
    });
  } catch (err: any) {
    console.error("[API request-recharge POST]", err);
    return NextResponse.json({ error: err?.message || "Erro inesperado." }, { status: 500 });
  }
}
