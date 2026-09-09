import React, { useState, useEffect, useRef } from 'react';

export interface GalleryCardProps {
  image: string;
  title: string;
  author: string;
  region: string;
  year: string;
  excerpt: string;
  tags?: string;
  link?: string;
}

export default function GalleryCard({
  image,
  title,
  author,
  region,
  year,
  excerpt,
  tags = "HD | ARCHIVO | ENSAYO VISUAL | ESPAÑOL",
  link = "#"
}: GalleryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera o con ESC
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsExpanded(false);
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExpanded]);

  return (
    <div 
      ref={cardRef}
      className="relative group w-full aspect-16/9 cursor-pointer select-none"
      onClick={() => setIsExpanded(prev => !prev)}
    >
      {/* ── 1. ESTADO REPOSO (Mantiene la cuadrícula fija sin saltos de layout) ── */}
      <div className="w-full h-full overflow-hidden bg-[#18181B] rounded-lg border border-white/10 shadow-lg relative">
        <img 
          src={image} 
          alt={title} 
          className="w-full h-full object-cover opacity-85 transition-transform duration-500 ease-out group-hover:scale-105" 
          loading="lazy"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/95 via-black/40 to-transparent flex flex-col justify-end p-4">
          <span className="text-[9px] font-mono tracking-widest text-[#FBBF24] uppercase mb-0.5 font-bold">
            {region} · {year}
          </span>
          <h3 className="text-white font-serif font-bold text-base sm:text-lg leading-tight line-clamp-1">
            {title}
          </h3>
          <p className="text-[#A1A1AA] text-[10px] tracking-wider uppercase font-mono mt-0.5 truncate">
            {author}
          </p>
        </div>
      </div>

      {/* ── 2. ESTADO EXPANDIDO (Pop-out flotante por Click o Hover sostenido) ── */}
      <div 
        className={`absolute top-0 left-0 w-full min-w-[115%] -ml-[7.5%] bg-[#FAF9F5] rounded-xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] 
                    border border-[#E4E4E7] transition-all duration-300 z-50 origin-top overflow-hidden
                    ${isExpanded 
                      ? 'opacity-100 visible scale-100 pointer-events-auto' 
                      : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible group-hover:delay-200 scale-95 group-hover:scale-100'}`}
        onClick={(e) => e.stopPropagation()} // Evita cerrar si interactúa dentro del panel
      >
        {/* Área Visual */}
        <div className="relative w-full aspect-16/9 bg-black overflow-hidden">
          <img 
            src={image} 
            alt={title} 
            className="w-full h-full object-cover" 
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/95 via-black/30 to-transparent flex flex-col justify-between p-4">
            {/* Botón cerrar */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="w-7 h-7 rounded-full bg-black/70 text-white hover:bg-black flex items-center justify-center text-xs backdrop-blur-md transition-colors cursor-pointer border border-white/20"
                aria-label="Cerrar panel"
              >
                ✕
              </button>
            </div>

            <div>
              <span className="text-[9.5px] font-mono tracking-widest text-[#FBBF24] uppercase font-bold block mb-1">
                {region} · {year}
              </span>
              <h3 className="text-white font-serif font-extrabold text-lg sm:text-xl leading-tight">
                {title}
              </h3>
              <p className="text-[#D4D4D8] text-[11px] font-mono tracking-wider uppercase mt-1">
                {author}
              </p>
            </div>
          </div>
        </div>

        {/* Panel de Información Editorial (Estilo MUBI Invertido) */}
        <div className="p-5 text-[#18181B] bg-[#FAF9F5]">
          {/* Botones de acción */}
          <div className="flex items-center gap-2.5 mb-3.5">
            <a 
              href={link}
              className="inline-flex items-center justify-center bg-[#1D4ED8] hover:bg-[#1E40AF] text-white px-5 py-2 rounded-full text-xs font-bold font-mono tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
            >
              ▶ VER REGISTRO
            </a>
            <button 
              type="button"
              className="w-8 h-8 rounded-full border border-[#D4D4D8] text-[#3F3F46] flex items-center justify-center hover:border-black hover:text-black transition-colors text-sm font-semibold cursor-pointer"
              title="Guardar en biblioteca"
            >
              +
            </button>
          </div>
          
          {/* Excerpt de lectura profunda */}
          <p className="text-xs sm:text-[13px] text-[#27272A] leading-relaxed font-serif text-pretty">
            {excerpt}
          </p>
          
          {/* Metadata técnica / Tags */}
          <div className="mt-4 pt-3 border-t border-[#E4E4E7] text-[10.5px] text-[#71717A] font-mono tracking-wider flex items-center justify-between">
            <span className="font-semibold">{tags}</span>
            <span className="text-[10px] text-[#C2410C] font-bold uppercase">Hemeroteca TGP</span>
          </div>
        </div>
      </div>
    </div>
  );
}
