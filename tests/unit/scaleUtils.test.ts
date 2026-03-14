import { describe, it, expect } from 'vitest';
import {
  calculateScale,
  calculateScaleFromWindow,
  calculateSnapThreshold,
  ScaleConfig,
} from '@/utils/scaleUtils';

// Mock the logger
import { vi } from 'vitest';
vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('scaleUtils', () => {
  describe('calculateScale', () => {
    it('should calculate correct scale for standard window (1920x1080)', () => {
      const scale = calculateScale(1920, 1080);
      expect(scale).toBe(1.0);
    });

    it('should calculate correct scale for smaller window', () => {
      const scale = calculateScale(960, 540);
      expect(scale).toBe(0.5);
    });

    it('should calculate correct scale for larger window', () => {
      const scale = calculateScale(3840, 2160);
      expect(scale).toBe(1.5); // Capped at maxScale
    });

    it('should use minimum of width and height ratios', () => {
      // Wide window: width ratio would be 2.0, height ratio would be 1.0
      const scale = calculateScale(3840, 1080);
      expect(scale).toBe(1.0); // Uses height ratio (smaller)
    });

    it('should respect custom baseWidth and baseHeight', () => {
      const config: ScaleConfig = {
        baseWidth: 1280,
        baseHeight: 720,
      };
      const scale = calculateScale(1280, 720, config);
      expect(scale).toBe(1.0);
    });

    it('should cap at maxScale', () => {
      const config: ScaleConfig = {
        maxScale: 2.0,
      };
      const scale = calculateScale(5000, 3000, config);
      expect(scale).toBe(2.0);
    });

    it('should respect minScale', () => {
      const config: ScaleConfig = {
        minScale: 0.3,
      };
      const scale = calculateScale(400, 300, config);
      expect(scale).toBe(0.3); // Should be clamped to minScale
    });

    it('should handle very small windows', () => {
      const scale = calculateScale(640, 480);
      expect(scale).toBeGreaterThanOrEqual(0.5); // Min scale
      expect(scale).toBeLessThanOrEqual(1.5); // Max scale
    });

    it('should handle very large windows', () => {
      const scale = calculateScale(5120, 2880);
      expect(scale).toBe(1.5); // Capped at maxScale
    });

    it('should handle non-standard aspect ratios', () => {
      // Ultra-wide
      const wideScale = calculateScale(2560, 1080);
      expect(wideScale).toBe(1.0); // Limited by height

      // Ultra-tall
      const tallScale = calculateScale(1080, 2560);
      expect(tallScale).toBeCloseTo(0.5625, 4); // Limited by width: 1080/1920 = 0.5625
    });
  });

  describe('calculateScaleFromWindow', () => {
    it('should calculate scale from window object', () => {
      const mockWindow = {
        innerWidth: 1920,
        innerHeight: 1080,
      } as Window;

      const scale = calculateScaleFromWindow(mockWindow);
      expect(scale).toBe(1.0);
    });

    it('should respect custom config when using window', () => {
      const mockWindow = {
        innerWidth: 2560,
        innerHeight: 1440,
      } as Window;

      const config: ScaleConfig = {
        baseWidth: 1280,
        baseHeight: 720,
        maxScale: 2.5, // Increase maxScale to allow 2.0
      };

      const scale = calculateScaleFromWindow(mockWindow, config);
      expect(scale).toBe(2.0); // 2560/1280 = 2.0, 1440/720 = 2.0, min is 2.0
    });
  });

  describe('calculateSnapThreshold', () => {
    it('should calculate snap threshold with default base', () => {
      const threshold = calculateSnapThreshold(1.0);
      expect(threshold).toBe(80);
    });

    it('should scale threshold correctly', () => {
      const threshold = calculateSnapThreshold(0.5);
      expect(threshold).toBe(40);
    });

    it('should scale threshold for larger scale', () => {
      const threshold = calculateSnapThreshold(1.5);
      expect(threshold).toBe(120);
    });

    it('should use custom base threshold', () => {
      const threshold = calculateSnapThreshold(1.0, 100);
      expect(threshold).toBe(100);
    });

    it('should handle zero scale', () => {
      const threshold = calculateSnapThreshold(0);
      expect(threshold).toBe(0);
    });

    it('should handle very small scale', () => {
      const threshold = calculateSnapThreshold(0.1);
      expect(threshold).toBe(8);
    });
  });
});
