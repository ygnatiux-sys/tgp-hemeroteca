// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Rutas de Google Photos Picker API v1
// ─────────────────────────────────────────────────────────────────────────────
import { Hono } from 'hono';
import {
  createPickerSession,
  pollPickerSession,
  getPickerItems,
  listMyPhotos,
} from '../servicios/google-photos.js';

export const pickerRoutes = new Hono();

pickerRoutes.post('/api/picker/session', async (c) => {
  try {
    return c.json(await createPickerSession());
  } catch (e: any) {
    return c.json({ error: e?.message || 'Error creando sesión' }, 500);
  }
});

pickerRoutes.get('/api/picker/poll/:sessionId', async (c) => {
  try {
    return c.json(await pollPickerSession(c.req.param('sessionId')));
  } catch {
    return c.json({ ready: false });
  }
});

pickerRoutes.get('/api/picker/items/:sessionId', async (c) => {
  try {
    return c.json({ items: await getPickerItems(c.req.param('sessionId')) });
  } catch (e: any) {
    return c.json({ error: e?.message || 'Error obteniendo items' }, 500);
  }
});

pickerRoutes.get('/api/my-photos', async (c) => {
  try {
    return c.json({ photos: await listMyPhotos(24) });
  } catch {
    return c.json({ photos: [] });
  }
});
