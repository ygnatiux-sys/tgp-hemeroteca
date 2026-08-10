import React, { useState, useEffect, useRef } from 'react';
import type { GalleryImageItem } from '../lib/content-filter';

interface Props {
  images: GalleryImageItem[];
  title?: string;
  accentColor?: string;
}

export function MagazineBookzineGallery({ images, title, accentColor = '#C8A98B' }: Props) {
  if (!images || images.length === 0) return null;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'bookzine'>('grid');
  
  // Estados para Zoom y Pan en Lightbox de Alta Definición
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const currentItem = images[currentIndex] || images[0];

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    resetZoom();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    resetZoom();
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const openLightboxAt = (index: number) => {
    setCurrentIndex(index);
    resetZoom();
    setIsLightboxOpen(true);
  };

  const resetZoom = () => {
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
  };

  const handleZoomIn = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setZoomLevel((prev) => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setZoomLevel((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPanPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleZoom100 = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setZoomLevel((prev) => (prev === 2.5 ? 1 : 2.5));
    setPanPosition({ x: 0, y: 0 });
  };

  // Teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isLightboxOpen) return;
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'Escape') setIsLightboxOpen(false);
      if (e.key === '+' || e.key === '=') handleZoomIn();
      if (e.key === '-') handleZoomOut();
      if (e.key === '0') resetZoom();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen, images.length]);

  // Arrastre con ratón para inspección en alta resolución cuando zoomLevel > 1
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel <= 1) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - panPosition.x, y: e.clientY - panPosition.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoomLevel <= 1) return;
    setPanPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="w-full relative z-20 my-20 md:my-28 select-none">
      {/* CONTENEDOR FULL BLEED / MÁXIMO ANCHO */}
      <div className="w-screen relative left-1/2 -translate-x-1/2 max-w-[100vw] px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24">
        <div className="max-w-7xl mx-auto">
          
          {/* CABECERA EDITORIAL TIPO BOOKZINE / MAGAZINE */}
          <div className="border-t border-b border-white/10 py-6 mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 bg-linear-to-r from-white/5 via-transparent to-white/5">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#C8A98B] shadow-[0_0_10px_rgba(200,169,139,0.8)] animate-pulse"></span>
                <span className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.35em] text-[#C8A98B] font-bold">
                  MAGAZINEBOOK · DOSSIER VISUAL DE ARCHIVO
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-light text-stone-100 tracking-tight">
                {title || 'Colección Iconográfica & Documental'}
              </h2>
              <p className="font-mono text-[11px] text-white/40 mt-1 uppercase tracking-widest">
                {images.length} Registros en Alta Definición · Wikimedia Commons & Patrimonio Histórico
              </p>
            </div>

            {/* SELECTOR DE MODO DE VISTA */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded-full border font-mono text-[10px] uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2 ${
                  viewMode === 'grid'
                    ? 'border-[#C8A98B] bg-[#C8A98B]/20 text-[#C8A98B] font-bold shadow-[0_0_15px_rgba(200,169,139,0.2)]'
                    : 'border-white/15 bg-white/5 hover:bg-white/10 text-white/70'
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                <span>Mosaico Full Bleed</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('bookzine')}
                className={`px-4 py-2 rounded-full border font-mono text-[10px] uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2 ${
                  viewMode === 'bookzine'
                    ? 'border-[#C8A98B] bg-[#C8A98B]/20 text-[#C8A98B] font-bold shadow-[0_0_15px_rgba(200,169,139,0.2)]'
                    : 'border-white/15 bg-white/5 hover:bg-white/10 text-white/70'
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="4" y="2" width="16" height="20" rx="2" />
                  <line x1="8" y1="6" x2="16" y2="6" />
                  <line x1="8" y1="10" x2="16" y2="10" />
                </svg>
                <span>Visor Gran Formato</span>
              </button>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
             MODO 1: MOSAICO FULL BLEED (EDITORIAL GRID DE ALTA RESOLUCIÓN)
          ═══════════════════════════════════════════════════════════════════ */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
              {images.map((item, idx) => (
                <div
                  key={item.id || idx}
                  onClick={() => openLightboxAt(idx)}
                  className="group relative bg-stone-900 border border-white/10 hover:border-[#C8A98B]/60 rounded-2xl overflow-hidden shadow-2xl transition-all duration-500 hover:shadow-[0_0_30px_rgba(200,169,139,0.2)] flex flex-col cursor-zoom-in"
                >
                  {/* Contenedor de la Imagen */}
                  <div className="relative aspect-4/3 w-full overflow-hidden bg-black/60">
                    <img
                      src={item.thumbUrl || item.url}
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 opacity-90 group-hover:opacity-100"
                      loading="lazy"
                    />
                    
                    {/* Badge de Lámina */}
                    <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/80 backdrop-blur-md rounded-md border border-white/15 font-mono text-[9px] text-[#C8A98B] font-bold">
                      #{String(idx + 1).padStart(2, '0')}
                    </div>

                    {/* Botón Lupa Hover */}
                    <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/80 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                    </div>

                    {/* Gradiente Inferior de Sombra */}
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-stone-900 to-transparent"></div>
                  </div>

                  {/* Metadatos y Epígrafe */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-serif text-sm font-semibold text-stone-100 group-hover:text-[#C8A98B] transition-colors line-clamp-2 leading-snug">
                        {item.title}
                      </h4>
                      {item.caption && item.caption !== item.title && (
                        <p className="font-sans text-xs text-stone-400 leading-relaxed font-medium line-clamp-3 md:line-clamp-none max-w-35 md:max-w-none">
                          {item.caption || (item as any).description || "Registro Documental"}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between font-mono text-[9px] text-white/40">
                      <span className="truncate max-w-35">{item.author || 'Wikimedia Commons'}</span>
                      <span className="text-[#C8A98B]/70 font-semibold">{item.license || 'Public Domain'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
             MODO 2: VISOR BOOKZINE GRAN FORMATO (PAGE-BY-PAGE)
          ═══════════════════════════════════════════════════════════════════ */}
          {viewMode === 'bookzine' && (
            <div className="relative bg-[#0d0f0e] border border-white/15 rounded-3xl overflow-hidden shadow-2xl p-6 sm:p-8 md:p-12">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                
                {/* LÁMINA PRINCIPAL */}
                <div
                  className="lg:col-span-8 relative aspect-16/10 rounded-2xl overflow-hidden bg-black/90 flex items-center justify-center cursor-zoom-in group shadow-2xl border border-white/10"
                  onClick={() => setIsLightboxOpen(true)}
                >
                  <img
                    src={currentItem.url || currentItem.thumbUrl}
                    alt={currentItem.title}
                    className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-[1.01]"
                  />

                  {/* Controles de Navegación Flotantes */}
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/80 hover:bg-[#C8A98B] text-white hover:text-black border border-white/20 flex items-center justify-center transition-all duration-300 backdrop-blur-md shadow-2xl cursor-pointer"
                    title="Lámina anterior"
                  >
                    ❮
                  </button>

                  <button
                    type="button"
                    onClick={handleNext}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/80 hover:bg-[#C8A98B] text-white hover:text-black border border-white/20 flex items-center justify-center transition-all duration-300 backdrop-blur-md shadow-2xl cursor-pointer"
                    title="Lámina siguiente"
                  >
                    ❯
                  </button>

                  {/* Botón Lupa */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsLightboxOpen(true);
                    }}
                    className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-md text-[#C8A98B] hover:bg-[#C8A98B] hover:text-black border border-white/20 font-mono text-[9px] uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <span>Ultra HD Zoom</span>
                  </button>
                </div>

                {/* COLOFÓN Y FICHA EDITORIAL DE LA LÁMINA */}
                <div className="lg:col-span-4 flex flex-col justify-between h-full space-y-6">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-3 py-1 bg-[#C8A98B]/10 border border-[#C8A98B]/30 rounded-full font-mono text-[9px] uppercase tracking-[0.2em] text-[#C8A98B] font-bold">
                        LÁMINA {String(currentIndex + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
                      </span>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-serif font-bold text-stone-100 leading-snug">
                      {currentItem.title}
                    </h3>

                    {currentItem.caption && (
                      <p className="font-serif italic text-sm text-stone-300 mt-4 leading-relaxed border-l-2 border-[#C8A98B]/40 pl-4">
                        "{currentItem.caption}"
                      </p>
                    )}
                  </div>

                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl font-mono text-[10px] space-y-2 text-white/60">
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-white/40 uppercase">Autor / Fuente:</span>
                      <span className="text-stone-200 font-semibold truncate max-w-40">{currentItem.author || 'Wikimedia Commons'}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-white/40 uppercase">Licencia:</span>
                      <span className="text-[#C8A98B]">{currentItem.license || 'Licencia Libre'}</span>
                    </div>
                    {currentItem.width && currentItem.height && (
                      <div className="flex justify-between">
                        <span className="text-white/40 uppercase">Resolución:</span>
                        <span className="text-stone-300">{currentItem.width} × {currentItem.height} px</span>
                      </div>
                    )}
                  </div>

                  {/* TIRA DE MINIATURAS NAVEGABLES */}
                  <div className="flex gap-2 overflow-x-auto pb-2 pt-1 scrollbar-thin">
                    {images.map((img, idx) => (
                      <button
                        key={img.id || idx}
                        type="button"
                        onClick={() => {
                          setCurrentIndex(idx);
                          resetZoom();
                        }}
                        className={`relative w-16 h-12 shrink-0 rounded-lg overflow-hidden border transition-all cursor-pointer ${
                          idx === currentIndex
                            ? 'border-[#C8A98B] ring-2 ring-[#C8A98B]/50 scale-105'
                            : 'border-white/20 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={img.thumbUrl || img.url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
         MODAL LIGHTBOX DE ALTA PRECISIÓN & ZOOM MULTIESCALA (100% VISIÓN WIKI)
      ═══════════════════════════════════════════════════════════════════ */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-99999 bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-between p-4 sm:p-6 select-none animate-fade-in"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* Barra Superior de Herramientas del Lightbox */}
          <div className="w-full max-w-7xl flex items-center justify-between border-b border-white/10 pb-4 z-20">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-[#C8A98B] font-bold tracking-widest">
                LÁMINA {String(currentIndex + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
              </span>
              <span className="text-white/30">|</span>
              <span className="font-serif text-sm text-stone-200 truncate max-w-md hidden sm:inline">
                {currentItem.title}
              </span>
            </div>

            {/* CONTROLES DE ZOOM Y PANTALLA COMPLETA */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 1}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white flex items-center justify-center font-mono text-base font-bold transition-all cursor-pointer"
                title="Alejar (-)"
              >
                −
              </button>

              <span className="font-mono text-xs text-white/80 w-12 text-center">
                {Math.round(zoomLevel * 100)}%
              </span>

              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 4}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white flex items-center justify-center font-mono text-base font-bold transition-all cursor-pointer"
                title="Acercar (+)"
              >
                +
              </button>

              <button
                type="button"
                onClick={handleZoom100}
                className="px-3 py-1.5 rounded-full bg-[#C8A98B]/20 hover:bg-[#C8A98B]/30 border border-[#C8A98B]/40 text-[#C8A98B] font-mono text-[10px] uppercase tracking-wider transition-all cursor-pointer ml-1"
                title="Alternar escala 1:1"
              >
                {zoomLevel > 1 ? 'Reset (1x)' : '100% HD'}
              </button>

              <a
                href={currentItem.url || currentItem.thumbUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-mono text-[10px] uppercase tracking-wider transition-all hidden md:flex items-center gap-1.5"
                title="Abrir imagen original sin compresión"
              >
                <span>Original Wiki</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>

              <button
                type="button"
                onClick={() => setIsLightboxOpen(false)}
                className="w-9 h-9 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 flex items-center justify-center font-mono text-sm font-bold transition-all cursor-pointer ml-2"
                title="Cerrar (Esc)"
              >
                ✕
              </button>
            </div>
          </div>

          {/* ÁREA CENTRAL DE LA IMAGEN CON ZOOM Y PAN INTERACTIVO */}
          <div
            className="relative w-full h-[74vh] flex items-center justify-center overflow-hidden my-auto"
            onMouseDown={handleMouseDown}
            style={{ cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
          >
            <div
              className="transition-transform duration-100 ease-out"
              style={{
                transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomLevel})`
              }}
            >
              <img
                src={currentItem.url || currentItem.thumbUrl}
                alt={currentItem.title}
                className="max-h-[72vh] max-w-[90vw] object-contain select-none pointer-events-none rounded shadow-2xl"
                draggable={false}
              />
            </div>

            {/* Flechas de Navegación en Pantalla Completa */}
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-black/60 hover:bg-[#C8A98B] text-white hover:text-black border border-white/20 flex items-center justify-center text-xl transition-all duration-300 cursor-pointer shadow-2xl"
              title="Anterior (←)"
            >
              ❮
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-black/60 hover:bg-[#C8A98B] text-white hover:text-black border border-white/20 flex items-center justify-center text-xl transition-all duration-300 cursor-pointer shadow-2xl"
              title="Siguiente (→)"
            >
              ❯
            </button>
          </div>

          {/* Pie Informativo de Pantalla Completa */}
          <div className="w-full max-w-5xl text-center border-t border-white/10 pt-3 z-20">
            <h4 className="font-serif text-base text-stone-100 font-semibold">{currentItem.title}</h4>
            <p className="font-mono text-[10px] text-white/50 mt-1">
              {currentItem.author || 'Wikimedia Commons'} · {currentItem.license || 'Licencia Libre'}
              {currentItem.width && currentItem.height && ` · ${currentItem.width} × ${currentItem.height} px`}
            </p>
          </div>

        </div>
      )}
    </div>
  );
}
