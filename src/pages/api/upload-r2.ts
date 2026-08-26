import type { APIRoute } from 'astro';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const prerender = false;

const R2_PUBLIC_BASE = 'https://storage.thegreatpuzzleproject.com';

function getS3Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : null);

  if (!accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error('Credenciales de Cloudflare R2 incompletas en variables de entorno.');
  }

  return {
    client: new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: false,
    }),
    bucket: process.env.R2_BUCKET_NAME || 'tgp-storage',
  };
}

export const POST: APIRoute = async ({ request }) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    let base64Data = '';
    let mimeType = 'image/png';
    let folder = 'laboratorio-visual';
    let filename = '';

    const contentTypeHeader = request.headers.get('content-type') || '';

    if (contentTypeHeader.includes('application/json')) {
      const body = await request.json();
      const dataUri = body.dataUri || body.image || '';
      folder = (body.folder || 'laboratorio-visual').replace(/[^a-z0-9\-_/]/gi, '');
      filename = (body.filename || '').replace(/[^a-z0-9\-_.]/gi, '');

      if (!dataUri) {
        return new Response(JSON.stringify({ error: 'Se requiere dataUri o image en formato Base64' }), {
          status: 400,
          headers,
        });
      }

      const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      } else {
        base64Data = dataUri;
      }
    } else if (contentTypeHeader.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      folder = ((formData.get('folder') as string) || 'laboratorio-visual').replace(/[^a-z0-9\-_/]/gi, '');
      filename = ((formData.get('filename') as string) || '').replace(/[^a-z0-9\-_.]/gi, '');

      if (!file) {
        return new Response(JSON.stringify({ error: 'Se requiere archivo en FormData' }), {
          status: 400,
          headers,
        });
      }

      mimeType = file.type || 'image/png';
      const arrayBuffer = await file.arrayBuffer();
      base64Data = Buffer.from(arrayBuffer).toString('base64');
    } else {
      return new Response(JSON.stringify({ error: 'Content-Type no soportado' }), { status: 400, headers });
    }

    if (!base64Data) {
      return new Response(JSON.stringify({ error: 'Datos de imagen vacíos' }), { status: 400, headers });
    }

    // Extensión según MIME
    const extMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/avif': '.avif',
      'image/svg+xml': '.svg',
    };
    const ext = extMap[mimeType] || '.png';

    if (!filename) {
      filename = `tgp-curada-${Date.now()}${ext}`;
    } else if (!filename.includes('.')) {
      filename = `${filename}${ext}`;
    }

    const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
    const key = cleanFolder ? `${cleanFolder}/${filename}` : filename;
    const buffer = Buffer.from(base64Data, 'base64');

    const { client, bucket } = getS3Client();

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );

    const publicUrl = `${R2_PUBLIC_BASE}/${key}`;

    return new Response(
      JSON.stringify({
        success: true,
        key,
        url: publicUrl,
        sizeBytes: buffer.length,
      }),
      { status: 200, headers }
    );
  } catch (error: any) {
    console.error('[API /api/upload-r2] Error al subir a R2:', error);
    return new Response(
      JSON.stringify({
        error: error?.message || 'Error interno al subir a Cloudflare R2',
      }),
      { status: 500, headers }
    );
  }
};
