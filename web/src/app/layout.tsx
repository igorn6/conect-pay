import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ThemeTransitionOverlay from "@/components/ThemeTransitionOverlay";
import { AuthProvider } from "@/contexts/AuthContext";
import NotificationPoller from "@/components/NotificationPoller";
import UpdateNotifier from "@/components/UpdateNotifier";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Conect Pay - Gestão Financeira",
  description: "Painel Kanban para gestão de solicitações de pagamento e controle financeiro.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <ThemeProvider>
            <ThemeTransitionOverlay />
            <NotificationPoller />
            <UpdateNotifier />
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
