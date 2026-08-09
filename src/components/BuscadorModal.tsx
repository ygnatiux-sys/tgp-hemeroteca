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
  }, [isOpen]);

  // Atajos globales (Ctrl+K / Cmd+K para abrir buscador, Esc para cerrar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      } else if (e.key === 'Escape') {
        if (isOpen) setIsOpen(false);
        if (isNavExpanded) setIsNavExpanded(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isNavExpanded]);

  // Enfocar input al abrir modal
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Filtrado en tiempo real por título, categoría, excerpt o tipo
  const filtered = query.trim() === ''
    ? items.slice(0, 8)
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
    <>
      {/* BOTONERA DERECHA: LUPA DE BÚSQUEDA + MENÚ SÁNDWICH 3 GUIONES */}
      <div className="flex items-center gap-2 md:gap-2.5">
        {/* BOTÓN LUPA */}
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          title="Buscar contenido, posts, ensayos (Ctrl + K)"
          className="header-action-btn group flex items-center gap-2 px-3 md:px-3.5 h-10 md:h-11 rounded-xl transition-all duration-300 cursor-pointer"
        >
          <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className="font-mono font-light text-xs uppercase tracking-[0.18em] hidden sm:inline">
            Buscar
          </span>
          <kbd className="font-mono text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/10">
            ⌘K
          </kbd>
        </button>

        {/* BOTÓN SÁNDWICH (3 GUIONES ≡) PARA CONDENSAR / EXPANDIR EL NAVTOOL */}
        <button
          type="button"
          onClick={() => setIsNavExpanded(prev => !prev)}
          title={isNavExpanded ? "Cerrar menú" : "Expandir menú de navegación"}
          className={`header-action-btn flex items-center justify-center w-10 h-10 md:w-11 md:h-11 rounded-xl transition-all duration-300 cursor-pointer ${
            isNavExpanded
              ? 'is-expanded bg-rust-orange! text-white!'
              : ''
          }`}
        >
          {/* Ícono de 3 Guiones Sándwich ≡ */}
          <svg className="w-5.5 h-4.5" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="0" y1="2" x2="18" y2="2" />
            <line x1="0" y1="7" x2="18" y2="7" />
            <line x1="0" y1="12" x2="18" y2="12" />
          </svg>
        </button>
      </div>

      {/* MENÚ EXPANDIDO / CONDENSADO (OVERLAY FLOTANTE SÁNDWICH) */}
      {isNavExpanded && (
        <div className="fixed top-18 md:top-20 right-4 md:right-8 w-72 bg-[#F5F4F0] dark:bg-[#0d0d0e] border-2 border-black/20 dark:border-rust-orange/30 rounded-2xl p-4 shadow-2xl backdrop-blur-xl z-999">
          <div className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-rust-orange dark:text-rust-orange mb-3 pb-2 border-b border-black/10 dark:border-white/10">
            Navegación TGP
          </div>
          <nav className="flex flex-col gap-1.5">
            {[
              { label: 'Inicio', href: '/' },
              { label: 'Colecciones', href: '/colecciones' },
              { label: 'Archivo de Ensayos', href: '/archivo' },
              { label: 'About', href: '/about' },
              { label: 'El Códice', href: '/codice' },
            ].map(link => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setIsNavExpanded(false)}
                className="flex items-center px-3.5 py-2.5 rounded-xl font-mono font-light text-xs uppercase tracking-[0.18em] text-black dark:text-stone-200 hover:bg-rust-orange/15 dark:hover:bg-rust-orange/15 hover:text-rust-orange dark:hover:text-rust-orange transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      )}

      {/* MODAL SPOTLIGHT DE BÚSQUEDA INSTANTÁNEA */}
      {isOpen && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            paddingTop: '80px',
            paddingLeft: '16px',
            paddingRight: '16px'
          }}
          onClick={() => setIsOpen(false)}
        >
          <div 
            style={{
              width: '100%',
              maxWidth: '680px',
              background: '#0e0e11',
              border: '1px solid rgba(200, 169, 139, 0.35)',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9)',
              animation: 'popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input Header */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', gap: '12px', background: '#131317' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C8A98B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por título, temática (ej: Arqueosemiótica, Filosofía), excerpt o post..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#fff',
                  fontSize: '16px',
                  fontFamily: 'Newsreader, Georgia, serif'
                }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: '14px' }}
                >
                  ✕
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  padding: '4px 8px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  color: '#a1a1aa',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontFamily: 'monospace'
                }}
              >
                ESC
              </button>
            </div>

            {/* Sub-header de Estado / Filtro */}
            <div style={{ padding: '8px 20px', background: '#09090b', borderBottom: '1px solid rgba(255, 255, 255, 0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', fontFamily: 'Space Mono, monospace', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                {isLoading ? 'Cargando acervo...' : query ? `${filtered.length} Resultados para "${query}"` : 'Sugerencias Recientes & Archivos'}
              </span>
              <span style={{ fontSize: '10px', color: '#C8A98B', opacity: 0.8 }}>
                Explorar Hemeroteca TGP
              </span>
            </div>

            {/* Lista de Resultados */}
            <div style={{ maxHeight: '420px', overflowY: 'auto', padding: '12px' }}>
              {isLoading ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#a1a1aa', fontSize: '13px', fontFamily: 'Space Mono, monospace' }}>
                  Buscando en el archivo...
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <div style={{ color: '#e4e4e7', fontSize: '14px', fontWeight: 600 }}>No se encontraron contenidos para "{query}"</div>
                  <div style={{ color: '#71717a', fontSize: '12px', marginTop: '4px' }}>Prueba buscar por palabras clave como "Sísifo", "Troya", "Arqueología" o "Filosofía"</div>
                </div>
              ) : (
                filtered.map((item) => (
                  <a
                    key={item.id || item.slug}
                    href={`/hemeroteca/${item.slug}`}
                    onClick={() => setIsOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      textDecoration: 'none',
                      color: 'inherit',
                      marginBottom: '6px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid transparent',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(200, 169, 139, 0.12)';
                      e.currentTarget.style.borderColor = 'rgba(200, 169, 139, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                      e.currentTarget.style.borderColor = 'transparent';
                    }}
                  >
                    {item.coverImage ? (
                      <img 
                        src={item.coverImage} 
                        alt={item.title}
                        style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }} 
                      />
                    ) : (
                      <div style={{ width: '48px', height: '48px', background: '#1c1c22', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717a' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                        </svg>
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '9px', fontFamily: 'Space Mono, monospace', background: 'rgba(200, 169, 139, 0.18)', color: '#C8A98B', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                          {item.category}
                        </span>
                        {item.type && (
                          <span style={{ fontSize: '9px', color: '#71717a' }}>• {item.type}</span>
                        )}
                      </div>
                      <h4 style={{ margin: 0, fontSize: '15px', color: '#fff', fontFamily: 'Newsreader, Georgia, serif', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title}
                      </h4>
                      {item.excerpt && (
                        <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#a1a1aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }}>
                          "{item.excerpt}"
                        </p>
                      )}
                    </div>

                    <div style={{ fontSize: '16px', color: '#C8A98B', opacity: 0.6 }}>
                      →
                    </div>
                  </a>
                ))
              )}
            </div>

            {/* Footer explicativo */}
            <div style={{ padding: '10px 20px', background: '#09090b', borderTop: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#52525b' }}>
              <span>Presiona <kbd style={{ background: '#18181b', padding: '2px 5px', borderRadius: '3px', color: '#a1a1aa' }}>ESC</kbd> para cerrar</span>
              <span>The Great Puzzle Project — Hemeroteca</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
