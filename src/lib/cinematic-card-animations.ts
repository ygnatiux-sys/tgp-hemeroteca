// ─────────────────────────────────────────────────────────────────────────────
// TGP HEMEROTECA — Coreografía y Animaciones Cinemáticas GSAP
// ─────────────────────────────────────────────────────────────────────────────
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(Flip, SplitText);

export const runCardSequence = (card: HTMLElement): Promise<void> => {
  return new Promise((resolve) => {
    if (card.dataset.choreographyDone === "true") {
      resolve();
      return;
    }
    card.dataset.choreographyDone = "true";
    card.classList.add("choreography-active");

    const img = card.querySelector<HTMLElement>(".cac-card-img");
    const normalUi = card.querySelector<HTMLElement>(".cac-normal-ui");
    const cinematicLayer = card.querySelector<HTMLElement>(
      ".cac-hero-cinematic-layer",
    );
    const textAnim = card.querySelector<HTMLElement>(".cac-hero-text-anim");
    const h1Container = card.querySelector<HTMLElement>(".ch-h1-container");
    const ctaBtn = card.querySelector<HTMLElement>(".ch-cta-btn");
    const excerptContainer = card.querySelector<HTMLElement>(
      ".ch-excerpt-container",
    );
    const dekContainer = card.querySelector<HTMLElement>(".ch-dek-container");
    const tags = Array.from(card.querySelectorAll<HTMLElement>(".ch-tag"));

    const tl = gsap.timeline({
      onComplete: () => {
        card.classList.add("card-settled");
        resolve();
      },
    });

    const isHeroCard =
      card.dataset.isHero === "true" || card.dataset.variant === "hero";

    // ══════════════════════════════════════════════════════════════════
    // CASO 1: TARJETAS ESTÁNDAR / NO-HERO (Lógica original intacta)
    // ══════════════════════════════════════════════════════════════════
    if (!isHeroCard) {
      // 1. Pase 1 del Metal Sweep (Inicio Rápido) + Tags pulse
      if (ctaBtn) {
        ctaBtn.classList.remove("sweep-fast", "sweep-slow");
        void ctaBtn.offsetWidth;
        ctaBtn.classList.add("sweep-fast");
      }

      if (tags.length) {
        tl.fromTo(
          tags,
          { opacity: 0, filter: "blur(2px)" },
          {
            opacity: 1,
            filter: "blur(0px)",
            duration: 0.6,
            stagger: 0.03,
            ease: "power2.out",
          },
          0,
        ).to(tags, { opacity: 0.7, duration: 0.4 }, 0.6);
      }

      // 2. H1 zoom-out para ceder el escenario al excerpt (suave y orgánico)
      if (h1Container && excerptContainer) {
        tl.to(
          h1Container,
          {
            scale: 1.025,
            y: -2,
            filter: "blur(6px)",
            opacity: 0,
            duration: 1.1,
            ease: "power2.inOut",
            force3D: true,
          },
          0.4,
        );
      }

      // 3. Excerpt escribe toda la línea a la vez
      if (excerptContainer) {
        tl.fromTo(
          excerptContainer,
          { opacity: 0, filter: "blur(12px)", y: 8 },
          {
            opacity: 1,
            filter: "blur(0px)",
            y: 0,
            duration: 0.8,
            ease: "power3.out",
          },
          0.8,
        );

        // 4. Pausa de lectura
        tl.to({}, { duration: 2.8 });

        // 5. Disolución fluida del excerpt
        tl.to(excerptContainer, {
          opacity: 0,
          filter: "blur(10px)",
          scale: 0.98,
          y: -4,
          duration: 0.8,
          ease: "power2.inOut",
        });
      }

      // 6. Re-materialización líquida del H1
      if (h1Container) {
        tl.fromTo(
          h1Container,
          { opacity: 0, filter: "blur(14px)", scale: 0.98, y: 6 },
          {
            opacity: 1,
            filter: "blur(0px)",
            scale: 1,
            y: 0,
            duration: 1.2,
            ease: "power3.out",
            force3D: true,
          },
          excerptContainer ? "-=0.2" : "0",
        );
      }

      // 7. Dek exterior: revelado suave
      if (dekContainer) {
        tl.fromTo(
          dekContainer,
          { opacity: 0.7, y: 2 },
          { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
          0.4,
        );
      }

      // 8. Pase 2 del Metal Sweep
      if (ctaBtn) {
        tl.add(() => {
          ctaBtn.classList.remove("sweep-fast", "sweep-slow");
          void ctaBtn.offsetWidth;
          ctaBtn.classList.add("sweep-slow");
        }, "-=0.6");
      }

      tl.to({}, { duration: 2.5 });
      return;
    }

    // ══════════════════════════════════════════════════════════════════
    // CASO 2: HERO CARD CINEMÁTICO (Idéntico a Mode Tray Vertical)
    // ══════════════════════════════════════════════════════════════════
    const isPortrait = card.dataset.isPortrait === "true";
    const isFace = card.dataset.isFace === "true";
    const isDocument = card.dataset.isDocument === "true";

    // 1. Tags pulse sutil
    if (tags.length) {
      tl.fromTo(
        tags,
        { opacity: 0, filter: "blur(2px)" },
        {
          opacity: 1,
          filter: "blur(0px)",
          duration: 0.5,
          stagger: 0.03,
          ease: "power2.out",
        },
        0,
      ).to(tags, { opacity: 0.7, duration: 0.3 }, 0.5);
    }

    // 2. Pausa contemplativa inicial (0.8s para agilizar arranque)
    tl.to({}, { duration: 0.8 });

    // 3. FASE 1: Movimiento de imagen según si es rostro, documento/tarot o paisaje
    tl.add(() => {
      if (img) {
        if (isFace) {
          img.style.objectPosition = "20% 50%";
          img.style.transform = "scale(1.045)";
        } else if (isDocument) {
          img.style.objectPosition = "50% 20%";
          img.style.transform = "scale(1.02)";
        } else {
          img.style.objectPosition = "50% 38%";
          img.style.transform = "scale(1.025)";
        }
      }
    });

    if (normalUi) {
      tl.to(
        normalUi,
        { opacity: 0, duration: 0.7, ease: "power2.inOut" },
        "<",
      );
    }

    if (cinematicLayer) {
      tl.to(
        cinematicLayer,
        { opacity: 1, duration: 0.7, ease: "power2.inOut" },
        "<",
      );
    }

    // 4. FASE 2: Aparición de la frase cinemática
    if (textAnim) {
      tl.fromTo(
        textAnim,
        { opacity: 0, y: 16, scale: 0.98, filter: "blur(5px)" },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          filter: "blur(0px)",
          duration: 1.1,
          ease: "cubic-bezier(0.25, 1, 0.5, 1)",
        },
        "-=0.2",
      );
    }

    // 5. FASE 3: Pausa contemplativa de lectura completa (3.6s)
    tl.to({}, { duration: 3.6 });

    // 6. FASE 4: Retorno cinemático
    if (textAnim) {
      tl.to(textAnim, {
        opacity: 0,
        filter: "blur(5px)",
        y: -8,
        duration: 0.5,
        ease: "power2.inOut",
      });
    }

    if (cinematicLayer) {
      tl.to(
        cinematicLayer,
        { opacity: 0, duration: 0.6, ease: "power2.inOut" },
        "<0.1",
      );
    }

    // La imagen regresa a su encuadre natural
    tl.add(() => {
      if (img) {
        if (isDocument || isPortrait) {
          img.style.objectPosition = "50% 20%";
        } else {
          img.style.objectPosition = "50% 38%";
        }
        img.style.transform = "scale(1)";
      }
    });

    // La UI normal reaparece y queda fijada permanentemente
    if (normalUi) {
      tl.to(
        normalUi,
        {
          opacity: 1,
          duration: 0.8,
          ease: "power2.out",
          onComplete: () => {
            gsap.set(normalUi, {
              opacity: 1,
              clearProps: "filter,transform",
            });
            if (h1Container) {
              gsap.set(h1Container, {
                opacity: 1,
                filter: "none",
                scale: 1,
                y: 0,
                clearProps: "filter,transform",
              });
            }
          },
        },
        "-=0.3",
      );
    }

    // 7. Dek exterior
    if (dekContainer) {
      tl.fromTo(
        dekContainer,
        { opacity: 0.7, y: 2 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
        0.4,
      );
    }

    // 8. Pase del Metal Sweep
    if (ctaBtn) {
      tl.add(() => {
        ctaBtn.classList.remove("sweep-fast", "sweep-slow");
        void ctaBtn.offsetWidth;
        ctaBtn.classList.add("sweep-slow");
      }, "-=0.4");
    }

    tl.to({}, { duration: 1.5 });
  });
};

export const initChoreography = () => {
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>(".cinematic-archive-card"),
  );
  if (cards.length === 0) return;

  const mm = gsap.matchMedia();

  mm.add("(min-width: 768px)", () => {
    // Hover manual directo
    cards.forEach((card) => {
      card.addEventListener(
        "mouseenter",
        () => {
          if (card.dataset.choreographyDone !== "true") {
            runCardSequence(card);
          }
        },
        { once: true },
      );
    });

    // Observer secuencial
    const queue: HTMLElement[] = [];
    let isRunning = false;

    const processNext = async () => {
      if (isRunning || queue.length === 0) return;
      isRunning = true;
      const nextCard = queue.shift();
      if (nextCard && nextCard.dataset.choreographyDone !== "true") {
        await runCardSequence(nextCard);
      }
      isRunning = false;
      processNext();
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const card = entry.target as HTMLElement;
            if (
              card.dataset.choreographyDone !== "true" &&
              !queue.includes(card)
            ) {
              queue.push(card);
              processNext();
            }
            observer.unobserve(card);
          }
        });
      },
      { threshold: 0.3 },
    );

    cards.forEach((card) => {
      if (card.dataset.choreographyDone !== "true") {
        observer.observe(card);
      }
    });

    return () => {
      observer.disconnect();
    };
  });
};

