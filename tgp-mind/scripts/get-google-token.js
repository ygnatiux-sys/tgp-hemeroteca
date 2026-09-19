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

import { exec } from 'child_process';

console.log('\n🔐 TGP — Google Photos OAuth Token Generator\n');
console.log('Abriendo navegador en tu cuenta de Google...');
console.log('Si no se abre solo, haz clic o copia esta URL:\n');
console.log(authUrl);
console.log('\nEsperando respuesta en http://localhost:3999/callback ...\n');

try {
  exec(`start "" "${authUrl.replace(/&/g, '^&')}"`);
} catch (e) {}

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
      console.log('\n✅ ÉXITO! Token obtenido: ' + data.refresh_token.slice(0, 15) + '...\n');
      
      // Auto-guardar en ambos .env
      import('fs').then(fs => {
        ['.env', 'tgp-mind/.env'].forEach(file => {
          try {
            let content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
            if (content.includes('GOOGLE_REFRESH_TOKEN=')) {
              content = content.replace(/GOOGLE_REFRESH_TOKEN=.*/, `GOOGLE_REFRESH_TOKEN="${data.refresh_token}"`);
            } else {
              content += `\nGOOGLE_REFRESH_TOKEN="${data.refresh_token}"\n`;
            }
            fs.writeFileSync(file, content, 'utf8');
            console.log(`Guardado en ${file}`);
          } catch (e) {
            console.error(`No se pudo escribir en ${file}:`, e.message);
          }
        });
      });

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1 style="font-family:sans-serif;color:#10b981;">✅ ¡Listo! Conexión completada</h1><p style="font-family:sans-serif;font-size:16px;">El token se guardó automáticamente en tu .env.<br>Ya puedes cerrar esta pestaña y volver a Antigravity.</p>');
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
