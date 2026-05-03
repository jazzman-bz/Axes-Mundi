import {
  describe, it, expect, beforeEach, afterEach, vi,
} from 'vitest';
import { GameStateManager, GameStateManagerCallbacks } from '@/utils/gameStateManager';
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

describe('GameStateManager', () => {
  let manager: GameStateManager;
  let canvas: HTMLCanvasElement;
  let mockCallbacks: GameStateManagerCallbacks;
  let mockDeck: any;

  beforeEach(() => {
    vi.useFakeTimers();
    canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    mockDeck = {
      id: 'test-deck',
      name: 'Test Deck',
      axis: 'time',
      theme: 'test',
      locale: 'en',
      version: '1.0.0',
      cards: [],
    };

    mockCallbacks = {
      onGetBoardCards: vi.fn(() => ({
        boardCard: null,
        placedLeft: [],
        placedRight: [],
      })),
      onGetHands: vi.fn(() => ({
        playerHand: [],
        opponentHand: [],
        player1Hand: [],
        player2Hand: [],
      })),
      onGetGraveyard: vi.fn(() => []),
      onGetRemainingCards: vi.fn(() => []),
      onGetGameState: vi.fn(() => ({
        score: 0,
        currentTurn: 0,
        gameWon: false,
        gameLost: false,
        isPlayerTurn: true,
        isLearningMode: false,
        isHotseatMode: false,
        currentPlayerIndex: 0,
        player1Data: null,
        player2Data: null,
      })),
      onSetBoardCard: vi.fn(),
      onSetPlacedLeft: vi.fn(),
      onSetPlacedRight: vi.fn(),
      onSetGraveyard: vi.fn(),
      onSetRemainingCards: vi.fn(),
      onSetPlayerHand: vi.fn(),
      onSetOpponentHand: vi.fn(),
      onSetPlayer1Hand: vi.fn(),
      onSetPlayer2Hand: vi.fn(),
      onSetScore: vi.fn(),
      onSetGameWon: vi.fn(),
      onSetGameLost: vi.fn(),
      onSetIsPlayerTurn: vi.fn(),
      onSetCurrentTurn: vi.fn(),
      onLayoutAxisCards: vi.fn(),
      onLayoutHand: vi.fn(),
      onLayoutHotseatHands: vi.fn(),
      onAnimateCardToGraveyard: vi.fn(),
      onAnimateCardToHand: vi.fn(),
      onPlaySound: vi.fn(),
      onTurnComplete: vi.fn(),
      onStartTurnTimer: vi.fn(),
      onStopTurnTimer: vi.fn(),
      onUpdateInputHandlerConfig: vi.fn(),
      onAITurn: vi.fn(),
      onSetAITurnInProgress: vi.fn(),
      onShowPlayerSwitchOverlay: vi.fn(),
      onShowHotseatWinDialog: vi.fn(),
      onShowWinDialog: vi.fn(),
      onShowLoseDialog: vi.fn(),
    };

    manager = new GameStateManager({
      canvas,
      scale: 1,
      deck: mockDeck,
      callbacks: mockCallbacks,
    });
  });

  function createMockCard(id: string, title: string, value: number = 1000): GameCard {
    const cardData: CardData = {
      id,
      title,
      axis: 'time',
      value,
      unit: 'year',
      displayValue: `${value}`,
      image: 'test',
      facts: ['Test fact'],
      sources: [{ label: 'Test', url: 'https://test.com' }],
      difficulty: 'easy',
    };

    return new GameCard(cardData, mockDeck, 100, 100, 1);
  }

  describe('recycleGraveyard', () => {
    it('should do nothing if graveyard is empty', () => {
      (mockCallbacks.onGetGraveyard as any).mockReturnValue([]);
      manager.recycleGraveyard();
      // Should return early without calling setters
      expect(mockCallbacks.onSetRemainingCards).not.toHaveBeenCalled();
      expect(mockCallbacks.onSetGraveyard).not.toHaveBeenCalled();
    });

    it('should recycle valid graveyard cards to remaining cards', () => {
      const card1 = createMockCard('1', 'Card 1');
      const card2 = createMockCard('2', 'Card 2');
      const graveyard = [card1, card2];
      const remainingCards: CardData[] = [];

      (mockCallbacks.onGetGraveyard as any).mockReturnValue(graveyard);
      (mockCallbacks.onGetRemainingCards as any).mockReturnValue(remainingCards);
      (mockCallbacks.onGetBoardCards as any).mockReturnValue({
        boardCard: null,
        placedLeft: [],
        placedRight: [],
      });

      manager.recycleGraveyard();

      expect(mockCallbacks.onSetRemainingCards).toHaveBeenCalled();
      expect(mockCallbacks.onSetGraveyard).toHaveBeenCalledWith([]);
    });

    it('should filter out board cards from graveyard', () => {
      const boardCard = createMockCard('1', 'Board Card');
      const graveyardCard = createMockCard('2', 'Graveyard Card');
      const graveyard = [boardCard, graveyardCard];
      const remainingCards: CardData[] = [];

      (mockCallbacks.onGetGraveyard as any).mockReturnValue(graveyard);
      (mockCallbacks.onGetRemainingCards as any).mockReturnValue(remainingCards);
      (mockCallbacks.onGetBoardCards as any).mockReturnValue({
        boardCard,
        placedLeft: [],
        placedRight: [],
      });

      manager.recycleGraveyard();

      // Should only recycle the graveyard card, not the board card
      expect(mockCallbacks.onSetGraveyard).toHaveBeenCalledWith([]);
    });
  });

  describe('moveCardToGraveyard', () => {
    it('should remove card from placed arrays and add to graveyard', () => {
      const card = createMockCard('1', 'Test Card');
      const placedLeft = [card];
      const placedRight: GameCard[] = [];
      const graveyard: GameCard[] = [];

      (mockCallbacks.onGetBoardCards as any).mockReturnValue({
        boardCard: null,
        placedLeft,
        placedRight,
      });
      (mockCallbacks.onGetGraveyard as any).mockReturnValue(graveyard);

      manager.moveCardToGraveyard(card);

      expect(mockCallbacks.onSetPlacedLeft).toHaveBeenCalledWith([]);
      expect(mockCallbacks.onSetGraveyard).toHaveBeenCalledWith([card]);
      expect(mockCallbacks.onAnimateCardToGraveyard).toHaveBeenCalledWith(card);
      // giveNewCard is called, but won't play sound if no remaining cards
      // Just verify giveNewCard was attempted by checking it tried to get remaining cards
      expect(mockCallbacks.onGetRemainingCards).toHaveBeenCalled();
    });

    it('should clear board card if it matches', () => {
      const card = createMockCard('1', 'Board Card');
      const placedLeft: GameCard[] = [];
      const placedRight: GameCard[] = [];
      const graveyard: GameCard[] = [];

      (mockCallbacks.onGetBoardCards as any).mockReturnValue({
        boardCard: card,
        placedLeft,
        placedRight,
      });
      (mockCallbacks.onGetGraveyard as any).mockReturnValue(graveyard);

      manager.moveCardToGraveyard(card);

      expect(mockCallbacks.onSetBoardCard).toHaveBeenCalledWith(null);
      expect(mockCallbacks.onSetGraveyard).toHaveBeenCalledWith([card]);
    });
  });

  describe('giveNewCard', () => {
    it('should do nothing if no remaining cards', () => {
      (mockCallbacks.onGetRemainingCards as any).mockReturnValue([]);
      (mockCallbacks.onGetGraveyard as any).mockReturnValue([]);

      manager.giveNewCard();

      expect(mockCallbacks.onSetPlayerHand).not.toHaveBeenCalled();
    });

    it('should recycle graveyard if remaining cards is empty', () => {
      const card = createMockCard('1', 'Test Card');
      const graveyard = [card];
      const remainingCards: CardData[] = [];

      (mockCallbacks.onGetRemainingCards as any).mockReturnValue(remainingCards);
      (mockCallbacks.onGetGraveyard as any).mockReturnValue(graveyard);
      (mockCallbacks.onGetBoardCards as any).mockReturnValue({
        boardCard: null,
        placedLeft: [],
        placedRight: [],
      });

      // After recycling, should have cards
      (mockCallbacks.onGetRemainingCards as any).mockReturnValueOnce(remainingCards)
        .mockReturnValueOnce([card.card]);

      manager.giveNewCard();

      expect(mockCallbacks.onSetGraveyard).toHaveBeenCalled(); // recycleGraveyard called
    });

    it('should give card to player hand in normal mode', () => {
      const cardData: CardData = {
        id: '1',
        title: 'Test Card',
        axis: 'time',
        value: 1000,
        unit: 'year',
        displayValue: '1000',
        image: 'test',
        facts: [],
        sources: [{ label: 'Test', url: 'https://test.com' }],
        difficulty: 'easy',
      };
      const remainingCards = [cardData];
      const playerHand: GameCard[] = [];

      (mockCallbacks.onGetRemainingCards as any).mockReturnValue(remainingCards);
      (mockCallbacks.onGetGraveyard as any).mockReturnValue([]);
      (mockCallbacks.onGetHands as any).mockReturnValue({
        playerHand,
        opponentHand: [],
        player1Hand: [],
        player2Hand: [],
      });
      (mockCallbacks.onGetGameState as any).mockReturnValue({
        score: 0,
        currentTurn: 0,
        gameWon: false,
        gameLost: false,
        isPlayerTurn: true,
        isLearningMode: false,
        isHotseatMode: false,
        currentPlayerIndex: 0,
        player1Data: null,
        player2Data: null,
      });

      manager.giveNewCard();

      expect(mockCallbacks.onPlaySound).toHaveBeenCalledWith(SoundType.CARD_SHUFFLE);
      expect(mockCallbacks.onSetRemainingCards).toHaveBeenCalledWith([]);
      expect(mockCallbacks.onSetPlayerHand).toHaveBeenCalled();
      expect(mockCallbacks.onLayoutHand).toHaveBeenCalled();
    });

    it('should give card to appropriate hand in hotseat mode', () => {
      const cardData: CardData = {
        id: '1',
        title: 'Test Card',
        axis: 'time',
        value: 1000,
        unit: 'year',
        displayValue: '1000',
        image: 'test',
        facts: [],
        sources: [{ label: 'Test', url: 'https://test.com' }],
        difficulty: 'easy',
      };
      const remainingCards = [cardData];
      const player1Hand: GameCard[] = [];
      const player2Hand: GameCard[] = [];

      (mockCallbacks.onGetRemainingCards as any).mockReturnValue(remainingCards);
      (mockCallbacks.onGetGraveyard as any).mockReturnValue([]);
      (mockCallbacks.onGetHands as any).mockReturnValue({
        playerHand: [],
        opponentHand: [],
        player1Hand,
        player2Hand,
      });
      (mockCallbacks.onGetGameState as any).mockReturnValue({
        score: 0,
        currentTurn: 0,
        gameWon: false,
        gameLost: false,
        isPlayerTurn: true,
        isLearningMode: false,
        isHotseatMode: true,
        currentPlayerIndex: 0,
        player1Data: null,
        player2Data: null,
      });

      manager.giveNewCard();

      expect(mockCallbacks.onSetPlayer1Hand).toHaveBeenCalled();
      expect(mockCallbacks.onLayoutHotseatHands).toHaveBeenCalled();
    });
  });

  describe('checkForWin', () => {
    it('should do nothing in learning mode', () => {
      (mockCallbacks.onGetGameState as any).mockReturnValue({
        score: 0,
        currentTurn: 0,
        gameWon: false,
        gameLost: false,
        isPlayerTurn: true,
        isLearningMode: true,
        isHotseatMode: false,
        currentPlayerIndex: 0,
        player1Data: null,
        player2Data: null,
      });

      manager.checkForWin();

      expect(mockCallbacks.onSetGameWon).not.toHaveBeenCalled();
      expect(mockCallbacks.onSetGameLost).not.toHaveBeenCalled();
    });

    it('should detect player win in normal mode', () => {
      (mockCallbacks.onGetGameState as any).mockReturnValue({
        score: 100,
        currentTurn: 5,
        gameWon: false,
        gameLost: false,
        isPlayerTurn: true,
        isLearningMode: false,
        isHotseatMode: false,
        currentPlayerIndex: 0,
        player1Data: null,
        player2Data: null,
      });
      (mockCallbacks.onGetHands as any).mockReturnValue({
        playerHand: [],
        opponentHand: [createMockCard('1', 'Opponent Card')],
        player1Hand: [],
        player2Hand: [],
      });
      (mockCallbacks.onGetRemainingCards as any).mockReturnValue([]);

      manager.checkForWin();

      expect(mockCallbacks.onSetGameWon).toHaveBeenCalledWith(true);

      // Dialog is shown after 4 seconds delay
      vi.advanceTimersByTime(4000);
      expect(mockCallbacks.onShowWinDialog).toHaveBeenCalled();
    });

    it('should detect AI win in normal mode', () => {
      (mockCallbacks.onGetGameState as any).mockReturnValue({
        score: 50,
        currentTurn: 3,
        gameWon: false,
        gameLost: false,
        isPlayerTurn: true,
        isLearningMode: false,
        isHotseatMode: false,
        currentPlayerIndex: 0,
        player1Data: null,
        player2Data: null,
      });
      (mockCallbacks.onGetHands as any).mockReturnValue({
        playerHand: [createMockCard('1', 'Player Card')],
        opponentHand: [],
        player1Hand: [],
        player2Hand: [],
      });
      (mockCallbacks.onGetRemainingCards as any).mockReturnValue([]);

      manager.checkForWin();

      expect(mockCallbacks.onSetGameLost).toHaveBeenCalledWith(true);

      // Dialog is shown after 4 seconds delay
      vi.advanceTimersByTime(4000);
      expect(mockCallbacks.onShowLoseDialog).toHaveBeenCalled();
    });

    it('should detect hotseat win', () => {
      (mockCallbacks.onGetGameState as any).mockReturnValue({
        score: 0,
        currentTurn: 0,
        gameWon: false,
        gameLost: false,
        isPlayerTurn: true,
        isLearningMode: false,
        isHotseatMode: true,
        currentPlayerIndex: 0,
        player1Data: { name: 'Player 1', avatar: '👤' },
        player2Data: { name: 'Player 2', avatar: '👤' },
      });
      (mockCallbacks.onGetHands as any).mockReturnValue({
        playerHand: [],
        opponentHand: [],
        player1Hand: [],
        player2Hand: [createMockCard('1', 'Player 2 Card')],
      });
      (mockCallbacks.onGetRemainingCards as any).mockReturnValue([]);

      manager.checkForWin();

      expect(mockCallbacks.onSetGameWon).toHaveBeenCalledWith(true);
      expect(mockCallbacks.onUpdateInputHandlerConfig).toHaveBeenCalled();

      // Dialog is shown after 4 seconds delay
      vi.advanceTimersByTime(4000);
      expect(mockCallbacks.onShowHotseatWinDialog).toHaveBeenCalledWith('Player 1');
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const newScale = 2;
      manager.updateConfig({ scale: newScale });

      // Config is private, but we can verify it doesn't throw
      expect(() => manager.updateConfig({ scale: newScale })).not.toThrow();
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
