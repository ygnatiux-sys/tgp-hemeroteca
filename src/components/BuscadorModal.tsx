import React, { useState, useEffect, useRef } from 'react';

export interface SearchItem {
  id: string;
  slug: string;
  title: string;
  category: string;
  date?: string;
  excerpt?: string;
  coverImage?: string | null;
  type?: string;
}

export function BuscadorModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isNavExpanded, setIsNavExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<SearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cargar índice de búsqueda
  useEffect(() => {
    if (isOpen && items.length === 0) {
      setIsLoading(true);
      fetch('/api/search.json')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setItems(data);
          }
        })
        .catch(err => console.error('Error cargando índice de búsqueda:', err))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, items.length]);

  // Atajos globales
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      } else if (e.key === 'Escape') {
        if (isOpen) {
          setIsOpen(false);
          setQuery('');
        }
        if (isNavExpanded) setIsNavExpanded(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isNavExpanded]);

  // Cerrar menús al hacer scroll
  useEffect(() => {
    const handleScroll = () => {
      if (isNavExpanded) setIsNavExpanded(false);
      // Opcional: ocultar barra de búsqueda si está vacía
      if (isOpen && query.trim() === '') setIsOpen(false);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isNavExpanded, isOpen, query]);

  // Actualizar estado global del documento cuando el menú hamburguesa se expande
  useEffect(() => {
    if (isNavExpanded) {
      document.documentElement.classList.add('nav-is-expanded');
    } else {
      document.documentElement.classList.remove('nav-is-expanded');
    }
  }, [isNavExpanded]);

  // Enfocar input al abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filtered = query.trim() === ''
    ? [] // Si no hay búsqueda, no mostramos resultados flotantes en esta versión "nuda"
    : items.filter(item => {
        const q = query.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          (item.excerpt && item.excerpt.toLowerCase().includes(q)) ||
          item.slug.toLowerCase().includes(q)
        );
      });

  return (
    <div className="relative flex items-center gap-2 md:gap-2.5">
      {/* CONTENEDOR LUPA + INPUT */}
      <div className="toolbar-element flex items-center relative transition-all duration-300">
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) setQuery('');
          }}
          title="Buscar (Ctrl + K)"
          className="header-action-btn flex items-center justify-center w-10 h-10 md:w-11 md:h-11 rounded-xl transition-all duration-300 cursor-pointer z-10 relative"
        >
          <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>

        {/* Línea de búsqueda (se expande unas 3 palabras) */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar ensayo..."
          className={`transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] bg-transparent border-b border-black/20 dark:border-white/20 outline-none text-[13px] font-mono tracking-widest uppercase placeholder:text-black/30 dark:placeholder:text-white/30 text-current ${
            isOpen ? 'w-36 md:w-44 opacity-100 ml-1 px-1' : 'w-0 opacity-0 px-0 border-transparent'
          }`}
          style={{ visibility: isOpen ? 'visible' : 'hidden' }}
        />

        {/* Resultados Nudos (flotantes sin caja fuerte) */}
        {isOpen && query.trim() !== '' && (
          <div className="absolute top-12 md:top-14 right-0 w-80 md:w-112.5 flex flex-col gap-1 z-50">
            {isLoading ? (
              <div className="text-[10px] font-mono tracking-widest uppercase text-current opacity-50 px-2">Buscando...</div>
            ) : filtered.length === 0 ? (
              <div className="text-[10px] font-mono tracking-widest uppercase text-current opacity-50 px-2">No encontrado</div>
            ) : (
              filtered.slice(0, 6).map((item) => (
                <a
                  key={item.id || item.slug}
                  href={`/hemeroteca/${item.slug}`}
                  onClick={() => setIsOpen(false)}
                  className="font-mono font-light text-[11px] uppercase tracking-[0.2em] text-current opacity-70 hover:opacity-100 hover:text-rust-orange dark:hover:text-rust-orange hover:drop-shadow-[0_0_8px_rgba(239,235,227,0.06)] px-2 py-1.5 transition-all duration-300 select-none block"
                >
                  {item.title}
                </a>
              ))
            )}
          </div>
        )}
      </div>

      {/* BOTÓN SÁNDWICH (3 GUIONES ≡) */}
      <div className="relative" onMouseLeave={() => setIsNavExpanded(false)}>
        <button
          type="button"
          onMouseEnter={() => setIsNavExpanded(true)}
          onClick={() => setIsNavExpanded(prev => !prev)}
          title="Menú"
          className={`header-action-btn flex items-center justify-center w-10 h-10 md:w-11 md:h-11 rounded-xl transition-all duration-300 cursor-pointer ${
            isNavExpanded ? 'is-expanded text-[#EFEBE3]! drop-shadow-[0_0_5px_rgba(239,235,227,0.25)]' : ''
          }`}
        >
          <svg className="w-5.5 h-4.5" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="0" y1="2" x2="18" y2="2" />
            <line x1="0" y1="7" x2="18" y2="7" />
            <line x1="0" y1="12" x2="18" y2="12" />
          </svg>
        </button>

        {/* Menú Desplegable Minimalista */}
        <div 
          className={`absolute top-12 md:top-14 right-0 w-56 md:w-64 bg-transparent transition-all duration-300 origin-top-right z-50 flex flex-col gap-1.5 ${
            isNavExpanded ? 'scale-100 opacity-100 visible' : 'scale-95 opacity-0 invisible'
          }`}
        >
          <div className="flex flex-col items-end gap-1.5 pt-2">
            {[
              { label: 'Volver a TGP', href: 'https://thegreatpuzzleproject.com' },
              { label: 'Inicio', href: '/' },
              { label: 'Colecciones', href: '/colecciones' },
              { label: 'Archivo', href: '/archivo' },
              { label: 'About', href: '/about' },
              { label: 'El Códice', href: '/codice' },
            ].map(link => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setIsNavExpanded(false)}
                className="font-mono font-light text-[11px] uppercase tracking-[0.2em] text-current opacity-70 hover:opacity-100 hover:text-rust-orange dark:hover:text-rust-orange hover:drop-shadow-[0_0_8px_rgba(239,235,227,0.06)] transition-all"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
