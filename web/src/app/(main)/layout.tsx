"use client";

import { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";
import GlobalNotification from "@/components/GlobalNotification";
import GlobalHeader from "@/components/GlobalHeader";
import ChatPanel from "@/components/ChatPanel";
import SuperSolzinhoWidget from "@/components/SuperSolzinhoWidget";
import { ChatProvider } from "@/contexts/ChatContext";

import AuroraBackground from "@/components/ui/AuroraBackground";

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <ChatProvider>
      <div className="flex h-screen w-full overflow-hidden text-white relative" style={{ backgroundColor: "var(--bg-primary)" }}>
        {/* Layered Aurora & Noise Background */}
        <AuroraBackground className="absolute inset-0 -z-10 pointer-events-none terminal-grid" intensity="subtle" />
        
        <Sidebar />
        <GlobalNotification />
        <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative z-10">
          <GlobalHeader />
          <div className="flex-1 overflow-hidden relative">
            {children}
          </div>
        </main>
        <ChatPanel />
        <SuperSolzinhoWidget />
      </div>
    </ChatProvider>
  );
}
