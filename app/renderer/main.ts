import { logger } from '@/utils/logger';
import { loadDeck } from '@/data/deckLoader';
import { isAxisCorrectlySorted, getScore, convertToComparable } from '@/data/scoring';
import { GameCard } from '@/game/Card';
import { Card as CardData } from '@/data/types';
import { soundManager, SoundType } from '@/utils/soundManager';
import { drawRoundedRect, wrapText } from '@/utils/canvasUtils';
import { loadImage } from '@/utils/assetLoader';
import { calculateScale, calculateSnapThreshold } from '@/utils/scaleUtils';
import { ResizeHandler } from '@/utils/resizeHandler';

/**
 * Avatar emoji mapping
 * Maps avatar ID (1-6) to emoji
 */
const AVATAR_EMOJIS: Record<string, string> = {
  '1': '👨‍🚀', // Astronaut
  '2': '🧙‍♂️', // Magier
  '3': '🏴‍☠️', // Pirat
  '4': '🦄', // Einhorn
  '5': '🤖', // Roboter
  '6': '🐉', // Drache
};

/**
 * Get avatar emoji from avatar ID
 */
function getAvatarEmoji(avatarId: string | number | null | undefined): string {
  if (!avatarId) return '👤';
  return AVATAR_EMOJIS[String(avatarId)] || '👤';
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

  private isPreviewActive: boolean = false; // Track if preview is currently active

  private lastPreviewX: number = 0; // Track last preview position for dynamic updates

  private scale: number = 1; // Global scale factor

  private resizeHandler: ResizeHandler | null = null; // Resize handler for window resizing

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

    // Register resize callbacks
    this.resizeHandler.onResize(({ width, height, scale }) => {
      this.scale = scale;
      this.snapThreshold = calculateSnapThreshold(scale);

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

      console.log('🎮 LAN mode initialized:', {
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

    // Mouse events for card interaction - use window for mousemove/mouseup to handle drag outside canvas
    this.gameCanvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    window.addEventListener('mousemove', this.handleMouseMove.bind(this));
    window.addEventListener('mouseup', this.handleMouseUp.bind(this));

    // Arrow navigation clicks
    this.gameCanvas.addEventListener('click', this.handleCanvasClick.bind(this));

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
      this.shuffleDeck();

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
   * Shuffle the deck using Fisher-Yates algorithm
   */
  private shuffleDeck(): void {
    try {
      for (let i = this.remainingCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.remainingCards[i], this.remainingCards[j]] = [this.remainingCards[j], this.remainingCards[i]];
      }

      logger.info({
        scope: 'renderer/game',
        msg: 'deck shuffled successfully',
        meta: { cardCount: this.remainingCards.length },
      });
    } catch (error: any) {
      logger.error({
        scope: 'renderer/game',
        msg: 'failed to shuffle deck',
        err: { message: error.message, stack: error.stack },
      });
    }
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
   * Get difficulty-based opponent card count
   */
  private getOpponentCardCount(): number {
    switch (this.gameDifficulty) {
      case 'easy':
        return 7;
      case 'medium':
        return 6;
      case 'hard':
        return 5;
      default:
        return 5;
    }
  }

  /**
   * Deal cards to both players based on difficulty
   */
  private dealCardsToPlayers(): void {
    const opponentCardCount = this.getOpponentCardCount();

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

    if (this.remainingCards.length > 0) {
      const cardData = this.remainingCards.shift()!;
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

    if (this.remainingCards.length > 0) {
      const cardData = this.remainingCards.shift()!;
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
    const cardSpacing = 220 * this.scale; // Same spacing as player hand
    const totalWidth = this.opponentHand.length * cardSpacing - 20 * this.scale; // Same calculation
    const startX = (this.gameCanvas.width - totalWidth) / 2; // Center the hand

    this.opponentHand.forEach((card, index) => {
      const x = startX + index * cardSpacing;
      const y = 20 * this.scale; // Top edge position

      // Use setTargetPosition like layoutHand (same logic)
      card.setTargetPosition(x, y);
    });

    logger.debug({
      scope: 'renderer/layout',
      msg: 'opponent hand layout updated',
      meta: {
        cardCount: this.opponentHand.length,
        scale: this.scale,
        cardSpacing,
        totalWidth,
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
      this.turnText = `🎮 ${currentPlayerName}'s turn`;
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
      this.currentTurn++;
      this.updateTurnText();

      // Let AI play immediately (only if not already in progress)
      if (this.opponentHand.length > 0 && !this.isAITurnInProgress) {
        setTimeout(() => {
          this.playAITurn();
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
    * Play AI turn - simulates player drag mechanics
    */
  private playAITurn(): void {
    // Don't play AI turn in learning mode
    if (this.isLearningMode) {
      logger.info({
        scope: 'renderer/ai',
        msg: 'AI turn skipped in learning mode',
        meta: { isLearningMode: true },
      });
      return;
    }

    // Prevent multiple AI turns from running simultaneously
    if (this.isAITurnInProgress) {
      logger.warn({
        scope: 'renderer/ai',
        msg: 'AI turn already in progress, skipping duplicate call',
        meta: { opponentHandSize: this.opponentHand.length },
      });
      return;
    }

    this.isAITurnInProgress = true;

    logger.info({
      scope: 'renderer/ai',
      msg: 'playAITurn called',
      meta: { opponentHandSize: this.opponentHand.length },
    });

    if (this.opponentHand.length === 0) {
      // AI has no cards, check for win or skip turn
      logger.warn({
        scope: 'renderer/ai',
        msg: 'AI has no cards, skipping turn',
        meta: { opponentHandSize: this.opponentHand.length },
      });

      // Switch back to player turn
      this.isPlayerTurn = true;
      this.isAITurnInProgress = false; // Reset flag
      this.startTurnTimer(); // Start timer for player turn
      return;
    }

    // AI randomly selects a card from hand
    const randomIndex = Math.floor(Math.random() * this.opponentHand.length);
    const aiCard = this.opponentHand[randomIndex];

    // Simulate player drag mechanics - find correct position by scanning
    this.simulateAIDragToCorrectPosition(aiCard);

    logger.info({
      scope: 'renderer/ai',
      msg: 'AI starting drag simulation',
      meta: {
        cardTitle: aiCard.card.title,
      },
    });
  }

  /**
   * Simulate AI drag to find correct position - animates directly to the correct position
   */
  private simulateAIDragToCorrectPosition(aiCard: GameCard): void {
    // Start drag from opponent hand position
    const startX = aiCard.x;
    const startY = aiCard.y;

    // Calculate the correct target position directly (no scanning needed)
    const targetX = this.findCorrectPosition(aiCard);
    const axisY = this.gameCanvas.height / 2;
    const targetY = axisY - aiCard.height / 2;

    logger.info({
      scope: 'renderer/ai',
      msg: 'AI calculated correct position',
      meta: {
        cardTitle: aiCard.card.title,
        cardValue: aiCard.card.value,
        cardUnit: aiCard.card.unit,
        startX,
        startY,
        targetX,
        targetY,
      },
    });

    // Simulate picking up card from hand
    aiCard.startDrag(startX, startY);

    // Animate card from hand directly to correct position
    const animationDuration = 800; // 800ms to move from hand to target
    const animationSteps = 40; // 40 steps for smooth animation
    const stepDuration = animationDuration / animationSteps;

    // Calculate when to start showing the preview (when card is 30% through animation)
    const previewStartStep = Math.floor(animationSteps * 0.3);
    let previewShown = false;

    let step = 0;
    const animationInterval = setInterval(() => {
      // Interpolate from hand position to target position
      const progress = step / animationSteps;
      // Use easeOutQuad for smooth deceleration
      const easedProgress = 1 - (1 - progress) * (1 - progress);
      
      const currentX = startX + (targetX - startX) * easedProgress;
      const currentY = startY + (targetY - startY) * easedProgress;

      // Move card to current position
      aiCard.updateDrag(currentX, currentY);

      // Show axis preview when card gets close to the axis (board cards spread apart)
      if (step >= previewStartStep && !previewShown) {
        this.showAxisPreview(targetX + aiCard.width / 2);
        previewShown = true;
      } else if (previewShown) {
        // Update preview position as card moves
        this.showAxisPreview(currentX + aiCard.width / 2);
      }

      step++;
      if (step >= animationSteps) {
        clearInterval(animationInterval);

        // DON'T hide preview here - let the card be placed into the open space
        // The preview will be cleared when layoutAxisCards() is called after placement

        // Place the card at the correct position (into the open space)
        this.placeAICardAtPosition(aiCard, targetX, axisY);
      }
    }, stepDuration);
  }

  /**
   * Place AI card at the calculated correct position
   */
  private placeAICardAtPosition(aiCard: GameCard, x: number, y: number): void {
    // Stop dragging
    aiCard.stopDrag();

    // The card is now at its position in the gap created by the preview
    // DON'T set target position yet - let the card stay where it is

    // Immediately update game state (no delay - card is already in position)
    // Remove the specific card from opponent hand
    const cardIndex = this.opponentHand.indexOf(aiCard);
    if (cardIndex > -1) {
      this.opponentHand.splice(cardIndex, 1);
      this.layoutOpponentHand();
    }

    // Add to appropriate array based on card value (not position)
    // Determine left/right by comparing card value to board card value
    const aiCardValue = convertToComparable(aiCard.card.value, aiCard.card.unit);
    const boardCardValue = this.boardCard 
      ? convertToComparable(this.boardCard.card.value, this.boardCard.card.unit) 
      : 0;
    const isLeft = aiCardValue < boardCardValue;

    // Play card placement sound for AI
    soundManager.play(SoundType.CARD_PLACE);

    if (isLeft) {
      this.placedLeft.push(aiCard);
      aiCard.isInHand = false;
    } else {
      this.placedRight.push(aiCard);
      aiCard.isInHand = false;
    }

    // Small delay to show the card in position, then re-center all cards smoothly
    setTimeout(() => {
      // Clear preview positions before re-centering
      this.hideAxisPreview();

      // Center all cards (including the newly placed AI card)
      this.layoutAxisCards();

      // Mark card as correct and play success sound
      aiCard.setCorrect();
      setTimeout(() => {
        soundManager.play(SoundType.SUCCESS);
      }, 300); // Small delay after placement sound

      // Switch back to player turn
      this.isPlayerTurn = true;
      this.currentTurn++;
      this.isAITurnInProgress = false; // Reset AI turn flag
      this.startTurnTimer(); // Start timer for player turn

      // Check for AI win
      this.checkForWin();

      logger.info({
        scope: 'renderer/ai',
        msg: 'AI card placed successfully',
        meta: {
          cardTitle: aiCard.card.title,
          turn: this.currentTurn,
          position: { x, y },
          isLeft,
        },
      });
    }, 400); // Brief pause to show card in the gap, then re-center
  }

  /**
   * Find the correct position for a card on the axis
   */
  private findCorrectPosition(card: GameCard): number {
    // Get all cards currently on axis
    const allCards = [
      this.boardCard,
      ...this.placedLeft,
      ...this.placedRight,
    ].filter(Boolean) as GameCard[];

    // Add the new card to the list
    const cardsWithNew = [...allCards, card];

    // Sort by axis value to find correct position
    const sortedCards = cardsWithNew.sort((a, b) => {
      const aValue = convertToComparable(a.card.value, a.card.unit);
      const bValue = convertToComparable(b.card.value, b.card.unit);
      return aValue - bValue;
    });

    // Find the index of the new card in the sorted list
    const cardIndex = sortedCards.findIndex((c) => c === card);

    // Calculate position based on index
    const cardWidth = 200 * this.scale;
    const spacing = 5 * this.scale;
    const totalWidth = sortedCards.length * cardWidth + (sortedCards.length - 1) * spacing;
    const startX = (this.gameCanvas.width - totalWidth) / 2;

    return startX + cardIndex * (cardWidth + spacing);
  }

  /**
   * Animate AI card to its correct position
   */
  private animateAICardToPosition(card: GameCard, targetX: number): void {
    const axisY = this.gameCanvas.height / 2;
    const targetY = axisY - card.height / 2;

    // Animate card to position
    card.setTargetPosition(targetX, targetY);

    // After animation, update game state
    setTimeout(() => {
      // Remove from opponent hand
      this.opponentHand = this.opponentHand.filter((c) => c !== card);
      this.layoutOpponentHand();

      // Add to appropriate array based on position
      // Use getOriginalX() to handle case where preview might be active
      const boardCenterX = this.boardCard ? (this.boardCard.getOriginalX() + this.boardCard.width / 2) : this.gameCanvas.width / 2;
      const isLeft = targetX < boardCenterX;

      // Play card placement sound for AI animation
      soundManager.play(SoundType.CARD_PLACE);

      if (isLeft) {
        this.placedLeft.push(card);
        card.isInHand = false;
      } else {
        this.placedRight.push(card);
        card.isInHand = false;
      }

      // Center all cards
      this.layoutAxisCards();

      // Mark card as correct and play success sound
      card.setCorrect();
      setTimeout(() => {
        soundManager.play(SoundType.SUCCESS);
      }, 300); // Small delay after placement sound

      // Switch back to player turn
      this.isPlayerTurn = true;
      this.currentTurn++;
      this.isAITurnInProgress = false; // Reset AI turn flag
      this.startTurnTimer(); // Start timer for player turn

      // Check for AI win
      this.checkForWin();

      logger.info({
        scope: 'renderer/ai',
        msg: 'AI card placed successfully',
        meta: {
          cardTitle: card.card.title,
          turn: this.currentTurn,
        },
      });
    }, 1000); // Wait for animation
  }

  /**
   * Handle mouse down
   */
  private handleMouseDown(event: MouseEvent): void {
    // Only allow interaction during player turn
    // In learning mode, ignore win/lose conditions
    if (!this.isPlayerTurn || (!this.isLearningMode && (this.gameWon || this.gameLost))) {
      return;
    }

    const rect = this.gameCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;


    // Check player hand cards
    if (this.isHotseatMode) {
      // Check current player hand in hotseat mode
      for (const card of this.currentPlayerHand) {
        if (card.containsPoint(x, y)) {
          this.selectedCard = card;
          card.startDrag(x, y);
          this.isDragging = true;
          break;
        }
      }
    } else {
      // Check standard player hand in normal mode
      for (const card of this.playerHand) {
        if (card.containsPoint(x, y)) {
          this.selectedCard = card;
          card.startDrag(x, y);
          this.isDragging = true;
          break;
        }
      }
    }
  }

  /**
   * Handle mouse move
   */
  private handleMouseMove(event: MouseEvent): void {
    if (this.isDragging && this.selectedCard) {
      const rect = this.gameCanvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      this.selectedCard.updateDrag(x, y);

      // Show preview of where card would be placed on axis
      this.showPlacementPreview(x, y);
    } else {
      // Handle hover effects for hand cards
      const rect = this.gameCanvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Clear hover on non-hand groups
      if (this.boardCard) this.boardCard.isHovered = false;
      for (const c of this.placedLeft) c.isHovered = false;
      for (const c of this.placedRight) c.isHovered = false;

      // Reset hover on hand
      if (this.isHotseatMode) {
        // Reset hover on hotseat hands
        for (const c of this.currentPlayerHand) c.isHovered = false;
        for (const c of this.nextPlayerHand) c.isHovered = false;

        // Set hover for current player hand card under mouse
        for (const card of this.currentPlayerHand) {
          if (card.containsPoint(x, y)) {
            card.isHovered = true;
            break;
          }
        }
      } else {
        // Reset hover on standard hand
        for (const c of this.playerHand) c.isHovered = false;

        // Set hover for hand card under mouse
        for (const card of this.playerHand) {
          if (card.containsPoint(x, y)) {
            card.isHovered = true;
            break;
          }
        }
      }

      // Learning mode: handle tooltip hover for placed cards
      if (this.isLearningMode) {
        this.handleTooltipHover(x, y);
      }
    }
  }

  /**
   * Show preview of where card would be placed on axis
   */
  private showPlacementPreview(mouseX: number, mouseY: number): void {
    // Use the CARD's position, not mouse position, for more intuitive dragging
    if (!this.selectedCard) return;

    const axisY = this.gameCanvas.height / 2;
    const cardHeight = this.selectedCard.height;

    // Board cards bottom edge (cards are centered on axis)
    const boardCardsBottom = axisY + cardHeight / 2;

    // Dragged card top edge
    const draggedCardTop = this.selectedCard.y;

    // Trigger preview when card's TOP reaches board cards' BOTTOM
    const isNearAxis = draggedCardTop <= boardCardsBottom;

    logger.debug({
      scope: 'renderer/preview',
      msg: 'showPlacementPreview called',
      meta: {
        mouseX,
        mouseY,
        draggedCardTop,
        boardCardsBottom,
        isNearAxis,
      },
    });

    if (isNearAxis) {
      // Show preview by temporarily moving existing cards to make space
      this.showAxisPreview(mouseX);
    } else {
      // Hide preview by restoring original positions
      this.hideAxisPreview();
    }
  }

  /**
    * Handle tooltip hover for learning mode
    */
  private handleTooltipHover(mouseX: number, mouseY: number): void {
    // Check if hovering over placed cards (left or right side)
    let hoveredCard: GameCard | null = null;

    // Check left side cards
    for (const card of this.placedLeft) {
      if (card.containsPoint(mouseX, mouseY)) {
        hoveredCard = card;
        break;
      }
    }

    // Check right side cards
    if (!hoveredCard) {
      for (const card of this.placedRight) {
        if (card.containsPoint(mouseX, mouseY)) {
          hoveredCard = card;
          break;
        }
      }
    }

    // Check center board card
    if (!hoveredCard && this.boardCard && this.boardCard.containsPoint(mouseX, mouseY)) {
      hoveredCard = this.boardCard;
    }

    // Update hover state ONLY if we don't have a permanent tooltip for an incorrect card
    if (hoveredCard !== this.hoveredCard) {
      // If we have a permanent tooltip for an incorrect card, don't change it
      const hasIncorrectCard = this.placedLeft.find((card) => card.isCorrect === false)
                                || this.placedRight.find((card) => card.isCorrect === false)
                                || (this.boardCard && this.boardCard.isCorrect === false);

      if (!hasIncorrectCard) {
        this.hoveredCard = hoveredCard;
        this.tooltipCard = hoveredCard;
        this.tooltipVisible = !!hoveredCard;
      }

      logger.debug({
        scope: 'renderer/tooltip',
        msg: 'tooltip hover state changed',
        meta: {
          cardTitle: hoveredCard?.card.title,
          tooltipVisible: this.tooltipVisible,
          isLearningMode: this.isLearningMode,
          hasIncorrectCard: !!hasIncorrectCard,
        },
      });
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
   * Show axis preview by moving cards to make space
   * Updates dynamically as the dragged card moves along the axis
   */
  private showAxisPreview(previewX: number): void {
    if (!this.boardCard) return;

    // Update if preview position changed significantly (allows dynamic updates)
    if (this.isPreviewActive && Math.abs(previewX - this.lastPreviewX) < 20) {
      return;
    }

    this.lastPreviewX = previewX;


    // Combine all cards in their current order (board + left + right)
    const allCards = [
      this.boardCard,
      ...this.placedLeft,
      ...this.placedRight,
    ];

    if (allCards.length === 0) return;

    // Spread distance - how far cards move apart
    const spreadDistance = 60;

    allCards.forEach((card) => {
      // Use original position to calculate offset, not the current (possibly shifted) position
      const originalX = card.getOriginalX();
      const cardCenterX = originalX + card.width / 2;
      let newX = originalX;

      if (cardCenterX < previewX - 30) {
        // Move cards to the left of preview position left
        newX = originalX - spreadDistance;
      } else if (cardCenterX > previewX + 30) {
        // Move cards to the right of preview position right
        newX = originalX + spreadDistance;
      }

      card.setPreviewPosition(newX, card.getOriginalY());

      logger.debug({
        scope: 'renderer/preview',
        msg: 'set preview position for card',
        meta: {
          cardTitle: card.card.title,
          originalX,
          newX,
          previewX,
          cardCenterX,
        },
      });
    });

    // Mark preview as active
    this.isPreviewActive = true;

    logger.debug({
      scope: 'renderer/preview',
      msg: 'preview activated',
      meta: {
        previewX,
        cardsCount: allCards.length,
        spreadDistance,
      },
    });
  }

  /**
   * Hide axis preview by restoring original positions
   */
  private hideAxisPreview(): void {
    // Only restore if preview was active
    if (!this.isPreviewActive) {
      return;
    }

    logger.debug({
      scope: 'renderer/preview',
      msg: 'hiding axis preview',
    });

    if (this.boardCard) this.boardCard.clearPreviewPosition();
    for (const card of this.placedLeft) card.clearPreviewPosition();
    for (const card of this.placedRight) card.clearPreviewPosition();

    // Mark preview as inactive
    this.isPreviewActive = false;
    this.lastPreviewX = 0;
  }

  /**
   * Handle canvas click for arrow navigation
   */
  private handleCanvasClick(event: MouseEvent): void {
    // Allow clicks if player turn is active OR if hotseat overlay is visible
    // In learning mode or hotseat mode, ignore win/lose conditions
    if ((!this.isPlayerTurn && !this.playerSwitchOverlayVisible) || (!this.isLearningMode && !this.isHotseatMode && (this.gameWon || this.gameLost))) {
      return;
    }

    const rect = this.gameCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Hotseat mode: handle player switch overlay clicks
    if (this.isHotseatMode && this.playerSwitchOverlayVisible && this.playerSwitchOverlayBounds) {
      const bounds = this.playerSwitchOverlayBounds;
      if (x >= bounds.x && x <= bounds.x + bounds.width
          && y >= bounds.y && y <= bounds.y + bounds.height) {
        this.switchPlayer();
        return;
      }
    }

    // Learning mode: handle card clicks for removal
    if (this.isLearningMode) {
      this.handleLearningModeClick(x, y);
    }

    // Check if click is on navigation arrows
    const totalBoardCards = (this.boardCard ? 1 : 0) + this.placedLeft.length + this.placedRight.length;

    // Only show arrows if more than 5 cards
    if (totalBoardCards > 5) {
      const arrowWidth = 120 * this.scale;
      const arrowHeight = 120 * this.scale;
      const arrowY = this.gameCanvas.height / 2 - arrowHeight / 2;

      // Left arrow position
      const leftArrowX = 20 * this.scale;

      // Right arrow position
      const rightArrowX = this.gameCanvas.width - arrowWidth - 20 * this.scale;

      // Check if click is on left arrow
      if (x >= leftArrowX && x <= leftArrowX + arrowWidth
          && y >= arrowY && y <= arrowY + arrowHeight) {
        this.moveBoardCardsLeft();
        return;
      }

      // Check if click is on right arrow
      if (x >= rightArrowX && x <= rightArrowX + arrowWidth
          && y >= arrowY && y <= arrowY + arrowHeight) {
        this.moveBoardCardsRight();
      }
    }
  }

  /**
    * Handle learning mode clicks for card removal and buttons
    */
  private handleLearningModeClick(x: number, y: number): void {
    // Check if there's an incorrect card on the board (Weiter button is showing)
    const hasIncorrectCard = this.placedLeft.some((card) => card.isCorrect === false)
                          || this.placedRight.some((card) => card.isCorrect === false)
                          || (this.boardCard && this.boardCard.isCorrect === false);

    // If we have an incorrect card, only allow the "Weiter" button to be clicked
    if (hasIncorrectCard) {
      // Only check for the "Weiter" button - block all other interactions
      if (this.weiterButtonBounds) {
        const button = this.weiterButtonBounds;
        if (x >= button.x && x <= button.x + button.width
             && y >= button.y && y <= button.y + button.height) {
          // Find the incorrect card to remove
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
        }
      }
      return; // Block all other interactions when incorrect card is showing
    }

    // Check if click is on the "Clear Board" button (only when no incorrect card)
    if (this.clearBoardButtonBounds) {
      const button = this.clearBoardButtonBounds;
      if (x >= button.x && x <= button.x + button.width
           && y >= button.y && y <= button.y + button.height) {
        this.clearBoard();
        return; // Button click handled, don't process further
      }
    }

    // Check if click is on the "Reset Game" button (only when no incorrect card)
    if (this.resetGameButtonBounds) {
      const button = this.resetGameButtonBounds;
      if (x >= button.x && x <= button.x + button.width
           && y >= button.y && y <= button.y + button.height) {
        this.resetLearningGame();
        return; // Button click handled, don't process further
      }
    }

    // Check if clicking on a placed card
    let clickedCard: GameCard | null = null;

    // Check left side cards
    for (const card of this.placedLeft) {
      if (card.containsPoint(x, y)) {
        clickedCard = card;
        break;
      }
    }

    // Check right side cards
    if (!clickedCard) {
      for (const card of this.placedRight) {
        if (card.containsPoint(x, y)) {
          clickedCard = card;
          break;
        }
      }
    }

    // Check center board card
    if (!clickedCard && this.boardCard && this.boardCard.containsPoint(x, y)) {
      clickedCard = this.boardCard;
    }

    // If clicking on an incorrect card directly (not the button)
    if (clickedCard && clickedCard.isCorrect === false) {
      // Could add additional functionality here if needed
      logger.debug({
        scope: 'renderer/learning',
        msg: 'incorrect card clicked directly',
        meta: {
          cardTitle: clickedCard.card.title,
          isLearningMode: this.isLearningMode,
        },
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
    this.isPreviewActive = false;
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
   * Handle mouse up
   */
  private handleMouseUp(_event: MouseEvent): void {
    if (this.isDragging && this.selectedCard) {
      // Snap logic: if released near axis, place left/right of center
      const releasedCard = this.selectedCard;
      releasedCard.stopDrag();

      const axisY = this.gameCanvas.height / 2;
      const distToAxis = Math.abs((releasedCard.y + releasedCard.height / 2) - axisY);
      if (distToAxis <= this.snapThreshold) {
        // 1. SNAP: Snap to axis at exact position
        const snapX = releasedCard.x + releasedCard.width / 2; // Use the exact X position where card was dropped
        const snapY = axisY - releasedCard.height / 2;

        // Play card placement sound
        soundManager.play(SoundType.CARD_PLACE);

        // SPECIAL CASE: If this is the first card after clearing the board, make it the boardCard
        if (!this.boardCard) {
          this.boardCard = releasedCard;
          releasedCard.isInHand = false;

          // Center the first card on the axis
          const centerX = this.gameCanvas.width / 2 - releasedCard.width / 2;
          releasedCard.setTargetPosition(centerX, snapY);

          logger.info({
            scope: 'renderer/game',
            msg: 'first card after clear board set as boardCard',
            meta: { cardTitle: releasedCard.card.title },
          });
        } else {
          // Normal case: Determine if it's left or right of center for array placement
          // Use getOriginalX() to handle case where preview is still active
          const boardCenterX = this.boardCard.getOriginalX() + this.boardCard.width / 2;
          const isLeft = snapX < boardCenterX;

          // Set the exact position where the card was dropped
          releasedCard.setTargetPosition(snapX - releasedCard.width / 2, snapY);

          // Add to appropriate array based on position relative to center
          if (isLeft) {
            this.placedLeft.push(releasedCard);
            releasedCard.isInHand = false;
          } else {
            this.placedRight.push(releasedCard);
            releasedCard.isInHand = false;
          }
        }

        // Remove from hand immediately after snap
        if (this.isHotseatMode) {
          // Remove from the actual player hand (not just the reference)
          if (this.currentPlayerIndex === 0) {
            this.player1Hand = this.player1Hand.filter((c) => c !== releasedCard);
          } else {
            this.player2Hand = this.player2Hand.filter((c) => c !== releasedCard);
          }
          this.layoutHotseatHands();
        } else {
          this.playerHand = this.playerHand.filter((c) => c !== releasedCard);
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

        // Clear any preview positions
        this.hideAxisPreview();

        // 3. CHECK: Evaluate placement correctness
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
          // 4. STAY: Correct placement - card stays and turns green
          // In learning mode, don't track score
          if (!this.isLearningMode) {
            this.score += getScore(releasedCard.card);
          }
          releasedCard.setCorrect();
          // Play success sound for correct placement
          setTimeout(() => {
            soundManager.play(SoundType.SUCCESS);
          }, 300); // Small delay after placement sound

          // Clear global weiter button bounds for correct cards
          this.weiterButtonBounds = null;

          // Center the axis immediately after correct placement
          this.layoutAxisCards();

          // 6. TURN-BASED: Switch turns (disabled in learning mode and hotseat mode)
          if (!this.isLearningMode && !this.isHotseatMode) {
            this.isPlayerTurn = false;
            this.currentTurn++;
            this.stopTurnTimer(); // Stop player timer

            // 7. CHECK FOR WIN: Check if player has won
            this.checkForWin();

            // 8. AI TURN: If game not over and AI has cards, let AI play
            if (!this.gameWon && !this.gameLost && this.opponentHand.length > 0 && !this.isAITurnInProgress) {
              setTimeout(() => {
                this.playAITurn();
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
                cardTitle: releasedCard.card.title,
                currentPlayerIndex: this.currentPlayerIndex,
              },
            });

            setTimeout(() => {
              logger.info({
                scope: 'renderer/game',
                msg: 'hotseat mode: 2 seconds passed, now checking win',
                meta: {
                  cardTitle: releasedCard.card.title,
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
                    cardTitle: releasedCard.card.title,
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
                cardTitle: releasedCard.card.title,
                isLearningMode: true,
              },
            });
          }

          logger.info({
            scope: 'renderer/game',
            msg: 'card placed correctly, turned green',
            meta: {
              cardTitle: releasedCard.card.title,
              score: this.score,
              turn: this.currentTurn,
            },
          });
        } else {
          // 4. STAY: Incorrect placement - card turns red and stays WHERE PLAYER DROPPED IT
          releasedCard.setIncorrect();
          // Play error sound for incorrect placement
          setTimeout(() => {
            soundManager.play(SoundType.ERROR);
          }, 300); // Small delay after placement sound

          // DON'T call layoutAxisCards() here - card should stay where player dropped it
          // to show them their mistake. Cards will be re-centered when incorrect card
          // is moved to graveyard.

          if (this.isLearningMode) {
            // LEARNING MODE: Show tooltip automatically for incorrect card
            this.showTooltipForIncorrectCard(releasedCard);
            // Card stays on board until "Weiter" button is clicked
            // NO new card here - will be given when "Weiter" button is clicked
            logger.info({
              scope: 'renderer/game',
              msg: 'learning mode: incorrect card stays on board until weiter button clicked',
              meta: {
                cardTitle: releasedCard.card.title,
                turn: this.currentTurn,
              },
            });
          } else if (this.isHotseatMode) {
            // HOTSEAT MODE: Move card to graveyard after 2 seconds, then switch player
            setTimeout(() => {
              this.moveCardToGraveyard(releasedCard);
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
                    cardTitle: releasedCard.card.title,
                    currentPlayerIndex: this.currentPlayerIndex,
                  },
                });
              }, 2000);
            }, 2000);

            logger.info({
              scope: 'renderer/game',
              msg: 'hotseat mode: incorrect card will be moved to graveyard in 2 seconds, then switch player',
              meta: {
                cardTitle: releasedCard.card.title,
                turn: this.currentTurn,
              },
            });
          } else {
            // NORMAL MODE: Move card to graveyard after 2 seconds (old logic)
            setTimeout(() => {
              this.moveCardToGraveyard(releasedCard);
              // Center the axis after card is moved
              this.layoutAxisCards();
            }, 2000);

            logger.info({
              scope: 'renderer/game',
              msg: 'normal mode: incorrect card will be moved to graveyard in 2 seconds',
              meta: {
                cardTitle: releasedCard.card.title,
                turn: this.currentTurn,
              },
            });
          }
        }

        logger.info({
          scope: 'renderer/game',
          msg: 'card placed on axis',
          meta: {
            cardTitle: releasedCard.card.title,
            turn: this.currentTurn,
          },
        });
      } else {
        // Card was released outside the axis - return it to hand

        // Clear any preview positions
        this.hideAxisPreview();

        // Return card to hand by re-layouting
        if (this.isHotseatMode) {
          this.layoutHotseatHands();
        } else {
          this.layoutHand();
        }

        logger.info({
          scope: 'renderer/game',
          msg: 'card returned to hand (released outside axis)',
          meta: { cardTitle: releasedCard.card.title },
        });
      }

      this.isDragging = false;
      this.selectedCard = null;
    }
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
    const ctx = this.gameContext;
    const { width } = this.gameCanvas;
    const { height } = this.gameCanvas;

    // Validate canvas dimensions
    if (width <= 0 || height <= 0) {
      logger.warn({ scope: 'renderer/render', msg: 'invalid canvas dimensions', meta: { width, height } });
      return;
    }

    // Draw background
    if (this.backgroundImage && this.backgroundImage.complete) {
      // Draw background image scaled to fill canvas
      ctx.drawImage(this.backgroundImage, 0, 0, width, height);
    } else {
      // Fallback to solid color if image not loaded
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, 0, width, height);
    }

    // Axis line and label removed per user request

    // Draw hand position indicators (gray boxes) - BEFORE cards so cards are on top
    this.drawHandPositionIndicators(ctx);

    // Track any card being dragged (to render last for correct z-order)
    let draggingCard: GameCard | null = null;

    // Draw board card (if exists)
    if (this.boardCard) {
      this.boardCard.render(ctx);
    }

    // Draw player hand cards
    if (this.isHotseatMode) {
      // Draw current player hand (bottom) - show card fronts
      if (this.currentPlayerIndex === 0) {
        // Player 1 is current player - show player1Hand at bottom
        for (const card of this.player1Hand) {
          if (card.isDragging) {
            draggingCard = card;
          } else {
            card.render(ctx);
          }
        }
        // Player 2 is next player - show player2Hand at top as card backs
        for (const card of this.player2Hand) {
          this.drawOpponentCardBack(ctx, card);
        }
      } else {
        // Player 2 is current player - show player2Hand at bottom
        for (const card of this.player2Hand) {
          if (card.isDragging) {
            draggingCard = card;
          } else {
            card.render(ctx);
          }
        }
        // Player 1 is next player - show player1Hand at top as card backs
        for (const card of this.player1Hand) {
          this.drawOpponentCardBack(ctx, card);
        }
      }

    } else {
      // Normal mode
      for (const card of this.playerHand) {
        if (card.isDragging) {
          draggingCard = card;
        } else {
          card.render(ctx);
        }
      }

      // Draw opponent hand cards (show card backs) - check for AI dragging
      for (const card of this.opponentHand) {
        if (card.isDragging) {
          draggingCard = card;
          // Don't draw card back for dragging card - will render as front later
        } else {
          this.drawOpponentCardBack(ctx, card);
        }
      }
    }

    // Draw placed stacks
    for (const card of this.placedLeft) {
      if (card.isCorrect === false) {
        // Add pulsing effect for incorrect cards
        const pulseIntensity = 0.5 + 0.5 * Math.sin(Date.now() * 0.01); // Fast pulse
        ctx.globalAlpha = pulseIntensity;
      }
      card.render(ctx);
      ctx.globalAlpha = 1; // Reset alpha
    }
    for (const card of this.placedRight) {
      if (card.isCorrect === false) {
        // Add pulsing effect for incorrect cards
        const pulseIntensity = 0.5 + 0.5 * Math.sin(Date.now() * 0.01); // Fast pulse
        ctx.globalAlpha = pulseIntensity;
      }
      card.render(ctx);
      ctx.globalAlpha = 1; // Reset alpha
    }

    // Draw dragging card LAST so it appears on top of everything
    if (draggingCard) {
      draggingCard.render(ctx);
    }

    // Draw score and turn information (only in normal mode)
    if (this.isHotseatMode) {
      // Hotseat mode: show current player information with prominent background
      const currentPlayer = this.currentPlayerIndex === 0 ? this.player1Data : this.player2Data;
      const turnText = `🎮 ${currentPlayer?.name || 'Player'}'s turn`;
      const fontSize = 28 * this.scale;
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.textAlign = 'left';
      
      // Measure text for background box
      const textMetrics = ctx.measureText(turnText);
      const textWidth = textMetrics.width;
      const padding = 14 * this.scale;
      const boxX = 12 * this.scale;
      const boxY = 12 * this.scale;
      const boxHeight = fontSize + padding * 1.4;
      
      // Draw light gray background box with rounded corners
      ctx.fillStyle = 'rgba(180, 180, 180, 0.9)';
      ctx.beginPath();
      const radius = 10 * this.scale;
      ctx.roundRect(boxX, boxY, textWidth + padding * 2, boxHeight, radius);
      ctx.fill();
      
      // Draw subtle border
      ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
      ctx.lineWidth = 2 * this.scale;
      ctx.stroke();
      
      // Draw text
      ctx.fillStyle = '#1a1a1a';
      ctx.fillText(turnText, boxX + padding, boxY + fontSize + padding * 0.2);
    } else if (!this.isLearningMode) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `${18 * this.scale}px Arial`;
      ctx.textAlign = 'left';
      ctx.fillText(`Score: ${this.score}`, 20 * this.scale, 40 * this.scale);
      ctx.fillText(`Turn: ${this.currentTurn}`, 20 * this.scale, 65 * this.scale);
    } else {
      // Learning mode: show learning mode indicator with gray box and white text
      const learningText = '📚 Learning Mode';
      const fontSize = 18 * this.scale;
      const padding = 10 * this.scale;
      const boxX = 15 * this.scale;
      const boxY = 20 * this.scale;

      ctx.font = `bold ${fontSize}px Arial`;
      const textWidth = ctx.measureText(learningText).width;
      const boxWidth = textWidth + padding * 2;
      const boxHeight = fontSize + padding * 1.5;

      // Draw gray background box with rounded corners
      ctx.fillStyle = 'rgba(80, 80, 80, 0.85)';
      ctx.beginPath();
      const radius = 6 * this.scale;
      ctx.moveTo(boxX + radius, boxY);
      ctx.lineTo(boxX + boxWidth - radius, boxY);
      ctx.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + radius);
      ctx.lineTo(boxX + boxWidth, boxY + boxHeight - radius);
      ctx.quadraticCurveTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth - radius, boxY + boxHeight);
      ctx.lineTo(boxX + radius, boxY + boxHeight);
      ctx.quadraticCurveTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - radius);
      ctx.lineTo(boxX, boxY + radius);
      ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
      ctx.closePath();
      ctx.fill();

      // Draw white text
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(learningText, boxX + padding, boxY + fontSize + padding * 0.2);
    }

    // Draw turn text (only in normal mode, not hotseat)
    if (this.turnText && !this.isLearningMode && !this.isHotseatMode) {
      ctx.fillStyle = this.isPlayerTurn ? '#7bed9f' : '#ff9800'; // Light green for player turn
      ctx.font = `bold ${15 * this.scale}px Arial`;
      ctx.textAlign = 'left';
      ctx.fillText(this.turnText, 20 * this.scale, 90 * this.scale);
    }

    // Draw timer bar (only in normal mode)
    if (!this.isLearningMode && !this.isHotseatMode && this.turnTimer > 0) {
      const timerBarWidth = 200 * this.scale;
      const timerBarHeight = 8 * this.scale;
      const timerBarX = 20 * this.scale;
      const timerBarY = 100 * this.scale;

      // Background bar
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(timerBarX, timerBarY, timerBarWidth, timerBarHeight);

      // Progress bar
      const progress = this.turnTimer / this.getDifficultyTimer();
      const progressWidth = timerBarWidth * progress;

      // Color based on time remaining
      let timerColor = '#7bed9f'; // Light green
      if (this.turnTimer <= 3) {
        timerColor = '#ff4444'; // Red
      } else if (this.turnTimer <= 5) {
        timerColor = '#ff9800'; // Orange
      }

      ctx.fillStyle = timerColor;
      ctx.fillRect(timerBarX, timerBarY, progressWidth, timerBarHeight);

      // Border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(timerBarX, timerBarY, timerBarWidth, timerBarHeight);
    }

    // Draw deck stack
    this.drawDeckStack(ctx);

    // Draw learning mode buttons (if needed)
    if (this.isLearningMode) {
      this.drawWeiterButton(ctx);
      this.drawLearningModeButtons(ctx);
    }

    // Draw graveyard cards
    for (const card of this.graveyard) {
      card.render(ctx);
    }

    // Draw win overlay if game is won (not in learning mode)
    if (this.gameWon && !this.isLearningMode) {
      // Semi-transparent overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(0, 0, this.gameCanvas.width, this.gameCanvas.height);

      // Congratulations text
      ctx.fillStyle = '#4caf50';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('🎉 Congratulations! 🎉', this.gameCanvas.width / 2, this.gameCanvas.height / 2 - 50);

      // Subtitle
      ctx.fillStyle = '#ffffff';
      ctx.font = '24px Arial';
      ctx.fillText('You have successfully sorted all cards!', this.gameCanvas.width / 2, this.gameCanvas.height / 2);

      // Final score
      ctx.font = '20px Arial';
      ctx.fillText(`Final Score: ${this.score}`, this.gameCanvas.width / 2, this.gameCanvas.height / 2 + 40);

      // Instructions
      ctx.font = '18px Arial';
      ctx.fillStyle = '#cccccc';
      ctx.fillText('Check the dialog for next steps...', this.gameCanvas.width / 2, this.gameCanvas.height / 2 + 80);
    }

    // Draw navigation arrows if more than 5 cards on board
    this.drawNavigationArrows(ctx);

    // Learning mode: draw tooltips for placed cards
    if (this.isLearningMode && this.tooltipVisible && this.tooltipCard) {
      this.drawTooltip(ctx, this.tooltipCard);
    }

    // Hotseat mode: draw player switch overlay
    if (this.isHotseatMode && this.playerSwitchOverlayVisible) {
      this.drawPlayerSwitchOverlay(ctx);
    }
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
        setTimeout(() => {
          this.playAITurn();
        }, 1000);
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
   */
  private recycleGraveyard(): void {
    if (this.graveyard.length === 0) return;

    logger.info({
      scope: 'renderer/game',
      msg: 'recycling graveyard cards to deck',
      meta: { graveyardSize: this.graveyard.length },
    });

    // Extract card data from GameCard objects (keeps original order)
    const graveyardCardData = this.graveyard.map((gameCard) => gameCard.card);

    // Add cards to remainingCards (in graveyard order)
    this.remainingCards.push(...graveyardCardData);

    // Clear the graveyard (GameCard objects)
    this.graveyard = [];

    logger.info({
      scope: 'renderer/game',
      msg: 'graveyard recycled',
      meta: { newDeckSize: this.remainingCards.length },
    });
  }

  /**
    * Draw deck stack
    */
  private drawDeckStack(ctx: CanvasRenderingContext2D): void {
    const deckX = 50 * this.scale;
    const deckY = this.gameCanvas.height - 320 * this.scale; // Same height as player hand
    const cardWidth = 200 * this.scale;
    const cardHeight = 300 * this.scale;
    const stackHeight = Math.min(this.remainingCards.length, 5); // Max 5 cards visible

    // Draw stacked cards
    for (let i = 0; i < stackHeight; i++) {
      const offsetY = i * 2; // Small offset for stack effect

      // Card background
      ctx.fillStyle = '#4a90e2';
      ctx.globalAlpha = 0.8 - (i * 0.1); // Fade effect
      this.roundRect(ctx, deckX, deckY - offsetY, cardWidth, cardHeight, 8);
      ctx.fill();

      // Card border
      ctx.strokeStyle = '#2a5a8a';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Card back pattern - Axes Mundi Logo
      this.drawAxesMundiLogoImage(ctx, deckX, deckY - offsetY, cardWidth, cardHeight);
    }

    // Reset alpha
    ctx.globalAlpha = 1;

    // Draw deck count
    ctx.fillStyle = '#ffffff';
    ctx.font = `${16 * this.scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(`${this.remainingCards.length}`, deckX + cardWidth / 2, deckY + cardHeight + 25 * this.scale);
  }

  /**
     * Draw hand position indicators (single gray box per hand)
     */
  private drawHandPositionIndicators(ctx: CanvasRenderingContext2D): void {
    const _cardWidth = 200 * this.scale; // Reserved for future use
    const cardHeight = 300 * this.scale;
    const cardSpacing = 220 * this.scale;

    // Calculate opponent card count for dynamic sizing
    const opponentCardCount = this.getOpponentCardCount();

    // Draw player hand area (bottom) - single large box
    const playerTotalWidth = 5 * cardSpacing - 20 * this.scale;
    const playerStartX = (this.gameCanvas.width - playerTotalWidth) / 2;
    const playerY = this.gameCanvas.height - 320 * this.scale;

    ctx.fillStyle = 'rgba(128, 128, 128, 0.5)'; // Semi-transparent gray
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.5)';
    ctx.lineWidth = 2;

    // Single box covering entire player hand area
    this.roundRect(
      ctx,
      playerStartX - 10 * this.scale,
      playerY - 10 * this.scale,
      playerTotalWidth + 20 * this.scale,
      cardHeight + 20 * this.scale,
      12,
    );
    ctx.fill();
    ctx.stroke();

    // Draw opponent hand area (top) - single large box (dynamic based on difficulty)
    // In learning mode, don't draw opponent hand area
    if (!this.isLearningMode) {
      const opponentTotalWidth = opponentCardCount * cardSpacing - 20 * this.scale;
      const opponentStartX = (this.gameCanvas.width - opponentTotalWidth) / 2;
      const opponentY = 20 * this.scale;

      // Single box covering entire opponent hand area
      this.roundRect(
        ctx,
        opponentStartX - 10 * this.scale,
        opponentY - 10 * this.scale,
        opponentTotalWidth + 20 * this.scale,
        cardHeight + 20 * this.scale,
        12,
      );
      ctx.fill();
      ctx.stroke();

      // Draw avatar boxes centered above/below hand areas (square: 100x100 - half size)
      const avatarBoxWidth = 100 * this.scale;
      const avatarBoxHeight = 100 * this.scale;

      // Use player names in hotseat mode, player name in singleplayer modes
      if (this.isHotseatMode) {
        const player1Name = this.player1Data?.name || 'Player 1';
        const player2Name = this.player2Data?.name || 'Player 2';
        const player1Avatar = getAvatarEmoji(this.player1Data?.avatar);
        const player2Avatar = getAvatarEmoji(this.player2Data?.avatar);

        // In hotseat mode: current player is at bottom, next player is at top
        const currentPlayerName = this.currentPlayerIndex === 0 ? player1Name : player2Name;
        const currentPlayerAvatar = this.currentPlayerIndex === 0 ? player1Avatar : player2Avatar;
        const nextPlayerName = this.currentPlayerIndex === 0 ? player2Name : player1Name;
        const nextPlayerAvatar = this.currentPlayerIndex === 0 ? player2Avatar : player1Avatar;

        // Draw player avatar box (centered above player hand, 20px gap)
        this.drawAvatarBox(ctx, this.gameCanvas.width / 2 - avatarBoxWidth / 2, playerY - avatarBoxHeight - 20 * this.scale, currentPlayerAvatar, currentPlayerName);
        // Draw opponent avatar box (centered below opponent hand, 20px gap)
        this.drawAvatarBox(ctx, this.gameCanvas.width / 2 - avatarBoxWidth / 2, opponentY + cardHeight + 20 * this.scale, nextPlayerAvatar, nextPlayerName);
      } else if (this.player1Data?.name) {
        // All singleplayer modes: player avatar at bottom, opponent at top
        const playerName = this.player1Data.name;
        const playerAvatar = getAvatarEmoji(this.player1Data?.avatar);
        // Draw player avatar box (centered above player hand, 20px gap)
        this.drawAvatarBox(ctx, this.gameCanvas.width / 2 - avatarBoxWidth / 2, playerY - avatarBoxHeight - 20 * this.scale, playerAvatar, playerName);
        // Draw opponent avatar box (centered below opponent hand, 20px gap)
        this.drawAvatarBox(ctx, this.gameCanvas.width / 2 - avatarBoxWidth / 2, opponentY + cardHeight + 20 * this.scale, '🤖', 'Opponent');
      } else {
        // Draw player avatar box (centered above player hand, 20px gap)
        this.drawAvatarBox(ctx, this.gameCanvas.width / 2 - avatarBoxWidth / 2, playerY - avatarBoxHeight - 20 * this.scale, '👤', 'Player');
        // Draw opponent avatar box (centered below opponent hand, 20px gap)
        this.drawAvatarBox(ctx, this.gameCanvas.width / 2 - avatarBoxWidth / 2, opponentY + cardHeight + 20 * this.scale, '🤖', 'Opponent');
      }
    } else {
      // Learning mode: only draw player avatar box (centered above player hand, 20px gap)
      const avatarBoxWidth = 100 * this.scale;
      const avatarBoxHeight = 100 * this.scale;
      const playerName = this.player1Data?.name || 'Player';
      const playerAvatar = getAvatarEmoji(this.player1Data?.avatar);
      this.drawAvatarBox(ctx, this.gameCanvas.width / 2 - avatarBoxWidth / 2, playerY - avatarBoxHeight - 20 * this.scale, playerAvatar, playerName);
    }

    // Draw graveyard area indicator (top right)
    const graveyardX = this.gameCanvas.width - 230 * this.scale; // Adjusted for wider box
    const graveyardY = 50 * this.scale;
    const graveyardBoxWidth = 200 * this.scale; // Same as card width
    const graveyardBoxHeight = cardHeight;

    ctx.fillStyle = 'rgba(128, 128, 128, 0.5)'; // Semi-transparent gray
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.5)';
    ctx.lineWidth = 2;

    this.roundRect(
      ctx,
      graveyardX - 10 * this.scale,
      graveyardY - 10 * this.scale,
      graveyardBoxWidth + 20 * this.scale,
      graveyardBoxHeight + 20 * this.scale,
      12,
    );
    ctx.fill();
    ctx.stroke();

    // Draw graveyard label
    ctx.fillStyle = '#ffffff';
    ctx.font = `${14 * this.scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('Graveyard', graveyardX + graveyardBoxWidth / 2, graveyardY - 20 * this.scale);

    // Draw score/timer area indicator (top left) - only in normal mode, not learning mode
    if (!this.isLearningMode && !this.isHotseatMode) {
      const scoreBoxX = 10 * this.scale;
      const scoreBoxY = 20 * this.scale;
      const scoreBoxWidth = 260 * this.scale; // Extended by 40px
      const scoreBoxHeight = 95 * this.scale;

      ctx.fillStyle = 'rgba(128, 128, 128, 0.9)'; // 10% transparency (90% opaque)
      ctx.strokeStyle = 'rgba(128, 128, 128, 0.9)';
      ctx.lineWidth = 2;

      this.roundRect(
        ctx,
        scoreBoxX,
        scoreBoxY,
        scoreBoxWidth,
        scoreBoxHeight,
        12,
      );
      ctx.fill();
      ctx.stroke();

      // Draw label
      ctx.fillStyle = '#ffffff';
      ctx.font = `${12 * this.scale}px Arial`;
      ctx.textAlign = 'left';
      ctx.fillText('Game Info', scoreBoxX + 10 * this.scale, scoreBoxY - 5 * this.scale);
    }
  }

  /**
    * Draw learning mode buttons (Clear Board and Reset Game)
    * Styled with gradients, shadows, and emojis
    * Positioned evenly distributed above the playing field
    */
  private drawLearningModeButtons(ctx: CanvasRenderingContext2D): void {
    const buttonWidth = 360 * this.scale;
    const buttonHeight = 120 * this.scale;
    const buttonSpacing = 80 * this.scale;
    const borderRadius = 24 * this.scale;

    // Position buttons evenly distributed above the playing field
    const totalWidth = buttonWidth * 2 + buttonSpacing;
    const startX = (this.gameCanvas.width - totalWidth) / 2;
    const buttonY = 20 * this.scale;

    // === Clear Board Button (left) ===
    const clearButtonX = startX;

    // Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 20 * this.scale;
    ctx.shadowOffsetX = 6 * this.scale;
    ctx.shadowOffsetY = 6 * this.scale;

    // Gradient background (vibrant red)
    const clearGradient = ctx.createLinearGradient(clearButtonX, buttonY, clearButtonX, buttonY + buttonHeight);
    clearGradient.addColorStop(0, '#e53935');
    clearGradient.addColorStop(1, '#b71c1c');
    ctx.fillStyle = clearGradient;
    drawRoundedRect(ctx, clearButtonX, buttonY, buttonWidth, buttonHeight, borderRadius);

    // Reset shadow for text
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Border highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 4 * this.scale;
    this.roundRect(ctx, clearButtonX, buttonY, buttonWidth, buttonHeight, borderRadius);
    ctx.stroke();

    // Button text with emoji (twice as large)
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${36 * this.scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🗑️ Clear Board', clearButtonX + buttonWidth / 2, buttonY + buttonHeight / 2);

    // === Reset Game Button (right) ===
    const resetButtonX = startX + buttonWidth + buttonSpacing;

    // Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 20 * this.scale;
    ctx.shadowOffsetX = 6 * this.scale;
    ctx.shadowOffsetY = 6 * this.scale;

    // Gradient background (fresh green)
    const resetGradient = ctx.createLinearGradient(resetButtonX, buttonY, resetButtonX, buttonY + buttonHeight);
    resetGradient.addColorStop(0, '#43a047');
    resetGradient.addColorStop(1, '#1b5e20');
    ctx.fillStyle = resetGradient;
    drawRoundedRect(ctx, resetButtonX, buttonY, buttonWidth, buttonHeight, borderRadius);

    // Reset shadow for text
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Border highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 4 * this.scale;
    this.roundRect(ctx, resetButtonX, buttonY, buttonWidth, buttonHeight, borderRadius);
    ctx.stroke();

    // Button text with emoji (twice as large)
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${36 * this.scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔄 Reset Game', resetButtonX + buttonWidth / 2, buttonY + buttonHeight / 2);

    // Store button positions globally for click detection
    this.clearBoardButtonBounds = {
      x: clearButtonX, y: buttonY, width: buttonWidth, height: buttonHeight,
    };
    this.resetGameButtonBounds = {
      x: resetButtonX, y: buttonY, width: buttonWidth, height: buttonHeight,
    };
  }

  /**
    * Draw "Weiter" button for learning mode (positioned centered below the axis/board area)
    * Styled with gradient, shadow, and emoji - twice as big
    */
  private drawWeiterButton(ctx: CanvasRenderingContext2D): void {
    // Find any incorrect card on the board to show the button
    const incorrectCard = this.placedLeft.find((card) => card.isCorrect === false)
                         || this.placedRight.find((card) => card.isCorrect === false)
                         || (this.boardCard && this.boardCard.isCorrect === false ? this.boardCard : null);

    // Only draw if we have an incorrect card that needs the button
    if (!incorrectCard) return;

    // Button dimensions (twice as big)
    const buttonWidth = 300 * this.scale;
    const buttonHeight = 110 * this.scale;
    const borderRadius = 24 * this.scale;

    // Position button centered horizontally, below the axis/board area
    const buttonX = (this.gameCanvas.width - buttonWidth) / 2;
    const buttonY = this.gameCanvas.height / 2 + 180 * this.scale;

    // Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 20 * this.scale;
    ctx.shadowOffsetX = 6 * this.scale;
    ctx.shadowOffsetY = 6 * this.scale;

    // Gradient background (warm orange/gold)
    const weiterGradient = ctx.createLinearGradient(buttonX, buttonY, buttonX, buttonY + buttonHeight);
    weiterGradient.addColorStop(0, '#ffa726');
    weiterGradient.addColorStop(1, '#e65100');
    ctx.fillStyle = weiterGradient;
    drawRoundedRect(ctx, buttonX, buttonY, buttonWidth, buttonHeight, borderRadius);

    // Reset shadow for text
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Border highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 4 * this.scale;
    this.roundRect(ctx, buttonX, buttonY, buttonWidth, buttonHeight, borderRadius);
    ctx.stroke();

    // Button text with emoji (twice as large)
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${40 * this.scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('➡️ Continue', buttonX + buttonWidth / 2, buttonY + buttonHeight / 2);

    // Store button position globally for click detection
    this.weiterButtonBounds = {
      x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight,
    };
  }

  /**
   * Draw tooltip for learning mode
   */
  private drawTooltip(ctx: CanvasRenderingContext2D, card: GameCard): void {
    if (!card.card.facts || card.card.facts.length === 0) return;

    const tooltipText = card.card.facts[0];
    const tooltipWidth = 300 * this.scale;
    const tooltipHeight = 80 * this.scale;
    const tooltipPadding = 10 * this.scale;

    // Position tooltip above the card
    const tooltipX = card.x + card.width / 2 - tooltipWidth / 2;
    const tooltipY = card.y - tooltipHeight - 20 * this.scale;

    // Draw tooltip background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 2 * this.scale;

    // Rounded rectangle for tooltip
    drawRoundedRect(ctx, tooltipX, tooltipY, tooltipWidth, tooltipHeight, 8 * this.scale);
    ctx.stroke();

    // Draw tooltip text
    ctx.fillStyle = '#ffffff';
    ctx.font = `${14 * this.scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Wrap text if needed
    const maxWidth = tooltipWidth - tooltipPadding * 2;
    const lines = wrapText(tooltipText, maxWidth, ctx);

    const lineHeight = 18 * this.scale;
    const startY = tooltipY + tooltipHeight / 2 - (lines.length - 1) * lineHeight / 2;

    lines.forEach((line, index) => {
      const y = startY + index * lineHeight;
      ctx.fillText(line, tooltipX + tooltipWidth / 2, y);
    });

    // Note: "Weiter" button is now drawn separately outside the tooltip
  }

  /**
     * Draw navigation arrows when more than 5 cards are on the board
     */
  private drawNavigationArrows(ctx: CanvasRenderingContext2D): void {
    // Count total cards on board (board card + placed left + placed right)
    const totalBoardCards = (this.boardCard ? 1 : 0) + this.placedLeft.length + this.placedRight.length;

    // Only show arrows if more than 5 cards
    if (totalBoardCards <= 5) return;

    // Arrow dimensions
    const arrowWidth = 120 * this.scale;
    const arrowHeight = 120 * this.scale;
    const arrowY = this.gameCanvas.height / 2 - arrowHeight / 2;

    // Left arrow position
    const leftArrowX = 20 * this.scale;

    // Right arrow position
    const rightArrowX = this.gameCanvas.width - arrowWidth - 20 * this.scale;

    // Draw left arrow
    if (this.arrowLeftImage) {
      ctx.globalAlpha = 0.8;
      ctx.drawImage(this.arrowLeftImage, leftArrowX, arrowY, arrowWidth, arrowHeight);
      ctx.globalAlpha = 1;
    } else {
      // Fallback: draw a simple left arrow
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.moveTo(leftArrowX + arrowWidth, arrowY);
      ctx.lineTo(leftArrowX, arrowY + arrowHeight / 2);
      ctx.lineTo(leftArrowX + arrowWidth, arrowY + arrowHeight);
      ctx.closePath();
      ctx.fill();
    }

    // Draw right arrow
    if (this.arrowRightImage) {
      ctx.globalAlpha = 0.8;
      ctx.drawImage(this.arrowRightImage, rightArrowX, arrowY, arrowWidth, arrowHeight);
      ctx.globalAlpha = 1;
    } else {
      // Fallback: draw a simple right arrow
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.moveTo(rightArrowX, arrowY);
      ctx.lineTo(rightArrowX + arrowWidth, arrowY + arrowHeight / 2);
      ctx.lineTo(rightArrowX, arrowY + arrowHeight);
      ctx.closePath();
      ctx.fill();
    }

    logger.debug({
      scope: 'renderer/game',
      msg: 'navigation arrows drawn',
      meta: {
        totalBoardCards,
        boardCard: this.boardCard ? 1 : 0,
        placedLeft: this.placedLeft.length,
        placedRight: this.placedRight.length,
      },
    });
  }

  /**
    * Draw Axes Mundi Logo using the actual image
    */
  private drawAxesMundiLogoImage(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
    if (!this.logoImage) {
      // Fallback to drawn logo if image not loaded
      this.drawAxesMundiLogo(ctx, x, y, width, height);
      return;
    }

    // Save context
    ctx.save();
    ctx.globalAlpha = 1.0;

    // Fill white background with rounded corners
    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, x, y, width, height, 6);

    // Draw black border (1px) around card back
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, x, y, width, height, 6);
    ctx.stroke();

    // Calculate logo dimensions to fit nicely on the card
    const logoSize = Math.min(width, height) * 0.8;
    const logoX = x + (width - logoSize) / 2;
    const logoY = y + (height - logoSize) / 2;

    // Draw the logo image
    ctx.drawImage(this.logoImage, logoX, logoY, logoSize, logoSize);

    // Restore context
    ctx.restore();
  }

  /**
   * Draw opponent card back (Axes Mundi logo)
   */
  private drawOpponentCardBack(ctx: CanvasRenderingContext2D, card: GameCard): void {
    // Save context
    ctx.save();

    // Set position and size
    const { x } = card;
    const { y } = card;
    const { width } = card;
    const { height } = card;

    // Draw card back with Axes Mundi logo (same as deck)
    this.drawAxesMundiLogoImage(ctx, x, y, width, height);

    // Restore context
    ctx.restore();
  }

  /**
   * Draw Axes Mundi Logo (fallback drawn version)
   */
  private drawAxesMundiLogo(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
    const logoColor = '#D4AF37'; // Metallic gold color
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    // Save context
    ctx.save();
    ctx.globalAlpha = 1.0;

    // Fill white background with rounded corners
    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, x, y, width, height, 6);

    // Draw black border (1px) around card back
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, x, y, width, height, 6);
    ctx.stroke();

    // Calculate logo dimensions to fill most of the card
    const logoSize = Math.min(width, height) * 0.9;
    const symbolSize = logoSize * 0.7;
    const textSize = logoSize * 0.3;

    // Draw symbol (compass rose)
    const symbolX = centerX;
    const symbolY = centerY - textSize * 0.4;

    // Main circle
    ctx.strokeStyle = logoColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(symbolX, symbolY, symbolSize * 0.4, 0, 2 * Math.PI);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = logoColor;
    ctx.beginPath();
    ctx.arc(symbolX, symbolY, symbolSize * 0.08, 0, 2 * Math.PI);
    ctx.fill();

    // Cross lines
    ctx.lineWidth = 4;
    ctx.strokeStyle = logoColor;
    ctx.beginPath();
    // Vertical line
    ctx.moveTo(symbolX, symbolY - symbolSize * 0.5);
    ctx.lineTo(symbolX, symbolY + symbolSize * 0.5);
    // Horizontal line
    ctx.moveTo(symbolX - symbolSize * 0.5, symbolY);
    ctx.lineTo(symbolX + symbolSize * 0.5, symbolY);
    ctx.stroke();

    // Arrowheads
    const arrowSize = symbolSize * 0.15;
    // Top arrow
    ctx.beginPath();
    ctx.moveTo(symbolX, symbolY - symbolSize * 0.5);
    ctx.lineTo(symbolX - arrowSize, symbolY - symbolSize * 0.5 + arrowSize);
    ctx.lineTo(symbolX + arrowSize, symbolY - symbolSize * 0.5 + arrowSize);
    ctx.closePath();
    ctx.fill();

    // Bottom arrow
    ctx.beginPath();
    ctx.moveTo(symbolX, symbolY + symbolSize * 0.5);
    ctx.lineTo(symbolX - arrowSize, symbolY + symbolSize * 0.5 - arrowSize);
    ctx.lineTo(symbolX + arrowSize, symbolY + symbolSize * 0.5 - arrowSize);
    ctx.closePath();
    ctx.fill();

    // Left arrow
    ctx.beginPath();
    ctx.moveTo(symbolX - symbolSize * 0.5, symbolY);
    ctx.lineTo(symbolX - symbolSize * 0.5 + arrowSize, symbolY - arrowSize);
    ctx.lineTo(symbolX - symbolSize * 0.5 + arrowSize, symbolY + arrowSize);
    ctx.closePath();
    ctx.fill();

    // Right arrow
    ctx.beginPath();
    ctx.moveTo(symbolX + symbolSize * 0.5, symbolY);
    ctx.lineTo(symbolX + symbolSize * 0.5 - arrowSize, symbolY - arrowSize);
    ctx.lineTo(symbolX + symbolSize * 0.5 - arrowSize, symbolY + arrowSize);
    ctx.closePath();
    ctx.fill();

    // Latitude lines (curved)
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(symbolX, symbolY, symbolSize * 0.3, 0, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(symbolX, symbolY, symbolSize * 0.2, 0, Math.PI);
    ctx.stroke();

    // Draw text "AXES MUNDI"
    ctx.fillStyle = logoColor;
    ctx.font = `bold ${textSize * 0.4}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText('AXES', centerX, centerY + textSize * 0.3);
    ctx.fillText('MUNDI', centerX, centerY + textSize * 0.7);

    // Restore context
    ctx.restore();
  }

  /**
    * Draw rounded rectangle helper
    */
  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  /**
    * Draw avatar box (styled like landing page avatar selection)
    * Shows avatar emoji centered with player name below
    * Square box (100x100 - half size)
    */
  private drawAvatarBox(ctx: CanvasRenderingContext2D, x: number, y: number, avatar: string, name: string): void {
    const boxWidth = 100 * this.scale;
    const boxHeight = 100 * this.scale;
    const borderRadius = 8 * this.scale;

    // Draw background box (10% transparency / 90% opaque gray)
    ctx.fillStyle = 'rgba(128, 128, 128, 0.9)';
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.9)';
    ctx.lineWidth = 2;

    this.roundRect(ctx, x, y, boxWidth, boxHeight, borderRadius);
    ctx.fill();
    ctx.stroke();

    // Draw avatar emoji (centered in upper portion)
    ctx.fillStyle = '#000000';
    ctx.font = `${48 * this.scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(avatar, x + boxWidth / 2, y + boxHeight / 2 - 12 * this.scale);

    // Draw player name (below avatar, black)
    ctx.font = `bold ${13 * this.scale}px Arial`;
    ctx.textBaseline = 'top';
    ctx.fillText(name, x + boxWidth / 2, y + boxHeight / 2 + 18 * this.scale);

    // Reset text baseline
    ctx.textBaseline = 'alphabetic';
  }

  /**
    * Layout remaining hand cards nicely along bottom
    */
  private layoutHand(): void {
    const cardSpacing = 220 * this.scale; // Increased spacing for larger cards
    const totalWidth = this.playerHand.length * cardSpacing - 20 * this.scale; // Scaled spacing
    const startX = (this.gameCanvas.width - totalWidth) / 2; // Center the hand
    this.playerHand.forEach((card, index) => {
      const x = startX + index * cardSpacing;
      const y = this.gameCanvas.height - 320 * this.scale;
      card.setTargetPosition(x, y);
    });
  }

  /**
   * Layout hotseat hands (current player at bottom, next player at top)
   */
  private layoutHotseatHands(): void {
    const cardSpacing = 220 * this.scale;

    // Layout current player hand (bottom) - show card fronts
    if (this.currentPlayerIndex === 0) {
      // Player 1 is current player
      const currentPlayerTotalWidth = this.player1Hand.length * cardSpacing - 20 * this.scale;
      const currentPlayerStartX = (this.gameCanvas.width - currentPlayerTotalWidth) / 2;

      this.player1Hand.forEach((card, index) => {
        const x = currentPlayerStartX + index * cardSpacing;
        const y = this.gameCanvas.height - 320 * this.scale; // Bottom position
        card.setTargetPosition(x, y);
      });

      // Player 2 is next player
      const nextPlayerTotalWidth = this.player2Hand.length * cardSpacing - 20 * this.scale;
      const nextPlayerStartX = (this.gameCanvas.width - nextPlayerTotalWidth) / 2;

      this.player2Hand.forEach((card, index) => {
        const x = nextPlayerStartX + index * cardSpacing;
        const y = 20 * this.scale; // Top position
        card.setTargetPosition(x, y);
      });
    } else {
      // Player 2 is current player
      const currentPlayerTotalWidth = this.player2Hand.length * cardSpacing - 20 * this.scale;
      const currentPlayerStartX = (this.gameCanvas.width - currentPlayerTotalWidth) / 2;

      this.player2Hand.forEach((card, index) => {
        const x = currentPlayerStartX + index * cardSpacing;
        const y = this.gameCanvas.height - 320 * this.scale; // Bottom position
        card.setTargetPosition(x, y);
      });

      // Player 1 is next player
      const nextPlayerTotalWidth = this.player1Hand.length * cardSpacing - 20 * this.scale;
      const nextPlayerStartX = (this.gameCanvas.width - nextPlayerTotalWidth) / 2;

      this.player1Hand.forEach((card, index) => {
        const x = nextPlayerStartX + index * cardSpacing;
        const y = 20 * this.scale; // Top position
        card.setTargetPosition(x, y);
      });
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
    if (!this.boardCard) return;

    // Combine all placed cards with the board card
    const allCards = [
      this.boardCard,
      ...this.placedLeft,
      ...this.placedRight,
    ];

    if (allCards.length <= 1) return; // No need to spread if only one card

    // Sort cards by their axis VALUE to ensure correct order (smallest to largest)
    const sortedCards = allCards.sort((a, b) => {
      const aValue = convertToComparable(a.card.value, a.card.unit);
      const bValue = convertToComparable(b.card.value, b.card.unit);
      return aValue - bValue;
    });

    // Use fixed 5px spacing between cards
    const cardWidth = 200 * this.scale;
    const spacing = 5 * this.scale; // Fixed 5px spacing as requested

    // Calculate total width needed
    const totalWidth = sortedCards.length * cardWidth + (sortedCards.length - 1) * spacing;
    const startX = (this.gameCanvas.width - totalWidth) / 2; // Center the entire spread

    // Set target positions for smooth animation
    const axisY = this.gameCanvas.height / 2;

    sortedCards.forEach((card, index) => {
      const x = startX + index * (cardWidth + spacing);
      const y = axisY - card.height / 2;
      card.setTargetPosition(x, y);
    });
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
    this.isPreviewActive = false;
    this.isGameStarted = false;
    this.currentTurn = 0;
    this.isPlayerTurn = true;
    this.turnText = '';
    this.turnTimer = 30;
    this.playerSwitchOverlayVisible = false;
    this.playerSwitchOverlayBounds = null;

    // Reload the game
    this.loadGame();
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
   * Update scale for all existing cards
   */
  private updateAllCardsScale(): void {
    // Update board card
    if (this.boardCard) {
      this.boardCard.updateScale(this.scale);
    }

    // Update player hand cards
    for (const card of this.playerHand) {
      card.updateScale(this.scale);
    }

    // Update opponent hand cards
    for (const card of this.opponentHand) {
      card.updateScale(this.scale);
    }

    // Update placed cards
    for (const card of this.placedLeft) {
      card.updateScale(this.scale);
    }
    for (const card of this.placedRight) {
      card.updateScale(this.scale);
    }

    // Update graveyard cards
    for (const card of this.graveyard) {
      card.updateScale(this.scale);
    }
  }

  /**
   * Show player switch overlay for hotseat mode
   */
  private showPlayerSwitchOverlay(): void {
    this.playerSwitchOverlayVisible = true;
    // Disable player turn while overlay is visible
    this.isPlayerTurn = false;
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
   * Draw player switch overlay for hotseat mode
   */
  private drawPlayerSwitchOverlay(ctx: CanvasRenderingContext2D): void {
    // Darken the background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, this.gameCanvas.width, this.gameCanvas.height);

    // Draw overlay box
    const overlayWidth = 400 * this.scale;
    const overlayHeight = 200 * this.scale;
    const overlayX = (this.gameCanvas.width - overlayWidth) / 2;
    const overlayY = (this.gameCanvas.height - overlayHeight) / 2;

    // Store bounds for click detection
    this.playerSwitchOverlayBounds = {
      x: overlayX,
      y: overlayY,
      width: overlayWidth,
      height: overlayHeight,
    };

    // Draw overlay background
    ctx.fillStyle = '#2c3e50';
    drawRoundedRect(ctx, overlayX, overlayY, overlayWidth, overlayHeight, 10 * this.scale);

    // Draw border
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 3 * this.scale;
    ctx.strokeRect(overlayX, overlayY, overlayWidth, overlayHeight);

    // Draw text
    const nextPlayerIndex = this.currentPlayerIndex === 0 ? 1 : 0;
    const nextPlayer = nextPlayerIndex === 0 ? this.player1Data : this.player2Data;

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${24 * this.scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `Now it's ${nextPlayer?.name || 'Player'}'s turn!`,
      overlayX + overlayWidth / 2,
      overlayY + overlayHeight / 2 - 30 * this.scale,
    );

    ctx.font = `${18 * this.scale}px Arial`;
    ctx.fillStyle = '#bdc3c7';
    ctx.fillText(
      'Klicke um fortzufahren',
      overlayX + overlayWidth / 2,
      overlayY + overlayHeight / 2 + 20 * this.scale,
    );
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
