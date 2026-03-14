import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BoardNavigationManager, BoardNavigationManagerCallbacks } from '@/utils/boardNavigationManager';
import { GameCard } from '@/game/Card';

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
function createTestCard(id: string, title: string, x: number = 100, y: number = 200): GameCard {
  const card = {
    id,
    title,
    axis: 'height' as const,
    value: 100,
    unit: 'm',
    displayValue: '100 m',
    image: 'test.jpg',
    facts: ['Test fact'],
    sources: [{ label: 'Test', url: 'https://test.com' }],
    difficulty: 'medium' as const,
  };
  const gameCard = new GameCard(
    card,
    { id: 'test-deck', name: 'Test', axis: 'height', theme: 'test', locale: 'en', version: '1.0.0', cards: [], isUserDeck: false },
    x,
    y,
    1,
  );
  return gameCard;
}

/**
 * Helper to create mock callbacks
 */
function createMockCallbacks(): BoardNavigationManagerCallbacks {
  return {
    onGetBoardCards: vi.fn(() => ({
      boardCard: null,
      placedLeft: [],
      placedRight: [],
    })),
    onGetScale: vi.fn(() => 1.0),
  };
}

describe('BoardNavigationManager', () => {
  let manager: BoardNavigationManager;
  let callbacks: BoardNavigationManagerCallbacks;

  beforeEach(() => {
    vi.clearAllMocks();
    callbacks = createMockCallbacks();
    manager = new BoardNavigationManager({ callbacks });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('moveBoardCardsLeft', () => {
    it('should move boardCard left (increases X)', () => {
      const boardCard = createTestCard('1', 'Board Card', 100, 200);
      const mockSetTargetPosition = vi.spyOn(boardCard, 'setTargetPosition');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard,
        placedLeft: [],
        placedRight: [],
      }));

      manager.moveBoardCardsLeft();

      expect(mockSetTargetPosition).toHaveBeenCalledWith(305, 200); // 100 + (200 * 1 + 5 * 1)
    });

    it('should move all placedLeft cards left', () => {
      const card1 = createTestCard('1', 'Card 1', 50, 200);
      const card2 = createTestCard('2', 'Card 2', 100, 200);
      const mockSetTargetPosition1 = vi.spyOn(card1, 'setTargetPosition');
      const mockSetTargetPosition2 = vi.spyOn(card2, 'setTargetPosition');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [card1, card2],
        placedRight: [],
      }));

      manager.moveBoardCardsLeft();

      expect(mockSetTargetPosition1).toHaveBeenCalledWith(255, 200); // 50 + 205
      expect(mockSetTargetPosition2).toHaveBeenCalledWith(305, 200); // 100 + 205
    });

    it('should move all placedRight cards left', () => {
      const card1 = createTestCard('1', 'Card 1', 150, 200);
      const card2 = createTestCard('2', 'Card 2', 200, 200);
      const mockSetTargetPosition1 = vi.spyOn(card1, 'setTargetPosition');
      const mockSetTargetPosition2 = vi.spyOn(card2, 'setTargetPosition');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [],
        placedRight: [card1, card2],
      }));

      manager.moveBoardCardsLeft();

      expect(mockSetTargetPosition1).toHaveBeenCalledWith(355, 200); // 150 + 205
      expect(mockSetTargetPosition2).toHaveBeenCalledWith(405, 200); // 200 + 205
    });

    it('should calculate move distance correctly (200 * scale + 5 * scale)', () => {
      const boardCard = createTestCard('1', 'Board Card', 100, 200);
      const mockSetTargetPosition = vi.spyOn(boardCard, 'setTargetPosition');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard,
        placedLeft: [],
        placedRight: [],
      }));
      callbacks.onGetScale = vi.fn(() => 2.0);

      manager.moveBoardCardsLeft();

      expect(mockSetTargetPosition).toHaveBeenCalledWith(510, 200); // 100 + (200 * 2 + 5 * 2) = 100 + 410
    });

    it('should call setTargetPosition with correct new X position', () => {
      const boardCard = createTestCard('1', 'Board Card', 500, 300);
      const mockSetTargetPosition = vi.spyOn(boardCard, 'setTargetPosition');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard,
        placedLeft: [],
        placedRight: [],
      }));

      manager.moveBoardCardsLeft();

      expect(mockSetTargetPosition).toHaveBeenCalledWith(705, 300); // 500 + 205
    });

    it('should preserve Y position', () => {
      const boardCard = createTestCard('1', 'Board Card', 100, 250);
      const mockSetTargetPosition = vi.spyOn(boardCard, 'setTargetPosition');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard,
        placedLeft: [],
        placedRight: [],
      }));

      manager.moveBoardCardsLeft();

      expect(mockSetTargetPosition).toHaveBeenCalledWith(305, 250); // Y preserved
    });

    it('should handle no boardCard gracefully', () => {
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [],
        placedRight: [],
      }));

      expect(() => manager.moveBoardCardsLeft()).not.toThrow();
    });

    it('should handle empty placedLeft array', () => {
      const boardCard = createTestCard('1', 'Board Card', 100, 200);
      const mockSetTargetPosition = vi.spyOn(boardCard, 'setTargetPosition');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard,
        placedLeft: [],
        placedRight: [],
      }));

      manager.moveBoardCardsLeft();

      expect(mockSetTargetPosition).toHaveBeenCalledTimes(1); // Only boardCard
    });

    it('should handle empty placedRight array', () => {
      const boardCard = createTestCard('1', 'Board Card', 100, 200);
      const mockSetTargetPosition = vi.spyOn(boardCard, 'setTargetPosition');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard,
        placedLeft: [],
        placedRight: [],
      }));

      manager.moveBoardCardsLeft();

      expect(mockSetTargetPosition).toHaveBeenCalledTimes(1); // Only boardCard
    });

    it('should handle all cards present', () => {
      const boardCard = createTestCard('1', 'Board Card', 100, 200);
      const leftCard = createTestCard('2', 'Left Card', 50, 200);
      const rightCard = createTestCard('3', 'Right Card', 150, 200);
      const mockSetTargetPositionBoard = vi.spyOn(boardCard, 'setTargetPosition');
      const mockSetTargetPositionLeft = vi.spyOn(leftCard, 'setTargetPosition');
      const mockSetTargetPositionRight = vi.spyOn(rightCard, 'setTargetPosition');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard,
        placedLeft: [leftCard],
        placedRight: [rightCard],
      }));

      manager.moveBoardCardsLeft();

      expect(mockSetTargetPositionBoard).toHaveBeenCalled();
      expect(mockSetTargetPositionLeft).toHaveBeenCalled();
      expect(mockSetTargetPositionRight).toHaveBeenCalled();
      expect(mockSetTargetPositionBoard).toHaveBeenCalledTimes(1);
      expect(mockSetTargetPositionLeft).toHaveBeenCalledTimes(1);
      expect(mockSetTargetPositionRight).toHaveBeenCalledTimes(1);
    });

    it('should log info message with correct metadata', async () => {
      const { logger } = await import('@/utils/logger');
      const boardCard = createTestCard('1', 'Board Card', 100, 200);
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard,
        placedLeft: [],
        placedRight: [],
      }));

      manager.moveBoardCardsLeft();

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'renderer/navigation',
          msg: 'board cards moved left',
          meta: expect.objectContaining({
            moveDistance: 205,
            totalCards: 1,
          }),
        }),
      );
    });

    it('should use scale from callback', () => {
      const boardCard = createTestCard('1', 'Board Card', 100, 200);
      const mockSetTargetPosition = vi.spyOn(boardCard, 'setTargetPosition');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard,
        placedLeft: [],
        placedRight: [],
      }));
      callbacks.onGetScale = vi.fn(() => 0.5);

      manager.moveBoardCardsLeft();

      expect(callbacks.onGetScale).toHaveBeenCalled();
      expect(mockSetTargetPosition).toHaveBeenCalledWith(202.5, 200); // 100 + (200 * 0.5 + 5 * 0.5) = 100 + 102.5
    });
  });

  describe('moveBoardCardsRight', () => {
    it('should move boardCard right (decreases X)', () => {
      const boardCard = createTestCard('1', 'Board Card', 100, 200);
      const mockSetTargetPosition = vi.spyOn(boardCard, 'setTargetPosition');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard,
        placedLeft: [],
        placedRight: [],
      }));

      manager.moveBoardCardsRight();

      expect(mockSetTargetPosition).toHaveBeenCalledWith(-105, 200); // 100 - (200 * 1 + 5 * 1)
    });

    it('should move all placedLeft cards right', () => {
      const card1 = createTestCard('1', 'Card 1', 50, 200);
      const card2 = createTestCard('2', 'Card 2', 100, 200);
      const mockSetTargetPosition1 = vi.spyOn(card1, 'setTargetPosition');
      const mockSetTargetPosition2 = vi.spyOn(card2, 'setTargetPosition');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [card1, card2],
        placedRight: [],
      }));

      manager.moveBoardCardsRight();

      expect(mockSetTargetPosition1).toHaveBeenCalledWith(-155, 200); // 50 - 205
      expect(mockSetTargetPosition2).toHaveBeenCalledWith(-105, 200); // 100 - 205
    });

    it('should move all placedRight cards right', () => {
      const card1 = createTestCard('1', 'Card 1', 150, 200);
      const card2 = createTestCard('2', 'Card 2', 200, 200);
      const mockSetTargetPosition1 = vi.spyOn(card1, 'setTargetPosition');
      const mockSetTargetPosition2 = vi.spyOn(card2, 'setTargetPosition');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [],
        placedRight: [card1, card2],
      }));

      manager.moveBoardCardsRight();

      expect(mockSetTargetPosition1).toHaveBeenCalledWith(-55, 200); // 150 - 205
      expect(mockSetTargetPosition2).toHaveBeenCalledWith(-5, 200); // 200 - 205
    });

    it('should calculate move distance correctly (200 * scale + 5 * scale)', () => {
      const boardCard = createTestCard('1', 'Board Card', 100, 200);
      const mockSetTargetPosition = vi.spyOn(boardCard, 'setTargetPosition');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard,
        placedLeft: [],
        placedRight: [],
      }));
      callbacks.onGetScale = vi.fn(() => 2.0);

      manager.moveBoardCardsRight();

      expect(mockSetTargetPosition).toHaveBeenCalledWith(-310, 200); // 100 - (200 * 2 + 5 * 2) = 100 - 410
    });

    it('should call setTargetPosition with correct new X position', () => {
      const boardCard = createTestCard('1', 'Board Card', 500, 300);
      const mockSetTargetPosition = vi.spyOn(boardCard, 'setTargetPosition');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard,
        placedLeft: [],
        placedRight: [],
      }));

      manager.moveBoardCardsRight();

      expect(mockSetTargetPosition).toHaveBeenCalledWith(295, 300); // 500 - 205
    });

    it('should preserve Y position', () => {
      const boardCard = createTestCard('1', 'Board Card', 100, 250);
      const mockSetTargetPosition = vi.spyOn(boardCard, 'setTargetPosition');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard,
        placedLeft: [],
        placedRight: [],
      }));

      manager.moveBoardCardsRight();

      expect(mockSetTargetPosition).toHaveBeenCalledWith(-105, 250); // Y preserved
    });

    it('should handle no boardCard gracefully', () => {
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [],
        placedRight: [],
      }));

      expect(() => manager.moveBoardCardsRight()).not.toThrow();
    });

    it('should handle empty placedLeft array', () => {
      const boardCard = createTestCard('1', 'Board Card', 100, 200);
      const mockSetTargetPosition = vi.spyOn(boardCard, 'setTargetPosition');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard,
        placedLeft: [],
        placedRight: [],
      }));

      manager.moveBoardCardsRight();

      expect(mockSetTargetPosition).toHaveBeenCalledTimes(1); // Only boardCard
    });

    it('should handle empty placedRight array', () => {
      const boardCard = createTestCard('1', 'Board Card', 100, 200);
      const mockSetTargetPosition = vi.spyOn(boardCard, 'setTargetPosition');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard,
        placedLeft: [],
        placedRight: [],
      }));

      manager.moveBoardCardsRight();

      expect(mockSetTargetPosition).toHaveBeenCalledTimes(1); // Only boardCard
    });

    it('should handle all cards present', () => {
      const boardCard = createTestCard('1', 'Board Card', 100, 200);
      const leftCard = createTestCard('2', 'Left Card', 50, 200);
      const rightCard = createTestCard('3', 'Right Card', 150, 200);
      const mockSetTargetPositionBoard = vi.spyOn(boardCard, 'setTargetPosition');
      const mockSetTargetPositionLeft = vi.spyOn(leftCard, 'setTargetPosition');
      const mockSetTargetPositionRight = vi.spyOn(rightCard, 'setTargetPosition');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard,
        placedLeft: [leftCard],
        placedRight: [rightCard],
      }));

      manager.moveBoardCardsRight();

      expect(mockSetTargetPositionBoard).toHaveBeenCalled();
      expect(mockSetTargetPositionLeft).toHaveBeenCalled();
      expect(mockSetTargetPositionRight).toHaveBeenCalled();
      expect(mockSetTargetPositionBoard).toHaveBeenCalledTimes(1);
      expect(mockSetTargetPositionLeft).toHaveBeenCalledTimes(1);
      expect(mockSetTargetPositionRight).toHaveBeenCalledTimes(1);
    });

    it('should log info message with correct metadata', async () => {
      const { logger } = await import('@/utils/logger');
      const boardCard = createTestCard('1', 'Board Card', 100, 200);
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard,
        placedLeft: [],
        placedRight: [],
      }));

      manager.moveBoardCardsRight();

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'renderer/navigation',
          msg: 'board cards moved right',
          meta: expect.objectContaining({
            moveDistance: 205,
            totalCards: 1,
          }),
        }),
      );
    });

    it('should use scale from callback', () => {
      const boardCard = createTestCard('1', 'Board Card', 100, 200);
      const mockSetTargetPosition = vi.spyOn(boardCard, 'setTargetPosition');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard,
        placedLeft: [],
        placedRight: [],
      }));
      callbacks.onGetScale = vi.fn(() => 0.5);

      manager.moveBoardCardsRight();

      expect(callbacks.onGetScale).toHaveBeenCalled();
      expect(mockSetTargetPosition).toHaveBeenCalledWith(-2.5, 200); // 100 - (200 * 0.5 + 5 * 0.5) = 100 - 102.5
    });
  });

  describe('Edge Cases', () => {
    it('should handle scale = 1.0', () => {
      const boardCard = createTestCard('1', 'Board Card', 100, 200);
      const mockSetTargetPosition = vi.spyOn(boardCard, 'setTargetPosition');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard,
        placedLeft: [],
        placedRight: [],
      }));
      callbacks.onGetScale = vi.fn(() => 1.0);

      manager.moveBoardCardsLeft();

      expect(mockSetTargetPosition).toHaveBeenCalledWith(305, 200); // 100 + 205
    });

    it('should handle scale = 2.0', () => {
      const boardCard = createTestCard('1', 'Board Card', 100, 200);
      const mockSetTargetPosition = vi.spyOn(boardCard, 'setTargetPosition');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard,
        placedLeft: [],
        placedRight: [],
      }));
      callbacks.onGetScale = vi.fn(() => 2.0);

      manager.moveBoardCardsLeft();

      expect(mockSetTargetPosition).toHaveBeenCalledWith(510, 200); // 100 + 410
    });

    it('should handle scale = 0.5', () => {
      const boardCard = createTestCard('1', 'Board Card', 100, 200);
      const mockSetTargetPosition = vi.spyOn(boardCard, 'setTargetPosition');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard,
        placedLeft: [],
        placedRight: [],
      }));
      callbacks.onGetScale = vi.fn(() => 0.5);

      manager.moveBoardCardsLeft();

      expect(mockSetTargetPosition).toHaveBeenCalledWith(202.5, 200); // 100 + 102.5
    });

    it('should handle cards with different Y positions', () => {
      const boardCard = createTestCard('1', 'Board Card', 100, 200);
      const leftCard = createTestCard('2', 'Left Card', 50, 300);
      const rightCard = createTestCard('3', 'Right Card', 150, 400);
      const mockSetTargetPositionBoard = vi.spyOn(boardCard, 'setTargetPosition');
      const mockSetTargetPositionLeft = vi.spyOn(leftCard, 'setTargetPosition');
      const mockSetTargetPositionRight = vi.spyOn(rightCard, 'setTargetPosition');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard,
        placedLeft: [leftCard],
        placedRight: [rightCard],
      }));

      manager.moveBoardCardsLeft();

      expect(mockSetTargetPositionBoard).toHaveBeenCalledWith(305, 200);
      expect(mockSetTargetPositionLeft).toHaveBeenCalledWith(255, 300);
      expect(mockSetTargetPositionRight).toHaveBeenCalledWith(355, 400);
    });

    it('should handle cards with negative X positions', () => {
      const boardCard = createTestCard('1', 'Board Card', -100, 200);
      const mockSetTargetPosition = vi.spyOn(boardCard, 'setTargetPosition');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard,
        placedLeft: [],
        placedRight: [],
      }));

      manager.moveBoardCardsLeft();

      expect(mockSetTargetPosition).toHaveBeenCalledWith(105, 200); // -100 + 205
    });

    it('should handle cards with very large X positions', () => {
      const boardCard = createTestCard('1', 'Board Card', 10000, 200);
      const mockSetTargetPosition = vi.spyOn(boardCard, 'setTargetPosition');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard,
        placedLeft: [],
        placedRight: [],
      }));

      manager.moveBoardCardsLeft();

      expect(mockSetTargetPosition).toHaveBeenCalledWith(10205, 200); // 10000 + 205
    });
  });
});
