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

function normalizeText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/tercerizad/g, "terceirizad");
}

const BASE_PROMPT =
  "Você é o Super Solzinho, o mascote oficial e Assistente de Inteligência Financeira da Conectsol. " +
  "Seu tom deve ser prestativo, claro, profissional e focado em iluminar dúvidas com total precisão. " +
  "Formate suas respostas usando tabelas Markdown completas, negritos e listas para facilitar a leitura executiva.";

const DOMAIN_KNOWLEDGE =
  "CONHECIMENTO ESSENCIAL DA CONECTSOL E DAS DESPESAS:\n" +
  "1. Gastos com equipes terceirizadas de instalação de placas solares, instaladores e prestadores externos estão registrados sob a categoria 'Prestador de serviços avulsos' ou com o termo 'TERCERIZADA' / 'TERCEIRIZADA' no título e nas observações.\n" +
  "2. Principais instaladores/terceirizados da empresa: Anderson Santos Silva, André Santos de Oliveira, Jeová Silva Rocha, Patric De Lima Silva, etc.\n" +
  "3. Quando o usuário perguntar por 'terceirizadas', 'prestadores', 'instalação' ou 'mão de obra', use a ferramenta de busca pesquisando por categoria 'Prestador de serviços avulsos' ou termo 'terceirizada'.\n" +
  "4. REGRA DE OURO DAS FERRAMENTAS: Chame a ferramenta de busca NO MÁXIMO 1 VEZ por pergunta. Assim que a ferramenta retornar os dados, GERE IMEDIATAMENTE a resposta final completa em tabela Markdown (com Titular, Quantidade de Contas, Valor Total e Detalhamento das Solicitações). NUNCA faça chamadas repetitivas de ferramentas sem responder.";

const HIGH_MANAGEMENT_PROMPT =
  "O usuário é da alta gestão (MASTER/FINANCEIRO) e possui acesso irrestrito a todas as informações financeiras. " +
  "Vá direto aos dados solicitados. " +
  "Quando o usuário fizer uma pergunta direta (ex: 'detalhe nossos gastos com terceirizadas da instalação esse mês'), " +
  "chame a ferramenta `buscar_relatorio_financeiro` UMA VEZ e responda IMEDIATAMENTE agrupando por titular com valores, quantidades e status de cada solicitação.";

const MANAGER_PROMPT =
  "O usuário é um Solicitante/Gestor. Seja didático, explique como funcionam os processos " +
  "e mostre apenas os dados autorizados para o perfil dele.";

const RULES_PROMPT =
  "Regras gerais:\n" +
  "- Responda sempre em português do Brasil.\n" +
  "- Formate valores monetários em R$ no padrão brasileiro (ex: R$ 1.500,00).\n" +
  "- Nunca invente números: use rigorosamente o que a ferramenta retornar.\n" +
  "- Sempre que o usuário pedir para separar por titular, apresente uma tabela consolidada com Titular, Quantidade e Valor Total, além da lista de contas.\n" +
  "- Nunca termine uma resposta em branco: se não encontrar registros com os filtros exatos, explique os dados encontrados e cite as categorias registradas.";

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
    DOMAIN_KNOWLEDGE,
    roleBlock,
    RULES_PROMPT,
    `Contexto atual: você está falando com ${user.name} (perfil ${user.role}). Hoje é ${today} (${todayIso}). ` +
      "Use essa data para interpretar referências temporais como 'este mês', 'mês passado' ou 'hoje'. " +
      "Se o usuário pedir uma busca geral ou não especificar datas, deixe as datas em branco para buscar todo o histórico.",
  ].join("\n\n");
}

const STATUS_LABEL: Record<string, string> = {
  NOVA_SOLICITACAO: "Nova solicitação",
  EM_APROVACAO: "Em aprovação",
  VALIDACAO_GESTOR: "Validação do gestor",
  VALIDADO_GESTOR: "Validado pelo gestor",
  CORRECAO_PENDENTE: "Correção pendente",
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  FINALIZADO: "Finalizado (pago)",
  RECUSADO: "Recusado",
};

const MAX_ITEMS = 250;

