import { GameCard } from '@/game/Card';
import { Card as CardData } from '@/data/types';
import { logger } from '@/utils/logger';
import { recycleGraveyard as recycleGraveyardUtil } from '@/utils/cardLayout';
import { SoundType } from '@/utils/soundManager';

/**
 * Callbacks for GameStateManager to communicate with main app
 */
export interface GameStateManagerCallbacks {
  // State getters
  onGetBoardCards: () => { boardCard: GameCard | null; placedLeft: GameCard[]; placedRight: GameCard[] };
  onGetHands: () => {
    playerHand: GameCard[];
    opponentHand: GameCard[];
    player1Hand: GameCard[];
    player2Hand: GameCard[];
  };
  onGetGraveyard: () => GameCard[];
  onGetRemainingCards: () => CardData[];
  onGetGameState: () => {
    score: number;
    currentTurn: number;
    gameWon: boolean;
    gameLost: boolean;
    isPlayerTurn: boolean;
    isLearningMode: boolean;
    isHotseatMode: boolean;
    currentPlayerIndex: number;
    player1Data: { name: string; avatar: string } | null;
    player2Data: { name: string; avatar: string } | null;
  };

  // State setters
  onSetBoardCard: (card: GameCard | null) => void;
  onSetPlacedLeft: (cards: GameCard[]) => void;
  onSetPlacedRight: (cards: GameCard[]) => void;
  onSetGraveyard: (cards: GameCard[]) => void;
  onSetRemainingCards: (cards: CardData[]) => void;
  onSetPlayerHand: (cards: GameCard[]) => void;
  onSetOpponentHand: (cards: GameCard[]) => void;
  onSetPlayer1Hand: (cards: GameCard[]) => void;
  onSetPlayer2Hand: (cards: GameCard[]) => void;
  onSetScore: (score: number) => void;
  onSetGameWon: (won: boolean) => void;
  onSetGameLost: (lost: boolean) => void;
  onSetIsPlayerTurn: (isPlayerTurn: boolean) => void;
  onSetCurrentTurn: (turn: number) => void;

  // Layout callbacks
  onLayoutAxisCards: () => void;
  onLayoutHand: () => void;
  onLayoutHotseatHands: () => void;

  // Animation callbacks
  onAnimateCardToGraveyard: (card: GameCard) => void;
  onAnimateCardToHand: (card: GameCard) => void;

  // Sound callbacks
  onPlaySound: (soundType: SoundType) => void;

  // Turn management callbacks
  onTurnComplete: () => void;
  onStartTurnTimer: () => void;
  onStopTurnTimer: () => void;
  onUpdateInputHandlerConfig: () => void;

  // AI callbacks
  onAITurn: (opponentHand: GameCard[]) => void;
  onSetAITurnInProgress: (inProgress: boolean) => void;

  // UI callbacks
  onShowPlayerSwitchOverlay: () => void;
  onShowHotseatWinDialog: (winnerName: string) => void;
  onShowWinDialog: () => void;
  onShowLoseDialog: () => void;
}

/**
   * Configuration for GameStateManager
   */
export interface GameStateManagerConfig {
  canvas: HTMLCanvasElement;
  scale: number;
  deck: any;
  callbacks: GameStateManagerCallbacks;
  onGetScale?: () => number; // Optional callback to get current scale
}

/**
 * Game State Manager - Handles all game state logic
 * Manages card placement, scoring, win conditions, graveyard, and card distribution
 */
export class GameStateManager {
  private config: GameStateManagerConfig;

