import { logger } from '@/utils/logger';
import { loadDeck, shuffleCardsInPlace } from '@/data/deckLoader';
import { isAxisCorrectlySorted, getScore } from '@/data/scoring';
import { GameCard } from '@/game/Card';
import { Card as CardData } from '@/data/types';
import { soundManager, SoundType } from '@/utils/soundManager';
import { drawRoundedRect, wrapText } from '@/utils/canvasUtils';
import { loadImage } from '@/utils/assetLoader';
import { calculateScale, calculateSnapThreshold } from '@/utils/scaleUtils';
import { ResizeHandler } from '@/utils/resizeHandler';
import { getOpponentCardCount, dealCard } from '@/utils/cardDealer';
import { CardLayoutManager, recycleGraveyard as recycleGraveyardUtil } from '@/utils/cardLayout';
import { InputHandler } from '@/utils/inputHandler';
import { AIManager } from '@/utils/aiManager';
import { GameRenderer } from '@/utils/gameRenderer';

/**
 * Avatar emoji mapping
 * Maps avatar ID (1-6) to emoji
 */
const AVATAR_EMOJIS: Record<string, string> = {
  '1': 'ðŸ‘¨â€ðŸš€', // Astronaut
  '2': 'ðŸ§™â€â™‚ï¸', // Magier
  '3': 'ðŸ´â€â˜ ï¸', // Pirat
  '4': 'ðŸ¦„', // Einhorn
  '5': 'ðŸ¤–', // Roboter
  '6': 'ðŸ‰', // Drache
};

/**
 * Get avatar emoji from avatar ID
 */
function getAvatarEmoji(avatarId: string | number | null | undefined): string {
  if (!avatarId) return 'ðŸ‘¤';
  return AVATAR_EMOJIS[String(avatarId)] || 'ðŸ‘¤';
}

/**
 * Main application class
 */
class AxesMundiApp {
  private loadingElement: HTMLElement;

  private gameCanvas: HTMLCanvasElement;

  private gameContext: CanvasRenderingContext2D;

  private animationId: number = 0;

  private lastTime: number = 0;

  private fps: number = 60;

  private logoImage: HTMLImageElement | null = null;

  private arrowLeftImage: HTMLImageElement | null = null;

  private arrowRightImage: HTMLImageElement | null = null;

  private backgroundImage: HTMLImageElement | null = null;

  // Game state
  private playerHand: GameCard[] = [];

  private opponentHand: GameCard[] = []; // AI opponent hand

  private boardCard: GameCard | null = null;

  private selectedCard: GameCard | null = null;

  private isDragging: boolean = false;

  private placedLeft: GameCard[] = [];

  private placedRight: GameCard[] = [];

  private graveyard: GameCard[] = []; // Cards that were placed incorrectly

  private score: number = 0;

  private remainingCards: CardData[] = [];

  private deck: any = null; // Deck data for image folder reference

  private gameWon: boolean = false; // Track if player has won

  private gameLost: boolean = false; // Track if player has lost

  private snapThreshold: number = 80; // px distance to axis

  private readonly stackSpacing: number = 140; // px spacing between placed cards

  private scale: number = 1; // Global scale factor

  private resizeHandler: ResizeHandler | null = null; // Resize handler for window resizing

  private layoutManager: CardLayoutManager | null = null; // Card layout manager

  private inputHandler: InputHandler | null = null; // Input handler for mouse events

  private aiManager: AIManager | null = null; // AI manager for opponent turns

  private gameRenderer: GameRenderer | null = null; // Game renderer for all drawing operations

  private isGameStarted: boolean = false; // Track if first card has been placed on axis

  private currentTurn: number = 0; // Track current turn

  private isPlayerTurn: boolean = true; // Track whose turn it is (true = player, false = AI)

  private turnText: string = ''; // Display turn information

  private turnTimer: number = 10; // Default timer

  private gameDifficulty: 'easy' | 'medium' | 'hard'; // Current game difficulty

  private turnTimerInterval: number | null = null; // Timer interval ID

  private isAITurnInProgress: boolean = false; // Prevent multiple AI turns

  // Learning mode state
  private isLearningMode: boolean = false; // Track if we're in learning mode

  private hoveredCard: GameCard | null = null; // Track which card is being hovered for tooltip

  private tooltipCard: GameCard | null = null; // Track which card shows tooltip

  private tooltipVisible: boolean = false; // Track if tooltip is visible

  private weiterButtonBounds: { x: number; y: number; width: number; height: number } | null = null; // Global button bounds

  private clearBoardButtonBounds: { x: number; y: number; width: number; height: number } | null = null; // Clear board button bounds

  private resetGameButtonBounds: { x: number; y: number; width: number; height: number } | null = null; // Reset game button bounds

  // Hotseat mode state
  private isHotseatMode: boolean = false; // Track if we're in hotseat mode

  private player1Data: { name: string; avatar: string } | null = null; // First player data

  private player2Data: { name: string; avatar: string } | null = null; // Second player data

  private currentPlayerIndex: number = 0; // 0 = player1, 1 = player2

  private player1Hand: GameCard[] = []; // First player's hand

  private player2Hand: GameCard[] = []; // Second player's hand

  private currentPlayerHand: GameCard[] = []; // Current active player's hand

  private nextPlayerHand: GameCard[] = []; // Next player's hand (shows card backs)

  private playerSwitchOverlayVisible: boolean = false; // Track if player switch overlay is visible

  private playerSwitchOverlayBounds: { x: number; y: number; width: number; height: number } | null = null; // Player switch overlay bounds

  // LAN mode state
  private isLANMode: boolean = false; // Track if we're in LAN mode

  private lanPlayerName: string = ''; // Current player name in LAN mode

  private lanOpponentName: string = ''; // Opponent player name in LAN mode

  private isLANServerClient: boolean = false; // True if this is the server-client

  private lanCardDistribution: any = null; // Card distribution for LAN mode

  constructor() {
    this.loadingElement = document.getElementById('loading') as HTMLElement;
    this.gameCanvas = document.getElementById('game-canvas') as HTMLCanvasElement;

    // Robust canvas context initialization for browser compatibility
    const context = this.gameCanvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2D canvas context. Browser may not support canvas.');
    }
    this.gameContext = context;

    // Initialize resize handler
    this.resizeHandler = new ResizeHandler(this.gameCanvas, {
      scope: 'renderer/app',
    });

    // Initialize layout manager
    this.layoutManager = new CardLayoutManager({
      scale: this.scale,
      canvasWidth: this.gameCanvas.width,
      canvasHeight: this.gameCanvas.height,
    });

    // Initialize input handler
    this.inputHandler = new InputHandler({
      canvas: this.gameCanvas,
      scale: this.scale,
      snapThreshold: this.snapThreshold,
      isLearningMode: this.isLearningMode,
      isHotseatMode: this.isHotseatMode,
      isPlayerTurn: this.isPlayerTurn,
      gameWon: this.gameWon,
      gameLost: this.gameLost,
      playerSwitchOverlayVisible: this.playerSwitchOverlayVisible,
      callbacks: {
        onCardSelected: (card) => {
          this.selectedCard = card;
          this.isDragging = true;
        },
        onCardPlaced: (card, x, y, isLeft, isFirstCard) => {
          this.handleCardPlacement(card, x, y, isLeft, isFirstCard);
        },
        onCardReturnedToHand: (card) => {
          if (this.inputHandler) {
            this.inputHandler.hidePreview();
          }
          if (this.isHotseatMode) {
            this.layoutHotseatHands();
          } else {
            this.layoutHand();
          }
          logger.info({
            scope: 'renderer/game',
            msg: 'card returned to hand (released outside axis)',
            meta: { cardTitle: card.card.title },
          });
        },
        onWeiterButtonClick: () => {
          const incorrectCard = this.placedLeft.find((card) => card.isCorrect === false)
                                || this.placedRight.find((card) => card.isCorrect === false)
                                || (this.boardCard && this.boardCard.isCorrect === false ? this.boardCard : null);
          if (incorrectCard) {
            this.removeCardFromBoard(incorrectCard);
            logger.info({
              scope: 'renderer/learning',
              msg: 'incorrect card removed by weiter button click',
              meta: {
                cardTitle: incorrectCard.card.title,
                isLearningMode: this.isLearningMode,
              },
            });
          }
        },
        onClearBoardButtonClick: () => {
          this.clearBoard();
        },
        onResetGameButtonClick: () => {
          this.resetLearningGame();
        },
        onNavigationArrowClick: (direction) => {
          if (direction === 'left') {
            this.moveBoardCardsLeft();
          } else {
            this.moveBoardCardsRight();
          }
        },
        onPlayerSwitchOverlayClick: () => {
          this.switchPlayer();
        },
        onCardRemoved: (card) => {
          this.removeCardFromBoard(card);
        },
        onTooltipHover: (card) => {
          const hasIncorrectCard = this.placedLeft.find((c) => c.isCorrect === false)
                                    || this.placedRight.find((c) => c.isCorrect === false)
                                    || (this.boardCard && this.boardCard.isCorrect === false);
          if (!hasIncorrectCard) {
            this.hoveredCard = card;
            this.tooltipCard = card;
            this.tooltipVisible = !!card;
            logger.debug({
              scope: 'renderer/tooltip',
              msg: 'tooltip hover state changed',
              meta: {
                cardTitle: card?.card.title,
                tooltipVisible: this.tooltipVisible,
                isLearningMode: this.isLearningMode,
              },
            });
          }
        },
        onGetBoardCards: () => ({
          boardCard: this.boardCard,
          placedLeft: this.placedLeft,
          placedRight: this.placedRight,
        }),
        onGetPlayerHands: () => ({
          playerHand: this.playerHand,
          currentPlayerHand: this.currentPlayerHand,
          nextPlayerHand: this.nextPlayerHand,
        }),
        onGetButtonBounds: () => ({
          weiterButtonBounds: this.weiterButtonBounds,
          clearBoardButtonBounds: this.clearBoardButtonBounds,
          resetGameButtonBounds: this.resetGameButtonBounds,
          playerSwitchOverlayBounds: this.playerSwitchOverlayBounds,
        }),
        onGetBoardCardCount: () => (this.boardCard ? 1 : 0) + this.placedLeft.length + this.placedRight.length,
        onHasIncorrectCard: () => !!(this.placedLeft.some((card) => card.isCorrect === false)
                                 || this.placedRight.some((card) => card.isCorrect === false)
                                 || (this.boardCard && this.boardCard.isCorrect === false)),
        onFindIncorrectCard: () => this.placedLeft.find((card) => card.isCorrect === false)
                                    || this.placedRight.find((card) => card.isCorrect === false)
                                    || (this.boardCard && this.boardCard.isCorrect === false ? this.boardCard : null),
      },
    });

