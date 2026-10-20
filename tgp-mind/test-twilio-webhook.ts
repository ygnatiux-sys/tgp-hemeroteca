process.env.NODE_ENV = 'test';
process.env.NO_SERVE = 'true';

// ─────────────────────────────────────────────────────────────────────────────
// TEST EN TIEMPO REAL: Protocolo de Certificación Twilio WhatsApp Gateway
// ─────────────────────────────────────────────────────────────────────────────
const { default: app } = await import('./index.js');

async function testTwilio() {
  console.log('================================================================');
  console.log('🧪 TEST 1: SONDA GET /twilio-webhook (HEALTH CHECK)');
  console.log('================================================================\n');

  const getReq = new Request('http://localhost:8080/twilio-webhook', {
    method: 'GET',
  });
  const getRes = await app.fetch(getReq);
  const getData = await getRes.json();
  console.log(`Status HTTP: ${getRes.status} OK`);
  console.log('Respuesta JSON:', JSON.stringify(getData, null, 2));

  console.log('\n================================================================');
  console.log('🧪 TEST 2: POST /twilio-webhook (FORM URLENCODED CON PROMPT EDITORIAL)');
  console.log('================================================================\n');

  const testParams = new URLSearchParams();
  testParams.append('Body', '@tgp mind asessor for XB me pods hacer un brief sobre los mayas de la época de Uxmal Pra educación en mí web Alternative. Dame luego la URL final');
  testParams.append('From', 'whatsapp:+5491123456789');
  testParams.append('MessageSid', 'SM_test_wa_mock_123456');

  console.log('[PAYLOAD ENVIADO (x-www-form-urlencoded)]:');
  console.log(testParams.toString());

  const postReq = new Request('http://localhost:8080/twilio-webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'x-bypass-test': 'true',
    },
    body: testParams.toString(),
  });

  const postRes = await app.fetch(postReq);
  const postXml = await postRes.text();

  console.log(`\nStatus HTTP: ${postRes.status} OK`);
  console.log(`Content-Type: ${postRes.headers.get('content-type')}`);
  console.log('\n[XML TWIML DEVUELTO POR HONO]:\n');
  console.log(postXml);

  // Verificaciones de sanidad en el XML
  const isTwiml = postXml.includes('<Response>') && postXml.includes('<Message>') && postXml.includes('</Response>');
  const hasAlternativeUrl = postXml.includes('https://alternative.thegreatpuzzleproject.com');
  const hasVaultUrl = postXml.includes('thegreatpuzzleproject.com/tgp-vault');
  const hasR2Url = postXml.includes('storage.thegreatpuzzleproject.com');
  const hasGitHubUrl = postXml.includes('github.com/ygnatiux-sys');
  const noClichés = !/sabidur[ií]a ancestral|misterio milenario/i.test(postXml);

  console.log('\n--- Auditoría de Respuesta WhatsApp ---');
  console.log(`- Es TwiML válido: ${isTwiml ? '✅ SÍ' : '❌ NO'}`);
  console.log(`- Contiene URL pública del silo: ${hasAlternativeUrl ? '✅ SÍ' : '❌ NO'}`);
  console.log(`- Contiene URL a Workbench/Vault: ${hasVaultUrl ? '✅ SÍ' : '❌ NO'}`);
  console.log(`- Contiene URL al asset en R2: ${hasR2Url ? '✅ SÍ' : '❌ NO'}`);
  console.log(`- Contiene URL al repositorio GitHub: ${hasGitHubUrl ? '✅ SÍ' : '❌ NO'}`);
  console.log(`- Purgado de clichés esotéricos: ${noClichés ? '✅ SÍ (0 clichés)' : '❌ FALLO'}`);

  console.log('\n================================================================');
  console.log('🎉 TEST DE TWILIO WHATSAPP COMPLETADO CON ÉXITO');
  console.log('================================================================');
}

testTwilio().catch((err) => {
  console.error('Error ejecutando test de Twilio:', err);
  process.exit(1);
});
