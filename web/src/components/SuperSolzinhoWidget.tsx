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
        className="fixed bottom-6 right-6 z-50 w-13 h-13 sm:w-14 sm:h-14 rounded-full border border-white/15 bg-slate-900/90 shadow-2xl hover:border-amber-400/40 hover:scale-105 active:scale-95 hover:shadow-[0_0_24px_rgba(251,191,36,0.35)] transition-all duration-200 ease-out flex items-center justify-center cursor-pointer overflow-hidden group backdrop-blur-md motion-reduce:transition-none motion-reduce:hover:scale-100"
      >
        {isOpen ? (
          <div className="w-full h-full rounded-full text-slate-300 flex items-center justify-center transition-transform duration-200 rotate-0">
            <X size={22} />
          </div>
        ) : (
          <div className="w-full h-full rounded-full overflow-hidden p-1.5 relative flex items-center justify-center">
            <img
              src="/images/solzinho/solzinho-smart.png"
              alt="Super Solzinho"
              className="w-full h-full object-contain scale-105 group-hover:scale-115 group-hover:drop-shadow-[0_0_8px_rgba(251,191,36,0.6)] transition-all duration-200 ease-out"
            />
            {/* Indicador de presença / online sutil */}
            <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-500/80 border border-slate-950 shadow-xs" />
          </div>
        )}
      </button>
    </>
  );
}
