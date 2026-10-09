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
        title="Super Solzinho"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-yellow-400 hover:bg-yellow-300 text-slate-900 shadow-lg shadow-yellow-500/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
      >
        {isOpen ? <X size={26} /> : <Sun size={28} className="text-slate-900" />}
      </button>
    </>
  );
}
