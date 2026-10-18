import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const prerender = false;

export const ALL: APIRoute = async ({ params, redirect }) => {
  const rawSlug = params.slug || '';
  const cleanSlug = rawSlug.replace(/\/$/, '').toLowerCase().trim();

  if (!cleanSlug) {
    return redirect('/archivo/', 302);
  }

  // 1. ¿Existe en ensayosCinematicos de tgp-hemeroteca?
  const cinematicos = await getCollection('ensayosCinematicos').catch(() => []);
  const foundCinematic = cinematicos.find(c => {
    const s = c.id.replace(/\/index$/, '').toLowerCase();
    return s === cleanSlug || cleanSlug.includes(s) || s.includes(cleanSlug);
  });
  if (foundCinematic) {
    const target = foundCinematic.id.replace(/\/index$/, '');
    return redirect(`/ensayos-cinematicos/${target}/`, 302);
  }

  // 2. ¿Existe en ensayos convencionales de tgp-hemeroteca?
  const ensayos = await getCollection('ensayos').catch(() => []);
  const foundEnsayo = ensayos.find(e => {
    const s = e.id.replace(/\/index$/, '').toLowerCase();
    return s === cleanSlug;
  });
  if (foundEnsayo) {
    const target = foundEnsayo.id.replace(/\/index$/, '');
    return redirect(`/hemeroteca/${target}/`, 302);
  }

  // 3. Coincidencia difusa / parcial local (ej: 'mercurio-hermes...' -> 'mercurio')
  const partialEnsayo = ensayos.find(e => {
    const s = e.id.replace(/\/index$/, '').toLowerCase();
    return cleanSlug.startsWith(s) || s.startsWith(cleanSlug);
  });
  if (partialEnsayo) {
    const target = partialEnsayo.id.replace(/\/index$/, '');
    return redirect(`/hemeroteca/${target}/`, 302);
  }

  // 4. ¿Existe en georreferencias o arquetipos?
  const georefs = await getCollection('georreferencias').catch(() => []);
  const foundGeoref = georefs.find(g => {
    const s = g.id.replace(/\/index$/, '').toLowerCase();
    return s === cleanSlug || cleanSlug.includes(s);
  });
  if (foundGeoref) {
    return redirect(`/colecciones/arqueosemiotica/${foundGeoref.id.replace(/\/index$/, '')}/`, 302);
  }

  // 5. Si NO existe en tgp-hemeroteca: REDIRIGIR A LA WEB HERMANA (Alternative)
  // En dev corre en el puerto 4325; en producción en el host configurado
  const isDev = import.meta.env.DEV;
  const sisterBaseUrl = isDev
    ? 'http://localhost:4325'
    : (import.meta.env.PUBLIC_TGP_APP_URL || 'https://thegreatpuzzleproject.com').replace(/\/$/, '');

  return redirect(`${sisterBaseUrl}/ensayos/${cleanSlug}/`, 302);
};
