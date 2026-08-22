/**
 * Transforma el texto crudo de un LLM en HTML estructurado para animaciones GSAP.
 * Resuelve saltos de línea duros y agrupa en bloques cinemáticos con espaciado vertical.
 */
export function parseLLMText(rawText: string): string {
  if (!rawText) return '';

  // 0. Limpiar posibles artefactos de portapapeles (StartFragment / EndFragment)
  let text = rawText.replace(/\\?\s*(?:StartFragment|EndFragment)\s*/gi, '').trim();

  // 1. Escapar HTML peligroso
  let html = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 2. Normalizar retornos de carro (Windows a Unix)
  html = html.replace(/\r\n/g, '\n');

  // 3. Citas textuales en línea ("...") - Primero para no colisionar con class="..."
  html = html.replace(/"([^"\r\n]+)"/g, '<span class="italic font-medium text-[#dfca9d]">"$1"</span>');

  // 4. Palabras clave en negrita (**palabra**)
  html = html.replace(/\*\*(.+?)\*\*/g, '<span class="font-bold text-white drop-shadow-sm">$1</span>');

  // 5. Cursivas simples (*palabra*) - IMPORTANTE: después de negritas
  html = html.replace(/\*([^*\r\n]+)\*/g, '<span class="italic text-white/80">$1</span>');

  // 6. Citas en bloque (Blockquotes: > texto o &gt; texto) con Formato RESPIRO CINEMÁTICO TGP
  html = html.replace(/^(?:&gt;|> )\s*(.*)$/gm, 
    '<div class="respiro-cinematico-card border-l-4 border-[#d97736] bg-white/5 py-6 px-8 md:px-12 rounded-r-2xl shadow-xl max-w-[85ch] w-full mx-auto my-8 text-center backdrop-blur-md">' +
      '<span class="respiro-eyebrow font-metadata text-[10px] md:text-[11px] uppercase tracking-[0.35em] text-[#dfca9d]/90 font-bold block mb-4">RESPIRO CINEMÁTICO · TGP</span>' +
      '<blockquote class="italic text-white/95 font-serif font-light text-center text-xl sm:text-2xl leading-relaxed">$1</blockquote>' +
      '<div class="h-px w-24 bg-linear-to-r from-transparent via-[#dfca9d]/50 to-transparent mx-auto mt-6" aria-hidden="true"></div>' +
    '</div>'
  );

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

      // Envolvemos el texto en un visor con tamaño 2XL (+1px) y renderizado continuo
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


