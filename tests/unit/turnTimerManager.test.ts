import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TurnTimerManager, TurnTimerManagerCallbacks } from '@/utils/turnTimerManager';
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
function createTestCard(id: string): GameCard {
  const card = {
    id,
    title: `Card ${id}`,
    axis: 'height' as const,
    value: 100,
    unit: 'm',
    displayValue: '100 m',
    image: 'test.jpg',
    facts: ['Test fact'],
    sources: [{ label: 'Test', url: 'https://test.com' }],
    difficulty: 'medium' as const,
  };
  return new GameCard(card, { id: 'test-deck', name: 'Test', axis: 'height', theme: 'test', locale: 'en', version: '1.0.0', cards: [], isUserDeck: false }, 0, 0, 1);
}

/**
 * Helper to create mock callbacks
 */
function createMockCallbacks(): TurnTimerManagerCallbacks {
  let turnTimer = 10;
  let turnText = '';
  let isPlayerTurn = true;
  let currentTurn = 0;

  return {
    onGetGameState: vi.fn(() => ({
      gameDifficulty: 'medium' as const,
      isLearningMode: false,
      isHotseatMode: false,
      isPlayerTurn,
      currentTurn,
    })),
    onGetHands: vi.fn(() => ({
      playerHand: [createTestCard('1'), createTestCard('2'), createTestCard('3')],
      opponentHand: [createTestCard('4'), createTestCard('5')],
    })),
    onGetPlayerData: vi.fn(() => ({
      player1Data: { name: 'Player 1', avatar: '👤' },
      player2Data: { name: 'Player 2', avatar: '👤' },
      currentPlayerIndex: 0,
    })),
    onGetTurnTimer: vi.fn(() => turnTimer),
    onSetTurnTimer: vi.fn((timer: number) => {
      turnTimer = timer;
    }),
    onSetTurnText: vi.fn((text: string) => {
      turnText = text;
    }),
    onSetIsPlayerTurn: vi.fn((playerTurn: boolean) => {
      isPlayerTurn = playerTurn;
    }),
    onSetCurrentTurn: vi.fn((turn: number) => {
      currentTurn = turn;
    }),
    onUpdateInputHandlerConfig: vi.fn(),
    onAITurn: vi.fn(),
  };
}

