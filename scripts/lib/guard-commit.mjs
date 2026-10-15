import { execSync } from 'child_process';

try {
  const staged = execSync('git diff --cached --name-only', { encoding: 'utf8' })
    .split('\n')
    .map(f => f.trim())
    .filter(Boolean);

  if (staged.length === 0) {
    process.exit(0);
  }

  const forbiddenPatterns = [
    /\.ps1$/i,
    /\.bat$/i,
    /^scripts\/.*(temp|tmp|scratch|test).*\.(m?js|ts|ps1)$/i,
    /^(convertir|make_audio)\.(m?js|ts)$/i,
    /^(intro|outro).*\.wav$/i,
    /\.sqlite3?$/i
  ];

  const violations = [];

  for (const file of staged) {
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(file)) {
        violations.push({ file, pattern: pattern.toString() });
        break;
      }
    }
  }

  if (violations.length > 0) {
    console.error('\n🛑 [ESCUDO GIT TGP: COMMIT BLOQUEADO]');
    console.error('─────────────────────────────────────────────────────────────────────────────');
    console.error('Se detectaron archivos prohibidos o scripts locales preparados para el commit:');
    for (const v of violations) {
      console.error(`  ❌ ${v.file} (Regla: ${v.pattern})`);
    }
    console.error('─────────────────────────────────────────────────────────────────────────────');
    console.error('Motivo: Estos archivos pueden romper el render/deploy en Cloudflare o filtrar scripts locales.');
    console.error('Acción requerida: Ejecuta "git reset HEAD <archivo>" o elimínalos antes de comitear.\n');
    process.exit(1);
  }

  console.log('✅ [ESCUDO GIT TGP] Staging limpio: cero scripts huérfanos.');
  process.exit(0);
} catch (err) {
  // Si git no está disponible o falla el comando, no bloqueamos a ciegas
  console.warn('⚠️ [ESCUDO GIT TGP] Advertencia al validar staged files:', err.message);
  process.exit(0);
}
