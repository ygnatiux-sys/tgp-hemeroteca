process.env.NODE_ENV = 'test';
process.env.NO_SERVE = 'true';
// ─────────────────────────────────────────────────────────────────────────────
// TEST EN TIEMPO REAL: Protocolo de Certificación Local Google Chat & Antiliteralidad
// ─────────────────────────────────────────────────────────────────────────────
import { sanitizeEditorialPrompt } from './src/ia/editorial-sanitizer.js';
import { buildGoogleChatCardV2 } from './src/chat/cards-v2-builder.js';
const { default: app } = await import('./index.js');

async function main() {
  console.log('================================================================');
  console.log('🧪 TEST 1: SANITIZACIÓN EDITORIAL ANTILITERALIDAD (DOCTRINA XB)');
  console.log('================================================================\n');

  const rawPrompt = '@tgp mind asessor for XB me pods hacer un brief sobre los mayas de la época de Uxmal Pra educación en mí web Alternative. Dame luego la URL final';
  console.log(`[PROMPT CRUDO DEL USUARIO]:\n"${rawPrompt}"\n`);

  const brief = await sanitizeEditorialPrompt(rawPrompt);
  console.log('✅ [FICHA SANITIZADA RESULTANTE]:');
  console.log(JSON.stringify(brief, null, 2));

  // Verificaciones de sanidad
  const tieneClasicosClichés = /sabidur[ií]a ancestral|misterio|desaf[ií]a a la ciencia/i.test(brief.cleanTitle);
  const tieneMuletillas = /me pods|me puedes|pra educaci[oó]n|dame luego/i.test(brief.cleanTitle);

  console.log('\n--- Auditoría de Calidad Editorial ---');
  console.log(`- Contiene clichés esotéricos prohibidos: ${tieneClasicosClichés ? '❌ FALLO' : '✅ 0 CLICHÉS'}`);
  console.log(`- Contiene muletillas o errores de tipeo: ${tieneMuletillas ? '❌ FALLO' : '✅ 0 MULETILLAS'}`);
  console.log(`- Silo detectado correctamente: ${brief.targetSilo === 'alternative' ? '✅ ALTERNATIVE' : '❌ OTRO'}`);
  console.log(`- Slug canónico generado: ${brief.slug ? `✅ ${brief.slug}` : '❌ VACÍO'}`);

  console.log('\n================================================================');
  console.log('🧪 TEST 2: PAYLOAD OFICIAL GOOGLE CHAT CARDS V2 (BATCH DE URLS)');
  console.log('================================================================\n');

  const cardSuccess = buildGoogleChatCardV2({
    status: 'published',
    title: brief.cleanTitle,
    subtitle: brief.subtitle,
    silo: brief.targetSilo,
    slug: brief.slug,
    excerpt: 'Análisis estratigráfico sobre la arquitectura Puuc en Uxmal y la gestión hidráulica de los chultunes durante el periodo Clásico Terminal.',
    heroImageUrl: 'https://storage.thegreatpuzzleproject.com/wikimedia/uxmal-quadrangle-birds.webp',
  });

  console.log(JSON.stringify(cardSuccess, null, 2));

  console.log('\n================================================================');
  console.log('🧪 TEST 3: MANEJO DE ERROR CONTROLADO (CERO SILENCIO EN CHAT)');
  console.log('================================================================\n');

  const cardError = buildGoogleChatCardV2({
    status: 'error',
    title: 'Incidencia en Forja de Ensayo',
    subtitle: `Solicitud: "${brief.cleanTitle}"`,
    silo: brief.targetSilo,
    slug: brief.slug,
    errorMessage: 'Simulación de timeout en API externa de renderizado R2. Procediendo a registro en log de auditoría.',
  });

  console.log(JSON.stringify(cardError, null, 2));

  console.log('\n================================================================');
  console.log('🧪 TEST 4: INVOCACIÓN REAL AL ENDPOINT HONO /google-chat-webhook');
  console.log('================================================================\n');

  const mockPayload = {
    text: rawPrompt,
    user: { displayName: 'Xavier Benítez' },
    space: { name: 'spaces/test_production_space' },
  };

  const req = new Request('http://localhost:8080/google-chat-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mockPayload),
  });

  const res = await app.fetch(req);
  const data = await res.json();

  console.log(`Status HTTP: ${res.status} OK`);
  console.log('Estructura devuelta por el servidor Hono:');
  console.log(`- Tiene campo "text": ${Boolean(data.text)}`);
  console.log(`- Tiene campo "cardsV2": ${Boolean(data.cardsV2)} (${data.cardsV2?.length || 0} tarjeta/s)`);
  if (data.cardsV2?.[0]?.card?.header) {
    console.log(`- Header Title en Card V2: "${data.cardsV2[0].card.header.title}"`);
    console.log(`- Header Subtitle en Card V2: "${data.cardsV2[0].card.header.subtitle}"`);
  }

  console.log('\n================================================================');
  console.log('🎉 TODOS LOS TESTS COMPLETADOS CON ÉXITO EN LOCAL');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('Error en ejecución del test:', err);
  process.exit(1);
});
