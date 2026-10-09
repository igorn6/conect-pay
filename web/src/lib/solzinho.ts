import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { tool } from "ai";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type SolzinhoRole = "MASTER" | "FINANCEIRO" | "GESTOR";

export interface SolzinhoUser {
  id: string;
  name: string;
  role: SolzinhoRole;
}

const VALID_ROLES: SolzinhoRole[] = ["MASTER", "FINANCEIRO", "GESTOR"];

/**
 * Identifica o usuário autenticado da requisição (Bearer token ou cookies de sessão SSR)
 * e resolve sua role a partir da tabela `profiles`.
 *
 * Segurança: NÃO aceita identificação por header/param (x-user-id etc.) — qualquer cliente
 * poderia se passar por outro usuário. Role desconhecida cai para GESTOR (menor privilégio).
 */
export async function getSolzinhoUser(req: Request): Promise<SolzinhoUser | null> {
  let authUser: { id: string; email?: string | null; user_metadata?: Record<string, any> } | null = null;

  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const { data } = await supabaseAdmin.auth.getUser(token);
    if (data?.user) authUser = data.user;
  }

  if (!authUser) {
    try {
      const cookieStore = await cookies();
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll() {
              /* rota de leitura: não renova cookies aqui */
            },
          },
        }
      );
      const { data } = await supabase.auth.getUser();
      if (data?.user) authUser = data.user;
    } catch {
      /* sem sessão por cookie */
    }
  }

  if (!authUser) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("name, role")
    .eq("id", authUser.id)
    .maybeSingle();

  const rawRole = String(profile?.role || "").trim().toUpperCase() as SolzinhoRole;
  const role: SolzinhoRole = VALID_ROLES.includes(rawRole) ? rawRole : "GESTOR";

  const name =
    (profile?.name && profile.name.trim()) ||
    authUser.user_metadata?.name ||
    authUser.user_metadata?.full_name ||
    (authUser.email ? authUser.email.split("@")[0] : "Usuário");

  return { id: authUser.id, name, role };
}

const BASE_PROMPT =
  "Você é o Super Solzinho, o mascote oficial e Assistente de Inteligência da Conectsol. " +
  "Seu tom deve ser sempre prestativo, brilhante, educado e focado em iluminar as dúvidas do usuário. " +
  "Formate suas respostas usando tabelas, negritos e listas em Markdown para facilitar a leitura.";

const HIGH_MANAGEMENT_PROMPT =
  "O usuário é da alta gestão. Vá direto aos números e gargalos financeiros, mas mantenha a simpatia do mascote. " +
  "Se pedirem relatórios de gastos, VOCÊ DEVE OBRIGATORIAMENTE perguntar o período ou solicitante alvo " +
  "antes de acionar a ferramenta de busca.";

const MANAGER_PROMPT =
  "O usuário é um Solicitante/Gestor. Seja didático, explique como funcionam os processos " +
  "e mostre apenas os dados dele.";

const RULES_PROMPT =
  "Regras gerais: responda sempre em português do Brasil; valores em R$ no formato brasileiro; " +
  "nunca invente números — use somente o que a ferramenta buscar_relatorio_financeiro retornar; " +
  "se a ferramenta não trouxer dados, diga isso com clareza. Você não guarda memória entre conversas. " +
  "Só preencha o parâmetro 'requester' da ferramenta com um nome que o USUÁRIO tenha citado explicitamente; caso contrário, omita-o.";

export function buildSystemPrompt(user: SolzinhoUser): string {
  const roleBlock = user.role === "GESTOR" ? MANAGER_PROMPT : HIGH_MANAGEMENT_PROMPT;
  const today = new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  return [
    BASE_PROMPT,
    roleBlock,
    RULES_PROMPT,
    `Contexto: o usuário se chama ${user.name} (perfil ${user.role}). Hoje é ${today} (${todayIso}). ` +
      "Use essa data para converter expressões como 'este mês' ou 'semana passada' em datas YYYY-MM-DD. " +
      "Se o usuário pedir uma análise ou relatório 'geral', 'tudo', 'histórico todo' ou similar, assuma a data inicial como 2025-01-01 e a data final como a data de hoje.",
  ].join("\n\n");
}

const STATUS_LABEL: Record<string, string> = {
  NOVA_SOLICITACAO: "Nova solicitação",
  EM_APROVACAO: "Em aprovação",
  VALIDACAO_GESTOR: "Validação do gestor",
  VALIDADO_GESTOR: "Validado pelo gestor",
  CORRECAO_PENDENTE: "Correção pendente",
  AGUARDANDO_PAGAMENTO: "Pendente (aguardando pagamento)",
  FINALIZADO: "Finalizado (pago)",
  RECUSADO: "Recusado",
};

const MAX_ITEMS = 40;

