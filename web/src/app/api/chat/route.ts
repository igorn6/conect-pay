export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { streamText, convertToModelMessages, isStepCount, type UIMessage } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { buildSystemPrompt, createFinancialReportTool, getSolzinhoUser } from "@/lib/solzinho";

// Gemini 1.5 Pro foi descontinuado e os modelos Pro atuais exigem plano pago nesta chave.
// gemini-3.5-flash-lite possui cota gratuita de 1.500 req/dia (vs 20 req/dia do 3.5-flash),
// ultra-baixa latência e suporte nativo a function calling.
const MODEL_ID = process.env.SOLZINHO_MODEL || "gemini-3.5-flash-lite";
const MAX_MESSAGES = 30;

export async function POST(req: Request) {
  const user = await getSolzinhoUser(req);
  if (!user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  // O acesso ao Gemini é estritamente server-side. Aceita ambas as variáveis de ambiente.
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Chave da API do Gemini não configurada no servidor." }, { status: 500 });
  }

  let messages: UIMessage[];
  try {
    const body = await req.json();
    if (!Array.isArray(body?.messages) || body.messages.length === 0) {
      return Response.json({ error: "Nenhuma mensagem enviada." }, { status: 400 });
    }
    // Stateless: só o histórico enviado pelo cliente é usado; limitamos o tamanho do contexto.
    messages = body.messages.slice(-MAX_MESSAGES);
  } catch {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const google = createGoogleGenerativeAI({ apiKey });

  const result = streamText({
    model: google(MODEL_ID),
    system: buildSystemPrompt(user),
    messages: await convertToModelMessages(messages),
    tools: { buscar_relatorio_financeiro: createFinancialReportTool(user) },
    stopWhen: isStepCount(5),
    onError: ({ error }) => {
      console.error("[Super Solzinho] erro no streamText:", error);
    },
  });

  return result.toUIMessageStreamResponse({
    onError: () => "O Super Solzinho teve um probleminha para responder agora. Tente novamente em instantes.",
  });
}
