"use client";

import { useState, useEffect } from "react";
import {
  Bell,
  VolumeX,
  Volume2,
  CheckCircle2,
  ShieldAlert,
  Send,
  Loader2,
  ExternalLink,
  Laptop,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  subscribeToPush,
  unsubscribeFromPush,
  getPushSubscription,
  sendPushNotification,
} from "@/lib/pushNotifications";

export default function SettingsNotifications() {
  const { userId } = useAuth();
  const [isMuted, setIsMuted] = useState(false);
  const [isPushActive, setIsPushActive] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<string>("default");
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    const muted = localStorage.getItem("conectpay_mute_sounds");
    setIsMuted(muted === "true");

    if (typeof window !== "undefined" && "Notification" in window) {
      setPermissionStatus(Notification.permission);
    }

    checkPushStatus();
  }, []);

  const checkPushStatus = async () => {
    try {
      const sub = await getPushSubscription();
      setIsPushActive(!!sub);
    } catch (e) {
      console.warn("Erro ao checar subscrição:", e);
    }
  };

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

  const handleTogglePush = async () => {
    if (!userId) {
      showToast("Faça login para configurar notificações.");
      return;
    }

    setPushLoading(true);
    try {
      if (isPushActive) {
        await unsubscribeFromPush();
        setIsPushActive(false);
        showToast("Notificações em segundo plano desativadas.");
      } else {
        const success = await subscribeToPush(userId);
        if (success) {
          setIsPushActive(true);
          setPermissionStatus(Notification.permission);
          showToast("Notificações em segundo plano ativadas com sucesso!");
        }
      }
    } catch (err: any) {
      alert("Erro ao alterar notificações push: " + err.message);
    } finally {
      setPushLoading(false);
    }
  };

  const handleSendTestPush = async () => {
    if (!userId) return;
    setTestLoading(true);
    try {
      const res = await sendPushNotification({
        title: "🔔 Teste de Notificação - Conect Pay",
        body: "Seu sistema está configurado para receber alertas mesmo em segundo plano!",
        targetRoles: ["MASTER", "FINANCEIRO", "GESTOR", "SOLICITANTE"],
      });

      if (res && res.sentCount > 0) {
        showToast(`Notificação enviada com sucesso para ${res.sentCount} dispositivo(s)!`);
      } else {
        showToast("Push disparado! Se você não recebeu, ative as notificações acima.");
      }
    } catch (e) {
      alert("Erro ao disparar teste.");
    } finally {
      setTestLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-3xl space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Notificações e Alertas</h1>
        <p className="text-slate-400 text-sm">
          Configure a entrega em segundo plano e preferências sonoras para nunca perder solicitações.
        </p>
      </div>

      {/* 1. Web Push em Segundo Plano (Solução Definitiva) */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-sm p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-xl ${
                isPushActive
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-slate-700 text-slate-400"
              }`}
            >
              <Bell size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-medium text-slate-200">
                  Notificações em Segundo Plano (Web Push Nativo)
                </h3>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                    isPushActive
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  }`}
                >
                  {isPushActive ? "Ativo neste dispositivo" : "Inativo"}
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1 max-w-xl">
                Permite que o Conect Pay envie alertas nativos da área de trabalho do Windows/Mac mesmo
                quando a aba estiver em segundo plano, minimizada ou com o navegador inativo.
              </p>
            </div>
          </div>

          <button
            onClick={handleTogglePush}
            disabled={pushLoading}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              isPushActive
                ? "bg-slate-700 hover:bg-slate-600 text-slate-300"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25"
            }`}
          >
            {pushLoading && <Loader2 size={16} className="animate-spin" />}
            {isPushActive ? "Desativar" : "Ativar Notificações"}
          </button>
        </div>

        {isPushActive && (
          <div className="pt-4 border-t border-slate-700/60 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Permissão do navegador:{" "}
              <strong className="text-slate-200 capitalize">{permissionStatus}</strong>
            </span>
            <button
              onClick={handleSendTestPush}
              disabled={testLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors flex items-center gap-1.5"
            >
              {testLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Enviar Alerta de Teste
            </button>
          </div>
        )}
      </div>

      {/* 2. Alertas Sonoros */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-xl ${
                isMuted ? "bg-slate-700 text-slate-400" : "bg-emerald-500/10 text-emerald-500"
              }`}
            >
              {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
            </div>
            <div>
              <h3 className="text-lg font-medium text-slate-200">Silenciar Alertas Sonoros</h3>
              <p className="text-sm text-slate-400 mt-1">
                Desativa o bip emitido quando uma nova solicitação é criada ou atualizada.
              </p>
            </div>
          </div>

          <button
            onClick={handleToggleMute}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isMuted ? "bg-slate-600" : "bg-emerald-500"
            }`}
            role="switch"
            aria-checked={!isMuted}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                isMuted ? "translate-x-0" : "translate-x-5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* 3. Guia de Configuração do Navegador (Solução 1 - Anti-Congelamento) */}
      <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 mt-0.5">
            <Laptop size={20} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">
              Como evitar que o Windows/Navegador congele a aba do Conect Pay
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Navegadores como Chrome e Edge colocam abas inativas para &quot;dormir&quot; (Memory Saver) para economizar bateria e memória RAM. Siga estes passos para manter o Conect Pay 100% ativo:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/50 space-y-2">
            <h4 className="font-semibold text-blue-400 flex items-center gap-1.5">
              <span>Google Chrome</span>
            </h4>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-300 leading-relaxed">
              <li>
                Digite <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-300">chrome://settings/performance</code> na barra de endereços.
              </li>
              <li>
                Localize a seção <strong>&quot;Sempre manter estes sites ativos&quot;</strong>.
              </li>
              <li>
                Clique em <strong>Adicionar</strong> e coloque a URL do Conect Pay.
              </li>
            </ol>
          </div>

          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/50 space-y-2">
            <h4 className="font-semibold text-blue-400 flex items-center gap-1.5">
              <span>Microsoft Edge</span>
            </h4>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-300 leading-relaxed">
              <li>
                Digite <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-300">edge://settings/system</code> na barra de endereços.
              </li>
              <li>
                Na seção <strong>&quot;Otimizar Desempenho&quot;</strong>, procure <strong>&quot;Nunca colocar estes sites para dormir&quot;</strong>.
              </li>
              <li>
                Clique em <strong>Adicionar</strong> e insira o endereço do Conect Pay.
              </li>
            </ol>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-700/40 flex items-center justify-between text-xs text-slate-400">
          <span>💡 <strong>Dica Pro:</strong> Você também pode clicar no ícone de &quot;Instalar Conect Pay&quot; na barra do navegador para usá-lo como um aplicativo independente de desktop.</span>
        </div>
      </div>

      {toastMessage && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 bg-emerald-500 text-white px-4 py-3 rounded-xl shadow-lg animate-in slide-in-from-bottom-5 z-50">
          <CheckCircle2 size={20} />
          <span className="font-medium text-sm">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
