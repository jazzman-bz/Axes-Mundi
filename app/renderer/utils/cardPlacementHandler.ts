import { GameCard } from '@/game/Card';
import { Card as CardData } from '@/data/types';
import { isAxisCorrectlySorted, getScore } from '@/data/scoring';
import { SoundType } from '@/utils/soundManager';

/**
 * Callbacks for CardPlacementHandler to communicate with main app
 */
export interface CardPlacementHandlerCallbacks {
  // State getters
  onGetBoardCards: () => { boardCard: GameCard | null; placedLeft: GameCard[]; placedRight: GameCard[] };
  onGetHands: () => {
    playerHand: GameCard[];
    opponentHand: GameCard[];
    player1Hand: GameCard[];
    player2Hand: GameCard[];
  };
  onGetGameState: () => {
    score: number;
    currentTurn: number;
    gameWon: boolean;
    gameLost: boolean;
    isPlayerTurn: boolean;
    isLearningMode: boolean;
    isHotseatMode: boolean;
    currentPlayerIndex: number;
  };
  onGetRemainingCards: () => CardData[];
  onGetCanvasDimensions: () => { width: number; height: number };

  // State setters
  onSetBoardCard: (card: GameCard | null) => void;
  onSetPlacedLeft: (cards: GameCard[]) => void;
  onSetPlacedRight: (cards: GameCard[]) => void;
  onSetPlayerHand: (cards: GameCard[]) => void;
  onSetPlayer1Hand: (cards: GameCard[]) => void;
  onSetPlayer2Hand: (cards: GameCard[]) => void;
  onSetScore: (score: number) => void;
  onSetIsPlayerTurn: (isPlayerTurn: boolean) => void;
  onSetCurrentTurn: (turn: number) => void;
  onSetWeiterButtonBounds: (bounds: { x: number; y: number; width: number; height: number } | null) => void;
  onSetIsAITurnInProgress: (inProgress: boolean) => void;

  // Actions
  onLayoutAxisCards: () => void;
  onLayoutHand: () => void;
  onLayoutHotseatHands: () => void;
  onPlaySound: (soundType: SoundType) => void;
  onStopTurnTimer: () => void;
  onStartTurnTimer: () => void;
  onCheckWin: () => void;
  onAITurn: (opponentHand: GameCard[]) => void;
  onShowPlayerSwitchOverlay: () => void;
  onShowTooltip: (card: GameCard) => void;
  onMoveCardToGraveyard: (card: GameCard) => void;
  onGiveNewCard: () => void;
  onLog: (level: 'debug' | 'info' | 'warn' | 'error', scope: string, msg: string, meta?: Record<string, any>) => void;
}

/**
 * Configuration for CardPlacementHandler
 */
export interface CardPlacementHandlerConfig {
  callbacks: CardPlacementHandlerCallbacks;
}

/**
 * Card Placement Handler - Handles all card placement logic
 * Manages placement validation, correctness checking, turn management, and mode-specific behavior
 */
export class CardPlacementHandler {
  private config: CardPlacementHandlerConfig;

  constructor(config: CardPlacementHandlerConfig) {
    this.config = config;
  }

  /**
   * Evaluate if the current card placement is correct
   * @returns true if all cards on axis are correctly sorted, false otherwise
   */
  private evaluatePlacement(): boolean {
    const boardCards = this.config.callbacks.onGetBoardCards();
    const allAxisCards = [
      boardCards.boardCard,
      ...boardCards.placedLeft,
      ...boardCards.placedRight,
    ].filter(Boolean) as GameCard[];

    // Sort by X position to get the actual order on the axis
    const sortedAxisCards = allAxisCards.sort((a, b) => a.x - b.x);

    // Extract just the card data for evaluation
    const sortedCardData = sortedAxisCards.map((gc) => gc.card);

    // Evaluate correctness
    const isCorrect = sortedCardData.length > 0
      ? isAxisCorrectlySorted(sortedCardData)
      : true; // Default to correct if no cards

    return isCorrect;
  }

  /**
   * Handle first card placement (becomes board card)
   */
  private handleFirstCardPlacement(card: GameCard, _x: number, y: number): void {
    const canvasDimensions = this.config.callbacks.onGetCanvasDimensions();
    this.config.callbacks.onSetBoardCard(card);
    card.isInHand = false;

    // Center the first card on the axis
    const centerX = canvasDimensions.width / 2 - card.width / 2;
    card.setTargetPosition(centerX, y);

    this.config.callbacks.onLog('info', 'renderer/cardplacement', 'first card after clear board set as boardCard', {
      cardTitle: card.card.title,
    });
  }

