"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, AlertTriangle, X } from "lucide-react";

interface ToastProps {
  message: string;
  type: "success" | "error" | "warning";
  onClose: () => void;
}

/**
 * Toast notification — aparece no canto superior direito.
 * Auto-desaparece após 4 segundos.
 */
export default function Toast({ message, type, onClose }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger slide-in
    requestAnimationFrame(() => setVisible(true));

    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300); // Wait for fade-out animation
    }, 4000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const isSuccess = type === "success";
  const isWarning = type === "warning";

  const borderColor = isSuccess
    ? "rgba(16, 185, 129, 0.35)"
    : isWarning
    ? "rgba(245, 158, 11, 0.35)"
    : "rgba(239, 68, 68, 0.35)";

  return (
    <div
      className="fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg max-w-md"
      style={{
        backgroundColor: "var(--bg-elevated)",
        border: `1px solid ${borderColor}`,
        boxShadow: "0 12px 36px rgba(0, 0, 0, 0.25)",
        backdropFilter: "blur(16px)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(40px)",
        transition: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {isSuccess ? (
        <CheckCircle size={20} color="#10b981" />
      ) : isWarning ? (
        <AlertTriangle size={20} color="#f59e0b" />
      ) : (
        <XCircle size={20} color="#ef4444" />
      )}

      <span
        className="text-sm font-medium flex-1"
        style={{ color: "var(--text-primary)" }}
      >
        {message}
      </span>

      <button
        onClick={() => {
          setVisible(false);
          setTimeout(onClose, 300);
        }}
        className="p-1 rounded-md cursor-pointer"
        style={{
          color: "var(--text-muted)",
          transition: "var(--transition-base)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--text-primary)";
          e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--text-muted)";
          e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
