"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import SuperSolzinhoChat from "@/components/SuperSolzinhoChat";

export default function RelatoriosPage() {
  const [chatKey, setChatKey] = useState(0);

  return (
    <div className="h-full w-full flex flex-col p-4 md:p-6 gap-4 overflow-hidden">
      <div className="shrink-0">
        <h1
          className="text-2xl font-bold tracking-tight flex items-center gap-2"
          style={{ color: "var(--text-primary)" }}
        >
          <BarChart3 size={24} className="text-yellow-500" />
          Relatórios com IA
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Converse com o Super Solzinho para analisar gastos, gargalos e solicitantes em tempo real.
        </p>
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
