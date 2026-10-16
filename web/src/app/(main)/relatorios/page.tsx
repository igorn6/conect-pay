"use client";

import { useState } from "react";
import SuperSolzinhoChat from "@/components/SuperSolzinhoChat";

export default function RelatoriosPage() {
  const [chatKey, setChatKey] = useState(0);

  return (
    <div className="h-full w-full flex flex-col min-h-0 overflow-hidden bg-transparent">
      <SuperSolzinhoChat key={chatKey} variant="page" onReset={() => setChatKey((k) => k + 1)} />
    </div>
  );
}
