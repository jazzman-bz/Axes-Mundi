import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LearningModeManager, LearningModeManagerCallbacks } from '@/utils/learningModeManager';
import { GameCard } from '@/game/Card';
import { Card as CardData } from '@/data/types';

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
function createTestCard(id: string, title: string, isCorrect: boolean = true): GameCard {
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
    {
      id: 'test-deck',
      name: 'Test',
      axis: 'height',
      theme: 'test',
      locale: 'en',
      version: '1.0.0',
      imageFolder: 'test',
      cards: [],
      isUserDeck: false,
    },
    0,
    0,
    1,
  );
  if (!isCorrect) {
    gameCard.setIncorrect();
  }
  return gameCard;
}

/**
 * Helper to create mock callbacks
 */
function createMockCallbacks(): LearningModeManagerCallbacks {
  let boardCard: GameCard | null = null;
  let placedLeft: GameCard[] = [];
  let placedRight: GameCard[] = [];
  let graveyard: GameCard[] = [];
  let playerHand: GameCard[] = [];
  let remainingCards: CardData[] = [];
  let score = 0;
  let currentTurn = 0;
  let tooltipCard: GameCard | null = null;

  return {
    onGetBoardCards: vi.fn(() => ({
      boardCard,
      placedLeft,
      placedRight,
    })),
    onGetGraveyard: vi.fn(() => graveyard),
    onGetPlayerHand: vi.fn(() => playerHand),
    onGetRemainingCards: vi.fn(() => remainingCards),
    onGetGameState: vi.fn(() => ({
      score,
      currentTurn,
      isLearningMode: true,
    })),
    onSetBoardCard: vi.fn((card) => {
      boardCard = card;
    }),
    onSetPlacedLeft: vi.fn((cards) => {
      placedLeft = cards;
    }),
    onSetPlacedRight: vi.fn((cards) => {
      placedRight = cards;
    }),
    onSetGraveyard: vi.fn((cards) => {
      graveyard = cards;
    }),
    onSetPlayerHand: vi.fn((cards) => {
      playerHand = cards;
    }),
    onSetScore: vi.fn((s) => {
      score = s;
    }),
    onSetCurrentTurn: vi.fn((turn) => {
      currentTurn = turn;
    }),
    onSetIsGameStarted: vi.fn(),
    onSetIsPlayerTurn: vi.fn(),
    onSetTurnText: vi.fn(),
    onSetTurnTimer: vi.fn(),
    onSetTooltipVisible: vi.fn(),
    onSetTooltipCard: vi.fn((card) => {
      tooltipCard = card;
    }),
    onSetHoveredCard: vi.fn(),
    onSetWeiterButtonBounds: vi.fn(),
    onSetClearBoardButtonBounds: vi.fn(),
    onSetResetGameButtonBounds: vi.fn(),
    onAnimateCardToGraveyard: vi.fn(),
    onLayoutAxisCards: vi.fn(),
    onGiveNewCard: vi.fn(),
    onUpdateInputHandlerConfig: vi.fn(),
    onLoadGame: vi.fn(() => Promise.resolve()),
    onStopTurnTimer: vi.fn(),
    onGetTooltipCard: vi.fn(() => tooltipCard),
  };
}

