import type { AiCategorySuggestion } from "@/types/database";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

export interface CategorizeExpenseInput {
  title: string;
  notes?: string | null;
  amount?: number | null;
  existingCategories: string[];
}

/**
 * Chama o Google Gemini (gemini-3.5-flash-lite) para categorizar despesas financeiras.
 * Identifica a melhor categoria existente ou sugere uma nova categoria para validação do Master.
 */
export async function categorizeExpenseWithAI(
  input: CategorizeExpenseInput
): Promise<AiCategorySuggestion> {
  const { title, notes, amount, existingCategories } = input;

  if (!title && !notes) {
    return {
      category: null,
      is_new_category_suggested: false,
      suggested_category_name: null,
      confidence: 0,
      reason: "Título ou descrição não fornecidos.",
    };
  }

  // Filtrar 'Outros' para a IA priorizar categorias reais
  const cleanExisting = existingCategories.filter(
    (c) => c && c.toLowerCase() !== "outros" && c.toLowerCase() !== "outro"
  );

  const prompt = `Você é um assistente financeiro de contas a pagar de alta precisão.
Sua função é classificar despesas financeiras na categoria corporativa mais precisa.

DADOS DA DESPESA:
- Título da Solicitação: "${title || "Não informado"}"
- Descrição / Observações: "${notes || "Não informado"}"
- Valor: ${amount ? `R$ ${Number(amount).toFixed(2)}` : "Não informado"}

CATEGORIAS ATIVAS EXISTENTES NA EMPRESA:
${JSON.stringify(cleanExisting, null, 2)}

DIRETRIZES RÍGIDAS DE CLASSIFICAÇÃO:
1. Analise o objetivo real da despesa (ex: Uber/ônibus/gasolina = Transporte ou Combustível; comida/almoço/lanche = Alimentação; comissão/indicação de cliente = comissões/vendas; peças/reforma = Manutenção e Reparos; notas de compra de cabos/elétrica/material = Material de Escritório e Suprimentos ou Manutenção).
2. Se a despesa se encaixar claramente em uma das categorias existentes, selecione ela em "category", marque "is_new_category_suggested": false e "suggested_category_name": null.
3. NUNCA classifique como "Outros".
4. Se a despesa NÃO se encaixar bem em nenhuma categoria existente (como por exemplo: Comissões por indicação de clientes, Bonificações, Patrocínios/Doações, Telefonia, Serviços Jurídicos/Contábeis, Despesas Bancárias, etc.):
   - Defina "category": null
   - Defina "is_new_category_suggested": true
   - Sugira um nome corporativo curto, formal e padronizado em "suggested_category_name" (Exemplos: "Comissões e Premiações", "Doações e Patrocínios", "Telefonia e Conectividade").
5. Forneça uma justificativa concisa (máximo 1 ou 2 frases) em "reason".
6. Indique um nível de confiança numérico entre 0.0 e 1.0 em "confidence".

RESPONDA OBRIGATORIAMENTE EM FORMATO JSON:
{
  "category": string | null,
  "is_new_category_suggested": boolean,
  "suggested_category_name": string | null,
  "confidence": number,
  "reason": string
}`;

  const models = ["gemini-3.5-flash-lite", "gemini-3.7-flash", "gemini-3.8-flash"];

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        }),
      });

      if (!res.ok) {
        console.warn(`Gemini (${model}) returned status ${res.status}`);
        continue; // Tenta o próximo modelo
      }

      const json = await res.json();
      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const parsed: AiCategorySuggestion = JSON.parse(rawText);

      // Sanitização da resposta
      if (parsed.is_new_category_suggested && parsed.suggested_category_name) {
        parsed.category = parsed.suggested_category_name.trim();
      }

      return {
        category: parsed.category || null,
        is_new_category_suggested: Boolean(parsed.is_new_category_suggested),
        suggested_category_name: parsed.suggested_category_name || null,
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.9,
        reason: parsed.reason || "Classificado pela inteligência artificial Gemini.",
      };
    } catch (err) {
      console.error(`Erro ao consultar modelo ${model}:`, err);
    }
  }

  // Fallback heurístico em caso de falha de rede
  return fallbackHeuristicClassification(title, notes, cleanExisting);
}

/**
 * Fallback simples por palavras-chave caso todos os modelos estejam inacessíveis
 */
function fallbackHeuristicClassification(
  title: string,
  notes: string | null | undefined,
  existingCategories: string[]
): AiCategorySuggestion {
  const text = `${title} ${notes || ""}`.toLowerCase();

  const rules: { keywords: string[]; cat: string }[] = [
    { keywords: ["combustivel", "gasolina", "etanol", "diesel", "posto"], cat: "Combustível" },
    { keywords: ["almoço", "almoco", "jantar", "refeição", "refeicao", "comida", "lanche", "alimentacao", "alimentação", "restaurante", "marmita"], cat: "Alimentação" },
    { keywords: ["uber", "onibus", "ônibus", "passagem", "transporte", "pedagio", "pedágio", "taxi", "táxi"], cat: "Transporte" },
    { keywords: ["hotel", "pousada", "hospedagem", "diaria", "diária", "reserva"], cat: "Hospedagem" },
    { keywords: ["notebook", "computador", "mouse", "teclado", "ti", "servidor", "monitor", "software", "licenca"], cat: "Equipamentos TI" },
    { keywords: ["papel", "caneta", "impressão", "cartucho", "toner", "escritorio", "escritório"], cat: "Material de Escritório e Suprimentos" },
    { keywords: ["manutencao", "manutenção", "reparo", "conserto", "reforma"], cat: "Manutenção e Reparos" },
    { keywords: ["anuncio", "anúncio", "facebook", "google ads", "marketing", "grafica", "gráfica"], cat: "Marketing e Publicidade" },
    { keywords: ["imposto", "taxa", "tributo", "darf", "gps", "das"], cat: "Impostos e Taxas" },
    { keywords: ["indicação", "indicacao", "comissao", "comissão", "bonus", "bônus"], cat: "Comissões e Premiações" },
  ];

  for (const rule of rules) {
    if (rule.keywords.some((k) => text.includes(k))) {
      const exists = existingCategories.find((c) => c.toLowerCase() === rule.cat.toLowerCase());
      if (exists) {
        return {
          category: exists,
          is_new_category_suggested: false,
          suggested_category_name: null,
          confidence: 0.8,
          reason: `Detectado automaticamente por correspondência de termos da despesa (${rule.cat}).`,
        };
      } else {
        return {
          category: rule.cat,
          is_new_category_suggested: true,
          suggested_category_name: rule.cat,
          confidence: 0.85,
          reason: `Termos identificados como ${rule.cat}, que não existe atualmente na lista.`,
        };
      }
    }
  }

  return {
    category: null,
    is_new_category_suggested: false,
    suggested_category_name: null,
    confidence: 0.4,
    reason: "Não foi possível identificar a categoria com precisão.",
  };
}
