/**
 * Utilidades para el manejo de Backups Locales (LocalStorage)
 * de los Agentes TGP en Keystatic.
 * 
 * Se proveen funciones puras para evitar refactorizar el estado (useState)
 * complejo de cada componente de manera intrusiva.
 */

export function getTgpBackup(keyName: string, currentSlug: string): any {
  if (typeof window === 'undefined') return null;
  if (!currentSlug || currentSlug === 'new' || currentSlug.startsWith('nuevo')) return null;

  try {
    const savedBackup = localStorage.getItem(keyName);
    if (savedBackup) {
      const parsed = JSON.parse(savedBackup);
      if (parsed.slug === currentSlug) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn(`[TGP Backup] Error leyendo ${keyName}:`, e);
  }
  return null;
}

export function saveTgpBackup(keyName: string, currentSlug: string, dataToSave: any): void {
  if (typeof window === 'undefined') return;
  try {
    const currentBackup = JSON.parse(localStorage.getItem(keyName) || '{}');
    const updated = {
      ...currentBackup,
      ...dataToSave,
      slug: currentSlug,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(keyName, JSON.stringify(updated));
  } catch (e) {
    console.warn(`[TGP Backup] Error guardando ${keyName}:`, e);
  }
}

export function clearTgpBackup(keyName: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(keyName);
  } catch (e) {
    console.warn(`[TGP Backup] Error borrando ${keyName}:`, e);
  }
}