describe('LearningModeManager', () => {
  let manager: LearningModeManager;
  let callbacks: LearningModeManagerCallbacks;

  beforeEach(() => {
    vi.clearAllMocks();
    callbacks = createMockCallbacks();
    manager = new LearningModeManager({ callbacks });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('clearBoard', () => {
    it('should move boardCard to graveyard', () => {
      const boardCard = createTestCard('1', 'Board Card');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard,
        placedLeft: [],
        placedRight: [],
      }));

      manager.clearBoard();

      expect(callbacks.onAnimateCardToGraveyard).toHaveBeenCalledWith(boardCard);
      expect(callbacks.onSetBoardCard).toHaveBeenCalledWith(null);
    });

    it('should move all placedLeft cards to graveyard', () => {
      const card1 = createTestCard('1', 'Card 1');
      const card2 = createTestCard('2', 'Card 2');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [card1, card2],
        placedRight: [],
      }));

      manager.clearBoard();

      expect(callbacks.onAnimateCardToGraveyard).toHaveBeenCalledWith(card1);
      expect(callbacks.onAnimateCardToGraveyard).toHaveBeenCalledWith(card2);
      expect(callbacks.onSetPlacedLeft).toHaveBeenCalledWith([]);
    });

    it('should move all placedRight cards to graveyard', () => {
      const card1 = createTestCard('1', 'Card 1');
      const card2 = createTestCard('2', 'Card 2');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [],
        placedRight: [card1, card2],
      }));

      manager.clearBoard();

      expect(callbacks.onAnimateCardToGraveyard).toHaveBeenCalledWith(card1);
      expect(callbacks.onAnimateCardToGraveyard).toHaveBeenCalledWith(card2);
      expect(callbacks.onSetPlacedRight).toHaveBeenCalledWith([]);
    });

    it('should animate all cards to graveyard', () => {
      const boardCard = createTestCard('1', 'Board Card');
      const leftCard = createTestCard('2', 'Left Card');
      const rightCard = createTestCard('3', 'Right Card');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard,
        placedLeft: [leftCard],
        placedRight: [rightCard],
      }));

      manager.clearBoard();

      expect(callbacks.onAnimateCardToGraveyard).toHaveBeenCalledTimes(3);
    });

    it('should update graveyard state correctly', () => {
      const card1 = createTestCard('1', 'Card 1');
      const card2 = createTestCard('2', 'Card 2');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [card1],
        placedRight: [card2],
      }));
      callbacks.onGetGraveyard = vi.fn(() => []);

      manager.clearBoard();

      expect(callbacks.onSetGraveyard).toHaveBeenCalledWith([card1, card2]);
    });

    it('should clear all button bounds', () => {
      manager.clearBoard();

      expect(callbacks.onSetWeiterButtonBounds).toHaveBeenCalledWith(null);
      expect(callbacks.onSetClearBoardButtonBounds).toHaveBeenCalledWith(null);
      expect(callbacks.onSetResetGameButtonBounds).toHaveBeenCalledWith(null);
    });

    it('should hide tooltip', () => {
      manager.clearBoard();

      expect(callbacks.onSetTooltipVisible).toHaveBeenCalledWith(false);
      expect(callbacks.onSetTooltipCard).toHaveBeenCalledWith(null);
      expect(callbacks.onSetHoveredCard).toHaveBeenCalledWith(null);
    });

    it('should give new cards if hand is empty (skip graveyard recycle)', () => {
      const card1 = createTestCard('1', 'Card 1');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [card1],
        placedRight: [],
      }));
      callbacks.onGetPlayerHand = vi.fn(() => []);
      callbacks.onGetRemainingCards = vi.fn(() => [
        { id: '2', title: 'Card 2', axis: 'height', value: 100, unit: 'm', displayValue: '100 m', image: 'test.jpg', facts: [], sources: [], difficulty: 'medium' },
        { id: '3', title: 'Card 3', axis: 'height', value: 100, unit: 'm', displayValue: '100 m', image: 'test.jpg', facts: [], sources: [], difficulty: 'medium' },
      ]);

      manager.clearBoard();

      expect(callbacks.onGiveNewCard).toHaveBeenCalledWith(true);
    });

    it('should not give cards if hand is not empty', () => {
      const handCard = createTestCard('1', 'Hand Card');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [],
        placedRight: [],
      }));
      callbacks.onGetPlayerHand = vi.fn(() => [handCard]);

      manager.clearBoard();

      expect(callbacks.onGiveNewCard).not.toHaveBeenCalled();
    });

    it('should handle empty deck correctly', () => {
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [],
        placedRight: [],
      }));
      callbacks.onGetPlayerHand = vi.fn(() => []);
      callbacks.onGetRemainingCards = vi.fn(() => []);

      manager.clearBoard();

      expect(callbacks.onGiveNewCard).not.toHaveBeenCalled();
    });

    it('should re-center board after clearing', () => {
      manager.clearBoard();

      expect(callbacks.onLayoutAxisCards).toHaveBeenCalled();
    });

    it('should log info message', async () => {
      const { logger } = await import('@/utils/logger');
      manager.clearBoard();

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'renderer/learning',
          msg: 'clearing board - moving all cards to graveyard',
        }),
      );
    });
  });

  describe('resetLearningGame', () => {
    it('should stop turn timer', () => {
      manager.resetLearningGame();

      expect(callbacks.onStopTurnTimer).toHaveBeenCalled();
    });

    it('should clear all button bounds', () => {
      manager.resetLearningGame();

      expect(callbacks.onSetWeiterButtonBounds).toHaveBeenCalledWith(null);
      expect(callbacks.onSetClearBoardButtonBounds).toHaveBeenCalledWith(null);
      expect(callbacks.onSetResetGameButtonBounds).toHaveBeenCalledWith(null);
    });

    it('should hide tooltip', () => {
      manager.resetLearningGame();

      expect(callbacks.onSetTooltipVisible).toHaveBeenCalledWith(false);
      expect(callbacks.onSetTooltipCard).toHaveBeenCalledWith(null);
      expect(callbacks.onSetHoveredCard).toHaveBeenCalledWith(null);
    });

    it('should reset score to 0', () => {
      manager.resetLearningGame();

      expect(callbacks.onSetScore).toHaveBeenCalledWith(0);
    });

    it('should reset currentTurn to 0', () => {
      manager.resetLearningGame();

      expect(callbacks.onSetCurrentTurn).toHaveBeenCalledWith(0);
    });

    it('should clear player hand', () => {
      manager.resetLearningGame();

      expect(callbacks.onSetPlayerHand).toHaveBeenCalledWith([]);
    });

    it('should clear placedLeft', () => {
      manager.resetLearningGame();

      expect(callbacks.onSetPlacedLeft).toHaveBeenCalledWith([]);
    });

    it('should clear placedRight', () => {
      manager.resetLearningGame();

      expect(callbacks.onSetPlacedRight).toHaveBeenCalledWith([]);
    });

    it('should clear graveyard', () => {
      manager.resetLearningGame();

      expect(callbacks.onSetGraveyard).toHaveBeenCalledWith([]);
    });

    it('should reset isGameStarted', () => {
      manager.resetLearningGame();

      expect(callbacks.onSetIsGameStarted).toHaveBeenCalledWith(false);
    });

    it('should reset isPlayerTurn', () => {
      manager.resetLearningGame();

      expect(callbacks.onSetIsPlayerTurn).toHaveBeenCalledWith(true);
    });

    it('should reset turnText', () => {
      manager.resetLearningGame();

      expect(callbacks.onSetTurnText).toHaveBeenCalledWith('');
    });

    it('should reset turnTimer', () => {
      manager.resetLearningGame();

      expect(callbacks.onSetTurnTimer).toHaveBeenCalledWith(30);
    });

    it('should update input handler config', () => {
      manager.resetLearningGame();

      expect(callbacks.onUpdateInputHandlerConfig).toHaveBeenCalled();
    });

    it('should reload game via GameInitializer', () => {
      manager.resetLearningGame();

      expect(callbacks.onLoadGame).toHaveBeenCalled();
    });

    it('should handle reload errors gracefully', async () => {
      callbacks.onLoadGame = vi.fn(() => Promise.reject(new Error('Load failed')));

      await manager.resetLearningGame();

      expect(callbacks.onLoadGame).toHaveBeenCalled();
    });

    it('should log info message', async () => {
      const { logger } = await import('@/utils/logger');
      manager.resetLearningGame();

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'renderer/learning',
          msg: 'resetting learning game',
        }),
      );
    });
  });

  describe('removeCardFromBoard', () => {
    it('should remove card from placedLeft', () => {
      const card1 = createTestCard('1', 'Card 1');
      const card2 = createTestCard('2', 'Card 2');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [card1, card2],
        placedRight: [],
      }));

      manager.removeCardFromBoard(card1);

      expect(callbacks.onSetPlacedLeft).toHaveBeenCalledWith([card2]);
    });

    it('should remove card from placedRight', () => {
      const card1 = createTestCard('1', 'Card 1');
      const card2 = createTestCard('2', 'Card 2');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [],
        placedRight: [card1, card2],
      }));

      manager.removeCardFromBoard(card1);

      expect(callbacks.onSetPlacedRight).toHaveBeenCalledWith([card2]);
    });

    it('should clear boardCard if it is the card', () => {
      const boardCard = createTestCard('1', 'Board Card');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard,
        placedLeft: [],
        placedRight: [],
      }));

      manager.removeCardFromBoard(boardCard);

      expect(callbacks.onSetBoardCard).toHaveBeenCalledWith(null);
    });

    it('should clear weiter button bounds', () => {
      const card = createTestCard('1', 'Card 1');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [card],
        placedRight: [],
      }));

      manager.removeCardFromBoard(card);

      expect(callbacks.onSetWeiterButtonBounds).toHaveBeenCalledWith(null);
    });

    it('should add card to graveyard', () => {
      const card = createTestCard('1', 'Card 1');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [card],
        placedRight: [],
      }));
      callbacks.onGetGraveyard = vi.fn(() => []);

      manager.removeCardFromBoard(card);

      expect(callbacks.onSetGraveyard).toHaveBeenCalledWith([card]);
    });

    it('should animate card to graveyard', () => {
      const card = createTestCard('1', 'Card 1');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [card],
        placedRight: [],
      }));

      manager.removeCardFromBoard(card);

      expect(callbacks.onAnimateCardToGraveyard).toHaveBeenCalledWith(card);
    });

    it('should re-center remaining cards', () => {
      const card = createTestCard('1', 'Card 1');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [card],
        placedRight: [],
      }));

      manager.removeCardFromBoard(card);

      expect(callbacks.onLayoutAxisCards).toHaveBeenCalled();
    });

    it('should hide tooltip if this card was showing it', () => {
      const card = createTestCard('1', 'Card 1');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [card],
        placedRight: [],
      }));
      callbacks.onGetTooltipCard = vi.fn(() => card);

      manager.removeCardFromBoard(card);

      expect(callbacks.onSetTooltipVisible).toHaveBeenCalledWith(false);
      expect(callbacks.onSetTooltipCard).toHaveBeenCalledWith(null);
    });

    it('should give new card (skip graveyard recycle)', () => {
      const card = createTestCard('1', 'Card 1');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [card],
        placedRight: [],
      }));

      manager.removeCardFromBoard(card);

      expect(callbacks.onGiveNewCard).toHaveBeenCalledWith(true);
    });

    it('should log info message', async () => {
      const { logger } = await import('@/utils/logger');
      const card = createTestCard('1', 'Card 1');
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [card],
        placedRight: [],
      }));

      manager.removeCardFromBoard(card);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'renderer/game',
          msg: 'adding card to graveyard',
        }),
      );
    });
  });

  describe('showTooltipForIncorrectCard', () => {
    it('should set hoveredCard to card', () => {
      const card = createTestCard('1', 'Card 1', false);

      manager.showTooltipForIncorrectCard(card);

      expect(callbacks.onSetHoveredCard).toHaveBeenCalledWith(card);
    });

    it('should set tooltipCard to card', () => {
      const card = createTestCard('1', 'Card 1', false);

      manager.showTooltipForIncorrectCard(card);

      expect(callbacks.onSetTooltipCard).toHaveBeenCalledWith(card);
    });

    it('should set tooltipVisible to true', () => {
      const card = createTestCard('1', 'Card 1', false);

      manager.showTooltipForIncorrectCard(card);

      expect(callbacks.onSetTooltipVisible).toHaveBeenCalledWith(true);
    });

    it('should log debug message', async () => {
      const { logger } = await import('@/utils/logger');
      const card = createTestCard('1', 'Card 1', false);

      manager.showTooltipForIncorrectCard(card);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'renderer/tooltip',
          msg: 'tooltip shown automatically for incorrect card',
        }),
      );
    });
  });

  describe('handleWeiterButtonClick', () => {
    it('should find incorrect card from placedLeft', () => {
      const correctCard = createTestCard('1', 'Card 1', true);
      const incorrectCard = createTestCard('2', 'Card 2', false);
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [correctCard, incorrectCard],
        placedRight: [],
      }));

      manager.handleWeiterButtonClick();

      expect(callbacks.onSetPlacedLeft).toHaveBeenCalled();
      expect(callbacks.onAnimateCardToGraveyard).toHaveBeenCalledWith(incorrectCard);
    });

    it('should find incorrect card from placedRight', () => {
      const correctCard = createTestCard('1', 'Card 1', true);
      const incorrectCard = createTestCard('2', 'Card 2', false);
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [],
        placedRight: [correctCard, incorrectCard],
      }));

      manager.handleWeiterButtonClick();

      expect(callbacks.onSetPlacedRight).toHaveBeenCalled();
      expect(callbacks.onAnimateCardToGraveyard).toHaveBeenCalledWith(incorrectCard);
    });

    it('should find incorrect card from boardCard', () => {
      const incorrectCard = createTestCard('1', 'Card 1', false);
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: incorrectCard,
        placedLeft: [],
        placedRight: [],
      }));

      manager.handleWeiterButtonClick();

      expect(callbacks.onSetBoardCard).toHaveBeenCalledWith(null);
      expect(callbacks.onAnimateCardToGraveyard).toHaveBeenCalledWith(incorrectCard);
    });

    it('should handle no incorrect card gracefully', () => {
      const correctCard = createTestCard('1', 'Card 1', true);
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [correctCard],
        placedRight: [],
      }));

      manager.handleWeiterButtonClick();

      expect(callbacks.onAnimateCardToGraveyard).not.toHaveBeenCalled();
    });

    it('should log info message', async () => {
      const { logger } = await import('@/utils/logger');
      const incorrectCard = createTestCard('1', 'Card 1', false);
      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [incorrectCard],
        placedRight: [],
      }));

      manager.handleWeiterButtonClick();

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'renderer/learning',
          msg: 'incorrect card removed by weiter button click',
        }),
      );
    });
  });
});