export const initCardModals = () => {
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>(".cinematic-archive-card"),
  );

  cards.forEach((card) => {
    if (card.dataset.modalInit === "true") return;
    card.dataset.modalInit = "true";

    const triggers =
      card.querySelectorAll<HTMLAnchorElement>(".cac-modal-trigger");
    const modal = card.querySelector<HTMLDialogElement>(".expandable-modal");
    if (!modal) return;

    const closeBtn =
      modal.querySelector<HTMLButtonElement>(".close-modal-btn");
    const mContainer = modal.querySelector<HTMLElement>(".modal-container");
    const mImage = modal.querySelector<HTMLImageElement>(".modal-image");
    const mTitle = modal.querySelector<HTMLElement>(".modal-title");
    const mEyebrow = modal.querySelector<HTMLElement>(".modal-eyebrow");
    const mExcerpts = modal.querySelectorAll<HTMLElement>(".modal-excerpt");
    const mCta = modal.querySelector<HTMLAnchorElement>(".modal-cta");

    if (!mContainer || !mImage || !mTitle) return;

    let currentFlipTween: gsap.core.Timeline | null = null;
    let activeCard: HTMLElement | null = null;
    let activeImg: HTMLElement | null = null;
    let activeTitle: HTMLElement | null = null;

    triggers.forEach((trigger) => {
      trigger.addEventListener("click", (e) => {
        if (
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey ||
          e.button !== 0
        )
          return;
        if (trigger.getAttribute("target") === "_blank") return;

        e.preventDefault();

        const cardId = card.dataset.cardId || "";
        const img = card.querySelector<HTMLElement>(".cac-card-img");
        const title = card.querySelector<HTMLElement>(".cac-card-title");

        activeCard = card;
        activeImg = img;
        activeTitle = title;

        mImage.src = card.dataset.image || "";
        mTitle.innerHTML = card.dataset.title || "";
        if (mEyebrow) {
          mEyebrow.innerHTML = card.dataset.eyebrow || "";
          mEyebrow.className = `modal-eyebrow text-[10px] tracking-[0.3em] uppercase font-metadata font-bold mb-2 ${card.dataset.eyebrowClass || "text-rust-orange"}`;
          mEyebrow.style.display = card.dataset.eyebrow ? "block" : "none";
          mEyebrow.style.opacity = "1";
        }
        mExcerpts.forEach(
          (el) => (el.innerHTML = card.dataset.excerpt || ""),
        );
        if (mCta) mCta.href = card.dataset.link || "#";

        const extraContent = mContainer.querySelectorAll(
          ".modal-excerpt, .modal-cta, .close-modal-btn, .modal-eyebrow",
        );
        gsap.set(extraContent, { clearProps: "all" });
        gsap.set([mContainer, mImage, mTitle], { clearProps: "all" });

        mContainer.dataset.flipId = `card-container-${cardId}`;
        mImage.dataset.flipId = `card-image-${cardId}`;
        mTitle.dataset.flipId = `card-title-${cardId}`;

        const targetsToFlip = [card, img, title].filter(
          (el): el is HTMLElement => el !== null,
        );
        const state = Flip.getState(targetsToFlip);

        modal.showModal();

        currentFlipTween = Flip.from(state, {
          targets: [mContainer, mImage, mTitle],
          duration: 0.5,
          ease: "power3.inOut",
          absolute: true,
        });
      });
    });

    const closeModal = () => {
      if (!modal.open) return;

      const eyebrow = mContainer.querySelector(
        ".modal-eyebrow",
      ) as HTMLElement | null;
      if (eyebrow) eyebrow.style.display = "none";

      const extraContent = mContainer.querySelectorAll(
        ".modal-excerpt, .modal-cta, .close-modal-btn",
      );
      gsap.to(extraContent, { opacity: 0, duration: 0.15 });

      if (currentFlipTween) {
        currentFlipTween.timeScale(1.3).reverse();
        currentFlipTween.eventCallback("onReverseComplete", () => {
          modal.close();
          gsap.set(
            [mContainer, mImage, mTitle, ...Array.from(extraContent)],
            { clearProps: "all" },
          );
          currentFlipTween = null;
          activeCard = null;
          activeImg = null;
          activeTitle = null;
        });
      } else {
        modal.close();
      }
    };

    if (closeBtn) {
      closeBtn.addEventListener("click", closeModal);
    }

    modal.addEventListener("cancel", (e) => {
      e.preventDefault();
      closeModal();
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  });
};

export const initCinematicCards = () => {
  initChoreography();
  initCardModals();
};

export const setupCinematicCardsLifecycle = () => {
  document.addEventListener("astro:page-load", initCinematicCards);
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    initCinematicCards();
  } else {
    document.addEventListener("DOMContentLoaded", initCinematicCards);
  }
};
