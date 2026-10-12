/**
 * src/utils/osireion.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * LÓGICA DE ANIMACIÓN CLIENTE: 'EL OSIREION' (ABIDOS, EGIPTO)
 *
 * Módulo TypeScript dedicado para animaciones GSAP y eventos del Hero Osireion.
 */
import { gsap } from "gsap";

export function initOsireionHero(rootSelector = ".osireion-hero-root") {
  const root = document.querySelector<HTMLElement>(rootSelector);
  if (!root || root.dataset.osireionReady === "true") return;
  root.dataset.osireionReady = "true";

  const badge = root.querySelector<HTMLElement>(".osireion-badge");
  const titleMain = root.querySelector<HTMLElement>(".osireion-title-main");
  const titleStone = root.querySelector<HTMLElement>(".osireion-title-stone");
  const waterLine = root.querySelector<HTMLElement>(".osireion-water-line");
  const sub = root.querySelector<HTMLElement>(".osireion-sub");
  const desc = root.querySelector<HTMLElement>(".osireion-desc");
  const cta = root.querySelector<HTMLElement>(".osireion-cta");
  const img = root.querySelector<HTMLElement>(".osireion-img");
  const turb = document.getElementById("osireion-turb");
  const disp = document.getElementById("osireion-disp");

  if (!badge || !titleMain || !titleStone || !waterLine || !sub || !desc) return;

  let tl: gsap.core.Timeline | null = null;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Reset de estado inicial
  const reset = () => {
    tl?.kill();
    tl = null;

    gsap.set(badge, { opacity: 0, y: -16 });
    gsap.set(titleMain, {
      clipPath: "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)",
      opacity: 1,
    });
    titleStone.classList.add("is-underwater");
    titleStone.classList.remove("is-dry-stone");

    gsap.set(waterLine, { top: "0%", opacity: 0 });
    gsap.set(sub, { opacity: 0.2, y: 45, filter: "blur(12px)" });
    gsap.set(desc, { opacity: 0, y: 25 });
    if (cta) gsap.set(cta, { opacity: 0, y: 20 });
    if (img) gsap.set(img, { scale: 1.06, y: 0 });
  };

  const play = () => {
    reset();

    if (reduceMotion) {
      gsap.set([badge, desc], { opacity: 1, y: 0 });
      gsap.set(titleMain, { clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)" });
      titleStone.classList.remove("is-underwater");
      titleStone.classList.add("is-dry-stone");
      gsap.set(sub, { opacity: 1, y: 0, filter: "none" });
      if (cta) gsap.set(cta, { opacity: 1, y: 0 });
      return;
    }

    const mainTl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl = mainTl;

    // 1. Sutil acercamiento monumental de la cámara
    if (img) {
      mainTl.to(img, { scale: 1.0, duration: 4.5, ease: "power1.out" }, 0);
    }

    // 2. Aparición del badge
    mainTl.to(badge, { opacity: 1, y: 0, duration: 0.8 }, 0.2);

    // 3. Activación de la línea de superficie del agua
    mainTl.to(waterLine, { opacity: 0.85, duration: 0.3 }, 0.4);

    // 4. DESCENSO DEL AGUA (Revelación por máscara de arriba hacia abajo)
    // Simula que el agua baja, revelando la roca megalítica desnuda
    mainTl.to(
      waterLine,
      {
        top: "100%",
        duration: 2.2,
        ease: "power2.inOut",
      },
      0.5
    );

    mainTl.to(
      titleMain,
      {
        clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
        duration: 2.2,
        ease: "power2.inOut",
        onUpdate: function () {
          // Animación suave de turbulencia acuática durante el retroceso del agua
          if (disp && turb) {
            const prog = this.progress();
            const scaleVal = (1 - prog) * 16;
            disp.setAttribute("scale", scaleVal.toFixed(1));
          }
        },
        onComplete: () => {
          // El agua terminó de bajar: el texto se vuelve nítido, seco y brutalmente sólido
          titleStone.classList.remove("is-underwater");
          titleStone.classList.add("is-dry-stone");
          gsap.to(waterLine, { opacity: 0, duration: 0.4 });
        },
      },
      0.5
    );

    // 5. ECOS EN LA CAVERNA (H2 y H3 flotando desde la base como burbujas o ecos)
    // Opacidad inicial 20% -> 100%, elevándose desde el fondo
    mainTl.fromTo(
      sub,
      { opacity: 0.2, y: 45, filter: "blur(12px)" },
      {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        duration: 1.8,
        ease: "power3.out",
      },
      1.6
    );

    mainTl.to(
      desc,
      {
        opacity: 0.85,
        y: 0,
        duration: 1.2,
      },
      2.2
    );

    // 6. Botón CTA
    if (cta) {
      mainTl.to(
        cta,
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
        },
        2.6
      );
    }
  };

  // Auto-arranque al entrar en viewport
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          play();
        } else {
          reset();
        }
      });
    },
    { threshold: 0.15 }
  );

  window.addEventListener("osireion:replay", () => {
    play();
  });

  observer.observe(root);
}
