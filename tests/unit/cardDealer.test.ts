import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  dealCard,
  dealCards,
  getOpponentCardCount,
  getCardCounts,
  GameDifficulty,
  GameMode,
} from '@/utils/cardDealer';
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

/**
 * Helper to create test cards
 */
function createTestCard(id: string, title: string): Card {
  return {
    id,
    title,
    axis: 'height',
    value: 100,
    unit: 'm',
    displayValue: '100 m',
    image: 'test.jpg',
    facts: ['Test fact'],
    sources: [{ label: 'Test', url: 'https://test.com' }],
    difficulty: 'medium',
  };
}

describe('cardDealer', () => {
  let testDeck: Card[];

  beforeEach(() => {
    testDeck = [
      createTestCard('1', 'Card 1'),
      createTestCard('2', 'Card 2'),
      createTestCard('3', 'Card 3'),
      createTestCard('4', 'Card 4'),
      createTestCard('5', 'Card 5'),
    ];
  });

  describe('dealCard', () => {
    it('should deal a single card from deck', () => {
      const originalLength = testDeck.length;
      const card = dealCard(testDeck);

      expect(card).not.toBeNull();
      expect(card?.id).toBe('1');
      expect(testDeck.length).toBe(originalLength - 1);
    });

    it('should return null if deck is empty', () => {
      const emptyDeck: Card[] = [];
      const card = dealCard(emptyDeck);

      expect(card).toBeNull();
    });

    it('should mutate the deck array', () => {
      const card = dealCard(testDeck);
      expect(testDeck).not.toContain(card);
    });

    it('should deal cards in order', () => {
      const card1 = dealCard(testDeck);
      const card2 = dealCard(testDeck);
      const card3 = dealCard(testDeck);

      expect(card1?.id).toBe('1');
      expect(card2?.id).toBe('2');
      expect(card3?.id).toBe('3');
    });
  });

  describe('dealCards', () => {
    it('should deal multiple cards from deck', () => {
      const dealt = dealCards(testDeck, 3);

      expect(dealt).toHaveLength(3);
      expect(testDeck.length).toBe(2);
      expect(dealt[0].id).toBe('1');
      expect(dealt[1].id).toBe('2');
      expect(dealt[2].id).toBe('3');
    });

    it('should deal all cards if count exceeds deck size', () => {
      const dealt = dealCards(testDeck, 10);

      expect(dealt).toHaveLength(5);
      expect(testDeck.length).toBe(0);
    });

    it('should return empty array if deck is empty', () => {
      const emptyDeck: Card[] = [];
      const dealt = dealCards(emptyDeck, 5);

      expect(dealt).toHaveLength(0);
    });

    it('should return empty array if count is zero', () => {
      const dealt = dealCards(testDeck, 0);

      expect(dealt).toHaveLength(0);
      expect(testDeck.length).toBe(5);
    });
  });

  describe('getOpponentCardCount', () => {
    it('should return 7 for easy difficulty', () => {
      expect(getOpponentCardCount('easy')).toBe(7);
    });

    it('should return 6 for medium difficulty', () => {
      expect(getOpponentCardCount('medium')).toBe(6);
    });

    it('should return 5 for hard difficulty', () => {
      expect(getOpponentCardCount('hard')).toBe(5);
    });

    it('should default to medium if not specified', () => {
      expect(getOpponentCardCount()).toBe(6);
    });
  });

  describe('getCardCounts', () => {
    it('should return correct counts for normal mode', () => {
      const counts = getCardCounts('normal', 'medium');
      expect(counts.player).toBe(5);
      expect(counts.opponent).toBe(6);
    });

    it('should return correct counts for learning mode', () => {
      const counts = getCardCounts('learning');
      expect(counts.player).toBe(5);
      expect(counts.opponent).toBeUndefined();
    });

    it('should return correct counts for hotseat mode', () => {
      const counts = getCardCounts('hotseat');
      expect(counts.player1).toBe(5);
      expect(counts.player2).toBe(5);
      expect(counts.player).toBeUndefined();
      expect(counts.opponent).toBeUndefined();
    });

    it('should respect difficulty in normal mode', () => {
      const easyCounts = getCardCounts('normal', 'easy');
      expect(easyCounts.opponent).toBe(7);

      const hardCounts = getCardCounts('normal', 'hard');
      expect(hardCounts.opponent).toBe(5);
    });

    it('should default to normal mode', () => {
      const counts = getCardCounts();
      expect(counts.player).toBe(5);
      expect(counts.opponent).toBe(6);
    });
  });
});
