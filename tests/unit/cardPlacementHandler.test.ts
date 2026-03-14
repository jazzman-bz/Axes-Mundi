import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CardPlacementHandler, CardPlacementHandlerCallbacks } from '@/utils/cardPlacementHandler';
import { GameCard } from '@/game/Card';
import { Card as CardData } from '@/data/types';
import { SoundType } from '@/utils/soundManager';

// Mock the logger
vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock scoring functions
const mockIsAxisCorrectlySorted = vi.fn((cards: CardData[]) => {
  // Simple mock: return true if cards are sorted by value
  if (cards.length <= 1) return true;
  for (let i = 1; i < cards.length; i++) {
    if (cards[i - 1].value > cards[i].value) return false;
  }
  return true;
});

vi.mock('@/data/scoring', () => ({
  isAxisCorrectlySorted: (cards: CardData[]) => mockIsAxisCorrectlySorted(cards),
  getScore: vi.fn((card: CardData) => card.value || 10),
}));

describe('CardPlacementHandler', () => {
  let handler: CardPlacementHandler;
  let mockCallbacks: CardPlacementHandlerCallbacks;
  let mockCard1: GameCard;
  let mockCard2: GameCard;
  let mockCard3: GameCard;

  beforeEach(() => {
    vi.useFakeTimers();

    // Create mock cards
    const createMockCard = (id: string, title: string, value: number): GameCard => {
      const card = {
        card: {
          id,
          title,
          axis: 'time',
          value,
          unit: 'year',
          displayValue: String(value),
          image: id,
          facts: [],
          sources: [],
          difficulty: 'easy' as const,
        },
        x: 0,
        y: 0,
        width: 200,
        height: 300,
        isInHand: true,
        isCorrect: false,
        setTargetPosition: vi.fn(),
        setCorrect: vi.fn(),
        setIncorrect: vi.fn(),
      } as unknown as GameCard;
      return card;
    };

    mockCard1 = createMockCard('card1', 'Card 1', 100);
    mockCard2 = createMockCard('card2', 'Card 2', 200);
    mockCard3 = createMockCard('card3', 'Card 3', 300);

    mockCallbacks = {
      onGetBoardCards: vi.fn(() => ({
        boardCard: null,
        placedLeft: [],
        placedRight: [],
      })),
      onGetHands: vi.fn(() => ({
        playerHand: [mockCard1],
        opponentHand: [],
        player1Hand: [],
        player2Hand: [],
      })),
      onGetGameState: vi.fn(() => ({
        score: 0,
        currentTurn: 1,
        gameWon: false,
        gameLost: false,
        isPlayerTurn: true,
        isLearningMode: false,
        isHotseatMode: false,
        currentPlayerIndex: 0,
      })),
      onGetRemainingCards: vi.fn(() => []),
      onGetCanvasDimensions: vi.fn(() => ({ width: 1920, height: 1080 })),
      onSetBoardCard: vi.fn(),
      onSetPlacedLeft: vi.fn(),
      onSetPlacedRight: vi.fn(),
      onSetPlayerHand: vi.fn(),
      onSetPlayer1Hand: vi.fn(),
      onSetPlayer2Hand: vi.fn(),
      onSetScore: vi.fn(),
      onSetIsPlayerTurn: vi.fn(),
      onSetCurrentTurn: vi.fn(),
      onSetWeiterButtonBounds: vi.fn(),
      onSetIsAITurnInProgress: vi.fn(),
      onLayoutAxisCards: vi.fn(),
      onLayoutHand: vi.fn(),
      onLayoutHotseatHands: vi.fn(),
      onPlaySound: vi.fn(),
      onStopTurnTimer: vi.fn(),
      onStartTurnTimer: vi.fn(),
      onCheckWin: vi.fn(),
      onAITurn: vi.fn(),
      onShowPlayerSwitchOverlay: vi.fn(),
      onShowTooltip: vi.fn(),
      onMoveCardToGraveyard: vi.fn(),
      onGiveNewCard: vi.fn(),
      onLog: vi.fn(),
    };

    handler = new CardPlacementHandler({
      callbacks: mockCallbacks,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    mockIsAxisCorrectlySorted.mockReset();
  });

  describe('handleCardPlacement - First Card', () => {
    it('should set first card as board card and center it', () => {
      handler.handleCardPlacement(mockCard1, 100, 200, false, true);

      expect(mockCallbacks.onPlaySound).toHaveBeenCalledWith(SoundType.CARD_PLACE);
      expect(mockCallbacks.onSetBoardCard).toHaveBeenCalledWith(mockCard1);
      expect(mockCard1.isInHand).toBe(false);
      expect(mockCard1.setTargetPosition).toHaveBeenCalledWith(860, 200); // (1920/2 - 200/2, 200)
      expect(mockCallbacks.onLog).toHaveBeenCalledWith(
        'info',
        'renderer/cardplacement',
        'first card after clear board set as boardCard',
        { cardTitle: 'Card 1' },
      );
    });

    it('should remove card from hand after first card placement', () => {
      handler.handleCardPlacement(mockCard1, 100, 200, false, true);

      expect(mockCallbacks.onSetPlayerHand).toHaveBeenCalledWith([]);
      expect(mockCallbacks.onLayoutHand).toHaveBeenCalled();
    });
  });

  describe('handleCardPlacement - Normal Card Placement', () => {
    beforeEach(() => {
      mockCallbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: mockCard1,
        placedLeft: [],
        placedRight: [],
      }));
    });

    it('should add card to placedLeft when isLeft is true', () => {
      handler.handleCardPlacement(mockCard2, 100, 200, true, false);

      expect(mockCard2.setTargetPosition).toHaveBeenCalledWith(100, 200);
      expect(mockCard2.isInHand).toBe(false);
      expect(mockCallbacks.onSetPlacedLeft).toHaveBeenCalledWith([mockCard2]);
    });

    it('should add card to placedRight when isLeft is false', () => {
      handler.handleCardPlacement(mockCard2, 100, 200, false, false);

      expect(mockCard2.setTargetPosition).toHaveBeenCalledWith(100, 200);
      expect(mockCard2.isInHand).toBe(false);
      expect(mockCallbacks.onSetPlacedRight).toHaveBeenCalledWith([mockCard2]);
    });
  });

  describe('handleCardPlacement - Correct Placement (Normal Mode)', () => {
    beforeEach(() => {
      mockCallbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: mockCard1,
        placedLeft: [],
        placedRight: [],
      }));
      // Set up cards in correct order (sorted by value)
      mockCard1.x = 500;
      mockCard2.x = 700;
      mockCard1.card.value = 100;
      mockCard2.card.value = 200;
      // Mock to return true (correct order)
      mockIsAxisCorrectlySorted.mockReturnValue(true);
    });

    it('should handle correct placement in normal mode', () => {
      mockCallbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: mockCard1,
        placedLeft: [],
        placedRight: [mockCard2],
      }));

      handler.handleCardPlacement(mockCard2, 700, 200, false, false);

      expect(mockCard2.setCorrect).toHaveBeenCalled();
      expect(mockCallbacks.onSetScore).toHaveBeenCalledWith(200);
      expect(mockCallbacks.onSetWeiterButtonBounds).toHaveBeenCalledWith(null);
      expect(mockCallbacks.onLayoutAxisCards).toHaveBeenCalled();

      // Check turn management
      expect(mockCallbacks.onSetIsPlayerTurn).toHaveBeenCalledWith(false);
      expect(mockCallbacks.onSetCurrentTurn).toHaveBeenCalledWith(2);
      expect(mockCallbacks.onStopTurnTimer).toHaveBeenCalled();
      expect(mockCallbacks.onCheckWin).toHaveBeenCalled();

      // Check success sound (with delay)
      vi.advanceTimersByTime(300);
      expect(mockCallbacks.onPlaySound).toHaveBeenCalledWith(SoundType.SUCCESS);
    });

    it('should trigger AI turn if opponent has cards', () => {
      mockCallbacks.onGetHands = vi.fn(() => ({
        playerHand: [],
        opponentHand: [mockCard3],
        player1Hand: [],
        player2Hand: [],
      }));
      mockCallbacks.onGetGameState = vi.fn(() => ({
        score: 0,
        currentTurn: 1,
        gameWon: false,
        gameLost: false,
        isPlayerTurn: true,
        isLearningMode: false,
        isHotseatMode: false,
        currentPlayerIndex: 0,
      }));
      mockCallbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: mockCard1,
        placedLeft: [],
        placedRight: [mockCard2],
      }));

      handler.handleCardPlacement(mockCard2, 700, 200, false, false);

      vi.advanceTimersByTime(1000);
      // onAITurn is called - it will set isAITurnInProgress internally based on playTurn's return value
      expect(mockCallbacks.onAITurn).toHaveBeenCalledWith([mockCard3]);
    });

    it('should keep player turn if AI has no cards', () => {
      mockCallbacks.onGetHands = vi.fn(() => ({
        playerHand: [],
        opponentHand: [],
        player1Hand: [],
        player2Hand: [],
      }));
      mockCallbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: mockCard1,
        placedLeft: [],
        placedRight: [mockCard2],
      }));

      handler.handleCardPlacement(mockCard2, 700, 200, false, false);

      expect(mockCallbacks.onSetIsPlayerTurn).toHaveBeenCalledWith(true);
      expect(mockCallbacks.onStartTurnTimer).toHaveBeenCalled();
    });
  });

  describe('handleCardPlacement - Correct Placement (Hotseat Mode)', () => {
    beforeEach(() => {
      mockCallbacks.onGetGameState = vi.fn(() => ({
        score: 0,
        currentTurn: 1,
        gameWon: false,
        gameLost: false,
        isPlayerTurn: true,
        isLearningMode: false,
        isHotseatMode: true,
        currentPlayerIndex: 0,
      }));
      mockCallbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: mockCard1,
        placedLeft: [],
        placedRight: [],
      }));
      // Mock to return true (correct order)
      mockIsAxisCorrectlySorted.mockReturnValue(true);
    });

    it('should schedule player switch overlay after correct placement in hotseat mode', () => {
      mockCallbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: mockCard1,
        placedLeft: [],
        placedRight: [mockCard2],
      }));

      handler.handleCardPlacement(mockCard2, 700, 200, false, false);

      expect(mockCallbacks.onCheckWin).not.toHaveBeenCalled();
      expect(mockCallbacks.onShowPlayerSwitchOverlay).not.toHaveBeenCalled();

      vi.advanceTimersByTime(2000);
      expect(mockCallbacks.onCheckWin).toHaveBeenCalled();

      const updatedState = { ...mockCallbacks.onGetGameState(), gameWon: false };
      mockCallbacks.onGetGameState = vi.fn(() => updatedState);

      expect(mockCallbacks.onShowPlayerSwitchOverlay).toHaveBeenCalled();
    });

    it('should not show player switch overlay if game is won', () => {
      mockCallbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: mockCard1,
        placedLeft: [],
        placedRight: [mockCard2],
      }));

      handler.handleCardPlacement(mockCard2, 700, 200, false, false);

      vi.advanceTimersByTime(2000);
      mockCallbacks.onGetGameState = vi.fn(() => ({
        score: 0,
        currentTurn: 1,
        gameWon: true,
        gameLost: false,
        isPlayerTurn: true,
        isLearningMode: false,
        isHotseatMode: true,
        currentPlayerIndex: 0,
      }));

      expect(mockCallbacks.onCheckWin).toHaveBeenCalled();
      // Should not show overlay if game is won
    });
  });

  describe('handleCardPlacement - Correct Placement (Learning Mode)', () => {
    beforeEach(() => {
      mockCallbacks.onGetGameState = vi.fn(() => ({
        score: 0,
        currentTurn: 1,
        gameWon: false,
        gameLost: false,
        isPlayerTurn: true,
        isLearningMode: true,
        isHotseatMode: false,
        currentPlayerIndex: 0,
      }));
      mockCallbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: mockCard1,
        placedLeft: [],
        placedRight: [],
      }));
      // Mock to return true (correct order)
      mockIsAxisCorrectlySorted.mockReturnValue(true);
    });

    it('should not update score in learning mode', () => {
      mockCallbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: mockCard1,
        placedLeft: [],
        placedRight: [mockCard2],
      }));

      handler.handleCardPlacement(mockCard2, 700, 200, false, false);

      expect(mockCallbacks.onSetScore).not.toHaveBeenCalled();
      expect(mockCallbacks.onSetIsPlayerTurn).toHaveBeenCalledWith(true);
      expect(mockCallbacks.onGiveNewCard).toHaveBeenCalled();
    });

    it('should give more cards when hand is empty in learning mode', () => {
      mockCallbacks.onGetHands = vi.fn(() => ({
        playerHand: [],
        opponentHand: [],
        player1Hand: [],
        player2Hand: [],
      }));
      mockCallbacks.onGetRemainingCards = vi.fn(() => [
        { id: 'card4', title: 'Card 4', axis: 'time', value: 400 } as CardData,
        { id: 'card5', title: 'Card 5', axis: 'time', value: 500 } as CardData,
      ]);
      mockCallbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: mockCard1,
        placedLeft: [],
        placedRight: [mockCard2],
      }));

      handler.handleCardPlacement(mockCard2, 700, 200, false, false);

      expect(mockCallbacks.onGiveNewCard).toHaveBeenCalledTimes(3); // 2 for empty hand + 1 for correct placement
    });
  });

  describe('handleCardPlacement - Incorrect Placement (Learning Mode)', () => {
    beforeEach(() => {
      mockCallbacks.onGetGameState = vi.fn(() => ({
        score: 0,
        currentTurn: 1,
        gameWon: false,
        gameLost: false,
        isPlayerTurn: true,
        isLearningMode: true,
        isHotseatMode: false,
        currentPlayerIndex: 0,
      }));
      // Set up cards in incorrect order (card2 with value 100 comes after card1 with value 200)
      mockCard1.x = 500;
      mockCard2.x = 700; // Card2 is to the right but has lower value
      mockCard1.card.value = 200;
      mockCard2.card.value = 100;
      mockCallbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: mockCard1,
        placedLeft: [],
        placedRight: [mockCard2],
      }));
      // Mock to return false (incorrect order)
      mockIsAxisCorrectlySorted.mockReturnValue(false);
    });

    it('should show tooltip for incorrect card in learning mode', () => {
      handler.handleCardPlacement(mockCard2, 700, 200, false, false);

      expect(mockCard2.setIncorrect).toHaveBeenCalled();
      expect(mockCallbacks.onShowTooltip).toHaveBeenCalledWith(mockCard2);
      expect(mockCallbacks.onLayoutAxisCards).not.toHaveBeenCalled(); // Should not layout immediately

      vi.advanceTimersByTime(300);
      expect(mockCallbacks.onPlaySound).toHaveBeenCalledWith(SoundType.ERROR);
    });
  });

  describe('handleCardPlacement - Incorrect Placement (Hotseat Mode)', () => {
    beforeEach(() => {
      mockCallbacks.onGetGameState = vi.fn(() => ({
        score: 0,
        currentTurn: 1,
        gameWon: false,
        gameLost: false,
        isPlayerTurn: true,
        isLearningMode: false,
        isHotseatMode: true,
        currentPlayerIndex: 0,
      }));
      // Set up cards in incorrect order
      mockCard1.x = 500;
      mockCard2.x = 700; // Card2 is to the right but has lower value
      mockCard1.card.value = 200;
      mockCard2.card.value = 100;
      mockCallbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: mockCard1,
        placedLeft: [],
        placedRight: [mockCard2],
      }));
      // Mock to return false (incorrect order)
      mockIsAxisCorrectlySorted.mockReturnValue(false);
    });

    it('should move card to graveyard and show overlay in hotseat mode', () => {
      handler.handleCardPlacement(mockCard2, 700, 200, false, false);

      expect(mockCard2.setIncorrect).toHaveBeenCalled();

      vi.advanceTimersByTime(2000);
      expect(mockCallbacks.onMoveCardToGraveyard).toHaveBeenCalledWith(mockCard2);
      expect(mockCallbacks.onLayoutAxisCards).toHaveBeenCalled();

      vi.advanceTimersByTime(2000);
      expect(mockCallbacks.onShowPlayerSwitchOverlay).toHaveBeenCalled();
    });
  });

  describe('handleCardPlacement - Incorrect Placement (Normal Mode)', () => {
    beforeEach(() => {
      mockCallbacks.onGetGameState = vi.fn(() => ({
        score: 0,
        currentTurn: 1,
        gameWon: false,
        gameLost: false,
        isPlayerTurn: true,
        isLearningMode: false,
        isHotseatMode: false,
        currentPlayerIndex: 0,
      }));
      // Set up cards in incorrect order
      mockCard1.x = 500;
      mockCard2.x = 700; // Card2 is to the right but has lower value
      mockCard1.card.value = 200;
      mockCard2.card.value = 100;
      mockCallbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: mockCard1,
        placedLeft: [],
        placedRight: [mockCard2],
      }));
      // Mock to return false (incorrect order)
      mockIsAxisCorrectlySorted.mockReturnValue(false);
    });

    it('should move card to graveyard after delay in normal mode', () => {
      handler.handleCardPlacement(mockCard2, 700, 200, false, false);

      expect(mockCard2.setIncorrect).toHaveBeenCalled();
      expect(mockCallbacks.onMoveCardToGraveyard).not.toHaveBeenCalled();

      vi.advanceTimersByTime(2000);
      expect(mockCallbacks.onMoveCardToGraveyard).toHaveBeenCalledWith(mockCard2);
      expect(mockCallbacks.onLayoutAxisCards).toHaveBeenCalled();
    });
  });

  describe('handleCardPlacement - Hand Removal', () => {
    it('should remove from player hand in normal mode', () => {
      mockCallbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: mockCard1,
        placedLeft: [],
        placedRight: [],
      }));

      handler.handleCardPlacement(mockCard1, 100, 200, false, false);

      expect(mockCallbacks.onSetPlayerHand).toHaveBeenCalled();
      expect(mockCallbacks.onLayoutHand).toHaveBeenCalled();
    });

    it('should remove from player1Hand in hotseat mode when currentPlayerIndex is 0', () => {
      mockCallbacks.onGetGameState = vi.fn(() => ({
        score: 0,
        currentTurn: 1,
        gameWon: false,
        gameLost: false,
        isPlayerTurn: true,
        isLearningMode: false,
        isHotseatMode: true,
        currentPlayerIndex: 0,
      }));
      mockCallbacks.onGetHands = vi.fn(() => ({
        playerHand: [],
        opponentHand: [],
        player1Hand: [mockCard1],
        player2Hand: [],
      }));
      mockCallbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [],
        placedRight: [],
      }));

      handler.handleCardPlacement(mockCard1, 100, 200, false, false);

      expect(mockCallbacks.onSetPlayer1Hand).toHaveBeenCalled();
      expect(mockCallbacks.onLayoutHotseatHands).toHaveBeenCalled();
    });

    it('should remove from player2Hand in hotseat mode when currentPlayerIndex is 1', () => {
      mockCallbacks.onGetGameState = vi.fn(() => ({
        score: 0,
        currentTurn: 1,
        gameWon: false,
        gameLost: false,
        isPlayerTurn: true,
        isLearningMode: false,
        isHotseatMode: true,
        currentPlayerIndex: 1,
      }));
      mockCallbacks.onGetHands = vi.fn(() => ({
        playerHand: [],
        opponentHand: [],
        player1Hand: [],
        player2Hand: [mockCard1],
      }));
      mockCallbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [],
        placedRight: [],
      }));

      handler.handleCardPlacement(mockCard1, 100, 200, false, false);

      expect(mockCallbacks.onSetPlayer2Hand).toHaveBeenCalled();
      expect(mockCallbacks.onLayoutHotseatHands).toHaveBeenCalled();
    });
  });

  describe('handleCardPlacement - Placement Evaluation', () => {
    it('should evaluate correct placement when cards are sorted', () => {
      mockCard1.x = 100;
      mockCard2.x = 200;
      mockCard1.card.value = 100;
      mockCard2.card.value = 200;
      mockCallbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: mockCard1,
        placedLeft: [],
        placedRight: [mockCard2],
      }));
      // Mock to return true (correct order)
      mockIsAxisCorrectlySorted.mockReturnValue(true);

      handler.handleCardPlacement(mockCard2, 200, 200, false, false);

      expect(mockCard2.setCorrect).toHaveBeenCalled();
      expect(mockCard2.setIncorrect).not.toHaveBeenCalled();
    });

    it('should evaluate incorrect placement when cards are not sorted', () => {
      mockCard1.x = 500;
      mockCard2.x = 700; // Card2 is to the right but has lower value
      mockCard1.card.value = 200;
      mockCard2.card.value = 100;
      mockCallbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: mockCard1,
        placedLeft: [],
        placedRight: [mockCard2],
      }));
      // Mock to return false (incorrect order)
      mockIsAxisCorrectlySorted.mockReturnValue(false);

      handler.handleCardPlacement(mockCard2, 700, 200, false, false);

      expect(mockCard2.setIncorrect).toHaveBeenCalled();
      expect(mockCard2.setCorrect).not.toHaveBeenCalled();
    });

    it('should treat single card as correct', () => {
      mockCallbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [],
        placedRight: [],
      }));

      handler.handleCardPlacement(mockCard1, 100, 200, false, true);

      // First card should be set as board card, not evaluated
      expect(mockCallbacks.onSetBoardCard).toHaveBeenCalled();
    });
  });
});
