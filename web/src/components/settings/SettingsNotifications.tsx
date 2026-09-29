"use client";

import { useState, useEffect } from "react";
import { Bell, VolumeX, Volume2, CheckCircle2 } from "lucide-react";

export default function SettingsNotifications() {
  const [isMuted, setIsMuted] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    const muted = localStorage.getItem("conectpay_mute_sounds");
    setIsMuted(muted === "true");
  }, []);

  const handleToggleMute = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    
    if (newState) {
      localStorage.setItem("conectpay_mute_sounds", "true");
      showToast("Alertas sonoros silenciados.");
    } else {
      localStorage.removeItem("conectpay_mute_sounds");
      showToast("Alertas sonoros ativados.");
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Notificações e Alertas</h1>
        <p className="text-slate-400 text-sm">Controle as preferências locais do sistema neste dispositivo.</p>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-sm overflow-hidden p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl ${isMuted ? "bg-slate-700 text-slate-400" : "bg-emerald-500/10 text-emerald-500"}`}>
              {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
            </div>
            <div>
              <h3 className="text-lg font-medium text-slate-200">Silenciar Alertas Sonoros</h3>
              <p className="text-sm text-slate-400 mt-1">
                Desativa o som emitido quando uma nova solicitação é criada não Kanban.
              </p>
            </div>
          </div>

          <button
            onClick={handleToggleMute}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isMuted ? "bg-emerald-500" : "bg-slate-600"}`}
            role="switch"
            aria-checked={isMuted}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isMuted ? "translate-x-5" : "translate-x-0"}`}
            />
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 bg-emerald-500 text-white px-4 py-3 rounded-xl shadow-lg animate-in slide-in-from-bottom-5">
          <CheckCircle2 size={20} />
          <span className="font-medium text-sm">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
