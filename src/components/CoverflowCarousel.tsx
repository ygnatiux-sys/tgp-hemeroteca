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
  
  if (import.meta.env && import.meta.env.DEV) {
    posts.forEach(post => {
      const imgStr = post.image || '';
      if (imgStr.includes('hero-') || imgStr.includes('pano-') || imgStr.includes('cover-')) {
        console.warn(`[TGP Vision] Advertencia: Se inyectó una imagen panorámica (${imgStr.split('/').pop()}) en un contenedor vertical. Aplicando fallback cinemático.`);
      }
    });
  }

  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const stepSize = posts.length > 3 ? 3 : 1;

  // Rotación automática en grupos de a 3 cada 4.5 segundos (solo pausa en hover)
  useEffect(() => {
    if (isHovered || posts.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + stepSize) % posts.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isHovered, posts.length, stepSize]);

  const handlePrev = useCallback(() => {
    if (posts.length === 0) return;
    setActiveIndex((prev) => (prev - stepSize + posts.length) % posts.length);
  }, [posts.length, stepSize]);

  const handleNext = useCallback(() => {
    if (posts.length === 0) return;
    setActiveIndex((prev) => (prev + stepSize) % posts.length);
  }, [posts.length, stepSize]);

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
    setIsHovered(true);
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    setIsHovered(false);
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
    <div className="w-full py-12 md:py-20 bg-transparent text-[#E3DDD3] relative overflow-hidden">
      {/* Header Editorial con degradado general H1 y rust-orange heredado */}
      {(title || eyebrow) && (
        <div className="max-w-7xl mx-auto px-6 md:px-12 mb-8 flex items-end justify-between">
          <div>
            {eyebrow && (
              <span className="text-xs tracking-[0.4em] uppercase font-mono text-rust-orange block mb-2 font-bold">
                {eyebrow}
              </span>
            )}
            {title && (
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-black gradient-general-h1 tracking-tight leading-tight uppercase">
                {title}
              </h2>
            )}
          </div>

          {/* Contador de posición */}
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono tracking-widest text-white/40">
            <span className="text-rust-orange font-bold">{String(activeIndex + 1).padStart(2, '0')}</span>
            <span>/</span>
            <span>{String(posts.length).padStart(2, '0')}</span>
          </div>
        </div>
      )}

      {/* ── REGLA ESTRUCTURAL: Contenedor Padre Coverflow Ampliado a los Costados ── */}
      <div 
        className="relative w-full h-135 sm:h-150 md:h-165 lg:h-175 flex justify-center items-center overflow-hidden bg-transparent"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* ── FUNDIDOS LATERALES CON EL FONDO HEREDADO ── */}
        <div className="absolute left-0 top-0 bottom-0 w-20 sm:w-36 md:w-56 lg:w-72 bg-linear-to-r from-theme-dark via-theme-dark/85 via-40% to-transparent pointer-events-none z-30" />
        <div className="absolute right-0 top-0 bottom-0 w-20 sm:w-36 md:w-56 lg:w-72 bg-linear-to-l from-theme-dark via-theme-dark/85 via-40% to-transparent pointer-events-none z-30" />

        {/* Pista de Tarjetas Coverflow Circular (siempre grupos de 3 equilibrados) */}
        <div className="relative w-full h-full flex justify-center items-center">
          {posts.map((post, idx) => {
            let diff = idx - activeIndex;
            if (posts.length > 2) {
              if (diff > posts.length / 2) diff -= posts.length;
              if (diff < -posts.length / 2) diff += posts.length;
            }
            const isActive = diff === 0;
            const absDiff = Math.abs(diff);

            if (absDiff > 2) {
              return null;
            }

            let positionClasses = '';
            let visualClasses = '';
            let overlayOpacity = '';

            if (isActive) {
              // ── Tarjeta Central (Activa) — Vertical más ancha y protagonista ──
              positionClasses = 'scale-100 z-30 translate-x-0 cursor-default shadow-[0_30px_80px_-10px_rgba(0,0,0,0.98)]';
              visualClasses = 'opacity-100';
              overlayOpacity = 'bg-black/0';
            } else if (diff === -1) {
              positionClasses = 'scale-[0.80] z-20 -translate-x-[76%] sm:-translate-x-[82%] md:-translate-x-[86%] lg:-translate-x-[90%] cursor-pointer shadow-[0_20px_50px_-10px_rgba(0,0,0,0.9)]';
              visualClasses = 'opacity-85 brightness-80 hover:brightness-95';
              overlayOpacity = 'bg-black/25';
            } else if (diff === 1) {
              positionClasses = 'scale-[0.80] z-20 translate-x-[76%] sm:translate-x-[82%] md:translate-x-[86%] lg:translate-x-[90%] cursor-pointer shadow-[0_20px_50px_-10px_rgba(0,0,0,0.9)]';
              visualClasses = 'opacity-85 brightness-80 hover:brightness-95';
              overlayOpacity = 'bg-black/25';
            } else if (diff === -2) {
              positionClasses = 'scale-[0.66] z-10 -translate-x-[142%] sm:-translate-x-[154%] md:-translate-x-[162%] lg:-translate-x-[168%] cursor-pointer shadow-none hidden sm:block';
              visualClasses = 'opacity-45 brightness-45 hover:brightness-65';
              overlayOpacity = 'bg-black/55';
            } else if (diff === 2) {
              positionClasses = 'scale-[0.66] z-10 translate-x-[142%] sm:translate-x-[154%] md:translate-x-[162%] lg:translate-x-[168%] cursor-pointer shadow-none hidden sm:block';
              visualClasses = 'opacity-45 brightness-45 hover:brightness-65';
              overlayOpacity = 'bg-black/55';
            }

            return (
              <div
                key={post.id || idx}
                onClick={() => {
                  if (!isActive) setActiveIndex(idx);
                }}
                className={`absolute w-[88vw] sm:w-[460px] md:w-[540px] lg:w-[620px] h-[480px] sm:h-[540px] md:h-[580px] lg:h-[620px] rounded-2xl md:rounded-3xl overflow-hidden border border-white/10 transition-all duration-500 ease-out ${positionClasses} ${visualClasses}`}
              >
                {/* Imagen de Portada Cinemática */}
                <img
                  src={post.image}
                  alt={post.title}
                  className="w-full h-full object-cover object-center bg-[#0a0c0f]"
                  loading="lazy"
                  decoding="async"
                />

                {/* Scrim localizado en degradado hacia la base */}
                <div className="absolute bottom-0 left-0 w-full h-3/5 bg-linear-to-t from-black via-black/85 via-50% to-transparent pointer-events-none z-10" />

                {/* Capa de oscurecimiento progresivo para fundir las tarjetas laterales con el fondo */}
                <div className={`absolute inset-0 ${overlayOpacity} pointer-events-none transition-all duration-500 z-10`} />

                {/* Contenedor del Texto & CTA */}
                <div className="absolute bottom-0 left-0 w-full p-6 md:p-8 flex flex-col justify-end items-center text-center z-20">
                  {post.date && (
                    <span className="text-[8.5px] font-mono tracking-widest text-white/60 mb-1 uppercase block">
                      {post.date}
                    </span>
                  )}

                  <h3 className="gradient-general-h2 text-xl sm:text-2xl md:text-3xl lg:text-4xl font-serif font-extrabold tracking-wide leading-tight mb-2">
                    {post.title}
                  </h3>

                  {post.subtitle && (
                    <p className="text-xs sm:text-sm md:text-base text-white/80 font-light line-clamp-3 mb-4 leading-relaxed font-alegreya max-w-lg">
                      {post.subtitle}
                    </p>
                  )}

                  {/* Botón Call to Action Cinemático con color del fondo en default y oscurecido en selección */}
                  <div className="mt-2 w-full max-w-70">
                    {isActive ? (
                      <a
                        href={post.link}
                        className="inline-flex items-center justify-center gap-2.5 w-full py-2.5 sm:py-3 px-5 rounded-md bg-[#1c1e1d] hover:bg-[#282b29] text-[#EFEBE3] hover:text-white border border-white/25 hover:border-white/45 font-mono font-bold text-[10px] sm:text-xs uppercase tracking-[0.25em] transition-all duration-300 shadow-xl shadow-black/80 active:scale-95 cursor-pointer backdrop-blur-md"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                        </svg>
                        <span>Explorar Colección</span>
                      </a>
                    ) : (
                      <div className="inline-flex items-center justify-center gap-2.5 w-full py-2.5 sm:py-3 px-5 rounded-md bg-theme-dark text-white/35 border border-white/8 font-mono font-bold text-[10px] sm:text-xs uppercase tracking-[0.25em] pointer-events-none">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                        </svg>
                        <span>Explorar Colección</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Botón Anterior (<) Flotante — Más grande y limpio como en el sample ── */}
        {/* ── Botón Anterior (<) Flotante con tono atenuado Gloock (#E3DDD3) ── */}
        <button
          type="button"
          onClick={handlePrev}
          aria-label="Anterior"
          className="group absolute left-3 sm:left-6 md:left-10 lg:left-14 top-1/2 -translate-y-1/2 z-40 p-2 text-[#E3DDD3]/50 hover:text-[#E3DDD3]/90 drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)] hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer focus:outline-none"
        >
          <svg
            className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 lg:w-20 lg:h-20 transition-colors"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* ── Botón Siguiente (>) Flotante con tono atenuado Gloock (#E3DDD3) ── */}
        <button
          type="button"
          onClick={handleNext}
          aria-label="Siguiente"
          className="group absolute right-3 sm:right-6 md:right-10 lg:right-14 top-1/2 -translate-y-1/2 z-40 p-2 text-[#E3DDD3]/50 hover:text-[#E3DDD3]/90 drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)] hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer focus:outline-none"
        >
          <svg
            className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 lg:w-20 lg:h-20 transition-colors"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Indicadores de Puntos (Dots) Inferiores */}
      <div className="flex justify-center items-center gap-2 mt-8">
        {posts.map((_, idx) => (
          <button
            key={idx}
            onClick={() => {
              setActiveIndex(idx);
            }}
            aria-label={`Ir a publicación ${idx + 1}`}
            className={`transition-all duration-300 rounded-full cursor-pointer ${
              idx === activeIndex
                ? 'w-8 h-1.5 bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.7)]'
                : 'w-1.5 h-1.5 bg-white/20 hover:bg-white/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
