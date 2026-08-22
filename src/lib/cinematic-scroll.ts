import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Inicializa el comportamiento de scroll cinematográfico para los bloques de lectura.
 *
 * Características:
 *  - Fade in + des-desenfoque (0 al 25% del progreso).
 *  - HOLD (Mantener intacto en el centro para lectura clara: 25% al 75% del progreso).
 *  - Fade out + desenfoque hacia arriba (75% al 100% del progreso).
 */
export function initCinematicScroll() {
  const blocks = gsap.utils.toArray<HTMLElement>('.cinematic-block');
  if (!blocks.length) return;

  blocks.forEach((block) => {
    // Si ya fue inicializado, evitar duplicación de triggers
    if (block.dataset.cinematicInit === 'true') return;
    block.dataset.cinematicInit = 'true';

    const speedFactor = 1.3; // Más ágil y fluido
    const isHeading = !!block.querySelector('h1, h2, h3');
    const isQuote = !!block.querySelector('blockquote');

    const baseEnter = isHeading ? 1.0 : 0.9;
    const baseHold = isHeading ? 1.2 : 0.9; // Retención más corta para acelerar el scroll
    const baseExit = isHeading ? 1.0 : 0.9;

    // Timeline sincronizado con ScrollTrigger para controlar la ventana de "Hold" central
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: block,
        start: "top 92%",    // Inicia más cerca del final del viewport
        end: "bottom 8%",   // Culmina más cerca del inicio del viewport
        scrub: 1.0,          // Suavizado cinemático ágil
      }
    });

    if (isHeading) {
      // Tweens especializados para TÍTULOS (Gloock / Cinzel: escala majestuosa y destello óptico convergente)
      tl.fromTo(block,
        { opacity: 0, filter: "blur(18px)", scale: 0.93, y: 30 },
        { opacity: 1, filter: "blur(0px)", scale: 1, y: 0, duration: baseEnter / speedFactor, ease: "power2.out" }
      )
      .to(block, { opacity: 1, filter: "blur(0px)", scale: 1, duration: baseHold / speedFactor })
      .to(block, { 
        opacity: 0, 
        filter: "blur(18px)", 
        scale: 1.05, 
        y: -24,
        duration: baseExit / speedFactor, 
        ease: "power2.in" 
      });
    } else if (isQuote) {
      // Tweens para RESPIRO CINEMÁTICO TGP (Cita completa que emerge en conjunto con acento dorado)
      tl.fromTo(block,
        { opacity: 0, filter: "blur(14px)", scale: 0.96, y: 22 },
        { opacity: 1, filter: "blur(0px)", scale: 1, y: 0, duration: baseEnter / speedFactor, ease: "power2.out" }
      )
      .to(block, { opacity: 1, filter: "blur(0px)", scale: 1, duration: baseHold / speedFactor })
      .to(block, { 
        opacity: 0, 
        filter: "blur(14px)", 
        scale: 1.03, 
        y: -20,
        duration: baseExit / speedFactor, 
        ease: "power2.in" 
      });
    } else {
      // Tweens para PÁRRAFOS COMPLETOS (Revelado armónico de conjunto: 100% nítido y legible en bloque)
      tl.fromTo(block, 
        { opacity: 0, filter: "blur(14px)", scale: 0.96, y: 18 },
        { opacity: 1, filter: "blur(0px)", scale: 1, y: 0, duration: baseEnter / speedFactor, ease: "power2.out" }
      )
      .to(block, { opacity: 1, filter: "blur(0px)", scale: 1, duration: baseHold / speedFactor })
      .to(block, { 
        opacity: 0, 
        filter: "blur(14px)", 
        scale: 1.03, 
        y: -18,
        duration: baseExit / speedFactor, 
        ease: "power2.in" 
      });
    }
  });
}
