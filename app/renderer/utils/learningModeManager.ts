import { GameCard } from '@/game/Card';
import { Card as CardData } from '@/data/types';
import { logger } from '@/utils/logger';

/**
 * Callbacks for LearningModeManager to interact with game state
 */
export interface LearningModeManagerCallbacks {
  // State getters
  onGetBoardCards: () => {
    boardCard: GameCard | null;
    placedLeft: GameCard[];
    placedRight: GameCard[];
  };

  onGetGraveyard: () => GameCard[];

  onGetPlayerHand: () => GameCard[];

  onGetRemainingCards: () => CardData[];

  onGetGameState: () => {
    score: number;
    currentTurn: number;
    isLearningMode: boolean;
  };

  // State setters
  onSetBoardCard: (card: GameCard | null) => void;
  onSetPlacedLeft: (cards: GameCard[]) => void;
  onSetPlacedRight: (cards: GameCard[]) => void;
  onSetGraveyard: (cards: GameCard[]) => void;
  onSetPlayerHand: (cards: GameCard[]) => void;
  onSetScore: (score: number) => void;
  onSetCurrentTurn: (turn: number) => void;
  onSetIsGameStarted: (started: boolean) => void;
  onSetIsPlayerTurn: (isPlayerTurn: boolean) => void;
  onSetTurnText: (text: string) => void;
  onSetTurnTimer: (timer: number) => void;
  onSetTooltipVisible: (visible: boolean) => void;
  onSetTooltipCard: (card: GameCard | null) => void;
  onSetHoveredCard: (card: GameCard | null) => void;
  onGetTooltipCard?: () => GameCard | null;
  onSetWeiterButtonBounds: (bounds: { x: number; y: number; width: number; height: number } | null) => void;
  onSetClearBoardButtonBounds: (bounds: { x: number; y: number; width: number; height: number } | null) => void;
  onSetResetGameButtonBounds: (bounds: { x: number; y: number; width: number; height: number } | null) => void;

  // Actions
  onAnimateCardToGraveyard: (card: GameCard) => void;
  onLayoutAxisCards: () => void;
  onGiveNewCard: (skipGraveyardRecycle: boolean) => void;
  onUpdateInputHandlerConfig: () => void;
  onLoadGame: () => Promise<void>;
  onStopTurnTimer: () => void;
}

/**
 * Configuration for LearningModeManager
 */
export interface LearningModeManagerConfig {
  callbacks: LearningModeManagerCallbacks;
}

/**
 * LearningModeManager - Handles learning mode specific functionality
 */
export class LearningModeManager {
  private config: LearningModeManagerConfig;

  constructor(config: LearningModeManagerConfig) {
    this.config = config;
  }

