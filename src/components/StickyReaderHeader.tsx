import React, { useState, useEffect } from 'react';

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
    // Tarea 2: Lógica de Breadcrumbs Dinámicos
    if (typeof document !== 'undefined') {
      const referrer = document.referrer;
      // Detectamos si venimos de la hemeroteca o el inicio
      if (referrer.includes('/archivo')) {
        setBackPath('/archivo');
      } else if (referrer.includes('/ensayos')) {
        setBackPath('/ensayos');
      }
    }

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const windowHeight = document.documentElement.scrollHeight - window.innerHeight;
      
      // Calcular progreso de lectura
      const scrollProgress = (currentScrollY / windowHeight) * 100;
      setProgress(scrollProgress);

      // Tarea 1: Lógica de visibilidad (Scroll Up detection)
      // Solo aparece si se ha bajado más de 300px (para no molestar en el hero)
      if (currentScrollY > 300) {
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

    // Tarea 3: Atajo de Teclado (Esc)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.location.href = backPath;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [lastScrollY, backPath]);

  return (
    <header 
      className={`fixed top-0 left-0 w-full z-100 transition-all duration-300 ease-in-out transform ${
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}
    >
      {/* Background Glassmorphism (Tarea 1) */}
      <div className="absolute inset-0 bg-[#0a0a0a]/85 backdrop-blur-md border-b border-white/5" />

      <div className="relative max-w-7xl mx-auto px-6 h-16 flex items-center justify-between pointer-events-auto">
        {/* Breadcrumb Inteligente */}
        <div className="flex items-center gap-5 text-[10px] font-mono tracking-[0.3em] uppercase">
          <a href="/" className="hover:opacity-80 transition-opacity flex items-center" title="Inicio">
             <img src="/favicon.png" alt="TGP" className="w-6 h-6 object-contain" />
          </a>
          <span className="opacity-10">/</span>
          <a 
            href={backPath} 
            className="text-white/40 hover:text-white transition-colors flex items-center gap-2"
          >
            <span className="text-[14px]">←</span> Hemeroteca
          </a>
          <span className="opacity-10 hidden lg:inline">/</span>
          <span className="text-[#C8A98B] truncate max-w-[300px] hidden lg:inline font-serif italic normal-case tracking-normal text-[15px] opacity-80">
            {title}
          </span>
        </div>

        {/* Indicador de Sección */}
        <div className="text-[9px] font-mono text-white/20 uppercase tracking-[0.4em] hidden sm:block">
          Archivo TGP
        </div>
      </div>

      {/* Progress Bar (Capa de Progreso) */}
      <div className="absolute bottom-0 left-0 w-full h-px bg-white/5">
        <div 
          className="h-full transition-all duration-100 ease-out"
          style={{ 
            width: `${Math.min(100, Math.max(0, progress))}%`,
            backgroundColor: accentColor,
            boxShadow: `0 0 12px ${accentColor}33`
          }}
        />
      </div>
    </header>
  );
};
