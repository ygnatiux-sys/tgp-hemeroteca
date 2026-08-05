import React, { useState, useEffect, useRef } from 'react';
import { BuscadorModal } from './BuscadorModal';

interface Props {
  title: string;
  accentColor: string;
}

export const StickyReaderHeader: React.FC<Props> = ({ title, accentColor }) => {
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
      if (referrer.includes('/archivo')) {
        setBackPath('/archivo');
      } else if (referrer.includes('/ensayos')) {
        setBackPath('/ensayos');
      }
    }

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const windowHeight = document.documentElement.scrollHeight - window.innerHeight;
      
      const scrollProgress = (currentScrollY / (windowHeight || 1)) * 100;
      setProgress(scrollProgress);

      // Al hacer scroll hacia arriba tras haber bajado > 250px -> mostrar
      if (currentScrollY > 250) {
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

    // Al interactuar moviendo el cursor a la parte superior de la pantalla (< 65px), revelar suavemente la barra
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
  }, [lastScrollY, backPath]);

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
        {/* Background Glassmorphism */}
        <div className="absolute inset-0 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/10" />

        <div className="relative max-w-7xl mx-auto px-6 h-16 flex items-center justify-between pointer-events-auto">
          {/* Breadcrumb Inteligente */}
          <div className="flex items-center gap-4 text-[10px] font-mono tracking-[0.25em] uppercase">
            <a href="/" className="transition-all flex items-center p-1 rounded-full border border-transparent bg-transparent hover:border-[#C8A98B] hover:bg-white/15 hover:shadow-[0_0_14px_rgba(200,169,139,0.35)]" title="Inicio TGP">
               <img src="/favicon.png" alt="TGP" className="w-6 h-6 object-contain grayscale brightness-150" />
            </a>
            <span className="opacity-20">/</span>
            <a 
              href={backPath} 
              className="text-white/50 hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] transition-all flex items-center gap-1.5"
            >
              <span className="text-[12px]">←</span> Hemeroteca
            </a>
            <span className="opacity-20 hidden md:inline">/</span>
            <span className="text-[#C8A98B] truncate max-w-70 hidden md:inline font-serif italic normal-case tracking-normal text-[14px] opacity-90">
              {title}
            </span>
          </div>

          {/* Buscador Modal */}
          <div className="flex items-center gap-4">
            <BuscadorModal />
          </div>
        </div>

        {/* Progress Bar (Capa de Progreso de Lectura) */}
        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-white/5">
          <div 
            className="h-full transition-all duration-150 ease-out"
            style={{ 
              width: `${Math.min(100, Math.max(0, progress))}%`,
              backgroundColor: accentColor,
              boxShadow: `0 0 10px ${accentColor}aa`
            }}
          />
        </div>
      </header>
    </>
  );
};