  /**
   * Clear all cards from board and move them to graveyard
   */
  public clearBoard(): void {
    const boardCards = this.config.callbacks.onGetBoardCards();
    const graveyard = this.config.callbacks.onGetGraveyard();
    const playerHand = this.config.callbacks.onGetPlayerHand();
    const remainingCards = this.config.callbacks.onGetRemainingCards();

    logger.info({
      scope: 'renderer/learning',
      msg: 'clearing board - moving all cards to graveyard',
      meta: {
        boardCards: (boardCards.boardCard ? 1 : 0) + boardCards.placedLeft.length + boardCards.placedRight.length,
        isLearningMode: true,
      },
    });

    // Collect all cards to move to graveyard
    const cardsToGraveyard: GameCard[] = [];

    // Move board card to graveyard if it exists
    if (boardCards.boardCard) {
      cardsToGraveyard.push(boardCards.boardCard);
      this.config.callbacks.onAnimateCardToGraveyard(boardCards.boardCard);
      this.config.callbacks.onSetBoardCard(null);
    }

    // Move all placed left cards to graveyard
    for (const card of boardCards.placedLeft) {
      cardsToGraveyard.push(card);
      this.config.callbacks.onAnimateCardToGraveyard(card);
    }
    this.config.callbacks.onSetPlacedLeft([]);

    // Move all placed right cards to graveyard
    for (const card of boardCards.placedRight) {
      cardsToGraveyard.push(card);
      this.config.callbacks.onAnimateCardToGraveyard(card);
    }
    this.config.callbacks.onSetPlacedRight([]);

    // Update graveyard state - IMPORTANT: Do this BEFORE calling giveNewCard
    // to ensure GameStateManager sees the updated graveyard
    if (cardsToGraveyard.length > 0) {
      const newGraveyard = [...graveyard, ...cardsToGraveyard];
      this.config.callbacks.onSetGraveyard(newGraveyard);

      logger.info({
        scope: 'renderer/learning',
        msg: 'cards moved to graveyard in clearBoard',
        meta: {
          cardsMoved: cardsToGraveyard.length,
          graveyardSize: newGraveyard.length,
          remainingCards: remainingCards.length,
        },
      });
    }

    // Clear all button bounds
    this.config.callbacks.onSetWeiterButtonBounds(null);
    this.config.callbacks.onSetClearBoardButtonBounds(null);
    this.config.callbacks.onSetResetGameButtonBounds(null);

    // Hide tooltip
    this.config.callbacks.onSetTooltipVisible(false);
    this.config.callbacks.onSetTooltipCard(null);
    this.config.callbacks.onSetHoveredCard(null);

    // Give player new cards if hand is empty
    // In learning mode, don't recycle graveyard when clearing board - those cards should stay in graveyard
    // Only give cards from the remaining deck, not from graveyard
    // IMPORTANT: Check remainingCards.length BEFORE the loop, as it may change during the loop
    const initialRemainingCards = remainingCards.length;
    const initialGraveyardSize = this.config.callbacks.onGetGraveyard().length;

    if (playerHand.length === 0 && initialRemainingCards > 0) {
      const cardsToGive = Math.min(5, initialRemainingCards);

      logger.info({
        scope: 'renderer/learning',
        msg: 'about to give new cards after clearing board',
        meta: {
          cardsToGive,
          remainingCardsBefore: initialRemainingCards,
          graveyardSizeBefore: initialGraveyardSize,
        },
      });

      for (let i = 0; i < cardsToGive; i++) {
        // Check if we still have cards before each iteration
        const currentRemainingCards = this.config.callbacks.onGetRemainingCards();
        if (currentRemainingCards.length === 0) {
          logger.info({
            scope: 'renderer/learning',
            msg: 'deck became empty during card giving loop, stopping',
            meta: {
              cardsGivenSoFar: i,
              graveyardSize: this.config.callbacks.onGetGraveyard().length,
            },
          });
          break; // Stop if deck becomes empty
        }

        // Skip graveyard recycle when clearing board - cards moved to graveyard should stay there
        this.config.callbacks.onGiveNewCard(true);
      }

      logger.info({
        scope: 'renderer/learning',
        msg: 'gave new cards after clearing board',
        meta: {
          cardsToGive,
          remainingCardsAfter: this.config.callbacks.onGetRemainingCards().length,
          graveyardSizeAfter: this.config.callbacks.onGetGraveyard().length,
          graveyardShouldBeSame: this.config.callbacks.onGetGraveyard().length === initialGraveyardSize,
        },
      });
    } else if (playerHand.length === 0 && initialRemainingCards === 0) {
      // Deck is empty and hand is empty - don't recycle graveyard when clearing board
      // The cards in graveyard should stay there (they were incorrectly placed)
      logger.info({
        scope: 'renderer/learning',
        msg: 'no cards to give after clearing board - deck empty, graveyard not recycled',
        meta: {
          remainingCards: 0,
          graveyardSize: this.config.callbacks.onGetGraveyard().length,
        },
      });
    }

    // Re-center the board after clearing (important for next card placement)
    this.config.callbacks.onLayoutAxisCards();
  }

