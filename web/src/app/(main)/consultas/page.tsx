"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  Search,
  AlertCircle,
  FileSpreadsheet,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  RotateCcw,
  Calendar,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  SlidersHorizontal,
  X,
  CreditCard,
  Building2,
  Tag,
  Clock,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCategories } from "@/hooks/useCategories";
import { useProfilesMap } from "@/hooks/useProfilesMap";
import { useSectors } from "@/hooks/useSectors";
import CardDetailModal from "@/components/CardDetailModal";
import NewRequestModal from "@/components/NewRequestModal";
import Toast from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import type { PaymentRequest } from "@/types/database";

type SortField = "title" | "requester" | "category" | "amount" | "created_at" | "status";
type SortDirection = "asc" | "desc";
type QuickPeriod = "today" | "7days" | "month" | null;

export default function SearchPage() {
  const { userRole, userId, sectorId, userName: simulatedUserName } = useAuth();
  const { categories, isLoading: isLoadingCategories } = useCategories();
  const { profilesMap, profilesList } = useProfilesMap();
  const { sectors } = useSectors();

  // Dados brutos
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Busca textual abrangente (Título, Titular, Descrição/Notas, Solicitante, Pix)
  const [searchTerm, setSearchTerm] = useState("");

  // 2. Filtros Avançados
  const [requesterOrSectorFilter, setRequesterOrSectorFilter] = useState<string>("");
  const [modalityFilter, setModalityFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Período e atalhos rápidos
  const [dateStart, setDateStart] = useState<string>("");
  const [dateEnd, setDateEnd] = useState<string>("");
  const [quickPeriod, setQuickPeriod] = useState<QuickPeriod>(null);

  // Valores (Exato e Faixa Mín/Máx)
  const [exactValue, setExactValue] = useState<string>("");
  const [minValue, setMinValue] = useState<string>("");
  const [maxValue, setMaxValue] = useState<string>("");

  // 3. Ordenação nas colunas (Padrão: DATA Decrescente)
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // 5. Paginação (Padrão: 20 itens)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Modais & Notificações
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<PaymentRequest | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Busca inicial das solicitações no Supabase com isolamento de perfil
  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = supabase
        .from("payment_requests")
        .select("*")
        .eq("is_deleted", false)
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
        .order("created_at", { ascending: false })
        .limit(5000);

      const { data, error } = await query;
      if (error) throw error;

      let filteredData = (data || []) as PaymentRequest[];

      // Aplicar filtro de isolamento de dados para perfil GESTOR
      if (userRole === "GESTOR") {
        if (sectorId) {
          const { data: sectorUsers } = await supabase.from("profiles").select("id").eq("sector", sectorId);
          const sectorUserIds = new Set(sectorUsers?.map((u) => u.id) || []);
          filteredData = filteredData.filter(
            (req) =>
              sectorUserIds.has(req.real_requester_id) ||
              sectorUserIds.has(req.created_by) ||
              req.real_requester_id === userId ||
              req.created_by === userId
          );
        } else {
          filteredData = filteredData.filter(
            (req) => req.real_requester_id === userId || req.created_by === userId
          );
        }
      }

      setRequests(filteredData);
    } catch (err) {
      console.error("Erro ao buscar solicitações:", err);
      setToast({ message: "Erro ao carregar dados.", type: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [userRole, userId, sectorId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleSuccess = (msg: string) => {
    setToast({ message: msg, type: "success" });
    fetchRequests();
  };

  // Helper formatadores
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusLabelText = (status: string) => {
    switch (status) {
      case "NOVA_SOLICITACAO":
        return "Nova";
      case "EM_APROVACAO":
        return "Em Aprovação";
      case "VALIDACAO_GESTOR":
        return "Validação Gestor";
      case "CORRECAO_PENDENTE":
        return "Correção";
      case "VALIDADO_GESTOR":
        return "Validado";
      case "AGUARDANDO_PAGAMENTO":
      case "AGUARDANDO_NOTINHA":
        return "Aguardando Pgto";
      case "FINALIZADO":
      case "PAGAMENTO_FINALIZADO":
        return "Finalizado";
      case "RECUSADO":
        return "Recusado";
      default:
        return status;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "NOVA_SOLICITACAO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-lg text-[10px] font-mono font-semibold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            Nova
          </span>
        );
      case "EM_APROVACAO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-lg text-[10px] font-mono font-semibold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Em Aprovação
          </span>
        );
      case "VALIDACAO_GESTOR":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded-lg text-[10px] font-mono font-semibold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            Validação Gestor
          </span>
        );
      case "CORRECAO_PENDENTE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/10 text-orange-300 border border-orange-500/20 rounded-lg text-[10px] font-mono font-semibold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
            Correção
          </span>
        );
      case "VALIDADO_GESTOR":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/20 rounded-lg text-[10px] font-mono font-semibold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400" />
            Validado
          </span>
        );
      case "AGUARDANDO_PAGAMENTO":
      case "AGUARDANDO_NOTINHA":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-lg text-[10px] font-mono font-semibold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            Aguardando Pgto
          </span>
        );
      case "FINALIZADO":
      case "PAGAMENTO_FINALIZADO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-lg text-[10px] font-mono font-semibold uppercase tracking-wider shadow-[0_0_12px_rgba(16,185,129,0.15)]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            Finalizado
          </span>
        );
      case "RECUSADO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded-lg text-[10px] font-mono font-semibold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            Recusado
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 bg-white/5 text-slate-400 border border-white/10 rounded-lg text-[10px] font-mono font-semibold uppercase tracking-wider">
            {status}
          </span>
        );
    }
  };

  const isMasterOrFinanceiro = userRole === "MASTER" || userRole === "FINANCEIRO";
  const isGestor = userRole === "GESTOR";

  // Identificação do setor do Gestor
  const currentSector = useMemo(() => {
    if (!sectorId) return null;
    return sectors.find((s) => s.id === sectorId) || null;
  }, [sectors, sectorId]);
  const currentSectorName = currentSector?.name || (sectorId ? "Meu Setor" : "");

  // Setores disponíveis (Master e Financeiro veem todos; Gestor vê apenas o seu)
  const availableSectors = useMemo(() => {
    if (isMasterOrFinanceiro) {
      return sectors
        .filter((s) => !s.is_deleted)
        .map((s) => ({ id: s.id, name: s.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }
    if (isGestor && sectorId) {
      return currentSector ? [{ id: currentSector.id, name: currentSector.name }] : [];
    }
    return [];
  }, [sectors, isMasterOrFinanceiro, isGestor, sectorId, currentSector]);

  // Solicitantes disponíveis (Master e Financeiro veem todos; Gestor vê apenas do seu setor)
  const availableRequesters = useMemo(() => {
    if (isGestor && sectorId) {
      // Gestor só puxa membros do seu próprio setor
      return profilesList
        .filter((p) => p.sector === sectorId && p.name && p.name !== "Sem Nome")
        .map((p) => ({ id: p.id, name: p.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }

    if (isMasterOrFinanceiro) {
      // Master e Financeiro puxam todos os solicitantes da empresa
      const list = profilesList
        .filter((p) => p.name && p.name !== "Sem Nome")
        .map((p) => ({ id: p.id, name: p.name }));

      const existingIds = new Set(list.map((u) => u.id));
      requests.forEach((r) => {
        const id = r.real_requester_id || r.created_by;
        if (id && !existingIds.has(id)) {
          const resolvedName = profilesMap[id];
          if (resolvedName) {
            list.push({ id, name: resolvedName });
            existingIds.add(id);
          }
        }
      });

      return list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }

    return [];
  }, [isGestor, sectorId, isMasterOrFinanceiro, profilesList, requests, profilesMap]);

  // Categorias instantâneas (combina cache/banco + solicitações carregadas para latência zero)
  const dynamicCategories = useMemo(() => {
    const set = new Set<string>();
    categories.forEach((c) => {
      if (c.name) set.add(c.name);
    });
    requests.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [categories, requests]);

  // Função avançada de busca por múltiplos campos (Diretriz 1)
  const matchesSearch = (req: PaymentRequest, term: string, requesterName: string): boolean => {
    if (!term) return true;
    const t = term.toLowerCase().trim();

    // 1. Título e Descrição / Notas
    if (req.title?.toLowerCase().includes(t)) return true;
    if (req.description?.toLowerCase().includes(t)) return true;
    if (req.notes?.toLowerCase().includes(t)) return true;

    // 2. Solicitante
    if (requesterName?.toLowerCase().includes(t)) return true;
    if (req.real_requester_id?.toLowerCase().includes(t)) return true;
    if (req.created_by?.toLowerCase().includes(t)) return true;

    // 3. Titular / Recebedor do pagamento & Chave Pix
    if (req.pix_owner?.toLowerCase().includes(t)) return true;
    if (req.pix_name?.toLowerCase().includes(t)) return true;
    if (req.pix_key?.toLowerCase().includes(t)) return true;
    if (req.caju_phone?.toLowerCase().includes(t)) return true;
    if (req.barcode?.toLowerCase().includes(t)) return true;
    if (req.cnpj?.toLowerCase().includes(t)) return true;

    // Campos alternativos ou legados
    const anyReq = req as any;
    if (anyReq.holder_name?.toLowerCase().includes(t)) return true;
    if (anyReq.recipient_name?.toLowerCase().includes(t)) return true;
    if (anyReq.titular?.toLowerCase().includes(t)) return true;
    if (anyReq.beneficiary?.toLowerCase().includes(t)) return true;

    // Rateios / Splits
    if (Array.isArray(req.splits)) {
      for (const split of req.splits) {
        if (split.pix_owner?.toLowerCase().includes(t)) return true;
        if (split.pix_key?.toLowerCase().includes(t)) return true;
        if (split.caju_phone?.toLowerCase().includes(t)) return true;
        if (split.boleto_barcode?.toLowerCase().includes(t)) return true;
        if (split.boleto_notes?.toLowerCase().includes(t)) return true;
      }
    }

    return false;
  };

  // Filtragem e ordenação completas
  const filteredRequests = useMemo(() => {
    let result = [...requests];

    // 1. Busca textual
    if (searchTerm.trim()) {
      result = result.filter((req) => {
        const reqName = profilesMap[req.real_requester_id || ""] || profilesMap[req.created_by] || "";
        return matchesSearch(req, searchTerm, reqName);
      });
    }

    // 2. Dropdown Solicitante / Setor
    if (requesterOrSectorFilter) {
      if (requesterOrSectorFilter.startsWith("sector:")) {
        const sectorIdTarget = requesterOrSectorFilter.replace("sector:", "");
        const sectorUserIds = new Set(
          profilesList.filter((p) => p.sector === sectorIdTarget).map((p) => p.id)
        );
        result = result.filter(
          (req) => sectorUserIds.has(req.real_requester_id) || sectorUserIds.has(req.created_by)
        );
      } else if (requesterOrSectorFilter.startsWith("user:")) {
        const userIdTarget = requesterOrSectorFilter.replace("user:", "");
        result = result.filter(
          (req) => req.real_requester_id === userIdTarget || req.created_by === userIdTarget
        );
      }
    }

    // 3. Dropdown Modalidade (Estritamente: Boleto, Caju, Pix, FOPAG)
    if (modalityFilter) {
      const mod = modalityFilter.toUpperCase();
      result = result.filter((req) => {
        const method = (req.payment_method || "").toUpperCase();
        const type = (req.payment_type || "").toUpperCase();
        if (method === mod || type === mod) return true;
        if (Array.isArray(req.splits) && req.splits.some((s) => (s.payment_type || "").toUpperCase() === mod)) {
          return true;
        }
        if (mod === "FOPAG") {
          if ((req.notes || "").toUpperCase().includes("FOPAG")) return true;
          if ((req.description || "").toUpperCase().includes("FOPAG")) return true;
          if ((req.category || "").toUpperCase().includes("FOPAG")) return true;
        }
        return false;
      });
    }

    // 4. Dropdown Categoria
    if (categoryFilter) {
      result = result.filter((req) => req.category === categoryFilter);
    }

    // 5. Dropdown Status
    if (statusFilter) {
      result = result.filter((req) => req.status === statusFilter);
    }

    // 6. Período
    if (dateStart) {
      const start = new Date(`${dateStart}T00:00:00`);
      result = result.filter((req) => new Date(req.created_at) >= start);
    }
    if (dateEnd) {
      const end = new Date(`${dateEnd}T23:59:59.999`);
      result = result.filter((req) => new Date(req.created_at) <= end);
    }

    // 7. Valores (Exato vs Faixa Mín/Máx)
    if (exactValue.trim()) {
      const exactNum = parseFloat(exactValue.replace(/\./g, "").replace(",", "."));
      if (Number.isFinite(exactNum)) {
        result = result.filter((req) => Math.abs(Number(req.amount) - exactNum) < 0.01);
      }
    } else {
      if (minValue.trim()) {
        const minNum = parseFloat(minValue.replace(/\./g, "").replace(",", "."));
        if (Number.isFinite(minNum)) {
          result = result.filter((req) => Number(req.amount) >= minNum);
        }
      }
      if (maxValue.trim()) {
        const maxNum = parseFloat(maxValue.replace(/\./g, "").replace(",", "."));
        if (Number.isFinite(maxNum)) {
          result = result.filter((req) => Number(req.amount) <= maxNum);
        }
      }
    }

    // 8. Ordenação visual nas colunas
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "title":
          comparison = (a.title || "").localeCompare(b.title || "", "pt-BR");
          break;
        case "requester": {
          const nameA = profilesMap[a.real_requester_id || ""] || profilesMap[a.created_by] || "";
          const nameB = profilesMap[b.real_requester_id || ""] || profilesMap[b.created_by] || "";
          comparison = nameA.localeCompare(nameB, "pt-BR");
          break;
        }
        case "category":
          comparison = (a.category || "").localeCompare(b.category || "", "pt-BR");
          break;
        case "amount":
          comparison = Number(a.amount) - Number(b.amount);
          break;
        case "created_at":
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "status":
          comparison = (a.status || "").localeCompare(b.status || "", "pt-BR");
          break;
        default:
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [
    requests,
    searchTerm,
    requesterOrSectorFilter,
    modalityFilter,
    categoryFilter,
    statusFilter,
    dateStart,
    dateEnd,
    exactValue,
    minValue,
    maxValue,
    sortField,
    sortDirection,
    profilesMap,
    profilesList,
  ]);

  // Reset de página automático ao alterar filtros ou paginação (Diretriz 5)
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    requesterOrSectorFilter,
    modalityFilter,
    categoryFilter,
    statusFilter,
    dateStart,
    dateEnd,
    exactValue,
    minValue,
    maxValue,
    pageSize,
  ]);

  // Cálculos de soma e paginação
  const totalFinancialSum = useMemo(() => {
    return filteredRequests.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
  }, [filteredRequests]);

  const totalFilteredCount = filteredRequests.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / pageSize));

  const paginatedRequests = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredRequests.slice(startIndex, startIndex + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  // Ação: Ordenar ao clicar na coluna (Diretriz 3)
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      // Padrão desc para datas e valores, asc para textos
      setSortDirection(field === "amount" || field === "created_at" ? "desc" : "asc");
    }
  };

  // Atalhos rápidos de período
  const handleQuickPeriod = (type: "today" | "7days" | "month") => {
    if (quickPeriod === type) {
      setQuickPeriod(null);
      setDateStart("");
      setDateEnd("");
      return;
    }

    const now = new Date();
    if (type === "today") {
      const todayStr = now.toISOString().slice(0, 10);
      setDateStart(todayStr);
      setDateEnd(todayStr);
    } else if (type === "7days") {
      const past = new Date();
      past.setDate(now.getDate() - 6);
      setDateStart(past.toISOString().slice(0, 10));
      setDateEnd(now.toISOString().slice(0, 10));
    } else if (type === "month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setDateStart(firstDay.toISOString().slice(0, 10));
      setDateEnd(lastDay.toISOString().slice(0, 10));
    }
    setQuickPeriod(type);
  };

  // Verifica se há filtros aplicados para exibir botão Limpar
  const hasActiveFilters = Boolean(
    searchTerm ||
      requesterOrSectorFilter ||
      modalityFilter ||
      categoryFilter ||
      statusFilter ||
      dateStart ||
      dateEnd ||
      exactValue ||
      minValue ||
      maxValue
  );

  const handleClearFilters = () => {
    setSearchTerm("");
    setRequesterOrSectorFilter("");
    setModalityFilter("");
    setCategoryFilter("");
    setStatusFilter("");
    setDateStart("");
    setDateEnd("");
    setQuickPeriod(null);
    setExactValue("");
    setMinValue("");
    setMaxValue("");
    setCurrentPage(1);
  };

  // Exportação nativa direta para Excel (Diretriz 4)
  const handleExportExcel = () => {
    if (filteredRequests.length === 0) {
      setToast({ message: "Nenhum registro para exportar com os filtros atuais.", type: "error" });
      return;
    }

    try {
      const rows = filteredRequests.map((req, idx) => {
        const requester =
          profilesMap[req.real_requester_id || ""] || profilesMap[req.created_by] || "Não informado";
        const titular =
          req.pix_owner ||
          req.pix_name ||
          (Array.isArray(req.splits)
            ? req.splits.map((s) => s.pix_owner).filter(Boolean).join(", ")
            : "") ||
          "—";
        const chavePix =
          req.pix_key ||
          req.caju_phone ||
          req.barcode ||
          (Array.isArray(req.splits)
            ? req.splits.map((s) => s.pix_key || s.caju_phone || s.boleto_barcode).filter(Boolean).join(", ")
            : "") ||
          "—";
        const modalidade =
          req.payment_method ||
          req.payment_type ||
          (Array.isArray(req.splits)
            ? req.splits.map((s) => s.payment_type).filter(Boolean).join(", ")
            : "") ||
          "—";

        return {
          "Nº": idx + 1,
          "ID": req.id,
          "Título": req.title,
          "Solicitante": requester,
          "Titular / Recebedor": titular,
          "Chave / Identificador": chavePix,
          "Modalidade": modalidade,
          "Categoria": req.category || "—",
          "Valor (R$)": Number(req.amount) || 0,
          "Data Criação": formatDate(req.created_at),
          "Data Vencimento": req.due_date ? new Date(req.due_date).toLocaleDateString("pt-BR") : "—",
          "Status": getStatusLabelText(req.status),
          "Observações / Notas": req.notes || req.description || "—",
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);

      // Larguras ideais de coluna para apresentação impecável no Excel
      worksheet["!cols"] = [
        { wch: 6 },   // Nº
        { wch: 38 },  // ID
        { wch: 36 },  // Título
        { wch: 26 },  // Solicitante
        { wch: 26 },  // Titular
        { wch: 28 },  // Chave
        { wch: 14 },  // Modalidade
        { wch: 22 },  // Categoria
        { wch: 16 },  // Valor
        { wch: 20 },  // Data Criação
        { wch: 16 },  // Data Vencimento
        { wch: 20 },  // Status
        { wch: 45 },  // Observações
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Solicitações");

      const now = new Date();
      const dateSuffix = now.toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `ConectPay_Consultas_${dateSuffix}.xlsx`);

      setToast({
        message: `${filteredRequests.length} solicitações exportadas com sucesso!`,
        type: "success",
      });
    } catch (err: any) {
      console.error("Erro na exportação Excel:", err);
      setToast({ message: "Erro ao gerar arquivo Excel.", type: "error" });
    }
  };

  // Renderizador do cabeçalho de coluna ordenável (Diretriz 3)
  const renderSortableHeader = (
    label: string,
    field: SortField,
    align: "left" | "right" = "left",
    extraClasses = ""
  ) => {
    const isActive = sortField === field;
    return (
      <th
        onClick={() => handleSort(field)}
        className={`px-4 py-3.5 cursor-pointer select-none transition-colors group/th ${
          align === "right" ? "text-right" : "text-left"
        } ${extraClasses} ${isActive ? "text-emerald-400 font-bold" : "text-slate-400 hover:text-slate-200"}`}
      >
        <div
          className={`inline-flex items-center gap-1.5 ${
            align === "right" ? "justify-end flex-row-reverse" : "justify-start"
          }`}
        >
          <span>{label}</span>
          <span className="p-0.5 rounded transition-colors group-hover/th:bg-white/5">
            {isActive ? (
              sortDirection === "asc" ? (
                <ArrowUp size={13} className="text-emerald-400 shrink-0" />
              ) : (
                <ArrowDown size={13} className="text-emerald-400 shrink-0" />
              )
            ) : (
              <ArrowUpDown size={13} className="text-slate-600 opacity-40 group-hover/th:opacity-100 shrink-0 transition-opacity" />
            )}
          </span>
        </div>
      </th>
    );
  };

  return (
    <div className="flex flex-col h-full w-full min-h-0 bg-transparent text-slate-100">
      <div className="flex-1 min-h-0 overflow-auto p-4 md:p-8 custom-scrollbar">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Top Header com Título, Badges e Botão Exportar Excel */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                <span>Consultar Solicitações</span>
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Auditoria, busca multi-parâmetro e filtros financeiros avançados
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Badge Total de Registros */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-white/10 text-xs font-mono shadow-sm">
                <span className="text-slate-400">Total:</span>
                <strong className="text-emerald-400 font-bold">{totalFilteredCount}</strong>
              </div>

              {/* Badge Soma Financeira Total (Diretriz 4) */}
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono shadow-sm">
                <span className="text-emerald-300 font-medium">Soma Total:</span>
                <strong className="text-emerald-400 font-bold text-sm tracking-tight">
                  {formatCurrency(totalFinancialSum)}
                </strong>
              </div>

              {/* Botão Exportar Excel (Diretriz 4) */}
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={isLoading || totalFilteredCount === 0}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-md hover:shadow-emerald-950/40 active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                title="Exportar registros filtrados para arquivo Excel (.xlsx)"
              >
                <FileSpreadsheet size={15} className="shrink-0" />
                <span>Exportar Excel</span>
              </button>
            </div>
          </div>

          {/* HUD de Filtros Avançados (Diretriz 1 & 2) */}
          <div
            className="p-4 md:p-5 rounded-2xl border shadow-xl space-y-3.5 backdrop-blur-xl"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--surface-border)",
            }}
          >
            {/* Linha 1: Input de Busca Amplo + Dropdowns Primários */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
              {/* Input Principal com Titular (Diretriz 1) */}
              <div className="relative lg:col-span-4">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="text"
                  placeholder="Buscar por título, titular (recebedor), descrição, solicitante ou chave pix..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-all font-mono border"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    borderColor: "var(--surface-border)",
                  }}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Dropdown Solicitante / Setor (Exclusivo Master e Financeiro, ou Gestor restrito ao seu setor) */}
              {(isMasterOrFinanceiro || isGestor) && (
                <div className="lg:col-span-3">
                  <select
                    value={requesterOrSectorFilter}
                    onChange={(e) => setRequesterOrSectorFilter(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50 transition-all border cursor-pointer font-sans"
                    style={{
                      backgroundColor: "var(--bg-secondary)",
                      borderColor: "var(--surface-border)",
                    }}
                  >
                    <option value="">
                      {isMasterOrFinanceiro
                        ? "Todos os Solicitantes / Setores"
                        : `Meu Setor (${currentSectorName || "Geral"})`}
                    </option>

                    {isMasterOrFinanceiro && availableSectors.length > 0 && (
                      <optgroup label="🏢 Setores">
                        {availableSectors.map((sec) => (
                          <option key={sec.id} value={`sector:${sec.id}`}>
                            Setor: {sec.name}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {availableRequesters.length > 0 && (
                      <optgroup label={isGestor ? "👤 Solicitantes do Meu Setor" : "👤 Solicitantes"}>
                        {availableRequesters.map((user) => (
                          <option key={user.id} value={`user:${user.id}`}>
                            {user.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              )}

              {/* Dropdown Modalidade (Estritamente: Boleto, Caju, Pix e FOPAG) */}
              <div className={isMasterOrFinanceiro || isGestor ? "lg:col-span-2" : "lg:col-span-3"}>
                <select
                  value={modalityFilter}
                  onChange={(e) => setModalityFilter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50 transition-all border cursor-pointer font-sans"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    borderColor: "var(--surface-border)",
                  }}
                >
                  <option value="">Todas as Modalidades</option>
                  <option value="BOLETO">Boleto</option>
                  <option value="CAJU">Caju</option>
                  <option value="PIX">Pix</option>
                  <option value="FOPAG">FOPAG</option>
                </select>
              </div>

              {/* Dropdown Categorias (Carregamento instantâneo via cache + DB) */}
              <div className={isMasterOrFinanceiro || isGestor ? "lg:col-span-3" : "lg:col-span-3"}>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50 transition-all border cursor-pointer font-sans"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    borderColor: "var(--surface-border)",
                  }}
                >
                  <option value="">Todas as Categorias</option>
                  {dynamicCategories.map((catName) => (
                    <option key={catName} value={catName}>
                      {catName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Linha 2: Filtro de Período com Atalhos + Filtro de Valores + Status + Limpar Filtros */}
            <div className="pt-2 border-t flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs" style={{ borderColor: "var(--surface-border)" }}>
              
              {/* Lado Esquerdo: Período com Chips de Atalho (Diretriz 2) */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-400 text-[11px] font-semibold flex items-center gap-1.5 uppercase tracking-wider">
                  <Calendar size={13} className="text-emerald-400" />
                  Período:
                </span>

                <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/5">
                  <button
                    type="button"
                    onClick={() => handleQuickPeriod("today")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                      quickPeriod === "today"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPeriod("7days")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                      quickPeriod === "7days"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    Últimos 7 dias
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPeriod("month")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                      quickPeriod === "month"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    Este Mês
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={dateStart}
                    onChange={(e) => {
                      setDateStart(e.target.value);
                      setQuickPeriod(null);
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs text-white border outline-none font-mono"
                    style={{
                      backgroundColor: "var(--bg-secondary)",
                      borderColor: "var(--surface-border)",
                    }}
                    title="Data Inicial"
                  />
                  <span className="text-slate-500 text-xs">até</span>
                  <input
                    type="date"
                    value={dateEnd}
                    onChange={(e) => {
                      setDateEnd(e.target.value);
                      setQuickPeriod(null);
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs text-white border outline-none font-mono"
                    style={{
                      backgroundColor: "var(--bg-secondary)",
                      borderColor: "var(--surface-border)",
                    }}
                    title="Data Final"
                  />
                </div>
              </div>

              {/* Lado Direito: Filtro de Valores (Exato + Mín/Máx) e Status */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-400 text-[11px] font-semibold flex items-center gap-1 uppercase tracking-wider">
                  <DollarSign size={13} className="text-emerald-400" />
                  Valores:
                </span>

                {/* Valor Exato (Diretriz 2) */}
                <input
                  type="text"
                  placeholder="Exato (R$)"
                  value={exactValue}
                  onChange={(e) => setExactValue(e.target.value)}
                  className="w-24 px-2 py-1 rounded-lg text-xs text-white placeholder-slate-500 border outline-none font-mono"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    borderColor: "var(--surface-border)",
                  }}
                  title="Filtro de valor exato em reais"
                />

                <span className="text-slate-600 text-xs">ou</span>

                {/* Faixa Mín e Máx (Diretriz 2) */}
                <input
                  type="text"
                  placeholder="Mín. (R$)"
                  value={minValue}
                  onChange={(e) => {
                    setMinValue(e.target.value);
                    if (exactValue) setExactValue("");
                  }}
                  className="w-20 px-2 py-1 rounded-lg text-xs text-white placeholder-slate-500 border outline-none font-mono"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    borderColor: "var(--surface-border)",
                  }}
                  title="Valor Mínimo"
                />
                <input
                  type="text"
                  placeholder="Máx. (R$)"
                  value={maxValue}
                  onChange={(e) => {
                    setMaxValue(e.target.value);
                    if (exactValue) setExactValue("");
                  }}
                  className="w-20 px-2 py-1 rounded-lg text-xs text-white placeholder-slate-500 border outline-none font-mono"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    borderColor: "var(--surface-border)",
                  }}
                  title="Valor Máximo"
                />

                {/* Dropdown Status */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1 rounded-lg text-xs text-slate-200 border outline-none cursor-pointer"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    borderColor: "var(--surface-border)",
                  }}
                >
                  <option value="">Todos os Status</option>
                  <option value="NOVA_SOLICITACAO">Nova Solicitação</option>
                  <option value="VALIDACAO_GESTOR">Validação Gestor</option>
                  <option value="EM_APROVACAO">Em Aprovação</option>
                  <option value="CORRECAO_PENDENTE">Correção Pendente</option>
                  <option value="VALIDADO_GESTOR">Validado Gestor</option>
                  <option value="AGUARDANDO_PAGAMENTO">Aguardando Pagamento</option>
                  <option value="FINALIZADO">Finalizado</option>
                  <option value="RECUSADO">Recusado</option>
                </select>

                {/* Botão Limpar Filtros (Diretriz 2) */}
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors cursor-pointer"
                    title="Resetar todos os filtros aplicados"
                  >
                    <RotateCcw size={12} />
                    <span>Limpar</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tabela de Solicitações (Estritamente as 6 colunas atuais com ordenação visual - Diretrizes 1, 3, 6) */}
          <div
            className="rounded-2xl border overflow-hidden shadow-2xl backdrop-blur-xl"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--surface-border)",
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead
                  className="border-b text-[10px] tracking-wider uppercase font-mono font-bold"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    borderColor: "var(--surface-border)",
                  }}
                >
                  <tr>
                    {/* Coluna 1: TÍTULO */}
                    {renderSortableHeader("Título", "title", "left", "px-5")}
                    {/* Coluna 2: SOLICITANTE */}
                    {renderSortableHeader("Solicitante", "requester", "left")}
                    {/* Coluna 3: CATEGORIA */}
                    {renderSortableHeader("Categoria", "category", "left")}
                    {/* Coluna 4: VALOR */}
                    {renderSortableHeader("Valor", "amount", "right", "font-mono")}
                    {/* Coluna 5: DATA */}
                    {renderSortableHeader("Data", "created_at", "left", "font-mono")}
                    {/* Coluna 6: STATUS */}
                    {renderSortableHeader("Status", "status", "left", "px-5")}
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/[0.05]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-14 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="w-6 h-6 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                          <span className="text-slate-400 font-mono text-xs">
                            Consultando solicitações no banco de dados...
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedRequests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center">
                        <div className="max-w-sm mx-auto flex flex-col items-center">
                          <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-500 mb-3">
                            <AlertCircle size={26} />
                          </div>
                          <p className="text-slate-200 text-sm font-semibold">Nenhuma solicitação encontrada</p>
                          <p className="text-slate-400 text-xs mt-1">
                            {hasActiveFilters
                              ? "Nenhum registro corresponde aos filtros e buscas ativos. Tente limpar os filtros ou ajustar os parâmetros."
                              : "Nenhuma solicitação financeira cadastrada no sistema."}
                          </p>
                          {hasActiveFilters && (
                            <button
                              type="button"
                              onClick={handleClearFilters}
                              className="mt-4 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono transition-colors"
                            >
                              Limpar todos os filtros
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedRequests.map((req) => {
                      const requesterName =
                        profilesMap[req.real_requester_id || ""] ||
                        profilesMap[req.created_by] ||
                        "Não informado";

                      const method = req.payment_method || req.payment_type;

                      return (
                        <tr
                          key={req.id}
                          onClick={() => setSelectedCard(req)}
                          className="hover:bg-white/[0.03] cursor-pointer transition-colors group select-none"
                        >
                          {/* 1. TÍTULO */}
                          <td className="px-5 py-3.5 font-semibold text-slate-200 group-hover:text-white transition-colors max-w-xs md:max-w-md truncate">
                            <div className="flex items-center gap-2">
                              <span className="truncate">{req.title}</span>
                              {method && (
                                <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-white/[0.05] border border-white/10 text-slate-400 tracking-wider">
                                  {method.toUpperCase()}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 2. SOLICITANTE */}
                          <td className="px-4 py-3.5 text-slate-400 font-mono text-xs whitespace-nowrap">
                            {requesterName}
                          </td>

                          {/* 3. CATEGORIA */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            {req.category ? (
                              <span className="px-2.5 py-1 rounded-lg text-[10px] bg-white/[0.04] border border-white/10 text-slate-300">
                                {req.category}
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>

                          {/* 4. VALOR */}
                          <td className="px-4 py-3.5 text-right font-mono font-bold text-white group-hover:text-emerald-400 transition-colors whitespace-nowrap">
                            {formatCurrency(req.amount)}
                          </td>

                          {/* 5. DATA */}
                          <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                            {formatDate(req.created_at)}
                          </td>

                          {/* 6. STATUS */}
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {getStatusBadge(req.status)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Rodapé com Paginação Limpa e Configurável (Diretriz 5) */}
            <div
              className="px-5 py-3.5 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"
              style={{
                backgroundColor: "var(--bg-secondary)",
                borderColor: "var(--surface-border)",
              }}
            >
              {/* Resumo de Exibição */}
              <div className="text-slate-400 font-mono">
                {totalFilteredCount > 0 ? (
                  <>
                    Exibindo{" "}
                    <strong className="text-white">{(currentPage - 1) * pageSize + 1}</strong>
                    –
                    <strong className="text-white">
                      {Math.min(currentPage * pageSize, totalFilteredCount)}
                    </strong>{" "}
                    de <strong className="text-emerald-400">{totalFilteredCount}</strong> solicitações
                  </>
                ) : (
                  <span>Nenhum registro encontrado</span>
                )}
              </div>

              {/* Controles de Navegação e Seletor */}
              <div className="flex items-center gap-3">
                {/* Seletor de Itens por Página (20, 50, 100) */}
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="text-slate-400 text-[11px]">Itens:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="px-2 py-1 rounded-lg text-xs text-white border outline-none cursor-pointer"
                    style={{
                      backgroundColor: "var(--bg-card)",
                      borderColor: "var(--surface-border)",
                    }}
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                {/* Botões de Navegação */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1 || totalPages <= 1}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    title="Primeira página"
                  >
                    <ChevronsLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1 || totalPages <= 1}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    title="Página anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <span className="px-2.5 py-1 font-mono text-[11px] text-slate-300 bg-white/[0.04] border border-white/5 rounded-lg">
                    Página <strong className="text-white">{currentPage}</strong> de{" "}
                    <strong className="text-white">{totalPages}</strong>
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || totalPages <= 1}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    title="Próxima página"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages || totalPages <= 1}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    title="Última página"
                  >
                    <ChevronsRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Modals */}
      {isNewModalOpen && (
        <NewRequestModal
          onClose={() => setIsNewModalOpen(false)}
          onSave={() => handleSuccess("Solicitação criada com sucesso!")}
        />
      )}

      {selectedCard && userRole && (
        <CardDetailModal
          card={selectedCard}
          userRole={userRole}
          simulatedUserName={simulatedUserName || "Usuário"}
          profilesMap={profilesMap}
          onClose={() => setSelectedCard(null)}
          onUpdate={(msg) => handleSuccess(msg || "Solicitação atualizada!")}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
