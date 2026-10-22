// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Constructor de Google Chat cardsV2 con Batch de URLs
// Estructura oficial de Google Workspace Chat API
// ─────────────────────────────────────────────────────────────────────────────

import { SITE_ID, IS_ALTERNATIVE, GITHUB_REPO } from '../config/site.js';

export interface CardV2Options {
  status: 'published' | 'in_progress' | 'error' | 'draft_proposal';
  title: string;
  subtitle?: string;
  silo?: 'alternative' | 'hemeroteca' | 'magazine';
  excerpt?: string;
  heroImageUrl?: string;
  heroUrl?: string;
  coverImage?: string;
  slug?: string;
  publicUrl?: string;
  vaultUrl?: string;
  r2Url?: string;
  githubUrl?: string;
  errorMessage?: string;
  rawContent?: string;
}

/**
 * Validador estricto para evitar strings vacíos, URLs inválidas o raíces de bucket
 * que rompen la interfaz gráfica de Google Chat renderizando íconos rotos.
 */
function isValidImageUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (
    trimmed === '' ||
    trimmed === 'undefined' ||
    trimmed === 'null' ||
    trimmed === 'none' ||
    trimmed === 'false' ||
    trimmed.includes(' ')
  ) {
    return false;
  }
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return false;
  }
  // Descartar si solo apunta a la raíz de almacenamiento o a fallbacks 404
  if (
    trimmed === 'https://storage.thegreatpuzzleproject.com' ||
    trimmed === 'https://storage.thegreatpuzzleproject.com/' ||
    trimmed.includes('vault-media/tgp-error-stamp.webp')
  ) {
    return false;
  }
  return true;
}

