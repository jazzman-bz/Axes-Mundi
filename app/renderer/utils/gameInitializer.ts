import { GameCard } from '@/game/Card';
import { Card as CardData } from '@/data/types';
import { ExtendedDeck, loadDeck, shuffleCardsInPlace } from '@/data/deckLoader';
import { loadImage } from '@/utils/assetLoader';
import { calculateScale, calculateSnapThreshold } from '@/utils/scaleUtils';
import { logger } from '@/utils/logger';
// CardDealerManager initialization handled via callback

/**
 * Callbacks for GameInitializer to interact with game state
 */
export interface GameInitializerCallbacks {
  /** Get current game state */
  onGetGameState: () => {
    isLearningMode: boolean;
    isHotseatMode: boolean;
    currentPlayerIndex: number;
    gameDifficulty: 'easy' | 'medium' | 'hard';
  };

  /** Get remaining cards */
  onGetRemainingCards: () => CardData[];

  /** Get hands for hotseat mode */
  onGetHands: () => {
    player1Hand: GameCard[];
    player2Hand: GameCard[];
  };

  /** Set deck */
  onSetDeck: (deck: ExtendedDeck) => void;

  /** Set remaining cards */
  onSetRemainingCards: (cards: CardData[]) => void;

  /** Set board card */
  onSetBoardCard: (card: GameCard | null) => void;

  /** Set scale */
  onSetScale: (scale: number) => void;

  /** Set snap threshold */
  onSetSnapThreshold: (threshold: number) => void;

  /** Set logo image */
  onSetLogoImage: (image: HTMLImageElement | null) => void;

  /** Set arrow left image */
  onSetArrowLeftImage: (image: HTMLImageElement | null) => void;

  /** Set arrow right image */
  onSetArrowRightImage: (image: HTMLImageElement | null) => void;

  /** Set background image */
  onSetBackgroundImage: (image: HTMLImageElement | null) => void;

  /** Set current player hand (hotseat) */
  onSetCurrentPlayerHand: (hand: GameCard[]) => void;

  /** Set next player hand (hotseat) */
  onSetNextPlayerHand: (hand: GameCard[]) => void;

  /** Update game state manager with deck */
  onUpdateGameStateManager: (deck: ExtendedDeck) => void;

  /** Initialize card dealer manager (full initialization handled by callback) */
  onInitializeCardDealerManager: () => void;

  /** Animate first card to center */
  onAnimateFirstCardToCenter: (card: GameCard) => void;

  /** Start dealing cards */
  onStartDealingCards: (mode: 'learning' | 'hotseat' | 'normal') => void;
}

/**
 * Configuration for GameInitializer
 */
export interface GameInitializerConfig {
  /** Canvas element */
  canvas: HTMLCanvasElement;

  /** Callbacks for game state interaction */
  callbacks: GameInitializerCallbacks;
}

/**
 * GameInitializer - Handles game initialization and asset loading
 */
export class GameInitializer {
  private config: GameInitializerConfig;

  constructor(config: GameInitializerConfig) {
    this.config = config;
  }

  /**
   * Initialize canvas
   */
  public initCanvas(): void {
    try {
      this.config.canvas.width = window.innerWidth;
      this.config.canvas.height = window.innerHeight;

      logger.info({ scope: 'renderer/initializer', msg: 'canvas initialized' });
    } catch (error: any) {
      logger.error({
        scope: 'renderer/initializer',
        msg: 'failed to initialize canvas',
        err: { message: error.message, stack: error.stack },
      });
      throw error;
    }
  }

  /**
   * Set up event listeners
   * Note: This is a simple pass-through to attach handlers
   */
  public setupEventListeners(
    resizeHandler: { attach: () => void } | null,
    inputHandler: { attach: () => void } | null,
  ): void {
    // Window resize (handled by ResizeHandler)
    if (resizeHandler) {
      resizeHandler.attach();
    }

    // Input handling (handled by InputHandler)
    if (inputHandler) {
      inputHandler.attach();
    }

    logger.debug({ scope: 'renderer/initializer', msg: 'event listeners set up' });
  }

  /**
   * Load the Axes Mundi logo image
   */
  public async loadLogo(): Promise<void> {
    try {
      const asset = await loadImage('./assets/axes-mundi logo.png', {
        scope: 'renderer/initializer',
      });
      this.config.callbacks.onSetLogoImage(asset?.image ?? null);
    } catch (error: any) {
      logger.error({
        scope: 'renderer/initializer',
        msg: 'failed to load logo',
        err: { message: error.message },
      });
      this.config.callbacks.onSetLogoImage(null);
    }
  }

