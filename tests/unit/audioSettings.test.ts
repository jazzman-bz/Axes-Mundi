import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import {
  getDefaultMusicVolume,
  getDefaultSfxVolume,
  getMusicVolumeSetting,
  getSfxVolumeSetting,
  setMusicVolumeSetting,
  setSfxVolumeSetting,
} from '@/utils/audioSettings';

describe('audioSettings', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn((key: string) => storage.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
          storage.set(key, value);
        }),
        removeItem: vi.fn((key: string) => {
          storage.delete(key);
        }),
      },
    });
  });

  it('returns defaults when nothing is stored', () => {
    expect(getMusicVolumeSetting()).toBe(getDefaultMusicVolume());
    expect(getSfxVolumeSetting()).toBe(getDefaultSfxVolume());
  });

  it('persists normalized values for music and sfx', () => {
    expect(setMusicVolumeSetting(0.73)).toBe(0.73);
    expect(setSfxVolumeSetting(0.21)).toBe(0.21);

    expect(getMusicVolumeSetting()).toBe(0.73);
    expect(getSfxVolumeSetting()).toBe(0.21);
  });

  it('clamps out-of-range values', () => {
    expect(setMusicVolumeSetting(1.5)).toBe(1);
    expect(setSfxVolumeSetting(-0.5)).toBe(0);

    expect(getMusicVolumeSetting()).toBe(1);
    expect(getSfxVolumeSetting()).toBe(0);
  });

  it('falls back to defaults for invalid stored values', () => {
    window.localStorage.setItem('axesMundiMusicVolume', 'oops');
    window.localStorage.setItem('axesMundiSfxVolume', 'NaN');

    expect(getMusicVolumeSetting()).toBe(getDefaultMusicVolume());
    expect(getSfxVolumeSetting()).toBe(getDefaultSfxVolume());
  });
});
