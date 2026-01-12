import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadImage,
  loadImages,
  preloadImages,
  AssetManager,
} from '@/utils/assetLoader';

// Mock the logger
vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the canvasUtils convertImageToWhite function
vi.mock('@/utils/canvasUtils', () => ({
  convertImageToWhite: vi.fn().mockImplementation((img: HTMLImageElement) => {
    // Return a new image with same dimensions
    const newImg = new Image();
    newImg.width = img.width;
    newImg.height = img.height;
    return Promise.resolve(newImg);
  }),
}));

describe('assetLoader', () => {
  // Store original Image constructor
  const OriginalImage = window.Image;

  // Mock Image class
  class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    _src = '';
    width = 100;
    height = 100;

    set src(value: string) {
      this._src = value;
      // Simulate async image loading
      if (value.includes('fail')) {
        setTimeout(() => this.onerror?.(), 10);
      } else if (value.includes('timeout')) {
        // Don't call any callback - simulate timeout
      } else {
        setTimeout(() => this.onload?.(), 10);
      }
    }

    get src() {
      return this._src;
    }
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Replace Image constructor
    window.Image = MockImage as unknown as typeof Image;
  });

  afterEach(() => {
    vi.useRealTimers();
    // Restore original Image
    window.Image = OriginalImage;
  });

  describe('loadImage', () => {
    it('should load an image successfully', async () => {
      const promise = loadImage('./assets/test.png');

      // Fast-forward timers to trigger onload
      await vi.advanceTimersByTimeAsync(50);

      const result = await promise;

      expect(result).not.toBeNull();
      expect(result?.image).toBeDefined();
      expect(result?.width).toBe(100);
      expect(result?.height).toBe(100);
    });

    it('should return null when image fails to load', async () => {
      const promise = loadImage('./assets/fail.png');

      // Fast-forward timers to trigger onerror
      await vi.advanceTimersByTimeAsync(50);

      const result = await promise;

      expect(result).toBeNull();
    });

    it('should return null on timeout', async () => {
      const promise = loadImage('./assets/timeout.png', { timeout: 100 });

      // Fast-forward past the timeout
      await vi.advanceTimersByTimeAsync(150);

      const result = await promise;

      expect(result).toBeNull();
    });

    it('should use default timeout of 10000ms', async () => {
      const promise = loadImage('./assets/timeout.png');

      // Advance just before timeout - should still be loading
      await vi.advanceTimersByTimeAsync(9000);

      // Advance past timeout
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(result).toBeNull();
    });

    it('should convert image to white when option is set', async () => {
      const { convertImageToWhite } = await import('@/utils/canvasUtils');

      const promise = loadImage('./assets/arrow.png', { convertToWhite: true });

      await vi.advanceTimersByTimeAsync(50);

      const result = await promise;

      expect(result).not.toBeNull();
      expect(convertImageToWhite).toHaveBeenCalled();
    });

    it('should return original image if white conversion fails', async () => {
      const { convertImageToWhite } = await import('@/utils/canvasUtils');
      vi.mocked(convertImageToWhite).mockRejectedValueOnce(new Error('Conversion failed'));

      const promise = loadImage('./assets/arrow.png', { convertToWhite: true });

      await vi.advanceTimersByTimeAsync(50);

      const result = await promise;

      // Should still return the original image
      expect(result).not.toBeNull();
      expect(result?.width).toBe(100);
    });

    it('should use custom scope for logging', async () => {
      const { logger } = await import('@/utils/logger');

      const promise = loadImage('./assets/test.png', { scope: 'custom/scope' });

      await vi.advanceTimersByTimeAsync(50);

      await promise;

      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ scope: 'custom/scope' }),
      );
    });
  });

  describe('loadImages', () => {
    it('should load multiple images in parallel', async () => {
      const sources = [
        { src: './assets/image1.png' },
        { src: './assets/image2.png' },
        { src: './assets/image3.png' },
      ];

      const promise = loadImages(sources);

      await vi.advanceTimersByTimeAsync(50);

      const results = await promise;

      expect(results).toHaveLength(3);
      expect(results.every((r) => r !== null)).toBe(true);
    });

    it('should handle mixed success and failure', async () => {
      const sources = [
        { src: './assets/success.png' },
        { src: './assets/fail.png' },
        { src: './assets/success2.png' },
      ];

      const promise = loadImages(sources);

      await vi.advanceTimersByTimeAsync(50);

      const results = await promise;

      expect(results).toHaveLength(3);
      expect(results[0]).not.toBeNull();
      expect(results[1]).toBeNull();
      expect(results[2]).not.toBeNull();
    });

    it('should merge individual options with defaults', async () => {
      const { convertImageToWhite } = await import('@/utils/canvasUtils');

      const sources = [
        { src: './assets/image1.png' }, // Use default
        { src: './assets/image2.png', options: { convertToWhite: true } },
      ];

      const promise = loadImages(sources, { scope: 'test' });

      await vi.advanceTimersByTimeAsync(50);

      await promise;

      // Only the second image should be converted to white
      expect(convertImageToWhite).toHaveBeenCalledTimes(1);
    });
  });

  describe('preloadImages', () => {
    it('should preload all images without returning results', async () => {
      const { logger } = await import('@/utils/logger');

      const paths = [
        './assets/preload1.png',
        './assets/preload2.png',
      ];

      const promise = preloadImages(paths);

      await vi.advanceTimersByTimeAsync(50);

      await promise;

      // Should log preload start and complete
      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ msg: 'preloading images' }),
      );
      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ msg: 'preload complete' }),
      );
    });
  });

  describe('AssetManager', () => {
    let manager: AssetManager;

    beforeEach(() => {
      manager = new AssetManager('test/manager');
    });

    it('should load and cache an asset', async () => {
      const promise = manager.get('./assets/cached.png');

      await vi.advanceTimersByTimeAsync(50);

      const result = await promise;

      expect(result).not.toBeNull();
      expect(manager.has('./assets/cached.png')).toBe(true);
    });

    it('should return cached asset on subsequent calls', async () => {
      // First load
      const promise1 = manager.get('./assets/cached.png');
      await vi.advanceTimersByTimeAsync(50);
      const result1 = await promise1;

      // Second load - should use cache
      const promise2 = manager.get('./assets/cached.png');
      const result2 = await promise2;

      expect(result1).toBe(result2);
    });

    it('should not load same image twice when loading in parallel', async () => {
      // Start two loads at the same time
      const promise1 = manager.get('./assets/parallel.png');
      const promise2 = manager.get('./assets/parallel.png');

      await vi.advanceTimersByTimeAsync(50);

      const result1 = await promise1;
      const result2 = await promise2;

      // Both should return the same cached result
      expect(result1).toBe(result2);
    });

    it('should preload multiple assets', async () => {
      const sources = [
        './assets/preload1.png',
        './assets/preload2.png',
      ];

      const preloadPromise = manager.preload(sources);

      await vi.advanceTimersByTimeAsync(50);

      await preloadPromise;

      expect(manager.has('./assets/preload1.png')).toBe(true);
      expect(manager.has('./assets/preload2.png')).toBe(true);
    });

    it('should remove a specific asset from cache', async () => {
      const promise = manager.get('./assets/remove.png');
      await vi.advanceTimersByTimeAsync(50);
      await promise;

      expect(manager.has('./assets/remove.png')).toBe(true);

      manager.remove('./assets/remove.png');

      expect(manager.has('./assets/remove.png')).toBe(false);
    });

    it('should clear all cached assets', async () => {
      // Load multiple assets
      const promise1 = manager.get('./assets/clear1.png');
      const promise2 = manager.get('./assets/clear2.png');

      await vi.advanceTimersByTimeAsync(50);

      await promise1;
      await promise2;

      expect(manager.getStats().size).toBe(2);

      manager.clear();

      expect(manager.getStats().size).toBe(0);
    });

    it('should return cache statistics', async () => {
      const promise = manager.get('./assets/stats.png');
      await vi.advanceTimersByTimeAsync(50);
      await promise;

      const stats = manager.getStats();

      expect(stats.size).toBe(1);
      expect(stats.keys).toContain('./assets/stats.png');
    });

    it('should not cache failed loads', async () => {
      const promise = manager.get('./assets/fail.png');
      await vi.advanceTimersByTimeAsync(50);
      const result = await promise;

      expect(result).toBeNull();
      expect(manager.has('./assets/fail.png')).toBe(false);
    });
  });
});
