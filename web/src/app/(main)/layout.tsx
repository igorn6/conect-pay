"use client";

import { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";
import GlobalNotification from "@/components/GlobalNotification";
import GlobalHeader from "@/components/GlobalHeader";
import ChatPanel from "@/components/ChatPanel";
import { ChatProvider } from "@/contexts/ChatContext";

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <ChatProvider>
      <div className="flex h-screen w-full overflow-hidden bg-gray-950 text-white">
        <Sidebar />
        <GlobalNotification />
        <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
          <GlobalHeader />
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        </main>
        <ChatPanel />
      </div>
    </ChatProvider>
  );
}
