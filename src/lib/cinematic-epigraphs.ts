// ─────────────────────────────────────────────────────────────────────────────
// TGP HEMEROTECA — Catálogo de Epígrafes Cinemáticos y Formateo Tipográfico
// ─────────────────────────────────────────────────────────────────────────────

export const epigraphMap: Record<string, string> = {
  arqueosemiotica:
    "Los [[signos]] sobreviven a los imperios. **Cada glifo,** un mensaje lanzado a la eternidad sin destinatario conocido.",
  filosofia:
    "El pensamiento como [[territorio.]] Las **ideas no mueren:** se transforman, se heredan, se contradicen.",
  mitologia:
    "Antes del dato, existió el [[mito.]] El relato que **une cielo y tierra** antes de que la ciencia los separara.",
  historia:
    "El [[tiempo]] no es lineal. Es una **red de causas** que la memoria humana teje y desteje sin cesar.",
  "ensayos-cinematicos":
    "Imágenes que **piensan.** El [[cine]] como forma de conocimiento antes de que el conocimiento fuera escrito.",
  arquetipos:
    "Figuras que reaparecen en cada cultura. Los [[arquetipos]] son la gramática **secreta del ser humano.**",
  "arquetipos-globales":
    "Figuras que reaparecen en cada cultura. Los [[arquetipos]] son la gramática **secreta del ser humano.**",
  "historia-natural":
    "La vida como **archivo.** Cada especie, un [[capítulo]] de una historia que empezó mucho antes que nosotros.",
  "historia-antigua":
    "Las [[civilizaciones]] no colapsan: **se transforman.** Sus ruinas son preguntas, no respuestas.",
  "historia-medieval":
    "Entre el [[fin del mundo]] romano y el alba del moderno, **siglos de invención** que el olvido llama oscuros.",
  religion:
    "Lo [[sagrado]] como necesidad primaria. **Cada fe,** un intento humano de darle nombre al misterio.",
};

export function parseHeroPhrase(text: string): string {
  if (!text) return "";
  const clean = text.replace(/^[#*`>\s]+/, "").trim();

  if (clean.includes("[[") || clean.includes("**")) {
    return clean
      .replace(
        /\*\*([^*]+)\*\*/g,
        '<strong class="text-white font-bold md:font-black">$1</strong>',
      )
      .replace(
        /\[\[([^\]]+)\]\]/g,
        '<span class="italic text-amber-200/90 font-serif drop-shadow-[0_0_12px_rgba(245,158,11,0.5)]">$1</span>',
      )
      .replace(
        /(^|[^*])\*([^*]+)\*([^*]|$)/g,
        '$1<span class="italic text-white/95 font-serif">$2</span>$3',
      );
  }

  // Estilizado suave para excerpts planos: resalta las primeras dos palabras con serif ámbar
  const words = clean.split(" ");
  if (words.length > 3) {
    const firstTwo = words.slice(0, 2).join(" ");
    const rest = words.slice(2).join(" ");
    return `<span class="italic text-amber-200/90 font-serif">${firstTwo}</span> ${rest}`;
  }

  return clean;
}
