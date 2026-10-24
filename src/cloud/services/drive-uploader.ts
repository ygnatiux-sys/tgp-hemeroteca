/**
 * src/cloud/services/drive-uploader.ts
 * ============================================================================
 * CONECTOR GOOGLE DRIVE (API v3) — Bóveda de Almacenamiento Documental
 * ============================================================================
 * Sube buffers binarios (PDF/EPUB) a Google Drive utilizando Service Accounts.
 * Soporta credenciales desde GOOGLE_APPLICATION_CREDENTIALS_JSON o archivo GOOGLE_APPLICATION_CREDENTIALS.
 */

import { google } from 'googleapis';
import { Readable } from 'node:stream';

export interface DriveUploadOptions {
  buffer: Buffer;
  filename: string;
  mimeType?: string;
  folderId?: string;
  description?: string;
}

export interface DriveUploadResult {
  success: boolean;
  fileId?: string;
  name?: string;
  webViewLink?: string;
  skipped?: boolean;
  reason?: string;
  error?: string;
}

/**
 * Obtiene el cliente autenticado de Google Drive v3
 */
function getDriveClient() {
  const jsonCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  const filePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (jsonCreds) {
    try {
      const credentials = typeof jsonCreds === 'string' ? JSON.parse(jsonCreds) : jsonCreds;
      const auth = google.auth.fromJSON(credentials);
      (auth as any).scopes = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'];
      return google.drive({ version: 'v3', auth: auth as any });
    } catch (err: any) {
      throw new Error(`Error parseando GOOGLE_APPLICATION_CREDENTIALS_JSON: ${err.message}`);
    }
  }

  if (filePath) {
    const auth = new google.auth.GoogleAuth({
      keyFile: filePath,
      scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'],
    });
    return google.drive({ version: 'v3', auth });
  }

  return null;
}

/**
 * Sube un buffer a Google Drive
 */
export async function uploadToGoogleDrive(options: DriveUploadOptions): Promise<DriveUploadResult> {
  const drive = getDriveClient();

  if (!drive) {
    console.warn('[Drive Uploader] Omitido: GOOGLE_APPLICATION_CREDENTIALS_JSON o GOOGLE_APPLICATION_CREDENTIALS no configurado.');
    return {
      success: false,
      skipped: true,
      reason: 'Variables de credenciales de Google Drive no configuradas en el entorno.',
    };
  }

  const folderId = options.folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;
  const parents = folderId ? [folderId] : undefined;

  const fileMetadata: any = {
    name: options.filename,
    description: options.description || 'Dossier Patrimonial generado por TGP SOMA / ARGON Engine',
  };

  if (parents) {
    fileMetadata.parents = parents;
  }

  const media = {
    mimeType: options.mimeType || 'application/pdf',
    body: Readable.from(options.buffer),
  };

  try {
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id, name, webViewLink, webContentLink',
    });

    console.log(`[Drive Uploader] ✓ Archivo subido con éxito a Google Drive (ID: ${response.data.id})`);

    return {
      success: true,
      fileId: response.data.id || undefined,
      name: response.data.name || options.filename,
      webViewLink: response.data.webViewLink || undefined,
    };
  } catch (error: any) {
    console.error('[Drive Uploader] ✗ Error al subir archivo a Google Drive:', error?.message || error);
    return {
      success: false,
      error: error?.message || 'Error desconocido al subir a Google Drive.',
    };
  }
}
