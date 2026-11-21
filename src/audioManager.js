/**
 * src/audioManager.js
 * Gestor de Audio Editorial TGP con Howler.js
 * Prioriza Cloudflare R2 (storage.thegreatpuzzleproject.com/sounds/) con fallback local /sounds/.
 */

import { Howl, Howler } from 'howler';

const R2_SOUNDS_BASE = 'https://storage.thegreatpuzzleproject.com/sounds';
const LOCAL_SOUNDS_BASE = '/sounds';

export const SFX_NAMES = [
  'pickup_chip',
  'pickup_item',
  'door_open',
  'socket_open',
  'bump_wall',
  'push_block',
  'splash',
  'fire_burn',
  'bomb_explode',
  'thief',
  'teleport',
  'button_click',
  'ice_slide',
  'hint_pop',
  'level_win',
  'time_tick',
];

export const BGM_TRACKS = [
  'bgm_china',
  'swingArcade',
  'catRagtime',
  'turkish',
  'india',
  'argentina',
  'cuba',
  'greece',
  'turkishFm90',
  'indiaFm90',
  'argentinaFm90',
  'cubaFm90',
  'greeceFm90',
];

const BGM_TRACKS_CONFIG = {
  bgm_china: 'bgm_china.wav',
  swingArcade: 'bgm_swing_arcade.wav',
  catRagtime: 'bgm_cat_ragtime.wav',
  turkish: 'bgm_turkish.wav',
  india: 'bgm_india.wav',
  argentina: 'bgm_argentina.wav',
  cuba: 'bgm_cuba.wav',
  greece: 'bgm_greece.wav',
  turkishFm90: 'bgm_turkish_fm90.wav',
  indiaFm90: 'bgm_india_fm90.wav',
  argentinaFm90: 'bgm_argentina_fm90.wav',
  cubaFm90: 'bgm_cuba_fm90.wav',
  greeceFm90: 'bgm_greece_fm90.wav',
};

const BGM_ALIASES = {
  bgm_turkish: 'turkish',
  bgm_india: 'india',
  bgm_argentina: 'argentina',
  bgm_cuba: 'cuba',
  bgm_greece: 'greece',
  bgm_turkish_fm90: 'turkishFm90',
  bgm_india_fm90: 'indiaFm90',
  bgm_argentina_fm90: 'argentinaFm90',
  bgm_cuba_fm90: 'cubaFm90',
  bgm_greece_fm90: 'greeceFm90',
  bgm_swing_arcade: 'swingArcade',
  bgm_cat_ragtime: 'catRagtime',
};

const bgmInstances = new Map();
let activeBgmKey = 'bgm_china';
const sfxRegistry = new Map();
let unlockBound = false;

function buildSources(filename) {
  return [`${R2_SOUNDS_BASE}/${filename}`, `${LOCAL_SOUNDS_BASE}/${filename}`];
}

function resolveBgmKey(trackKey = 'bgm_china') {
  const canonical = BGM_ALIASES[trackKey] || trackKey;
  return Object.prototype.hasOwnProperty.call(BGM_TRACKS_CONFIG, canonical) ? canonical : 'bgm_china';
}

function getBgmTrack(trackKey = 'bgm_china') {
  if (typeof window === 'undefined') return null;
  const key = resolveBgmKey(trackKey);
  if (!bgmInstances.has(key)) {
    const filename = BGM_TRACKS_CONFIG[key];
    const howl = new Howl({
      src: buildSources(filename),
      loop: true,
      volume: 0.35,
      preload: true,
      html5: false,
    });
    bgmInstances.set(key, howl);
  }
  return bgmInstances.get(key);
}

function getOrCreateSfx(name, options = {}) {
  if (typeof window === 'undefined') return null;
  const cleanName = String(name).replace(/\.wav$/i, '');
  if (!sfxRegistry.has(cleanName)) {
    const howl = new Howl({
      src: buildSources(`${cleanName}.wav`),
      volume: options.volume ?? 0.65,
      loop: Boolean(options.loop),
      preload: options.preload ?? true,
    });
    sfxRegistry.set(cleanName, howl);
  }
  return sfxRegistry.get(cleanName);
}

/**
 * Precarga en memoria los 16 efectos de sonido retro + todas las pistas BGM.
 */
export function preloadAllAudio() {
  if (typeof window === 'undefined') return;
  BGM_TRACKS.forEach((key) => getBgmTrack(key));
  SFX_NAMES.forEach((name) => getOrCreateSfx(name));
}

