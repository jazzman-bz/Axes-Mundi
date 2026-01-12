import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ResizeHandler, ResizeCallback } from '@/utils/resizeHandler';

// Mock the logger
vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock scaleUtils
vi.mock('@/utils/scaleUtils', () => ({
  calculateScale: vi.fn((width: number, height: number) => {
    // Simple mock: return width/1920 for testing
    return Math.min(width / 1920, height / 1080, 1.5);
  }),
  calculateScaleFromWindow: vi.fn((win: Window) => {
    return Math.min(win.innerWidth / 1920, win.innerHeight / 1080, 1.5);
  }),
}));

describe('ResizeHandler', () => {
  let canvas: HTMLCanvasElement;
  let mockWindow: Window;

  beforeEach(() => {
    vi.useFakeTimers();

    // Create mock canvas
    canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    // Create mock window
    mockWindow = {
      innerWidth: 1920,
      innerHeight: 1080,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Window;

    // Replace global window
    Object.defineProperty(global, 'window', {
      value: mockWindow,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create ResizeHandler with default options', () => {
      const handler = new ResizeHandler(canvas);
      expect(handler.scale).toBe(1.0);
    });

    it('should create ResizeHandler with custom options', () => {
      const handler = new ResizeHandler(canvas, {
        debounceMs: 200,
        scope: 'test/scope',
        baseWidth: 1280,
      });
      expect(handler.scale).toBe(1.0);
    });

    it('should calculate initial scale from window', () => {
      mockWindow.innerWidth = 960;
      mockWindow.innerHeight = 540;

      const handler = new ResizeHandler(canvas);
      expect(handler.scale).toBeCloseTo(0.5, 1);
    });
  });

  describe('handleResize', () => {
    it('should debounce resize calls', async () => {
      const handler = new ResizeHandler(canvas, { debounceMs: 100 });
      const callback = vi.fn();
      handler.onResize(callback);

      // Trigger multiple rapid resizes
      handler.handleResize();
      handler.handleResize();
      handler.handleResize();

      // Should not have been called yet
      expect(callback).not.toHaveBeenCalled();

      // Fast-forward past debounce delay
      await vi.advanceTimersByTimeAsync(150);

      // Should have been called only once
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should update canvas dimensions on resize', async () => {
      const handler = new ResizeHandler(canvas);
      mockWindow.innerWidth = 1280;
      mockWindow.innerHeight = 720;

      handler.handleResize();
      await vi.advanceTimersByTimeAsync(150);

      expect(canvas.width).toBe(1280);
      expect(canvas.height).toBe(720);
    });

    it('should recalculate scale on resize', async () => {
      const handler = new ResizeHandler(canvas);
      mockWindow.innerWidth = 960;
      mockWindow.innerHeight = 540;

      handler.handleResize();
      await vi.advanceTimersByTimeAsync(150);

      expect(handler.scale).toBeCloseTo(0.5, 1);
    });
  });

  describe('onResize', () => {
    it('should register callback and call it on resize', async () => {
      const handler = new ResizeHandler(canvas);
      const callback = vi.fn();
      handler.onResize(callback);

      handler.handleResize();
      await vi.advanceTimersByTimeAsync(150);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({
        width: 1920,
        height: 1080,
        scale: expect.any(Number),
      });
    });

    it('should support multiple callbacks', async () => {
      const handler = new ResizeHandler(canvas);
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      handler.onResize(callback1);
      handler.onResize(callback2);

      handler.handleResize();
      await vi.advanceTimersByTimeAsync(150);

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should return unsubscribe function', async () => {
      const handler = new ResizeHandler(canvas);
      const callback = vi.fn();
      const unsubscribe = handler.onResize(callback);

      handler.handleResize();
      await vi.advanceTimersByTimeAsync(150);

      expect(callback).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      handler.handleResize();
      await vi.advanceTimersByTimeAsync(150);

      // Should not be called again
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle callback errors gracefully', async () => {
      const handler = new ResizeHandler(canvas);
      const errorCallback: ResizeCallback = () => {
        throw new Error('Callback error');
      };

      handler.onResize(errorCallback);

      // Should not throw
      handler.handleResize();
      await vi.advanceTimersByTimeAsync(150);

      // Should have logged error
      const { logger } = await import('@/utils/logger');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('attach', () => {
    it('should attach window resize listener', () => {
      const handler = new ResizeHandler(canvas);
      handler.attach();

      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        'resize',
        expect.any(Function),
      );
    });

    it('should perform initial resize on attach', async () => {
      const handler = new ResizeHandler(canvas);
      const callback = vi.fn();
      handler.onResize(callback);

      handler.attach();
      await vi.advanceTimersByTimeAsync(150);

      expect(callback).toHaveBeenCalled();
    });

    it('should not attach twice', () => {
      const handler = new ResizeHandler(canvas);
      handler.attach();
      handler.attach();

      // Should only be called once
      expect(mockWindow.addEventListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('detach', () => {
    it('should detach window resize listener', () => {
      const handler = new ResizeHandler(canvas);
      handler.attach();
      handler.detach();

      expect(mockWindow.removeEventListener).toHaveBeenCalledWith(
        'resize',
        expect.any(Function),
      );
    });

    it('should not detach if not attached', () => {
      const handler = new ResizeHandler(canvas);
      handler.detach();

      expect(mockWindow.removeEventListener).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should detach and cleanup on destroy', () => {
      const handler = new ResizeHandler(canvas);
      const callback = vi.fn();
      handler.onResize(callback);
      handler.attach();

      handler.destroy();

      expect(mockWindow.removeEventListener).toHaveBeenCalled();
    });

    it('should clear all callbacks on destroy', async () => {
      const handler = new ResizeHandler(canvas);
      const callback = vi.fn();
      handler.onResize(callback);
      handler.attach();

      // Wait for initial resize from attach
      await vi.advanceTimersByTimeAsync(150);
      const initialCallCount = callback.mock.calls.length;

      handler.destroy();

      handler.handleResize();
      await vi.advanceTimersByTimeAsync(150);

      // Callback should not be called after destroy (only initial calls from attach)
      expect(callback).toHaveBeenCalledTimes(initialCallCount);
    });

    it('should clear debounce timer on destroy', () => {
      const handler = new ResizeHandler(canvas);
      handler.handleResize();

      handler.destroy();

      // Timer should be cleared, no errors should occur
      vi.advanceTimersByTime(200);
    });
  });

  describe('scale getter', () => {
    it('should return current scale', () => {
      const handler = new ResizeHandler(canvas);
      expect(handler.scale).toBe(1.0);
    });

    it('should return updated scale after resize', async () => {
      const handler = new ResizeHandler(canvas);
      mockWindow.innerWidth = 960;
      mockWindow.innerHeight = 540;

      handler.handleResize();
      await vi.advanceTimersByTimeAsync(150);

      expect(handler.scale).toBeCloseTo(0.5, 1);
    });
  });
});