  /**
   * Handle normal card placement (not first card)
   */
  private handleNormalCardPlacement(card: GameCard, x: number, y: number, isLeft: boolean): void {
    card.setTargetPosition(x, y);
    card.isInHand = false;

    const boardCards = this.config.callbacks.onGetBoardCards();
    if (isLeft) {
      const newPlacedLeft = [...boardCards.placedLeft, card];
      this.config.callbacks.onSetPlacedLeft(newPlacedLeft);
    } else {
      const newPlacedRight = [...boardCards.placedRight, card];
      this.config.callbacks.onSetPlacedRight(newPlacedRight);
    }
  }

  /**
   * Remove card from appropriate hand
   */
  private removeCardFromHand(card: GameCard): void {
    const hands = this.config.callbacks.onGetHands();
    const gameState = this.config.callbacks.onGetGameState();

    if (gameState.isHotseatMode) {
      // Remove from the actual player hand (not just the reference)
      if (gameState.currentPlayerIndex === 0) {
        const newPlayer1Hand = hands.player1Hand.filter((c) => c !== card);
        this.config.callbacks.onSetPlayer1Hand(newPlayer1Hand);
      } else {
        const newPlayer2Hand = hands.player2Hand.filter((c) => c !== card);
        this.config.callbacks.onSetPlayer2Hand(newPlayer2Hand);
      }
      this.config.callbacks.onLayoutHotseatHands();
    } else {
      const newPlayerHand = hands.playerHand.filter((c) => c !== card);
      this.config.callbacks.onSetPlayerHand(newPlayerHand);
      this.config.callbacks.onLayoutHand();
    }
  }

  /**
   * Handle correct card placement
   */
  private handleCorrectPlacement(card: GameCard): void {
    const gameState = this.config.callbacks.onGetGameState();

    // Update score (not in learning mode)
    if (!gameState.isLearningMode) {
      const currentScore = gameState.score;
      const newScore = currentScore + getScore(card.card);
      this.config.callbacks.onSetScore(newScore);
    }

    // Mark card as correct
    card.setCorrect();

    // Play success sound for correct placement
    setTimeout(() => {
      this.config.callbacks.onPlaySound(SoundType.SUCCESS);
    }, 300); // Small delay after placement sound

    // Clear global weiter button bounds for correct cards
    this.config.callbacks.onSetWeiterButtonBounds(null);

    // Center the axis immediately after correct placement
    this.config.callbacks.onLayoutAxisCards();

    // Handle turn management based on game mode
    if (!gameState.isLearningMode && !gameState.isHotseatMode) {
      // NORMAL MODE: Switch turns
      this.config.callbacks.onSetIsPlayerTurn(false);
      this.config.callbacks.onSetCurrentTurn(gameState.currentTurn + 1);
      this.config.callbacks.onStopTurnTimer();

      // Check for win condition
      this.config.callbacks.onCheckWin();

      // Get updated game state after win check
      const updatedGameState = this.config.callbacks.onGetGameState();

      // AI TURN: If game not over and AI has cards, let AI play
      const hands = this.config.callbacks.onGetHands();
      if (!updatedGameState.gameWon && !updatedGameState.gameLost && hands.opponentHand.length > 0) {
        setTimeout(() => {
          // Call onAITurn first - it will set isAITurnInProgress internally based on playTurn's return value
          this.config.callbacks.onAITurn(hands.opponentHand);
        }, 1000); // 1 second delay
      } else {
        // Keep player turn if AI has no cards
        this.config.callbacks.onSetIsPlayerTurn(true);
        this.config.callbacks.onStartTurnTimer();
      }
    } else if (gameState.isHotseatMode) {
      // HOTSEAT MODE: Check for win, then show player switch overlay after 2 seconds
      this.config.callbacks.onLog('info', 'renderer/cardplacement', 'hotseat mode: scheduling player switch overlay in 2 seconds', {
        cardTitle: card.card.title,
        currentPlayerIndex: gameState.currentPlayerIndex,
      });

      setTimeout(() => {
        this.config.callbacks.onLog('info', 'renderer/cardplacement', 'hotseat mode: 2 seconds passed, now checking win', {
          cardTitle: card.card.title,
          currentPlayerIndex: gameState.currentPlayerIndex,
        });

        // Check for win condition
        this.config.callbacks.onCheckWin();

        // Only show player switch if game is not won
        const updatedGameState = this.config.callbacks.onGetGameState();
        if (!updatedGameState.gameWon) {
          this.config.callbacks.onShowPlayerSwitchOverlay();
          this.config.callbacks.onLog('info', 'renderer/cardplacement', 'hotseat mode: showing player switch overlay after correct card', {
            cardTitle: card.card.title,
            currentPlayerIndex: gameState.currentPlayerIndex,
          });
        }
      }, 2000);
    } else {
      // LEARNING MODE: Keep player turn, no timer, no opponent, give new card
      this.config.callbacks.onSetIsPlayerTurn(true);
      this.config.callbacks.onGiveNewCard();
      this.config.callbacks.onLog('info', 'renderer/cardplacement', 'learning mode: keeping player turn and giving new card', {
        cardTitle: card.card.title,
        isLearningMode: true,
      });
    }

    const finalGameState = this.config.callbacks.onGetGameState();
    this.config.callbacks.onLog('info', 'renderer/cardplacement', 'card placed correctly, turned green', {
      cardTitle: card.card.title,
      score: finalGameState.score,
      turn: finalGameState.currentTurn,
    });
  }

