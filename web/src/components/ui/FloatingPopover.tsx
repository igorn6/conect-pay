"use client";

import { useEffect, useState, useCallback, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

const subscribeNoop = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

interface FloatingPopoverProps {
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLElement | null>;
  popoverRef?: RefObject<HTMLDivElement | null>;
  align?: "left" | "right";
  width?: number;
  className?: string;
  children: ReactNode;
}

export function FloatingPopover({
  open,
  onClose,
  triggerRef,
  popoverRef,
  align = "left",
  width = 272,
  className = "",
  children,
}: FloatingPopoverProps) {
  const mounted = useSyncExternalStore(subscribeNoop, getClientSnapshot, getServerSnapshot);
  const [coords, setCoords] = useState<{ top: number; left: number; ready: boolean }>({
    top: 0,
    left: 0,
    ready: false,
  });

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || typeof window === "undefined") return;
    const rect = triggerRef.current.getBoundingClientRect();
    const margin = 8;
    const estimatedHeight = popoverRef?.current?.offsetHeight || 340;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = align === "right" ? rect.right - width : rect.left;
    if (left + width > vw - margin) {
      left = Math.max(margin, vw - width - margin);
    }
    if (left < margin) {
      left = margin;
    }

    let top = rect.bottom + 6;
    if (top + estimatedHeight > vh - margin && rect.top - estimatedHeight - 6 > margin) {
      top = rect.top - estimatedHeight - 6;
    }

    setCoords({ top, left, ready: true });
  }, [triggerRef, popoverRef, align, width]);

  useEffect(() => {
    if (!open) {
      const rafReset = requestAnimationFrame(() => {
        setCoords((prev) => (prev.ready ? { ...prev, ready: false } : prev));
      });
      return () => cancelAnimationFrame(rafReset);
    }

    const raf = requestAnimationFrame(updatePosition);

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef?.current?.contains(target)) return;
      const portalEl = document.querySelector("[data-floating-popover-root='true']");
      if (portalEl?.contains(target)) return;
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        triggerRef.current?.focus();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePosition);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, onClose, triggerRef, popoverRef, updatePosition]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      ref={popoverRef}
      data-floating-popover-root="true"
      style={{
        position: "fixed",
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: `${Math.min(width, typeof window !== "undefined" ? window.innerWidth - 16 : width)}px`,
        zIndex: 90,
        opacity: coords.ready ? 1 : 0,
        transform: coords.ready ? "translateY(0)" : "translateY(-4px)",
        transition: "opacity 140ms ease-out, transform 140ms ease-out",
      }}
      className={`rounded-xl bg-[var(--bg-card)] border border-[var(--surface-border)] shadow-[0_18px_45px_rgba(0,0,0,0.55)] backdrop-blur-xl ${className}`}
    >
      {children}
    </div>,
    document.body
  );
}

