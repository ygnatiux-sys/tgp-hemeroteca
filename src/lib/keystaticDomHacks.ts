/**
 * Keystatic DOM Hacks (Utilidades de Forzado de Interfaz)
 * 
 * Keystatic (al ser un CMS sin estado global exportado basado en Slate/ProseMirror) 
 * no expone APIs internas para que un Custom Field modifique programáticamente a otro.
 * Estas utilidades usan manipulación directa del DOM y eventos sintéticos
 * para inyectar contenido desde los Agentes IA hacia los campos nativos.
 */

/**
 * Helper para forzar la actualización del valor en inputs y textareas de React 18
 */
export function setNativeValue(element: HTMLElement | null, value: string) {
  if (!element || value === undefined || value === null) return;
  const proto = Object.getPrototypeOf(element);
  const descriptor =
    Object.getOwnPropertyDescriptor(proto, 'value') ||
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value') ||
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value') ||
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');

  if (descriptor && descriptor.set) {
    descriptor.set.call(element, value);
  } else {
    (element as any).value = value;
  }

  // Disparar los eventos sintéticos que React 18 escucha
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
}

/**
 * Helper para inyectar programáticamente texto Markdown en el editor ProseMirror (fields.document) de Keystatic
 */
export function injectIntoKeystaticDocumentEditor(markdownText: string): boolean {
  if (typeof document === 'undefined' || !markdownText) return false;

  const editorEl = document.querySelector<HTMLDivElement>(
    '.ProseMirror[contenteditable="true"], [contenteditable="true"].ProseMirror, [contenteditable="true"][role="textbox"], [contenteditable="true"]'
  );

  if (!editorEl) {
    console.warn('[TGP] No se encontró el editor ProseMirror en el DOM.');
    return false;
  }

  try {
    editorEl.focus();

    // Seleccionar todo el contenido actual del editor para sobreescribirlo limpiamente
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editorEl);
    selection?.removeAllRanges();
    selection?.addRange(range);

    // Método Primario: Simulación de Pegado con DataTransfer (ProseMirror nativo)
    const dt = new DataTransfer();
    dt.setData('text/plain', markdownText);
    const htmlFormatted = markdownText
      .split('\n\n')
      .filter(Boolean)
      .map(p => p.startsWith('#') ? `<h2>${p.replace(/^#+\s*/, '')}</h2>` : `<p>${p}</p>`)
      .join('');
    dt.setData('text/html', htmlFormatted);

    const pasteEvt = new ClipboardEvent('paste', {
      clipboardData: dt,
      bubbles: true,
      cancelable: true,
      composed: true
    });
    editorEl.dispatchEvent(pasteEvt);

    // Método Secundario: Intentar execCommand('insertText') si falla el paste
    try { document.execCommand('insertText', false, markdownText); } catch (e) {}
    
    // Método Terciario: InputEvent beforeinput
    try {
      const inputEvt = new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: markdownText,
        bubbles: true,
        cancelable: true,
        composed: true
      });
      editorEl.dispatchEvent(inputEvt);
    } catch (e) {}

    // Respaldo de seguridad en portapapeles
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(markdownText);
      }
    } catch (e) {}

    editorEl.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  } catch (err) {
    console.error('[TGP] Error inyectando en el editor ProseMirror:', err);
    return false;
  }
}

/**
 * Helper: habilita o deshabilita el botón Save nativo de Keystatic en el DOM
 * Previene guardados accidentales antes de que el Agente inyecte los datos generados.
 */
export function lockKeystaticSave(lock: boolean, warningMessage: string = '⚠️ Primero presiona «Traspasar Todo» para inyectar el contenido') {
  if (typeof document === 'undefined') return;
  const saveButtons = document.querySelectorAll<HTMLButtonElement>(
    'button[type="submit"], form button[type="submit"], [data-keystatic-save-button], button'
  );
  saveButtons.forEach(btn => {
    const label = (btn.textContent || '').trim().toLowerCase();
    if (label === 'save' || label === 'guardar' || label === 'create') {
      if (lock) {
        btn.setAttribute('disabled', 'true');
        btn.setAttribute('title', warningMessage);
        btn.style.opacity = '0.35';
        btn.style.cursor = 'not-allowed';
      } else {
        btn.removeAttribute('disabled');
        btn.removeAttribute('title');
        btn.style.opacity = '';
        btn.style.cursor = '';
      }
    }
  });
}

/**
 * Inyecta una imagen (URL remota, DataURI o File) en el campo fields.image (coverImage) de Keystatic.
 * Simula la selección nativa vía DataTransfer sobre el input[type="file"].
 */
export async function injectCoverImageIntoKeystatic(imageSource: string | File, filename: string = 'cover.webp'): Promise<boolean> {
  if (typeof document === 'undefined' || !imageSource) return false;

  try {
    let fileObj: File;

    if (imageSource instanceof File) {
      fileObj = imageSource;
    } else {
      const res = await fetch(imageSource);
      const blob = await res.blob();
      const mime = blob.type || 'image/jpeg';
      const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
      const cleanName = filename.includes('.') ? filename : `${filename}.${ext}`;
      fileObj = new File([blob], cleanName, { type: mime });
    }

    // Buscar el input de archivo correspondiente a la portada en Keystatic
    const fileInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]'));
    // Prioridad: el que tenga name o id con "cover" o "image", sino el primer input file
    const targetInput = fileInputs.find(el => {
      const n = (el.name || el.id || '').toLowerCase();
      return n.includes('cover') || n.includes('portada');
    }) || fileInputs[0];

    if (!targetInput) {
      console.warn('[TGP] No se encontró input de tipo archivo para la portada en Keystatic.');
      return false;
    }

    const dt = new DataTransfer();
    dt.items.add(fileObj);
    targetInput.files = dt.files;
    targetInput.dispatchEvent(new Event('change', { bubbles: true }));
    targetInput.dispatchEvent(new Event('input', { bubbles: true }));

    return true;
  } catch (err) {
    console.error('[TGP] Error inyectando coverImage en Keystatic:', err);
    return false;
  }
}
