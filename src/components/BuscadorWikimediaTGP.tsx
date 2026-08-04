import React, { useState, useEffect } from 'react';
import { searchWikimediaCommons, clearWikimediaCache, type WikimediaImageItem } from '../lib/wikimedia/client';
import { exportMetadataPdfDossier, downloadBatchImages } from '../lib/wikimedia/exporter';

export function BuscadorWikimediaTGP({ value, onChange }: any) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<WikimediaImageItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeModalItem, setActiveModalItem] = useState<WikimediaImageItem | null>(null);

  // Extraer el slug actual de la URL de Keystatic
  const getSlugFromUrl = (): string | null => {
    if (typeof window === 'undefined') return null;
    const parts = window.location.pathname.split('/');
    const itemIndex = parts.indexOf('item');
    if (itemIndex !== -1 && parts[itemIndex + 1] && parts[itemIndex + 1] !== 'new') {
      return parts[itemIndex + 1];
    }
    return null;
  };

  // Inicializar selección guardada en Keystatic si existe
  useEffect(() => {
    if (value) {
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
          setItems(raw.selectedItems);
          setSelectedIds(new Set(raw.selectedItems.map((i: any) => i.id)));
          if (raw.query) setQuery(raw.query);
        }
      } catch (e) {
        console.warn('[BuscadorWikimediaTGP] Error parseando value:', e);
      }
    }
  }, [value]);

  // Guardar en Keystatic cuando cambien los ítems seleccionados
  const updateKeystaticValue = (newSelectedIds: Set<string>, currentItems: WikimediaImageItem[]) => {
    const selectedList = currentItems.filter(item => newSelectedIds.has(item.id));
    const payload = JSON.stringify({
      query,
      count: selectedList.length,
      selectedItems: selectedList
    }, null, 2);
    onChange(payload);
  };

  // Establecer foto de Wikimedia como portada principal (ensayo o georreferencia)
  const handleEstablecerComoPortada = async (item: WikimediaImageItem) => {
    const slugFromUrl = getSlugFromUrl();
    const imageUrlToUse = item.url || item.thumbUrl;

    if (!imageUrlToUse) return alert('No se encontró una URL de imagen válida.');

    const isGeoref = typeof window !== 'undefined' && window.location.pathname.includes('georreferencias');
    const endpoint = isGeoref ? '/api/guardar-georreferencia' : '/api/guardar-ensayo';

    // Disparar evento global para que GeneradorGeorreferenciaTGP y GeneradorTextoTGP reciban la portada de inmediato
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tgp:cover-selected', {
        detail: { imageUrl: imageUrlToUse, title: item.title }
      }));
      try {
        localStorage.setItem('tgp_last_selected_cover', imageUrlToUse);
      } catch (e) {}
    }

    // Auto-detectar slug o título si no está en la URL (creación de nuevo post)
    let slugToSave = slugFromUrl;
    if (!slugToSave && typeof document !== 'undefined') {
      const titleInput = document.querySelector<HTMLInputElement>('input[name="title"], input[id^="title"]');
      if (titleInput && titleInput.value.trim()) {
        slugToSave = titleInput.value.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');
      }
    }

    try {
      if (slugToSave) {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: slugToSave,
            imageUrl: imageUrlToUse,
            publicarConImagen: true
          })
        });
        const data = await res.json();
        if (data.success) {
          alert(`Portada "${item.title}" vinculada y guardada en disco para ${slugToSave}!`);
          return;
        }
      }
      alert(`Foto "${item.title}" seleccionada como Portada.\n\nSe ha sincronizado con el generador. Guarda los cambios con el botón Save.`);
    } catch (e) {
      console.error('Error aplicando portada de Wikimedia:', e);
      alert('Foto seleccionada como Portada. Recuerda presionar "Save" en Keystatic.');
    }
  };

  // Ejecutar Búsqueda en Wikimedia Commons
  const handleBuscar = async () => {
    if (!query.trim()) return alert('Por favor, ingresa un término de búsqueda.');
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const result = await searchWikimediaCommons(query, 20);
      setItems(result.items);
      
      // Por defecto, auto-seleccionar hasta 10 imágenes filtradas
      const defaultSelected = new Set(result.items.slice(0, 10).map(i => i.id));
      setSelectedIds(defaultSelected);
      updateKeystaticValue(defaultSelected, result.items);

      if (result.items.length === 0) {
        setErrorMsg('No se encontraron imágenes que cumplan con los filtros de alta resolución y licencias libres.');
      }
    } catch (err: any) {
      setErrorMsg(`Error al consultar Wikimedia: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Seleccionar Todas las imágenes (marca todas las casillas sin perder la lista)
  const handleSelectAll = () => {
    const allSet = new Set(items.map(i => i.id));
    setSelectedIds(allSet);
    updateKeystaticValue(allSet, items);
  };

  // Deseleccionar Todas las imágenes (desmarca todas las casillas para seleccionar una a una)
  const handleDeselectAll = () => {
    const emptySet = new Set<string>();
    setSelectedIds(emptySet);
    updateKeystaticValue(emptySet, items);
  };

  // Alias de compatibilidad total
  const handleToggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      handleDeselectAll();
    } else {
      handleSelectAll();
    }
  };

  // Limpiar Búsqueda por completo
  const handleClearSearch = () => {
    const emptySet = new Set<string>();
    setSelectedIds(emptySet);
    setItems([]);
    setQuery('');
    updateKeystaticValue(emptySet, []);
  };

  // Limpiar Caché Local
  const handleClearCache = () => {
    clearWikimediaCache();
    alert('Caché local de Wikimedia limpiada con éxito.');
  };

  // Seleccionar / Deseleccionar una imagen individual
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

  // Exportar Dossier PDF + Metadatos
  const handleExportPdf = () => {
    const selectedList = items.filter(i => selectedIds.has(i.id));
    if (selectedList.length === 0) return alert('Por favor, selecciona al menos 1 imagen.');
    exportMetadataPdfDossier(query || 'Ensayo TGP', selectedList);
  };

  // Descargar Archivos de Imagen en Lote
  const handleDownloadBatch = () => {
    const selectedList = items.filter(i => selectedIds.has(i.id));
    if (selectedList.length === 0) return alert('Por favor, selecciona al menos 1 imagen.');
    downloadBatchImages(selectedList);
  };

  const selectedCount = selectedIds.size;

  return (
    <div style={{
      padding: '24px',
      background: '#0d0d11',
      color: '#e0e0e0',
      borderRadius: '12px',
      border: '1px solid #2a2a3c',
      fontFamily: 'Inter, system-ui, sans-serif',
      marginTop: '15px'
    }}>
      {/* Título y Descripción */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#64b5f6', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Buscador & Galería Wikimedia Commons TGP
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#888' }}>
            Filtro Estricto Anti-Basura ($\ge 1000px$, CC0/CC-BY) · Clasificación de Roles (Hero, Secundaria, B-Roll)
          </p>
        </div>

        <button
          type="button"
          onClick={handleClearCache}
          title="Limpiar la memoria caché de Wikimedia"
          style={{
            padding: '6px 12px',
            background: '#1a1a24',
            color: '#aaa',
            border: '1px solid #444',
            borderRadius: '4px',
            fontSize: '0.75rem',
            cursor: 'pointer'
          }}
        >
          Limpiar Caché
        </button>
      </div>

      {/* Barra de Búsqueda */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
          placeholder="Buscar tema o concepto (ej. Tikal, Maya Architecture, Borges, Parthenon)"
          style={{
            flex: 1,
            padding: '14px',
            background: '#161620',
            border: '1px solid #3d3d5c',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '0.95rem',
            outline: 'none'
          }}
        />

        <button
          type="button"
          onClick={handleBuscar}
          disabled={isLoading || !query.trim()}
          style={{
            padding: '14px 24px',
            background: (isLoading || !query.trim()) ? '#222' : 'linear-gradient(135deg, #1976d2, #1565c0)',
            color: (isLoading || !query.trim()) ? '#666' : '#fff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: (isLoading || !query.trim()) ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)'
          }}
        >
          {isLoading ? 'BUSCANDO...' : 'BUSCAR IMÁGENES'}
        </button>
      </div>

      {errorMsg && (
        <div style={{ color: '#ff7043', padding: '12px', background: 'rgba(255,112,67,0.1)', borderRadius: '6px', border: '1px solid #ff7043', marginBottom: '18px', fontSize: '0.85rem' }}>
          <strong>Aviso:</strong> {errorMsg}
        </div>
      )}

      {/* Botonera de Controles Masivos */}
      {items.length > 0 && (
        <div style={{
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          padding: '14px 18px',
          background: '#14141e',
          border: '1px solid #2a2a3e',
          borderRadius: '8px',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleSelectAll}
              title="Marcar todas las imágenes de la búsqueda actual"
              style={{
                padding: '8px 14px',
                background: selectedIds.size === items.length ? '#2e7d32' : '#22303c',
                color: '#fff',
                border: '1px solid #388e3c',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Seleccionar Todas ({items.length})
            </button>

            <button
              type="button"
              onClick={handleDeselectAll}
              title="Desmarcar todas las casillas para poder elegir una por una (mantiene las fotos visibles)"
              style={{
                padding: '8px 14px',
                background: selectedIds.size === 0 ? '#1b2838' : '#37474f',
                color: '#eceff1',
                border: '1px solid #607d8b',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Desmarcar Todo
            </button>

            <button
              type="button"
              onClick={handleClearSearch}
              title="Borrar resultados y limpiar búsqueda"
              style={{
                padding: '8px 12px',
                background: '#421b1b',
                color: '#ffcdd2',
                border: '1px solid #b71c1c',
                borderRadius: '4px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Limpiar Búsqueda
            </button>

            <span style={{ fontSize: '0.85rem', color: '#90caf9', fontWeight: 600, marginLeft: '6px' }}>
              {selectedCount} de {items.length} seleccionadas
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={selectedCount === 0}
              style={{
                padding: '8px 16px',
                background: selectedCount === 0 ? '#222' : 'linear-gradient(135deg, #e65100, #f57c00)',
                color: selectedCount === 0 ? '#666' : '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: selectedCount === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              Exportar PDF Metadatos
            </button>

            <button
              type="button"
              onClick={handleDownloadBatch}
              disabled={selectedCount === 0}
              style={{
                padding: '8px 16px',
                background: selectedCount === 0 ? '#222' : '#2e7d32',
                color: selectedCount === 0 ? '#666' : '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: selectedCount === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              Descargar Selección (Lote)
            </button>
          </div>
        </div>
      )}

      {/* GRILLA GENEROSA TIPO FANCYBOX (Tarjetas Amplias) */}
      {items.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '18px',
          maxHeight: '650px',
          overflowY: 'auto',
          paddingRight: '6px'
        }}>
          {items.map((item) => {
            const isSelected = selectedIds.has(item.id);

            // Badge Color según Rol Visual
            let roleBg = '#388e3c';
            if (item.role === 'HERO') roleBg = '#f57c00';
            if (item.role === 'SECUNDARIA') roleBg = '#1976d2';

            return (
              <div
                key={item.id}
                style={{
                  background: isSelected ? '#182418' : '#14141c',
                  border: isSelected ? '2px solid #4caf50' : '1px solid #2d2d3f',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                  cursor: 'pointer'
                }}
                onClick={() => handleToggleItem(item.id)}
              >
                {/* Checkbox de Selección en Esquina */}
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  zIndex: 2,
                  background: 'rgba(0,0,0,0.8)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid #555'
                }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleItem(item.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#4caf50' }}
                  />
                </div>

                {/* Badge de Rol Visual */}
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  zIndex: 2,
                  background: roleBg,
                  color: '#fff',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.5)'
                }}>
                  {item.roleLabel}
                </div>

                {/* Previsualización de Imagen Gran Tamaño */}
                <div 
                  style={{ 
                    height: '200px', 
                    background: '#09090d', 
                    overflow: 'hidden', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    cursor: 'zoom-in'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveModalItem(item);
                  }}
                  title="Haz clic para inspeccionar a pantalla completa"
                >
                  <img
                    src={item.thumbUrl}
                    alt={item.title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transition: 'opacity 0.2s ease'
                    }}
                  />
                </div>

                {/* Contenido / Metadatos de la Tarjeta */}
                <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{
                      margin: '0 0 6px 0',
                      fontSize: '0.85rem',
                      color: '#fff',
                      lineHeight: '1.3',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }} title={item.title}>
                      {item.title}
                    </h4>

                    <p style={{ margin: '0 0 10px 0', fontSize: '0.72rem', color: '#aaa', lineHeight: '1.4' }}>
                      {item.description}
                    </p>
                  </div>

                  <div style={{ borderTop: '1px solid #282838', paddingTop: '10px', fontSize: '0.7rem', color: '#888' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span>{item.width}×{item.height}px</span>
                      <span style={{ color: '#81c784', fontWeight: 600 }}>{item.license}</span>
                    </div>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '8px' }}>
                      Autor: {item.author}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEstablecerComoPortada(item);
                      }}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        background: '#1b5e20',
                        color: '#fff',
                        border: '1px solid #4caf50',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      Fijar como Portada Principal (Hero)
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL LUPA 60% SCREEN PARA INSPECCIÓN DE DETALLES Y NAVEGACIÓN */}
      {activeModalItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999,
          background: 'rgba(0, 0, 0, 0.88)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }} onClick={() => setActiveModalItem(null)}>
          <div style={{
            background: '#101016',
            border: '1px solid #3d3d52',
            borderRadius: '16px',
            width: 'clamp(320px, 60vw, 1150px)',
            maxHeight: '86vh',
            overflowY: 'auto',
            padding: '24px',
            color: '#fff',
            position: 'relative',
            boxShadow: '0 25px 70px rgba(0,0,0,0.9)'
          }} onClick={(e) => e.stopPropagation()}>
            {/* Cabecera del Visor Lupa 60% */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #282838', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ background: 'rgba(100, 181, 246, 0.15)', color: '#64b5f6', border: '1px solid rgba(100,181,246,0.3)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 }}>
                  Lupa 60% Screen
                </span>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeModalItem.title}
                </h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleEstablecerComoPortada(activeModalItem)}
                  style={{
                    padding: '6px 12px',
                    background: '#1b5e20',
                    color: '#fff',
                    border: '1px solid #4caf50',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Fijar como Portada
                </button>

                <button
                  type="button"
                  onClick={() => setActiveModalItem(null)}
                  style={{
                    background: '#d32f2f',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Cerrar Lupa (Esc)"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Imagen Principal en Visor 60% */}
            <div style={{
              textAlign: 'center',
              marginBottom: '20px',
              position: 'relative',
              background: '#07070a',
              borderRadius: '10px',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '320px'
            }}>
              <img 
                src={activeModalItem.url || activeModalItem.thumbUrl} 
                alt={activeModalItem.title}
                style={{
                  maxWidth: '100%',
                  maxHeight: '52vh',
                  objectFit: 'contain',
                  borderRadius: '6px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.8)'
                }}
              />

              {/* Botones de Navegación Previa / Siguiente en el Visor */}
              {items.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const curIdx = items.findIndex(i => i.id === activeModalItem.id);
                      const prevIdx = curIdx > 0 ? curIdx - 1 : items.length - 1;
                      setActiveModalItem(items[prevIdx]);
                    }}
                    style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'rgba(0,0,0,0.7)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.3)',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      fontSize: '1.2rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Foto anterior"
                  >
                    ❮
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const curIdx = items.findIndex(i => i.id === activeModalItem.id);
                      const nextIdx = curIdx < items.length - 1 ? curIdx + 1 : 0;
                      setActiveModalItem(items[nextIdx]);
                    }}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'rgba(0,0,0,0.7)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.3)',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      fontSize: '1.2rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Foto siguiente"
                  >
                    ❯
                  </button>
                </>
              )}
            </div>

            {/* Metadatos y Licencias */}
            <div style={{ background: '#0a0a0f', padding: '16px', borderRadius: '8px', fontSize: '0.82rem', lineHeight: '1.6', border: '1px solid #1f1f2e' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                <p style={{ margin: 0 }}><strong>Rol Asignado:</strong> {activeModalItem.roleLabel}</p>
                <p style={{ margin: 0 }}><strong>Resolución:</strong> {activeModalItem.width} × {activeModalItem.height} px</p>
                <p style={{ margin: 0 }}><strong>Autor:</strong> {activeModalItem.author}</p>
                <p style={{ margin: 0 }}><strong>Licencia:</strong> <span style={{ color: '#81c784', fontWeight: 600 }}>{activeModalItem.license}</span></p>
              </div>
              <div style={{ borderTop: '1px solid #1a1a26', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <a href={activeModalItem.url} target="_blank" rel="noreferrer" style={{ color: '#64b5f6', textDecoration: 'none', fontWeight: 600 }}>
                  ↗ Abrir Archivo Original
                </a>
                <a href={activeModalItem.pageUrl} target="_blank" rel="noreferrer" style={{ color: '#aaa', textDecoration: 'none' }}>
                  Ficha en Wikimedia Commons ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
