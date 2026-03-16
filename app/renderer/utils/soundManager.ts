/**
 * Sound Manager
 * Centralized sound effect management for Axes-Mundi
 * Handles loading, playing, and managing audio assets
 */

import { logger } from './logger';
import { getSfxVolumeSetting, setSfxVolumeSetting } from './audioSettings';

/**
 * Sound effect types
 */
export enum SoundType {
  BUTTON_CLICK = 'button-click',
  CARD_SHUFFLE = 'card-shuffle',
  CARD_FLIP = 'card-flip',
  CARD_PLACE = 'card-place',
  SUCCESS = 'success',
  ERROR = 'error',
  HOVER = 'hover'
}

/**
 * Sound Manager Configuration
 */
interface SoundManagerConfig {
  enabled: boolean;
  volume: number;
  basePath: string;
}

/**
 * Sound Manager Class
 * Manages audio playback for the application
 */
export class SoundManager {
  private sounds: Map<SoundType, HTMLAudioElement>;
  private config: SoundManagerConfig;
  private isInitialized: boolean;
  private volumeMultipliers: Map<SoundType, number>;

  constructor() {
    this.sounds = new Map();
    this.config = {
      enabled: true,
      volume: getSfxVolumeSetting(),
      basePath: './assets/sounds/'
    };
    this.isInitialized = false;

    // Sound-specific volume multipliers (relative to base volume)
    this.volumeMultipliers = new Map([
      [SoundType.SUCCESS, 0.4],   // Success sound - 20% volume
      [SoundType.ERROR, 0.2],     // Error sound - 10% volume
      [SoundType.CARD_PLACE, 1.0],
      [SoundType.CARD_SHUFFLE, 1.0],
      [SoundType.BUTTON_CLICK, 1.0],
    ]);

    logger.debug({ scope: 'sound/init', msg: 'SoundManager created' });
  }

  /**
   * Initialize sound manager and preload sounds
   */
  async init(): Promise<void> {
    try {
      logger.info({ scope: 'sound/init', msg: 'Initializing sound manager' });

      // Load sound effects
      await this.loadSound(SoundType.BUTTON_CLICK, 'button_single_click.wav');
      await this.loadSound(SoundType.CARD_SHUFFLE, 'card_shuffle_peak.wav');
      await this.loadSound(SoundType.CARD_PLACE, 'a_single_card_placed.wav');
      await this.loadSound(SoundType.SUCCESS, 'card_placed_right.wav');
      await this.loadSound(SoundType.ERROR, 'card_placed_wrong.wav');
      
      // Additional sounds can be loaded here in the future:
      // await this.loadSound(SoundType.CARD_FLIP, 'card_flip.wav');
      // await this.loadSound(SoundType.HOVER, 'hover.wav');

      this.isInitialized = true;
      logger.info({ 
        scope: 'sound/init', 
        msg: 'Sound manager initialized successfully',
        meta: { loadedSounds: this.sounds.size }
      });

    } catch (error) {
      logger.error({ 
        scope: 'sound/init', 
        msg: 'Failed to initialize sound manager', 
        err: { message: (error as Error).message } 
      });
    }
  }

  /**
   * Load a sound effect
   */
  private async loadSound(type: SoundType, filename: string): Promise<void> {
    try {
      const audio = new Audio();
      audio.src = `${this.config.basePath}${filename}`;
      audio.volume = this.config.volume;
      audio.preload = 'auto';

      // Wait for audio to be loaded
      await new Promise<void>((resolve, reject) => {
        audio.addEventListener('canplaythrough', () => {
          logger.debug({ 
            scope: 'sound/load', 
            msg: 'Sound loaded', 
            meta: { type, filename } 
          });
          resolve();
        }, { once: true });

        audio.addEventListener('error', (e) => {
          logger.warn({ 
            scope: 'sound/load', 
            msg: 'Failed to load sound', 
            meta: { type, filename, error: e } 
          });
          reject(new Error(`Failed to load sound: ${filename}`));
        }, { once: true });

        // Trigger load
        audio.load();
      });

      this.sounds.set(type, audio);

    } catch (error) {
      logger.error({ 
        scope: 'sound/load', 
        msg: 'Error loading sound', 
        err: { message: (error as Error).message, type, filename } 
      });
      throw error;
    }
  }

  /**
   * Play a sound effect
   */
  play(type: SoundType): void {
    try {
      if (!this.config.enabled) {
        logger.debug({ 
          scope: 'sound/play', 
          msg: 'Sound disabled, skipping playback',
          meta: { type }
        });
        return;
      }

      if (!this.isInitialized) {
        logger.warn({ 
          scope: 'sound/play', 
          msg: 'Sound manager not initialized',
          meta: { type }
        });
        return;
      }

      const sound = this.sounds.get(type);
      
      if (!sound) {
        logger.warn({ 
          scope: 'sound/play', 
          msg: 'Sound not found',
          meta: { type }
        });
        return;
      }

      // Clone and play to allow overlapping sounds
      const soundClone = sound.cloneNode(true) as HTMLAudioElement;
      
      // Apply sound-specific volume multiplier
      const multiplier = this.volumeMultipliers.get(type) || 1.0;
      soundClone.volume = Math.min(1.0, this.config.volume * multiplier);
      
      soundClone.play().catch(error => {
        logger.error({ 
          scope: 'sound/play', 
          msg: 'Failed to play sound', 
          err: { message: error.message, type } 
        });
      });

      logger.debug({ 
        scope: 'sound/play', 
        msg: 'Sound played',
        meta: { type, volume: soundClone.volume, multiplier }
      });

    } catch (error) {
      logger.error({ 
        scope: 'sound/play', 
        msg: 'Error playing sound', 
        err: { message: (error as Error).message, type } 
      });
    }
  }

  /**
   * Enable/disable sound effects
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    logger.info({ 
      scope: 'sound/config', 
      msg: 'Sound enabled state changed',
      meta: { enabled }
    });
  }

  /**
   * Set master volume (0.0 - 1.0)
   */
  setVolume(volume: number): void {
    this.config.volume = setSfxVolumeSetting(volume);
    
    // Update volume for all loaded sounds
    this.sounds.forEach(sound => {
      sound.volume = this.config.volume;
    });

    logger.info({ 
      scope: 'sound/config', 
      msg: 'Volume changed',
      meta: { volume: this.config.volume }
    });
  }

  /**
   * Get current volume
   */
  getVolume(): number {
    return this.config.volume;
  }

  /**
   * Check if sounds are enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Check if sound manager is initialized
   */
  getInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Play multiple sounds in sequence with delay
   * Useful for card dealing animations
   */
  playSequence(type: SoundType, count: number, delayMs: number = 200): void {
    try {
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          this.play(type);
        }, i * delayMs);
      }

      logger.debug({ 
        scope: 'sound/sequence', 
        msg: 'Sound sequence started',
        meta: { type, count, delayMs }
      });

    } catch (error) {
      logger.error({ 
        scope: 'sound/sequence', 
        msg: 'Failed to play sound sequence', 
        err: { message: (error as Error).message } 
      });
    }
  }
}

// Export singleton instance
export const soundManager = new SoundManager();
