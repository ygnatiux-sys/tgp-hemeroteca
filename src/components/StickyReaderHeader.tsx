import React, { useState, useEffect, useRef } from 'react';
import { BuscadorModal } from './BuscadorModal';

interface Props {
  title: string;
  accentColor?: string;
}

export const StickyReaderHeader: React.FC<Props> = ({ title, accentColor = '#B55A30' }) => {
  const [isTopHovered, setIsTopHovered] = useState(false);
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);
  const [isScrollUp, setIsScrollUp] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [progress, setProgress] = useState(0);
  const [backPath, setBackPath] = useState('/archivo');

  const isHeaderHoveredRef = useRef(false);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const referrer = document.referrer;
      if (referrer && (referrer.includes('/archivo') || referrer.includes('/colecciones') || referrer.includes('/ensayos') || referrer.includes('/manifiesto'))) {
        try {
          const url = new URL(referrer);
          setBackPath(url.pathname + url.search);
        } catch {
          setBackPath('/archivo');
        }
      } else {
        setBackPath('/archivo');
      }
    }

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const windowHeight = document.documentElement.scrollHeight - window.innerHeight;
      
      const scrollProgress = (currentScrollY / (windowHeight || 1)) * 100;
      setProgress(scrollProgress);

      if (currentScrollY > 180) {
        if (currentScrollY < lastScrollY) {
          setIsScrollUp(true);
        } else {
          setIsScrollUp(false);
        }
      } else {
        setIsScrollUp(false);
      }

      setLastScrollY(currentScrollY);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY <= 65) {
        setIsTopHovered(true);
      } else if (e.clientY > 80 && !isHeaderHoveredRef.current) {
        setIsTopHovered(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [lastScrollY]);

  const handleBackClick = (e: React.MouseEvent) => {
    if (typeof window !== 'undefined' && window.history.length > 1 && document.referrer.includes(window.location.host)) {
      e.preventDefault();
      window.history.back();
    }
  };

  const isVisible = isTopHovered || isHeaderHovered || isScrollUp;

  return (
    <>
      {/* Zona invisible interactiva superior para capturar el hover inicial */}
      <div 
        className="fixed top-0 left-0 w-full h-4 z-99 pointer-events-auto"
        onMouseEnter={() => setIsTopHovered(true)}
      />

      <header 
        onMouseEnter={() => {
          setIsHeaderHovered(true);
          isHeaderHoveredRef.current = true;
        }}
        onMouseLeave={() => {
          setIsHeaderHovered(false);
          isHeaderHoveredRef.current = false;
          setIsTopHovered(false);
        }}
        className={`fixed top-0 left-0 w-full z-100 transition-all duration-500 ease-out transform ${
          isVisible ? 'translate-y-0 opacity-100 pointer-events-auto' : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        {/* Background Glassmorphism Heredado del Canvas Central */}
        <div className="absolute inset-0 bg-[#121413]/92 dark:bg-[#121413]/92 light:bg-[#F5F4F0]/92 backdrop-blur-xl border-b border-black/10 dark:border-white/10" />

        <div className="relative max-w-[1600px] mx-auto px-6 md:px-10 lg:px-14 py-3.5 md:py-4 flex items-center justify-between gap-6 pointer-events-auto">
          
          {/* LADO IZQUIERDO: ISOTIPO + REGRESO AL ORIGEN + TÍTULO DEL POST AMPLIADO */}
          <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
            
            {/* Isotipo Circular Consistente con el Header Principal */}
            <a href="/" className="group flex items-center shrink-0" title="Inicio TGP">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-full border border-current/25 bg-current/5 flex items-center justify-center group-hover:scale-105 transition-all duration-300 shrink-0">
                <svg className="w-5.5 h-5.5 text-current group-hover:text-rust-orange transition-colors" viewBox="0 0 100 100" fill="none">
                  <path
                    d="M 34 28 H 42 C 41.5 21, 37 10, 50 10 C 63 10, 58.5 21, 58 28 H 66 A 6 6 0 0 1 72 34 V 66 A 6 6 0 0 1 66 72 H 58 C 58.5 79, 63 90, 50 90 C 37 90, 41.5 79, 42 72 H 34 A 6 6 0 0 1 28 66 V 58 C 35 58.5, 45 63, 45 50 C 45 37, 35 41.5, 28 42 V 34 A 6 6 0 0 1 34 28 Z"
                    stroke="currentColor"
                    strokeWidth="5.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </a>

            <span className="opacity-30 font-mono text-xs shrink-0">/</span>

            {/* Regreso al mismo lugar donde parte */}
            <a 
              href={backPath}
              onClick={handleBackClick}
              className="font-mono text-xs uppercase tracking-[0.2em] font-light text-current/70 hover:text-rust-orange transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="Regresar a la ubicación de origen"
            >
              <span className="text-sm">←</span> HEMEROTECA
            </a>

            <span className="opacity-30 font-mono text-xs shrink-0">/</span>

            {/* Título del Post que abre en esa misma página AMPLIADO */}
            <span className="font-serif italic text-base md:text-lg lg:text-[19px] text-rust-orange dark:text-rust-orange truncate font-normal leading-tight">
              {title}
            </span>

          </div>

          {/* LADO DERECHO: BOTONERA DE ACCIÓN SIMÉTRICA Y COHERENTE */}
          <div className="flex items-center gap-3 shrink-0 ml-auto">
            <BuscadorModal />
          </div>

        </div>

        {/* Capa de Progreso de Lectura con Color Heredado */}
        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-black/10 dark:bg-white/10">
          <div 
            className="h-full transition-all duration-150 ease-out bg-rust-orange"
            style={{ 
              width: `${Math.min(100, Math.max(0, progress))}%`,
              boxShadow: `0 0 10px rgba(181,90,48,0.7)`
            }}
          />
        </div>
      </header>
    </>
  );
};