  /**
   * Reset the learning game with the same deck
   */
  public resetLearningGame(): void {
    logger.info({
      scope: 'renderer/learning',
      msg: 'resetting learning game',
      meta: {
        isLearningMode: true,
      },
    });

    // Stop any running timer
    this.config.callbacks.onStopTurnTimer();

    // Clear all button bounds
    this.config.callbacks.onSetWeiterButtonBounds(null);
    this.config.callbacks.onSetClearBoardButtonBounds(null);
    this.config.callbacks.onSetResetGameButtonBounds(null);

    // Hide tooltip
    this.config.callbacks.onSetTooltipVisible(false);
    this.config.callbacks.onSetTooltipCard(null);
    this.config.callbacks.onSetHoveredCard(null);

    // Reset game state
    this.config.callbacks.onSetScore(0);
    this.config.callbacks.onSetCurrentTurn(0);
    this.config.callbacks.onSetPlayerHand([]);
    this.config.callbacks.onSetPlacedLeft([]);
    this.config.callbacks.onSetPlacedRight([]);
    this.config.callbacks.onSetBoardCard(null);
    this.config.callbacks.onSetGraveyard([]);
    this.config.callbacks.onSetIsGameStarted(false);
    this.config.callbacks.onSetIsPlayerTurn(true);
    this.config.callbacks.onSetTurnText('');
    this.config.callbacks.onSetTurnTimer(30);
    this.config.callbacks.onUpdateInputHandlerConfig();

    // Reload the game
    this.config.callbacks.onLoadGame().catch((error) => {
      logger.error({
        scope: 'renderer/learning',
        msg: 'failed to reload game',
        err: { message: (error as Error).message },
      });
    });
  }

  /**
   * Remove card from board and move to graveyard
   */
  public removeCardFromBoard(card: GameCard): void {
    const boardCards = this.config.callbacks.onGetBoardCards();
    const graveyard = this.config.callbacks.onGetGraveyard();

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

    // Clear global weiter button bounds
    this.config.callbacks.onSetWeiterButtonBounds(null);

    // Add to graveyard and animate
    logger.info({
      scope: 'renderer/game',
      msg: 'adding card to graveyard',
      meta: {
        cardTitle: card.card.title,
        isCorrect: card.isCorrect,
        isLearningMode: true,
        graveyardSizeBefore: graveyard.length,
      },
    });

    const newGraveyard = [...graveyard, card];
    this.config.callbacks.onSetGraveyard(newGraveyard);
    this.config.callbacks.onAnimateCardToGraveyard(card);

    // Re-center remaining cards
    this.config.callbacks.onLayoutAxisCards();

    // Hide tooltip if this card was showing it
    const tooltipCard = this.config.callbacks.onGetTooltipCard?.();
    if (tooltipCard === card) {
      this.config.callbacks.onSetTooltipVisible(false);
      this.config.callbacks.onSetTooltipCard(null);
    }

    // Give player a new card (only when removing via "Weiter" button)
    // In learning mode, don't recycle graveyard - cards should stay in graveyard
    this.config.callbacks.onGiveNewCard(true);
  }

  /**
   * Show tooltip for incorrect card automatically
   */
  public showTooltipForIncorrectCard(card: GameCard): void {
    this.config.callbacks.onSetHoveredCard(card);
    this.config.callbacks.onSetTooltipCard(card);
    this.config.callbacks.onSetTooltipVisible(true);

    logger.debug({
      scope: 'renderer/tooltip',
      msg: 'tooltip shown automatically for incorrect card',
      meta: {
        cardTitle: card.card.title,
        isLearningMode: true,
      },
    });
  }

  /**
   * Handle Weiter button click - remove incorrect card from board
   */
  public handleWeiterButtonClick(): void {
    const boardCards = this.config.callbacks.onGetBoardCards();

    // Find incorrect card
    const incorrectCard = boardCards.placedLeft.find((card) => card.isCorrect === false)
      || boardCards.placedRight.find((card) => card.isCorrect === false)
      || (boardCards.boardCard && boardCards.boardCard.isCorrect === false ? boardCards.boardCard : null);

    if (incorrectCard) {
      this.removeCardFromBoard(incorrectCard);

      logger.info({
        scope: 'renderer/learning',
        msg: 'incorrect card removed by weiter button click',
        meta: {
          cardTitle: incorrectCard.card.title,
          isLearningMode: true,
        },
      });
    }
  }
}
