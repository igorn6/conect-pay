"use client";

import { useEffect, useState, useCallback } from "react";
import { Sparkles, RotateCw, X } from "lucide-react";
import { APP_VERSION } from "@/constants/version";

export default function UpdateNotifier() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [isReloading, setIsReloading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const checkForUpdate = useCallback(async () => {
    try {
      const res = await fetch(`/api/version?t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      if (!res.ok) return;

      const data = await res.json();
      if (data?.version && data.version !== APP_VERSION) {
        setHasUpdate(true);
        setNewVersion(data.version);
      }
    } catch {
      // Ignora falhas temporárias de rede
    }
  }, []);

  useEffect(() => {
    // Checagem inicial após 5 segundos
    const initialTimer = setTimeout(checkForUpdate, 5000);

    // Intervalo de verificação a cada 30 segundos
    const interval = setInterval(checkForUpdate, 30000);

    // Checar também ao voltar para a aba
    const handleFocus = () => checkForUpdate();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkForUpdate();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkForUpdate]);

  const handleReload = async () => {
    setIsReloading(true);
    try {
      // Atualiza service workers se existirem
      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.update();
        }
      }
    } catch (e) {
      console.warn("Falha ao atualizar service worker:", e);
    }
    // Força recarregamento da página sem cache
    window.location.reload();
  };

  if (!hasUpdate || dismissed) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] max-w-sm sm:max-w-md animate-in slide-in-from-bottom-5 duration-300">
      <div className="p-4 rounded-2xl bg-slate-900/95 border border-emerald-500/50 shadow-2xl shadow-emerald-950/50 backdrop-blur-md flex items-center gap-3.5 text-slate-100">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 text-emerald-400">
          <Sparkles size={20} className="animate-pulse" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold text-white">Nova atualização disponível!</p>
            {newVersion && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                v{newVersion}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 truncate mt-0.5">
            Clique no botão para recarregar e aplicar as novidades.
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleReload}
            disabled={isReloading}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/40 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            title="Recarregar aplicação"
          >
            <RotateCw size={13} className={isReloading ? "animate-spin" : ""} />
            <span>{isReloading ? "Atualizando..." : "Recarregar"}</span>
          </button>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar aviso por enquanto"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
