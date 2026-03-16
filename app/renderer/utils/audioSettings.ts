const MUSIC_VOLUME_KEY = 'axesMundiMusicVolume';
const SFX_VOLUME_KEY = 'axesMundiSfxVolume';

const DEFAULT_MUSIC_VOLUME = 1;
const DEFAULT_SFX_VOLUME = 0.5;

function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) {
    return 0;
  }

  return Math.max(0, Math.min(1, volume));
}

function readVolume(key: string, fallback: number): number {
  try {
    const rawValue = window.localStorage.getItem(key);
    if (rawValue === null) {
      return fallback;
    }

    const parsed = Number.parseFloat(rawValue);
    return Number.isFinite(parsed) ? clampVolume(parsed) : fallback;
  } catch {
    return fallback;
  }
}

function writeVolume(key: string, volume: number): void {
  try {
    window.localStorage.setItem(key, String(clampVolume(volume)));
  } catch {
    // Ignore storage write failures and keep runtime value only.
  }
}

export function getMusicVolumeSetting(): number {
  return readVolume(MUSIC_VOLUME_KEY, DEFAULT_MUSIC_VOLUME);
}

export function setMusicVolumeSetting(volume: number): number {
  const normalized = clampVolume(volume);
  writeVolume(MUSIC_VOLUME_KEY, normalized);
  return normalized;
}

export function getSfxVolumeSetting(): number {
  return readVolume(SFX_VOLUME_KEY, DEFAULT_SFX_VOLUME);
}

export function setSfxVolumeSetting(volume: number): number {
  const normalized = clampVolume(volume);
  writeVolume(SFX_VOLUME_KEY, normalized);
  return normalized;
}

export function getDefaultMusicVolume(): number {
  return DEFAULT_MUSIC_VOLUME;
}

export function getDefaultSfxVolume(): number {
  return DEFAULT_SFX_VOLUME;
}
