"use client";

import { X, CheckCircle, Ban, Trash2, ArrowRight } from "lucide-react";

interface MassActionBarProps {
  selectedCount: number;
  onClear: () => void;
  onAction: (action: "APROVAR" | "RECUSAR" | "LIXEIRA" | "MOVER") => void;
}

export default function MassActionBar({ selectedCount, onClear, onAction }: MassActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-4 bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl shadow-black/50 animate-in slide-in-from-bottom-8 duration-300">
      
      {/* Contador */}
      <div className="flex items-center gap-3 pr-4 border-r border-gray-700">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white font-bold text-xs">
          {selectedCount}
        </span>
        <span className="text-sm font-medium text-gray-200">
          {selectedCount === 1 ? "solicitação selecionada" : "solicitações selecionadas"}
        </span>
      </div>

      {/* Aes */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onAction("APROVAR")}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
        >
          <CheckCircle size={16} />
          Avançar
        </button>

        <button
          onClick={() => onAction("RECUSAR")}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
        >
          <Ban size={16} />
          Recusar
        </button>

        <button
          onClick={() => onAction("LIXEIRA")}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
        >
          <Trash2 size={16} />
          Lixeira
        </button>
      </div>

      {/* Botão Fechar */}
      <button
        onClick={onClear}
        className="ml-2 p-1 text-gray-500 hover:text-white transition-colors rounded-full hover:bg-gray-800"
        title="Limpar seleção"
      >
        <X size={20} />
      </button>
    </div>
  );
}
