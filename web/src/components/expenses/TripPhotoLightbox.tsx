"use client";

import { useState, useCallback, useRef } from "react";
import {
  X,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Move,
} from "lucide-react";

interface TripPhotoLightboxProps {
  url: string | null;
  title: string;
  onClose: () => void;
}

export default function TripPhotoLightbox({
  url,
  title,
  onClose,
}: TripPhotoLightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 0.2 : -0.2;
    setZoom((prev) => Math.min(Math.max(prev + factor, 0.5), 5));
  }, []);

  const handlePointerDown = (clientX: number, clientY: number) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({
      x: clientX - pan.x,
      y: clientY - pan.y,
    });
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    setPan({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y,
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const handleRotate = () => {
    setRotation((r) => (r + 90) % 360);
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  if (!url) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-w-5xl max-h-[92vh] w-full flex flex-col rounded-2xl overflow-hidden border shadow-2xl animate-in zoom-in-95 duration-200"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--surface-border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do Lightbox com Ferramentas de Zoom & Giro */}
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-3 border-b shrink-0 flex-wrap gap-2"
          style={{ borderColor: "var(--surface-border)" }}
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">{title}</h3>
          </div>

          {/* Barra de Ferramentas de Zoom e Rotação */}
          <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Diminuir Zoom"
            >
              <ZoomOut size={15} />
            </button>

            <span className="text-[11px] font-mono font-bold text-amber-300 w-11 text-center select-none">
              {Math.round(zoom * 100)}%
            </span>

            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(z + 0.25, 5))}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Aumentar Zoom"
            >
              <ZoomIn size={15} />
            </button>

            <div className="h-4 w-px bg-white/15 mx-1" />

            <button
              type="button"
              onClick={handleRotate}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Girar 90 graus"
            >
              <RotateCw size={15} />
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Resetar Zoom e Posição"
            >
              <RotateCcw size={15} />
            </button>

            <div className="h-4 w-px bg-white/15 mx-1" />

            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Abrir imagem original em nova aba"
            >
              <ExternalLink size={15} />
            </a>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Fechar"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Viewport Interativa da Imagem */}
        <div
          onWheel={handleWheel}
          onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
          onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          className={`flex-1 overflow-hidden p-4 flex items-center justify-center bg-black/90 min-h-[420px] select-none ${
            zoom > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
          }`}
        >
          <img
            src={url}
            alt={title}
            draggable={false}
            className="max-w-full max-h-[72vh] object-contain rounded-lg shadow-2xl transition-transform duration-75 origin-center pointer-events-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
            }}
          />
        </div>

        {/* Rodapé com atalhos de instrução */}
        <div
          className="px-5 py-2 border-t flex items-center justify-between text-[11px] text-slate-400 shrink-0"
          style={{ borderColor: "var(--surface-border)" }}
        >
          <span>Use a roda do mouse ou a barra superior para dar zoom de até 500% nos números.</span>
          {zoom > 1 && (
            <span className="text-amber-400 font-semibold flex items-center gap-1">
              <Move size={12} /> Clique e arraste para navegar pela foto
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
