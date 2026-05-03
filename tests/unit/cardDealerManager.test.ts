import {
  describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';
import { CardDealerManager, CardDealerManagerCallbacks } from '@/utils/cardDealerManager';
import { GameCard } from '@/game/Card';
import { Card as CardData } from '@/data/types';
import { ExtendedDeck } from '@/data/deckLoader';

// Mock the logger
vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock cardDealer utilities
vi.mock('@/utils/cardDealer', () => ({
  dealCard: vi.fn((deck: CardData[]) => (deck.length > 0 ? deck.shift()! : null)),
  getOpponentCardCount: vi.fn((difficulty: 'easy' | 'medium' | 'hard') => {
    switch (difficulty) {
      case 'easy': return 7;
      case 'medium': return 6;
      case 'hard': return 5;
      default: return 6;
    }
  }),
}));

/**
 * Helper to create test cards
 */
function createTestCard(id: string, title: string): CardData {
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

/**
 * Helper to create mock deck
 */
function createMockDeck(): ExtendedDeck {
  return {
    id: 'test-deck',
    name: 'Test Deck',
    axis: 'height',
    theme: 'test',
    locale: 'en',
    version: '1.0.0',
    imageFolder: 'test',
    cards: [],
    isUserDeck: false,
  };
}

/**
 * Helper to create mock canvas
 */
function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  return canvas;
}

/**
 * Helper to create mock callbacks
 */
function createMockCallbacks(): CardDealerManagerCallbacks {
  const playerHand: GameCard[] = [];
  const opponentHand: GameCard[] = [];
  const player1Hand: GameCard[] = [];
  const player2Hand: GameCard[] = [];
  const graveyard: GameCard[] = [];
  let remainingCards: CardData[] = [];
  let boardCard: GameCard | null = null;
  let currentTurn = 0;

  return {
    onGetRemainingCards: () => remainingCards,
    onGetGraveyard: () => graveyard,
    onGetHands: () => ({
      playerHand,
      opponentHand,
      player1Hand,
      player2Hand,
    }),
    onGetGameState: () => ({
      gameDifficulty: 'medium' as const,
      isLearningMode: false,
      isHotseatMode: false,
      currentPlayerIndex: 0,
      boardCard,
      currentTurn,
    }),
    onAddCardToPlayerHand: vi.fn((card: GameCard) => {
      playerHand.push(card);
    }),
    onAddCardToOpponentHand: vi.fn((card: GameCard) => {
      opponentHand.push(card);
    }),
    onAddCardToPlayer1Hand: vi.fn((card: GameCard) => {
      player1Hand.push(card);
    }),
    onAddCardToPlayer2Hand: vi.fn((card: GameCard) => {
      player2Hand.push(card);
    }),
    onSetBoardCard: vi.fn((card: GameCard | null) => {
      boardCard = card;
    }),
    onSetIsPlayerTurn: vi.fn(),
    onSetIsGameStarted: vi.fn(),
    onSetCurrentTurn: vi.fn((turn: number) => {
      currentTurn = turn;
    }),
    onLayoutHand: vi.fn(),
    onLayoutOpponentHand: vi.fn(),
    onLayoutHotseatHands: vi.fn(),
    onLayoutPlayer1Hand: vi.fn(),
    onLayoutPlayer2Hand: vi.fn(),
    onRecycleGraveyard: vi.fn(() => {
      // Simulate recycling: move graveyard cards back to deck
      remainingCards = [...graveyard.map((c) => c.card), ...remainingCards];
      graveyard.length = 0;
    }),
    onUpdateInputHandlerConfig: vi.fn(),
    onStartTurnTimer: vi.fn(),
    onUpdateTurnText: vi.fn(),
    onPlaySound: vi.fn(),
  };
}

describe('CardDealerManager', () => {
  let manager: CardDealerManager;
  let callbacks: CardDealerManagerCallbacks;
  let canvas: HTMLCanvasElement;
  let deck: ExtendedDeck;
  let testCards: CardData[];

  beforeEach(() => {
    vi.useFakeTimers();
    callbacks = createMockCallbacks();
    canvas = createMockCanvas();
    deck = createMockDeck();
    testCards = [
      createTestCard('1', 'Card 1'),
      createTestCard('2', 'Card 2'),
      createTestCard('3', 'Card 3'),
      createTestCard('4', 'Card 4'),
      createTestCard('5', 'Card 5'),
      createTestCard('6', 'Card 6'),
      createTestCard('7', 'Card 7'),
      createTestCard('8', 'Card 8'),
    ];

    // Initialize remaining cards
    callbacks.onGetRemainingCards = () => [...testCards];

    manager = new CardDealerManager({
      canvas,
      scale: 1,
      deck,
      callbacks,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('animateFirstCardToCenter', () => {
    it('should calculate correct center position and animate card', () => {
      const mockCard = {
        width: 200,
        height: 300,
        card: { title: 'Test Card' },
        setTargetPosition: vi.fn(),
      } as unknown as GameCard;

      manager.animateFirstCardToCenter(mockCard);

      const expectedX = canvas.width / 2 - mockCard.width / 2;
      const expectedY = canvas.height / 2 - mockCard.height / 2;

      expect(mockCard.setTargetPosition).toHaveBeenCalledWith(expectedX, expectedY);
    });

    it('should set game started and turn after delay', () => {
      const mockCard = {
        width: 200,
        height: 300,
        card: { title: 'Test Card' },
        setTargetPosition: vi.fn(),
      } as unknown as GameCard;

      manager.animateFirstCardToCenter(mockCard);

      // Fast-forward time
      vi.advanceTimersByTime(2000);

      expect(callbacks.onSetIsGameStarted).toHaveBeenCalledWith(true);
      expect(callbacks.onSetCurrentTurn).toHaveBeenCalledWith(1);
    });

    it('should handle null boardCard gracefully', () => {
      manager.animateFirstCardToCenter(null);
      expect(callbacks.onSetIsGameStarted).not.toHaveBeenCalled();
    });
  });

  describe('animateCardToHand', () => {
    it('should add card to player hand and layout', () => {
      const mockCard = {
        card: { title: 'Test Card' },
      } as GameCard;

      manager.animateCardToHand(mockCard);

      expect(callbacks.onAddCardToPlayerHand).toHaveBeenCalledWith(mockCard);
      expect(callbacks.onLayoutHand).toHaveBeenCalled();
    });
  });

  describe('animateOpponentCardFromDeck', () => {
    it('should add card to opponent hand and layout', () => {
      const mockCard = {
        card: { title: 'Test Card' },
      } as GameCard;

      manager.animateOpponentCardFromDeck(mockCard);

      expect(callbacks.onAddCardToOpponentHand).toHaveBeenCalledWith(mockCard);
      expect(callbacks.onLayoutOpponentHand).toHaveBeenCalled();
    });
  });

  describe('dealCardToPlayer', () => {
    it('should deal a card from remaining cards', () => {
      manager.dealCardToPlayer();

      expect(callbacks.onAddCardToPlayerHand).toHaveBeenCalled();
      expect(callbacks.onLayoutHand).toHaveBeenCalled();
    });

    it('should recycle graveyard when deck is empty', () => {
      // Empty remaining cards
      callbacks.onGetRemainingCards = () => [];
      // Add cards to graveyard
      const graveyardCard = new GameCard(
        createTestCard('graveyard-1', 'Graveyard Card'),
        deck,
        0,
        0,
        1,
      );
      callbacks.onGetGraveyard = () => [graveyardCard];

      manager.dealCardToPlayer();

      expect(callbacks.onRecycleGraveyard).toHaveBeenCalled();
    });

    it('should handle empty deck gracefully', () => {
      callbacks.onGetRemainingCards = () => [];
      callbacks.onGetGraveyard = () => [];

      manager.dealCardToPlayer();

      expect(callbacks.onAddCardToPlayerHand).not.toHaveBeenCalled();
    });
  });

  describe('dealCardToOpponent', () => {
    it('should deal a card to opponent hand', () => {
      manager.dealCardToOpponent();

      expect(callbacks.onAddCardToOpponentHand).toHaveBeenCalled();
      expect(callbacks.onLayoutOpponentHand).toHaveBeenCalled();
    });

    it('should recycle graveyard when deck is empty', () => {
      callbacks.onGetRemainingCards = () => [];
      const graveyardCard = new GameCard(
        createTestCard('graveyard-1', 'Graveyard Card'),
        deck,
        0,
        0,
        1,
      );
      callbacks.onGetGraveyard = () => [graveyardCard];

      manager.dealCardToOpponent();

      expect(callbacks.onRecycleGraveyard).toHaveBeenCalled();
    });
  });

  describe('dealCardToPlayer1', () => {
    it('should deal a card to player 1 hand', () => {
      manager.dealCardToPlayer1();

      expect(callbacks.onAddCardToPlayer1Hand).toHaveBeenCalled();
      expect(callbacks.onLayoutPlayer1Hand).toHaveBeenCalled();
    });

    it('should handle empty deck gracefully', () => {
      callbacks.onGetRemainingCards = () => [];
      callbacks.onGetGraveyard = () => [];

      manager.dealCardToPlayer1();

      expect(callbacks.onAddCardToPlayer1Hand).not.toHaveBeenCalled();
    });
  });

  describe('dealCardToPlayer2', () => {
    it('should deal a card to player 2 hand', () => {
      manager.dealCardToPlayer2();

      expect(callbacks.onAddCardToPlayer2Hand).toHaveBeenCalled();
      expect(callbacks.onLayoutPlayer2Hand).toHaveBeenCalled();
    });

    it('should handle empty deck gracefully', () => {
      callbacks.onGetRemainingCards = () => [];
      callbacks.onGetGraveyard = () => [];

      manager.dealCardToPlayer2();

      expect(callbacks.onAddCardToPlayer2Hand).not.toHaveBeenCalled();
    });
  });

  describe('dealCardsToPlayers', () => {
    it('should deal 5 cards to player', () => {
      manager.dealCardsToPlayers();

      // Fast-forward through all delays
      vi.advanceTimersByTime(5000);

      expect(callbacks.onPlaySound).toHaveBeenCalledTimes(11); // 5 player + 6 opponent (medium difficulty)
      expect(callbacks.onAddCardToPlayerHand).toHaveBeenCalledTimes(5);
    });

    it('should deal correct number of opponent cards based on difficulty', () => {
      // Test easy difficulty (7 cards)
      callbacks.onGetGameState = () => ({
        gameDifficulty: 'easy' as const,
        isLearningMode: false,
        isHotseatMode: false,
        currentPlayerIndex: 0,
        boardCard: null,
        currentTurn: 0,
      });

      manager.dealCardsToPlayers();
      vi.advanceTimersByTime(10000);

      expect(callbacks.onAddCardToOpponentHand).toHaveBeenCalledTimes(7);
    });

    it('should set player turn after all cards are dealt', () => {
      manager.dealCardsToPlayers();

      // Fast-forward to end of dealing
      vi.advanceTimersByTime(5000);

      expect(callbacks.onSetIsPlayerTurn).toHaveBeenCalledWith(true);
      expect(callbacks.onUpdateInputHandlerConfig).toHaveBeenCalled();
      expect(callbacks.onStartTurnTimer).toHaveBeenCalled();
    });

    it('should play sounds at correct intervals', () => {
      manager.dealCardsToPlayers();

      // Check first sound plays immediately
      vi.advanceTimersByTime(0);
      expect(callbacks.onPlaySound).toHaveBeenCalledTimes(1);

      // Check second sound plays after 200ms
      vi.advanceTimersByTime(200);
      expect(callbacks.onPlaySound).toHaveBeenCalledTimes(2);
    });
  });

  describe('dealCardsToPlayersLearningMode', () => {
    it('should deal 5 cards to player only', () => {
      callbacks.onGetGameState = () => ({
        gameDifficulty: 'medium' as const,
        isLearningMode: true,
        isHotseatMode: false,
        currentPlayerIndex: 0,
        boardCard: null,
        currentTurn: 0,
      });

      manager.dealCardsToPlayersLearningMode();

      expect(callbacks.onAddCardToPlayerHand).toHaveBeenCalledTimes(5);
      expect(callbacks.onLayoutHand).toHaveBeenCalled();
      expect(callbacks.onSetIsPlayerTurn).toHaveBeenCalledWith(true);
      expect(callbacks.onUpdateInputHandlerConfig).toHaveBeenCalled();
    });

    it('should play sounds for each card', () => {
      callbacks.onGetGameState = () => ({
        gameDifficulty: 'medium' as const,
        isLearningMode: true,
        isHotseatMode: false,
        currentPlayerIndex: 0,
        boardCard: null,
        currentTurn: 0,
      });

      manager.dealCardsToPlayersLearningMode();

      // Fast-forward through sound delays
      vi.advanceTimersByTime(300);

      expect(callbacks.onPlaySound).toHaveBeenCalledTimes(5);
    });

    it('should handle errors gracefully', () => {
      // Make onGetRemainingCards throw an error
      callbacks.onGetRemainingCards = () => {
        throw new Error('Test error');
      };

      expect(() => {
        manager.dealCardsToPlayersLearningMode();
      }).not.toThrow();
    });
  });

  describe('dealCardsToPlayersHotseat', () => {
    it('should deal 5 cards to each player', () => {
      callbacks.onGetGameState = () => ({
        gameDifficulty: 'medium' as const,
        isLearningMode: false,
        isHotseatMode: true,
        currentPlayerIndex: 0,
        boardCard: null,
        currentTurn: 0,
      });

      manager.dealCardsToPlayersHotseat();

      // Fast-forward through all delays
      vi.advanceTimersByTime(5000);

      expect(callbacks.onAddCardToPlayer1Hand).toHaveBeenCalledTimes(5);
      expect(callbacks.onAddCardToPlayer2Hand).toHaveBeenCalledTimes(5);
      expect(callbacks.onLayoutHotseatHands).toHaveBeenCalled();
    });

    it('should set player turn after all cards are dealt', () => {
      callbacks.onGetGameState = () => ({
        gameDifficulty: 'medium' as const,
        isLearningMode: false,
        isHotseatMode: true,
        currentPlayerIndex: 0,
        boardCard: null,
        currentTurn: 0,
      });

      manager.dealCardsToPlayersHotseat();

      // Fast-forward to end
      vi.advanceTimersByTime(5000);

      expect(callbacks.onSetIsPlayerTurn).toHaveBeenCalledWith(true);
      expect(callbacks.onUpdateInputHandlerConfig).toHaveBeenCalled();
      expect(callbacks.onUpdateTurnText).toHaveBeenCalled();
    });

    it('should play sounds at correct intervals', () => {
      callbacks.onGetGameState = () => ({
        gameDifficulty: 'medium' as const,
        isLearningMode: false,
        isHotseatMode: true,
        currentPlayerIndex: 0,
        boardCard: null,
        currentTurn: 0,
      });

      manager.dealCardsToPlayersHotseat();

      // Fast-forward through all delays
      vi.advanceTimersByTime(5000);

      expect(callbacks.onPlaySound).toHaveBeenCalledTimes(10); // 5 + 5
    });

    it('should handle errors gracefully', () => {
      callbacks.onGetGameState = () => {
        throw new Error('Test error');
      };

      expect(() => {
        manager.dealCardsToPlayersHotseat();
      }).not.toThrow();
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const newCanvas = createMockCanvas();
      newCanvas.width = 800;
      newCanvas.height = 600;

      manager.updateConfig({
        canvas: newCanvas,
        scale: 2,
      });

      // Verify config was updated by checking a method that uses canvas
      const mockCard = {
        width: 200,
        height: 300,
        card: { title: 'Test' },
        setTargetPosition: vi.fn(),
      } as unknown as GameCard;

      manager.animateFirstCardToCenter(mockCard);

      // Should use new canvas dimensions
      const expectedX = newCanvas.width / 2 - mockCard.width / 2;
      expect(mockCard.setTargetPosition).toHaveBeenCalledWith(
        expectedX,
        expect.any(Number),
      );
    });
  });
});
