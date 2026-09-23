'use client';

import { useState, useRef, useEffect, useCallback, type FC } from 'react';
import { marked } from 'marked';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  model?: string;
  timestamp: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Renderizador rico TGP
// Parsea markdown + etiquetas custom <Analisis>, <Codigo>, <Cita>
// ─────────────────────────────────────────────────────────────────────────────
function renderTgpContent(raw: string): string {
  // 1. Etiquetas TGP a HTML
  let html = raw
    .replace(
      /<Analisis>([\s\S]*?)<\/Analisis>/gi,
      '<div class="tgp-block tgp-analisis"><span class="tgp-block-label">Análisis</span>$1</div>'
    )
    .replace(
      /<Codigo>([\s\S]*?)<\/Codigo>/gi,
      '<div class="tgp-block tgp-codigo"><span class="tgp-block-label">Código</span><pre><code>$1</code></pre></div>'
    )
    .replace(
      /<Cita>([\s\S]*?)<\/Cita>/gi,
      '<blockquote class="tgp-cita">$1</blockquote>'
    );

  // 2. Markdown estándar
  html = marked.parse(html) as string;

  return html;
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
const TgpMindSidebar: FC = () => {
  const [isOpen, setIsOpen]       = useState(false);
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId]               = useState(() => `sidebar-${Date.now()}`);
  const messagesEndRef            = useRef<HTMLDivElement>(null);
  const inputRef                  = useRef<HTMLTextAreaElement>(null);

  const ENDPOINT   = import.meta.env.PUBLIC_TGP_MIND_ENDPOINT ?? 'http://localhost:3001/api/mind';
  const API_KEY    = import.meta.env.PUBLIC_TGP_MIND_API_KEY ?? '';

  // Auto-scroll al nuevo mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus al abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const usePro = text.toLowerCase().startsWith('/pro ') || text.toLowerCase().startsWith('/deep ');

      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          message: text,
          sessionId,
          usePro,
        }),
      });

      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${await res.text()}`);
      }

      const data = await res.json();

      const modelMsg: Message = {
        id: crypto.randomUUID(),
        role: 'model',
        text: data.response ?? '(Sin respuesta)',
        model: data.model,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, modelMsg]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'model',
          text: `⚠️ Error: ${err.message ?? 'No se pudo conectar con TGP Mind.'}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, isLoading, sessionId, ENDPOINT, API_KEY]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearHistory = () => setMessages([]);

  return (
    <>
      {/* ── Estilos inyectados ─────────────────────────────────────────────── */}
      <style>{`
        /* Sidebar container */
        .tgp-mind-sidebar {
          position: fixed;
          top: 0;
          right: 0;
          height: 100dvh;
          width: 440px;
          max-width: 96vw;
          z-index: 9999;
          background: linear-gradient(180deg, #07090a 0%, #0c0e10 100%);
          border-left: 1px solid rgba(224, 122, 95, 0.22);
          box-shadow: -12px 0 60px rgba(0,0,0,0.92);
          display: flex;
          flex-direction: column;
          font-family: 'IBM Plex Mono', 'Space Mono', monospace;
          transform: translateX(100%);
          transition: transform 0.38s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .tgp-mind-sidebar.open {
          transform: translateX(0);
        }

        /* Toggle button */
        .tgp-mind-toggle {
          position: fixed;
          top: 50%;
          right: 0;
          transform: translateY(-50%);
          z-index: 10000;
          background: #1a1e23;
          border: 1.5px solid #e07a5f;
          border-right: none;
          border-radius: 10px 0 0 10px;
          padding: 16px 9px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          box-shadow: -4px 0 20px rgba(224, 122, 95, 0.45), 0 4px 14px rgba(0,0,0,0.6);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .tgp-mind-toggle:hover {
          background: #252b32;
          border-color: #ff9e80;
          box-shadow: -6px 0 28px rgba(224, 122, 95, 0.7);
        }
        .tgp-mind-toggle-label {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: #ffb499;
          writing-mode: vertical-rl;
          transform: rotate(180deg);
        }
        .tgp-mind-toggle-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #e07a5f;
          box-shadow: 0 0 10px #e07a5f;
          opacity: 1;
          animation: tgp-pulse 2s ease-in-out infinite;
        }
        @keyframes tgp-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.35); opacity: 0.6; }
        }

        /* Header */
        .tgp-mind-header {
          padding: 18px 20px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }
        .tgp-mind-title {
          font-family: 'Cinzel', serif;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: #EFEBE3;
        }
        .tgp-mind-subtitle {
          font-size: 9px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(224, 122, 95, 0.7);
          margin-top: 2px;
        }
        .tgp-mind-header-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .tgp-mind-btn-icon {
          background: none;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 6px;
          padding: 5px 8px;
          color: rgba(255,255,255,0.4);
          cursor: pointer;
          font-size: 11px;
          transition: all 0.2s ease;
        }
        .tgp-mind-btn-icon:hover {
          border-color: rgba(224, 122, 95, 0.5);
          color: #e07a5f;
        }

        /* Messages area */
        .tgp-mind-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          scrollbar-width: thin;
          scrollbar-color: rgba(224,122,95,0.2) transparent;
        }
        .tgp-mind-messages::-webkit-scrollbar { width: 4px; }
        .tgp-mind-messages::-webkit-scrollbar-thumb { background: rgba(224,122,95,0.25); border-radius: 4px; }

        /* Mensaje vacío */
        .tgp-mind-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 12px;
          opacity: 0.4;
          text-align: center;
        }
        .tgp-mind-empty-icon {
          font-size: 28px;
          opacity: 0.6;
        }
        .tgp-mind-empty-text {
          font-size: 10px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #EFEBE3;
          line-height: 1.6;
        }

        /* Burbujas de mensaje */
        .tgp-msg {
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-width: 100%;
        }
        .tgp-msg-user .tgp-msg-bubble {
          background: rgba(224, 122, 95, 0.1);
          border: 1px solid rgba(224, 122, 95, 0.2);
          border-radius: 12px 12px 4px 12px;
          align-self: flex-end;
          max-width: 88%;
        }
        .tgp-msg-model .tgp-msg-bubble {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px 12px 12px 4px;
          align-self: flex-start;
          max-width: 100%;
        }
        .tgp-msg-bubble {
          padding: 10px 14px;
          font-size: 13px;
          line-height: 1.65;
          color: #C4C4C4;
        }
        .tgp-msg-user .tgp-msg-bubble {
          color: #EFEBE3;
          font-size: 13px;
        }
        .tgp-msg-meta {
          font-size: 9px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.2);
          padding: 0 4px;
        }
        .tgp-msg-user .tgp-msg-meta { text-align: right; }

        /* Bloques ricos TGP */
        .tgp-block {
          margin: 10px 0;
          border-radius: 8px;
          overflow: hidden;
        }
        .tgp-block-label {
          display: block;
          font-size: 8px;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          font-weight: 700;
          padding: 5px 12px;
        }
        .tgp-analisis {
          border: 1px solid rgba(203, 213, 225, 0.15);
          background: rgba(203, 213, 225, 0.04);
        }
        .tgp-analisis .tgp-block-label {
          color: #94A3B8;
          background: rgba(203, 213, 225, 0.07);
        }
        .tgp-analisis > *:not(.tgp-block-label) {
          padding: 8px 12px;
        }
        .tgp-codigo {
          border: 1px solid rgba(224, 122, 95, 0.2);
          background: rgba(0,0,0,0.4);
        }
        .tgp-codigo .tgp-block-label {
          color: #e07a5f;
          background: rgba(224, 122, 95, 0.08);
        }
        .tgp-codigo pre {
          margin: 0;
          padding: 10px 12px;
          overflow-x: auto;
          font-size: 12px;
          color: #a8b5c4;
        }
        .tgp-cita {
          border-left: 2px solid rgba(224, 122, 95, 0.5);
          margin: 10px 0;
          padding: 8px 14px;
          color: rgba(239, 235, 227, 0.7);
          font-style: italic;
          font-family: 'Newsreader', 'Gloock', serif;
          font-size: 14px;
        }

        /* Markdown estándar en burbujas */
        .tgp-msg-bubble p { margin: 0 0 6px; }
        .tgp-msg-bubble p:last-child { margin: 0; }
        .tgp-msg-bubble strong { color: #EFEBE3; }
        .tgp-msg-bubble em { color: rgba(239,235,227,0.75); }
        .tgp-msg-bubble code {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          background: rgba(0,0,0,0.4);
          padding: 1px 5px;
          border-radius: 4px;
          color: #e07a5f;
        }
        .tgp-msg-bubble ul, .tgp-msg-bubble ol {
          padding-left: 18px;
          margin: 6px 0;
        }
        .tgp-msg-bubble li { margin-bottom: 3px; }
        .tgp-msg-bubble h1,.tgp-msg-bubble h2,.tgp-msg-bubble h3 {
          font-family: 'Cinzel', serif;
          color: #EFEBE3;
          margin: 10px 0 4px;
          font-size: 13px;
          letter-spacing: 0.1em;
        }

        /* Loading spinner */
        .tgp-loading {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 14px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px 12px 12px 4px;
          align-self: flex-start;
        }
        .tgp-loading-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #e07a5f;
          animation: tgp-bounce 1.2s ease-in-out infinite;
        }
        .tgp-loading-dot:nth-child(2) { animation-delay: 0.15s; }
        .tgp-loading-dot:nth-child(3) { animation-delay: 0.3s; }
        @keyframes tgp-bounce {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50% { transform: translateY(-5px); opacity: 1; }
        }

        /* Input area */
        .tgp-mind-input-area {
          padding: 14px 16px 18px;
          border-top: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0;
          background: rgba(0,0,0,0.3);
        }
        .tgp-mind-hint {
          font-size: 9px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.2);
          margin-bottom: 8px;
        }
        .tgp-mind-hint span { color: rgba(224, 122, 95, 0.6); }
        .tgp-mind-input-row {
          display: flex;
          gap: 8px;
          align-items: flex-end;
        }
        .tgp-mind-textarea {
          flex: 1;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 10px 12px;
          color: #EFEBE3;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 13px;
          resize: none;
          min-height: 42px;
          max-height: 120px;
          line-height: 1.5;
          outline: none;
          transition: border-color 0.25s ease;
        }
        .tgp-mind-textarea:focus {
          border-color: rgba(224, 122, 95, 0.45);
        }
        .tgp-mind-textarea::placeholder {
          color: rgba(255,255,255,0.2);
        }
        .tgp-mind-send {
          background: rgba(224, 122, 95, 0.15);
          border: 1px solid rgba(224, 122, 95, 0.35);
          border-radius: 10px;
          padding: 10px 14px;
          color: #e07a5f;
          cursor: pointer;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          transition: all 0.2s ease;
          flex-shrink: 0;
          height: 42px;
          display: flex;
          align-items: center;
        }
        .tgp-mind-send:hover:not(:disabled) {
          background: rgba(224, 122, 95, 0.25);
          border-color: rgba(224, 122, 95, 0.6);
        }
        .tgp-mind-send:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}</style>

      {/* ── Toggle button ─────────────────────────────────────────────────── */}
      <button
        className="tgp-mind-toggle"
        onClick={() => setIsOpen(prev => !prev)}
        title="TGP Mind — Asistente IA"
        aria-label="Abrir TGP Mind"
        style={{ right: isOpen ? '440px' : '0', transition: 'right 0.38s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="tgp-mind-toggle-dot" />
        <span className="tgp-mind-toggle-label">TGP Mind</span>
      </button>

      {/* ── Panel lateral ─────────────────────────────────────────────────── */}
      <aside className={`tgp-mind-sidebar ${isOpen ? 'open' : ''}`} aria-hidden={!isOpen}>
        
        {/* Header */}
        <div className="tgp-mind-header">
          <div>
            <div className="tgp-mind-title">TGP Mind</div>
            <div className="tgp-mind-subtitle">Motor cognitivo — Nodo privado</div>
          </div>
          <div className="tgp-mind-header-actions">
            <button className="tgp-mind-btn-icon" onClick={clearHistory} title="Limpiar historial">
              ⌫
            </button>
            <button className="tgp-mind-btn-icon" onClick={() => setIsOpen(false)} title="Cerrar">
              ✕
            </button>
          </div>
        </div>

        {/* Mensajes */}
        <div className="tgp-mind-messages">
          {messages.length === 0 ? (
            <div className="tgp-mind-empty">
              <div className="tgp-mind-empty-icon">◈</div>
              <div className="tgp-mind-empty-text">
                Escribí cualquier pregunta.<br />
                <span style={{ opacity: 0.7 }}>/pro [mensaje] para Gemini Pro</span>
              </div>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`tgp-msg tgp-msg-${msg.role}`}>
                <div
                  className="tgp-msg-bubble"
                  dangerouslySetInnerHTML={{
                    __html: msg.role === 'model'
                      ? renderTgpContent(msg.text)
                      : msg.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')
                  }}
                />
                <div className="tgp-msg-meta">
                  {msg.role === 'user' ? 'Xavier' : msg.model?.replace('gemini-', '').replace('-latest', '') ?? 'TGP'}
                  {' · '}
                  {msg.timestamp.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))
          )}

          {isLoading && (
            <div className="tgp-loading">
              <div className="tgp-loading-dot" />
              <div className="tgp-loading-dot" />
              <div className="tgp-loading-dot" />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="tgp-mind-input-area">
          <div className="tgp-mind-hint">
            <span>Enter</span> enviar · <span>Shift+Enter</span> nueva línea · <span>/pro</span> Gemini Pro
          </div>
          <div className="tgp-mind-input-row">
            <textarea
              ref={inputRef}
              className="tgp-mind-textarea"
              placeholder="Consultá al motor cognitivo TGP..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isLoading}
            />
            <button
              className="tgp-mind-send"
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              aria-label="Enviar mensaje"
            >
              →
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default TgpMindSidebar;