function sumBy<T>(rows: T[], keyOf: (r: T) => string, amountOf: (r: T) => number) {
  const map = new Map<string, { total: number; quantidade: number }>();
  for (const r of rows) {
    const k = keyOf(r);
    const cur = map.get(k) || { total: 0, quantidade: 0 };
    cur.total += amountOf(r);
    cur.quantidade += 1;
    map.set(k, cur);
  }
  return [...map.entries()]
    .map(([nome, v]) => ({ nome, total: Math.round(v.total * 100) / 100, quantidade: v.quantidade }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Tool `buscar_relatorio_financeiro`.
 * O supabaseAdmin ignora RLS, então o escopo por role é aplicado AQUI no servidor
 * (o modelo nunca decide quem pode ver o quê):
 *  - GESTOR: sempre restrito às solicitações criadas por ele / em nome dele (`requester` é ignorado).
 *  - MASTER/FINANCEIRO: visão total, com filtro opcional por solicitante.
 */
export function createFinancialReportTool(user: SolzinhoUser) {
  return tool({
    description:
      "Busca e resume solicitações de pagamento (valores, status, categorias, solicitantes) em um período. " +
      "Só chame depois de saber o período (e o solicitante, se aplicável) com o usuário.",
    inputSchema: z.object({
      startDate: z.string().describe("Data inicial do período, formato YYYY-MM-DD"),
      endDate: z.string().describe("Data final do período (inclusiva), formato YYYY-MM-DD"),
      requester: z
        .string()
        .optional()
        .describe("Nome (ou parte do nome) do solicitante para filtrar. Omitir para todos."),
    }),
    execute: async ({ startDate, endDate, requester }) => {
      const dateRe = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRe.test(startDate) || !dateRe.test(endDate)) {
        return { erro: "Datas inválidas. Use o formato YYYY-MM-DD." };
      }
      if (startDate > endDate) {
        return { erro: "A data inicial não pode ser maior que a data final." };
      }

      let query = supabaseAdmin
        .from("payment_requests")
        .select("id, title, amount, status, category, created_at, due_date, real_requester_id, created_by")
        .or("is_deleted.eq.false,is_deleted.is.null")
        .gte("created_at", `${startDate}T00:00:00-03:00`)
        .lte("created_at", `${endDate}T23:59:59-03:00`)
        .order("created_at", { ascending: false })
        .limit(2000);

      let filtroSolicitante: string | null = null;

      if (user.role === "GESTOR") {
        query = query.or(`real_requester_id.eq.${user.id},created_by.eq.${user.id}`);
        filtroSolicitante = `${user.name} (apenas seus próprios dados)`;
      } else if (
        requester &&
        requester.trim() &&
        !["todos", "geral", "todas", "usuário", "usuario"].includes(requester.trim().toLowerCase())
      ) {
        const term = requester.trim().replace(/[%,()]/g, " ");
        const { data: matches } = await supabaseAdmin
          .from("profiles")
          .select("id, name")
          .ilike("name", `%${term}%`)
          .limit(20);

        if (!matches || matches.length === 0) {
          return { erro: `Nenhum solicitante encontrado com o nome "${requester}".` };
        }
        const ids = matches.map((m: { id: string }) => m.id);
        query = query.or(`real_requester_id.in.(${ids.join(",")}),created_by.in.(${ids.join(",")})`);
        filtroSolicitante = matches.map((m: { name: string }) => m.name).join(", ");
      }

      const { data, error } = await query;
      if (error) return { erro: `Falha ao consultar o banco: ${error.message}` };

      const rows = data || [];

      const { data: profiles } = await supabaseAdmin.from("profiles").select("id, name");
      const nameById = new Map((profiles || []).map((p: { id: string; name: string }) => [p.id, p.name]));
      const requesterOf = (r: { real_requester_id: string | null; created_by: string | null }) =>
        nameById.get(r.real_requester_id || r.created_by || "") || "Desconhecido";

      const amountOf = (r: { amount: number | string | null }) => Number(r.amount) || 0;
      const total = rows.reduce((acc, r) => acc + amountOf(r), 0);

      return {
        periodo: { inicio: startDate, fim: endDate },
        filtroSolicitante: filtroSolicitante || "Todos",
        totalSolicitacoes: rows.length,
        valorTotal: Math.round(total * 100) / 100,
        porStatus: sumBy(rows, (r) => STATUS_LABEL[r.status] || r.status, amountOf),
        porCategoria: sumBy(rows, (r) => r.category || "Outros", amountOf),
        porSolicitante: user.role === "GESTOR" ? undefined : sumBy(rows, requesterOf, amountOf).slice(0, 15),
        ultimasSolicitacoes: rows.slice(0, MAX_ITEMS).map((r) => ({
          titulo: r.title,
          valor: amountOf(r),
          status: STATUS_LABEL[r.status] || r.status,
          categoria: r.category || "Outros",
          solicitante: requesterOf(r),
          criadoEm: String(r.created_at).slice(0, 10),
        })),
        observacao:
          rows.length > MAX_ITEMS
            ? `Mostrando as ${MAX_ITEMS} solicitações mais recentes de ${rows.length}; os totais consideram todas.`
            : undefined,
      };
    },
  });
}