function resolveTitular(r: any): string {
  if (Array.isArray(r.splits) && r.splits.length > 0) {
    const splitOwners = r.splits
      .map((s: any) => (s.pix_owner || s.caju_phone || "").trim())
      .filter(Boolean);
    if (splitOwners.length > 0) {
      return [...new Set(splitOwners)].join(", ");
    }
  }
  const direct = (r.pix_owner || r.pix_name || r.caju_phone || "").trim();
  if (direct) return direct;
  return "Não informado";
}

function getTitularDetails(r: any): { titular: string; valor: number; tipo: string; chavePix: string | null }[] {
  if (Array.isArray(r.splits) && r.splits.length > 0) {
    return r.splits.map((s: any) => ({
      titular: (s.pix_owner || s.caju_phone || "").trim() || "Não informado",
      valor: Number(s.amount) || 0,
      tipo: s.payment_type || r.payment_type || "Pix",
      chavePix: s.pix_key || null,
    }));
  }
  return [
    {
      titular: (r.pix_owner || r.pix_name || r.caju_phone || "").trim() || "Não informado",
      valor: Number(r.amount) || 0,
      tipo: r.payment_type || r.payment_method || "Não informado",
      chavePix: r.pix_key || null,
    },
  ];
}

function aggregateByTitular(rows: any[]) {
  const map = new Map<
    string,
    {
      titular: string;
      totalGeral: number;
      totalFinalizado: number;
      totalRecusado: number;
      totalPendente: number;
      quantidade: number;
      solicitacoes: { id: string; titulo: string; valor: number; status: string; data: string }[];
    }
  >();

  for (const r of rows) {
    const details = getTitularDetails(r);
    const statusLabel = STATUS_LABEL[r.status] || r.status;
    const isFinalizado = r.status === "FINALIZADO";
    const isRecusado = r.status === "RECUSADO";

    for (const d of details) {
      const name = d.titular || "Não informado";
      const cur = map.get(name) || {
        titular: name,
        totalGeral: 0,
        totalFinalizado: 0,
        totalRecusado: 0,
        totalPendente: 0,
        quantidade: 0,
        solicitacoes: [],
      };

      cur.totalGeral += d.valor;
      if (isFinalizado) cur.totalFinalizado += d.valor;
      else if (isRecusado) cur.totalRecusado += d.valor;
      else cur.totalPendente += d.valor;

      cur.quantidade += 1;
      cur.solicitacoes.push({
        id: r.id,
        titulo: r.title,
        valor: d.valor,
        status: statusLabel,
        data: String(r.created_at).slice(0, 10),
      });

      map.set(name, cur);
    }
  }

  return [...map.values()]
    .map((v) => ({
      ...v,
      totalGeral: Math.round(v.totalGeral * 100) / 100,
      totalFinalizado: Math.round(v.totalFinalizado * 100) / 100,
      totalRecusado: Math.round(v.totalRecusado * 100) / 100,
      totalPendente: Math.round(v.totalPendente * 100) / 100,
    }))
    .sort((a, b) => b.totalGeral - a.totalGeral);
}

