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
    <div className="w-full py-12 md:py-20 bg-black text-[#E3DDD3] select-none relative overflow-hidden">
      {/* Header Editorial */}
      {(title || eyebrow) && (
        <div className="max-w-7xl mx-auto px-6 md:px-12 mb-8 flex items-end justify-between">
          <div>
            {eyebrow && (
              <span className="text-[9.5px] tracking-[0.45em] uppercase font-mono text-amber-500/90 block mb-2 font-bold">
                {eyebrow}
              </span>
            )}
            {title && (
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-serif tracking-tight text-white uppercase font-cinzel">
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

      {/* ── REGLA ESTRUCTURAL: Contenedor Padre Coverflow Ampliado a los Costados ── */}
      <div 
        className="relative w-full h-[540px] sm:h-[620px] md:h-[680px] lg:h-[740px] flex justify-center items-center overflow-hidden bg-black"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* ── FUNDIDOS LATERALES CON EL FONDO (Melt with black background as in sample) ── */}
        <div className="absolute left-0 top-0 bottom-0 w-24 sm:w-44 md:w-72 lg:w-96 bg-gradient-to-r from-black via-black/85 via-40% to-transparent pointer-events-none z-30" />
        <div className="absolute right-0 top-0 bottom-0 w-24 sm:w-44 md:w-72 lg:w-96 bg-gradient-to-l from-black via-black/85 via-40% to-transparent pointer-events-none z-30" />

        {/* Pista de Tarjetas Coverflow Ampliada */}
        <div className="relative w-full h-full flex justify-center items-center">
          {posts.map((post, idx) => {
            const diff = idx - activeIndex;
            const isActive = diff === 0;
            const absDiff = Math.abs(diff);

            // Permitir hasta 3 de cada lado (7 visibles en desktop)
            if (absDiff > 3) {
              return null;
            }

            // Cálculo dinámico de transformaciones con abanico amplio lateral y fundido al fondo
            let positionClasses = '';
            let visualClasses = '';
            let overlayOpacity = '';

            if (isActive) {
              // ── Tarjeta Central (Activa) — Grande, destacada, nítida ──
              positionClasses = 'scale-100 z-30 translate-x-0 cursor-default shadow-[0_30px_80px_-10px_rgba(0,0,0,0.98)]';
              visualClasses = 'opacity-100';
              overlayOpacity = 'bg-black/0';
            } else if (diff === -1) {
              // Inmediata izquierda: fanned out hacia el costado
              positionClasses = 'scale-[0.88] z-20 -translate-x-[68%] sm:-translate-x-[74%] md:-translate-x-[78%] lg:-translate-x-[82%] cursor-pointer shadow-[0_20px_50px_-10px_rgba(0,0,0,0.9)]';
              visualClasses = 'opacity-85 brightness-80 hover:brightness-95';
              overlayOpacity = 'bg-black/25';
            } else if (diff === 1) {
              // Inmediata derecha: fanned out hacia el costado
              positionClasses = 'scale-[0.88] z-20 translate-x-[68%] sm:translate-x-[74%] md:translate-x-[78%] lg:translate-x-[82%] cursor-pointer shadow-[0_20px_50px_-10px_rgba(0,0,0,0.9)]';
              visualClasses = 'opacity-85 brightness-80 hover:brightness-95';
              overlayOpacity = 'bg-black/25';
            } else if (diff === -2) {
              // Segunda tarjeta a la izquierda: se funde más con el fondo
              positionClasses = 'scale-[0.76] z-10 -translate-x-[132%] sm:-translate-x-[144%] md:-translate-x-[152%] lg:-translate-x-[160%] cursor-pointer shadow-[0_15px_40px_-10px_rgba(0,0,0,0.85)]';
              visualClasses = 'opacity-60 brightness-50 hover:brightness-70';
              overlayOpacity = 'bg-black/50';
            } else if (diff === 2) {
              // Segunda tarjeta a la derecha: se funde más con el fondo
              positionClasses = 'scale-[0.76] z-10 translate-x-[132%] sm:translate-x-[144%] md:translate-x-[152%] lg:translate-x-[160%] cursor-pointer shadow-[0_15px_40px_-10px_rgba(0,0,0,0.85)]';
              visualClasses = 'opacity-60 brightness-50 hover:brightness-70';
              overlayOpacity = 'bg-black/50';
            } else if (diff === -3) {
              // Tercera tarjeta a la izquierda (extremo): casi disuelta en negro
              positionClasses = 'scale-[0.64] z-0 -translate-x-[192%] sm:-translate-x-[210%] md:-translate-x-[222%] lg:-translate-x-[234%] cursor-pointer shadow-none';
              visualClasses = 'opacity-30 brightness-30 hidden sm:block';
              overlayOpacity = 'bg-black/75';
            } else if (diff === 3) {
              // Tercera tarjeta a la derecha (extremo): casi disuelta en negro
              positionClasses = 'scale-[0.64] z-0 translate-x-[192%] sm:translate-x-[210%] md:translate-x-[222%] lg:translate-x-[234%] cursor-pointer shadow-none';
              visualClasses = 'opacity-30 brightness-30 hidden sm:block';
              overlayOpacity = 'bg-black/75';
            }

            return (
              <div
                key={post.id || idx}
                onClick={() => {
                  if (!isActive) setActiveIndex(idx);
                }}
                className={`absolute w-[280px] sm:w-[340px] md:w-[400px] lg:w-[440px] aspect-2/3 rounded-2xl md:rounded-3xl overflow-hidden border-0 transition-all duration-500 ease-out ${positionClasses} ${visualClasses}`}
              >
                {/* Imagen de Portada */}
                <img
                  src={post.image}
                  alt={post.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />

                {/* Scrim localizado en degradado hacia la base */}
                <div className="absolute bottom-0 left-0 w-full h-3/5 bg-gradient-to-t from-black via-black/85 via-50% to-transparent pointer-events-none z-10" />

                {/* Capa de oscurecimiento progresivo para fundir las tarjetas laterales con el fondo */}
                <div className={`absolute inset-0 ${overlayOpacity} pointer-events-none transition-all duration-500 z-10`} />

                {/* Badge de Categoría Superior */}
                <div className="absolute top-4 left-4 z-20">
                  <span className="px-3.5 py-1 rounded-full text-[8px] tracking-[0.3em] uppercase font-mono bg-black/80 backdrop-blur-md text-amber-400 border border-amber-400/30 font-bold">
                    {post.collectionLabel || 'Colección'}
                  </span>
                </div>

                {/* Contenedor del Texto & CTA */}
                <div className="absolute bottom-0 left-0 w-full p-6 md:p-8 flex flex-col justify-end items-center text-center z-20">
                  {post.date && (
                    <span className="text-[8.5px] font-mono tracking-widest text-white/60 mb-1 uppercase block">
                      {post.date}
                    </span>
                  )}

                  <h3 
                    style={{ fontFamily: "'Cinzel', 'Libre Bodoni', Georgia, serif" }}
                    className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold tracking-wider text-white mix-blend-plus-lighter leading-tight uppercase line-clamp-2 mb-2"
                  >
                    {post.title}
                  </h3>

                  {post.subtitle && (
                    <p className="text-xs sm:text-sm text-white/70 font-light line-clamp-2 mb-3 leading-relaxed font-alegreya max-w-xs">
                      {post.subtitle}
                    </p>
                  )}

                  {/* Botón Call to Action Cinemático estilo Sample (≡ WATCH NOW / EXPLORAR) */}
                  <div className="mt-2 w-full max-w-[280px]">
                    {isActive ? (
                      <a
                        href={post.link}
                        className="inline-flex items-center justify-center gap-2.5 w-full py-2.5 sm:py-3 px-5 rounded-md bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-[10px] sm:text-xs uppercase tracking-[0.25em] transition-all duration-300 shadow-xl shadow-black/80 active:scale-95 cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                        </svg>
                        <span>Explorar Colección</span>
                      </a>
                    ) : (
                      <div className="inline-flex items-center justify-center gap-2.5 w-full py-2.5 sm:py-3 px-5 rounded-md bg-amber-500/80 text-black font-mono font-bold text-[10px] sm:text-xs uppercase tracking-[0.25em] pointer-events-none">
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
        <button
          type="button"
          onClick={handlePrev}
          aria-label="Anterior"
          className="group absolute left-3 sm:left-6 md:left-10 lg:left-14 top-1/2 -translate-y-1/2 z-40 p-2 text-white/90 hover:text-white drop-shadow-[0_4px_24px_rgba(0,0,0,1)] hover:scale-115 active:scale-95 transition-all duration-300 cursor-pointer focus:outline-none"
        >
          <svg
            className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 lg:w-20 lg:h-20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* ── Botón Siguiente (>) Flotante — Más grande y limpio como en el sample ── */}
        <button
          type="button"
          onClick={handleNext}
          aria-label="Siguiente"
          className="group absolute right-3 sm:right-6 md:right-10 lg:right-14 top-1/2 -translate-y-1/2 z-40 p-2 text-white/90 hover:text-white drop-shadow-[0_4px_24px_rgba(0,0,0,1)] hover:scale-115 active:scale-95 transition-all duration-300 cursor-pointer focus:outline-none"
        >
          <svg
            className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 lg:w-20 lg:h-20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
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
            onClick={() => setActiveIndex(idx)}
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
