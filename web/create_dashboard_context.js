const fs = require('fs');
const path = require('path');

// Fix supabaseServer.ts
const serverCode = `import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
`;
fs.writeFileSync(path.join(process.cwd(), "src/lib/supabaseServer.ts"), serverCode);

// Create DashboardContext.tsx
const ctxCode = `"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { startOfMonth, endOfMonth } from "date-fns";

interface DashboardContextData {
  startDate: Date;
  setStartDate: (date: Date) => void;
  endDate: Date;
  setEndDate: (date: Date) => void;
  selectedSectorId: string | null;
  setSelectedSectorId: (id: string | null) => void;
}

const DashboardContext = createContext<DashboardContextData | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);

  return (
    <DashboardContext.Provider
      value={{
        startDate,
        setStartDate,
        endDate,
        setEndDate,
        selectedSectorId,
        setSelectedSectorId,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}
`;

const ctxDir = path.join(process.cwd(), "src/contexts");
if (!fs.existsSync(ctxDir)) fs.mkdirSync(ctxDir, { recursive: true });
fs.writeFileSync(path.join(ctxDir, "DashboardContext.tsx"), ctxCode);

console.log("DashboardContext.tsx created.");
