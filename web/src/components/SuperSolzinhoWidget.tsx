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
          className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[420px] h-[min(75vh,640px)] rounded-2xl border shadow-2xl backdrop-blur-xl overflow-hidden"
          style={{
            display: isOpen ? "block" : "none",
            backgroundColor: "color-mix(in srgb, var(--bg-secondary) 94%, transparent)",
            borderColor: "var(--surface-border)",
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
        className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full p-0.5 border-2 border-amber-400 shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer overflow-hidden group bg-gradient-to-br from-amber-400 to-orange-500"
      >
        {isOpen ? (
          <div className="w-full h-full rounded-full bg-slate-900/90 text-white flex items-center justify-center backdrop-blur-sm">
            <X size={26} />
          </div>
        ) : (
          <div className="w-full h-full rounded-full overflow-hidden bg-slate-950/20 relative">
            <img
              src="/images/solzinho/solzinho-smart.png"
              alt="Super Solzinho"
              className="w-full h-full object-cover object-center scale-110 group-hover:scale-125 transition-transform duration-300"
            />
            {/* Indicador de presença / online */}
            <span className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900 shadow-sm ring-2 ring-emerald-400/50 animate-pulse" />
          </div>
        )}
      </button>
    </>
  );
}
