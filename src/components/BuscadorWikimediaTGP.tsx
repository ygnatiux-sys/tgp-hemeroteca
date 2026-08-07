import React, { useState, useEffect, useRef } from 'react';
import { searchWikimediaCommons, clearWikimediaCache, type WikimediaImageItem } from '../lib/wikimedia/client';
import { exportMetadataPdfDossier, downloadBatchImages } from '../lib/wikimedia/exporter';

export function BuscadorWikimediaTGP({ value, onChange }: any) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<WikimediaImageItem[]>([]);
  const [savedItems, setSavedItems] = useState<WikimediaImageItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bookzineFeedback, setBookzineFeedback] = useState<string | null>(null);
  const [activeModalItem, setActiveModalItem] = useState<WikimediaImageItem | null>(null);

  const hasLoadedInitialValue = useRef(false);

  // Carga inicial
  useEffect(() => {
    if (value && !hasLoadedInitialValue.current) {
      try {
        let raw = typeof value === 'object' && value !== null && 'value' in value ? value.value : value;
        if (typeof raw === 'string') {
          if (raw.startsWith('"') && raw.endsWith('"')) {
            try { raw = JSON.parse(raw); } catch (e) {}
          }
          if (typeof raw === 'string' && raw.trim().startsWith('{')) {
            raw = JSON.parse(raw);
          }
        }
        if (raw && typeof raw === 'object' && Array.isArray(raw.selectedItems)) {
          setSavedItems(raw.selectedItems);
          setSelectedIds(new Set(raw.selectedItems.map((i: any) => i.id)));
          if (raw.query) setQuery(raw.query);
        }
        hasLoadedInitialValue.current = true;
      } catch (e) {
        console.warn('[BuscadorWikimediaTGP] Error parseando value:', e);
      }
    }
  }, [value]);

  // Navegación por teclado (Esc y Flechas) para el Visor Inmersivo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeModalItem) return;
      if (e.key === 'Escape') setActiveModalItem(null);
      
      if (items.length > 1) {
        if (e.key === 'ArrowRight') {
          const curIdx = items.findIndex(i => i.id === activeModalItem.id);
          const nextIdx = curIdx < items.length - 1 ? curIdx + 1 : 0;
          setActiveModalItem(items[nextIdx]);
        }
        if (e.key === 'ArrowLeft') {
          const curIdx = items.findIndex(i => i.id === activeModalItem.id);
          const prevIdx = curIdx > 0 ? curIdx - 1 : items.length - 1;
          setActiveModalItem(items[prevIdx]);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModalItem, items]);

  // Guardar en Keystatic conservando el álbum previo
  const updateKeystaticValue = (newSelectedIds: Set<string>, currentSearchItems: WikimediaImageItem[]) => {
    const finalSelectedItems = Array.from(newSelectedIds).map(id => {
      const fromSearch = currentSearchItems.find(i => i.id === id);
      const fromSaved = savedItems.find(i => i.id === id);
      return fromSearch || fromSaved;
    }).filter(Boolean) as WikimediaImageItem[];

    setSavedItems(finalSelectedItems);

    const payload = JSON.stringify({
      query,
      count: finalSelectedItems.length,
      selectedItems: finalSelectedItems
    }, null, 2);
    onChange(payload);
  };

  // Filtro semántico para búsquedas históricas limpias
  const enhanceQueryForTGP = (rawQuery: string): string => {
    let q = rawQuery.toLowerCase();
    q = q.replace(/\bestatua\b/g, 'statue');
    q = q.replace(/\bbusto\b/g, 'bust');
    q = q.replace(/\bmural(es)?\b/g, 'fresco OR mural');
    q = q.replace(/\bcuadro(s)?\b|\bpintura(s)?\b/g, 'painting');
    
    if (q.includes('hermes') || q.includes('mercurio')) {
      q = q.replace(/\bhermes\b|\bmercurio\b/g, '(Hermes OR Mercury)');
      q += ' (mythology OR god OR deity)';
    }

    const noiseFilters = ' -vogue -fashion -calle -street -edificio -building -modern -hotel -company -brand';
    const historyBoost = ' (museum OR antiquity OR archaeological OR sculpture OR classical)';

    return `${q}${historyBoost}${noiseFilters}`;
  };

  const handleBuscar = async () => {
    if (!query.trim()) return alert('Por favor, ingresa un término de búsqueda.');
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const smartQuery = enhanceQueryForTGP(query);
      const result = await searchWikimediaCommons(smartQuery, 30);
      setItems(result.items);
      if (result.items.length === 0) {
        setErrorMsg('No se encontraron imágenes históricas que cumplan con el filtro.');
      }
    } catch (err: any) {
      setErrorMsg(`Error al consultar Wikimedia: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnviarABookzine = (modo: 'all' | 'selected' = 'selected') => {
    if (modo === 'all') {
      const allNewIds = new Set(selectedIds);
      items.forEach(i => allNewIds.add(i.id));
      setSelectedIds(allNewIds);
      updateKeystaticValue(allNewIds, items);
    }
    setBookzineFeedback(`¡Álbum actualizado! Total de ${selectedIds.size} láminas vinculadas al Bookzine. (Presiona "Save" en Keystatic).`);
    setTimeout(() => setBookzineFeedback(null), 8000);
  };

  const handleToggleItem = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
    updateKeystaticValue(next, items);
  };

  const selectedCount = selectedIds.size;

  return (
    <div style={{ padding: '24px', background: '#0d0d11', color: '#e0e0e0', borderRadius: '12px', border: '1px solid #2a2a3c', fontFamily: 'Inter, system-ui, sans-serif', marginTop: '15px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#64b5f6' }}>Buscador Semántico & Galería Wikimedia TGP</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#888' }}>Álbum Acumulativo · Selección Granular</p>
        </div>
        <button type="button" onClick={() => clearWikimediaCache()} style={{ padding: '6px 12px', background: '#1a1a24', color: '#aaa', border: '1px solid #444', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>
          Limpiar Caché
        </button>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
          placeholder="Ej: Mercurio estatua, Busto Hermes, Tikal, Borges..."
          style={{ flex: 1, padding: '14px', background: '#161620', border: '1px solid #3d3d5c', borderRadius: '6px', color: '#fff', fontSize: '0.95rem', outline: 'none' }}
        />
        <button
          type="button"
          onClick={handleBuscar}
          disabled={isLoading || !query.trim()}
          style={{ padding: '14px 24px', background: (isLoading || !query.trim()) ? '#222' : 'linear-gradient(135deg, #1976d2, #1565c0)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
        >
          {isLoading ? 'BUSCANDO...' : 'BUSCAR IMÁGENES'}
        </button>
      </div>

      {errorMsg && (
        <div style={{ color: '#ff7043', padding: '12px', background: 'rgba(255,112,67,0.1)', borderRadius: '6px', border: '1px solid #ff7043', marginBottom: '18px', fontSize: '0.85rem' }}>
          {errorMsg}
        </div>
      )}

      {items.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: '#14141e', border: '1px solid #2a2a3e', borderRadius: '8px', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.85rem', color: '#90caf9', fontWeight: 600 }}>Álbum Guardado: {selectedCount} imágenes</span>
          </div>
          <button
            type="button"
            onClick={() => handleEnviarABookzine('selected')}
            style={{ padding: '8px 18px', background: 'linear-gradient(135deg, #b8860b, #d4af37, #996515)', color: '#000', border: '1px solid #ffd700', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer' }}
          >
            📖 CONFIRMAR ÁLBUM BOOKZINE
          </button>
        </div>
      )}

      {bookzineFeedback && (
        <div style={{ padding: '12px 18px', background: 'rgba(212, 175, 55, 0.15)', border: '1px solid #d4af37', borderRadius: '8px', color: '#f5e6a2', fontSize: '0.85rem', marginBottom: '20px' }}>
          ✨ {bookzineFeedback}
        </div>
      )}

      {/* Grilla de resultados */}
      {items.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '18px', maxHeight: '650px', overflowY: 'auto' }}>
          {items.map((item) => {
            const isSelected = selectedIds.has(item.id);
            return (
              <div key={item.id} onClick={() => handleToggleItem(item.id)} style={{ background: isSelected ? '#182418' : '#14141c', border: isSelected ? '2px solid #4caf50' : '1px solid #2d2d3f', borderRadius: '10px', overflow: 'hidden', position: 'relative', cursor: 'pointer' }}>
                <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 2, background: 'rgba(0,0,0,0.8)', padding: '4px 8px', borderRadius: '4px' }}>
                  <input type="checkbox" checked={isSelected} onChange={() => handleToggleItem(item.id)} onClick={(e) => e.stopPropagation()} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#4caf50' }} />
                </div>
                <div onClick={(e) => { e.stopPropagation(); setActiveModalItem(item); }} style={{ height: '200px', background: '#09090d', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-in' }}>
                  <img src={item.thumbUrl} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ padding: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</h4>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VISOR INMERSIVO TOTALMENTE MINIMALISTA Y PANTALLA COMPLETA */}
      {activeModalItem && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 999999,
            background: 'rgba(0, 0, 0, 0.96)',
            backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }} 
          onClick={() => setActiveModalItem(null)}
        >
          {/* Botón de cierre casi invisible */}
          <button 
            type="button"
            onClick={() => setActiveModalItem(null)}
            style={{
              position: 'absolute', top: '20px', right: '25px',
              background: 'transparent', border: 'none',
              color: 'rgba(255,255,255,0.25)', fontSize: '32px',
              cursor: 'pointer', zIndex: 1000000,
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}
          >
            ✕
          </button>

          {/* Flecha Izquierda */}
          {items.length > 1 && (
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const curIdx = items.findIndex(i => i.id === activeModalItem.id);
                const prevIdx = curIdx > 0 ? curIdx - 1 : items.length - 1;
                setActiveModalItem(items[prevIdx]);
              }}
              style={{
                position: 'absolute', left: '20px',
                background: 'transparent', border: 'none',
                color: 'rgba(255,255,255,0.2)', fontSize: '50px',
                cursor: 'pointer', zIndex: 1000000, padding: '20px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}
            >
              ❮
            </button>
          )}

          {/* Imagen Pantalla Completa Adaptativa */}
          <img 
            src={activeModalItem.url || activeModalItem.thumbUrl} 
            alt={activeModalItem.title} 
            style={{
              maxWidth: '98vw',
              maxHeight: '98vh',
              objectFit: 'contain',
              userSelect: 'none'
            }}
            onClick={(e) => e.stopPropagation()} 
          />

          {/* Flecha Derecha */}
          {items.length > 1 && (
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const curIdx = items.findIndex(i => i.id === activeModalItem.id);
                const nextIdx = curIdx < items.length - 1 ? curIdx + 1 : 0;
                setActiveModalItem(items[nextIdx]);
              }}
              style={{
                position: 'absolute', right: '20px',
                background: 'transparent', border: 'none',
                color: 'rgba(255,255,255,0.2)', fontSize: '50px',
                cursor: 'pointer', zIndex: 1000000, padding: '20px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}
            >
              ❯
            </button>
          )}
        </div>
      )}
    </div>
  );
}