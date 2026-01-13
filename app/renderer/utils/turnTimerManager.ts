import { GameCard } from '@/game/Card';
import { logger } from '@/utils/logger';

/**
 * Callbacks for TurnTimerManager to interact with game state
 */
export interface TurnTimerManagerCallbacks {
  /** Get current game state */
  onGetGameState: () => {
    gameDifficulty: 'easy' | 'medium' | 'hard';
    isLearningMode: boolean;
    isHotseatMode: boolean;
    isPlayerTurn: boolean;
    currentTurn: number;
  };

  /** Get player hands for card counts */
  onGetHands: () => {
    playerHand: GameCard[];
    opponentHand: GameCard[];
  };

  /** Get player data for hotseat mode */
  onGetPlayerData: () => {
    player1Data: { name: string; avatar: string } | null;
    player2Data: { name: string; avatar: string } | null;
    currentPlayerIndex: number;
  };

  /** Get current turn timer value */
  onGetTurnTimer: () => number;

  /** Set turn timer value */
  onSetTurnTimer: (timer: number) => void;

  /** Set turn text display */
  onSetTurnText: (text: string) => void;

  /** Set player turn state */
  onSetIsPlayerTurn: (isPlayerTurn: boolean) => void;

  /** Set current turn number */
  onSetCurrentTurn: (turn: number) => void;

  /** Update input handler config */
  onUpdateInputHandlerConfig: () => void;

  /** Trigger AI turn */
  onAITurn: (opponentHand: GameCard[]) => void;
}

/**
 * Configuration for TurnTimerManager
 */
export interface TurnTimerManagerConfig {
  callbacks: TurnTimerManagerCallbacks;
}

/**
 * TurnTimerManager - Handles turn timer logic for single-player (AI) mode only
 */
export class TurnTimerManager {
  private config: TurnTimerManagerConfig;

  private turnTimerInterval: number | null = null;

  constructor(config: TurnTimerManagerConfig) {
    this.config = config;
  }

  /**
   * Get difficulty-based timer duration
   * @param difficulty - Game difficulty level
   * @returns Timer duration in seconds
   */
  public getDifficultyTimer(difficulty: 'easy' | 'medium' | 'hard'): number {
    switch (difficulty) {
      case 'easy':
        return 30;
      case 'medium':
        return 20;
      case 'hard':
        return 10;
      default:
        return 10;
    }
  }

  /**
   * Update turn text display
   * Handles all modes: learning (empty), hotseat (player name), single-player (timer text)
   */
  public updateTurnText(): void {
    const gameState = this.config.callbacks.onGetGameState();

    // In learning mode, don't show turn text
    if (gameState.isLearningMode) {
      this.config.callbacks.onSetTurnText('');
      return;
    }

    // LAN mode is handled separately - skip here

    // In hotseat mode, show current player name (no timer)
    if (gameState.isHotseatMode) {
      const playerData = this.config.callbacks.onGetPlayerData();
      const currentPlayerName = playerData.currentPlayerIndex === 0
        ? (playerData.player1Data?.name || 'Player 1')
        : (playerData.player2Data?.name || 'Player 2');
      this.config.callbacks.onSetTurnText(`🎮 ${currentPlayerName}'s turn`);
      return;
    }

    // Single-player (AI) mode: show timer text
    const hands = this.config.callbacks.onGetHands();
    const currentTimer = this.getCurrentTimer();

    if (gameState.isPlayerTurn) {
      this.config.callbacks.onSetTurnText(
        `Your Turn (${hands.playerHand.length} cards) - ${currentTimer}s`,
      );
    } else {
      this.config.callbacks.onSetTurnText(
        `Opponent's Turn (${hands.opponentHand.length} cards) - ${currentTimer}s`,
      );
    }
  }

  /**
   * Start turn timer (only in single-player AI mode)
   */
  public startTurnTimer(): void {
    const gameState = this.config.callbacks.onGetGameState();

    // In learning mode or hotseat mode, no timer
    if (gameState.isLearningMode || gameState.isHotseatMode) {
      logger.debug({
        scope: 'renderer/timer',
        msg: 'timer skipped (learning or hotseat mode)',
        meta: {
          isLearningMode: gameState.isLearningMode,
          isHotseatMode: gameState.isHotseatMode,
        },
      });
      return;
    }

    // Stop any existing timer first
    this.stopTurnTimer();

    const difficultyTimer = this.getDifficultyTimer(gameState.gameDifficulty);
    this.config.callbacks.onSetTurnTimer(difficultyTimer);
    this.updateTurnText();

    logger.info({
      scope: 'renderer/timer',
      msg: 'turn timer started',
      meta: {
        difficulty: gameState.gameDifficulty,
        timer: difficultyTimer,
        turn: gameState.currentTurn,
      },
    });

    this.turnTimerInterval = window.setInterval(() => {
      const currentTimer = this.getCurrentTimer();
      const newTimer = currentTimer - 1;

      this.config.callbacks.onSetTurnTimer(newTimer);
      this.updateTurnText();

      if (newTimer <= 0) {
        this.endTurn();
      }
    }, 1000);
  }

  /**
   * Stop turn timer
   */
  public stopTurnTimer(): void {
    if (this.turnTimerInterval) {
      clearInterval(this.turnTimerInterval);
      this.turnTimerInterval = null;

      logger.debug({
        scope: 'renderer/timer',
        msg: 'turn timer stopped',
      });
    }
  }

  /**
   * End current turn (time ran out)
   * Only works in single-player (AI) mode
   */
  public endTurn(): void {
    this.stopTurnTimer();

    const gameState = this.config.callbacks.onGetGameState();

    // In learning mode, don't end turns
    if (gameState.isLearningMode) {
      logger.info({
        scope: 'renderer/timer',
        msg: 'turn end skipped in learning mode',
        meta: { isLearningMode: true },
      });
      return;
    }

    if (gameState.isPlayerTurn) {
      // Player's time ran out - switch to AI turn
      logger.info({
        scope: 'renderer/timer',
        msg: 'player turn timed out, switching to AI',
        meta: { turn: gameState.currentTurn },
      });

      this.config.callbacks.onSetIsPlayerTurn(false);
      this.config.callbacks.onUpdateInputHandlerConfig();
      this.config.callbacks.onSetCurrentTurn(gameState.currentTurn + 1);
      this.updateTurnText();

      // Let AI play immediately (only if not already in progress)
      const hands = this.config.callbacks.onGetHands();
      if (hands.opponentHand.length > 0) {
        setTimeout(() => {
          this.config.callbacks.onAITurn(hands.opponentHand);
        }, 500);
      }
    } else {
      // AI's time ran out - switch back to player
      logger.info({
        scope: 'renderer/timer',
        msg: 'AI turn timed out, switching to player',
        meta: { turn: gameState.currentTurn },
      });

      this.config.callbacks.onSetIsPlayerTurn(true);
      this.config.callbacks.onUpdateInputHandlerConfig();
      this.updateTurnText();
    }
  }

  /**
   * Get current timer value (via callback)
   */
  private getCurrentTimer(): number {
    return this.config.callbacks.onGetTurnTimer();
  }
}
