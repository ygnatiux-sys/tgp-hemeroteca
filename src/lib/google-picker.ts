// ─────────────────────────────────────────────────────────────────────────────
// Google Picker API + Google Identity Services (GIS)
// Carga dinámica, autenticación OAuth 2.0 y extracción binaria de imágenes
// ─────────────────────────────────────────────────────────────────────────────

export interface GooglePickerOptions {
  apiKey: string;
  clientId: string;
  onSelect: (file: File) => void;
  onError?: (err: Error) => void;
}

let isGapiLoaded = false;
let isGisLoaded = false;
let tokenClient: any = null;
let currentAccessToken: string | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') return resolve();
    if (document.querySelector(`script[src="${src}"]`)) {
      return resolve();
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`No se pudo cargar el script: ${src}`));
    document.head.appendChild(script);
  });
}

export async function openGooglePicker(options: GooglePickerOptions): Promise<void> {
  if (typeof window === 'undefined') return;

  const { apiKey, clientId, onSelect, onError } = options;

  if (!apiKey || !clientId) {
    const err = new Error('Faltan credenciales de Google Picker (PUBLIC_GOOGLE_PICKER_API_KEY o PUBLIC_GOOGLE_CLIENT_ID).');
    onError ? onError(err) : console.error(err);
    return;
  }

  try {
    // 1. Carga concurrente de GAPI y Google Identity Services (GIS)
    await Promise.all([
      loadScript('https://apis.google.com/js/api.js'),
      loadScript('https://accounts.google.com/gsi/client'),
    ]);

    // 2. Cargar módulo 'picker' en gapi
    if (!isGapiLoaded) {
      await new Promise<void>((resolve, reject) => {
        const gapi = (window as any).gapi;
        if (!gapi) return reject(new Error('Objeto gapi no disponible.'));
        gapi.load('picker', {
          callback: () => {
            isGapiLoaded = true;
            resolve();
          },
          onerror: () => reject(new Error('Fallo al inicializar el módulo gapi.picker.')),
        });
      });
    }

    const google = (window as any).google;
    if (!google?.accounts?.oauth2) {
      throw new Error('Google Identity Services no inicializado.');
    }

    // 3. Función constructora del Picker con el Access Token
    const createPickerInstance = (token: string) => {
      const g = (window as any).google;
      if (!g?.picker) throw new Error('g.picker no cargado.');

      // Vista Google Drive: Filtro exclusivo de imágenes con navegación en carpetas
      const docsView = new g.picker.DocsView(g.picker.ViewId.DOCS_IMAGES)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false);

      const uploadView = new g.picker.DocsUploadView();

      const appId = clientId.split('-')[0];
      const origin = window.location.protocol + '//' + window.location.host;

      // Inyectar estilos para anclar y asegurar visibilidad del diálogo de Picker
      if (typeof document !== 'undefined' && !document.getElementById('google-picker-anchor-style')) {
        const style = document.createElement('style');
        style.id = 'google-picker-anchor-style';
        style.textContent = `
          .picker-dialog-bg {
            z-index: 99998 !important;
            position: fixed !important;
          }
          .picker-dialog {
            z-index: 99999 !important;
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            max-width: 96vw !important;
            max-height: 94vh !important;
          }
        `;
        document.head.appendChild(style);
      }

      const pickerWidth = Math.min(window.innerWidth - 40, 1050);
      const pickerHeight = Math.min(window.innerHeight - 80, 640);

      const builder = new g.picker.PickerBuilder()
        .setTitle('TGP Scriptorium · Google Fotos')
        .setAppId(appId)
        .setOAuthToken(token)
        .setDeveloperKey(apiKey)
        .setOrigin(origin);

      // Vista Principal Predeterminada: Google Fotos
      try {
        if (g.picker.View && g.picker.ViewId?.PHOTOS) {
          builder.addView(new g.picker.View(g.picker.ViewId.PHOTOS));
        }
      } catch {}

      // Vistas complementarias
      builder.addView(docsView);
      builder.addView(uploadView);

      builder
        .setSize(pickerWidth, pickerHeight)
        .setCallback(async (data: any) => {
          const action = data[g.picker.Response.ACTION];
          if (action === g.picker.Action.CANCEL) {
            onError?.(new Error('PICKER_CLOSED'));
            return;
          }
          if (action === g.picker.Action.PICKED) {
            const doc = data[g.picker.Response.DOCUMENTS][0];
            const fileId = doc[g.picker.Document.ID];
            const fileName = doc[g.picker.Document.NAME] || 'google-image.jpg';
            const mimeType = doc[g.picker.Document.MIME_TYPE] || 'image/jpeg';

            try {
              // Descargar stream binario directo desde Drive API con el Bearer token
              const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: { Authorization: `Bearer ${token}` },
              });

              if (res.ok) {
                const blob = await res.blob();
                const file = new File([blob], fileName, { type: blob.type || mimeType });
                onSelect(file);
                return;
              }

              if (res.status === 401) {
                currentAccessToken = null;
                if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('tgp_g_token');
              }

              // Fallback para Google Fotos o URLs con thumbnail enriquecido
              const thumbUrl = doc[g.picker.Document.THUMBNAILS]?.[0]?.url || doc[g.picker.Document.URL];
              if (thumbUrl) {
                const thumbRes = await fetch(thumbUrl);
                const blob = await thumbRes.blob();
                const file = new File([blob], fileName, { type: blob.type || mimeType });
                onSelect(file);
                return;
              }

              throw new Error(`Error ${res.status} al descargar archivo de Google Drive`);
            } catch (dlErr: any) {
              console.error('[Google Picker] Error al procesar archivo:', dlErr);
              onError?.(dlErr);
            }
          }
        });

      const picker = builder.build();
      picker.setVisible(true);

      // Desactivar estado de carga tras mostrar el modal (evita botón 'Iniciando...' colgado)
      setTimeout(() => {
        onError?.(new Error('PICKER_RENDERED'));
      }, 1000);
    };

    // 4. Solicitar autorización o refrescar token mediante Google Identity Services
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      callback: (response: any) => {
        if (response.error !== undefined) {
          throw new Error(`Error de autenticación Google: ${response.error}`);
        }
        currentAccessToken = response.access_token;
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('tgp_g_token', response.access_token);
        }
        createPickerInstance(currentAccessToken!);
      },
    });

    // Solicitar token fresco mediante ventana emergente si es necesario
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } catch (err: any) {
    console.error('[Google Picker]:', err);
    onError?.(err);
  }
}