export function buildGoogleChatCardV2(options: CardV2Options) {
  const {
    status,
    title,
    subtitle = '',
    silo = 'alternative',
    excerpt = '',
    slug = 'post-reciente',
    errorMessage,
  } = options;

  const siloLabel = silo.toUpperCase();
  const isError = status === 'error';
  const isSuccess = status === 'published';
  const isDraftProposal = status === 'draft_proposal';

  // Badges e iconos
  const statusBadge = isSuccess
    ? '🟢 PUBLICADO CON ÉXITO'
    : isDraftProposal
      ? '🟡 PROPUESTA DESDE MESA DE REDACCIÓN (DIALOGFLOW)'
      : isError
        ? '🔴 ERROR CON DIAGNÓSTICO'
        : '🟡 EN PROCESO DE FORJA';

  const headerSubtitle = `${siloLabel} • ${statusBadge}`;

  // 1. Resolución y saneamiento estricto de imagen
  const candidateImage = (
    options.heroImageUrl ||
    options.heroUrl ||
    options.coverImage ||
    ''
  ).trim();

  const previewImage = isValidImageUrl(candidateImage) ? candidateImage : undefined;

  // 2. URLs por defecto si no vienen explícitas
  const publicUrl =
    options.publicUrl ||
    (silo === 'alternative'
      ? `https://alternative.thegreatpuzzleproject.com/ensayos/${slug}`
      : `https://thegreatpuzzleproject.com/hemeroteca/${slug}`);

  const queryParams = `?slug=${encodeURIComponent(slug)}&title=${encodeURIComponent(title)}&silo=${silo}`;
  const vaultBase = silo === 'alternative'
    ? 'https://alternative.thegreatpuzzleproject.com/tgp-vault'
    : 'https://thegreatpuzzleproject.com/tgp-vault';
  const vaultUrl = options.vaultUrl || `${vaultBase}${queryParams}`;

  // Resolver r2Url asegurando que sea un enlace a un archivo real
  const candidateR2Url = (options.r2Url || previewImage || '').trim();
  const validR2Url = isValidImageUrl(candidateR2Url) ? candidateR2Url : undefined;

  const isAlt = silo === 'alternative' || IS_ALTERNATIVE;
  const githubRepo = isAlt
    ? (IS_ALTERNATIVE ? GITHUB_REPO : (process.env.GITHUB_REPO_ALTERNATIVE || 'ygnatiux-sys/tgp-webfinal2026'))
    : GITHUB_REPO;
  const cleanRepo = githubRepo.replace(/^https?:\/\/github\.com\//, '');
  const githubUrl = options.githubUrl || `https://github.com/${cleanRepo}`;

  const buttons: any[] = [];

  if (isDraftProposal) {
    buttons.push({
      text: '🚀 PUBLICAR EN EL REPOSITORIO',
      icon: { knownIcon: 'STAR' },
      onClick: {
        action: {
          function: 'publish_draft_now',
          parameters: [
            { key: 'slug', value: slug },
            { key: 'title', value: title },
            { key: 'silo', value: silo },
            { key: 'heroImageUrl', value: previewImage || '' },
            { key: 'content', value: (options.rawContent || excerpt).slice(0, 3500) },
          ],
        },
      },
    });
    buttons.push({
      text: '🛠️ ABRIR EN WORKBENCH / VAULT',
      icon: { knownIcon: 'DESCRIPTION' },
      onClick: { openLink: { url: vaultUrl } },
    });
    if (validR2Url) {
      buttons.push({
        text: '🗄️ ASSET EN STORAGE (R2)',
        icon: { knownIcon: 'FLIGHT_DEPARTURE' },
        onClick: { openLink: { url: validR2Url } },
      });
    }
  } else if (!isError) {
    buttons.push({
      text: '🌐 VER PUBLICACIÓN',
      icon: { knownIcon: 'BOOKMARK' },
      onClick: { openLink: { url: publicUrl } },
    });
    buttons.push({
      text: '🛠️ ABRIR EN WORKBENCH / VAULT',
      icon: { knownIcon: 'DESCRIPTION' },
      onClick: { openLink: { url: vaultUrl } },
    });
    if (validR2Url) {
      buttons.push({
        text: '🗄️ ASSET EN STORAGE (R2)',
        icon: { knownIcon: 'FLIGHT_DEPARTURE' },
        onClick: { openLink: { url: validR2Url } },
      });
    }
    buttons.push({
      text: '🐙 REPOSITORIO GITHUB',
      icon: { knownIcon: 'STAR' },
      onClick: { openLink: { url: githubUrl } },
    });
  } else {
    buttons.push({
      text: '🛠️ REVISAR EN TGP VAULT',
      icon: { knownIcon: 'DESCRIPTION' },
      onClick: { openLink: { url: vaultUrl } },
    });
    buttons.push({
      text: '📋 VER LOGS / DIAGNÓSTICO',
      icon: { knownIcon: 'CONFIRMATION_NUMBER_ICON' },
      onClick: { openLink: { url: 'https://console.cloud.google.com/run' } },
    });
  }

  const widgets: any[] = [];

  if (isError && errorMessage) {
    widgets.push({
      decoratedText: {
        topLabel: 'DIAGNÓSTICO DEL FALLO',
        text: `<b>${errorMessage}</b>`,
        startIcon: { knownIcon: 'DESCRIPTION' },
        wrapText: true,
      },
    });
  } else {
    if (subtitle) {
      widgets.push({
        decoratedText: {
          topLabel: 'TESIS CONCEPTUAL',
          text: `<b>${subtitle}</b>`,
          wrapText: true,
        },
      });
    }

    if (excerpt) {
      widgets.push({
        decoratedText: {
          topLabel: 'SÍNTESIS EDITORIAL (BRIEF)',
          text: excerpt.length > 320 ? excerpt.slice(0, 317) + '...' : excerpt,
          wrapText: true,
        },
      });
    }

    // SOLO inyectar widget de imagen si previewImage es una URL HTTP/HTTPS válida
    if (previewImage) {
      widgets.push({
        image: {
          imageUrl: previewImage,
          altText: title,
        },
      });
    }
  }

  if (isSuccess) {
    widgets.push({
      decoratedText: {
        topLabel: 'ESTADO DE SINCRONIZACIÓN',
        text: '⚡ <b>Ingesta activa en Vault & R2</b><br>⏳ <i>Build en Cloudflare Pages en curso (~60s)</i>',
        startIcon: { knownIcon: 'CLOCK' },
        wrapText: true,
      },
    });
  }

  widgets.push({
    buttonList: {
      buttons,
    },
  });

  // Header limpio: solo incluye imageUrl si previewImage es válida
  const cardHeader: Record<string, any> = {
    title: title.length > 55 ? title.slice(0, 52) + '...' : title,
    subtitle: headerSubtitle,
  };

  if (previewImage) {
    cardHeader.imageUrl = previewImage;
    cardHeader.imageType = 'SQUARE';
  }

  return {
    cardsV2: [
      {
        cardId: `tgp-card-${Date.now()}`,
        card: {
          header: cardHeader,
          sections: [
            {
              header: isError ? 'REPORTE DE INCIDENCIA' : 'TRAZABILIDAD Y ACCIONES GITOPS',
              widgets,
            },
          ],
        },
      },
    ],
  };
}
