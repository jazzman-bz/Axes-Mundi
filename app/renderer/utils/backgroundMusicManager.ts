import { logger } from './logger';

export type BackgroundTrack = 'landing' | 'gameplay';

interface TrackConfig {
  fileName: string;
  volume: number;
}

interface PlayOptions {
  fadeInMs?: number;
}

const TRACKS: Record<BackgroundTrack, TrackConfig> = {
  landing: {
    fileName: 'landing-piano.mp3',
    volume: 0.32,
  },
  gameplay: {
    fileName: 'gameplay-piano.mp3',
    volume: 0.24,
  },
};

class BackgroundMusicManager {
  private readonly basePath = './assets/music/';

  private currentAudio: HTMLAudioElement | null = null;

  private currentTrack: BackgroundTrack | null = null;

  private fadeFrame: number | null = null;

  private pendingTrack: { track: BackgroundTrack; options: PlayOptions } | null = null;

  private unlockHandlerBound = this.handleUnlock.bind(this);

  async play(track: BackgroundTrack, options: PlayOptions = {}): Promise<void> {
    if (this.currentTrack === track && this.currentAudio && !this.currentAudio.paused) {
      return;
    }

    this.clearFade();

    if (this.currentAudio) {
      this.stopCurrentAudio();
    }

    const audio = new Audio(`${this.basePath}${TRACKS[track].fileName}`);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = options.fadeInMs ? 0 : TRACKS[track].volume;

    try {
      await audio.play();
      this.currentAudio = audio;
      this.currentTrack = track;
      this.pendingTrack = null;
      this.removeUnlockListeners();

      if (options.fadeInMs) {
        this.fadeVolume(audio, TRACKS[track].volume, options.fadeInMs);
      }

      logger.info({
        scope: 'music/play',
        msg: 'background music started',
        meta: { track, volume: TRACKS[track].volume },
      });
    } catch (error) {
      this.pendingTrack = { track, options };
      this.currentAudio = audio;
      this.currentTrack = track;
      this.addUnlockListeners();

      logger.warn({
        scope: 'music/play',
        msg: 'background music autoplay blocked, waiting for user interaction',
        err: { message: (error as Error).message },
        meta: { track },
      });
    }
  }

  async fadeOutCurrent(fadeOutMs: number = 800): Promise<void> {
    if (!this.currentAudio) {
      return;
    }

    const audio = this.currentAudio;
    if (audio.paused || audio.volume <= 0) {
      this.stopCurrentAudio();
      return;
    }

    const initialVolume = audio.volume;

    await new Promise<void>((resolve) => {
      this.animateVolume(audio, initialVolume, 0, fadeOutMs, () => {
        audio.pause();
        audio.currentTime = 0;
        if (this.currentAudio === audio) {
          this.currentAudio = null;
          this.currentTrack = null;
        }
        resolve();
      });
    });

    logger.info({
      scope: 'music/fade',
      msg: 'background music faded out',
      meta: { durationMs: fadeOutMs },
    });
  }

  stop(): void {
    this.clearFade();
    this.stopCurrentAudio();
    this.pendingTrack = null;
    this.removeUnlockListeners();
  }

  private async handleUnlock(): Promise<void> {
    if (!this.pendingTrack) {
      return;
    }

    const pendingTrack = this.pendingTrack;
    this.pendingTrack = null;
    await this.play(pendingTrack.track, pendingTrack.options);
  }

  private stopCurrentAudio(): void {
    if (!this.currentAudio) {
      return;
    }

    this.currentAudio.pause();
    this.currentAudio.currentTime = 0;
    this.currentAudio = null;
    this.currentTrack = null;
  }

  private fadeVolume(audio: HTMLAudioElement, targetVolume: number, durationMs: number): void {
    this.animateVolume(audio, audio.volume, targetVolume, durationMs);
  }

  private animateVolume(
    audio: HTMLAudioElement,
    from: number,
    to: number,
    durationMs: number,
    onComplete?: () => void,
  ): void {
    this.clearFade();

    if (durationMs <= 0) {
      audio.volume = to;
      onComplete?.();
      return;
    }

    const startedAt = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      audio.volume = from + ((to - from) * progress);

      if (progress < 1) {
        this.fadeFrame = window.requestAnimationFrame(step);
        return;
      }

      this.fadeFrame = null;
      onComplete?.();
    };

    this.fadeFrame = window.requestAnimationFrame(step);
  }

  private clearFade(): void {
    if (this.fadeFrame !== null) {
      window.cancelAnimationFrame(this.fadeFrame);
      this.fadeFrame = null;
    }
  }

  private addUnlockListeners(): void {
    this.removeUnlockListeners();
    window.addEventListener('pointerdown', this.unlockHandlerBound, { once: true });
    window.addEventListener('keydown', this.unlockHandlerBound, { once: true });
  }

  private removeUnlockListeners(): void {
    window.removeEventListener('pointerdown', this.unlockHandlerBound);
    window.removeEventListener('keydown', this.unlockHandlerBound);
  }
}

export const backgroundMusicManager = new BackgroundMusicManager();
