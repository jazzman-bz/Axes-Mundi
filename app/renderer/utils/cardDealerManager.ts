import { GameCard } from '@/game/Card';
import { Card as CardData } from '@/data/types';
import { ExtendedDeck } from '@/data/deckLoader';
import { dealCard, getOpponentCardCount } from '@/utils/cardDealer';
import { SoundType } from '@/utils/soundManager';
import { logger } from '@/utils/logger';

/**
 * Callbacks for CardDealerManager to interact with game state
 */
export interface CardDealerManagerCallbacks {
  /** Get remaining cards from deck */
  onGetRemainingCards: () => CardData[];

  /** Get graveyard cards */
  onGetGraveyard: () => GameCard[];

  /** Get all player hands */
  onGetHands: () => {
    playerHand: GameCard[];
    opponentHand: GameCard[];
    player1Hand: GameCard[];
    player2Hand: GameCard[];
  };

  /** Get current game state */
  onGetGameState: () => {
    gameDifficulty: 'easy' | 'medium' | 'hard';
    isLearningMode: boolean;
    isHotseatMode: boolean;
    currentPlayerIndex: number;
    boardCard: GameCard | null;
    currentTurn: number;
  };

  /** Add card to player hand */
  onAddCardToPlayerHand: (card: GameCard) => void;

  /** Add card to opponent hand */
  onAddCardToOpponentHand: (card: GameCard) => void;

  /** Add card to player 1 hand (hotseat) */
  onAddCardToPlayer1Hand: (card: GameCard) => void;

  /** Add card to player 2 hand (hotseat) */
  onAddCardToPlayer2Hand: (card: GameCard) => void;

  /** Set board card */
  onSetBoardCard: (card: GameCard | null) => void;

  /** Set player turn state */
  onSetIsPlayerTurn: (isPlayerTurn: boolean) => void;

  /** Set game started state */
  onSetIsGameStarted: (started: boolean) => void;

  /** Set current turn number */
  onSetCurrentTurn: (turn: number) => void;

  /** Layout player hand */
  onLayoutHand: () => void;

  /** Layout opponent hand */
  onLayoutOpponentHand: () => void;

  /** Layout hotseat hands */
  onLayoutHotseatHands: () => void;

  /** Layout player 1 hand (hotseat) */
  onLayoutPlayer1Hand: () => void;

  /** Layout player 2 hand (hotseat) */
  onLayoutPlayer2Hand: () => void;

  /** Recycle graveyard back to deck */
  onRecycleGraveyard: () => void;

  /** Update input handler config */
  onUpdateInputHandlerConfig: () => void;

  /** Start turn timer */
  onStartTurnTimer: () => void;

  /** Update turn text display */
  onUpdateTurnText: () => void;

  /** Play sound effect */
  onPlaySound: (soundType: SoundType) => void;
}

/**
 * Configuration for CardDealerManager
 */
export interface CardDealerManagerConfig {
  /** Canvas element for size calculations */
  canvas: HTMLCanvasElement;

  /** Scale factor for card sizing */
  scale: number;

  /** Deck data for image folder reference */
  deck: ExtendedDeck;

  /** Callbacks for game state interaction */
  callbacks: CardDealerManagerCallbacks;
}

/**
 * CardDealerManager - Handles all card dealing logic for all game modes
 */
export class CardDealerManager {
  private config: CardDealerManagerConfig;

  constructor(config: CardDealerManagerConfig) {
    this.config = config;
  }

