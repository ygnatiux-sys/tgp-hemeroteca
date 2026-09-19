/**
 * get-google-token.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Script one-time para obtener el GOOGLE_REFRESH_TOKEN de Google Photos API.
 * 
 * PREREQUISITOS:
 * 1. En Google Cloud Console: habilitar "Photos Library API"
 * 2. En Credenciales: crear OAuth 2.0 Client ID tipo "Desktop app"
 * 3. Copiar Client ID y Client Secret al .env
 * 
 * USO:
 *   node scripts/get-google-token.js
 *
 * Luego pegar el refresh_token en .env como GOOGLE_REFRESH_TOKEN="..."
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createServer } from 'http';
import { URL } from 'url';
import 'dotenv/config';

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID || process.env.PUBLIC_GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI  = 'http://localhost:3999/callback';
const SCOPES        = 'https://www.googleapis.com/auth/photoslibrary.readonly';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('ERROR: Faltan GOOGLE_CLIENT_ID y/o GOOGLE_CLIENT_SECRET en .env');
  process.exit(1);
}

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
  client_id:     CLIENT_ID,
  redirect_uri:  REDIRECT_URI,
  response_type: 'code',
  scope:         SCOPES,
  access_type:   'offline',
  prompt:        'consent',
}).toString();

console.log('\n🔐 TGP — Google Photos OAuth Token Generator\n');
console.log('Abre esta URL en tu navegador:\n');
console.log(authUrl);
console.log('\nEsperando callback en http://localhost:3999/callback ...\n');

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:3999');
  const code = url.searchParams.get('code');

  if (!code) {
    res.end('Sin code. Intenta de nuevo.');
    return;
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri:  REDIRECT_URI,
        grant_type:    'authorization_code',
      }).toString(),
    });

    const data = await tokenRes.json();

    if (data.refresh_token) {
      console.log('\n✅ ÉXITO! Agrega esto a tu .env:\n');
      console.log(`GOOGLE_REFRESH_TOKEN="${data.refresh_token}"\n`);
      res.end('<h2>✅ Token obtenido! Revisa la terminal.</h2><p>Ya puedes cerrar esta ventana.</p>');
    } else {
      console.error('ERROR: No se obtuvo refresh_token:', data);
      res.end('<h2>❌ Error. Revisa la terminal.</h2>');
    }
  } catch (err) {
    console.error('ERROR al canjear el code:', err);
    res.end('<h2>❌ Error de red. Revisa la terminal.</h2>');
  } finally {
    server.close();
  }
});

server.listen(3999);