  /**
   * Load arrow images for board navigation
   */
  public async loadArrowImages(): Promise<void> {
    try {
      // Load both arrows in parallel with white conversion
      const [leftAsset, rightAsset] = await Promise.all([
        loadImage('./assets/arrow left.png', {
          convertToWhite: true,
          scope: 'renderer/initializer',
        }),
        loadImage('./assets/arrow right.png', {
          convertToWhite: true,
          scope: 'renderer/initializer',
        }),
      ]);

      this.config.callbacks.onSetArrowLeftImage(leftAsset?.image ?? null);
      this.config.callbacks.onSetArrowRightImage(rightAsset?.image ?? null);
    } catch (error: any) {
      logger.error({
        scope: 'renderer/initializer',
        msg: 'failed to load arrow images',
        err: { message: error.message },
      });
      this.config.callbacks.onSetArrowLeftImage(null);
      this.config.callbacks.onSetArrowRightImage(null);
    }
  }

  /**
   * Load background image
   */
  public async loadBackgroundImage(): Promise<void> {
    try {
      const asset = await loadImage('./assets/background.jpg', {
        scope: 'renderer/initializer',
      });
      this.config.callbacks.onSetBackgroundImage(asset?.image ?? null);
    } catch (error: any) {
      logger.error({
        scope: 'renderer/initializer',
        msg: 'failed to load background image',
        err: { message: error.message },
      });
      this.config.callbacks.onSetBackgroundImage(null);
    }
  }

  /**
   * Load all UI assets in parallel
   */
  public loadAssets(): void {
    // Fire-and-forget: assets will render when ready
    Promise.all([
      this.loadLogo(),
      this.loadArrowImages(),
      this.loadBackgroundImage(),
    ]).catch((err) => {
      logger.error({
        scope: 'renderer/initializer',
        msg: 'failed to load assets',
        err: { message: err.message },
      });
    });
  }

  /**
   * Load game data
   */
  public async loadGame(): Promise<void> {
    try {
      // Load deck from localStorage
      const selectedDeck = localStorage.getItem('selectedDeck') || 'buildings-height-en';

      logger.info({
        scope: 'renderer/initializer',
        msg: 'loading deck for game',
        meta: {
          selectedDeck,
        },
      });

      const deck = await loadDeck(selectedDeck);

      // Set deck
      this.config.callbacks.onSetDeck(deck);

      // Update game state manager with deck
      this.config.callbacks.onUpdateGameStateManager(deck);

      // Get game state for later use
      const gameState = this.config.callbacks.onGetGameState();

      // Initialize card dealer manager (full initialization handled by callback in main.ts)
      this.config.callbacks.onInitializeCardDealerManager();

      // Initialize remaining cards from deck and shuffle them
      const remainingCards = [...deck.cards];
      shuffleCardsInPlace(remainingCards);
      this.config.callbacks.onSetRemainingCards(remainingCards);

      // Ensure scale is calculated with correct canvas dimensions
      const scale = calculateScale(window.innerWidth, window.innerHeight);
      const snapThreshold = calculateSnapThreshold(scale);
      this.config.callbacks.onSetScale(scale);
      this.config.callbacks.onSetSnapThreshold(snapThreshold);

      // Get first card for board (turn-based: first card goes to center)
      const updatedRemainingCards = this.config.callbacks.onGetRemainingCards();
      const boardCardData = updatedRemainingCards.shift();
      if (!boardCardData) {
        throw new Error('No cards available for board card');
      }

      // Update remaining cards after shifting
      this.config.callbacks.onSetRemainingCards([...updatedRemainingCards]);

      const boardCard = new GameCard(
        boardCardData,
        deck,
        50 * scale, // Start at deck position
        this.config.canvas.height - 320 * scale, // Deck Y position
        scale,
      );
      boardCard.isInHand = false; // Board card is on axis, not in hand
      this.config.callbacks.onSetBoardCard(boardCard);

      // Animate first card from deck to center of axis
      this.config.callbacks.onAnimateFirstCardToCenter(boardCard);

      // Start dealing cards immediately (don't wait for animation)
      logger.info({
        scope: 'renderer/initializer',
        msg: 'starting dealCardsToPlayers immediately',
        meta: { remainingCards: updatedRemainingCards.length },
      });

      // Determine game mode and start dealing
      let gameMode: 'learning' | 'hotseat' | 'normal';
      if (gameState.isLearningMode) {
        gameMode = 'learning';
      } else if (gameState.isHotseatMode) {
        gameMode = 'hotseat';
      } else {
        gameMode = 'normal';
      }

      this.config.callbacks.onStartDealingCards(gameMode);

      logger.info({
        scope: 'renderer/initializer',
        msg: 'game loaded successfully',
        meta: {
          boardCard: boardCardData.title,
          remainingCards: updatedRemainingCards.length,
          isLearningMode: gameState.isLearningMode,
        },
      });
    } catch (error: any) {
      logger.error({
        scope: 'renderer/initializer',
        msg: 'failed to load game',
        err: { message: error.message, stack: error.stack },
      });
      throw error;
    }
  }
}
