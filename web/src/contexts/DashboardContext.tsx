"use client";

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
