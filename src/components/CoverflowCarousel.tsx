import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface CoverflowPost {
  id: string;
  title: string;
  subtitle?: string;
  image: string;
  link: string;
  collectionLabel?: string;
  date?: string;
}

interface CoverflowCarouselProps {
  posts: CoverflowPost[];
  eyebrow?: string;
  title?: string;
}

export default function CoverflowCarousel({
  posts = [],
  eyebrow = 'Cinematografía Editorial',
  title = 'Publicaciones Recientes',
}: CoverflowCarouselProps) {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Inicializar en el medio si hay al menos 3 posts
  useEffect(() => {
    if (posts.length >= 3) {
      setActiveIndex(Math.floor(posts.length / 2));
    } else {
      setActiveIndex(0);
    }
  }, [posts.length]);

  const handlePrev = useCallback(() => {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : posts.length - 1));
  }, [posts.length]);

  const handleNext = useCallback(() => {
    setActiveIndex((prev) => (prev < posts.length - 1 ? prev + 1 : 0));
  }, [posts.length]);

  // Manejo de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrev, handleNext]);

  // Soporte Touch / Swipe en móviles
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 45;
    if (distance > minSwipeDistance) {
      handleNext();
    } else if (distance < -minSwipeDistance) {
      handlePrev();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  if (!posts || posts.length === 0) return null;

  return (
    <div className="w-full py-12 md:py-16 bg-[#0a0c0b] text-[#E3DDD3] select-none rounded-2xl md:rounded-3xl border border-white/5 shadow-2xl">
      {/* Header Editorial Opcional */}
      {(title || eyebrow) && (
        <div className="max-w-7xl mx-auto px-6 mb-8 flex items-end justify-between">
          <div>
            {eyebrow && (
              <span className="text-[9px] tracking-[0.45em] uppercase font-mono text-amber-500/90 block mb-2 font-bold">
                {eyebrow}
              </span>
            )}
            {title && (
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif tracking-tight text-white uppercase font-cinzel">
                {title}
              </h2>
            )}
          </div>

          {/* Contador de posición */}
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono tracking-widest text-white/40">
            <span className="text-amber-400 font-bold">{String(activeIndex + 1).padStart(2, '0')}</span>
            <span>/</span>
            <span>{String(posts.length).padStart(2, '0')}</span>
          </div>
        </div>
      )}

      {/* ── REGLA ESTRUCTURAL: Contenedor Padre ── */}
      <div 
        className="relative w-full h-[480px] sm:h-[540px] md:h-[600px] flex justify-center items-center overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Pista de Tarjetas Coverflow */}
        <div className="relative w-full h-full flex justify-center items-center">
          {posts.map((post, idx) => {
            const diff = idx - activeIndex;
            const isActive = diff === 0;
            const absDiff = Math.abs(diff);

            // Ocultar tarjetas muy alejadas para optimizar DOM
            if (absDiff > 2) {
              return null;
            }

            // Cálculo dinámico de transformaciones según reglas estrictas
            let positionClasses = '';
            let visualClasses = '';

            if (isActive) {
              // ── REGLA: Tarjeta Central (Activa) ──
              positionClasses = 'scale-100 z-30 translate-x-0 cursor-default shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] border-amber-400/40';
              visualClasses = 'opacity-100';
            } else if (diff === -1) {
              // Inmediata izquierda: -translate-x-1/4 o -translate-x-[45%] en móviles para visibilidad
              positionClasses = 'scale-75 z-20 -translate-x-[45%] sm:-translate-x-1/3 md:-translate-x-1/4 cursor-pointer border-white/10 hover:border-white/30';
              visualClasses = 'opacity-40 brightness-50';
            } else if (diff === 1) {
              // Inmediata derecha: translate-x-1/4
              positionClasses = 'scale-75 z-20 translate-x-[45%] sm:translate-x-1/3 md:translate-x-1/4 cursor-pointer border-white/10 hover:border-white/30';
              visualClasses = 'opacity-40 brightness-50';
            } else if (diff === -2) {
              // Segunda tarjeta a la izquierda
              positionClasses = 'scale-[0.62] z-10 -translate-x-[85%] sm:-translate-x-[65%] md:-translate-x-[50%] cursor-pointer border-white/5';
              visualClasses = 'opacity-25 brightness-40 hidden sm:block';
            } else if (diff === 2) {
              // Segunda tarjeta a la derecha
              positionClasses = 'scale-[0.62] z-10 translate-x-[85%] sm:translate-x-[65%] md:translate-x-[50%] cursor-pointer border-white/5';
              visualClasses = 'opacity-25 brightness-40 hidden sm:block';
            }

            return (
              <div
                key={post.id || idx}
                onClick={() => {
                  if (!isActive) setActiveIndex(idx);
                }}
                className={`absolute w-[270px] sm:w-80 md:w-90 aspect-2/3 rounded-2xl md:rounded-3xl overflow-hidden border transition-all duration-500 ease-out ${positionClasses} ${visualClasses}`}
              >
                {/* ── REGLA ESTRICTA: Imagen al 100% de brillo en la activa, sin overlays globales ── */}
                <img
                  src={post.image}
                  alt={post.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />

                {/* ── REGLA ESTRICTA: Scrim Localizado (w-full h-1/2 from-black via-black/80 to-transparent) ── */}
                <div className="absolute bottom-0 left-0 w-full h-1/2 bg-linear-to-t from-black via-black/80 to-transparent pointer-events-none" />

                {/* Badge de Categoría Superior */}
                <div className="absolute top-4 left-4 z-20">
                  <span className="px-3 py-1 rounded-full text-[7.5px] tracking-[0.3em] uppercase font-mono bg-black/70 backdrop-blur-md text-amber-400 border border-amber-400/30">
                    {post.collectionLabel || 'Editorial'}
                  </span>
                </div>

                {/* Contenedor del Texto */}
                <div className="absolute bottom-0 left-0 w-full p-6 md:p-8 flex flex-col justify-end z-20">
                  {post.date && (
                    <span className="text-[8px] font-mono tracking-widest text-white/50 mb-1.5 uppercase block">
                      {post.date}
                    </span>
                  )}

                  {/* ── REGLA ESTRICTA: Título con fuente Cinzel, mix-blend-mode, font-semibold, tracking-wide. CERO text-shadow ── */}
                  <h3 
                    style={{ fontFamily: "'Cinzel', 'Libre Bodoni', Georgia, serif" }}
                    className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-wide text-white mix-blend-plus-lighter leading-tight uppercase line-clamp-2 mb-4"
                  >
                    {post.title}
                  </h3>

                  {post.subtitle && (
                    <p className="text-xs text-white/70 font-light line-clamp-2 mb-4 leading-relaxed font-alegreya">
                      {post.subtitle}
                    </p>
                  )}

                  {/* Botón Call to Action Cinemático */}
                  {isActive && (
                    <a
                      href={post.link}
                      className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-[9px] uppercase tracking-[0.25em] transition-colors shadow-lg"
                    >
                      <span>Explorar Colección</span>
                      <span>&rarr;</span>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Botón Anterior (<) Flotante ── */}
        <button
          type="button"
          onClick={handlePrev}
          aria-label="Anterior"
          className="absolute left-3 sm:left-8 md:left-12 z-40 p-3 sm:p-4 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white border border-white/20 backdrop-blur-md transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer shadow-2xl"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* ── Botón Siguiente (>) Flotante ── */}
        <button
          type="button"
          onClick={handleNext}
          aria-label="Siguiente"
          className="absolute right-3 sm:right-8 md:right-12 z-40 p-3 sm:p-4 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white border border-white/20 backdrop-blur-md transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer shadow-2xl"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Indicadores de Puntos (Dots) Inferiores */}
      <div className="flex justify-center items-center gap-2 mt-6">
        {posts.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setActiveIndex(idx)}
            aria-label={`Ir a publicación ${idx + 1}`}
            className={`transition-all duration-300 rounded-full cursor-pointer ${
              idx === activeIndex
                ? 'w-7 h-1.5 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                : 'w-1.5 h-1.5 bg-white/25 hover:bg-white/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