/**
 * Inicia una pista BGM en bucle (0.35 de volumen) deteniendo cualquier otra activa.
 * @param {'bgm_china'|'swingArcade'|'catRagtime'|'turkish'|'india'|'argentina'|'cuba'|'greece'} [trackKey='bgm_china']
 */
export function playMusic(trackKey = 'bgm_china') {
  const targetKey = resolveBgmKey(trackKey);
  for (const [k, instance] of bgmInstances.entries()) {
    if (k !== targetKey && instance.playing()) {
      instance.stop();
    }
  }

  activeBgmKey = targetKey;
  const track = getBgmTrack(targetKey);
  if (!track) return null;
  if (!track.playing()) {
    return track.play();
  }
  return null;
}

/**
 * Detiene todas las pistas BGM o una específica.
 */
export function stopMusic(trackKey) {
  if (trackKey) {
    const instance = bgmInstances.get(resolveBgmKey(trackKey));
    if (instance) instance.stop();
    return;
  }
  for (const instance of bgmInstances.values()) {
    instance.stop();
  }
}

export const switchMusic = playMusic;

/**
 * Salta a la siguiente pista BGM en rotación.
 */
export function nextMusic() {
  const idx = BGM_TRACKS.indexOf(activeBgmKey);
  const nextKey = BGM_TRACKS[(idx + 1) % BGM_TRACKS.length];
  playMusic(nextKey);
  return nextKey;
}

export function playSwingArcade() {
  return playMusic('swingArcade');
}

export function stopSwingArcade() {
  stopMusic('swingArcade');
}

export function playCatRagtime() {
  return playMusic('catRagtime');
}

export function stopCatRagtime() {
  stopMusic('catRagtime');
}

/**
 * Alterna reproducción / pausa del BGM activo y devuelve el nuevo estado booleano.
 */
export function toggleMusic(trackKey = activeBgmKey) {
  const key = resolveBgmKey(trackKey);
  const track = getBgmTrack(key);
  if (!track) return false;
  if (track.playing()) {
    track.pause();
    return false;
  }
  playMusic(key);
  return true;
}

export function isMusicPlaying(trackKey) {
  if (trackKey) {
    const instance = bgmInstances.get(resolveBgmKey(trackKey));
    return Boolean(instance && instance.playing());
  }
  for (const instance of bgmInstances.values()) {
    if (instance.playing()) return true;
  }
  return false;
}

export function getActiveMusicKey() {
  return activeBgmKey;
}

export function setMusicVolume(volume = 0.35) {
  const safeVol = Math.max(0, Math.min(1, Number(volume)));
  for (const instance of bgmInstances.values()) {
    instance.volume(safeVol);
  }
}

/**
 * Registra un efecto de sonido corto (SFX) personalizado.
 */
export function registerSfx(name, src, options = {}) {
  if (typeof window === 'undefined') return null;
  const howl = new Howl({
    src: Array.isArray(src) ? src : [src],
    volume: options.volume ?? 0.65,
    loop: Boolean(options.loop),
    preload: options.preload ?? true,
  });
  sfxRegistry.set(name, howl);
  return howl;
}

/**
 * Reproduce cualquiera de los 16 SFX estándar (ej. 'pickup_chip', 'level_win') o uno registrado.
 */
export function playSfx(name) {
  const sound = getOrCreateSfx(name);
  if (!sound) return null;
  return sound.play();
}

export const playSound = playSfx;

/**
 * Desbloquea el AudioContext en navegadores modernos al primer clic o tecla del usuario.
 */
export function unlockAudioOnFirstInteraction(autoPlayBgm = true, trackKey = 'bgm_china') {
  if (typeof window === 'undefined' || unlockBound) return;
  unlockBound = true;

  const unlock = () => {
    if (Howler.ctx && Howler.ctx.state === 'suspended') {
      Howler.ctx.resume().catch(() => {});
    }
    if (autoPlayBgm) {
      playMusic(trackKey);
    }
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };

  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true, passive: true });
}

export default {
  BGM_TRACKS,
  SFX_NAMES,
  preloadAllAudio,
  playMusic,
  switchMusic,
  nextMusic,
  stopMusic,
  playSwingArcade,
  stopSwingArcade,
  playCatRagtime,
  stopCatRagtime,
  toggleMusic,
  isMusicPlaying,
  getActiveMusicKey,
  setMusicVolume,
  registerSfx,
  playSfx,
  playSound,
  unlockAudioOnFirstInteraction,
};