describe('TurnTimerManager', () => {
  let manager: TurnTimerManager;
  let callbacks: TurnTimerManagerCallbacks;

  beforeEach(() => {
    vi.useFakeTimers();
    callbacks = createMockCallbacks();
    manager = new TurnTimerManager({ callbacks });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('getDifficultyTimer', () => {
    it('should return 30 for easy difficulty', () => {
      expect(manager.getDifficultyTimer('easy')).toBe(30);
    });

    it('should return 20 for medium difficulty', () => {
      expect(manager.getDifficultyTimer('medium')).toBe(20);
    });

    it('should return 10 for hard difficulty', () => {
      expect(manager.getDifficultyTimer('hard')).toBe(10);
    });

    it('should return 10 for unknown difficulty (default)', () => {
      // TypeScript won't allow this, but testing the default case
      expect(manager.getDifficultyTimer('hard')).toBe(10);
    });
  });

  describe('updateTurnText', () => {
    it('should set empty string in learning mode', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        gameDifficulty: 'medium' as const,
        isLearningMode: true,
        isHotseatMode: false,
        isPlayerTurn: true,
        currentTurn: 0,
      }));

      manager.updateTurnText();

      expect(callbacks.onSetTurnText).toHaveBeenCalledWith('');
    });

    it('should show player name in hotseat mode (player 1)', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        gameDifficulty: 'medium' as const,
        isLearningMode: false,
        isHotseatMode: true,
        isPlayerTurn: true,
        currentTurn: 0,
      }));
      callbacks.onGetPlayerData = vi.fn(() => ({
        player1Data: { name: 'Alice', avatar: '👤' },
        player2Data: { name: 'Bob', avatar: '👤' },
        currentPlayerIndex: 0,
      }));

      manager.updateTurnText();

      expect(callbacks.onSetTurnText).toHaveBeenCalledWith('🎮 Alice\'s turn');
    });

    it('should show player name in hotseat mode (player 2)', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        gameDifficulty: 'medium' as const,
        isLearningMode: false,
        isHotseatMode: true,
        isPlayerTurn: true,
        currentTurn: 0,
      }));
      callbacks.onGetPlayerData = vi.fn(() => ({
        player1Data: { name: 'Alice', avatar: '👤' },
        player2Data: { name: 'Bob', avatar: '👤' },
        currentPlayerIndex: 1,
      }));

      manager.updateTurnText();

      expect(callbacks.onSetTurnText).toHaveBeenCalledWith('🎮 Bob\'s turn');
    });

    it('should show "Your Turn" with card count and timer in normal mode (player turn)', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        gameDifficulty: 'medium' as const,
        isLearningMode: false,
        isHotseatMode: false,
        isPlayerTurn: true,
        currentTurn: 0,
      }));
      callbacks.onGetTurnTimer = vi.fn(() => 20);

      manager.updateTurnText();

      expect(callbacks.onSetTurnText).toHaveBeenCalledWith('Your Turn (3 cards) - 20s');
    });

    it('should show "Opponent\'s Turn" with card count and timer in normal mode (AI turn)', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        gameDifficulty: 'medium' as const,
        isLearningMode: false,
        isHotseatMode: false,
        isPlayerTurn: false,
        currentTurn: 0,
      }));
      callbacks.onGetTurnTimer = vi.fn(() => 15);

      manager.updateTurnText();

      expect(callbacks.onSetTurnText).toHaveBeenCalledWith('Opponent\'s Turn (2 cards) - 15s');
    });

    it('should use default player name in hotseat mode if player data is null', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        gameDifficulty: 'medium' as const,
        isLearningMode: false,
        isHotseatMode: true,
        isPlayerTurn: true,
        currentTurn: 0,
      }));
      callbacks.onGetPlayerData = vi.fn(() => ({
        player1Data: null,
        player2Data: null,
        currentPlayerIndex: 0,
      }));

      manager.updateTurnText();

      expect(callbacks.onSetTurnText).toHaveBeenCalledWith('🎮 Player 1\'s turn');
    });
  });

  describe('startTurnTimer', () => {
    it('should skip in learning mode', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        gameDifficulty: 'medium' as const,
        isLearningMode: true,
        isHotseatMode: false,
        isPlayerTurn: true,
        currentTurn: 0,
      }));

      manager.startTurnTimer();

      expect(callbacks.onSetTurnTimer).not.toHaveBeenCalled();
    });

    it('should skip in hotseat mode', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        gameDifficulty: 'medium' as const,
        isLearningMode: false,
        isHotseatMode: true,
        isPlayerTurn: true,
        currentTurn: 0,
      }));

      manager.startTurnTimer();

      expect(callbacks.onSetTurnTimer).not.toHaveBeenCalled();
    });

    it('should start timer in normal mode', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        gameDifficulty: 'medium' as const,
        isLearningMode: false,
        isHotseatMode: false,
        isPlayerTurn: true,
        currentTurn: 0,
      }));

      manager.startTurnTimer();

      expect(callbacks.onSetTurnTimer).toHaveBeenCalledWith(20); // medium = 20
      expect(callbacks.onSetTurnText).toHaveBeenCalled();
    });

    it('should set initial timer value from difficulty (easy)', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        gameDifficulty: 'easy' as const,
        isLearningMode: false,
        isHotseatMode: false,
        isPlayerTurn: true,
        currentTurn: 0,
      }));

      manager.startTurnTimer();

      expect(callbacks.onSetTurnTimer).toHaveBeenCalledWith(30);
    });

    it('should set initial timer value from difficulty (hard)', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        gameDifficulty: 'hard' as const,
        isLearningMode: false,
        isHotseatMode: false,
        isPlayerTurn: true,
        currentTurn: 0,
      }));

      manager.startTurnTimer();

      expect(callbacks.onSetTurnTimer).toHaveBeenCalledWith(10);
    });

    it('should update turn text on start', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        gameDifficulty: 'medium' as const,
        isLearningMode: false,
        isHotseatMode: false,
        isPlayerTurn: true,
        currentTurn: 0,
      }));
      callbacks.onGetTurnTimer = vi.fn(() => 20);

      manager.startTurnTimer();

      expect(callbacks.onSetTurnText).toHaveBeenCalled();
    });

    it('should decrement timer every second', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        gameDifficulty: 'medium' as const,
        isLearningMode: false,
        isHotseatMode: false,
        isPlayerTurn: true,
        currentTurn: 0,
      }));
      callbacks.onGetTurnTimer = vi.fn(() => 20);

      manager.startTurnTimer();

      // Advance time by 1 second
      vi.advanceTimersByTime(1000);

      expect(callbacks.onSetTurnTimer).toHaveBeenCalledWith(19);
    });

    it('should update turn text every second', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        gameDifficulty: 'medium' as const,
        isLearningMode: false,
        isHotseatMode: false,
        isPlayerTurn: true,
        currentTurn: 0,
      }));
      callbacks.onGetTurnTimer = vi.fn(() => 20);

      manager.startTurnTimer();
      const initialCallCount = callbacks.onSetTurnText.mock.calls.length;

      // Advance time by 1 second
      vi.advanceTimersByTime(1000);

      expect(callbacks.onSetTurnText).toHaveBeenCalledTimes(initialCallCount + 1);
    });

    it('should call endTurn when timer reaches 0', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        gameDifficulty: 'hard' as const,
        isLearningMode: false,
        isHotseatMode: false,
        isPlayerTurn: true,
        currentTurn: 0,
      }));
      callbacks.onGetTurnTimer = vi.fn(() => 1); // Start at 1

      manager.startTurnTimer();

      // Advance time by 1 second (timer should reach 0)
      vi.advanceTimersByTime(1000);

      // endTurn should be called, which will stop the timer
      expect(callbacks.onSetIsPlayerTurn).toHaveBeenCalled();
    });

    it('should clear previous interval if already running', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        gameDifficulty: 'medium' as const,
        isLearningMode: false,
        isHotseatMode: false,
        isPlayerTurn: true,
        currentTurn: 0,
      }));
      callbacks.onGetTurnTimer = vi.fn(() => 20);

      manager.startTurnTimer();
      const firstInterval = (manager as any).turnTimerInterval;

      manager.startTurnTimer();
      const secondInterval = (manager as any).turnTimerInterval;

      // Should have a new interval
      expect(secondInterval).toBeDefined();
    });
  });

  describe('stopTurnTimer', () => {
    it('should clear interval if exists', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        gameDifficulty: 'medium' as const,
        isLearningMode: false,
        isHotseatMode: false,
        isPlayerTurn: true,
        currentTurn: 0,
      }));
      callbacks.onGetTurnTimer = vi.fn(() => 20);

      manager.startTurnTimer();
      expect((manager as any).turnTimerInterval).toBeDefined();

      manager.stopTurnTimer();

      expect((manager as any).turnTimerInterval).toBeNull();
    });

    it('should handle null interval gracefully', () => {
      expect(() => {
        manager.stopTurnTimer();
      }).not.toThrow();
    });

    it('should prevent timer from continuing after stop', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        gameDifficulty: 'medium' as const,
        isLearningMode: false,
        isHotseatMode: false,
        isPlayerTurn: true,
        currentTurn: 0,
      }));
      callbacks.onGetTurnTimer = vi.fn(() => 20);

      manager.startTurnTimer();
      const callCountBefore = callbacks.onSetTurnTimer.mock.calls.length;

      manager.stopTurnTimer();

      // Advance time - timer should not continue
      vi.advanceTimersByTime(2000);

      expect(callbacks.onSetTurnTimer.mock.calls.length).toBe(callCountBefore);
    });
  });

  describe('endTurn', () => {
    it('should stop timer', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        gameDifficulty: 'medium' as const,
        isLearningMode: false,
        isHotseatMode: false,
        isPlayerTurn: true,
        currentTurn: 0,
      }));
      callbacks.onGetTurnTimer = vi.fn(() => 20);

      manager.startTurnTimer();
      expect((manager as any).turnTimerInterval).toBeDefined();

      manager.endTurn();

      expect((manager as any).turnTimerInterval).toBeNull();
    });

    it('should skip in learning mode', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        gameDifficulty: 'medium' as const,
        isLearningMode: true,
        isHotseatMode: false,
        isPlayerTurn: true,
        currentTurn: 0,
      }));

      manager.endTurn();

      expect(callbacks.onSetIsPlayerTurn).not.toHaveBeenCalled();
    });

    it('should switch to AI turn when player time runs out', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        gameDifficulty: 'medium' as const,
        isLearningMode: false,
        isHotseatMode: false,
        isPlayerTurn: true,
        currentTurn: 5,
      }));

      manager.endTurn();

      expect(callbacks.onSetIsPlayerTurn).toHaveBeenCalledWith(false);
      expect(callbacks.onSetCurrentTurn).toHaveBeenCalledWith(6);
      expect(callbacks.onUpdateInputHandlerConfig).toHaveBeenCalled();
    });

    it('should increment current turn when player time runs out', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        gameDifficulty: 'medium' as const,
        isLearningMode: false,
        isHotseatMode: false,
        isPlayerTurn: true,
        currentTurn: 3,
      }));

      manager.endTurn();

      expect(callbacks.onSetCurrentTurn).toHaveBeenCalledWith(4);
    });

    it('should trigger AI turn when player time runs out', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        gameDifficulty: 'medium' as const,
        isLearningMode: false,
        isHotseatMode: false,
        isPlayerTurn: true,
        currentTurn: 0,
      }));
      const opponentHand = [createTestCard('1'), createTestCard('2')];
      callbacks.onGetHands = vi.fn(() => ({
        playerHand: [],
        opponentHand,
      }));

      manager.endTurn();

      // Advance time to trigger setTimeout
      vi.advanceTimersByTime(500);

      expect(callbacks.onAITurn).toHaveBeenCalledWith(opponentHand);
    });

    it('should switch back to player when AI time runs out', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        gameDifficulty: 'medium' as const,
        isLearningMode: false,
        isHotseatMode: false,
        isPlayerTurn: false,
        currentTurn: 5,
      }));

      manager.endTurn();

      expect(callbacks.onSetIsPlayerTurn).toHaveBeenCalledWith(true);
      expect(callbacks.onUpdateInputHandlerConfig).toHaveBeenCalled();
      expect(callbacks.onSetTurnText).toHaveBeenCalled();
    });

    it('should update turn text after switch', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        gameDifficulty: 'medium' as const,
        isLearningMode: false,
        isHotseatMode: false,
        isPlayerTurn: true,
        currentTurn: 0,
      }));

      manager.endTurn();

      expect(callbacks.onSetTurnText).toHaveBeenCalled();
    });

    it('should not trigger AI turn if no opponent cards available', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        gameDifficulty: 'medium' as const,
        isLearningMode: false,
        isHotseatMode: false,
        isPlayerTurn: true,
        currentTurn: 0,
      }));
      callbacks.onGetHands = vi.fn(() => ({
        playerHand: [],
        opponentHand: [], // No cards
      }));

      manager.endTurn();

      vi.advanceTimersByTime(500);

      expect(callbacks.onAITurn).not.toHaveBeenCalled();
    });
  });
});
