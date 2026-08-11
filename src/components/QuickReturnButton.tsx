import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './QuickReturnButton.module.css';

interface Props {
  accentColor?: string;
  fallbackUrl?: string;
  forceVisible?: boolean;
  /** `papers`: más chico + oculta más rápido por inactividad */
  variant?: 'default' | 'papers';
}

/**
 * QuickReturnButton — Widget de Escape Nudo Cinemático (WOC)
 * Botón flotante fijo para cerrar / volver (ESC / BACK).
 * Estilos autocontenidos: válido en Layout oscuro y AcademicLayout / Papers.
 */
export const QuickReturnButton: React.FC<Props> = ({
  fallbackUrl = '/archivo',
  forceVisible = false,
  variant = 'default',
}) => {
  const isPapers = variant === 'papers';
  const hideDelayMs = isPapers ? 900 : 3200;
  const leaveDelayMs = isPapers ? 550 : 2200;

  // No pintar nada hasta montar en cliente → evita flash SSR del logo
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [spinDegree, setSpinDegree] = useState(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoveredRef = useRef(false);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(
    (delay: number) => {
      clearHideTimer();
      hideTimerRef.current = setTimeout(() => {
        if (!isHoveredRef.current) setIsVisible(false);
      }, delay);
    },
    [clearHideTimer]
  );

  const handleSmartReturn = useCallback(() => {
    setSpinDegree(360);

    // Espera al giro lento hacia BACK antes de navegar
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        const hasPreviousHistory =
          window.history.length > 1 && document.referrer.includes(window.location.host);
        if (hasPreviousHistory) {
          window.history.back();
        } else {
          window.location.href = fallbackUrl;
        }
      }
    }, 1100);
  }, [fallbackUrl]);

  useEffect(() => {
    setMounted(true);
    if (forceVisible) setIsVisible(true);
  }, [forceVisible]);

  useEffect(() => {
    if (!mounted || forceVisible) return;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const windowHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollProgress = windowHeight > 0 ? (currentScrollY / windowHeight) * 100 : 0;
      const isAtMilestone = scrollProgress >= 72;

      if (isAtMilestone) {
        setIsVisible(true);
        if (!isHoveredRef.current) scheduleHide(hideDelayMs);
      } else if (!isHoveredRef.current) {
        setIsVisible(false);
        clearHideTimer();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearHideTimer();
    };
  }, [mounted, forceVisible, hideDelayMs, scheduleHide, clearHideTimer]);

  useEffect(() => {
    if (!mounted) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSmartReturn();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mounted, handleSmartReturn]);

  const handleMouseEnter = () => {
    isHoveredRef.current = true;
    setIsVisible(true);
    clearHideTimer();
    setSpinDegree(180);
  };

  const handleMouseLeave = () => {
    isHoveredRef.current = false;
    setSpinDegree(0);
    scheduleHide(leaveDelayMs);
  };

  if (!mounted) return null;

  return (
    <div
      className={[
        styles.wocRoot,
        isPapers ? styles.wocRootPapers : '',
        isVisible ? styles.wocRootVisible : styles.wocRootHidden,
      ]
        .filter(Boolean)
        .join(' ')}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-hidden={!isVisible}
    >
      <button
        type="button"
        onClick={handleSmartReturn}
        className={[styles.wocButton, isPapers ? styles.wocButtonPapers : '']
          .filter(Boolean)
          .join(' ')}
        title="Volver al sector anterior (Tecla ESC)"
        aria-label="Volver al sector anterior"
      >
        <div
          className={styles.wocInner}
          style={{ transform: `rotateY(${spinDegree}deg)` }}
        >
          <div className={`${styles.wocFace} ${styles.wocFace0}`}>
            <img
              src="/images/favicon.TGP.webp"
              alt=""
              className={styles.wocIcon}
              width={40}
              height={40}
              decoding="async"
              fetchPriority="low"
            />
          </div>

          <div className={`${styles.wocFace} ${styles.wocFace180}`}>
            <span className={styles.wocLabelEsc}>← ESC</span>
          </div>

          <div className={`${styles.wocFace} ${styles.wocFace360}`}>
            <span className={styles.wocLabelBack}>BACK</span>
          </div>
        </div>
      </button>
    </div>
  );
};
