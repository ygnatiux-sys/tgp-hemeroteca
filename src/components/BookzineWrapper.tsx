import React, { useEffect, useState, useCallback } from 'react';
import { MagazineBookzineGallery } from './MagazineBookzineGallery';

const CLOUD_RUN_BASE =
  typeof import.meta !== 'undefined'
    ? (import.meta as any).env?.PUBLIC_TGP_MIND_URL ?? 'http://localhost:3001'
    : 'http://localhost:3001';

type BookzineImage = {
  url: string;
  title: string;
  author: string;
  licenseShortName: string;
};

type ConsolidatedResult = BookzineImage & {
  r2Url: string;
  originalUrl: string;
};

type ConsolidateStatus = 'idle' | 'loading' | 'done' | 'error';

function generateMdx(results: ConsolidatedResult[]): string {
  const items = results
    .map(
      (r) =>
        `  { url: "${r.r2Url}", title: "${r.title.replace(/"/g, "'")}", author: "${r.author.replace(/"/g, "'")}", license: "${r.licenseShortName}" },`
    )
    .join('\n');

  return `---\n# Colección generada automáticamente desde TGP Bookzine\n# ${new Date().toISOString().split('T')[0]} · ${results.length} piezas\n---\n\n{/* Copia este bloque en tu componente de Astro/Keystatic */}\n<MagazineBookzineGallery\n  title="Colección Scriptorium"\n  images={[\n${items}\n  ]}\n/>`;
}

export default function BookzineWrapper() {
  const [images, setImages] = useState<BookzineImage[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [consolidateStatus, setConsolidateStatus] = useState<ConsolidateStatus>('idle');
  const [consolidatedResults, setConsolidatedResults] = useState<ConsolidatedResult[]>([]);
  const [mdxOutput, setMdxOutput] = useState('');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // F5 Seguro: Leemos de sessionStorage pero NO lo eliminamos
    const stored = sessionStorage.getItem('tgp_bookzine_queue');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setImages(parsed);
        }
      } catch (err) {
        console.error('Error parsing bookzine queue from sessionStorage:', err);
      }
    }
    setIsLoaded(true);
  }, []);

  const handleConsolidate = useCallback(async () => {
    if (images.length === 0 || consolidateStatus === 'loading') return;

    setConsolidateStatus('loading');
    setErrorMsg(null);

    try {
      const endpoint = `${CLOUD_RUN_BASE.replace(/\/$/, '')}/api/consolidate-magazine`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `Error del servidor: ${res.status}`);
      }

      const data = await res.json() as { success: boolean; results: ConsolidatedResult[] };
      setConsolidatedResults(data.results);
      setMdxOutput(generateMdx(data.results));
      setConsolidateStatus('done');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al consolidar.');
      setConsolidateStatus('error');
    }
  }, [images, consolidateStatus]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(mdxOutput).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [mdxOutput]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md bg-white p-8 rounded-2xl shadow-sm border border-zinc-200 flex flex-col items-center gap-4">
          <span className="text-4xl">📖</span>
          <h2 className="text-xl font-bold text-zinc-800 font-serif">El archivo visual está vacío</h2>
          <p className="text-sm text-zinc-500 font-mono">
            No hay imágenes en el flujo actual de la revista.
            Vuelve al Scriptorium, realiza una búsqueda masiva en Wikimedia y envía el contenido usando el botón &quot;Ver en Bookzine&quot;.
          </p>
          <button
            onClick={() => window.close()}
            className="mt-4 px-5 py-2 bg-zinc-800 hover:bg-black text-white text-xs font-bold font-mono rounded-xl cursor-pointer transition-colors"
          >
            ← Volver al Scriptorium
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EFEBE3] relative">
      {/* ── Barra de Acciones flotante ── */}
      <div className="fixed top-4 right-4 z-50 flex flex-col items-end gap-2">
        {consolidateStatus !== 'done' && (
          <button
            onClick={handleConsolidate}
            disabled={consolidateStatus === 'loading'}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold font-mono rounded-xl shadow-lg transition-all cursor-pointer"
          >
            {consolidateStatus === 'loading' ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block"></span>
                Consolidando en R2…
              </>
            ) : (
              <>✦ Consolidar Revista (Subir a R2)</>
            )}
          </button>
        )}

        {consolidateStatus === 'error' && errorMsg && (
          <div className="max-w-xs bg-red-50 border border-red-200 text-red-800 text-[11px] font-mono p-2.5 rounded-lg shadow">
            ⚠ {errorMsg}
          </div>
        )}
      </div>

      {/* ── Vista de la Revista ── */}
      <MagazineBookzineGallery
        images={consolidatedResults.length > 0
          ? consolidatedResults.map(r => ({ ...r, url: r.r2Url }))
          : images}
        title={`Colección Scriptorium (${images.length} piezas)`}
      />

      {/* ── Panel MDX de salida ── */}
      {consolidateStatus === 'done' && mdxOutput && (
        <div className="mx-auto max-w-5xl px-4 pb-16 pt-4">
          <div className="bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl border border-zinc-700">
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-800 border-b border-zinc-700">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
                <span className="text-xs font-mono text-zinc-300 font-semibold">
                  ✓ {consolidatedResults.length} imágenes consolidadas en R2 · Listo para Astro/Keystatic
                </span>
              </div>
              <button
                onClick={handleCopy}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold font-mono rounded-lg cursor-pointer transition-colors"
              >
                {copied ? '✓ Copiado!' : '📋 Copiar MDX'}
              </button>
            </div>
            <pre className="p-4 text-[11px] font-mono text-emerald-300 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
              {mdxOutput}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
