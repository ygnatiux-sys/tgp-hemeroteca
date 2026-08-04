import React, { useState, useEffect, useRef } from 'react';
import type { GalleryImageItem } from '../lib/content-filter';

interface Props {
  images: GalleryImageItem[];
  title?: string;
  accentColor?: string;
}

export function MagazineFlipGallery({ images, title, accentColor = '#C8A98B' }: Props) {
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
      {/* Encabezado Editorial del Magazine Flipbook */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accentColor }}></span>
          <h3 className="font-mono text-xs md:text-sm uppercase tracking-[0.25em] text-white/90 font-semibold">
            📖 Magazine Flipbook · Registro Visual ({images.length} {images.length === 1 ? 'Lámina' : 'Láminas'})
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'flipbook' ? 'grid' : 'flipbook')}
            className="px-3 py-1.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white/80 font-mono text-[10px] uppercase tracking-wider transition-all duration-300 flex items-center gap-1.5"
            title="Alternar entre modo revista y cuadrícula"
          >
            {viewMode === 'flipbook' ? '▦ Ver Mosaico' : '📖 Modo Revista'}
          </button>

          <button
            type="button"
            onClick={() => setIsZoomOpen(true)}
            className="px-3 py-1.5 rounded-full border border-[#C8A98B]/40 bg-[#C8A98B]/10 hover:bg-[#C8A98B]/20 text-[#C8A98B] font-mono text-[10px] uppercase tracking-wider transition-all duration-300 flex items-center gap-1.5"
            title="Ampliar imagen al 60% de pantalla con Lupa"
          >
            🔍 Lupa 60% Screen
          </button>
        </div>
      </div>

      {viewMode === 'flipbook' ? (
        /* ═══════════════════════════════════════════════════════════════════
           MODO FLIPBOOK / MAGAZINE SPREAD EDITORIAL
        ═══════════════════════════════════════════════════════════════════ */
        <div
          className="relative bg-gradient-to-b from-[#16161f] to-[#0d0d12] border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-4 md:p-8"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Sombra de Encuadernación Central para Efecto Revista */}
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-8 bg-gradient-to-r from-transparent via-black/30 to-transparent pointer-events-none z-10 hidden md:block"></div>

          {/* Marco Principal de la Lámina */}
          <div
            className="relative w-full aspect-[4/3] md:aspect-[16/10] max-h-[620px] rounded-xl overflow-hidden bg-black/60 flex items-center justify-center cursor-zoom-in group"
            onClick={() => setIsZoomOpen(true)}
          >
            <img
              src={currentItem.url || currentItem.thumbUrl}
              alt={currentItem.title}
              className="w-full h-full object-contain md:object-cover transition-transform duration-700 group-hover:scale-[1.02]"
              loading="lazy"
            />

            {/* Overlay sutil al hover con botón de lupa */}
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
              <div className="px-4 py-2 rounded-full bg-black/80 border border-white/30 text-white font-mono text-xs uppercase tracking-widest backdrop-blur-md flex items-center gap-2 shadow-2xl">
                <span>🔍 Click para Lupa 60%</span>
              </div>
            </div>

            {/* Badge de Posición / Página */}
            <div className="absolute top-4 left-4 z-20">
              <span className="px-3 py-1 bg-black/80 backdrop-blur-md rounded-full border border-white/20 font-mono text-[10px] uppercase tracking-[0.2em] text-[#C8A98B]">
                LÁMINA {String(currentIndex + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
              </span>
            </div>

            {/* Botón Lupa Esquina Superior Derecha */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsZoomOpen(true);
              }}
              className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-black/70 hover:bg-[#C8A98B] text-white hover:text-black border border-white/20 flex items-center justify-center transition-all duration-300 shadow-xl"
              title="Abrir lupa a 60% de pantalla"
            >
              🔍
            </button>

            {/* Flechas de Navegación Flotantes */}
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/70 hover:bg-[#C8A98B] text-white hover:text-black border border-white/20 flex items-center justify-center transition-all duration-300 backdrop-blur-md shadow-2xl"
              title="Lámina anterior (←)"
            >
              ❮
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="absolute right-3 md:right-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/70 hover:bg-[#C8A98B] text-white hover:text-black border border-white/20 flex items-center justify-center transition-all duration-300 backdrop-blur-md shadow-2xl"
              title="Lámina siguiente (→)"
            >
              ❯
            </button>
          </div>

          {/* Información y Pie de Lámina Editorial */}
          <div className="mt-5 pt-4 border-t border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="max-w-xl">
              <h4 className="font-serif italic text-base text-white/95 leading-snug">
                {currentItem.title}
              </h4>
              {currentItem.caption && currentItem.caption !== currentItem.title && (
                <p className="text-white/60 text-xs mt-1 font-sans line-clamp-2">
                  {currentItem.caption}
                </p>
              )}
            </div>

            <div className="flex items-center gap-4 font-mono text-[10px] text-white/50 uppercase tracking-wider flex-wrap">
              {currentItem.width && currentItem.height && (
                <span>📐 {currentItem.width}×{currentItem.height}px</span>
              )}
              {currentItem.author && (
                <span>👤 {currentItem.author}</span>
              )}
              {currentItem.license && (
                <span className="text-[#81c784] font-semibold">{currentItem.license}</span>
              )}
            </div>
          </div>

          {/* Tira Inferior de Miniaturas (Filmstrip) */}
          <div className="mt-6 flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/20">
            {images.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`relative flex-shrink-0 w-16 md:w-20 aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all duration-300 ${
                  currentIndex === idx
                    ? 'border-[#C8A98B] scale-105 shadow-lg opacity-100'
                    : 'border-white/10 opacity-50 hover:opacity-90 hover:border-white/30'
                }`}
                title={`Ir a lámina #${idx + 1}: ${item.title}`}
              >
                <img src={item.thumbUrl || item.url} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                <span className="absolute bottom-0.5 right-1 px-1 rounded bg-black/80 font-mono text-[8px] text-white/80">
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
              className="group relative bg-[#13131c] border border-white/10 rounded-xl overflow-hidden hover:border-[#C8A98B]/60 transition-all duration-500 cursor-pointer shadow-xl"
              onClick={() => {
                setCurrentIndex(idx);
                setIsZoomOpen(true);
              }}
            >
              <div className="aspect-[4/3] overflow-hidden bg-black/40 relative">
                <img
                  src={item.thumbUrl || item.url}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                  loading="lazy"
                />
                <div className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white font-mono text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                  🔍
                </div>
              </div>
              <div className="p-4">
                <h5 className="font-serif italic text-sm text-white/90 line-clamp-1 group-hover:text-[#C8A98B] transition-colors">
                  {item.title}
                </h5>
                <div className="mt-2 flex items-center justify-between font-mono text-[9px] text-white/40 uppercase">
                  <span>Lámina #{idx + 1}</span>
                  <span className="text-[#81c784]">{item.license || 'CC'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          VISOR MODAL LUPA AL 60% DE PANTALLA (SCREEN LIGHTBOX)
      ═══════════════════════════════════════════════════════════════════ */}
      {isZoomOpen && (
        <div
          className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 md:p-8 animate-fadeIn"
          onClick={() => setIsZoomOpen(false)}
        >
          {/* Contenedor al 60% del Viewport */}
          <div
            className="relative w-full max-w-[62vw] max-h-[82vh] bg-[#0f0f15] border border-white/20 rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'clamp(320px, 60vw, 1100px)' }}
          >
            {/* Barra de Control Superior */}
            <div className="p-4 bg-black/60 border-b border-white/10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-0.5 rounded-full bg-[#C8A98B]/20 border border-[#C8A98B]/40 font-mono text-[10px] text-[#C8A98B] uppercase tracking-wider">
                  🔍 Lupa 60% Screen · Lámina {currentIndex + 1} de {images.length}
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
                  className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-white/80 font-mono text-[10px] uppercase tracking-wider transition-colors"
                  title="Abrir imagen original en tamaño completo"
                >
                  ↗ Original
                </a>
                <button
                  type="button"
                  onClick={() => setIsZoomOpen(false)}
                  className="w-8 h-8 rounded-full bg-red-600/80 hover:bg-red-600 text-white flex items-center justify-center font-bold text-sm transition-colors"
                  title="Cerrar Lupa (Esc)"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Imagen Principal en Visor 60% con Flechas */}
            <div className="relative flex-1 bg-black/90 flex items-center justify-center p-4 min-h-[350px] overflow-hidden">
              <img
                src={currentItem.url || currentItem.thumbUrl}
                alt={currentItem.title}
                className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-2xl transition-all duration-300"
              />

              {/* Controles de Navegación en el Visor 60% */}
              <button
                type="button"
                onClick={handlePrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/70 hover:bg-[#C8A98B] text-white hover:text-black border border-white/20 flex items-center justify-center text-lg font-bold transition-all duration-300 shadow-2xl"
                title="Foto anterior"
              >
                ❮
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/70 hover:bg-[#C8A98B] text-white hover:text-black border border-white/20 flex items-center justify-center text-lg font-bold transition-all duration-300 shadow-2xl"
                title="Foto siguiente"
              >
                ❯
              </button>
            </div>

            {/* Metadatos y Pie de Visor */}
            <div className="p-4 bg-[#0a0a0e] border-t border-white/10 flex items-center justify-between text-xs font-mono text-white/60 flex-wrap gap-2">
              <div className="flex items-center gap-4">
                {currentItem.width && currentItem.height && (
                  <span>📐 {currentItem.width}×{currentItem.height} px</span>
                )}
                {currentItem.author && (
                  <span>👤 Autor: {currentItem.author}</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[#81c784]">Licencia: {currentItem.license || 'Libre'}</span>
                <span className="text-white/30">| Atajos: ← / → / Esc</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
