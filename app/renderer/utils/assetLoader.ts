import { logger } from '@/utils/logger';
import { convertImageToWhite } from '@/utils/canvasUtils';

/**
 * Asset loading result
 */
export interface LoadedAsset {
  image: HTMLImageElement;
  width: number;
  height: number;
}

/**
 * Asset loading options
 */
export interface AssetLoadOptions {
  /** Whether to convert the image to white after loading */
  convertToWhite?: boolean;
  /** Timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Scope for logging */
  scope?: string;
}

const DEFAULT_TIMEOUT = 10000;

/**
 * Load a single image asset with promise-based API
 * @param src - Image source path
 * @param options - Loading options
 * @returns Promise resolving to loaded asset or null on failure
 */
export async function loadImage(
  src: string,
  options: AssetLoadOptions = {},
): Promise<LoadedAsset | null> {
  const {
    convertToWhite = false,
    timeout = DEFAULT_TIMEOUT,
    scope = 'utils/assetLoader',
  } = options;

  return new Promise((resolve) => {
    const img = new Image();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    img.onload = async () => {
      cleanup();
      logger.debug({
        scope,
        msg: 'image loaded successfully',
        meta: { src, width: img.width, height: img.height },
      });

      try {
        if (convertToWhite) {
          const whiteImage = await convertImageToWhite(img);
          logger.debug({ scope, msg: 'image converted to white', meta: { src } });
          resolve({
            image: whiteImage,
            width: whiteImage.width,
            height: whiteImage.height,
          });
        } else {
          resolve({
            image: img,
            width: img.width,
            height: img.height,
          });
        }
      } catch (err: any) {
        logger.warn({
          scope,
          msg: 'failed to convert image to white',
          meta: { src },
          err: { message: err.message },
        });
        // Return original image if conversion fails
        resolve({
          image: img,
          width: img.width,
          height: img.height,
        });
      }
    };

    img.onerror = () => {
      cleanup();
      logger.warn({ scope, msg: 'failed to load image', meta: { src } });
      resolve(null);
    };

    // Set timeout
    timeoutId = setTimeout(() => {
      logger.warn({ scope, msg: 'image load timeout', meta: { src, timeout } });
      resolve(null);
    }, timeout);

    try {
      img.src = src;
    } catch (error: any) {
      cleanup();
      logger.error({
        scope,
        msg: 'failed to set image source',
        meta: { src },
        err: { message: error.message, stack: error.stack },
      });
      resolve(null);
    }
  });
}

/**
 * Load multiple images in parallel
 * @param sources - Array of image sources with optional individual options
 * @param defaultOptions - Default options for all images
 * @returns Promise resolving to array of loaded assets (null for failed loads)
 */
export async function loadImages(
  sources: Array<{ src: string; options?: AssetLoadOptions }>,
  defaultOptions: AssetLoadOptions = {},
): Promise<Array<LoadedAsset | null>> {
  const promises = sources.map(({ src, options }) => loadImage(src, { ...defaultOptions, ...options }));

  return Promise.all(promises);
}

/**
 * Preload an array of image paths without returning results
 * Useful for caching images before they're needed
 * @param paths - Array of image paths to preload
 * @param options - Loading options
 * @returns Promise that resolves when all images are loaded (or failed)
 */
export async function preloadImages(
  paths: string[],
  options: AssetLoadOptions = {},
): Promise<void> {
  const scope = options.scope ?? 'utils/assetLoader';
  logger.debug({ scope, msg: 'preloading images', meta: { count: paths.length } });

  await loadImages(
    paths.map((src) => ({ src })),
    options,
  );

  logger.debug({ scope, msg: 'preload complete', meta: { count: paths.length } });
}

/**
 * Asset manager for caching loaded assets
 */
export class AssetManager {
  private cache: Map<string, LoadedAsset> = new Map();

  private loading: Map<string, Promise<LoadedAsset | null>> = new Map();

  private scope: string;

  constructor(scope = 'utils/assetManager') {
    this.scope = scope;
  }

  /**
   * Get a cached asset or load it if not cached
   * @param src - Image source path
   * @param options - Loading options
   * @returns Promise resolving to loaded asset or null
   */
  async get(src: string, options: AssetLoadOptions = {}): Promise<LoadedAsset | null> {
    // Check cache first
    const cached = this.cache.get(src);
    if (cached) {
      logger.debug({ scope: this.scope, msg: 'cache hit', meta: { src } });
      return cached;
    }

    // Check if already loading
    const existing = this.loading.get(src);
    if (existing) {
      logger.debug({ scope: this.scope, msg: 'waiting for existing load', meta: { src } });
      return existing;
    }

    // Start loading
    const loadPromise = loadImage(src, { ...options, scope: this.scope });
    this.loading.set(src, loadPromise);

    try {
      const asset = await loadPromise;
      if (asset) {
        this.cache.set(src, asset);
      }
      return asset;
    } finally {
      this.loading.delete(src);
    }
  }

  /**
   * Preload multiple assets into cache
   * @param sources - Array of image sources
   * @param options - Loading options
   */
  async preload(sources: string[], options: AssetLoadOptions = {}): Promise<void> {
    await Promise.all(sources.map((src) => this.get(src, options)));
  }

  /**
   * Check if an asset is cached
   * @param src - Image source path
   */
  has(src: string): boolean {
    return this.cache.has(src);
  }

  /**
   * Clear a specific asset from cache
   * @param src - Image source path
   */
  remove(src: string): void {
    this.cache.delete(src);
  }

  /**
   * Clear all cached assets
   */
  clear(): void {
    this.cache.clear();
    logger.debug({ scope: this.scope, msg: 'cache cleared' });
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

/**
 * Default global asset manager instance
 */
export const assetManager = new AssetManager('renderer/assets');
