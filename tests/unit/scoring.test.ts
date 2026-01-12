import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isAxisCorrectlySorted,
  evaluatePlacement,
  convertToComparable,
  getScore,
} from '@/data/scoring';
import { Card } from '@/data/types';

// Mock the logger
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

/**
 * Helper to create test cards with default values
 */
function createCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'test-card',
    title: 'Test Card',
    axis: 'height',
    value: 100,
    unit: 'm',
    displayValue: '100 m',
    image: 'test.jpg',
    facts: ['Test fact'],
    sources: [{ label: 'Test', url: 'https://test.com' }],
    difficulty: 'medium',
    ...overrides,
  };
}

describe('scoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('convertToComparable', () => {
    describe('height units', () => {
      it('should return meters as-is', () => {
        expect(convertToComparable(100, 'm')).toBe(100);
        expect(convertToComparable(0, 'm')).toBe(0);
        expect(convertToComparable(-50, 'm')).toBe(-50);
      });

      it('should convert kilometers to meters', () => {
        expect(convertToComparable(1, 'km')).toBe(1000);
        expect(convertToComparable(0.5, 'km')).toBe(500);
        expect(convertToComparable(2.5, 'km')).toBe(2500);
      });

      it('should convert centimeters to meters', () => {
        expect(convertToComparable(100, 'cm')).toBe(1);
        expect(convertToComparable(50, 'cm')).toBe(0.5);
        expect(convertToComparable(250, 'cm')).toBe(2.5);
      });

      it('should convert millimeters to meters', () => {
        expect(convertToComparable(1000, 'mm')).toBe(1);
        expect(convertToComparable(500, 'mm')).toBe(0.5);
        expect(convertToComparable(2500, 'mm')).toBe(2.5);
      });
    });

    describe('time units', () => {
      it('should handle BC dates (values passed through)', () => {
        expect(convertToComparable(-500, 'bc')).toBe(-500);
        expect(convertToComparable(-2000, 'BC')).toBe(-2000);
        expect(convertToComparable(0, 'bc')).toBe(0);
      });

      it('should handle AD dates (values passed through)', () => {
        expect(convertToComparable(1990, 'ad')).toBe(1990);
        expect(convertToComparable(2025, 'AD')).toBe(2025);
        expect(convertToComparable(1, 'ad')).toBe(1);
      });

      it('should allow BC and AD to sort correctly', () => {
        // BC dates should be smaller (earlier) than AD dates
        const bcValue = convertToComparable(-500, 'bc');
        const adValue = convertToComparable(500, 'ad');
        expect(bcValue).toBeLessThan(adValue);
      });
    });

    describe('temperature units', () => {
      it('should handle Celsius with degree symbol', () => {
        expect(convertToComparable(25, '°c')).toBe(25);
        expect(convertToComparable(-40, '°c')).toBe(-40);
        expect(convertToComparable(100, '°c')).toBe(100);
      });

      it('should handle Celsius without degree symbol', () => {
        expect(convertToComparable(25, 'c')).toBe(25);
        expect(convertToComparable(-273, 'c')).toBe(-273);
      });

      it('should handle uppercase C', () => {
        expect(convertToComparable(100, 'C')).toBe(100);
      });
    });

    describe('unknown units', () => {
      it('should return value as-is for unknown units', () => {
        expect(convertToComparable(42, 'unknown')).toBe(42);
        expect(convertToComparable(3.14, 'parsecs')).toBe(3.14);
        expect(convertToComparable(100, 'lightyears')).toBe(100);
      });
    });

    describe('case insensitivity', () => {
      it('should handle uppercase units', () => {
        expect(convertToComparable(1, 'KM')).toBe(1000);
        expect(convertToComparable(100, 'CM')).toBe(1);
        expect(convertToComparable(1000, 'MM')).toBe(1);
      });

      it('should handle mixed case units', () => {
        expect(convertToComparable(1, 'Km')).toBe(1000);
        expect(convertToComparable(100, 'Cm')).toBe(1);
      });
    });

    describe('edge cases', () => {
      it('should handle zero values', () => {
        expect(convertToComparable(0, 'm')).toBe(0);
        expect(convertToComparable(0, 'km')).toBe(0);
        expect(convertToComparable(0, '°c')).toBe(0);
      });

      it('should handle very large values', () => {
        expect(convertToComparable(1000000, 'km')).toBe(1000000000);
      });

      it('should handle very small values', () => {
        expect(convertToComparable(0.001, 'km')).toBe(1);
      });

      it('should handle negative values', () => {
        expect(convertToComparable(-100, 'm')).toBe(-100);
        expect(convertToComparable(-1, 'km')).toBe(-1000);
      });
    });
  });

  describe('isAxisCorrectlySorted', () => {
    it('should return true for empty array', () => {
      expect(isAxisCorrectlySorted([])).toBe(true);
    });

    it('should return true for single card', () => {
      const cards = [createCard({ value: 100 })];
      expect(isAxisCorrectlySorted(cards)).toBe(true);
    });

    it('should return true for two cards in correct order', () => {
      const cards = [
        createCard({ value: 50, title: 'Small' }),
        createCard({ value: 100, title: 'Large' }),
      ];
      expect(isAxisCorrectlySorted(cards)).toBe(true);
    });

    it('should return true for correctly sorted cards', () => {
      const cards = [
        createCard({ value: 10, title: 'Small' }),
        createCard({ value: 50, title: 'Medium' }),
        createCard({ value: 100, title: 'Large' }),
      ];
      expect(isAxisCorrectlySorted(cards)).toBe(true);
    });

    it('should return false for incorrectly sorted cards', () => {
      const cards = [
        createCard({ value: 100, title: 'Large' }),
        createCard({ value: 10, title: 'Small' }),
      ];
      expect(isAxisCorrectlySorted(cards)).toBe(false);
    });

    it('should return false when middle card is out of order', () => {
      const cards = [
        createCard({ value: 10, title: 'Small' }),
        createCard({ value: 100, title: 'Large' }), // Out of order
        createCard({ value: 50, title: 'Medium' }),
      ];
      expect(isAxisCorrectlySorted(cards)).toBe(false);
    });

    it('should handle mixed units correctly', () => {
      const cards = [
        createCard({ value: 50, unit: 'cm', title: '50cm' }),   // 0.5m
        createCard({ value: 1, unit: 'm', title: '1m' }),        // 1m
        createCard({ value: 0.002, unit: 'km', title: '2m' }),   // 2m
      ];
      expect(isAxisCorrectlySorted(cards)).toBe(true);
    });

    it('should return false for mixed units in wrong order', () => {
      const cards = [
        createCard({ value: 1, unit: 'km', title: '1km' }),      // 1000m
        createCard({ value: 100, unit: 'm', title: '100m' }),    // 100m (smaller!)
      ];
      expect(isAxisCorrectlySorted(cards)).toBe(false);
    });

    it('should return true for equal values', () => {
      const cards = [
        createCard({ value: 100, title: 'First' }),
        createCard({ value: 100, title: 'Second' }),
      ];
      expect(isAxisCorrectlySorted(cards)).toBe(true);
    });

    it('should handle many cards', () => {
      const cards = Array.from({ length: 10 }, (_, i) =>
        createCard({ value: i * 10, title: `Card ${i}` }),
      );
      expect(isAxisCorrectlySorted(cards)).toBe(true);
    });

    it('should handle time-based cards with BC/AD', () => {
      const cards = [
        createCard({ value: -500, unit: 'bc', title: '500 BC' }),
        createCard({ value: -100, unit: 'bc', title: '100 BC' }),
        createCard({ value: 100, unit: 'ad', title: '100 AD' }),
        createCard({ value: 2000, unit: 'ad', title: '2000 AD' }),
      ];
      expect(isAxisCorrectlySorted(cards)).toBe(true);
    });

    it('should handle temperature cards', () => {
      const cards = [
        createCard({ value: -273, unit: '°c', title: 'Absolute Zero' }),
        createCard({ value: 0, unit: '°c', title: 'Freezing' }),
        createCard({ value: 100, unit: '°c', title: 'Boiling' }),
      ];
      expect(isAxisCorrectlySorted(cards)).toBe(true);
    });
  });

  describe('evaluatePlacement', () => {
    const centerCard = createCard({ value: 100, title: 'Center', unit: 'm' });

    describe('left placement', () => {
      it('should return true for smaller card placed left', () => {
        const smallCard = createCard({ value: 50, title: 'Small' });
        expect(evaluatePlacement(smallCard, centerCard, true)).toBe(true);
      });

      it('should return true for equal value card placed left', () => {
        const equalCard = createCard({ value: 100, title: 'Equal' });
        expect(evaluatePlacement(equalCard, centerCard, true)).toBe(true);
      });

      it('should return false for larger card placed left', () => {
        const largeCard = createCard({ value: 150, title: 'Large' });
        expect(evaluatePlacement(largeCard, centerCard, true)).toBe(false);
      });
    });

    describe('right placement', () => {
      it('should return true for larger card placed right', () => {
        const largeCard = createCard({ value: 150, title: 'Large' });
        expect(evaluatePlacement(largeCard, centerCard, false)).toBe(true);
      });

      it('should return true for equal value card placed right', () => {
        const equalCard = createCard({ value: 100, title: 'Equal' });
        expect(evaluatePlacement(equalCard, centerCard, false)).toBe(true);
      });

      it('should return false for smaller card placed right', () => {
        const smallCard = createCard({ value: 50, title: 'Small' });
        expect(evaluatePlacement(smallCard, centerCard, false)).toBe(false);
      });
    });

    describe('mixed units', () => {
      it('should correctly compare different height units', () => {
        const centerInKm = createCard({ value: 1, unit: 'km', title: '1km' }); // 1000m
        const smallInM = createCard({ value: 500, unit: 'm', title: '500m' }); // 500m
        const largeInM = createCard({ value: 2000, unit: 'm', title: '2000m' }); // 2000m

        expect(evaluatePlacement(smallInM, centerInKm, true)).toBe(true);  // 500m < 1000m
        expect(evaluatePlacement(largeInM, centerInKm, false)).toBe(true); // 2000m > 1000m
        expect(evaluatePlacement(largeInM, centerInKm, true)).toBe(false); // 2000m !< 1000m
      });

      it('should correctly compare time units', () => {
        const centerAD = createCard({ value: 1000, unit: 'ad', title: '1000 AD' });
        const earlierBC = createCard({ value: -500, unit: 'bc', title: '500 BC' });
        const laterAD = createCard({ value: 2000, unit: 'ad', title: '2000 AD' });

        expect(evaluatePlacement(earlierBC, centerAD, true)).toBe(true);   // -500 < 1000
        expect(evaluatePlacement(laterAD, centerAD, false)).toBe(true);    // 2000 > 1000
      });
    });

    describe('edge cases', () => {
      it('should handle zero values', () => {
        const zeroCard = createCard({ value: 0, title: 'Zero' });
        const positiveCard = createCard({ value: 100, title: 'Positive' });

        expect(evaluatePlacement(zeroCard, positiveCard, true)).toBe(true);
        expect(evaluatePlacement(positiveCard, zeroCard, false)).toBe(true);
      });

      it('should handle negative values', () => {
        const negativeCard = createCard({ value: -50, unit: '°c', title: 'Cold' });
        const positiveCard = createCard({ value: 50, unit: '°c', title: 'Warm' });

        expect(evaluatePlacement(negativeCard, positiveCard, true)).toBe(true);
        expect(evaluatePlacement(positiveCard, negativeCard, false)).toBe(true);
      });
    });
  });

  describe('getScore', () => {
    it('should return 10 for easy cards', () => {
      const card = createCard({ difficulty: 'easy' });
      expect(getScore(card)).toBe(10);
    });

    it('should return 20 for medium cards', () => {
      const card = createCard({ difficulty: 'medium' });
      expect(getScore(card)).toBe(20);
    });

    it('should return 30 for hard cards', () => {
      const card = createCard({ difficulty: 'hard' });
      expect(getScore(card)).toBe(30);
    });

    it('should return 10 for unknown difficulty', () => {
      const card = createCard({ difficulty: 'unknown' as Card['difficulty'] });
      expect(getScore(card)).toBe(10);
    });

    it('should handle cards with all required fields', () => {
      const fullCard: Card = {
        id: 'full-card',
        title: 'Full Card',
        axis: 'height',
        value: 100,
        unit: 'm',
        displayValue: '100 m',
        image: 'full.jpg',
        facts: ['Fact 1', 'Fact 2'],
        sources: [
          { label: 'Source 1', url: 'https://source1.com' },
          { label: 'Source 2', url: 'https://source2.com' },
        ],
        difficulty: 'hard',
      };
      expect(getScore(fullCard)).toBe(30);
    });
  });
});
