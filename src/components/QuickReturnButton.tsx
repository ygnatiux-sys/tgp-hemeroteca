import React, { useState, useEffect } from 'react';

interface Props {
  accentColor: string;
}

export const QuickReturnButton: React.FC<Props> = ({ accentColor }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const windowHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollProgress = (currentScrollY / windowHeight) * 100;

      // Solo aparece después del 50% de lectura (UX: Da calma visual)
      setIsVisible(scrollProgress > 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleReturn = () => {
    // Intentamos volver a la hemeroteca
    window.location.href = '/archivo';
  };

  return (
    <button
      onClick={handleReturn}
      className={`fixed bottom-10 right-10 z-90 w-14 h-14 rounded-full border border-white/5 bg-white/2 backdrop-blur-[2px] flex items-center justify-center text-white/20 hover:text-white/80 hover:border-white/20 hover:bg-white/5 transition-all duration-700 ease-in-out group ${
        isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-10 opacity-0 scale-90 pointer-events-none'
      }`}
      title="Volver a la Hemeroteca"
    >
      <div className="relative flex flex-col items-center">
        {/* Etiqueta flotante */}
        <span className="text-[9px] font-mono tracking-[0.4em] uppercase opacity-0 group-hover:opacity-60 transition-all duration-500 absolute -top-8 whitespace-nowrap translate-y-2 group-hover:translate-y-0">
          Cerrar
        </span>
        
        {/* Icono Minimalista */}
        <svg 
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"
          className="transition-all duration-700 group-hover:rotate-90 group-hover:scale-110"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </div>
      
      {/* Halo de luz sutil (Respeto por el color del tema) */}
      <div 
        className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-10 blur-xl transition-opacity duration-700"
        style={{ backgroundColor: accentColor }}
      />
    </button>
  );
};