    // Initialize AI manager
    this.aiManager = new AIManager({
      canvas: this.gameCanvas,
      scale: this.scale,
      isLearningMode: this.isLearningMode,
      callbacks: {
        onGetBoardCards: () => ({
          boardCard: this.boardCard,
          placedLeft: this.placedLeft,
          placedRight: this.placedRight,
        }),
        onCardRemovedFromHand: (card) => {
          const cardIndex = this.opponentHand.indexOf(card);
          if (cardIndex > -1) {
            this.opponentHand.splice(cardIndex, 1);
          }
        },
        onLayoutOpponentHand: () => {
          this.layoutOpponentHand();
        },
        onCardPlaced: (card, isLeft) => {
          if (isLeft) {
            this.placedLeft.push(card);
          } else {
            this.placedRight.push(card);
          }
        },
        onLayoutAxisCards: () => {
          this.layoutAxisCards();
        },
        onCardSetCorrect: (card) => {
          card.setCorrect();
        },
        onTurnComplete: () => {
          this.isPlayerTurn = true;
          this.currentTurn++;
          this.isAITurnInProgress = false;
          this.startTurnTimer();
        },
        onCheckWin: () => {
          this.checkForWin();
        },
        onStartTurnTimer: () => {
          this.startTurnTimer();
        },
        onShowPreview: (x) => {
          if (this.inputHandler) {
            this.inputHandler.showPreview(x);
          }
        },
        onHidePreview: () => {
          if (this.inputHandler) {
            this.inputHandler.hidePreview();
          }
        },
        onPlaySound: (soundType) => {
          soundManager.play(soundType);
        },
      },
    });

    // Initialize game renderer
    this.gameRenderer = new GameRenderer({
      onWeiterButtonBounds: (bounds) => {
        this.weiterButtonBounds = bounds;
      },
      onClearBoardButtonBounds: (bounds) => {
        this.clearBoardButtonBounds = bounds;
      },
      onResetGameButtonBounds: (bounds) => {
        this.resetGameButtonBounds = bounds;
      },
      onPlayerSwitchOverlayBounds: (bounds) => {
        this.playerSwitchOverlayBounds = bounds;
      },
      onGetDifficultyTimer: () => this.getDifficultyTimer(),
    });

    // Register resize callbacks
    this.resizeHandler.onResize(({ width, height, scale }) => {
      this.scale = scale;
      this.snapThreshold = calculateSnapThreshold(scale);

      // Update layout manager config
      if (this.layoutManager) {
        this.layoutManager.updateConfig({
          scale,
          canvasWidth: width,
          canvasHeight: height,
        });
      }

      // Update input handler config
      if (this.inputHandler) {
        this.inputHandler.updateConfig({
          scale,
          snapThreshold: this.snapThreshold,
        });
      }

      // Update AI manager config
      if (this.aiManager) {
        this.aiManager.updateConfig({
          scale,
          canvas: this.gameCanvas,
          isLearningMode: this.isLearningMode,
        });
      }

      // Update scale for all existing cards
      this.updateAllCardsScale();

      // Re-layout all cards with new scale
      this.layoutHand();
      this.layoutOpponentHand();
      this.layoutAxisCards();

      // Re-position board card if it exists
      if (this.boardCard) {
        const centerX = width / 2 - this.boardCard.width / 2;
        const centerY = height / 2 - this.boardCard.height / 2;
        this.boardCard.setTargetPosition(centerX, centerY);
      }

      // Update graveyard positions if any cards exist there
      if (this.graveyard.length > 0) {
        const graveyardX = width - 230 * this.scale;
        const graveyardY = 50 * this.scale;
        this.graveyard.forEach((card) => {
          card.setTargetPosition(graveyardX, graveyardY);
        });
      }
    });

    // Initialize game difficulty from localStorage or default to medium
    const savedDifficulty = localStorage.getItem('selectedDifficulty') as 'easy' | 'medium' | 'hard';
    this.gameDifficulty = savedDifficulty || 'medium';

    // Initialize learning mode and hotseat mode from localStorage
    const savedGameType = localStorage.getItem('selectedGameType');
    this.isLearningMode = savedGameType === 'educational';
    this.isHotseatMode = savedGameType === 'hotseat';

    // Initialize LAN mode from localStorage
    this.isLANMode = savedGameType === 'lan';
    if (this.isLANMode) {
      this.lanPlayerName = localStorage.getItem('axesMundiPlayer') ? JSON.parse(localStorage.getItem('axesMundiPlayer')!).name : 'Player';
      this.lanOpponentName = localStorage.getItem('clientPlayerName') || 'Opponent';
      this.isLANServerClient = localStorage.getItem('isServerClient') === 'true';

      console.log('ðŸŽ® LAN mode initialized:', {
        isLANMode: this.isLANMode,
        lanPlayerName: this.lanPlayerName,
        lanOpponentName: this.lanOpponentName,
        isLANServerClient: this.isLANServerClient,
      });
    }

    // Load player data for hotseat mode and singleplayer modes
    if (this.isHotseatMode) {
      try {
        const player1DataStr = localStorage.getItem('axesMundiPlayer1Data');
        const player2DataStr = localStorage.getItem('axesMundiPlayer2Data');

        if (player1DataStr && player2DataStr) {
          this.player1Data = JSON.parse(player1DataStr);
          this.player2Data = JSON.parse(player2DataStr);

          // Randomly determine starting player
          this.currentPlayerIndex = Math.random() < 0.5 ? 0 : 1;

          logger.info({
            scope: 'renderer/hotseat',
            msg: 'hotseat mode initialized',
            meta: {
              player1: this.player1Data,
              player2: this.player2Data,
              startingPlayer: this.currentPlayerIndex,
            },
          });
        }
      } catch (error: any) {
        logger.error({
          scope: 'renderer/hotseat',
          msg: 'failed to load player data',
          err: { message: (error as Error).message },
        });
      }
    } else {
      // Load player data for singleplayer modes
      try {
        const playerDataStr = localStorage.getItem('axesMundiPlayer');

        if (playerDataStr) {
          const playerData = JSON.parse(playerDataStr);
          this.player1Data = playerData;

          logger.info({
            scope: 'renderer/singleplayer',
            msg: 'singleplayer mode initialized',
            meta: { player1: this.player1Data },
          });
        }
      } catch (error: any) {
        logger.error({
          scope: 'renderer/singleplayer',
          msg: 'failed to load player data',
          err: { message: (error as Error).message },
        });
      }
    }

    logger.info({
      scope: 'renderer/app',
      msg: 'game initialized',
      meta: {
        difficulty: this.gameDifficulty,
        timer: this.getDifficultyTimer(),
        isLearningMode: this.isLearningMode,
      },
    });

    this.initCanvas();
    this.setupEventListeners();
    this.hideLoadingScreen();
    // Calculate initial scale
    this.scale = calculateScale(window.innerWidth, window.innerHeight);
    this.snapThreshold = calculateSnapThreshold(this.scale);

    // Load all UI assets in parallel (fire-and-forget, they'll render when ready)
    this.loadAssets();

