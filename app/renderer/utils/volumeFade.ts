/**
 * Volume for one step of a fade, always between 0 and 1.
 *
 * requestAnimationFrame passes the frame's start time, which can be slightly
 * earlier than the performance.now() taken when the fade began. Without the
 * clamp the first step of a fade-in from 0 would be a small negative volume,
 * which HTMLMediaElement rejects with an error.
 */
export function getFadeVolume(from: number, to: number, elapsedMs: number, durationMs: number): number {
  const progress = durationMs > 0 ? Math.min(1, Math.max(0, elapsedMs / durationMs)) : 1;
  return Math.min(1, Math.max(0, from + ((to - from) * progress)));
}
