import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import {
  calculateHandLayout,
  calculateAxisLayout,
  CardLayoutManager,
  extractCardData,
  recycleGraveyard,
  LayoutConfig,
} from '@/utils/cardLayout';
import { GameCard } from '@/game/Card';
import { Card } from '@/data/types';

// Mock the logger
vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock scoring module
vi.mock('@/data/scoring', () => ({
  convertToComparable: vi.fn((value: number) => value),
}));

/**
 * Helper to create test cards
 */
function createTestCard(id: string, value: number): Card {
  return {
    id,
    title: `Card ${id}`,
    axis: 'height',
    value,
    unit: 'm',
    displayValue: `${value} m`,
    image: 'test.jpg',
    facts: ['Test fact'],
    sources: [{ label: 'Test', url: 'https://test.com' }],
    difficulty: 'medium',
  };
}

/**
 * Helper to create mock GameCard
 */
function createMockGameCard(card: Card): GameCard {
  const mockCard = {
    card,
    width: 200,
    height: 300,
    setTargetPosition: vi.fn(),
    updateScale: vi.fn(),
  } as unknown as GameCard;

  return mockCard;
}

describe('cardLayout', () => {
  const defaultConfig: LayoutConfig = {
    scale: 1.0,
    canvasWidth: 1920,
    canvasHeight: 1080,
  };

  describe('calculateHandLayout', () => {
    it('should calculate positions for bottom hand', () => {
      const positions = calculateHandLayout(5, defaultConfig, 'bottom');

      expect(positions).toHaveLength(5);
      expect(positions[0].y).toBe(1080 - 320); // Bottom position
      expect(positions[0].x).toBeLessThan(positions[1].x); // Left to right
    });

    it('should calculate positions for top hand', () => {
      const positions = calculateHandLayout(5, defaultConfig, 'top');

      expect(positions).toHaveLength(5);
      expect(positions[0].y).toBe(20); // Top position
    });

    it('should center cards horizontally', () => {
      const positions = calculateHandLayout(3, defaultConfig, 'bottom');
      const firstX = positions[0].x;
      const lastX = positions[2].x;
      const centerX = defaultConfig.canvasWidth / 2;

      // First and last cards should be approximately centered
      // (accounting for card spacing and rounding)
      const midpoint = (firstX + lastX) / 2;
      const distanceFromCenter = Math.abs(centerX - midpoint);
      expect(distanceFromCenter).toBeLessThan(150); // Allow for spacing calculations
    });

    it('should handle zero cards', () => {
      const positions = calculateHandLayout(0, defaultConfig);
      expect(positions).toHaveLength(0);
    });

    it('should respect scale factor', () => {
      const config1: LayoutConfig = { ...defaultConfig, scale: 0.5 };
      const config2: LayoutConfig = { ...defaultConfig, scale: 2.0 };

      const positions1 = calculateHandLayout(3, config1);
      const positions2 = calculateHandLayout(3, config2);

      // Spacing should scale
      const spacing1 = positions1[1].x - positions1[0].x;
      const spacing2 = positions2[1].x - positions2[0].x;
      expect(spacing2).toBeGreaterThan(spacing1);
    });

    it('should use custom card spacing', () => {
      const config: LayoutConfig = { ...defaultConfig, cardSpacing: 300 };
      const positions = calculateHandLayout(3, config);

      const spacing = positions[1].x - positions[0].x;
      expect(spacing).toBe(300); // Should use custom spacing
    });
  });

  describe('calculateAxisLayout', () => {
    it('should sort cards by value', () => {
      const cards = [
        createMockGameCard(createTestCard('3', 300)),
        createMockGameCard(createTestCard('1', 100)),
        createMockGameCard(createTestCard('2', 200)),
      ];

      const layout = calculateAxisLayout(cards, defaultConfig);

      expect(layout).toHaveLength(3);
      expect(layout[0].card.card.value).toBe(100);
      expect(layout[1].card.card.value).toBe(200);
      expect(layout[2].card.card.value).toBe(300);
    });

    it('should calculate positions for axis cards', () => {
      const cards = [
        createMockGameCard(createTestCard('1', 100)),
        createMockGameCard(createTestCard('2', 200)),
      ];

      const layout = calculateAxisLayout(cards, defaultConfig);

      expect(layout).toHaveLength(2);
      expect(layout[0].position.x).toBeLessThan(layout[1].position.x);
      expect(layout[0].position.y).toBe(layout[1].position.y); // Same Y (axis)
    });

    it('should center cards on axis', () => {
      const cards = [
        createMockGameCard(createTestCard('1', 100)),
        createMockGameCard(createTestCard('2', 200)),
      ];

      const layout = calculateAxisLayout(cards, defaultConfig);
      const centerX = defaultConfig.canvasWidth / 2;
      const firstX = layout[0].position.x;
      const lastX = layout[1].position.x;

      // Cards should be approximately centered
      // (accounting for card width and spacing)
      const midpoint = (firstX + lastX) / 2;
      const distanceFromCenter = Math.abs(centerX - midpoint);
      expect(distanceFromCenter).toBeLessThan(150); // Allow for card width calculations
    });

    it('should handle empty array', () => {
      const layout = calculateAxisLayout([], defaultConfig);
      expect(layout).toHaveLength(0);
    });

    it('should handle single card', () => {
      const cards = [createMockGameCard(createTestCard('1', 100))];
      const layout = calculateAxisLayout(cards, defaultConfig);

      expect(layout).toHaveLength(1);
      expect(layout[0].position.y).toBe(defaultConfig.canvasHeight / 2 - cards[0].height / 2);
    });

    it('should use custom axis spacing', () => {
      const config: LayoutConfig = { ...defaultConfig, axisSpacing: 10 };
      const cards = [
        createMockGameCard(createTestCard('1', 100)),
        createMockGameCard(createTestCard('2', 200)),
      ];

      const layout = calculateAxisLayout(cards, config);
      const spacing = layout[1].position.x - layout[0].position.x - 200; // Subtract card width

      expect(spacing).toBe(10); // Should use custom spacing
    });
  });

  describe('CardLayoutManager', () => {
    let manager: CardLayoutManager;
    let mockCards: GameCard[];

    beforeEach(() => {
      manager = new CardLayoutManager(defaultConfig);
      mockCards = [
        createMockGameCard(createTestCard('1', 100)),
        createMockGameCard(createTestCard('2', 200)),
      ];
    });

    it('should create manager with config', () => {
      expect(manager.getConfig()).toEqual(defaultConfig);
    });

    it('should update config', () => {
      manager.updateConfig({ scale: 2.0 });
      expect(manager.getConfig().scale).toBe(2.0);
    });

    it('should layout hand cards', () => {
      manager.layoutHand(mockCards, 'bottom');

      expect(mockCards[0].setTargetPosition).toHaveBeenCalled();
      expect(mockCards[1].setTargetPosition).toHaveBeenCalled();
    });

    it('should layout axis cards', () => {
      manager.layoutAxis(mockCards);

      expect(mockCards[0].setTargetPosition).toHaveBeenCalled();
      expect(mockCards[1].setTargetPosition).toHaveBeenCalled();
    });

    it('should update scale for all cards', () => {
      manager.updateScale(mockCards);

      expect(mockCards[0].updateScale).toHaveBeenCalledWith(defaultConfig.scale);
      expect(mockCards[1].updateScale).toHaveBeenCalledWith(defaultConfig.scale);
    });

    it('should handle empty card arrays', () => {
      expect(() => manager.layoutHand([], 'bottom')).not.toThrow();
      expect(() => manager.layoutAxis([])).not.toThrow();
      expect(() => manager.updateScale([])).not.toThrow();
    });
  });

  describe('extractCardData', () => {
    it('should extract card data from GameCard objects', () => {
      const gameCards = [
        createMockGameCard(createTestCard('1', 100)),
        createMockGameCard(createTestCard('2', 200)),
      ];

      const cardData = extractCardData(gameCards);

      expect(cardData).toHaveLength(2);
      expect(cardData[0].id).toBe('1');
      expect(cardData[1].id).toBe('2');
    });

    it('should handle empty array', () => {
      const cardData = extractCardData([]);
      expect(cardData).toHaveLength(0);
    });
  });

  describe('recycleGraveyard', () => {
    it('should recycle graveyard cards to deck', () => {
      const graveyard = [
        createMockGameCard(createTestCard('1', 100)),
        createMockGameCard(createTestCard('2', 200)),
      ];
      const deck: Card[] = [createTestCard('3', 300)];

      const newDeck = recycleGraveyard(graveyard, deck);

      expect(newDeck).toHaveLength(3);
      expect(newDeck[0].id).toBe('3'); // Original deck cards first
      expect(newDeck[1].id).toBe('1'); // Then graveyard cards
      expect(newDeck[2].id).toBe('2');
    });

    it('should return original deck if graveyard is empty', () => {
      const deck: Card[] = [createTestCard('1', 100)];
      const newDeck = recycleGraveyard([], deck);

      expect(newDeck).toEqual(deck);
      expect(newDeck).not.toBe(deck); // Should be new array
    });

    it('should handle empty deck', () => {
      const graveyard = [createMockGameCard(createTestCard('1', 100))];
      const newDeck = recycleGraveyard(graveyard, []);

      expect(newDeck).toHaveLength(1);
      expect(newDeck[0].id).toBe('1');
    });

    it('should preserve order of graveyard cards', () => {
      const graveyard = [
        createMockGameCard(createTestCard('1', 100)),
        createMockGameCard(createTestCard('2', 200)),
        createMockGameCard(createTestCard('3', 300)),
      ];
      const deck: Card[] = [];

      const newDeck = recycleGraveyard(graveyard, deck);

      expect(newDeck[0].id).toBe('1');
      expect(newDeck[1].id).toBe('2');
      expect(newDeck[2].id).toBe('3');
    });
  });
});
