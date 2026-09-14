export interface ParseLLMTextOptions {
  isHeroCinematicStyle?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Regex único que cubre TODOS los tipos de comillas dobles que pueden llegar
// del LLM o del JSON escapado:
//   " (ASCII),  " "  (curly Unicode),  « »  (guillemets),
//   \\" (backslash+quote literal),  &quot; (HTML entity)
// Se aplica en el texto CRUDO, antes de inyectar ningún HTML.
// ─────────────────────────────────────────────────────────────────────────────
const DOUBLE_QUOTE_RE = /\\"|&quot;|["""«»]/g;

/**
 * Transforma el texto crudo de un LLM en HTML estructurado para animaciones GSAP.
 * Resuelve saltos de línea duros y agrupa en bloques cinemáticos con espaciado vertical.
 * Admite formateo enriquecido tipo Hero Cinemático (palabras destacadas [[...]], **...**, etc.)
 */
export function parseLLMText(rawText: string, options: ParseLLMTextOptions = {}): string {
  if (!rawText) return '';

  const { isHeroCinematicStyle = false } = options;

  // 0. Limpiar posibles artefactos de portapapeles (StartFragment / EndFragment)
  let text = rawText.replace(/\\?\s*(?:StartFragment|EndFragment)\s*/gi, '').trim();

  // 0.5 Sanitizar TODAS las variantes de comillas dobles del texto crudo,
  //     antes de inyectar ninguna etiqueta HTML (para no romper class="...").
  text = text.replace(DOUBLE_QUOTE_RE, '');

  // 1. Escapar HTML peligroso
  let html = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 2. Normalizar retornos de carro (Windows a Unix)
  html = html.replace(/\r\n/g, '\n');

  // 3. Citas en bloque contiguas (Blockquotes: > texto o &gt; texto) con Formato RESPIRO CINEMÁTICO TGP
  // Agrupa todas las líneas consecutivas que comienzan con > o &gt; en una sola tarjeta con cita + autor
  html = html.replace(/((?:^(?:&gt;|> )[^\n]*(?:\n|$))+)/gm, (match) => {
    const rawLines = match
      .split('\n')
      .map(line => line.replace(/^(?:&gt;|> )\s*/, '').trim())
      .filter(Boolean);

    if (!rawLines.length) return '';

    let quoteLines: string[] = [];
    let authorLine = '';

    rawLines.forEach((line) => {
      // 1. Si la línea comienza con guión (en nueva línea)
      if (/^(?:—|--|-|&mdash;)\s*(.*)/i.test(line) && quoteLines.length > 0) {
        authorLine = line.replace(/^(?:—|--|-|&mdash;)\s*/i, '').trim();
      } else {
        // 2. Si la atribución está al final de la misma línea (ej: "texto. — Autor")
        // Buscamos un espacio, guión, espacio y luego texto que no termine en minúscula para evitar cortes erróneos
        const inlineMatch = line.match(/(.*)\s+(?:—|--|&mdash;)\s+(.+)$/);
        if (inlineMatch && inlineMatch[1].length > 20) {
          quoteLines.push(inlineMatch[1].trim());
          authorLine = inlineMatch[2].trim();
        } else {
          quoteLines.push(line);
        }
      }
    });

    // Limpiamos asteriscos sobrantes en el autor para que no reciba el estilo itálico exagerado
    if (authorLine) {
      authorLine = authorLine.replace(/\*/g, '').trim();
    }

    // quoteBody ya llegó limpio desde el paso 0.5 — no se necesita un segundo replace
    const quoteBody = quoteLines.join(' ').trim();

    return `
      <div class="respiro-cinematico-card border-l-4 border-[#d97736] bg-white/5 py-8 px-8 md:px-14 rounded-r-2xl shadow-xl max-w-[64ch] w-full mx-auto my-10 text-center backdrop-blur-md">
        <span class="respiro-eyebrow font-metadata text-[10px] md:text-[11px] uppercase tracking-[0.35em] text-[#dfca9d]/90 font-bold block mb-5">RESPIRO CINEMÁTICO · TGP</span>
        <blockquote class="italic text-white/95 font-serif font-light text-center text-xl sm:text-2xl md:text-[1.65rem] leading-relaxed text-balance">
          ${quoteBody}
        </blockquote>
        ${authorLine ? `
          <cite class="block font-metadata text-xs md:text-sm text-[#dfca9d]/85 uppercase tracking-[0.25em] mt-6 not-italic font-semibold">
            — ${authorLine}
          </cite>
        ` : ''}
        <div class="h-px w-24 bg-linear-to-r from-transparent via-[#dfca9d]/50 to-transparent mx-auto mt-6" aria-hidden="true"></div>
      </div>
    `;
  });

  // 4. Glifos / Palabras destacadas estilo Hero Cinemático ([[palabra]])
  html = html.replace(/\[\[([^\]]+)\]\]/g, 
    '<span class="hero-word-glow italic text-amber-200/95 font-serif drop-shadow-[0_0_14px_rgba(245,158,11,0.6)]">$1</span>'
  );

  // 5. Palabras clave en negrita (**palabra**) con presencia luminosa
  html = html.replace(/\*\*(.+?)\*\*/g, 
    '<strong class="hero-word-bold font-bold text-white md:font-black tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]">$1</strong>'
  );

  // 6. Cursivas simples (*palabra*) - IMPORTANTE: después de negritas
  if (isHeroCinematicStyle) {
    html = html.replace(/\*([^*\r\n]+)\*/g, 
      '<span class="hero-word-italic italic text-amber-100/95 font-serif drop-shadow-[0_0_8px_rgba(217,119,54,0.35)]">$1</span>'
    );
  } else {
    html = html.replace(/\*([^*\r\n]+)\*/g, '<span class="italic text-white/80">$1</span>');
  }

  // 7. Títulos (#, ## y ###) con tipografía Gloock / Cinzel y Gradiente
  html = html.replace(/^###\s+(.*)$/gm, 
    '<h3 class="font-[\'Cinzel\',serif] text-2xl sm:text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-linear-to-b from-[#F5F4F0] via-[#DFCA9D] to-[#94A3B8] drop-shadow-[0_4px_20px_rgba(0,0,0,0.85)] tracking-tight mb-5 mt-8 block w-full text-center">$1</h3>'
  );
  html = html.replace(/^#{1,2}\s+(.*)$/gm, 
    '<h2 class="font-[\'Gloock\',serif] text-4xl sm:text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-linear-to-b from-white via-[#E2E8F0] to-[#DFCA9D] drop-shadow-[0_6px_35px_rgba(0,0,0,0.95)] tracking-tight mb-6 mt-10 block w-full text-center">$1</h2>'
  );

  // 8. Separación SEMÁNTICA real
  // Dividimos únicamente donde hay 2 o más saltos de línea (párrafos reales)
  const blocks = html.split(/\n{2,}/);
  
  const wrapped = blocks
    .map(block => {
      let trimmed = block.trim();
      if (!trimmed) return '';
      
      // Si el bloque ya es un título o tarjeta de respiro cinemático
      if (/^<(h[1-6]|div class="respiro-cinematico-card)/i.test(trimmed)) {
        trimmed = trimmed.replace(/\n/g, ' '); 
        return `<div class="cinematic-block min-h-[45vh] md:min-h-[50vh] my-[4vh] md:my-[6vh] flex flex-col items-center justify-center w-full px-4 md:px-8 text-center">${trimmed}</div>`;
      }
      
      // Si es un párrafo regular, convertimos los hard-wraps en espacios
      trimmed = trimmed.replace(/\n/g, ' ');

      if (isHeroCinematicStyle) {
        // En modo Hero Cinemático:
        // Si el párrafo no inicia con una etiqueta HTML de resalte, estilizamos suavemente las dos primeras palabras con serif ámbar
        if (!trimmed.startsWith('<span') && !trimmed.startsWith('<strong')) {
          const words = trimmed.split(' ');
          if (words.length > 3) {
            const firstTwo = words.slice(0, 2).join(' ');
            const rest = words.slice(2).join(' ');
            trimmed = `<span class="hero-word-glow italic text-amber-200/95 font-serif drop-shadow-[0_0_12px_rgba(245,158,11,0.5)]">${firstTwo}</span> ${rest}`;
          }
        }

        // Visor Hero Cinemático con presencia equilibrada, tipografía cinematográfica y balance
        return `
          <div class="cinematic-block min-h-[75vh] md:min-h-[82vh] my-[5vh] md:my-[8vh] flex flex-col items-center justify-center w-full px-6 md:px-12 text-center">
            <p class="hero-cinematic-body-text font-serif text-2xl sm:text-3xl md:text-4xl lg:text-[2.65rem] text-[#E3DDD3]/95 leading-snug md:leading-[1.38] tracking-tight drop-shadow-2xl text-balance max-w-[46ch] mx-auto text-center">
              ${trimmed}
            </p>
          </div>
        `;
      }

      // Envolvemos el texto en un visor estándar (para posts generales)
      return `
        <div class="cinematic-block min-h-[65vh] md:min-h-[70vh] my-[6vh] md:my-[8vh] flex flex-col items-center justify-center w-full px-4 md:px-8 text-center">
          <p class="font-serif text-[1.3125rem] sm:text-[1.45rem] md:text-[1.5625rem] leading-relaxed md:leading-relaxed max-w-[88ch] w-full text-center text-white/90 drop-shadow-md tracking-wide">
            ${trimmed}
          </p>
        </div>
      `;
    })
    .filter(Boolean)
    .join('\n');

  return wrapped;
}
