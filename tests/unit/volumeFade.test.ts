import { describe, expect, it } from 'vitest';
import { getFadeVolume } from '../../app/renderer/utils/volumeFade';

describe('getFadeVolume', () => {
  it('moves linearly from start to target volume', () => {
    expect(getFadeVolume(0, 0.32, 0, 1000)).toBe(0);
    expect(getFadeVolume(0, 0.32, 500, 1000)).toBeCloseTo(0.16);
    expect(getFadeVolume(0.32, 0, 1000, 1000)).toBe(0);
  });

  it('never goes below 0 when the first animation frame is stamped before the fade started', () => {
    // Measured in the app: a fade-in from 0 produced -0.0022 and the audio element threw.
    expect(getFadeVolume(0, 0.32, -7, 1000)).toBe(0);
  });

  it('stays at the target once the fade has run longer than planned', () => {
    expect(getFadeVolume(0, 0.24, 5000, 1000)).toBe(0.24);
  });

  it('keeps the volume within 0 to 1 for any input', () => {
    expect(getFadeVolume(0.5, 1.4, 1000, 1000)).toBe(1);
    expect(getFadeVolume(0.5, -0.4, 1000, 1000)).toBe(0);
    expect(getFadeVolume(0.2, 0.8, 100, 0)).toBe(0.8);
  });
});
