"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import SuperSolzinhoChat from "@/components/SuperSolzinhoChat";

export default function RelatoriosPage() {
  const [chatKey, setChatKey] = useState(0);

  return (
    <div className="h-full w-full flex flex-col p-4 md:p-6 gap-4 overflow-hidden">
      <div className="shrink-0 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-amber-400 shadow-md shadow-amber-500/20 shrink-0 bg-gradient-to-br from-amber-400/20 to-orange-500/20 ring-4 ring-amber-400/10">
            <img
              src="/images/solzinho/solzinho-smart.png"
              alt="Super Solzinho - Relatórios Inteligentes"
              className="w-full h-full object-cover object-center scale-110"
            />
          </div>
          <div>
            <h1
              className="text-2xl font-bold tracking-tight flex items-center gap-2"
              style={{ color: "var(--text-primary)" }}
            >
              Relatórios com Super Solzinho
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Inteligência Artificial da Conectsol para análise de gastos, gargalos e solicitantes em tempo real.
            </p>
          </div>
        </div>
      </div>

      <div
        className="flex-1 min-h-0 rounded-2xl border overflow-hidden"
        style={{
          backgroundColor: "color-mix(in srgb, var(--bg-secondary) 80%, transparent)",
          borderColor: "var(--surface-border)",
        }}
      >
        <SuperSolzinhoChat key={chatKey} variant="page" onReset={() => setChatKey((k) => k + 1)} />
      </div>
    </div>
  );
}