    // Check if this is LAN mode - if so, don't start normal game
    const isLANMode = localStorage.getItem('selectedGameType') === 'lan';
    if (isLANMode) {
      logger.info({
        scope: 'renderer/app',
        msg: 'LAN mode detected - skipping normal game initialization',
        meta: { reason: 'LAN mode handled by LANGameManager' },
      });
      this.startGameLoop(); // Start game loop for basic UI only
    } else {
      this.loadGame();
      this.startGameLoop();
    }
  }

  /**
   * Initialize canvas
   */
  private initCanvas(): void {
    try {
      this.gameCanvas.width = window.innerWidth;
      this.gameCanvas.height = window.innerHeight;

      logger.info({ scope: 'renderer/app', msg: 'canvas initialized' });
    } catch (error: any) {
      logger.error({
        scope: 'renderer/app',
        msg: 'failed to initialize canvas',
        err: { message: error.message, stack: error.stack },
      });
      throw error;
    }
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Window resize (handled by ResizeHandler)
    if (this.resizeHandler) {
      this.resizeHandler.attach();
    }

    // Input handling (handled by InputHandler)
    if (this.inputHandler) {
      this.inputHandler.attach();
    }

    logger.debug({ scope: 'renderer/app', msg: 'event listeners set up' });
  }

  /**
   * Load the Axes Mundi logo image
   */
  private async loadLogo(): Promise<void> {
    const asset = await loadImage('./assets/axes-mundi logo.png', {
      scope: 'renderer/app',
    });
    this.logoImage = asset?.image ?? null;
  }

  /**
   * Load arrow images for board navigation
   */
  private async loadArrowImages(): Promise<void> {
    // Load both arrows in parallel with white conversion
    const [leftAsset, rightAsset] = await Promise.all([
      loadImage('./assets/arrow left.png', {
        convertToWhite: true,
        scope: 'renderer/app',
      }),
      loadImage('./assets/arrow right.png', {
        convertToWhite: true,
        scope: 'renderer/app',
      }),
    ]);

    this.arrowLeftImage = leftAsset?.image ?? null;
    this.arrowRightImage = rightAsset?.image ?? null;
  }

  /**
   * Load background image
   */
  private async loadBackgroundImage(): Promise<void> {
    const asset = await loadImage('./assets/background.jpg', {
      scope: 'renderer/app',
    });
    this.backgroundImage = asset?.image ?? null;
  }

  /**
   * Load all UI assets in parallel
   */
  private loadAssets(): void {
    // Fire-and-forget: assets will render when ready
    Promise.all([
      this.loadLogo(),
      this.loadArrowImages(),
      this.loadBackgroundImage(),
    ]).catch((err) => {
      logger.error({
        scope: 'renderer/app',
        msg: 'failed to load assets',
        err: { message: err.message },
      });
    });
  }



  // REMOVED: loadLANGame() - Now handled by LANGameManager

  /**
   * Load game data
   */
  private async loadGame(): Promise<void> {
    try {
      // Load deck from localStorage
      const selectedDeck = localStorage.getItem('selectedDeck') || 'buildings-height-en';

      logger.info({
        scope: 'renderer/game',
        msg: 'loading deck for game',
        meta: {
          selectedDeck,
        },
      });

      this.deck = await loadDeck(selectedDeck);

      // Initialize remaining cards from deck and shuffle them
      this.remainingCards = [...this.deck.cards];
      shuffleCardsInPlace(this.remainingCards);

      // Ensure scale is calculated with correct canvas dimensions
      this.scale = calculateScale(window.innerWidth, window.innerHeight);
      this.snapThreshold = calculateSnapThreshold(this.scale);

      // Get first card for board (turn-based: first card goes to center)
      const boardCardData = this.remainingCards.shift()!;
      this.boardCard = new GameCard(
        boardCardData,
        this.deck,
        50 * this.scale, // Start at deck position
        this.gameCanvas.height - 320 * this.scale, // Deck Y position (same as player hand)
        this.scale,
      );
      this.boardCard.isInHand = false; // Board card is on axis, not in hand

      // Animate first card from deck to center of axis
      this.animateFirstCardToCenter();

      // Start dealing cards immediately (don't wait for animation)
      logger.info({
        scope: 'renderer/game',
        msg: 'starting dealCardsToPlayers immediately',
        meta: { remainingCards: this.remainingCards.length },
      });

      // Deal cards based on game mode
      if (this.isLearningMode) {
        this.dealCardsToPlayersLearningMode();
      } else if (this.isHotseatMode) {
        this.dealCardsToPlayersHotseat();
      } else {
        this.dealCardsToPlayers();
      }

      logger.info({
        scope: 'renderer/game',
        msg: 'game loaded successfully',
        meta: {
          boardCard: boardCardData.title,
          remainingCards: this.remainingCards.length,
          isLearningMode: this.isLearningMode,
        },
      });
    } catch (error: any) {
      logger.error({
        scope: 'renderer/game',
        msg: 'failed to load game',
        err: { message: error.message, stack: error.stack },
      });
    }
  }

  /**
   * Animate cards from deck to hand one by one with 1-second intervals
   */
  private animateCardsToHand(handCards: GameCard[]): void {
    handCards.forEach((card, index) => {
      setTimeout(() => {
        this.playerHand.push(card);
        this.layoutHand(); // Center the hand after each card
      }, index * 2000); // 2 second interval (slower)
    });
  }

  /**
   * Animate first card from deck to center of axis
   */
  private animateFirstCardToCenter(): void {
    logger.info({
      scope: 'renderer/game',
      msg: 'animateFirstCardToCenter called',
      meta: { hasBoardCard: !!this.boardCard },
    });

    if (!this.boardCard) return;

    // Calculate center position
    const centerX = this.gameCanvas.width / 2 - this.boardCard.width / 2;
    const centerY = this.gameCanvas.height / 2 - this.boardCard.height / 2;

    // Animate to center with smooth transition
    this.boardCard.setTargetPosition(centerX, centerY);

    // Mark game as started after animation
    setTimeout(() => {
      this.isGameStarted = true;
      this.currentTurn = 1;

      logger.info({
        scope: 'renderer/game',
        msg: 'first card placed on axis, game started',
        meta: { cardTitle: this.boardCard!.card.title, turn: this.currentTurn },
      });
    }, 2000); // Wait for animation to complete (slower)

    logger.info({
      scope: 'renderer/game',
      msg: 'animating first card to center',
      meta: { cardTitle: this.boardCard.card.title },
    });
  }


  /**
   * Animate a single card from deck to hand
   */
  private animateCardToHand(card: GameCard): void {
    // Add to hand first
    this.playerHand.push(card);

    // Animate to hand position
    this.layoutHand();

    logger.info({
      scope: 'renderer/game',
      msg: 'card animated to hand',
      meta: { cardTitle: card.card.title },
    });
  }


  /**
   * Deal cards to both players based on difficulty
   */
  private dealCardsToPlayers(): void {
    const opponentCardCount = getOpponentCardCount(this.gameDifficulty);

    logger.info({
      scope: 'renderer/game',
      msg: 'dealCardsToPlayers called',
      meta: {
        remainingCards: this.remainingCards.length,
        difficulty: this.gameDifficulty,
        opponentCardCount,
      },
    });

    // LAN mode is now handled by LANGameManager - skip here

    // In LAN mode, client waits for card distribution from server
    // LAN mode is now handled by LANGameManager - skip here

    // Normal AI mode logic (with animations and synchronized sounds)
    // Deal 5 cards to player with small delay
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        soundManager.play(SoundType.CARD_SHUFFLE); // Play sound exactly when card appears
        this.dealCardToPlayer();
      }, i * 200); // 200ms delay between each card (slower)
    }

    // Deal cards to opponent based on difficulty
    for (let i = 0; i < opponentCardCount; i++) {
      setTimeout(() => {
        soundManager.play(SoundType.CARD_SHUFFLE); // Play sound exactly when card appears
        this.dealCardToOpponent();
      }, 1200 + i * 200); // Start after player cards, 200ms delay between each (slower)
    }

    // Set player turn after all cards are dealt
    const totalDealTime = 1200 + 5 * 200 + opponentCardCount * 200; // Player cards + opponent cards
    setTimeout(() => {
      this.isPlayerTurn = true;
      this.updateInputHandlerConfig();

      this.startTurnTimer(); // Start timer for first turn

      logger.info({
        scope: 'renderer/game',
        msg: 'game started, player turn',
        meta: {
          turn: this.currentTurn,
          playerHandSize: this.playerHand.length,
          opponentHandSize: this.opponentHand.length,
          remainingCards: this.remainingCards.length,
          difficulty: this.gameDifficulty,
          opponentCardCount,
        },
      });
    }, totalDealTime); // After all cards are dealt (dynamic based on difficulty)
  }

  /**
   * Deal a card to the player
   */
  private dealCardToPlayer(): void {
    // Recycle graveyard if deck is empty
    if (this.remainingCards.length === 0 && this.graveyard.length > 0) {
      this.recycleGraveyard();
    }

    const cardData = dealCard(this.remainingCards);
    if (cardData) {
      const card = new GameCard(
        cardData,
        this.deck,
        50 * this.scale, // Start at deck position
        this.gameCanvas.height - 320 * this.scale, // Deck Y position (same as player hand)
        this.scale,
      );

      // Add to hand and animate to position
      this.playerHand.push(card);
      this.layoutHand();

      logger.info({
        scope: 'renderer/game',
        msg: 'card dealt to player',
        meta: { cardTitle: cardData.title, handSize: this.playerHand.length },
      });
    }
  }

  // REMOVED: handleCardDistributionFromServer() - Now handled by LANGameManager

  // REMOVED: setupLANIPCListeners() and startLANGame() - Now handled by LANGameManager

  /**
   * Find card in deck by ID
   */
  private findCardInDeck(cardId: string): CardData | null {
    // Search in the original deck data
    if (this.deck && this.deck.cards) {
      return this.deck.cards.find((card: CardData) => card.id === cardId) || null;
    }
    return null;
  }

  // REMOVED: sendCardDistributionToClient() - Now handled by LANGameManager

  /**
   * Deal a card to the opponent
   */
  private dealCardToOpponent(): void {
    logger.info({
      scope: 'renderer/game',
      msg: 'dealCardToOpponent called',
      meta: { remainingCards: this.remainingCards.length, opponentHandSize: this.opponentHand.length },
    });

    // Recycle graveyard if deck is empty
    if (this.remainingCards.length === 0 && this.graveyard.length > 0) {
      this.recycleGraveyard();
    }

    const cardData = dealCard(this.remainingCards);
    if (cardData) {
      const card = new GameCard(
        cardData,
        this.deck,
        50 * this.scale, // Start at deck position
        this.gameCanvas.height - 320 * this.scale, // Deck Y position (same as player hand)
        this.scale,
      );

      // Animate from deck to hand position (card will be added to hand in animateOpponentCardFromDeck)
      this.animateOpponentCardFromDeck(card);

      logger.info({
        scope: 'renderer/game',
        msg: 'opponent card positioned immediately',
        meta: {
          cardTitle: cardData.title,
          handSize: this.opponentHand.length,
        },
      });

      logger.info({
        scope: 'renderer/game',
        msg: 'card dealt to opponent',
        meta: { cardTitle: cardData.title, handSize: this.opponentHand.length, remainingCards: this.remainingCards.length },
      });
    } else {
      logger.warn({
        scope: 'renderer/game',
        msg: 'no cards remaining for opponent',
        meta: { remainingCards: this.remainingCards.length },
      });
    }
  }

  /**
   * Animate a card from deck to opponent hand (same logic as player hand)
   */
  private animateOpponentCardFromDeck(card: GameCard): void {
    // Add to hand first (same as animateCardToHand)
    this.opponentHand.push(card);

    // Layout the entire hand to get correct positions for all cards (same as layoutHand)
    this.layoutOpponentHand();

    logger.info({
      scope: 'renderer/game',
      msg: 'opponent card animated to hand',
      meta: { cardTitle: card.card.title },
    });
  }

  /**
   * Layout opponent hand cards at top of screen (same logic as player hand)
   */
  private layoutOpponentHand(): void {
    if (this.layoutManager) {
      this.layoutManager.layoutHand(this.opponentHand, 'top');
    }

    logger.debug({
      scope: 'renderer/layout',
      msg: 'opponent hand layout updated',
      meta: {
        cardCount: this.opponentHand.length,
        scale: this.scale,
      },
    });
  }

  /**
   * Update turn text display
   */
  private updateTurnText(): void {
    // In learning mode, don't show turn text
    if (this.isLearningMode) {
      this.turnText = '';
      return;
    }

    // LAN mode is now handled by LANGameManager - skip here

    // In hotseat mode, show current player name
    if (this.isHotseatMode) {
      const currentPlayerName = this.currentPlayerIndex === 0
        ? (this.player1Data?.name || 'Player 1')
        : (this.player2Data?.name || 'Player 2');
      this.turnText = `ðŸŽ® ${currentPlayerName}'s turn`;
      return;
    }

    if (this.isPlayerTurn) {
      this.turnText = `Your Turn (${this.playerHand.length} cards) - ${this.turnTimer}s`;
    } else {
      this.turnText = `Opponent's Turn (${this.opponentHand.length} cards) - ${this.turnTimer}s`;
    }
  }

  /**
   * Deal cards to player only (learning mode)
   */
  private dealCardsToPlayersLearningMode(): void {
    try {
      // Deal 5 cards to player (more cards for learning)
      const playerCards = this.remainingCards.splice(0, 5);
      this.playerHand = playerCards.map((card, index) => {
        // Play sound for each card as it's created
        setTimeout(() => {
          soundManager.play(SoundType.CARD_SHUFFLE);
        }, index * 50); // Small delay between sounds for better feel
        return new GameCard(card, this.deck, 50 + index * 120, 500, this.scale);
      });

      // No opponent cards in learning mode
      this.opponentHand = [];

      // Layout only player hand
      this.layoutHand();

      // Set player turn immediately (no timer in learning mode)
      this.isPlayerTurn = true;
      this.updateInputHandlerConfig();

      logger.info({
        scope: 'renderer/game',
        msg: 'cards dealt to player (learning mode)',
        meta: {
          playerCards: this.playerHand.length,
          opponentCards: 0,
          remainingCards: this.remainingCards.length,
          isLearningMode: true,
        },
      });
    } catch (error: any) {
      logger.error({
        scope: 'renderer/game',
        msg: 'failed to deal cards to player (learning mode)',
        err: { message: (error as Error).message, stack: (error as Error).stack },
      });
    }
  }

  /**
   * Deal cards to players (hotseat mode)
   */
  private dealCardsToPlayersHotseat(): void {
    try {
      logger.info({
        scope: 'renderer/game',
        msg: 'dealCardsToPlayersHotseat called',
        meta: {
          remainingCards: this.remainingCards.length,
          currentPlayerIndex: this.currentPlayerIndex,
        },
      });

      // Deal 5 cards to player 1 with delay (like AI mode)
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          soundManager.play(SoundType.CARD_SHUFFLE); // Play sound exactly when card appears
          this.dealCardToPlayer1();
        }, i * 200); // 200ms delay between each card
      }

      // Deal 5 cards to player 2 with delay, starting after player 1
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          soundManager.play(SoundType.CARD_SHUFFLE); // Play sound exactly when card appears
          this.dealCardToPlayer2();
        }, 1200 + i * 200); // Start after player 1 cards
      }

      // Set current player hand based on starting player immediately
      this.currentPlayerHand = this.currentPlayerIndex === 0 ? this.player1Hand : this.player2Hand;
      this.nextPlayerHand = this.currentPlayerIndex === 0 ? this.player2Hand : this.player1Hand;

      // Layout hands immediately to ensure correct positioning
      this.layoutHotseatHands();

      // Set player turn after all cards are dealt (like AI mode)
      const totalDealTime = 1200 + 5 * 200 + 5 * 200; // Player 1 cards + player 2 cards
      setTimeout(() => {
        this.isPlayerTurn = true;
        this.updateInputHandlerConfig();
        this.updateTurnText();

        logger.info({
          scope: 'renderer/game',
          msg: 'hotseat game started, player turn',
          meta: {
            currentPlayerIndex: this.currentPlayerIndex,
            player1Cards: this.player1Hand.length,
            player2Cards: this.player2Hand.length,
            remainingCards: this.remainingCards.length,
            isHotseatMode: true,
          },
        });
      }, totalDealTime);
    } catch (error: any) {
      logger.error({
        scope: 'renderer/game',
        msg: 'failed to deal cards to players (hotseat mode)',
        err: { message: (error as Error).message, stack: (error as Error).stack },
      });
    }
  }

  /**
   * Deal a card to player 1 (hotseat mode)
   */
  private dealCardToPlayer1(): void {
    // Recycle graveyard if deck is empty
    if (this.remainingCards.length === 0 && this.graveyard.length > 0) {
      this.recycleGraveyard();
    }

    if (this.remainingCards.length > 0) {
      const cardData = this.remainingCards.shift()!;
      const card = new GameCard(
        cardData,
        this.deck,
        50 * this.scale, // Start at deck position (bottom left)
        this.gameCanvas.height - 320 * this.scale, // Start at bottom left
        this.scale,
      );

      // Add to hand and animate to position
      this.player1Hand.push(card);
      this.layoutPlayer1Hand();

      logger.info({
        scope: 'renderer/game',
        msg: 'card dealt to player 1',
        meta: { cardTitle: cardData.title, handSize: this.player1Hand.length },
      });
    }
  }

  /**
   * Deal a card to player 2 (hotseat mode)
   */
  private dealCardToPlayer2(): void {
    // Recycle graveyard if deck is empty
    if (this.remainingCards.length === 0 && this.graveyard.length > 0) {
      this.recycleGraveyard();
    }

    if (this.remainingCards.length > 0) {
      const cardData = this.remainingCards.shift()!;
      const card = new GameCard(
        cardData,
        this.deck,
        50 * this.scale, // Start at deck position (bottom left)
        this.gameCanvas.height - 320 * this.scale, // Start at bottom left (same as player 1)
        this.scale,
      );

      // Add to hand and animate to position
      this.player2Hand.push(card);
      this.layoutPlayer2Hand();

      logger.info({
        scope: 'renderer/game',
        msg: 'card dealt to player 2',
        meta: { cardTitle: cardData.title, handSize: this.player2Hand.length },
      });
    }
  }

  /**
   * Layout player 1 hand (position depends on current player)
   */
  private layoutPlayer1Hand(): void {
    const cardSpacing = 220 * this.scale;
    const totalWidth = this.player1Hand.length * cardSpacing - 20 * this.scale;
    const startX = (this.gameCanvas.width - totalWidth) / 2;

    this.player1Hand.forEach((card, index) => {
      const x = startX + index * cardSpacing;
      // Position depends on whether player 1 is the current player
      const y = this.currentPlayerIndex === 0
        ? this.gameCanvas.height - 320 * this.scale // Bottom position (current player)
        : 20 * this.scale; // Top position (next player)
      card.setTargetPosition(x, y);
    });
  }

  /**
   * Layout player 2 hand (position depends on current player)
   */
  private layoutPlayer2Hand(): void {
    const cardSpacing = 220 * this.scale;
    const totalWidth = this.player2Hand.length * cardSpacing - 20 * this.scale;
    const startX = (this.gameCanvas.width - totalWidth) / 2;

    this.player2Hand.forEach((card, index) => {
      const x = startX + index * cardSpacing;
      // Position depends on whether player 2 is the current player
      const y = this.currentPlayerIndex === 1
        ? this.gameCanvas.height - 320 * this.scale // Bottom position (current player)
        : 20 * this.scale; // Top position (next player)
      card.setTargetPosition(x, y);
    });
  }

  /**
   * Get difficulty-based timer duration
   */
  private getDifficultyTimer(): number {
    switch (this.gameDifficulty) {
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
   * Start turn timer
   */
  private startTurnTimer(): void {
    // In learning mode or hotseat mode, no timer
    if (this.isLearningMode || this.isHotseatMode) {
      return;
    }

    this.turnTimer = this.getDifficultyTimer();
    this.updateTurnText();

    this.turnTimerInterval = window.setInterval(() => {
      this.turnTimer--;
      this.updateTurnText();

      if (this.turnTimer <= 0) {
        this.endTurn();
      }
    }, 1000);
  }

  /**
   * Stop turn timer
   */
  private stopTurnTimer(): void {
    if (this.turnTimerInterval) {
      clearInterval(this.turnTimerInterval);
      this.turnTimerInterval = null;
    }
  }

  /**
   * End current turn (time ran out)
   */
  private endTurn(): void {
    this.stopTurnTimer();

    // In learning mode, don't end turns
    if (this.isLearningMode) {
      logger.info({
        scope: 'renderer/timer',
        msg: 'turn end skipped in learning mode',
        meta: { isLearningMode: true },
      });
      return;
    }

    if (this.isPlayerTurn) {
      // Player's time ran out - switch to AI turn
      logger.info({
        scope: 'renderer/timer',
        msg: 'player turn timed out, switching to AI',
        meta: { turn: this.currentTurn },
      });

      this.isPlayerTurn = false;
      this.updateInputHandlerConfig();
      this.currentTurn++;
      this.updateTurnText();

      // Let AI play immediately (only if not already in progress)
      if (this.opponentHand.length > 0 && !this.isAITurnInProgress && this.aiManager) {
        setTimeout(() => {
          this.isAITurnInProgress = this.aiManager!.playTurn(this.opponentHand, this.isAITurnInProgress);
        }, 500);
      }
    } else {
      // AI's time ran out - switch back to player
      logger.info({
        scope: 'renderer/timer',
        msg: 'AI turn timed out, switching to player',
        meta: { turn: this.currentTurn },
      });

      this.isPlayerTurn = true;
      this.updateTurnText();
    }
  }


  /**
   * Show tooltip for incorrect card automatically
   */
  private showTooltipForIncorrectCard(card: GameCard): void {
    this.hoveredCard = card;
    this.tooltipCard = card;
    this.tooltipVisible = true;

    logger.debug({
      scope: 'renderer/tooltip',
      msg: 'tooltip shown automatically for incorrect card',
      meta: {
        cardTitle: card.card.title,
        isLearningMode: this.isLearningMode,
      },
    });
  }

  /**
   * Hide axis preview (delegates to InputHandler)
   */
  private hideAxisPreview(): void {
    if (this.inputHandler) {
      this.inputHandler.hidePreview();
    }
  }

  /**
   * Update input handler config when game state changes
   */
  private updateInputHandlerConfig(): void {
    if (this.inputHandler) {
      this.inputHandler.updateConfig({
        scale: this.scale,
        snapThreshold: this.snapThreshold,
        isLearningMode: this.isLearningMode,
        isHotseatMode: this.isHotseatMode,
        isPlayerTurn: this.isPlayerTurn,
        gameWon: this.gameWon,
        gameLost: this.gameLost,
        playerSwitchOverlayVisible: this.playerSwitchOverlayVisible,
      });
    }

    // Update AI manager config when game state changes
    if (this.aiManager) {
      this.aiManager.updateConfig({
        isLearningMode: this.isLearningMode,
      });
    }
  }

  /**
    * Clear all cards from board and move them to graveyard
    */
  private clearBoard(): void {
    logger.info({
      scope: 'renderer/learning',
      msg: 'clearing board - moving all cards to graveyard',
      meta: {
        boardCards: (this.boardCard ? 1 : 0) + this.placedLeft.length + this.placedRight.length,
        isLearningMode: this.isLearningMode,
      },
    });

    // Move board card to graveyard if it exists
    if (this.boardCard) {
      this.graveyard.push(this.boardCard);
      this.animateCardToGraveyard(this.boardCard);
      this.boardCard = null;
    }

    // Move all placed left cards to graveyard
    for (const card of this.placedLeft) {
      this.graveyard.push(card);
      this.animateCardToGraveyard(card);
    }
    this.placedLeft = [];

    // Move all placed right cards to graveyard
    for (const card of this.placedRight) {
      this.graveyard.push(card);
      this.animateCardToGraveyard(card);
    }
    this.placedRight = [];

    // Clear all button bounds
    this.weiterButtonBounds = null;
    this.clearBoardButtonBounds = null;
    this.resetGameButtonBounds = null;

    // Hide tooltip
    this.tooltipVisible = false;
    this.tooltipCard = null;
    this.hoveredCard = null;

    // Give player new cards if hand is empty
    if (this.playerHand.length === 0 && this.remainingCards.length > 0) {
      const cardsToGive = Math.min(5, this.remainingCards.length);
      for (let i = 0; i < cardsToGive; i++) {
        this.giveNewCard();
      }

      logger.info({
        scope: 'renderer/learning',
        msg: 'gave new cards after clearing board',
        meta: {
          cardsGiven: cardsToGive,
          remainingCards: this.remainingCards.length,
        },
      });
    }

    // Re-center the board after clearing (important for next card placement)
    this.layoutAxisCards();
  }

  /**
    * Reset the learning game with the same deck
    */
  private resetLearningGame(): void {
    logger.info({
      scope: 'renderer/learning',
      msg: 'resetting learning game',
      meta: {
        isLearningMode: this.isLearningMode,
      },
    });

    // Stop any running timer
    this.stopTurnTimer();

    // Clear all button bounds
    this.weiterButtonBounds = null;
    this.clearBoardButtonBounds = null;
    this.resetGameButtonBounds = null;

    // Hide tooltip
    this.tooltipVisible = false;
    this.tooltipCard = null;
    this.hoveredCard = null;

    // Reset game state
    this.gameWon = false;
    this.gameLost = false;
    this.score = 0;
    this.playerHand = [];
    this.opponentHand = [];
    this.placedLeft = [];
    this.placedRight = [];
    this.graveyard = [];
    this.selectedCard = null;
    this.isDragging = false;
    this.isGameStarted = false;
    this.currentTurn = 0;
    this.isPlayerTurn = true;
    this.turnText = '';
    this.turnTimer = 30;

    // Reload the game
    this.loadGame();
  }

  /**
    * Remove card from board and move to graveyard
    */
  private removeCardFromBoard(card: GameCard): void {
    // Remove from appropriate side
    this.placedLeft = this.placedLeft.filter((c) => c !== card);
    this.placedRight = this.placedRight.filter((c) => c !== card);

    // If it's the board card, clear it
    if (this.boardCard === card) {
      this.boardCard = null;
    }

    // Clear global weiter button bounds
    this.weiterButtonBounds = null;

    // Add to graveyard and animate
    logger.info({
      scope: 'renderer/game',
      msg: 'adding card to graveyard',
      meta: {
        cardTitle: card.card.title,
        isCorrect: card.isCorrect,
        isLearningMode: this.isLearningMode,
        graveyardSizeBefore: this.graveyard.length,
      },
    });
    this.graveyard.push(card);
    this.animateCardToGraveyard(card);

    // Re-center remaining cards
    this.layoutAxisCards();

    // Hide tooltip if this card was showing it
    if (this.tooltipCard === card) {
      this.tooltipVisible = false;
      this.tooltipCard = null;
    }

    // Give player a new card (only when removing via "Weiter" button)
    this.giveNewCard();
  }

  /**
   * Move all board cards one card width to the left
   */
  private moveBoardCardsLeft(): void {
    const cardWidth = 200 * this.scale;
    const spacing = 5 * this.scale;
    const moveDistance = cardWidth + spacing;

    // Move board card
    if (this.boardCard) {
      const newX = this.boardCard.x + moveDistance;
      this.boardCard.setTargetPosition(newX, this.boardCard.y);
    }

    // Move placed left cards
    for (const card of this.placedLeft) {
      const newX = card.x + moveDistance;
      card.setTargetPosition(newX, card.y);
    }

    // Move placed right cards
    for (const card of this.placedRight) {
      const newX = card.x + moveDistance;
      card.setTargetPosition(newX, card.y);
    }

    logger.info({
      scope: 'renderer/navigation',
      msg: 'board cards moved left',
      meta: {
        moveDistance,
        totalCards: (this.boardCard ? 1 : 0) + this.placedLeft.length + this.placedRight.length,
      },
    });
  }

  /**
   * Move a card to graveyard (for normal mode incorrect cards)
   */
  private moveCardToGraveyard(card: GameCard): void {
    // Remove from appropriate side
    this.placedLeft = this.placedLeft.filter((c) => c !== card);
    this.placedRight = this.placedRight.filter((c) => c !== card);

    // If it's the board card, clear it
    if (this.boardCard === card) {
      this.boardCard = null;
    }

    // Add to graveyard and animate
    logger.info({
      scope: 'renderer/game',
      msg: 'moving incorrect card to graveyard',
      meta: {
        cardTitle: card.card.title,
        isCorrect: card.isCorrect,
        isLearningMode: this.isLearningMode,
        graveyardSizeBefore: this.graveyard.length,
      },
    });
    this.graveyard.push(card);
    this.animateCardToGraveyard(card);

    // Give player a new card
    this.giveNewCard();

    logger.info({
      scope: 'renderer/game',
      msg: 'incorrect card moved to graveyard',
      meta: {
        cardTitle: card.card.title,
        graveyardSize: this.graveyard.length,
      },
    });
  }

  /**
   * Move all board cards one card width to the right
   */
  private moveBoardCardsRight(): void {
    const cardWidth = 200 * this.scale;
    const spacing = 5 * this.scale;
    const moveDistance = cardWidth + spacing;

    // Move board card
    if (this.boardCard) {
      const newX = this.boardCard.x - moveDistance;
      this.boardCard.setTargetPosition(newX, this.boardCard.y);
    }

    // Move placed left cards
    for (const card of this.placedLeft) {
      const newX = card.x - moveDistance;
      card.setTargetPosition(newX, card.y);
    }

    // Move placed right cards
    for (const card of this.placedRight) {
      const newX = card.x - moveDistance;
      card.setTargetPosition(newX, card.y);
    }

    logger.info({
      scope: 'renderer/navigation',
      msg: 'board cards moved right',
      meta: {
        moveDistance,
        totalCards: (this.boardCard ? 1 : 0) + this.placedLeft.length + this.placedRight.length,
      },
    });
  }

  /**
   * Handle card placement (called from InputHandler)
   */
  private handleCardPlacement(card: GameCard, x: number, y: number, isLeft: boolean, isFirstCard: boolean): void {
    // Play card placement sound
    soundManager.play(SoundType.CARD_PLACE);

    // SPECIAL CASE: If this is the first card after clearing the board, make it the boardCard
    if (isFirstCard) {
      this.boardCard = card;
      card.isInHand = false;

      // Center the first card on the axis
      const centerX = this.gameCanvas.width / 2 - card.width / 2;
      card.setTargetPosition(centerX, y);

      logger.info({
        scope: 'renderer/game',
        msg: 'first card after clear board set as boardCard',
        meta: { cardTitle: card.card.title },
      });
    } else {
      // Normal case: Add to appropriate array based on position
      card.setTargetPosition(x, y);

      if (isLeft) {
        this.placedLeft.push(card);
        card.isInHand = false;
      } else {
        this.placedRight.push(card);
        card.isInHand = false;
      }
    }

    // Remove from hand immediately after snap
    if (this.isHotseatMode) {
      // Remove from the actual player hand (not just the reference)
      if (this.currentPlayerIndex === 0) {
        this.player1Hand = this.player1Hand.filter((c) => c !== card);
      } else {
        this.player2Hand = this.player2Hand.filter((c) => c !== card);
      }
      this.layoutHotseatHands();
    } else {
      this.playerHand = this.playerHand.filter((c) => c !== card);
      this.layoutHand();
    }

    // In learning mode, check if hand is empty and give more cards
    if (this.isLearningMode && this.playerHand.length === 0 && this.remainingCards.length > 0) {
      // Give more cards to keep learning going
      const cardsToGive = Math.min(5, this.remainingCards.length);
      for (let i = 0; i < cardsToGive; i++) {
        this.giveNewCard();
      }

      logger.info({
        scope: 'renderer/game',
        msg: 'hand empty in learning mode, giving more cards',
        meta: {
          cardsGiven: cardsToGive,
          remainingCards: this.remainingCards.length,
        },
      });
    }

    // CHECK: Evaluate placement correctness
    // Create a sorted list of all cards based on their actual X positions
    const allAxisCards = [
      this.boardCard,
      ...this.placedLeft,
      ...this.placedRight,
    ].filter(Boolean) as GameCard[];

    // Sort by X position to get the actual order on the axis
    const sortedAxisCards = allAxisCards.sort((a, b) => a.x - b.x);

    // Extract just the card data for evaluation
    const sortedCardData = sortedAxisCards.map((gc) => gc.card);

    const isCorrect = sortedCardData.length > 0
      ? isAxisCorrectlySorted(sortedCardData)
      : true; // Default to correct if no cards

    if (isCorrect) {
      // STAY: Correct placement - card stays and turns green
      // In learning mode, don't track score
      if (!this.isLearningMode) {
        this.score += getScore(card.card);
      }
      card.setCorrect();
      // Play success sound for correct placement
      setTimeout(() => {
        soundManager.play(SoundType.SUCCESS);
      }, 300); // Small delay after placement sound

      // Clear global weiter button bounds for correct cards
      this.weiterButtonBounds = null;

      // Center the axis immediately after correct placement
      this.layoutAxisCards();

      // TURN-BASED: Switch turns (disabled in learning mode and hotseat mode)
      if (!this.isLearningMode && !this.isHotseatMode) {
        this.isPlayerTurn = false;
        this.currentTurn++;
        this.stopTurnTimer(); // Stop player timer

        // CHECK FOR WIN: Check if player has won
        this.checkForWin();

        // AI TURN: If game not over and AI has cards, let AI play
        if (!this.gameWon && !this.gameLost && this.opponentHand.length > 0 && !this.isAITurnInProgress && this.aiManager) {
          setTimeout(() => {
            this.isAITurnInProgress = this.aiManager!.playTurn(this.opponentHand, this.isAITurnInProgress);
          }, 1000); // 1 second delay
        } else {
          // Keep player turn if AI has no cards
          this.isPlayerTurn = true;
          this.startTurnTimer(); // Start timer for player turn
        }
      } else if (this.isHotseatMode) {
        // Hotseat mode: check for win, then show player switch overlay after 2 seconds
        logger.info({
          scope: 'renderer/game',
          msg: 'hotseat mode: scheduling player switch overlay in 2 seconds',
          meta: {
            cardTitle: card.card.title,
            currentPlayerIndex: this.currentPlayerIndex,
          },
        });

        setTimeout(() => {
          logger.info({
            scope: 'renderer/game',
            msg: 'hotseat mode: 2 seconds passed, now checking win',
            meta: {
              cardTitle: card.card.title,
              currentPlayerIndex: this.currentPlayerIndex,
            },
          });

          // Check for win condition
          this.checkForWin();

          // Only show player switch if game is not won
          if (!this.gameWon) {
            // Show player switch overlay
            this.showPlayerSwitchOverlay();
            logger.info({
              scope: 'renderer/game',
              msg: 'hotseat mode: showing player switch overlay after correct card',
              meta: {
                cardTitle: card.card.title,
                currentPlayerIndex: this.currentPlayerIndex,
              },
            });
          }
        }, 2000);
      } else {
        // Learning mode: keep player turn, no timer, no opponent, give new card
        this.isPlayerTurn = true;
        this.giveNewCard(); // Give new card after correct placement
        logger.info({
          scope: 'renderer/game',
          msg: 'learning mode: keeping player turn and giving new card',
          meta: {
            cardTitle: card.card.title,
            isLearningMode: true,
          },
        });
      }

      logger.info({
        scope: 'renderer/game',
        msg: 'card placed correctly, turned green',
        meta: {
          cardTitle: card.card.title,
          score: this.score,
          turn: this.currentTurn,
        },
      });
    } else {
      // STAY: Incorrect placement - card turns red and stays WHERE PLAYER DROPPED IT
      card.setIncorrect();
      // Play error sound for incorrect placement
      setTimeout(() => {
        soundManager.play(SoundType.ERROR);
      }, 300); // Small delay after placement sound

      // DON'T call layoutAxisCards() here - card should stay where player dropped it
      // to show them their mistake. Cards will be re-centered when incorrect card
      // is moved to graveyard.

      if (this.isLearningMode) {
        // LEARNING MODE: Show tooltip automatically for incorrect card
        this.showTooltipForIncorrectCard(card);
        // Card stays on board until "Weiter" button is clicked
        // NO new card here - will be given when "Weiter" button is clicked
        logger.info({
          scope: 'renderer/game',
          msg: 'learning mode: incorrect card stays on board until weiter button clicked',
          meta: {
            cardTitle: card.card.title,
            turn: this.currentTurn,
          },
        });
      } else if (this.isHotseatMode) {
        // HOTSEAT MODE: Move card to graveyard after 2 seconds, then switch player
        setTimeout(() => {
          this.moveCardToGraveyard(card);
          // Center the axis after card is moved to graveyard
          this.layoutAxisCards();

          // Wait 2 seconds before showing player switch overlay
          setTimeout(() => {
            // Show player switch overlay
            this.showPlayerSwitchOverlay();
            logger.info({
              scope: 'renderer/game',
              msg: 'hotseat mode: showing player switch overlay after incorrect card',
              meta: {
                cardTitle: card.card.title,
                currentPlayerIndex: this.currentPlayerIndex,
              },
            });
          }, 2000);
        }, 2000);

        logger.info({
          scope: 'renderer/game',
          msg: 'hotseat mode: incorrect card will be moved to graveyard in 2 seconds, then switch player',
          meta: {
            cardTitle: card.card.title,
            turn: this.currentTurn,
          },
        });
      } else {
        // NORMAL MODE: Move card to graveyard after 2 seconds (old logic)
        setTimeout(() => {
          this.moveCardToGraveyard(card);
          // Center the axis after card is moved
          this.layoutAxisCards();
        }, 2000);

        logger.info({
          scope: 'renderer/game',
          msg: 'normal mode: incorrect card will be moved to graveyard in 2 seconds',
          meta: {
            cardTitle: card.card.title,
            turn: this.currentTurn,
          },
        });
      }
    }

    logger.info({
      scope: 'renderer/game',
      msg: 'card placed on axis',
      meta: {
        cardTitle: card.card.title,
        turn: this.currentTurn,
      },
    });
  }

  /**
   * Start game loop
   */
  private startGameLoop(): void {
    this.lastTime = performance.now();
    this.gameLoop();
  }

  /**
   * Game loop
   */
  private gameLoop(): void {
    try {
      const currentTime = performance.now();
      const deltaTime = currentTime - this.lastTime;

      if (deltaTime >= 1000 / this.fps) {
        this.update(deltaTime);
        this.render();
        this.lastTime = currentTime;
      }

      this.animationId = requestAnimationFrame(this.gameLoop.bind(this));
    } catch (error: any) {
      logger.error({
        scope: 'renderer/gameloop',
        msg: 'game loop error',
        err: { message: (error as Error).message, stack: (error as Error).stack },
      });
      // Continue the loop even if there's an error
      this.animationId = requestAnimationFrame(this.gameLoop.bind(this));
    }
  }

  /**
   * Update game state
   */
  private update(_deltaTime: number): void {
    // Tick animations for all cards
    if (this.boardCard) {
      this.boardCard.tick?.();
    }

    // Tick standard hands (for AI mode)
    for (const c of this.playerHand) {
      c.tick?.();
    }
    for (const c of this.opponentHand) {
      c.tick?.();
    }

    // Tick hotseat hands (for hotseat mode)
    if (this.isHotseatMode) {
      for (const c of this.player1Hand) {
        c.tick?.();
      }
      for (const c of this.player2Hand) {
        c.tick?.();
      }
      for (const c of this.currentPlayerHand) {
        c.tick?.();
      }
      for (const c of this.nextPlayerHand) {
        c.tick?.();
      }
    }

    // Tick placed cards and graveyard
    for (const c of this.placedLeft) {
      c.tick?.();
    }
    for (const c of this.placedRight) {
      c.tick?.();
    }
    for (const c of this.graveyard) {
      c.tick?.();
    }
  }

  /**
   * Render game
   */
  private render(): void {
    if (!this.gameRenderer) return;

    // Track any card being dragged (to render last for correct z-order)
    let draggingCard: GameCard | null = null;

    // Find dragging card
    if (this.isHotseatMode) {
      const currentHand = this.currentPlayerIndex === 0 ? this.player1Hand : this.player2Hand;
      for (const card of currentHand) {
        if (card.isDragging) {
          draggingCard = card;
          break;
        }
      }
    } else {
      for (const card of this.playerHand) {
        if (card.isDragging) {
          draggingCard = card;
          break;
        }
      }
      for (const card of this.opponentHand) {
        if (card.isDragging) {
          draggingCard = card;
          break;
        }
      }
    }

    // Build render state
    const renderState = {
      canvas: this.gameCanvas,
      ctx: this.gameContext,
      backgroundImage: this.backgroundImage,
      logoImage: this.logoImage,
      arrowLeftImage: this.arrowLeftImage,
      arrowRightImage: this.arrowRightImage,
      scale: this.scale,
      boardCard: this.boardCard,
      playerHand: this.playerHand,
      opponentHand: this.opponentHand,
      placedLeft: this.placedLeft,
      placedRight: this.placedRight,
      graveyard: this.graveyard,
      draggingCard,
      score: this.score,
      currentTurn: this.currentTurn,
      turnText: this.turnText,
      turnTimer: this.turnTimer,
      gameWon: this.gameWon,
      gameLost: this.gameLost,
      isLearningMode: this.isLearningMode,
      isHotseatMode: this.isHotseatMode,
      tooltipVisible: this.tooltipVisible,
      tooltipCard: this.tooltipCard,
      playerSwitchOverlayVisible: this.playerSwitchOverlayVisible,
      remainingCards: this.remainingCards.length,
      gameDifficulty: this.gameDifficulty,
      player1Data: this.player1Data,
      player2Data: this.player2Data,
      currentPlayerIndex: this.currentPlayerIndex,
      player1Hand: this.player1Hand,
      player2Hand: this.player2Hand,
    };

    // Render using GameRenderer
    this.gameRenderer.render(renderState);
  }


  /**
   * Give player a new card from the deck (turn-based)
   */
  private giveNewCard(): void {
    // Recycle graveyard if deck is empty
    if (this.remainingCards.length === 0 && this.graveyard.length > 0) {
      this.recycleGraveyard();
    }

    if (this.remainingCards.length > 0) {
      // Play card shuffle sound for drawing a single card
      soundManager.play(SoundType.CARD_SHUFFLE);
      
      const newCardData = this.remainingCards.shift()!;
      const newCard = new GameCard(
        newCardData,
        this.deck,
        50 * this.scale, // Start position at deck (left)
        this.gameCanvas.height / 2 + 20 * this.scale, // Deck Y position
        this.scale,
      );

      // Add to appropriate hand based on game mode
      if (this.isHotseatMode) {
        // Add to the actual player hand (not just the reference)
        if (this.currentPlayerIndex === 0) {
          this.player1Hand.push(newCard);
        } else {
          this.player2Hand.push(newCard);
        }
        this.layoutHotseatHands();
      } else {
        // Normal mode: animate card from deck to hand
        this.animateCardToHand(newCard);
      }

      // In learning mode or hotseat mode, don't switch turns
      if (!this.isLearningMode && !this.isHotseatMode) {
        // Switch to opponent turn after giving new card
        this.isPlayerTurn = false;
        this.stopTurnTimer(); // Stop player timer

        // Let AI play after a short delay
        if (this.aiManager) {
          setTimeout(() => {
            this.isAITurnInProgress = this.aiManager!.playTurn(this.opponentHand, this.isAITurnInProgress);
          }, 1000);
        }
      }

      logger.info({
        scope: 'renderer/game',
        msg: 'new card given to player',
        meta: {
          cardTitle: newCardData.title,
          remainingCards: this.remainingCards.length,
          turn: this.currentTurn,
          isLearningMode: this.isLearningMode,
        },
      });
    }
  }

  /**
   * Recycle graveyard cards back to deck when deck is empty
   * Moves cards in their current order (no shuffle for LAN sync compatibility)
   * IMPORTANT: Only recycles cards that are actually in the graveyard array,
   * NOT cards that are on the board (boardCard, placedLeft, placedRight)
   */
  private recycleGraveyard(): void {
    if (this.graveyard.length === 0) return;

    // Safety check: Ensure no board cards are in the graveyard
    // This should never happen, but we check to prevent bugs
    const boardCardIds = new Set<string>();
    if (this.boardCard) {
      boardCardIds.add(this.boardCard.card.id);
    }
    this.placedLeft.forEach((card) => boardCardIds.add(card.card.id));
    this.placedRight.forEach((card) => boardCardIds.add(card.card.id));

    // Filter out any board cards that might have been incorrectly added to graveyard
    const validGraveyard = this.graveyard.filter(
      (card) => !boardCardIds.has(card.card.id),
    );

    if (validGraveyard.length !== this.graveyard.length) {
      logger.warn({
        scope: 'renderer/game',
        msg: 'found board cards in graveyard during recycle - filtering them out',
        meta: {
          graveyardSize: this.graveyard.length,
          validGraveyardSize: validGraveyard.length,
          boardCardCount: boardCardIds.size,
        },
      });
    }

    // Use utility function to recycle only valid graveyard cards
    this.remainingCards = recycleGraveyardUtil(validGraveyard, this.remainingCards);

    // Clear the graveyard (GameCard objects)
    this.graveyard = [];
  }

  /**
   * Layout remaining hand cards nicely along bottom
   */
  private layoutHand(): void {
    if (this.layoutManager) {
      this.layoutManager.layoutHand(this.playerHand, 'bottom');
    }
  }

  /**
   * Layout hotseat hands (current player at bottom, next player at top)
   */
  private layoutHotseatHands(): void {
    if (!this.layoutManager) return;

    // Layout current player hand (bottom) and next player hand (top)
    if (this.currentPlayerIndex === 0) {
      // Player 1 is current player
      this.layoutManager.layoutHand(this.player1Hand, 'bottom');
      this.layoutManager.layoutHand(this.player2Hand, 'top');
    } else {
      // Player 2 is current player
      this.layoutManager.layoutHand(this.player2Hand, 'bottom');
      this.layoutManager.layoutHand(this.player1Hand, 'top');
    }

    logger.debug({
      scope: 'renderer/layout',
      msg: 'hotseat hands layout updated',
      meta: {
        currentPlayerCards: this.currentPlayerIndex === 0 ? this.player1Hand.length : this.player2Hand.length,
        nextPlayerCards: this.currentPlayerIndex === 0 ? this.player2Hand.length : this.player1Hand.length,
        currentPlayerIndex: this.currentPlayerIndex,
        scale: this.scale,
      },
    });
  }

  /**
   * Layout all cards on the axis - center them with fixed 5px spacing
   */
  private layoutAxisCards(): void {
    if (!this.boardCard || !this.layoutManager) return;

    // Combine all placed cards with the board card
    const allCards = [
      this.boardCard,
      ...this.placedLeft,
      ...this.placedRight,
    ];

    if (allCards.length <= 1) return; // No need to spread if only one card

    // Use layout manager to layout axis cards (will sort by value)
    this.layoutManager.layoutAxis(allCards);
  }

  /**
   * Check if player has won the game (turn-based)
   */
  private checkForWin(): void {
    // In learning mode, no win/lose conditions
    if (this.isLearningMode) {
      return;
    }

    // Hotseat mode: check current player hand
    if (this.isHotseatMode) {
      const currentPlayerHandLength = this.currentPlayerIndex === 0 ? this.player1Hand.length : this.player2Hand.length;

      if (currentPlayerHandLength === 0 && !this.gameLost) {
        this.gameWon = true;
        this.updateInputHandlerConfig();

        const winnerName = this.currentPlayerIndex === 0
          ? (this.player1Data?.name || 'Player 1')
          : (this.player2Data?.name || 'Player 2');

        logger.info({
          scope: 'renderer/game',
          msg: 'HOTSEAT GAME WON!',
          meta: {
            winnerName,
            currentPlayerIndex: this.currentPlayerIndex,
            currentPlayerHandLength,
            remainingCards: this.remainingCards.length,
          },
        });

        // Show win dialog after 4 seconds delay
        setTimeout(() => {
          this.showHotseatWinDialog(winnerName);
        }, 4000);
      }
      return;
    }

    // Normal mode: Check for player win (hand empty)
    if (this.playerHand.length === 0 && !this.gameLost) {
      this.gameWon = true;

      logger.info({
        scope: 'renderer/game',
        msg: 'PLAYER WON THE GAME!',
        meta: {
          finalScore: this.score,
          finalTurn: this.currentTurn,
          remainingCards: this.remainingCards.length,
        },
      });

      // Show win dialog after 4 seconds delay
      setTimeout(() => {
        this.showWinDialog();
      }, 4000);
    }

    // Check for AI win (opponent hand empty)
    if (this.opponentHand.length === 0 && !this.gameWon) {
      this.gameLost = true;

      logger.info({
        scope: 'renderer/game',
        msg: 'PLAYER LOST THE GAME!',
        meta: {
          finalScore: this.score,
          finalTurn: this.currentTurn,
          remainingCards: this.remainingCards.length,
        },
      });

      // Show lose dialog after 4 seconds delay
      setTimeout(() => {
        this.showLoseDialog();
      }, 4000);
    }
  }

  /**
   * Update scale for all existing cards
   */
  private updateAllCardsScale(): void {
    if (!this.layoutManager) return;

    // Collect all cards
    const allCards: GameCard[] = [
      ...(this.boardCard ? [this.boardCard] : []),
      ...this.playerHand,
      ...this.opponentHand,
      ...this.placedLeft,
      ...this.placedRight,
      ...this.graveyard,
    ];

    // Update scale for all cards
    this.layoutManager.updateScale(allCards);
  }

  /**
   * Show player switch overlay for hotseat mode
   */
  private showPlayerSwitchOverlay(): void {
    this.playerSwitchOverlayVisible = true;
    // Disable player turn while overlay is visible
    this.isPlayerTurn = false;
    this.updateInputHandlerConfig();
    logger.info({
      scope: 'renderer/hotseat',
      msg: 'player switch overlay shown',
      meta: { currentPlayerIndex: this.currentPlayerIndex },
    });
  }

  /**
   * Switch players in hotseat mode
   */
  private switchPlayer(): void {
    // Switch player index
    this.currentPlayerIndex = this.currentPlayerIndex === 0 ? 1 : 0;

    // Update current and next player hands based on new index
    this.currentPlayerHand = this.currentPlayerIndex === 0 ? this.player1Hand : this.player2Hand;
    this.nextPlayerHand = this.currentPlayerIndex === 0 ? this.player2Hand : this.player1Hand;

    // Layout hands (card backs are handled in render method)
    this.layoutHotseatHands();

    // Update turn text to show new current player
    this.updateTurnText();

    // Hide overlay and re-enable player turn
    this.playerSwitchOverlayVisible = false;
    this.updateInputHandlerConfig();
    this.playerSwitchOverlayBounds = null;
    this.isPlayerTurn = true;

    logger.info({
      scope: 'renderer/hotseat',
      msg: 'player switched',
      meta: {
        newPlayerIndex: this.currentPlayerIndex,
        currentPlayerCards: this.currentPlayerHand.length,
        nextPlayerCards: this.nextPlayerHand.length,
      },
    });
  }

  /**
   * Animate card to graveyard position
   */
  private animateCardToGraveyard(card: GameCard): void {
    // Calculate graveyard position (top right corner)
    const graveyardX = this.gameCanvas.width - 230 * this.scale; // Aligned with graveyard box
    const graveyardY = 50 * this.scale; // 50px from top

    // Set target position for smooth animation
    card.setTargetPosition(graveyardX, graveyardY);

    logger.info({
      scope: 'renderer/game',
      msg: 'card animated to graveyard',
      meta: { cardTitle: card.card.title, graveyardX, graveyardY },
    });
  }

  /**
   * Show hotseat win dialog
   */
  private showHotseatWinDialog(winnerName: string): void {
    const title = '🎉 Congratulations! 🎉';
    const message = `${winnerName} hat das Spiel gewonnen!\n\nAlle Karten wurden erfolgreich sortiert!`;
    
    this.showCustomWinDialog(title, message);
  }

  /**
   * Show win dialog
   */
  private showWinDialog(): void {
    const title = '🎉 Congratulations! 🎉';
    const message = `You successfully sorted all the cards!\n\nFinal score: ${this.score}\nNumber of turns: ${this.currentTurn}`;
    
    this.showCustomWinDialog(title, message);
  }

  /**
   * Show lose dialog
   */
  private showLoseDialog(): void {
    const title = '😔 Verloren! 😔';
    const message = `Your opponent sorted all cards first!\n\nFinal score: ${this.score}\nNumber of turns: ${this.currentTurn}`;
    
    this.showCustomWinDialog(title, message);
  }

  /**
   * Show custom win dialog with two buttons
   */
  private showCustomWinDialog(title: string, message: string): void {
    try {
      // Create dialog overlay
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: Arial, sans-serif;
      `;

      // Create dialog box
      const dialog = document.createElement('div');
      dialog.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 20px;
        padding: 40px;
        max-width: 500px;
        width: 90%;
        text-align: center;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        color: white;
        border: 2px solid rgba(255, 255, 255, 0.2);
      `;

      // Create title
      const titleElement = document.createElement('h2');
      titleElement.textContent = title;
      titleElement.style.cssText = `
        margin: 0 0 20px 0;
        font-size: 28px;
        font-weight: bold;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
      `;

      // Create message
      const messageElement = document.createElement('p');
      messageElement.textContent = message;
      messageElement.style.cssText = `
        margin: 0 0 30px 0;
        font-size: 16px;
        line-height: 1.5;
        white-space: pre-line;
      `;

      // Create button container
      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = `
        display: flex;
        gap: 15px;
        justify-content: center;
        flex-wrap: wrap;
      `;

      // Create "Nochmal spielen" button
      const playAgainButton = document.createElement('button');
      playAgainButton.textContent = 'Nochmal spielen';
      playAgainButton.style.cssText = `
        background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
        color: white;
        border: none;
        padding: 15px 30px;
        border-radius: 25px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
        min-width: 150px;
      `;

      // Create "Main Menu" button
      const mainMenuButton = document.createElement('button');
      mainMenuButton.textContent = 'Main Menu';
      mainMenuButton.style.cssText = `
        background: linear-gradient(135deg, #FF6B6B 0%, #ee5a52 100%);
        color: white;
        border: none;
        padding: 15px 30px;
        border-radius: 25px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(255, 107, 107, 0.3);
        min-width: 150px;
      `;

      // Add hover effects
      playAgainButton.addEventListener('mouseenter', () => {
        playAgainButton.style.transform = 'translateY(-2px)';
        playAgainButton.style.boxShadow = '0 6px 20px rgba(76, 175, 80, 0.4)';
      });
      playAgainButton.addEventListener('mouseleave', () => {
        playAgainButton.style.transform = 'translateY(0)';
        playAgainButton.style.boxShadow = '0 4px 15px rgba(76, 175, 80, 0.3)';
      });

      mainMenuButton.addEventListener('mouseenter', () => {
        mainMenuButton.style.transform = 'translateY(-2px)';
        mainMenuButton.style.boxShadow = '0 6px 20px rgba(255, 107, 107, 0.4)';
      });
      mainMenuButton.addEventListener('mouseleave', () => {
        mainMenuButton.style.transform = 'translateY(0)';
        mainMenuButton.style.boxShadow = '0 4px 15px rgba(255, 107, 107, 0.3)';
      });

      // Add click handlers with debouncing
      let isButtonClicked = false;
      
      playAgainButton.addEventListener('click', () => {
        if (isButtonClicked) return;
        isButtonClicked = true;
        
        soundManager.play(SoundType.BUTTON_CLICK);
        playAgainButton.style.opacity = '0.6';
        
        // Small delay to allow sound to play before removing overlay
        setTimeout(() => {
          document.body.removeChild(overlay);
          this.restartGame();
        }, 100);
      });

      mainMenuButton.addEventListener('click', () => {
        if (isButtonClicked) return;
        isButtonClicked = true;
        
        soundManager.play(SoundType.BUTTON_CLICK);
        mainMenuButton.style.opacity = '0.6';
        
        // Small delay to allow sound to play before navigation
        setTimeout(() => {
          document.body.removeChild(overlay);
          this.goToMainMenu();
        }, 100);
      });

      // Assemble dialog
      buttonContainer.appendChild(playAgainButton);
      buttonContainer.appendChild(mainMenuButton);
      dialog.appendChild(titleElement);
      dialog.appendChild(messageElement);
      dialog.appendChild(buttonContainer);
      overlay.appendChild(dialog);

      // Add to page
      document.body.appendChild(overlay);

      logger.info({
        scope: 'renderer/game',
        msg: 'custom win dialog displayed',
      });

    } catch (error: any) {
      logger.error({
        scope: 'renderer/game',
        msg: 'failed to show custom win dialog',
        err: { message: (error as Error).message },
      });
      
      // Fallback to simple confirm
      const playAgain = confirm(`${title}\n\n${message}\n\nNochmal spielen?`);
      if (playAgain) {
        this.restartGame();
      } else {
        this.goToMainMenu();
      }
    }
  }

  /**
   * Navigate to main menu
   */
  private goToMainMenu(): void {
    try {
      logger.info({
        scope: 'renderer/game',
        msg: 'navigating to main menu',
      });
      window.location.href = './index.html';
    } catch (error: any) {
      logger.error({
        scope: 'renderer/game',
        msg: 'failed to navigate to main menu',
        err: { message: (error as Error).message },
      });
    }
  }

  /**
   * Restart the game
   */
  private restartGame(): void {
    logger.info({
      scope: 'renderer/game',
      msg: 'restarting game',
    });

    // Stop any running timer
    this.stopTurnTimer();

    // Reset game state
    this.gameWon = false;
    this.gameLost = false;
    this.score = 0;
    this.playerHand = [];
    this.opponentHand = [];
    this.player1Hand = [];
    this.player2Hand = [];
    this.currentPlayerHand = [];
    this.nextPlayerHand = [];
    this.placedLeft = [];
    this.placedRight = [];
    this.graveyard = [];
    this.selectedCard = null;
    this.isDragging = false;
    this.isGameStarted = false;
    this.currentTurn = 0;
    this.isPlayerTurn = true;
    this.turnText = '';
    this.turnTimer = 30;
    this.playerSwitchOverlayVisible = false;
    this.updateInputHandlerConfig();
    this.playerSwitchOverlayBounds = null;

    // Reload the game
    this.loadGame();
  }

  /**
   * Hide loading screen
   */
  private hideLoadingScreen(): void {
    try {
      this.loadingElement.style.display = 'none';
      logger.info({ scope: 'renderer/app', msg: 'loading screen hidden' });
    } catch (error: any) {
      logger.error({
        scope: 'renderer/app',
        msg: 'failed to hide loading screen',
        err: { message: error.message },
      });
    }
  }
}

/**
 * Initialize sound manager
 */
async function initSoundManagerAsync(): Promise<void> {
  try {
    await soundManager.init();
    logger.info({ scope: 'renderer/app', msg: 'sound manager initialized' });
  } catch (error: any) {
    logger.error({
      scope: 'renderer/app',
      msg: 'failed to initialize sound manager',
      err: { message: (error as Error).message },
    });
  }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize sound manager first
    await initSoundManagerAsync();
    
    new AxesMundiApp();
    logger.info({ scope: 'renderer/app', msg: 'app initialized successfully' });
  } catch (error: any) {
    logger.error({
      scope: 'renderer/app',
      msg: 'app initialization failed',
      err: { message: error.message, stack: error.stack },
    });

    // Show error to user
    const loadingElement = document.getElementById('loading') as HTMLElement;
    if (loadingElement) {
      loadingElement.textContent = 'Failed to initialize app';
      loadingElement.style.color = '#ff4444';
    }
  }
});
