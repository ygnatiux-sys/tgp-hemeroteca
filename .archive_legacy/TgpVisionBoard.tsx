'use client';

import { useState, useRef, useEffect, useCallback, type FC, type DragEvent } from 'react';
import { marked } from 'marked';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────
interface VisionResult {
  prompt: string;
  response: string;
  imagePreview: string;
  imageSource: 'local' | 'wikimedia';
  imageName: string;
  timestamp: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers Base64
// ─────────────────────────────────────────────────────────────────────────────
function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const [header, base64] = result.split(',');
      const mimeType = header.replace('data:', '').replace(';base64', '');
      resolve({ base64, mimeType });
    };
    reader.onerror = reject;
  });
}

async function urlToBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url);
  const blob = await res.blob();
  const file = new File([blob], 'wikimedia-image', { type: blob.type });
  return fileToBase64(file);
}

// ─────────────────────────────────────────────────────────────────────────────
// TGP Vision Board Portal (el board real, sin trigger)
// ─────────────────────────────────────────────────────────────────────────────
export function TgpVisionBoardPortal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [imageFile, setImageFile]     = useState<File | null>(null);
  const [imageUrl, setImageUrl]       = useState<string | null>(null);
  const [imageSource, setImageSource] = useState<'local' | 'wikimedia'>('local');
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null);
  const [imageName, setImageName]     = useState('');
  const [prompt, setPrompt]           = useState('');
  const [isLoading, setIsLoading]     = useState(false);
  const [isDragging, setIsDragging]   = useState(false);
  const [results, setResults]         = useState<VisionResult[]>([]);
  const [error, setError]             = useState<string | null>(null);
  const [wikiQuery, setWikiQuery]     = useState('');
  const [wikiResults, setWikiResults] = useState<Array<{ title: string; url: string; thumb: string }>>([]);
  const [wikiLoading, setWikiLoading] = useState(false);
  const [wikiOpen, setWikiOpen]       = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptRef    = useRef<HTMLTextAreaElement>(null);
  const resultsRef   = useRef<HTMLDivElement>(null);

  const API_KEY = (typeof import.meta !== 'undefined' ? (import.meta as any).env?.PUBLIC_TGP_MIND_API_KEY : null) ?? '2771';
  const VISION_ENDPOINT = 'http://localhost:3001/api/vision';

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    if (results.length > 0) {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [results]);

  const loadLocalFile = (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Solo se aceptan imágenes.'); return; }
    setImageFile(file);
    setImageUrl(null);
    setImageSource('local');
    setImageName(file.name);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadLocalFile(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) loadLocalFile(file);
  };

  const searchWikimedia = useCallback(async () => {
    if (!wikiQuery.trim()) return;
    setWikiLoading(true);
    setWikiResults([]);
    try {
      const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(wikiQuery)}&srnamespace=6&srlimit=12&format=json&origin=*`;
      const res = await fetch(url);
      const data = await res.json();
      const pages = data?.query?.search ?? [];
      const withThumbs = await Promise.all(
        pages.slice(0, 12).map(async (p: any) => {
          const title = p.title;
          const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|thumburl&iiurlwidth=280&format=json&origin=*`;
          try {
            const infoRes = await fetch(infoUrl);
            const infoData = await infoRes.json();
            const pg = infoData?.query?.pages ?? {};
            const page: any = Object.values(pg)[0];
            const info = page?.imageinfo?.[0];
            return { title: title.replace('File:', ''), url: info?.url ?? '', thumb: info?.thumburl ?? info?.url ?? '' };
          } catch { return null; }
        })
      );
      setWikiResults(withThumbs.filter(Boolean) as any[]);
    } catch { setError('Error consultando Wikimedia Commons.'); }
    finally { setWikiLoading(false); }
  }, [wikiQuery]);

  const selectWikiImage = (item: { title: string; url: string; thumb: string }) => {
    setImageUrl(item.url);
    setImageFile(null);
    setImageSource('wikimedia');
    setImageName(item.title);
    setPreviewUrl(item.thumb);
    setWikiOpen(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!imageFile && !imageUrl) || !prompt.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      let base64: string;
      let mimeType: string;
      if (imageSource === 'local' && imageFile) {
        ({ base64, mimeType } = await fileToBase64(imageFile));
      } else if (imageSource === 'wikimedia' && imageUrl) {
        ({ base64, mimeType } = await urlToBase64(imageUrl));
      } else {
        throw new Error('Sin imagen disponible.');
      }
      const res = await fetch(VISION_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ prompt, base64, mimeType }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
      const data = await res.json();
      setResults(prev => [{
        prompt,
        response: data.response ?? '(Sin respuesta)',
        imagePreview: previewUrl ?? '',
        imageSource,
        imageName,
        timestamp: new Date(),
      }, ...prev]);
      setPrompt('');
      promptRef.current?.focus();
    } catch (err: any) {
      setError(err.message ?? 'Error de conexión con TGP Mind.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        .tvb-root {
          --bg: #121413;
          --bg2: #171b19;
          --bg3: #1e2420;
          --border: rgba(180,210,190,0.10);
          --border-hover: rgba(180,210,190,0.25);
          --accent: #7eb89a;
          --accent2: #a8d5b8;
          --text: #dde8e2;
          --text-muted: #7a9186;
          --text-dim: rgba(221,232,226,0.40);
          --font-serif: 'Cinzel', 'Georgia', serif;
          --font-body: 'IBM Plex Serif', 'Newsreader', 'Georgia', serif;
          --font-mono: 'IBM Plex Mono', monospace;
          --radius: 10px;
        }
        .tvb-overlay {
          position: fixed; inset: 0; z-index: 9998;
          background: rgba(0,0,0,0.88);
          backdrop-filter: blur(6px);
          display: flex; align-items: flex-start; justify-content: center;
          padding: 28px 16px; overflow-y: auto;
        }
        .tvb-board {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 16px;
          width: 100%; max-width: 1200px;
          min-height: 80vh;
          display: grid;
          grid-template-rows: auto 1fr;
          box-shadow: 0 32px 120px rgba(0,0,0,0.9);
          overflow: hidden;
        }
        .tvb-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 28px 18px;
          border-bottom: 1px solid var(--border);
          background: var(--bg2);
        }
        .tvb-kicker {
          font-family: var(--font-mono); font-size: 9px;
          letter-spacing: 0.3em; text-transform: uppercase;
          color: var(--accent); margin-bottom: 4px;
        }
        .tvb-title {
          font-family: var(--font-serif); font-size: 20px;
          font-weight: 400; color: var(--text); letter-spacing: 0.08em;
        }
        .tvb-close {
          background: none; border: 1px solid var(--border);
          border-radius: 8px; padding: 8px 14px;
          color: var(--text-muted); cursor: pointer;
          font-family: var(--font-mono); font-size: 11px;
          letter-spacing: 0.1em; text-transform: uppercase;
          transition: all 0.2s;
        }
        .tvb-close:hover { border-color: var(--border-hover); color: var(--text); }
        .tvb-workspace {
          display: grid; grid-template-columns: 1fr 1fr;
          overflow: hidden;
        }
        @media (max-width: 860px) { .tvb-workspace { grid-template-columns: 1fr; } }
        .tvb-left {
          padding: 24px 24px 24px 28px;
          border-right: 1px solid var(--border);
          display: flex; flex-direction: column; gap: 20px;
          overflow-y: auto;
        }
        .tvb-label {
          font-family: var(--font-mono); font-size: 9px;
          letter-spacing: 0.25em; text-transform: uppercase;
          color: var(--accent); margin-bottom: 8px; display: block;
        }
        .tvb-dropzone {
          border: 2px dashed var(--border);
          border-radius: var(--radius);
          background: var(--bg2);
          min-height: 200px;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 10px; cursor: pointer;
          transition: all 0.25s ease;
        }
        .tvb-dropzone.dragging,
        .tvb-dropzone:hover { border-color: var(--accent); background: rgba(126,184,154,0.04); }
        .tvb-dropzone-icon { font-size: 36px; opacity: 0.3; }
        .tvb-dropzone-text {
          font-family: var(--font-mono); font-size: 11px;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: var(--text-muted); text-align: center;
        }
        .tvb-dropzone-sub { font-size: 10px; color: var(--text-dim); text-align: center; }
        .tvb-preview-wrap {
          position: relative; border-radius: var(--radius);
          overflow: hidden; border: 1px solid var(--border);
          background: var(--bg2);
        }
        .tvb-preview-img { width: 100%; max-height: 280px; object-fit: contain; display: block; }
        .tvb-preview-overlay {
          position: absolute; bottom: 0; left: 0; right: 0;
          padding: 10px 14px;
          background: linear-gradient(transparent, rgba(0,0,0,0.85));
          display: flex; align-items: center; justify-content: space-between;
        }
        .tvb-preview-name {
          font-family: var(--font-mono); font-size: 10px;
          color: rgba(255,255,255,0.6); white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis; max-width: 70%;
        }
        .tvb-preview-badge {
          font-family: var(--font-mono); font-size: 9px;
          letter-spacing: 0.15em; text-transform: uppercase;
          background: rgba(126,184,154,0.15); color: var(--accent);
          padding: 3px 8px; border-radius: 20px;
          border: 1px solid rgba(126,184,154,0.2);
        }
        .tvb-preview-clear {
          position: absolute; top: 8px; right: 8px;
          background: rgba(0,0,0,0.7); border: 1px solid rgba(255,255,255,0.15);
          border-radius: 50%; width: 28px; height: 28px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: rgba(255,255,255,0.6); font-size: 12px;
          transition: all 0.2s;
        }
        .tvb-preview-clear:hover { background: rgba(0,0,0,0.9); color: #fff; }
        .tvb-sep {
          display: flex; align-items: center; gap: 10px;
          font-family: var(--font-mono); font-size: 9px;
          letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-dim);
        }
        .tvb-sep::before,.tvb-sep::after { content:''; flex:1; height:1px; background: var(--border); }
        .tvb-wiki-btn {
          width: 100%; padding: 12px 16px;
          background: var(--bg2); border: 1px solid var(--border);
          border-radius: var(--radius); color: var(--text-muted);
          font-family: var(--font-mono); font-size: 11px;
          letter-spacing: 0.12em; text-transform: uppercase;
          cursor: pointer; display: flex; align-items: center; gap: 10px;
          transition: all 0.2s;
        }
        .tvb-wiki-btn:hover { border-color: var(--border-hover); color: var(--text); background: var(--bg3); }
        .tvb-wiki-panel {
          background: var(--bg2); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 16px;
          display: flex; flex-direction: column; gap: 12px;
        }
        .tvb-wiki-search-row { display: flex; gap: 8px; }
        .tvb-wiki-input {
          flex: 1; background: var(--bg3);
          border: 1px solid var(--border); border-radius: 8px;
          padding: 8px 12px; color: var(--text);
          font-family: var(--font-mono); font-size: 12px; outline: none;
          transition: border-color 0.2s;
        }
        .tvb-wiki-input:focus { border-color: var(--accent); }
        .tvb-wiki-input::placeholder { color: var(--text-dim); }
        .tvb-wiki-search-btn {
          padding: 8px 14px;
          background: rgba(126,184,154,0.12);
          border: 1px solid rgba(126,184,154,0.25);
          border-radius: 8px; color: var(--accent);
          font-family: var(--font-mono); font-size: 11px;
          cursor: pointer; transition: all 0.2s; white-space: nowrap;
        }
        .tvb-wiki-search-btn:hover { background: rgba(126,184,154,0.22); }
        .tvb-wiki-search-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .tvb-wiki-grid {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;
          max-height: 240px; overflow-y: auto;
          scrollbar-width: thin; scrollbar-color: var(--border) transparent;
        }
        .tvb-wiki-thumb {
          border-radius: 6px; overflow: hidden; cursor: pointer;
          border: 2px solid transparent; aspect-ratio: 1;
          background: var(--bg3); transition: border-color 0.2s;
        }
        .tvb-wiki-thumb:hover { border-color: var(--accent); }
        .tvb-wiki-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
        .tvb-wiki-empty {
          font-family: var(--font-mono); font-size: 10px;
          color: var(--text-dim); text-align: center; padding: 20px 0;
        }
        .tvb-right { display: flex; flex-direction: column; overflow: hidden; }
        .tvb-right-top {
          padding: 24px 28px 18px 24px;
          border-bottom: 1px solid var(--border); flex-shrink: 0;
        }
        .tvb-prompt-area {
          width: 100%; background: var(--bg2);
          border: 1px solid var(--border); border-radius: var(--radius);
          padding: 14px 16px; color: var(--text);
          font-family: var(--font-body); font-size: 14px;
          line-height: 1.7; resize: vertical; min-height: 120px;
          outline: none; transition: border-color 0.2s;
          scrollbar-width: thin;
        }
        .tvb-prompt-area:focus { border-color: var(--accent); }
        .tvb-prompt-area::placeholder { color: var(--text-dim); font-style: italic; }
        .tvb-action-row {
          display: flex; align-items: center;
          justify-content: space-between; margin-top: 12px; gap: 12px;
        }
        .tvb-status {
          font-family: var(--font-mono); font-size: 10px;
          color: var(--text-muted); letter-spacing: 0.1em;
        }
        .tvb-status.has-image { color: var(--accent); }
        .tvb-submit {
          padding: 11px 24px;
          background: rgba(126,184,154,0.12);
          border: 1px solid rgba(126,184,154,0.3);
          border-radius: var(--radius); color: var(--accent2);
          font-family: var(--font-mono); font-size: 11px; font-weight: 600;
          letter-spacing: 0.15em; text-transform: uppercase;
          cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center; gap: 8px;
        }
        .tvb-submit:hover:not(:disabled) {
          background: rgba(126,184,154,0.22);
          border-color: rgba(126,184,154,0.55);
        }
        .tvb-submit:disabled { opacity: 0.4; cursor: not-allowed; }
        .tvb-error {
          background: rgba(220,80,80,0.08);
          border: 1px solid rgba(220,80,80,0.2);
          border-radius: 8px; padding: 10px 14px;
          font-family: var(--font-mono); font-size: 11px;
          color: #e06060; margin-top: 10px;
        }
        .tvb-results {
          flex: 1; overflow-y: auto;
          padding: 20px 28px 24px 24px;
          display: flex; flex-direction: column; gap: 28px;
          scrollbar-width: thin; scrollbar-color: var(--border) transparent;
        }
        .tvb-results-empty {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          height: 100%; gap: 14px; opacity: 0.35;
        }
        .tvb-results-empty-icon { font-size: 40px; }
        .tvb-results-empty-text {
          font-family: var(--font-mono); font-size: 10px;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: var(--text-muted); text-align: center; line-height: 2;
        }
        .tvb-loading {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          height: 100%; gap: 16px;
        }
        .tvb-loading-dots { display: flex; gap: 8px; }
        .tvb-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: var(--accent);
          animation: tvb-bounce 1.2s ease-in-out infinite;
        }
        .tvb-dot:nth-child(2) { animation-delay: 0.15s; }
        .tvb-dot:nth-child(3) { animation-delay: 0.30s; }
        @keyframes tvb-bounce {
          0%,100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-8px); opacity: 1; }
        }
        .tvb-loading-text {
          font-family: var(--font-mono); font-size: 10px;
          letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-muted);
        }
        .tvb-result-card {
          display: grid; grid-template-columns: 110px 1fr;
          gap: 18px; padding-bottom: 24px;
          border-bottom: 1px solid var(--border);
        }
        .tvb-result-card:last-child { border-bottom: none; padding-bottom: 0; }
        .tvb-result-thumb {
          border-radius: 8px; overflow: hidden;
          border: 1px solid var(--border); background: var(--bg2);
          height: 85px; flex-shrink: 0;
        }
        .tvb-result-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
        .tvb-result-meta {
          display: flex; align-items: center;
          justify-content: space-between; margin-bottom: 8px;
        }
        .tvb-result-time {
          font-family: var(--font-mono); font-size: 9px;
          letter-spacing: 0.15em; text-transform: uppercase; color: var(--text-dim);
        }
        .tvb-result-model {
          font-family: var(--font-mono); font-size: 9px;
          letter-spacing: 0.1em; color: var(--accent);
          background: rgba(126,184,154,0.08); padding: 2px 8px;
          border-radius: 20px; border: 1px solid rgba(126,184,154,0.15);
        }
        .tvb-result-prompt {
          font-family: var(--font-mono); font-size: 11px;
          color: var(--text-muted); margin-bottom: 10px;
          padding: 6px 10px; background: var(--bg2);
          border-radius: 6px; border-left: 2px solid var(--border-hover);
        }
        .tvb-result-response {
          font-family: var(--font-body); font-size: 14.5px;
          line-height: 1.9; color: var(--text);
        }
        .tvb-result-response p { margin: 0 0 10px; }
        .tvb-result-response p:last-child { margin: 0; }
        .tvb-result-response h1,.tvb-result-response h2,.tvb-result-response h3 {
          font-family: var(--font-serif); color: var(--text);
          margin: 14px 0 6px; font-size: 15px;
          font-weight: 400; letter-spacing: 0.05em;
        }
        .tvb-result-response strong { color: var(--accent2); }
        .tvb-result-response em { color: rgba(221,232,226,0.7); font-style: italic; }
        .tvb-result-response blockquote {
          border-left: 2px solid var(--accent); margin: 10px 0;
          padding: 6px 14px; color: rgba(221,232,226,0.7); font-style: italic;
        }
        .tvb-result-response code {
          font-family: var(--font-mono); font-size: 12px;
          background: rgba(0,0,0,0.4); padding: 1px 5px;
          border-radius: 4px; color: var(--accent);
        }
        .tvb-result-response ul,.tvb-result-response ol { padding-left: 20px; margin: 8px 0; }
        .tvb-result-response li { margin-bottom: 4px; }
      `}</style>

      <div
        className="tvb-overlay tvb-root"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        role="dialog" aria-modal="true" aria-label="TGP Vision Board"
      >
        <div className="tvb-board">
          {/* Header */}
          <header className="tvb-header">
            <div>
              <div className="tvb-kicker">TGP Scriptorium · Motor Cognitivo Multimodal</div>
              <div className="tvb-title">Vision / Iconografía</div>
            </div>
            <button className="tvb-close" onClick={onClose}>✕ Cerrar</button>
          </header>

          <div className="tvb-workspace">
            {/* ── IZQUIERDA: Ingesta Visual ──────────────────── */}
            <div className="tvb-left">
              <div>
                <span className="tvb-label">Archivo Local · Drag & Drop</span>
                {!previewUrl ? (
                  <div
                    className={`tvb-dropzone ${isDragging ? 'dragging' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      type="file" accept="image/*"
                      ref={fileInputRef} onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />
                    <div className="tvb-dropzone-icon">⊕</div>
                    <div className="tvb-dropzone-text">Arrastrá una imagen aquí</div>
                    <div className="tvb-dropzone-sub">o hacé clic · JPG, PNG, WEBP, TIFF, GIF</div>
                  </div>
                ) : (
                  <div className="tvb-preview-wrap">
                    <img src={previewUrl} alt={imageName} className="tvb-preview-img" />
                    <div className="tvb-preview-overlay">
                      <span className="tvb-preview-name">{imageName}</span>
                      <span className="tvb-preview-badge">
                        {imageSource === 'wikimedia' ? 'Wikimedia' : 'Local'}
                      </span>
                    </div>
                    <button
                      className="tvb-preview-clear"
                      onClick={() => {
                        setImageFile(null); setImageUrl(null);
                        setPreviewUrl(null); setImageName('');
                      }}
                    >✕</button>
                  </div>
                )}
              </div>

              <div className="tvb-sep">o traer desde Wikimedia Commons</div>

              {!wikiOpen ? (
                <button className="tvb-wiki-btn" onClick={() => setWikiOpen(true)}>
                  <span style={{ fontSize: '16px' }}>🔭</span>
                  Buscar en Wikimedia Commons
                </button>
              ) : (
                <div className="tvb-wiki-panel">
                  <span className="tvb-label">Wikimedia Commons · Búsqueda Directa</span>
                  <div className="tvb-wiki-search-row">
                    <input
                      className="tvb-wiki-input"
                      placeholder="ej: Roman Forum, Byzantine icon..."
                      value={wikiQuery}
                      onChange={e => setWikiQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && searchWikimedia()}
                    />
                    <button
                      className="tvb-wiki-search-btn"
                      onClick={searchWikimedia}
                      disabled={wikiLoading || !wikiQuery.trim()}
                    >
                      {wikiLoading ? '…' : 'Buscar'}
                    </button>
                  </div>

                  {wikiResults.length > 0 ? (
                    <div className="tvb-wiki-grid">
                      {wikiResults.map((item, i) => (
                        <div
                          key={i} className="tvb-wiki-thumb"
                          title={item.title}
                          onClick={() => selectWikiImage(item)}
                        >
                          <img src={item.thumb} alt={item.title} loading="lazy" />
                        </div>
                      ))}
                    </div>
                  ) : !wikiLoading && wikiQuery ? (
                    <div className="tvb-wiki-empty">Sin resultados para "{wikiQuery}"</div>
                  ) : null}

                  <button
                    className="tvb-wiki-btn"
                    style={{ padding: '8px 12px', fontSize: '10px' }}
                    onClick={() => setWikiOpen(false)}
                  >
                    ✕ Cerrar buscador
                  </button>
                </div>
              )}
            </div>

            {/* ── DERECHA: Prompt + Resultados ──────────────── */}
            <div className="tvb-right">
              <div className="tvb-right-top">
                <span className="tvb-label">Instrucción Analítica · Ctrl+Enter para enviar</span>
                <textarea
                  ref={promptRef}
                  className="tvb-prompt-area"
                  placeholder="Describí qué querés analizar: iconografía, composición, simbología, datación, contexto histórico, atribución estilística..."
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSubmit(e as any); }}
                  disabled={isLoading}
                />
                <div className="tvb-action-row">
                  <div className={`tvb-status ${previewUrl ? 'has-image' : ''}`}>
                    {previewUrl
                      ? `✓ Imagen lista · ${imageSource === 'wikimedia' ? 'Wikimedia Commons' : 'Archivo local'}`
                      : '◌ Sin imagen seleccionada'}
                  </div>
                  <button
                    className="tvb-submit"
                    onClick={handleSubmit}
                    disabled={isLoading || (!imageFile && !imageUrl) || !prompt.trim()}
                  >
                    {isLoading ? 'Analizando…' : 'Procesar ↵'}
                  </button>
                </div>
                {error && <div className="tvb-error">⚠ {error}</div>}
              </div>

              <div className="tvb-results" ref={resultsRef}>
                {isLoading ? (
                  <div className="tvb-loading">
                    <div className="tvb-loading-dots">
                      <div className="tvb-dot" />
                      <div className="tvb-dot" />
                      <div className="tvb-dot" />
                    </div>
                    <div className="tvb-loading-text">Procesando con Gemini Vision…</div>
                  </div>
                ) : results.length === 0 ? (
                  <div className="tvb-results-empty">
                    <div className="tvb-results-empty-icon">◈</div>
                    <div className="tvb-results-empty-text">
                      Cargá una imagen y escribí tu instrucción<br />
                      para iniciar el análisis visual.
                    </div>
                  </div>
                ) : (
                  results.map((r, i) => (
                    <div key={i} className="tvb-result-card">
                      <div className="tvb-result-thumb">
                        <img src={r.imagePreview} alt={r.imageName} />
                      </div>
                      <div>
                        <div className="tvb-result-meta">
                          <span className="tvb-result-time">
                            {r.timestamp.toLocaleTimeString('es-AR', {
                              hour: '2-digit', minute: '2-digit', second: '2-digit'
                            })}
                          </span>
                          <span className="tvb-result-model">gemini-vision</span>
                        </div>
                        <div className="tvb-result-prompt">↳ {r.prompt}</div>
                        <div
                          className="tvb-result-response"
                          dangerouslySetInnerHTML={{ __html: marked.parse(r.response) as string }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Wrapper con trigger (uso standalone) ──────────────────────────────────────
export function TgpVisionBoardWithTrigger() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        id="tgp-vision-board-trigger"
        onClick={() => setIsOpen(true)}
        className="w-full text-left p-4 border border-[#263231] hover:border-[#4a5a58] bg-[#161d1c] hover:bg-[#1c2423] transition-all rounded group cursor-pointer block"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-serif text-[#f0f2f1] group-hover:text-white">
            TGP Vision / Iconografía
          </h2>
          <span className="text-[10px] font-mono tracking-wider uppercase text-[#7eb89a] bg-[#7eb89a]/10 border border-[#7eb89a]/25 px-2 py-0.5 rounded">
            Multimodal
          </span>
        </div>
        <p className="text-sm text-[#8a9a98] mt-1">
          Análisis visual profundo, semiótica iconográfica y consulta directa en Wikimedia Commons.
        </p>
      </button>
      <TgpVisionBoardPortal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

export default TgpVisionBoardPortal;
