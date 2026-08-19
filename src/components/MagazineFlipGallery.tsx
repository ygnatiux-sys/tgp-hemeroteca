import React, { useState, useEffect, useRef } from 'react';
import type { GalleryImageItem } from '../lib/content-filter';

interface Props {
  images: GalleryImageItem[];
  title?: string;
  accentColor?: string;
}

export function MagazineFlipGallery({ images, title, accentColor = '#EFEBE3' }: Props) {
  if (!images || images.length === 0) return null;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'flipbook' | 'grid'>('flipbook');
  const touchStartX = useRef<number | null>(null);

  const currentItem = images[currentIndex] || images[0];

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  // Soporte de navegación por teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'Escape') setIsZoomOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [images.length]);

  // Gestos táctiles para celular (Touch Swipe)
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diffX = touchStartX.current - e.changedTouches[0].clientX;
    if (diffX > 40) handleNext();
    else if (diffX < -40) handlePrev();
    touchStartX.current = null;
  };

  return (
    <section className="my-16 w-full relative z-20 font-sans select-none">
      {/* Encabezado Editorial del Visor */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-[#EFEBE3]"></span>
          <h3 className="font-metadata text-xs uppercase tracking-[0.25em] text-white/90 font-semibold">
            Registro Visual & Documental ({images.length} {images.length === 1 ? 'lámina' : 'láminas'})
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'flipbook' ? 'grid' : 'flipbook')}
            className="px-3 py-1.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white/80 font-metadata text-[10px] uppercase tracking-wider transition-all duration-300 flex items-center gap-1.5"
            title="Alternar vista"
          >
            {viewMode === 'flipbook' ? 'Mosaico' : 'Visor Amplio'}
          </button>

          <button
            type="button"
            onClick={() => setIsZoomOpen(true)}
            className="px-3.5 py-1.5 rounded-full border border-[#EFEBE3]/40 bg-[#EFEBE3]/10 hover:bg-[#EFEBE3]/20 text-[#EFEBE3] font-metadata text-[10px] uppercase tracking-wider transition-all duration-300 flex items-center gap-1.5"
            title="Ampliar a pantalla completa"
          >
            Pantalla Completa
          </button>
        </div>
      </div>

      {viewMode === 'flipbook' ? (
        /* ═══════════════════════════════════════════════════════════════════
           MODO VISOR AMPLIO & LUMINOSO (Sin doblez de libro)
        ═══════════════════════════════════════════════════════════════════ */
        <div
          className="relative bg-[#0d0f12] border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-4 sm:p-6 md:p-8"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Marco Principal de la Lámina Limpio y Luminoso */}
          <div
            className="relative w-full aspect-16/10 sm:aspect-video max-h-[68vh] rounded-xl overflow-hidden bg-black/80 flex items-center justify-center cursor-zoom-in group"
            onClick={() => setIsZoomOpen(true)}
          >
            <img
              src={currentItem.url || currentItem.thumbUrl}
              alt={currentItem.title}
              className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-[1.01]"
              loading="lazy"
            />

            {/* Badge de Posición / Página */}
            <div className="absolute top-4 left-4 z-20">
              <span className="px-3 py-1 bg-black/80 backdrop-blur-md rounded-full border border-white/15 font-metadata text-[9px] uppercase tracking-[0.2em] text-[#EFEBE3]">
                REGISTRO {String(currentIndex + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
              </span>
            </div>

            {/* Botón Lupa Esquina Superior Derecha */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsZoomOpen(true);
              }}
              className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-black/75 hover:bg-[#EFEBE3] text-white hover:text-black border border-white/20 flex items-center justify-center transition-all duration-300 shadow-xl"
              title="Ampliar imagen"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>

            {/* Flechas de Navegación Flotantes */}
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/75 hover:bg-[#EFEBE3] text-white hover:text-black border border-white/20 flex items-center justify-center transition-all duration-300 backdrop-blur-md shadow-2xl"
              title="Lámina anterior (←)"
            >
              ❮
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="absolute right-3 md:right-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/75 hover:bg-[#EFEBE3] text-white hover:text-black border border-white/20 flex items-center justify-center transition-all duration-300 backdrop-blur-md shadow-2xl"
              title="Lámina siguiente (→)"
            >
              ❯
            </button>
          </div>

          {/* Información y Pie de Lámina Limpio de Metadata Técnica */}
          <div className="mt-5 pt-4 border-t border-white/8 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="max-w-2xl flex flex-col gap-1">
              <h4 className="font-serif italic text-base md:text-lg text-white/95 leading-snug">
                {currentItem.title}
              </h4>
              {currentItem.caption && currentItem.caption !== currentItem.title && (
                <p className="text-white/60 text-xs font-sans line-clamp-2">
                  {currentItem.caption}
                </p>
              )}
            </div>

            <div className="flex flex-col md:items-end gap-1 font-metadata text-[10px] text-white/50">
              {currentItem.author ? (
                <span className="text-white/70">Atribución / Autor: {currentItem.author}</span>
              ) : null}
              <span className="text-[#EFEBE3]/70 tracking-wider">
                Documentación fotográfica original del archivo
              </span>
            </div>
          </div>

          {/* Tira Inferior de Miniaturas (Filmstrip) */}
          <div className="mt-5 flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/20">
            {images.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`relative shrink-0 w-18 md:w-22 aspect-4/3 rounded-lg overflow-hidden border-2 transition-all duration-300 ${
                  currentIndex === idx
                    ? 'border-[#EFEBE3] scale-105 shadow-lg opacity-100'
                    : 'border-white/10 opacity-50 hover:opacity-90 hover:border-white/30'
                }`}
                title={`Ver registro #${idx + 1}: ${item.title}`}
              >
                <img src={item.thumbUrl || item.url} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                <span className="absolute bottom-0.5 right-1 px-1 rounded bg-black/80 font-metadata text-[8px] text-white/80">
                  {idx + 1}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ═══════════════════════════════════════════════════════════════════
           MODO MOSAICO / CUADRÍCULA EDITORIAL
        ═══════════════════════════════════════════════════════════════════ */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {images.map((item, idx) => (
            <div
              key={idx}
              className="group relative bg-[#101216] border border-white/10 rounded-xl overflow-hidden hover:border-[#EFEBE3]/60 transition-all duration-500 cursor-pointer shadow-xl"
              onClick={() => {
                setCurrentIndex(idx);
                setIsZoomOpen(true);
              }}
            >
              <div className="aspect-4/3 overflow-hidden bg-black/50 relative">
                <img
                  src={item.thumbUrl || item.url}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                  loading="lazy"
                />
                <div className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white font-metadata text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
              </div>
              <div className="p-4 flex flex-col gap-1.5">
                <h5 className="font-serif italic text-sm text-white/90 line-clamp-1 group-hover:text-[#EFEBE3] transition-colors">
                  {item.title}
                </h5>
                <div className="flex items-center justify-between font-metadata text-[9px] text-white/40 uppercase">
                  <span>Lámina #{idx + 1}</span>
                  {item.author && <span className="truncate max-w-28 text-white/60">{item.author}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          VISOR MODAL PANTALLA COMPLETA
      ═══════════════════════════════════════════════════════════════════ */}
      {isZoomOpen && (
        <div
          className="fixed inset-0 z-99999 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 md:p-8 animate-fadeIn"
          onClick={() => setIsZoomOpen(false)}
        >
          <div
            className="relative w-full max-w-5xl max-h-[90vh] bg-[#0c0d11] border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Barra de Control Superior */}
            <div className="p-4 bg-black/70 border-b border-white/10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-0.5 rounded-full bg-[#EFEBE3]/20 border border-[#EFEBE3]/40 font-metadata text-[10px] text-[#EFEBE3] uppercase tracking-wider">
                  Lámina {currentIndex + 1} / {images.length}
                </span>
                <h4 className="font-serif italic text-sm text-white/90 truncate max-w-xs md:max-w-md">
                  {currentItem.title}
                </h4>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={currentItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-white/80 font-metadata text-[10px] uppercase tracking-wider transition-colors"
                  title="Abrir imagen original"
                >
                  ↗ Original
                </a>
                <button
                  type="button"
                  onClick={() => setIsZoomOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-600 text-white flex items-center justify-center font-bold text-sm transition-colors"
                  title="Cerrar (Esc)"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Imagen Principal */}
            <div className="relative flex-1 bg-black flex items-center justify-center p-4 min-h-100 overflow-hidden">
              <img
                src={currentItem.url || currentItem.thumbUrl}
                alt={currentItem.title}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl transition-all duration-300"
              />

              <button
                type="button"
                onClick={handlePrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/70 hover:bg-[#EFEBE3] text-white hover:text-black border border-white/20 flex items-center justify-center text-lg font-bold transition-all duration-300 shadow-2xl"
                title="Foto anterior"
              >
                ❮
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/70 hover:bg-[#EFEBE3] text-white hover:text-black border border-white/20 flex items-center justify-center text-lg font-bold transition-all duration-300 shadow-2xl"
                title="Foto siguiente"
              >
                ❯
              </button>
            </div>

            {/* Pie de Visor */}
            <div className="p-4 bg-[#0a0a0e] border-t border-white/10 flex items-center justify-between text-xs font-metadata text-white/60 flex-wrap gap-2">
              <div>
                {currentItem.author ? (
                  <span>Autor / Atribución: <span className="text-white/80">{currentItem.author}</span></span>
                ) : (
                  <span className="text-white/50">Registro documental original</span>
                )}
              </div>

              <div className="text-white/40">
                <span>Navegación: ← / → · Cerrar: Esc</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
