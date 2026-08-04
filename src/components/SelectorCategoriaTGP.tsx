import React, { useState, useEffect } from 'react';

export interface CategoryGroup {
  group: string;
  options: string[];
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    group: 'Disciplinas Fundamentales',
    options: [
      'Historia',
      'Antropología',
      'Sociología',
      'Arqueología',
      'Historia Antigua',
      'Historia de las Religiones',
      'Etnografía',
      'Filosofía',
      'Historiografía',
      'Historia de la Cultura',
      'Historia de las Ideas',
      'Epistemología',
      'Historia Natural',
      'Geología'
    ]
  },
  {
    group: 'Métodos y Perspectivas TGP',
    options: [
      'Deep History',
      'Arqueosemiótica',
      'Neurognosis',
      'Palimpsesto',
      'Convergencias Simbólicas',
      'Historia Excluida',
      'Teorías Alternativas',
      'Simbolismo Comparado',
      'Análisis del Discurso',
      'Hermenéutica',
      'Exégesis'
    ]
  },
  {
    group: 'Formatos Editoriales & Géneros',
    options: [
      'Ensayos',
      'Dossiers',
      'Cahiers',
      'Biografías',
      'Bitácora'
    ]
  }
];

export const ALL_CANONICAL_CATEGORIES: string[] = CATEGORY_GROUPS.flatMap(g => g.options);

const CATEGORY_MAP: Record<string, string> = {
  'historia': 'Historia',
  'antropologia': 'Antropología',
  'antropología': 'Antropología',
  'sociologia': 'Sociología',
  'sociología': 'Sociología',
  'arqueologia': 'Arqueología',
  'arqueología': 'Arqueología',
  'historia antigua': 'Historia Antigua',
  'historia de las religiones': 'Historia de las Religiones',
  'deep history': 'Deep History',
  'arqueosemiotica': 'Arqueosemiótica',
  'arqueosemiótica': 'Arqueosemiótica',
  'neurognosis': 'Neurognosis',
  'palimpsesto': 'Palimpsesto',
  'convergencias simbolicas': 'Convergencias Simbólicas',
  'convergencias simbólicas': 'Convergencias Simbólicas',
  'etnografia': 'Etnografía',
  'etnografía': 'Etnografía',
  'etnica': 'Etnografía',
  'filosofia': 'Filosofía',
  'filosofía': 'Filosofía',
  'historia excluida': 'Historia Excluida',
  'teorias alternativas': 'Teorías Alternativas',
  'teorías alternativas': 'Teorías Alternativas',
  'historiografia': 'Historiografía',
  'historiografía': 'Historiografía',
  'historia de la cultura': 'Historia de la Cultura',
  'historia de las ideas': 'Historia de las Ideas',
  'epistemologia': 'Epistemología',
  'epistemología': 'Epistemología',
  'historia natural': 'Historia Natural',
  'geologia': 'Geología',
  'geología': 'Geología',
  'simbolismo comparado': 'Simbolismo Comparado',
  'analisis del discurso': 'Análisis del Discurso',
  'análisis del discurso': 'Análisis del Discurso',
  'analisis de discurso': 'Análisis del Discurso',
  'hermeneutica': 'Hermenéutica',
  'hermenéutica': 'Hermenéutica',
  'exegesis': 'Exégesis',
  'exégesis': 'Exégesis',
  'biografias': 'Biografías',
  'biografías': 'Biografías',
  'dossiers': 'Dossiers',
  'dossier': 'Dossiers',
  'cahiers': 'Cahiers',
  'cahiers #7': 'Cahiers',
  'ensayos': 'Ensayos',
  'ensayo': 'Ensayos',
  'bitacora': 'Bitácora',
  'bitácora': 'Bitácora',
  'mitologia': 'Historia de las Religiones',
  'mitología': 'Historia de las Religiones',
  'psicologia': 'Neurognosis',
  'psicología': 'Neurognosis',
  'cine': 'Historia de la Cultura',
  'ficcion literaria': 'Análisis del Discurso',
  'historia medieval': 'Historia',
};

