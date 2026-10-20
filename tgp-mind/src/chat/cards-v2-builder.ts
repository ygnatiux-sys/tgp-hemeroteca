// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Constructor de Google Chat cardsV2 con Batch de URLs
// Estructura oficial de Google Workspace Chat API
// ─────────────────────────────────────────────────────────────────────────────

export interface CardV2Options {
  status: 'published' | 'in_progress' | 'error';
  title: string;
  subtitle?: string;
  silo?: 'alternative' | 'hemeroteca' | 'magazine';
  excerpt?: string;
  heroImageUrl?: string;
  slug?: string;
  publicUrl?: string;
  vaultUrl?: string;
  r2Url?: string;
  githubUrl?: string;
  errorMessage?: string;
}

export function buildGoogleChatCardV2(options: CardV2Options) {
  const {
    status,
    title,
    subtitle = '',
    silo = 'alternative',
    excerpt = '',
    heroImageUrl,
    slug = 'post-reciente',
    errorMessage,
  } = options;

  const siloLabel = silo.toUpperCase();
  const isError = status === 'error';
  const isSuccess = status === 'published';

  // Badges e iconos
  const statusBadge = isSuccess
    ? '🟢 PUBLICADO CON ÉXITO'
    : isError
      ? '🔴 ERROR CON DIAGNÓSTICO'
      : '🟡 EN PROCESO DE FORJA';

  const headerSubtitle = `${siloLabel} • ${statusBadge}`;
  const defaultHero = 'https://storage.thegreatpuzzleproject.com/vault-media/1792224263352-03d6d25b.webp';
  const previewImage = heroImageUrl || defaultHero;

  // URLs por defecto si no vienen explícitas
  const publicUrl =
    options.publicUrl ||
    (silo === 'alternative'
      ? `https://alternative.thegreatpuzzleproject.com/historia-alternativa/${slug}`
      : `https://thegreatpuzzleproject.com/hemeroteca/${slug}`);

  const queryParams = `?slug=${encodeURIComponent(slug)}&title=${encodeURIComponent(title)}&silo=${silo}`;
  const vaultUrl = options.vaultUrl || `https://thegreatpuzzleproject.com/tgp-vault${queryParams}`;
  const r2Url = options.r2Url || heroImageUrl || 'https://storage.thegreatpuzzleproject.com';
  const githubRepo = silo === 'alternative' ? 'tgp-webfinal2026' : 'tgp-hemeroteca';
  const githubUrl = options.githubUrl || `https://github.com/ygnatiux-sys/${githubRepo}`;

  const buttons: any[] = [];

  if (!isError) {
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
    if (r2Url) {
      buttons.push({
        text: '🗄️ ASSET EN STORAGE (R2)',
        icon: { knownIcon: 'FLIGHT_DEPARTURE' },
        onClick: { openLink: { url: r2Url } },
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

    if (previewImage) {
      widgets.push({
        image: {
          imageUrl: previewImage,
          altText: title,
        },
      });
    }
  }

  widgets.push({
    buttonList: {
      buttons,
    },
  });

  return {
    cardsV2: [
      {
        cardId: `tgp-card-${Date.now()}`,
        card: {
          header: {
            title: title.length > 55 ? title.slice(0, 52) + '...' : title,
            subtitle: headerSubtitle,
            imageUrl: isError
              ? 'https://storage.thegreatpuzzleproject.com/vault-media/tgp-error-stamp.webp'
              : previewImage,
            imageType: 'SQUARE',
          },
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