function sumBy<T>(rows: T[], keyOf: (r: T) => string, amountOf: (r: T) => number) {
  const map = new Map<string, { total: number; quantidade: number }>();
  for (const r of rows) {
    const k = keyOf(r) || "Outros";
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
 * Acessa todas as informações do banco com suporte a busca textual ampla,
 * filtro por titular, categoria, status, solicitante e período.
 */
export function createFinancialReportTool(user: SolzinhoUser) {
  return tool({
    description:
      "Busca e analisa solicitações de pagamento com todos os detalhes (título, valor, titular favorecido, splits, chave Pix, tipo de pagamento, categoria, observações, conta pagadora/CNPJ, solicitante e status). " +
      "Pode filtrar por categoria (ex: 'Terceirizada' ou 'Prestador de serviços avulsos'), termo de busca textual (ex: nome de empresa, palavra-chave em observações ou título), titular, status, solicitante ou período de datas.",
    inputSchema: z.object({
      startDate: z
        .string()
        .optional()
        .describe("Data inicial no formato YYYY-MM-DD. Opcional (se omitida, busca desde o início)."),
      endDate: z
        .string()
        .optional()
        .describe("Data final no formato YYYY-MM-DD. Opcional (se omitida, busca até a data atual)."),
      categoria: z
        .string()
        .optional()
        .describe("Nome ou trecho da categoria para filtrar (ex: 'Terceirizada', 'Transporte', 'Alimentação')."),
      termo: z
        .string()
        .optional()
        .describe("Termo de busca textual para encontrar em título, observações, titular, chave Pix ou fornecedor."),
      titular: z
        .string()
        .optional()
        .describe("Nome do titular / favorecido para filtrar pagamentos destinados a essa pessoa ou empresa."),
      requester: z
        .string()
        .optional()
        .describe("Nome (ou parte do nome) do solicitante que abriu o pedido."),
      status: z
        .string()
        .optional()
        .describe("Status da solicitação (ex: 'FINALIZADO', 'EM_APROVACAO', 'AGUARDANDO_PAGAMENTO', 'NOVA_SOLICITACAO')."),
    }),
    execute: async ({ startDate, endDate, categoria, termo, titular, requester, status }) => {
      const dateRe = /^\d{4}-\d{2}-\d{2}$/;
      let start = startDate && dateRe.test(startDate) ? startDate : "2025-01-01";
      let end =
        endDate && dateRe.test(endDate)
          ? endDate
          : new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

      let query = supabaseAdmin
        .from("payment_requests")
        .select(
          "id, title, amount, category, status, payment_type, payment_method, pix_key, pix_owner, pix_name, caju_phone, notes, cnpj, splits, created_at, due_date, real_requester_id, created_by, refusal_reason, rejection_reason"
        )
        .or("is_deleted.eq.false,is_deleted.is.null")
        .gte("created_at", `${start}T00:00:00-03:00`)
        .lte("created_at", `${end}T23:59:59-03:00`)
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
        const cleanTerm = requester.trim().replace(/[%,()]/g, " ");
        const { data: matches } = await supabaseAdmin
          .from("profiles")
          .select("id, name")
          .ilike("name", `%${cleanTerm}%`)
          .limit(20);

        if (!matches || matches.length === 0) {
          return { erro: `Nenhum solicitante encontrado com o nome "${requester}".` };
        }
        const ids = matches.map((m: { id: string }) => m.id);
        query = query.or(`real_requester_id.in.(${ids.join(",")}),created_by.in.(${ids.join(",")})`);
        filtroSolicitante = matches.map((m: { name: string }) => m.name).join(", ");
      }

      let { data, error } = await query;
      if (error) return { erro: `Falha ao consultar o banco de dados: ${error.message}` };

      let fallbackUsed = false;
      // Resiliência de período: se o filtro estrito de data retornar 0 registros, busca no histórico recente
      if ((!data || data.length === 0) && startDate) {
        let fallbackQuery = supabaseAdmin
          .from("payment_requests")
          .select(
            "id, title, amount, category, status, payment_type, payment_method, pix_key, pix_owner, pix_name, caju_phone, notes, cnpj, splits, created_at, due_date, real_requester_id, created_by, refusal_reason, rejection_reason"
          )
          .or("is_deleted.eq.false,is_deleted.is.null")
          .order("created_at", { ascending: false })
          .limit(2000);

        if (user.role === "GESTOR") {
          fallbackQuery = fallbackQuery.or(`real_requester_id.eq.${user.id},created_by.eq.${user.id}`);
        }
        const fallbackRes = await fallbackQuery;
        if (fallbackRes.data && fallbackRes.data.length > 0) {
          data = fallbackRes.data;
          fallbackUsed = true;
        }
      }

      let rows = data || [];

      const normCat = normalizeText(categoria);
      const normTermo = normalizeText(termo);
      const normTitular = normalizeText(titular);

      if (normCat || normTermo || normTitular || status) {
        const filtered = rows.filter((r) => {
          const cat = normalizeText(r.category);
          const tit = normalizeText(resolveTitular(r));
          const title = normalizeText(r.title);
          const notes = normalizeText(r.notes);

          // Filtro por status
          if (status && status.trim()) {
            const sLow = status.trim().toLowerCase();
            if (
              (r.status || "").toLowerCase() !== sLow &&
              (STATUS_LABEL[r.status] || "").toLowerCase() !== sLow
            ) {
              return false;
            }
          }

          // Filtro por titular
          if (normTitular && !tit.includes(normTitular)) {
            return false;
          }

          // Casamento inteligente de terceirizada / instalacao / servicos avulsos
          const isTercTarget =
            normCat.includes("terceirizad") ||
            normCat.includes("prestador") ||
            normTermo.includes("terceirizad") ||
            normTermo.includes("instal");

          if (isTercTarget) {
            if (
              cat.includes("prestador") ||
              cat.includes("terceirizad") ||
              title.includes("terceirizad") ||
              notes.includes("terceirizad")
            ) {
              return true;
            }
          }

          if (normCat && !cat.includes(normCat)) {
            return false;
          }

          if (normTermo) {
            const words = normTermo
              .split(/\s+/)
              .filter(
                (w) =>
                  w.length > 2 &&
                  !["para", "com", "nossos", "esse", "esta", "onde", "quem", "mes"].includes(w)
              );
            if (words.length > 0) {
              return words.some(
                (w) => title.includes(w) || notes.includes(w) || tit.includes(w) || cat.includes(w)
              );
            }
          }

          return true;
        });

        if (filtered.length > 0) {
          rows = filtered;
        }
      }

      const { data: profiles } = await supabaseAdmin.from("profiles").select("id, name");
      const nameById = new Map((profiles || []).map((p: { id: string; name: string }) => [p.id, p.name]));
      const requesterOf = (r: { real_requester_id: string | null; created_by: string | null }) =>
        nameById.get(r.real_requester_id || r.created_by || "") || "Desconhecido";

      const amountOf = (r: { amount: number | string | null }) => Number(r.amount) || 0;
      const total = rows.reduce((acc, r) => acc + amountOf(r), 0);

      return {
        periodo: { inicio: start, fim: end },
        filtroSolicitante: filtroSolicitante || "Todos",
        totalSolicitacoesEncontradas: rows.length,
        valorTotalGeral: Math.round(total * 100) / 100,
        porTitular: aggregateByTitular(rows),
        porCategoria: sumBy(rows, (r) => r.category || "Outros", amountOf),
        porStatus: sumBy(rows, (r) => STATUS_LABEL[r.status] || r.status, amountOf),
        porContaPagadora: sumBy(rows, (r) => r.cnpj || "Não informada", amountOf),
        porSolicitante:
          user.role === "GESTOR" ? undefined : sumBy(rows, requesterOf, amountOf).slice(0, 20),
        solicitacoes: rows.slice(0, MAX_ITEMS).map((r) => {
          const tit = resolveTitular(r);
          const hasSplits = Array.isArray(r.splits) && r.splits.length > 0;
          return {
            id: r.id,
            titulo: r.title,
            valor: amountOf(r),
            status: STATUS_LABEL[r.status] || r.status,
            categoria: r.category || "Outros",
            titular: tit,
            tipoPagamento: r.payment_type || r.payment_method || "Não informado",
            chavePix: r.pix_key || (hasSplits ? r.splits.find((s: any) => s.pix_key)?.pix_key : null) || null,
            contaPagadora: r.cnpj || "Não informada",
            solicitante: requesterOf(r),
            observacoes: r.notes || null,
            criadoEm: String(r.created_at).slice(0, 10),
            vencimento: r.due_date ? String(r.due_date).slice(0, 10) : null,
            splits: hasSplits
              ? r.splits.map((s: any) => ({
                  titular: (s.pix_owner || s.caju_phone || "").trim() || "Não informado",
                  valor: Number(s.amount) || 0,
                  tipo: s.payment_type || "Outro",
                  chavePix: s.pix_key || null,
                }))
              : undefined,
          };
        }),
        observacao: fallbackUsed
          ? `Nenhuma solicitação encontrada no intervalo estrito de datas; trazendo as solicitações do histórico recente para você.`
          : rows.length > MAX_ITEMS
          ? `Mostrando ${MAX_ITEMS} solicitações de ${rows.length} encontradas; os totais agregados consideram todas.`
          : undefined,
      };
    },
  });
}

