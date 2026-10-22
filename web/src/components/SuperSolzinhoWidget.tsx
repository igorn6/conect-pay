"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sun, X } from "lucide-react";
import SuperSolzinhoChat from "@/components/SuperSolzinhoChat";

/**
 * Botão flutuante global do Super Solzinho + janela de chat.
 * Fica montado após a primeira abertura para não perder a conversa ao fechar/abrir a janela.
 * Escondido em /relatorios, onde o chat já aparece em tela cheia.
 */
export default function SuperSolzinhoWidget() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [chatKey, setChatKey] = useState(0);

  if (pathname?.startsWith("/relatorios")) return null;

  const toggle = () => {
    setIsOpen((v) => !v);
    setHasOpened(true);
  };

  return (
    <>
      {hasOpened && (
        <div
          role="dialog"
          aria-label="Super Solzinho"
          className={`fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[420px] h-[min(75vh,640px)] rounded-2xl border shadow-2xl backdrop-blur-xl overflow-hidden transition-all duration-200 ease-out origin-bottom-right motion-reduce:transition-none ${
            isOpen
              ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
              : "opacity-0 scale-95 translate-y-2 pointer-events-none"
          }`}
          style={{
            backgroundColor: "rgba(10, 15, 26, 0.95)",
            borderColor: "rgba(255, 255, 255, 0.12)",
            boxShadow: "0 25px 60px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.08)",
          }}
        >
          <SuperSolzinhoChat key={chatKey} variant="floating" onReset={() => setChatKey((k) => k + 1)} />
        </div>
      )}

      <button
        id="super-solzinho-fab"
        type="button"
        onClick={toggle}
        aria-label={isOpen ? "Fechar Super Solzinho" : "Abrir Super Solzinho"}
        title="Super Solzinho - IA da Conectsol"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 sm:w-15 sm:h-15 rounded-full border border-amber-400/40 bg-slate-900/95 shadow-2xl hover:border-amber-400 hover:scale-105 active:scale-95 hover:shadow-[0_0_28px_rgba(251,191,36,0.45)] transition-all duration-200 ease-out flex items-center justify-center cursor-pointer overflow-hidden group backdrop-blur-md motion-reduce:transition-none motion-reduce:hover:scale-100 p-1"
      >
        {isOpen ? (
          <div className="w-full h-full rounded-full text-slate-300 flex items-center justify-center transition-transform duration-200 rotate-0">
            <X size={22} />
          </div>
        ) : (
          <div className="w-full h-full rounded-full overflow-hidden relative flex items-center justify-center">
            <img
              src="/images/solzinho/solzinho-smart.png"
              alt="Super Solzinho"
              className="w-full h-full object-contain scale-110 group-hover:scale-120 group-hover:drop-shadow-[0_0_10px_rgba(251,191,36,0.7)] transition-all duration-200 ease-out"
            />
            {/* Indicador de presença / online sutil */}
            <span className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950 shadow-xs ring-2 ring-emerald-500/30 animate-pulse" />
          </div>
        )}
      </button>
    </>
  );
}
