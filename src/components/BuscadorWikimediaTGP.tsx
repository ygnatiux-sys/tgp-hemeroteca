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

  // Inicializar selección guardada en Keystatic si existe
  useEffect(() => {
    if (value) {
      try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        if (Array.isArray(parsed?.selectedItems)) {
          setItems(parsed.selectedItems);
          setSelectedIds(new Set(parsed.selectedItems.map((i: any) => i.id)));
          if (parsed.query) setQuery(parsed.query);
        }
      } catch (e) {
        // Ignorar si no es JSON
      }
    }
  }, []);

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

  // Toggle Seleccionar Todo / Deseleccionar Todo
  const handleToggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      const emptySet = new Set<string>();
      setSelectedIds(emptySet);
      updateKeystaticValue(emptySet, items);
    } else {
      const allSet = new Set(items.map(i => i.id));
      setSelectedIds(allSet);
      updateKeystaticValue(allSet, items);
    }
  };

  // Resetear Toda la Selección
  const handleResetAll = () => {
    const emptySet = new Set<string>();
    setSelectedIds(emptySet);
    setItems([]);
    updateKeystaticValue(emptySet, []);
  };

  // Limpiar Caché Local
  const handleClearCache = () => {
    clearWikimediaCache();
    alert('✅ Caché local de Wikimedia limpiada con éxito.');
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
            🏛️ Buscador & Galería Wikimedia Commons TGP
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
          ⚡ Limpiar Caché
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
          {isLoading ? '🔍 BUSCANDO...' : '🔍 BUSCAR IMÁGENES'}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button
              type="button"
              onClick={handleToggleSelectAll}
              style={{
                padding: '8px 14px',
                background: selectedIds.size === items.length ? '#2e7d32' : '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {selectedIds.size === items.length ? '☑️ Deseleccionar Todo' : '☑️ Seleccionar Todo'}
            </button>

            <button
              type="button"
              onClick={handleResetAll}
              style={{
                padding: '8px 14px',
                background: '#c62828',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              🔄 Reset All
            </button>

            <span style={{ fontSize: '0.85rem', color: '#90caf9', fontWeight: 600 }}>
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
              📄 Exportar PDF Metadatos
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
              📦 Descargar Selección (Lote)
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>📐 {item.width}×{item.height}px</span>
                      <span style={{ color: '#81c784', fontWeight: 600 }}>{item.license}</span>
                    </div>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      👤 Autor: {item.author}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL AMPLIADO FANCYBOX PARA INSPECCIÓN DE DETALLES */}
      {activeModalItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '30px'
        }} onClick={() => setActiveModalItem(null)}>
          <div style={{
            background: '#121218',
            border: '1px solid #444',
            borderRadius: '12px',
            maxWidth: '900px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            color: '#fff',
            position: 'relative'
          }} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setActiveModalItem(null)}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: '#c62828',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              ✕
            </button>

            <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem', color: '#90caf9' }}>
              {activeModalItem.title}
            </h3>

            <div style={{ textAlignment: 'center', marginBottom: '20px' }}>
              <img 
                src={activeModalItem.url} 
                alt={activeModalItem.title}
                style={{ maxWidth: '100%', maxHeight: '500px', borderRadius: '8px', border: '1px solid #333' }}
              />
            </div>

            <div style={{ background: '#0a0a0f', padding: '16px', borderRadius: '6px', fontSize: '0.85rem', lineHeight: '1.6' }}>
              <p style={{ margin: '0 0 8px 0' }}><strong>Rol Asignado:</strong> {activeModalItem.roleLabel}</p>
              <p style={{ margin: '0 0 8px 0' }}><strong>Resolución Nativa:</strong> {activeModalItem.width} × {activeModalItem.height} px (Ratio: {activeModalItem.aspectRatio})</p>
              <p style={{ margin: '0 0 8px 0' }}><strong>Autor / Créditos:</strong> {activeModalItem.author}</p>
              <p style={{ margin: '0 0 8px 0' }}><strong>Licencia Legal:</strong> <a href={activeModalItem.licenseUrl} target="_blank" rel="noreferrer" style={{ color: '#64b5f6' }}>{activeModalItem.license}</a></p>
              <p style={{ margin: '0 0 8px 0' }}><strong>Página de Origen:</strong> <a href={activeModalItem.pageUrl} target="_blank" rel="noreferrer" style={{ color: '#64b5f6' }}>Ver en Wikimedia Commons</a></p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