  constructor(config: GameStateManagerConfig) {
    this.config = config;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<GameStateManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Recycle graveyard cards back to deck when deck is empty
   * Moves cards in their current order (no shuffle for LAN sync compatibility)
   * IMPORTANT: Only recycles cards that are actually in the graveyard array,
   * NOT cards that are on the board (boardCard, placedLeft, placedRight)
   */
  recycleGraveyard(): void {
    const graveyard = this.config.callbacks.onGetGraveyard();
    if (graveyard.length === 0) return;

    // In learning mode, graveyard recycling is allowed when deck is empty
    // This is handled by giveNewCard() which checks skipGraveyardRecycle flag
    // This method can be called directly when deck is empty and we need cards

    const boardCards = this.config.callbacks.onGetBoardCards();

    // Safety check: Ensure no board cards are in the graveyard
    // This should never happen, but we check to prevent bugs
    const boardCardIds = new Set<string>();
    if (boardCards.boardCard) {
      boardCardIds.add(boardCards.boardCard.card.id);
    }
    boardCards.placedLeft.forEach((card) => boardCardIds.add(card.card.id));
    boardCards.placedRight.forEach((card) => boardCardIds.add(card.card.id));

    // Filter out any board cards that might have been incorrectly added to graveyard
    const validGraveyard = graveyard.filter(
      (card) => !boardCardIds.has(card.card.id),
    );

    if (validGraveyard.length !== graveyard.length) {
      logger.warn({
        scope: 'renderer/gamestate',
        msg: 'found board cards in graveyard during recycle - filtering them out',
        meta: {
          graveyardSize: graveyard.length,
          validGraveyardSize: validGraveyard.length,
          boardCardCount: boardCardIds.size,
        },
      });
    }

    // Use utility function to recycle only valid graveyard cards
    const remainingCards = this.config.callbacks.onGetRemainingCards();
    const newRemainingCards = recycleGraveyardUtil(validGraveyard, remainingCards);

    // Update state
    this.config.callbacks.onSetRemainingCards(newRemainingCards);
    this.config.callbacks.onSetGraveyard([]);
  }

  /**
   * Move a card to graveyard (for normal mode incorrect cards or learning mode Weiter button)
   * @param skipGraveyardRecycle - If true, skip graveyard recycling (used in learning mode)
   */
  moveCardToGraveyard(card: GameCard, skipGraveyardRecycle: boolean = false): void {
    const boardCards = this.config.callbacks.onGetBoardCards();
    const graveyard = this.config.callbacks.onGetGraveyard();
    const gameState = this.config.callbacks.onGetGameState();

    // Remove from appropriate side
    const newPlacedLeft = boardCards.placedLeft.filter((c) => c !== card);
    const newPlacedRight = boardCards.placedRight.filter((c) => c !== card);

    // If it's the board card, clear it
    let newBoardCard = boardCards.boardCard;
    if (boardCards.boardCard === card) {
      newBoardCard = null;
    }

    // Update board state
    this.config.callbacks.onSetPlacedLeft(newPlacedLeft);
    this.config.callbacks.onSetPlacedRight(newPlacedRight);
    this.config.callbacks.onSetBoardCard(newBoardCard);

    // Add to graveyard and animate
    logger.info({
      scope: 'renderer/gamestate',
      msg: 'moving incorrect card to graveyard',
      meta: {
        cardTitle: card.card.title,
        isCorrect: card.isCorrect,
        graveyardSizeBefore: graveyard.length,
        isLearningMode: gameState.isLearningMode,
        skipGraveyardRecycle,
      },
    });

    const newGraveyard = [...graveyard, card];
    this.config.callbacks.onSetGraveyard(newGraveyard);
    this.config.callbacks.onAnimateCardToGraveyard(card);

    // Give player a new card
    // In learning mode, don't recycle graveyard - cards should stay in graveyard
    this.giveNewCard(skipGraveyardRecycle || gameState.isLearningMode);

    logger.info({
      scope: 'renderer/gamestate',
      msg: 'incorrect card moved to graveyard',
      meta: {
        cardTitle: card.card.title,
        graveyardSize: newGraveyard.length,
        skipGraveyardRecycle: skipGraveyardRecycle || gameState.isLearningMode,
      },
    });
  }

  /**
   * Give player a new card from the deck (turn-based)
   * @param skipGraveyardRecycle - If true, skip graveyard recycling (used in learning mode when clearing board)
   */
  giveNewCard(skipGraveyardRecycle: boolean = false): void {
    const remainingCards = this.config.callbacks.onGetRemainingCards();
    const graveyard = this.config.callbacks.onGetGraveyard();
    const gameState = this.config.callbacks.onGetGameState();

    // Recycle graveyard if deck is empty
    // skipGraveyardRecycle is only used when clearing board or using Weiter button
    // In those cases, we don't want to recycle immediately, but if deck is empty
    // and we need a card, we should recycle
    if (remainingCards.length === 0 && graveyard.length > 0) {
      if (skipGraveyardRecycle) {
        // Skip recycling when explicitly requested (e.g., clearing board, Weiter button)
        // But this means we can't give a card - return early
        logger.debug({
          scope: 'renderer/gamestate',
          msg: 'skipping graveyard recycle (skipGraveyardRecycle=true) - cannot give card',
          meta: {
            remainingCards: 0,
            graveyardSize: graveyard.length,
            isLearningMode: gameState.isLearningMode,
          },
        });
        return; // Can't give card if we skip recycling and deck is empty
      }

      // Normal case: recycle graveyard when deck is empty
      logger.info({
        scope: 'renderer/gamestate',
        msg: 'recycling graveyard because deck is empty',
        meta: {
          remainingCards: 0,
          graveyardSize: graveyard.length,
          isLearningMode: gameState.isLearningMode,
        },
      });
      this.recycleGraveyard();
      // Get updated remaining cards after recycling
      const updatedRemainingCards = this.config.callbacks.onGetRemainingCards();
      if (updatedRemainingCards.length === 0) {
        return; // Still no cards after recycling
      }
    }

    const currentRemainingCards = this.config.callbacks.onGetRemainingCards();
    if (currentRemainingCards.length > 0) {
      // Play card shuffle sound for drawing a single card
      this.config.callbacks.onPlaySound(SoundType.CARD_SHUFFLE);

      const newCardData = currentRemainingCards[0];
      const newRemainingCards = currentRemainingCards.slice(1);
      this.config.callbacks.onSetRemainingCards(newRemainingCards);

      // Get current scale (use callback if available, otherwise use config scale)
      const currentScale = this.config.onGetScale ? this.config.onGetScale() : this.config.scale;

      const newCard = new GameCard(
        newCardData,
        this.config.deck,
        50 * currentScale, // Start position at deck (left)
        this.config.canvas.height / 2 + 20 * currentScale, // Deck Y position
        currentScale,
      );

      // Add to appropriate hand based on game mode
      if (gameState.isHotseatMode) {
        const hands = this.config.callbacks.onGetHands();
        // Add to the actual player hand (not just the reference)
        if (gameState.currentPlayerIndex === 0) {
          const newPlayer1Hand = [...hands.player1Hand, newCard];
          this.config.callbacks.onSetPlayer1Hand(newPlayer1Hand);
        } else {
          const newPlayer2Hand = [...hands.player2Hand, newCard];
          this.config.callbacks.onSetPlayer2Hand(newPlayer2Hand);
        }
        this.config.callbacks.onLayoutHotseatHands();
      } else {
        const hands = this.config.callbacks.onGetHands();
        const newPlayerHand = [...hands.playerHand, newCard];
        this.config.callbacks.onSetPlayerHand(newPlayerHand);
        // Layout hand to position the new card correctly
        // Note: animateCardToHand would add the card again, so we just layout directly
        this.config.callbacks.onLayoutHand();
      }

      // In learning mode or hotseat mode, don't switch turns
      if (!gameState.isLearningMode && !gameState.isHotseatMode) {
        // Switch to opponent turn after giving new card
        this.config.callbacks.onSetIsPlayerTurn(false);
        this.config.callbacks.onStopTurnTimer(); // Stop player timer

        // Let AI play after a short delay
        const hands = this.config.callbacks.onGetHands();
        setTimeout(() => {
          // Call onAITurn - it will set isAITurnInProgress internally based on playTurn's return value
          this.config.callbacks.onAITurn(hands.opponentHand);
        }, 1000);
      }

      logger.info({
        scope: 'renderer/gamestate',
        msg: 'new card given to player',
        meta: {
          cardTitle: newCardData.title,
          remainingCards: newRemainingCards.length,
          turn: gameState.currentTurn,
          isLearningMode: gameState.isLearningMode,
        },
      });
    }
  }

  /**
   * Check if player has won the game (turn-based)
   */
  checkForWin(): void {
    const gameState = this.config.callbacks.onGetGameState();
    const hands = this.config.callbacks.onGetHands();
    const remainingCards = this.config.callbacks.onGetRemainingCards();

    // In learning mode, no win/lose conditions
    if (gameState.isLearningMode) {
      return;
    }

    // Hotseat mode: check current player hand
    if (gameState.isHotseatMode) {
      const currentPlayerHandLength = gameState.currentPlayerIndex === 0
        ? hands.player1Hand.length
        : hands.player2Hand.length;

      if (currentPlayerHandLength === 0 && !gameState.gameLost) {
        this.config.callbacks.onSetGameWon(true);
        this.config.callbacks.onUpdateInputHandlerConfig();

        const winnerName = gameState.currentPlayerIndex === 0
          ? (gameState.player1Data?.name || 'Player 1')
          : (gameState.player2Data?.name || 'Player 2');

        logger.info({
          scope: 'renderer/gamestate',
          msg: 'HOTSEAT GAME WON!',
          meta: {
            winnerName,
            currentPlayerIndex: gameState.currentPlayerIndex,
            currentPlayerHandLength,
            remainingCards: remainingCards.length,
          },
        });

        // Show win dialog after 4 seconds delay
        setTimeout(() => {
          this.config.callbacks.onShowHotseatWinDialog(winnerName);
        }, 4000);
      }
      return;
    }

    // Normal mode: Check for player win (hand empty)
    if (hands.playerHand.length === 0 && !gameState.gameLost) {
      this.config.callbacks.onSetGameWon(true);

      logger.info({
        scope: 'renderer/gamestate',
        msg: 'PLAYER WON THE GAME!',
        meta: {
          finalScore: gameState.score,
          finalTurn: gameState.currentTurn,
          remainingCards: remainingCards.length,
        },
      });

      // Show win dialog after 4 seconds delay
      setTimeout(() => {
        this.config.callbacks.onShowWinDialog();
      }, 4000);
    }

    // Check for AI win (opponent hand empty)
    if (hands.opponentHand.length === 0 && !gameState.gameWon) {
      this.config.callbacks.onSetGameLost(true);

      logger.info({
        scope: 'renderer/gamestate',
        msg: 'PLAYER LOST THE GAME!',
        meta: {
          finalScore: gameState.score,
          finalTurn: gameState.currentTurn,
          remainingCards: remainingCards.length,
        },
      });

      // Show lose dialog after 4 seconds delay
      setTimeout(() => {
        this.config.callbacks.onShowLoseDialog();
      }, 4000);
    }
  }
}