  /**
   * Update configuration (e.g., on resize)
   */
  public updateConfig(config: Partial<CardDealerManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Animate first card from deck to center of axis
   */
  public animateFirstCardToCenter(boardCard: GameCard | null): void {
    logger.info({
      scope: 'renderer/dealer',
      msg: 'animateFirstCardToCenter called',
      meta: { hasBoardCard: !!boardCard },
    });

    if (!boardCard) return;

    // Calculate center position
    const centerX = this.config.canvas.width / 2 - boardCard.width / 2;
    const centerY = this.config.canvas.height / 2 - boardCard.height / 2;

    // Animate to center with smooth transition
    boardCard.setTargetPosition(centerX, centerY);

    // Mark game as started after animation
    setTimeout(() => {
      this.config.callbacks.onSetIsGameStarted(true);
      this.config.callbacks.onSetCurrentTurn(1);

      logger.info({
        scope: 'renderer/dealer',
        msg: 'first card placed on axis, game started',
        meta: { cardTitle: boardCard.card.title, turn: 1 },
      });
    }, 2000); // Wait for animation to complete

    logger.info({
      scope: 'renderer/dealer',
      msg: 'animating first card to center',
      meta: { cardTitle: boardCard.card.title },
    });
  }

  /**
   * Animate a single card from deck to player hand
   */
  public animateCardToHand(card: GameCard): void {
    // Add to hand first
    this.config.callbacks.onAddCardToPlayerHand(card);

    // Animate to hand position
    this.config.callbacks.onLayoutHand();

    logger.info({
      scope: 'renderer/dealer',
      msg: 'card animated to hand',
      meta: { cardTitle: card.card.title },
    });
  }

  /**
   * Animate a card from deck to opponent hand
   */
  public animateOpponentCardFromDeck(card: GameCard): void {
    // Add to hand first
    this.config.callbacks.onAddCardToOpponentHand(card);

    // Layout the entire hand to get correct positions for all cards
    this.config.callbacks.onLayoutOpponentHand();

    logger.info({
      scope: 'renderer/dealer',
      msg: 'opponent card animated to hand',
      meta: { cardTitle: card.card.title },
    });
  }

  /**
   * Deal a card to the player
   */
  public dealCardToPlayer(): void {
    const remainingCards = this.config.callbacks.onGetRemainingCards();
    const graveyard = this.config.callbacks.onGetGraveyard();

    // Recycle graveyard if deck is empty
    if (remainingCards.length === 0 && graveyard.length > 0) {
      this.config.callbacks.onRecycleGraveyard();
      // Get updated remaining cards after recycling
      const updatedCards = this.config.callbacks.onGetRemainingCards();
      if (updatedCards.length === 0) {
        logger.warn({
          scope: 'renderer/dealer',
          msg: 'no cards available after recycling graveyard',
        });
        return;
      }
    }

    const cardData = dealCard(remainingCards);
    if (cardData) {
      const card = new GameCard(
        cardData,
        this.config.deck,
        50 * this.config.scale, // Start at deck position
        this.config.canvas.height - 320 * this.config.scale, // Deck Y position
        this.config.scale,
      );

      // Add to hand and animate to position
      this.config.callbacks.onAddCardToPlayerHand(card);
      this.config.callbacks.onLayoutHand();

      logger.info({
        scope: 'renderer/dealer',
        msg: 'card dealt to player',
        meta: { cardTitle: cardData.title },
      });
    } else {
      logger.warn({
        scope: 'renderer/dealer',
        msg: 'no cards remaining for player',
        meta: { remainingCards: remainingCards.length },
      });
    }
  }

  /**
   * Deal a card to the opponent
   */
  public dealCardToOpponent(): void {
    logger.info({
      scope: 'renderer/dealer',
      msg: 'dealCardToOpponent called',
      meta: {
        remainingCards: this.config.callbacks.onGetRemainingCards().length,
        opponentHandSize: this.config.callbacks.onGetHands().opponentHand.length,
      },
    });

    const remainingCards = this.config.callbacks.onGetRemainingCards();
    const graveyard = this.config.callbacks.onGetGraveyard();

    // Recycle graveyard if deck is empty
    if (remainingCards.length === 0 && graveyard.length > 0) {
      this.config.callbacks.onRecycleGraveyard();
      // Get updated remaining cards after recycling
      const updatedCards = this.config.callbacks.onGetRemainingCards();
      if (updatedCards.length === 0) {
        logger.warn({
          scope: 'renderer/dealer',
          msg: 'no cards available after recycling graveyard',
        });
        return;
      }
    }

    const cardData = dealCard(remainingCards);
    if (cardData) {
      const card = new GameCard(
        cardData,
        this.config.deck,
        50 * this.config.scale, // Start at deck position
        this.config.canvas.height - 320 * this.config.scale, // Deck Y position
        this.config.scale,
      );

      // Animate from deck to hand position
      this.animateOpponentCardFromDeck(card);

      logger.info({
        scope: 'renderer/dealer',
        msg: 'card dealt to opponent',
        meta: {
          cardTitle: cardData.title,
          handSize: this.config.callbacks.onGetHands().opponentHand.length,
          remainingCards: this.config.callbacks.onGetRemainingCards().length,
        },
      });
    } else {
      logger.warn({
        scope: 'renderer/dealer',
        msg: 'no cards remaining for opponent',
        meta: { remainingCards: remainingCards.length },
      });
    }
  }

  /**
   * Deal a card to player 1 (hotseat mode)
   */
  public dealCardToPlayer1(): void {
    const remainingCards = this.config.callbacks.onGetRemainingCards();
    const graveyard = this.config.callbacks.onGetGraveyard();

    // Recycle graveyard if deck is empty
    if (remainingCards.length === 0 && graveyard.length > 0) {
      this.config.callbacks.onRecycleGraveyard();
      // Get updated remaining cards after recycling
      const updatedCards = this.config.callbacks.onGetRemainingCards();
      if (updatedCards.length === 0) {
        logger.warn({
          scope: 'renderer/dealer',
          msg: 'no cards available after recycling graveyard',
        });
        return;
      }
    }

    const updatedCards = this.config.callbacks.onGetRemainingCards();
    if (updatedCards.length > 0) {
      const cardData = dealCard(updatedCards);
      if (cardData) {
        const card = new GameCard(
          cardData,
          this.config.deck,
          50 * this.config.scale, // Start at deck position
          this.config.canvas.height - 320 * this.config.scale, // Start at bottom
          this.config.scale,
        );

        // Add to hand and animate to position
        this.config.callbacks.onAddCardToPlayer1Hand(card);
        this.config.callbacks.onLayoutPlayer1Hand();

        logger.info({
          scope: 'renderer/dealer',
          msg: 'card dealt to player 1',
          meta: { cardTitle: cardData.title },
        });
      }
    }
  }

  /**
   * Deal a card to player 2 (hotseat mode)
   */
  public dealCardToPlayer2(): void {
    const remainingCards = this.config.callbacks.onGetRemainingCards();
    const graveyard = this.config.callbacks.onGetGraveyard();

    // Recycle graveyard if deck is empty
    if (remainingCards.length === 0 && graveyard.length > 0) {
      this.config.callbacks.onRecycleGraveyard();
      // Get updated remaining cards after recycling
      const updatedCards = this.config.callbacks.onGetRemainingCards();
      if (updatedCards.length === 0) {
        logger.warn({
          scope: 'renderer/dealer',
          msg: 'no cards available after recycling graveyard',
        });
        return;
      }
    }

    const updatedCards = this.config.callbacks.onGetRemainingCards();
    if (updatedCards.length > 0) {
      const cardData = dealCard(updatedCards);
      if (cardData) {
        const card = new GameCard(
          cardData,
          this.config.deck,
          50 * this.config.scale, // Start at deck position
          this.config.canvas.height - 320 * this.config.scale, // Start at bottom
          this.config.scale,
        );

        // Add to hand and animate to position
        this.config.callbacks.onAddCardToPlayer2Hand(card);
        this.config.callbacks.onLayoutPlayer2Hand();

        logger.info({
          scope: 'renderer/dealer',
          msg: 'card dealt to player 2',
          meta: { cardTitle: cardData.title },
        });
      }
    }
  }

  /**
   * Deal cards to both players based on difficulty (AI mode)
   */
  public dealCardsToPlayers(): void {
    const gameState = this.config.callbacks.onGetGameState();
    const opponentCardCount = getOpponentCardCount(gameState.gameDifficulty);

    logger.info({
      scope: 'renderer/dealer',
      msg: 'dealCardsToPlayers called',
      meta: {
        remainingCards: this.config.callbacks.onGetRemainingCards().length,
        difficulty: gameState.gameDifficulty,
        opponentCardCount,
      },
    });

    // Normal AI mode logic (with animations and synchronized sounds)
    // Deal 5 cards to player with small delay
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this.config.callbacks.onPlaySound(SoundType.CARD_SHUFFLE);
        this.dealCardToPlayer();
      }, i * 200); // 200ms delay between each card
    }

    // Deal cards to opponent based on difficulty
    for (let i = 0; i < opponentCardCount; i++) {
      setTimeout(() => {
        this.config.callbacks.onPlaySound(SoundType.CARD_SHUFFLE);
        this.dealCardToOpponent();
      }, 1200 + i * 200); // Start after player cards, 200ms delay between each
    }

      // Set player turn after all cards are dealt
      const totalDealTime = 1200 + 5 * 200 + opponentCardCount * 200; // Player cards + opponent cards
      setTimeout(() => {
        this.config.callbacks.onSetIsPlayerTurn(true);
        this.config.callbacks.onUpdateInputHandlerConfig();
        this.config.callbacks.onStartTurnTimer();

        logger.info({
          scope: 'renderer/dealer',
          msg: 'game started, player turn',
          meta: {
            turn: gameState.currentTurn,
            remainingCards: this.config.callbacks.onGetRemainingCards().length,
            difficulty: gameState.gameDifficulty,
            opponentCardCount,
          },
        });
      }, totalDealTime);
  }

  /**
   * Deal cards to player only (learning mode)
   */
  public dealCardsToPlayersLearningMode(): void {
    try {
      const remainingCards = this.config.callbacks.onGetRemainingCards();

      // Deal 5 cards to player (more cards for learning)
      const playerCards = remainingCards.splice(0, 5);
      const newHand = playerCards.map((card, index) => {
        // Play sound for each card as it's created
        setTimeout(() => {
          this.config.callbacks.onPlaySound(SoundType.CARD_SHUFFLE);
        }, index * 50); // Small delay between sounds for better feel
        return new GameCard(card, this.config.deck, 50 + index * 120, 500, this.config.scale);
      });

      // Add all cards to hand
      newHand.forEach((card) => {
        this.config.callbacks.onAddCardToPlayerHand(card);
      });

      // Layout only player hand
      this.config.callbacks.onLayoutHand();

      // Set player turn immediately (no timer in learning mode)
      this.config.callbacks.onSetIsPlayerTurn(true);
      this.config.callbacks.onUpdateInputHandlerConfig();

      logger.info({
        scope: 'renderer/dealer',
        msg: 'cards dealt to player (learning mode)',
        meta: {
          playerCards: newHand.length,
          opponentCards: 0,
          remainingCards: this.config.callbacks.onGetRemainingCards().length,
          isLearningMode: true,
        },
      });
    } catch (error: any) {
      logger.error({
        scope: 'renderer/dealer',
        msg: 'failed to deal cards to player (learning mode)',
        err: { message: (error as Error).message, stack: (error as Error).stack },
      });
    }
  }

  /**
   * Deal cards to players (hotseat mode)
   */
  public dealCardsToPlayersHotseat(): void {
    try {
      const gameState = this.config.callbacks.onGetGameState();

      logger.info({
        scope: 'renderer/dealer',
        msg: 'dealCardsToPlayersHotseat called',
        meta: {
          remainingCards: this.config.callbacks.onGetRemainingCards().length,
          currentPlayerIndex: gameState.currentPlayerIndex,
        },
      });

      // Deal 5 cards to player 1 with delay (like AI mode)
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          this.config.callbacks.onPlaySound(SoundType.CARD_SHUFFLE);
          this.dealCardToPlayer1();
        }, i * 200); // 200ms delay between each card
      }

      // Deal 5 cards to player 2 with delay, starting after player 1
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          this.config.callbacks.onPlaySound(SoundType.CARD_SHUFFLE);
          this.dealCardToPlayer2();
        }, 1200 + i * 200); // Start after player 1 cards
      }

      // Layout hands immediately to ensure correct positioning
      this.config.callbacks.onLayoutHotseatHands();

      // Set player turn after all cards are dealt (like AI mode)
      const totalDealTime = 1200 + 5 * 200 + 5 * 200; // Player 1 cards + player 2 cards
      setTimeout(() => {
        this.config.callbacks.onSetIsPlayerTurn(true);
        this.config.callbacks.onUpdateInputHandlerConfig();
        this.config.callbacks.onUpdateTurnText();

        const hands = this.config.callbacks.onGetHands();
        logger.info({
          scope: 'renderer/dealer',
          msg: 'hotseat game started, player turn',
          meta: {
            currentPlayerIndex: gameState.currentPlayerIndex,
            player1Cards: hands.player1Hand.length,
            player2Cards: hands.player2Hand.length,
            remainingCards: this.config.callbacks.onGetRemainingCards().length,
            isHotseatMode: true,
          },
        });
      }, totalDealTime);
    } catch (error: any) {
      logger.error({
        scope: 'renderer/dealer',
        msg: 'failed to deal cards to players (hotseat mode)',
        err: { message: (error as Error).message, stack: (error as Error).stack },
      });
    }
  }
}
