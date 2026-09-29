const fs = require("fs");
const path = require("path");
const filePath = path.join(__dirname, "src/app/(main)/page.tsx");
let content = fs.readFileSync(filePath, "utf-8");

const selectionsCode = `  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllInColumn = (ids: string[], isAdding: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (isAdding) {
        ids.forEach(id => next.add(id));
      } else {
        ids.forEach(id => next.delete(id));
      }
      return next;
    });
  };

  const handleMassAction = async (action: "APROVAR" | "RECUSAR" | "LIXEIRA" | "MOVER") => {
    if (selectedIds.size === 0) return;
    
    if (action === "LIXEIRA") {
      if (!window.confirm("Deseja mover " + selectedIds.size + " solicitações para a lixeira?")) return;
      
      const { error } = await supabase
        .from("payment_requests")
        .update({ is_deleted: true })
        .in("id", Array.from(selectedIds));
        
      if (error) {
        showToast("Erro ao excluir", "error");
        return;
      }
      showToast(selectedIds.size + " solicitações removidas", "success");
      setSelectedIds(new Set());
      fetchCards();
    } 
    else if (action === "RECUSAR") {
      const reason = window.prompt("Motivo da recusa para as " + selectedIds.size + " solicitações:");
      if (!reason || !reason.trim()) return;
      
      const { error } = await supabase
        .from("payment_requests")
        .update({ 
          status: "RECUSADO",
          refusal_reason: "Recusado em lote: " + reason.trim()
        })
        .in("id", Array.from(selectedIds));
        
      if (error) {
        showToast("Erro ao recusar", "error");
        return;
      }
      showToast(selectedIds.size + " solicitações recusadas", "success");
      setSelectedIds(new Set());
      fetchCards();
    }
    else if (action === "APROVAR") {
      if (!window.confirm("Deseja avançar " + selectedIds.size + " solicitações para a próxima etapa?")) return;
      
      const NEXT_STATUS = {
        NOVA_SOLICITACAO: "EM_APROVACAO",
        EM_APROVACAO: "AGUARDANDO_NOTINHA",
        AGUARDANDO_NOTINHA: "PAGAMENTO_FINALIZADO",
      };
      
      const toUpdate = Array.from(selectedIds).map(id => cardsRef.current.find(c => c.id === id)).filter(Boolean);
      
      let hasError = false;
      for (const card of toUpdate) {
        if (!card) continue;
        const next = NEXT_STATUS[card.status as keyof typeof NEXT_STATUS];
        if (!next) continue;
        
        const { error } = await supabase.from("payment_requests").update({ status: next }).eq("id", card.id);
        if (error) hasError = true;
      }
      
      if (hasError) showToast("Alguns erros ao avançar", "error");
      else showToast(toUpdate.length + " solicitações avançadas", "success");
      
      setSelectedIds(new Set());
      fetchCards();
    }
  };`;

content = content.replace(
  'const handleSuccess = (message: string) => {',
  selectionsCode + '\n\n  const handleSuccess = (message: string) => {'
);

fs.writeFileSync(filePath, content, "utf-8");
console.log("Injected handlers");
