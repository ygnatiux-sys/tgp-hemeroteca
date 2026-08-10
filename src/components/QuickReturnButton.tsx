import React, { useState, useEffect, useCallback, useRef } from 'react';

interface Props {
  accentColor?: string;
  fallbackUrl?: string;
  forceVisible?: boolean;
}

/**
 * QuickReturnButton — Widget de Escape Nudo Cinemático (Edición 2026)
 * ──────────────────────────────────────────────────────────────────────────────
 *  - Sin Borde (solo ícono TGP y fill que se desvanece suavemente).
 *  - Con Selección (Hover): Gira 180° una sola vez a '← ESC' y queda fijo ahí.
 *  - En Click: Gira a 360° 'BACK' y ejecuta el retorno inteligente.
 *  - Sin Selección (Mouse Leave): Vuelve inmediatamente a 'iconTGP default' (0°)
 *    y se desvanece suavemente (fill fade out).
 */
export const QuickReturnButton: React.FC<Props> = ({
  fallbackUrl = '/archivo',
  forceVisible = false,
}) => {
  const [isVisible, setIsVisible] = useState(forceVisible);
  const [isHovered, setIsHovered] = useState(false);
  const [spinDegree, setSpinDegree] = useState(0); // 0° = Icon TGP Default, 180° = ESC, 360° = BACK
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Retorno contextual inteligente (En Click muestra BACK y ejecuta retorno)
  const handleSmartReturn = useCallback(() => {
    setSpinDegree(360);

    setTimeout(() => {
      if (typeof window !== 'undefined') {
        const hasPreviousHistory = window.history.length > 1 && document.referrer.includes(window.location.host);
        if (hasPreviousHistory) {
          window.history.back();
        } else {
          window.location.href = fallbackUrl;
        }
      }
    }, 260);
  }, [fallbackUrl]);

  // Visibilidad en hitos clave (3/4 partes de la nota) o forzada por prop (slides)
  useEffect(() => {
    if (forceVisible) {
      setIsVisible(true);
      return;
    }

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const windowHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollProgress = windowHeight > 0 ? (currentScrollY / windowHeight) * 100 : 0;

      // Hitos clave: ≥72% del post
      const isAtMilestone = scrollProgress >= 72;

      if (isAtMilestone) {
        setIsVisible(true);

        if (!isHovered) {
          if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
          hideTimerRef.current = setTimeout(() => {
            setIsVisible(false);
          }, 3200);
        }
      } else {
        if (!isHovered) {
          setIsVisible(false);
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [isHovered]);

  // Tecla 'Escape' (Esc) siempre activa el retorno inteligente
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSmartReturn();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSmartReturn]);

  // CON SELECCIÓN (Hover): Gira a ESC (180°) y se queda fijo (no gira más)
  const handleMouseEnter = () => {
    setIsHovered(true);
    setIsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);

    setSpinDegree(180); // Queda fijo en ESC mientras se mantenga la selección
  };

  // SIN SELECCIÓN (Mouse Leave): Vuelve inmediatamente a Icon TGP Default (0°) y desvanece
  const handleMouseLeave = () => {
    setIsHovered(false);

    // Vuelve al Favicon TGP Default (0°)
    setSpinDegree(0);

    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 2200);
  };

  return (
    <div
      className={`woc-root fixed bottom-6 right-6 md:bottom-8 md:right-8 z-90 transition-opacity duration-1000 ease-in-out ${
        isVisible ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={handleSmartReturn}
        className="woc-button-naked group border-0 outline-none shadow-none"
        title="Volver al sector anterior (Tecla ESC)"
        aria-label="Volver al sector anterior"
      >
        {/* Contenedor interno con giro 3D (0° = Icon TGP Default, 180° = ESC, 360° = BACK) */}
        <div
          className="woc-inner-naked"
          style={{ transform: `rotateY(${spinDegree}deg)` }}
        >
          {/* Cara 0° (Sin selección / Default): Favicon Logo TGP en relleno ahumado sutil */}
          <div className="woc-face woc-face-0 overflow-hidden bg-black/25">
            <img
              src="/images/favicon.TGP.webp"
              alt="TGP"
              className="w-full h-full object-cover p-1 rounded-full brightness-110 opacity-90 transition-opacity duration-300 group-hover:opacity-100"
            />
          </div>

          {/* Cara 180° (Con selección / Hover): Queda fijo en ESC */}
          <div className="woc-face woc-face-180 flex items-center justify-center bg-[#1A1C1D]">
            <span className="text-[#C8A98B] font-mono text-[11px] font-bold tracking-wider">
              ← ESC
            </span>
          </div>

          {/* Cara 360° (En Click): Muestra BACK */}
          <div className="woc-face woc-face-360 flex items-center justify-center bg-[#1A1C1D]">
            <span className="text-white font-mono text-[10px] font-bold tracking-widest uppercase">
              BACK
            </span>
          </div>
        </div>
      </button>
    </div>
  );
};