export function normalizeCategory(raw: string | null | undefined): string {
  if (!raw) return 'Historia';
  const clean = raw.trim();
  const lower = clean.toLowerCase();
  
  if (CATEGORY_MAP[lower]) {
    return CATEGORY_MAP[lower];
  }
  
  // Buscar match exacto case-insensitive en las categorías oficiales
  const match = ALL_CANONICAL_CATEGORIES.find(c => c.toLowerCase() === lower);
  if (match) return match;
  
  // Retornar valor limpio existente si es personalizado
  return clean;
}

export function SelectorCategoriaTGP({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const normalized = normalizeCategory(value);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customVal, setCustomVal] = useState(value || '');

  // Detectar si el valor actual no está en la lista estándar
  const isNotInStandardList = normalized && !ALL_CANONICAL_CATEGORIES.includes(normalized);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__CUSTOM__') {
      setIsCustomMode(true);
    } else {
      setIsCustomMode(false);
      onChange(val);
    }
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomVal(e.target.value);
    onChange(e.target.value);
  };

  return (
    <div style={{
      padding: '12px 16px',
      background: '#18181b',
      border: '1px solid #27272a',
      borderRadius: '8px',
      color: '#f4f4f5',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <label style={{ fontSize: '13px', fontWeight: 600, color: '#e4e4e7', display: 'flex', alignItems: 'center', gap: '6px' }}>
          Categoría / Campo Disciplinar TGP
        </label>
        <button
          type="button"
          onClick={() => setIsCustomMode(!isCustomMode)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#a1a1aa',
            fontSize: '11px',
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: '2px 4px'
          }}
        >
          {isCustomMode ? 'Volver a Lista Oficial' : 'Categoría Libre / Manual'}
        </button>
      </div>

      {!isCustomMode ? (
        <select
          value={ALL_CANONICAL_CATEGORIES.includes(normalized) ? normalized : (isNotInStandardList ? normalized : 'Historia')}
          onChange={handleSelectChange}
          style={{
            width: '100%',
            padding: '10px 12px',
            background: '#09090b',
            border: '1px solid #3f3f46',
            borderRadius: '6px',
            color: '#fafafa',
            fontSize: '14px',
            fontWeight: 500,
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          {/* Si el post tiene un valor histórico o custom no presente en el listado, incluirlo primero */}
          {isNotInStandardList && (
            <option value={normalized} style={{ background: '#27272a', color: '#fbbf24' }}>
              ⭐ Actual: {normalized} (Personalizado)
            </option>
          )}

          {CATEGORY_GROUPS.map(group => (
            <optgroup key={group.group} label={group.group} style={{ background: '#18181b', color: '#a1a1aa', fontWeight: 700 }}>
              {group.options.map(opt => (
                <option key={opt} value={opt} style={{ background: '#09090b', color: '#f4f4f5', fontWeight: 400 }}>
                  {opt}
                </option>
              ))}
            </optgroup>
          ))}

          <option value="__CUSTOM__" style={{ background: '#27272a', color: '#38bdf8' }}>
            + [Otra categoría no listada...]
          </option>
        </select>
      ) : (
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Ej: Genealogía del Poder, Numismática..."
            value={customVal}
            onChange={handleCustomChange}
            autoFocus
            style={{
              flex: 1,
              padding: '10px 12px',
              background: '#09090b',
              border: '1px solid #0284c7',
              borderRadius: '6px',
              color: '#fafafa',
              fontSize: '14px',
              outline: 'none'
            }}
          />
        </div>
      )}

      <div style={{ marginTop: '6px', fontSize: '11px', color: '#71717a' }}>
        Selección actual: <strong style={{ color: '#38bdf8' }}>{normalized || 'Sin definir'}</strong>. Sugerido automáticamente por la IA de TGP según el enfoque temático.
      </div>
    </div>
  );
}
