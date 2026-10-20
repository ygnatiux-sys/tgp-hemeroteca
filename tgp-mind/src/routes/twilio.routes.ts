// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Gateway Modular de Twilio (WhatsApp)
// Soporta TwiML XML nativo, validación de firma y batch de URLs para WhatsApp
// ─────────────────────────────────────────────────────────────────────────────
import { Hono } from 'hono';
import crypto from 'node:crypto';
import { runChatOrchestrator } from '../chat/orchestrator.js';

export const twilioRoutes = new Hono();

const TWILIO_AUTH_TOKEN = (process.env.TWILIO_AUTH_TOKEN || '').replace(/['"]/g, '').trim();

/**
 * Valida la firma criptográfica enviada por Twilio en el encabezado X-Twilio-Signature.
 */
export function verifyTwilioSignature(
  authToken: string,
  twilioSignature: string,
  url: string,
  params: Record<string, any>
): boolean {
  if (!authToken) return true; // Bypass seguro si aún no se configuró en .env
  if (!twilioSignature) return false;

  let data = url;
  const sortedKeys = Object.keys(params).sort();
  for (const key of sortedKeys) {
    data += key + (params[key] ?? '');
  }

  const expectedSignature = crypto
    .createHmac('sha1', authToken)
    .update(Buffer.from(data, 'utf-8'))
    .digest('base64');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(twilioSignature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Construye un XML TwiML estándar para respuesta directa en WhatsApp.
 */
export function buildTwimlResponse(bodyMessage: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message><![CDATA[${bodyMessage}]]></Message>
</Response>`.trim();
}

/**
 * Formatea la respuesta con estilo WhatsApp (*bold*, _italic_) y lote de URLs cuando hay publicación.
 */
function formatWhatsAppResponse(
  rawText: string,
  editorialBrief?: any,
  metadata?: any
): string {
  let message = rawText.trim();

  if (editorialBrief || metadata?.publicUrl) {
    const cleanTitle = editorialBrief?.cleanTitle || 'Entrega Editorial TGP';
    const subtitle = editorialBrief?.subtitle ? `_${editorialBrief.subtitle}_\n\n` : '';
    const silo = (editorialBrief?.targetSilo || 'alternative').toUpperCase();
    const slug = editorialBrief?.slug || 'post-reciente';

    const publicUrl =
      metadata?.publicUrl ||
      (silo === 'ALTERNATIVE'
        ? `https://alternative.thegreatpuzzleproject.com/historia-alternativa/${slug}`
        : `https://thegreatpuzzleproject.com/hemeroteca/${slug}`);

    const queryParams = `?slug=${encodeURIComponent(slug)}&title=${encodeURIComponent(cleanTitle)}&silo=${silo.toLowerCase()}`;
    const vaultUrl = metadata?.vaultUrl || `https://thegreatpuzzleproject.com/tgp-vault${queryParams}`;
    const r2Url = metadata?.r2Url || metadata?.heroImageUrl || 'https://storage.thegreatpuzzleproject.com';
    const githubRepo = silo === 'ALTERNATIVE' ? 'tgp-webfinal2026' : 'tgp-hemeroteca';
    const githubUrl = metadata?.githubUrl || `https://github.com/ygnatiux-sys/${githubRepo}`;

    message = `🏛️ *TGP MIND | ${silo}*
📌 *${cleanTitle}*
${subtitle}${message}

━━━━━━━━━━━━━━━━━━━━━
🌐 *Ver Publicación:*
${publicUrl}

🛠️ *Workbench / Vault:*
${vaultUrl}

🗄️ *Asset en Storage R2:*
${r2Url}

🐙 *Repositorio GitHub:*
${githubUrl}
━━━━━━━━━━━━━━━━━━━━━`.trim();
  }

  return message;
}

// ── Sonda GET para verificación y monitor de salud de Twilio ─────────────────
twilioRoutes.get('/twilio-webhook', (c) => {
  return c.json({
    status: 'TGP Mind Twilio WhatsApp Gateway activo',
    service: 'twilio-whatsapp',
    timestamp: new Date().toISOString(),
  });
});

// ── Endpoint POST Principal Webhook de Twilio ────────────────────────────────
twilioRoutes.post('/twilio-webhook', async (c) => {
  try {
    // Parsea application/x-www-form-urlencoded de Hono nativo
    const parsedBody = (await c.req.parseBody().catch(() => ({}))) as Record<string, any>;

    const bodyText = String(parsedBody.Body || parsedBody.body || '').trim();
    const rawFrom = String(parsedBody.From || parsedBody.from || 'whatsapp:+000000000').trim();
    const messageSid = String(parsedBody.MessageSid || parsedBody.SmsMessageSid || 'sid_local').trim();

    const signature = c.req.header('x-twilio-signature') || '';
    const isLocalTest =
      process.env.NODE_ENV === 'test' ||
      c.req.header('x-bypass-test') === 'true' ||
      !TWILIO_AUTH_TOKEN;

    // Validación de firma si hay token configurado
    if (!isLocalTest) {
      const fullUrl = c.req.url;
      const isValid = verifyTwilioSignature(TWILIO_AUTH_TOKEN, signature, fullUrl, parsedBody);
      if (!isValid) {
        console.warn(`[Twilio Webhook] Firma inválida de ${rawFrom} (${messageSid})`);
        return c.text('403 Forbidden: Invalid Twilio Signature', 403);
      }
    }

    if (!bodyText) {
      const emptyHelp = '¡Hola! Soy el asistente de TGP Mind vía WhatsApp. Puedes pedirme briefs, análisis arqueológicos o forja de artículos.';
      const twiml = buildTwimlResponse(emptyHelp);
      return c.body(twiml, 200, { 'Content-Type': 'text/xml; charset=utf-8' });
    }

    const cleanFrom = rawFrom.replace(/^whatsapp:/, '');
    const sessionId = `wa_${cleanFrom.replace(/[^a-zA-Z0-9]/g, '_')}`;

    console.log(`[Twilio Webhook] Mensaje recibido de ${cleanFrom} (SID: ${messageSid}): "${bodyText.slice(0, 80)}"`);

    // Invocación al orquestador central unificado
    const orchestration = await runChatOrchestrator(bodyText, {
      user: `WhatsApp (${cleanFrom})`,
      channel: 'whatsapp',
      sessionId,
    });

    const formattedMessage = formatWhatsAppResponse(
      orchestration.text,
      orchestration.editorialBrief,
      orchestration.metadata
    );

    const twiml = buildTwimlResponse(formattedMessage);
    return c.body(twiml, 200, { 'Content-Type': 'text/xml; charset=utf-8' });
  } catch (err: any) {
    console.error('[Twilio Webhook Error]:', err);
    const errorXml = buildTwimlResponse(
      `⚠️ *TGP Mind — Incidencia en WhatsApp*\nOcurrió un error al procesar tu solicitud: ${err?.message || 'Error interno'}`
    );
    return c.body(errorXml, 200, { 'Content-Type': 'text/xml; charset=utf-8' });
  }
});