  /**
   * Handle incorrect card placement
   */
  private handleIncorrectPlacement(card: GameCard): void {
    const gameState = this.config.callbacks.onGetGameState();

    // Mark card as incorrect
    card.setIncorrect();

    // Play error sound for incorrect placement
    setTimeout(() => {
      this.config.callbacks.onPlaySound(SoundType.ERROR);
    }, 300); // Small delay after placement sound

    // DON'T call layoutAxisCards() here - card should stay where player dropped it
    // to show them their mistake. Cards will be re-centered when incorrect card
    // is moved to graveyard.

    if (gameState.isLearningMode) {
      // LEARNING MODE: Show tooltip automatically for incorrect card
      this.config.callbacks.onShowTooltip(card);
      // Card stays on board until "Weiter" button is clicked
      // NO new card here - will be given when "Weiter" button is clicked
      this.config.callbacks.onLog('info', 'renderer/cardplacement', 'learning mode: incorrect card stays on board until weiter button clicked', {
        cardTitle: card.card.title,
        turn: gameState.currentTurn,
      });
    } else if (gameState.isHotseatMode) {
      // HOTSEAT MODE: Move card to graveyard after 2 seconds, then switch player
      this.config.callbacks.onLog('info', 'renderer/cardplacement', 'hotseat mode: incorrect card will be moved to graveyard in 2 seconds, then switch player', {
        cardTitle: card.card.title,
        turn: gameState.currentTurn,
      });

      setTimeout(() => {
        this.config.callbacks.onMoveCardToGraveyard(card);
        // Center the axis after card is moved to graveyard
        this.config.callbacks.onLayoutAxisCards();

        // Wait 2 seconds before showing player switch overlay
        setTimeout(() => {
          this.config.callbacks.onShowPlayerSwitchOverlay();
          this.config.callbacks.onLog('info', 'renderer/cardplacement', 'hotseat mode: showing player switch overlay after incorrect card', {
            cardTitle: card.card.title,
            currentPlayerIndex: gameState.currentPlayerIndex,
          });
        }, 2000);
      }, 2000);
    } else {
      // NORMAL MODE: Move card to graveyard after 2 seconds
      this.config.callbacks.onLog('info', 'renderer/cardplacement', 'normal mode: incorrect card will be moved to graveyard in 2 seconds', {
        cardTitle: card.card.title,
        turn: gameState.currentTurn,
      });

      setTimeout(() => {
        this.config.callbacks.onMoveCardToGraveyard(card);
        // Center the axis after card is moved
        this.config.callbacks.onLayoutAxisCards();
      }, 2000);
    }
  }

  /**
   * Handle card placement - main entry point
   * @param card - The card being placed
   * @param x - X position where card was placed
   * @param y - Y position where card was placed
   * @param isLeft - Whether card was placed on the left side
   * @param isFirstCard - Whether this is the first card after clearing board
   */
  public handleCardPlacement(
    card: GameCard,
    x: number,
    y: number,
    isLeft: boolean,
    isFirstCard: boolean,
  ): void {
    // Play card placement sound
    this.config.callbacks.onPlaySound(SoundType.CARD_PLACE);

    // Handle card placement based on whether it's the first card
    if (isFirstCard) {
      this.handleFirstCardPlacement(card, x, y);
    } else {
      this.handleNormalCardPlacement(card, x, y, isLeft);
    }

    // Remove from hand immediately after snap
    this.removeCardFromHand(card);

    // In learning mode, check if hand is empty and give more cards
    const gameState = this.config.callbacks.onGetGameState();
    const hands = this.config.callbacks.onGetHands();
    if (gameState.isLearningMode && hands.playerHand.length === 0) {
      const remainingCards = this.config.callbacks.onGetRemainingCards();
      if (remainingCards.length > 0) {
        // Give more cards to keep learning going
        const cardsToGive = Math.min(5, remainingCards.length);
        for (let i = 0; i < cardsToGive; i++) {
          this.config.callbacks.onGiveNewCard();
        }

        this.config.callbacks.onLog('info', 'renderer/cardplacement', 'hand empty in learning mode, giving more cards', {
          cardsGiven: cardsToGive,
          remainingCards: remainingCards.length,
        });
      }
    }

    // Evaluate placement correctness
    const isCorrect = this.evaluatePlacement();

    // Handle based on correctness
    if (isCorrect) {
      this.handleCorrectPlacement(card);
    } else {
      this.handleIncorrectPlacement(card);
    }
  }
}
