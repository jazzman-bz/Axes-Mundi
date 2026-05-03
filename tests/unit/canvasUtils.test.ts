import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { drawRoundedRect, wrapText, convertImageToWhite } from '@/utils/canvasUtils';

// Mock the logger
vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe('canvasUtils', () => {
  describe('drawRoundedRect', () => {
    let mockCtx: CanvasRenderingContext2D;

    beforeEach(() => {
      mockCtx = {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
      } as unknown as CanvasRenderingContext2D;
    });

    it('should draw a rounded rectangle with correct path', () => {
      drawRoundedRect(mockCtx, 10, 20, 100, 50, 5);

      expect(mockCtx.beginPath).toHaveBeenCalledTimes(1);
      expect(mockCtx.moveTo).toHaveBeenCalledWith(15, 20); // x + radius
      expect(mockCtx.lineTo).toHaveBeenCalledTimes(4);
      expect(mockCtx.quadraticCurveTo).toHaveBeenCalledTimes(4);
      expect(mockCtx.closePath).toHaveBeenCalledTimes(1);
      expect(mockCtx.fill).toHaveBeenCalledTimes(1);
    });

    it('should cap radius to half the smallest dimension', () => {
      // Width = 20, height = 10, so max safe radius = 5
      drawRoundedRect(mockCtx, 0, 0, 20, 10, 100);

      // Should use radius 5 (half of height), not 100
      expect(mockCtx.moveTo).toHaveBeenCalledWith(5, 0);
    });

    it('should handle zero dimensions gracefully', () => {
      drawRoundedRect(mockCtx, 0, 0, 0, 0, 10);

      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.fill).toHaveBeenCalled();
    });

    it('should use original radius when smaller than dimensions', () => {
      // Width = 200, height = 100, radius = 10 should stay 10
      drawRoundedRect(mockCtx, 0, 0, 200, 100, 10);

      expect(mockCtx.moveTo).toHaveBeenCalledWith(10, 0); // x + radius = 0 + 10
    });

    it('should handle negative coordinates', () => {
      drawRoundedRect(mockCtx, -50, -50, 100, 100, 10);

      expect(mockCtx.moveTo).toHaveBeenCalledWith(-40, -50); // -50 + 10
    });
  });

  describe('wrapText', () => {
    let mockCtx: CanvasRenderingContext2D;

    beforeEach(() => {
      mockCtx = {
        measureText: vi.fn((text: string) => ({
          width: text.length * 10, // Simulate 10px per character
        })),
      } as unknown as CanvasRenderingContext2D;
    });

    it('should return single line if text fits', () => {
      const result = wrapText('Hello', 100, mockCtx);

      expect(result).toEqual(['Hello']);
    });

    it('should wrap text that exceeds maxWidth', () => {
      // "Hello World" = 11 chars * 10px = 110px
      // maxWidth = 60, so should wrap
      const result = wrapText('Hello World', 60, mockCtx);

      expect(result).toEqual(['Hello', 'World']);
    });

    it('should handle multiple wraps', () => {
      const result = wrapText('One Two Three Four', 40, mockCtx);

      expect(result).toEqual(['One', 'Two', 'Three', 'Four']);
    });

    it('should return empty array for empty string', () => {
      const result = wrapText('', 100, mockCtx);

      expect(result).toEqual([]);
    });

    it('should return original text in array for zero maxWidth', () => {
      const result = wrapText('Hello', 0, mockCtx);

      expect(result).toEqual(['Hello']);
    });

    it('should handle long words that exceed maxWidth', () => {
      // Single word longer than maxWidth
      const result = wrapText('Supercalifragilistic', 50, mockCtx);

      // Should still return the word (can't be split further)
      expect(result).toEqual(['Supercalifragilistic']);
    });

    it('should handle multiple spaces correctly', () => {
      const result = wrapText('Hello  World', 200, mockCtx);

      // Multiple spaces create empty string "words" which get filtered out
      // This is acceptable behavior - spaces collapse when wrapped
      expect(result).toEqual(['Hello  World']);
    });

    it('should preserve word order', () => {
      const result = wrapText('The quick brown fox jumps', 100, mockCtx);

      // Verify order is maintained
      expect(result[0]).toBe('The quick');
      expect(result[1]).toBe('brown fox');
      expect(result[2]).toBe('jumps');
    });
  });

  describe('convertImageToWhite', () => {
    it('should reject if image is not loaded', async () => {
      const mockImage = {
        complete: false,
        width: 0,
      } as HTMLImageElement;

      await expect(convertImageToWhite(mockImage)).rejects.toThrow(
        'Image not loaded or has zero dimensions',
      );
    });

    it('should reject if image has zero width', async () => {
      const mockImage = {
        complete: true,
        width: 0,
        height: 100,
      } as HTMLImageElement;

      await expect(convertImageToWhite(mockImage)).rejects.toThrow(
        'Image not loaded or has zero dimensions',
      );
    });

    // Note: Full DOM-based tests for convertImageToWhite require
    // jsdom environment with canvas support (canvas npm package).
    // These tests verify error handling. Full integration testing
    // should be done in E2E tests with a real browser environment.

    it('should reject if canvas context is unavailable', async () => {
      // Create a mock image that appears loaded but we can't get canvas context
      const mockImage = {
        complete: true,
        width: 100,
        height: 100,
      } as HTMLImageElement;

      // jsdom without canvas package returns null for getContext('2d')
      // This tests the error handling path
      await expect(convertImageToWhite(mockImage)).rejects.toThrow(
        'Could not get canvas 2D context',
      );
    });
  });
});
