import React, { useState, useEffect } from 'react';
import { BuscadorModal } from './BuscadorModal';

interface Props {
  title: string;
  accentColor: string;
}

export const StickyReaderHeader: React.FC<Props> = ({ title, accentColor }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [progress, setProgress] = useState(0);
  const [backPath, setBackPath] = useState('/archivo');

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
      
      const scrollProgress = (currentScrollY / windowHeight) * 100;
      setProgress(scrollProgress);

      // Al abrir el post o hacer scroll hacia abajo -> HIDE (ocultar)
      // Al hacer scroll hacia arriba (scroll up) tras haber bajado > 250px -> BAJAR (mostrar)
      if (currentScrollY > 250) {
        if (currentScrollY < lastScrollY) {
          setIsVisible(true);
        } else {
          setIsVisible(false);
        }
      } else {
        setIsVisible(false);
      }

      setLastScrollY(currentScrollY);
    };

    // Al interactuar moviendo el cursor a la parte superior de la pantalla (< 60px), revelar suavemente la barra
    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY < 60 && window.scrollY > 250) {
        setIsVisible(true);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [lastScrollY, backPath]);

  return (
    <header 
      className={`fixed top-0 left-0 w-full z-100 transition-all duration-500 ease-in-out transform ${
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}
    >
      {/* Background Glassmorphism */}
      <div className="absolute inset-0 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/10" />

      <div className="relative max-w-7xl mx-auto px-6 h-16 flex items-center justify-between pointer-events-auto">
        {/* Breadcrumb Inteligente */}
        <div className="flex items-center gap-4 text-[10px] font-mono tracking-[0.25em] uppercase">
          <a href="/" className="hover:opacity-80 transition-opacity flex items-center" title="Inicio TGP">
             <img src="/favicon.png" alt="TGP" className="w-5 h-5 object-contain grayscale brightness-150" />
          </a>
          <span className="opacity-20">/</span>
          <a 
            href={backPath} 
            className="text-white/50 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <span className="text-[12px]">←</span> Hemeroteca
          </a>
          <span className="opacity-20 hidden md:inline">/</span>
          <span className="text-[#C8A98B] truncate max-w-70 hidden md:inline font-serif italic normal-case tracking-normal text-[14px] opacity-90">
            {title}
          </span>
        </div>

        {/* Lupa de Búsqueda 🔍 + Menú Sándwich 3 Guiones ≡ */}
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
  );
};
