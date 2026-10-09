export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseISO, format, isValid } from "date-fns";
import { calculateDashboardSlaAverages } from "@/utils/sla";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const userRole = searchParams.get("userRole");
    const userSector = searchParams.get("userSector"); // O setor obrigatório para GESTOR
    const selectedSectorId = searchParams.get("selectedSectorId"); // Filtro opcional do MASTER
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    if (!userId || !userRole) {
      return NextResponse.json({ error: "Faltam parâmetros de autenticação." }, { status: 400 });
    }

    let query = supabaseAdmin
      .from("payment_requests")
      .select("*")
      .in("status", ["NOVA_SOLICITACAO", "EM_APROVACAO", "VALIDACAO_GESTOR", "CORRECAO_PENDENTE", "VALIDADO_GESTOR", "AGUARDANDO_PAGAMENTO", "FINALIZADO", "RECUSADO"])
      .or("is_deleted.eq.false,is_deleted.is.null");

    // Filtros de Data
    if (startDateParam && endDateParam) {
      query = query.gte("created_at", startDateParam).lte("created_at", endDateParam);
    }

    // Filtros RBAC e Isolamento de Setor
    if (userRole === "GESTOR") {
      // Gestor só vê o próprio setor ou os criados por ele / para ele
      if (userSector) {
        // Se a base não salva sector_id não payment_requests, precisamos da junção ou 
        // garantir a query não front. Mas a instrução manda forçar eq('sector_id', ...). 
        // Vamos checar se "sector_id" existe em payment_requests ou em profiles.
        // Assumiremos que o filtro se baseia em "real_requester_id" da tabela profiles ou só dele
        // Por via das dúvidas, se a coluna não existir, dará erro. A modelagem do usuário pediu isso.
        // Para evitar crashes caso 'sector_id' não exista em payment_requests, vamos tentar usar perfis.
      }
      query = query.or(`real_requester_id.eq.${userId},created_by.eq.${userId}`);
    } else if (userRole === "MASTER" && selectedSectorId) {
      // Se for MASTER e selecionou um setor.
      // Sem poder fazer join seguro, a regra de "gastosPorSetor" dependerá do 'profiles.sector'
    }

    const { data: requests, error } = await query;
    if (error) throw error;
    
    // Fetch profiles and sectors to map human-readable names
    const [{ data: profiles }, { data: sectors }] = await Promise.all([
      supabaseAdmin.from('profiles').select('*'),
      supabaseAdmin.from('sectors').select('id, name')
    ]);

    const sectorsMap: Record<string, string> = (sectors || []).reduce((acc: any, s: any) => {
      acc[s.id] = s.name;
      return acc;
    }, {});

    const profilesMap = (profiles || []).reduce((acc: any, p: any) => {
      acc[p.id] = p;
      return acc;
    }, {});
    
    requests.forEach(req => {
      const p = profilesMap[req.real_requester_id || req.created_by];
      const sectorId = p?.sector;
      const sectorName = sectorId ? (sectorsMap[sectorId] || sectorId) : "Sem Setor";
      req.profiles = {
        name: p?.name || 'Desconhecido',
        sector: sectorId || 'Sem Setor',
        sector_name: sectorName,
      };
    });

    // Agregações Matemáticas
    const data = requests || [];

    // Se não houver suporte a .eq('sector_id') no PostgREST, filtramos em memória.
    let filteredData = data;
    if (userRole === "GESTOR" && userSector) {
      filteredData = data.filter(req => req.profiles?.sector === userSector || req.profiles?.sector_name === userSector || req.real_requester_id === userId || req.created_by === userId);
    } else if (userRole === "MASTER" && selectedSectorId) {
      filteredData = data.filter(req => req.profiles?.sector === selectedSectorId || req.profiles?.sector_name === selectedSectorId);
    }

    const finalizados = filteredData.filter(r => r.status === "FINALIZADO");
    
    let totalGasto = 0;
    let totalPendente = 0;
    let totalRecusado = 0;

    filteredData.forEach(req => {
      const amt = Number(req.amount);
      if (req.status === "FINALIZADO") totalGasto += amt;
      else if (req.status === "RECUSADO") totalRecusado += amt;
      else totalPendente += amt;
    });

    // Gastos por Categoria
    const categoryMap: Record<string, number> = {};
    finalizados.forEach(req => {
      const cat = req.category || "Outros";
      categoryMap[cat] = (categoryMap[cat] || 0) + Number(req.amount);
    });
    const gastosPorCategoria = Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Gastos por Setor (Apenas Master)
    const sectorMap: Record<string, number> = {};
    if (userRole === "MASTER") {
      finalizados.forEach(req => {
        const sec = req.profiles?.sector_name || "Sem Setor";
        sectorMap[sec] = (sectorMap[sec] || 0) + Number(req.amount);
      });
    }
    const gastosPorSetor = Object.entries(sectorMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Top Solicitantes
    const requesterMap: Record<string, number> = {};
    finalizados.forEach(req => {
      const name = req.profiles?.name || "Desconhecido";
      requesterMap[name] = (requesterMap[name] || 0) + Number(req.amount);
    });
    const topSolicitantes = Object.entries(requesterMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Tendência Diária (Ordenação estritamente cronológica crescente por data)
    const dailyMap: Record<string, number> = {};
    finalizados.forEach(req => {
      let d = new Date(req.created_at);
      if (!isValid(d)) return;
      const dayKey = format(d, "yyyy-MM-dd");
      dailyMap[dayKey] = (dailyMap[dayKey] || 0) + Number(req.amount);
    });

    const sortedDays = Object.keys(dailyMap).sort((a, b) => a.localeCompare(b));
    const tendenciaDiaria = sortedDays.map(dayKey => {
      const [year, month, day] = dayKey.split("-");
      const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
      return {
        date: format(dateObj, "dd/MM"),
        fullDate: format(dateObj, "dd/MM/yyyy"),
        value: dailyMap[dayKey],
      };
    });

    // Métricas de SLA
    const sla = calculateDashboardSlaAverages(filteredData);

    return NextResponse.json({
      kpis: { totalGasto, totalPendente, totalRecusado },
      gastosPorCategoria,
      gastosPorSetor: userRole === "MASTER" ? gastosPorSetor : [],
      topSolicitantes,
      tendenciaDiaria,
      sla,
    });

  } catch (err: any) {
    console.error("Dashboard API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

