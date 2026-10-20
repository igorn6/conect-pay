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
      .in("status", [
        "NOVA_SOLICITACAO",
        "EM_APROVACAO",
        "VALIDACAO_GESTOR",
        "CORRECAO_PENDENTE",
        "VALIDADO_GESTOR",
        "AGUARDANDO_PAGAMENTO",
        "FINALIZADO",
        "RECUSADO",
      ])
      .or("is_deleted.eq.false,is_deleted.is.null")
      .order("created_at", { ascending: false })
      .limit(3000);

    // Filtros RBAC e Isolamento de Setor
    if (userRole === "GESTOR") {
      query = query.or(`real_requester_id.eq.${userId},created_by.eq.${userId}`);
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

    // Helper para obter a data real de liquidação do card
    const getLiquidationDate = (req: any): string => {
      if (Array.isArray(req.stage_history)) {
        const finStage = req.stage_history.find((s: any) => s.stage === "FINALIZADO");
        if (finStage?.entered_at) return finStage.entered_at;
      }
      return req.updated_at || req.created_at;
    };

    // Agregações Matemáticas
    let data = requests || [];

    // Filtro de Data em memória:
    // Se for FINALIZADO: avalia a data em que foi liquidado
    // Se for pendente/recusado: avalia a data de criação
    const startD = startDateParam ? new Date(startDateParam) : null;
    const endD = endDateParam ? new Date(endDateParam) : null;

    if (startD && endD && isValid(startD) && isValid(endD)) {
      data = data.filter((req) => {
        const dateToCheck = req.status === "FINALIZADO" ? getLiquidationDate(req) : req.created_at;
        const d = new Date(dateToCheck);
        return isValid(d) && d >= startD && d <= endD;
      });
    }

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

    // Tendência Diária de Liquidações (Ordenação cronológica com régua diária contínua)
    const dailyMap: Record<string, number> = {};
    finalizados.forEach(req => {
      const liqDateStr = getLiquidationDate(req);
      const d = new Date(liqDateStr);
      if (!isValid(d)) return;
      const dayKey = format(d, "yyyy-MM-dd");
      dailyMap[dayKey] = (dailyMap[dayKey] || 0) + Number(req.amount);
    });

    let sortedDays = Object.keys(dailyMap).sort((a, b) => a.localeCompare(b));

    // Se houver filtros de data definidos, preenche os dias do intervalo para gerar uma curva temporal fluida
    if (startD && endD && isValid(startD) && isValid(endD) && startD <= endD) {
      // Nunca projeta dias futuros na curva temporal de liquidações (limita no máximo ao dia de hoje)
      const now = new Date();
      const effectiveEndD = endD > now ? now : endD;

      const fullDailyMap: Record<string, number> = {};
      const curr = new Date(startD);
      let iterations = 0;
      while (curr <= effectiveEndD && iterations < 90) {
        const k = format(curr, "yyyy-MM-dd");
        fullDailyMap[k] = dailyMap[k] || 0;
        curr.setDate(curr.getDate() + 1);
        iterations++;
      }
      sortedDays = Object.keys(fullDailyMap).sort((a, b) => a.localeCompare(b));
      sortedDays.forEach((k) => {
        if (dailyMap[k] === undefined) {
          dailyMap[k] = 0;
        }
      });
    } else if (sortedDays.length === 1) {
      // Se houver apenas 1 dia no conjunto, adiciona o dia anterior e posterior com 0 para permitir desenho da curva no Recharts
      const singleDay = sortedDays[0];
      const [y, m, d] = singleDay.split("-").map(Number);
      const prevDate = new Date(y, m - 1, d - 1);
      const nextDate = new Date(y, m - 1, d + 1);
      const prevKey = format(prevDate, "yyyy-MM-dd");
      const nextKey = format(nextDate, "yyyy-MM-dd");
      dailyMap[prevKey] = 0;
      dailyMap[nextKey] = 0;
      sortedDays = [prevKey, singleDay, nextKey];
    }

    const tendenciaDiaria = sortedDays.map(dayKey => {
      const [year, month, day] = dayKey.split("-");
      const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
      return {
        date: format(dateObj, "dd/MM"),
        fullDate: format(dateObj, "dd/MM/yyyy"),
        value: dailyMap[dayKey] || 0,
      };
    });

    // Métricas de SLA (Horário comercial: Seg-Sex, 08h às 18h)
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

