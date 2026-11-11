"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Check,
  Move,
  Sparkles,
  Maximize2,
  RefreshCw,
} from "lucide-react";

interface PhotoCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  title: string;
  onClose: () => void;
  onApply: (croppedFile: File, croppedUrl: string) => void;
}

export default function PhotoCropModal({
  isOpen,
  imageSrc,
  title,
  onClose,
  onApply,
}: PhotoCropModalProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [applying, setApplying] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Resetar estados ao abrir com nova imagem
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setPan({ x: 0, y: 0 });
      setImageLoaded(false);
      setApplying(false);
    }
  }, [isOpen, imageSrc]);

  // Manipulação de Zoom via roda do mouse (Wheel)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom((prev) => Math.min(Math.max(prev + zoomFactor, 0.8), 5));
  }, []);

  // Iniciar arraste (Mouse ou Touch)
  const handlePointerDown = (clientX: number, clientY: number) => {
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

  // Girar 90 graus
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Redefinir para padrão
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  // Renderizar o corte no HTML5 Canvas e exportar como File
  const handleApplyCrop = async () => {
    if (!imgRef.current || !containerRef.current) return;

    try {
      setApplying(true);
      const img = imgRef.current;
      const cropArea = containerRef.current.getBoundingClientRect();

      // Resolução de saída de alta definição (16:9 widescreen para odômetro)
      const targetWidth = 1280;
      const targetHeight = 720;

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Não foi possível inicializar o canvas de corte.");
      }

      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      // Fator de escala entre o container na tela e o canvas final
      const scaleToCanvas = targetWidth / cropArea.width;

      ctx.save();
      // Mover origem para o centro do canvas
      ctx.translate(targetWidth / 2, targetHeight / 2);

      // Aplicar rotação
      ctx.rotate((rotation * Math.PI) / 180);

      // Aplicar Pan e Zoom
      ctx.translate(pan.x * scaleToCanvas, pan.y * scaleToCanvas);
      ctx.scale(zoom * scaleToCanvas, zoom * scaleToCanvas);

      // Desenhar a imagem centralizada no ponto de origem
      // Determinar o tamanho base da imagem mantendo proporção na tela
      const imgNaturalWidth = img.naturalWidth || 800;
      const imgNaturalHeight = img.naturalHeight || 600;

      // Escala inicial de ajuste (contain na viewport)
      const initialScale = Math.min(
        cropArea.width / imgNaturalWidth,
        cropArea.height / imgNaturalHeight
      );

      const renderW = imgNaturalWidth * initialScale;
      const renderH = imgNaturalHeight * initialScale;

      ctx.drawImage(img, -renderW / 2, -renderH / 2, renderW, renderH);
      ctx.restore();

      // Converter canvas para Blob JPEG
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setApplying(false);
            return;
          }

          const fileName = `odometer_cropped_${Date.now()}.jpg`;
          const croppedFile = new File([blob], fileName, { type: "image/jpeg" });
          const croppedUrl = URL.createObjectURL(blob);

          onApply(croppedFile, croppedUrl);
          onClose();
        },
        "image/jpeg",
        0.92
      );
    } catch (err) {
      console.error("Erro ao aplicar corte:", err);
      setApplying(false);
    }
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-200"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--surface-border)",
        }}
      >
        {/* Cabeçalho do Editor */}
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b shrink-0"
          style={{ borderColor: "var(--surface-border)" }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">{title}</h3>
              <p className="text-[11px] text-slate-400">
                Arraste a foto e dê zoom para enquadrar os números perfeitamente.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Viewport Interativa de Corte */}
        <div className="flex-1 bg-black/95 p-4 sm:p-6 flex flex-col items-center justify-center select-none overflow-hidden relative min-h-[320px]">
          {/* Caixa de enquadramento (Crop Target Window) */}
          <div
            ref={containerRef}
            onWheel={handleWheel}
            onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
            onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={(e) => {
              if (e.touches[0]) {
                handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
            onTouchMove={(e) => {
              if (e.touches[0]) {
                handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
            onTouchEnd={handlePointerUp}
            className={`relative w-full max-w-xl aspect-video rounded-xl overflow-hidden border-2 border-amber-400/90 shadow-[0_0_40px_rgba(0,0,0,0.9)] cursor-grab active:cursor-grabbing ${
              isDragging ? "cursor-grabbing" : ""
            }`}
            style={{
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.75)",
            }}
          >
            {/* Grade de Enquadramento (Rule of Thirds) */}
            <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 z-20 opacity-30">
              <div className="border-r border-b border-amber-300/40" />
              <div className="border-r border-b border-amber-300/40" />
              <div className="border-b border-amber-300/40" />
              <div className="border-r border-b border-amber-300/40" />
              <div className="border-r border-b border-amber-300/40" />
              <div className="border-b border-amber-300/40" />
              <div className="border-r border-amber-300/40" />
              <div className="border-r border-amber-300/40" />
              <div />
            </div>

            {/* Marcadores dos 4 cantos */}
            <span className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-amber-400 z-30 pointer-events-none" />
            <span className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-amber-400 z-30 pointer-events-none" />
            <span className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-amber-400 z-30 pointer-events-none" />
            <span className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-amber-400 z-30 pointer-events-none" />

            {/* Imagem com Transformações */}
            <div className="absolute inset-0 flex items-center justify-center">
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Enquadramento do Odômetro"
                draggable={false}
                onLoad={() => setImageLoaded(true)}
                className="max-w-none transition-transform duration-75 origin-center pointer-events-none"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
                  maxHeight: "100%",
                  maxWidth: "100%",
                }}
              />
            </div>

            {/* Dica flutuante sobre a área */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none bg-black/75 px-3 py-1 rounded-full text-[10px] text-amber-300 font-medium backdrop-blur-sm border border-amber-400/30 flex items-center gap-1.5 whitespace-nowrap">
              <Move size={11} />
              <span>Arraste para mover · Roda do mouse ou barra para zoom</span>
            </div>
          </div>
        </div>

        {/* Barra de Controles (Zoom, Giro, Reset) */}
        <div
          className="p-4 sm:p-5 border-t space-y-4 shrink-0"
          style={{
            backgroundColor: "var(--bg-primary)",
            borderColor: "var(--surface-border)",
          }}
        >
          {/* Linha 1: Controles de Zoom e Giro */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Slider de Zoom */}
            <div className="flex items-center gap-3 w-full sm:w-auto flex-1 max-w-md">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(z - 0.2, 0.8))}
                className="p-2 rounded-xl border text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                style={{ borderColor: "var(--surface-border)" }}
                title="Diminuir Zoom"
              >
                <ZoomOut size={16} />
              </button>

              <div className="flex-1 flex items-center gap-2">
                <input
                  type="range"
                  min="0.8"
                  max="4.0"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <span className="text-xs font-mono font-bold text-amber-400 w-12 text-right shrink-0">
                  {Math.round(zoom * 100)}%
                </span>
              </div>

              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(z + 0.2, 4.0))}
                className="p-2 rounded-xl border text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                style={{ borderColor: "var(--surface-border)" }}
                title="Aumentar Zoom"
              >
                <ZoomIn size={16} />
              </button>
            </div>

            {/* Botões de Ação de Ferramenta */}
            <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
              <button
                type="button"
                onClick={handleRotate}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                style={{ borderColor: "var(--surface-border)" }}
                title="Girar 90 graus"
              >
                <RotateCw size={14} className="text-amber-400" />
                <span>Girar 90°</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                style={{ borderColor: "var(--surface-border)" }}
                title="Restaurar zoom e posição inicial"
              >
                <RotateCcw size={14} className="text-slate-400" />
                <span>Resetar</span>
              </button>
            </div>
          </div>

          {/* Linha 2: Botões de Salvar / Cancelar */}
          <div
            className="flex items-center justify-between pt-3 border-t flex-wrap gap-2"
            style={{ borderColor: "var(--surface-border)" }}
          >
            <p className="text-xs text-slate-400">
              O corte será salvo em alta definição para leitura clara do odômetro.
            </p>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={applying}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleApplyCrop}
                disabled={applying || !imageLoaded}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-950/40 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {applying ? (
                  <>
                    <RefreshCw size={14} className="animate-spin text-slate-950" />
                    <span>Enquadrando...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} className="text-slate-950 stroke-[3]" />
                    <span>Aplicar Enquadramento</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

