"use client";

import { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";
import GlobalNotification from "@/components/GlobalNotification";

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-950 text-white">
      <Sidebar />
      <GlobalNotification />
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
