import { logger } from '@/utils/logger';
// REMOVED: loadDeck, shuffleCardsInPlace - Now used in GameInitializer
import { GameCard } from '@/game/Card';
import { Card as CardData } from '@/data/types';
import { soundManager } from '@/utils/soundManager';
import { backgroundMusicManager } from '@/utils/backgroundMusicManager';
// REMOVED: loadImage - Now used in GameInitializer
import { calculateScale, calculateSnapThreshold } from '@/utils/scaleUtils';
import { ResizeHandler } from '@/utils/resizeHandler';
// REMOVED: getOpponentCardCount, dealCard - Now used in CardDealerManager
import { CardLayoutManager } from '@/utils/cardLayout';
import { InputHandler } from '@/utils/inputHandler';
import { AIManager } from '@/utils/aiManager';
import { GameRenderer } from '@/utils/gameRenderer';
import { GameStateManager } from '@/utils/gameStateManager';
import { CardPlacementHandler } from '@/utils/cardPlacementHandler';
import { CardDealerManager } from '@/utils/cardDealerManager';
import { GameInitializer } from '@/utils/gameInitializer';
import { TurnTimerManager } from '@/utils/turnTimerManager';
import { UIDialogManager } from '@/utils/uiDialogManager';
import { LearningModeManager } from '@/utils/learningModeManager';
import { BoardNavigationManager } from '@/utils/boardNavigationManager';
import { OptionsMenu } from '@/utils/optionsMenu';
import { getLanSessionState, getSelectedDifficulty, getSelectedGameType } from '@/utils/sessionStore';

/**
 * Main application class
 */
class AxesMundiApp {
  private loadingElement: HTMLElement;

  private gameCanvas: HTMLCanvasElement;

  private gameContext: CanvasRenderingContext2D;

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

  private placedLeft: GameCard[] = [];

  private placedRight: GameCard[] = [];

  private graveyard: GameCard[] = []; // Cards that were placed incorrectly

  private score: number = 0;

  private remainingCards: CardData[] = [];

  private deck: any = null; // Deck data for image folder reference

  private gameWon: boolean = false; // Track if player has won

  private gameLost: boolean = false; // Track if player has lost

  private snapThreshold: number = 80; // px distance to axis

  private scale: number = 1; // Global scale factor

  private resizeHandler: ResizeHandler | null = null; // Resize handler for window resizing

  private layoutManager: CardLayoutManager | null = null; // Card layout manager

  private inputHandler: InputHandler | null = null; // Input handler for mouse events

  private aiManager: AIManager | null = null; // AI manager for opponent turns

  private gameRenderer: GameRenderer | null = null; // Game renderer for all drawing operations

  private gameStateManager: GameStateManager | null = null; // Game state manager for state logic

  private cardPlacementHandler: CardPlacementHandler | null = null; // Card placement handler for placement logic

  private cardDealerManager: CardDealerManager | null = null; // Card dealer manager for card dealing logic

  private gameInitializer: GameInitializer | null = null; // Game initializer for initialization logic

  private turnTimerManager: TurnTimerManager | null = null; // Turn timer manager for timer logic

  private uiDialogManager: UIDialogManager | null = null; // UI dialog manager for dialogs and overlays

  private learningModeManager: LearningModeManager | null = null; // Learning mode manager for learning mode logic

  private boardNavigationManager: BoardNavigationManager | null = null; // Board navigation manager for board navigation logic

  private currentTurn: number = 0; // Track current turn

  private isPlayerTurn: boolean = true; // Track whose turn it is (true = player, false = AI)

  private turnText: string = ''; // Display turn information

  private turnTimer: number = 10; // Default timer

  private gameDifficulty: 'easy' | 'medium' | 'hard'; // Current game difficulty

  // REMOVED: turnTimerInterval - Now in TurnTimerManager

  private isAITurnInProgress: boolean = false; // Prevent multiple AI turns

  // Learning mode state
  private isLearningMode: boolean = false; // Track if we're in learning mode

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
        onCardSelected: () => {},
        onCardPlaced: (card, x, y, isLeft, isFirstCard) => {
          if (this.cardPlacementHandler) {
            this.cardPlacementHandler.handleCardPlacement(card, x, y, isLeft, isFirstCard);
          }
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
          if (this.learningModeManager) {
            this.learningModeManager.handleWeiterButtonClick();
          }
        },
        onClearBoardButtonClick: () => {
          if (this.learningModeManager) {
            this.learningModeManager.clearBoard();
          }
        },
        onResetGameButtonClick: () => {
          if (this.learningModeManager) {
            this.learningModeManager.resetLearningGame();
          }
        },
        onNavigationArrowClick: (direction) => {
          if (this.boardNavigationManager) {
            if (direction === 'left') {
              this.boardNavigationManager.moveBoardCardsLeft();
            } else {
              this.boardNavigationManager.moveBoardCardsRight();
            }
          }
        },
        onPlayerSwitchOverlayClick: () => {
          if (this.uiDialogManager) {
            this.uiDialogManager.switchPlayers();
          }
        },
        onCardRemoved: (card) => {
          if (this.learningModeManager) {
            this.learningModeManager.removeCardFromBoard(card);
          }
        },
        onTooltipHover: (card) => {
          const hasIncorrectCard = this.placedLeft.find((c) => c.isCorrect === false)
                                    || this.placedRight.find((c) => c.isCorrect === false)
                                    || (this.boardCard && this.boardCard.isCorrect === false);
          if (!hasIncorrectCard) {
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
          if (this.turnTimerManager) {
            this.turnTimerManager.startTurnTimer();
          }
          this.updateInputHandlerConfig();
        },
        onCheckWin: () => {
          if (this.gameStateManager) {
            this.gameStateManager.checkForWin();
          }
        },
        onStartTurnTimer: () => {
          if (this.turnTimerManager) {
            this.turnTimerManager.startTurnTimer();
          }
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
      onGetDifficultyTimer: () => {
        if (this.turnTimerManager) {
          return this.turnTimerManager.getDifficultyTimer(this.gameDifficulty);
        }
        return 10; // Default
      },
    });

    // Initialize game state manager (will be fully configured after deck is loaded)
    this.gameStateManager = new GameStateManager({
      canvas: this.gameCanvas,
      scale: this.scale,
      deck: this.deck,
      onGetScale: () => this.scale, // Get current scale dynamically
      callbacks: {
        onGetBoardCards: () => ({
          boardCard: this.boardCard,
          placedLeft: this.placedLeft,
          placedRight: this.placedRight,
        }),
        onGetHands: () => ({
          playerHand: this.playerHand,
          opponentHand: this.opponentHand,
          player1Hand: this.player1Hand,
          player2Hand: this.player2Hand,
        }),
        onGetGraveyard: () => this.graveyard,
        onGetRemainingCards: () => this.remainingCards,
        onGetGameState: () => ({
          score: this.score,
          currentTurn: this.currentTurn,
          gameWon: this.gameWon,
          gameLost: this.gameLost,
          isPlayerTurn: this.isPlayerTurn,
          isLearningMode: this.isLearningMode,
          isHotseatMode: this.isHotseatMode,
          currentPlayerIndex: this.currentPlayerIndex,
          player1Data: this.player1Data,
          player2Data: this.player2Data,
        }),
        onSetBoardCard: (card) => {
          this.boardCard = card;
        },
        onSetPlacedLeft: (cards) => {
          this.placedLeft = cards;
        },
        onSetPlacedRight: (cards) => {
          this.placedRight = cards;
        },
        onSetGraveyard: (cards) => {
          this.graveyard = cards;
        },
        onSetRemainingCards: (cards) => {
          this.remainingCards = cards;
        },
        onSetPlayerHand: (cards) => {
          this.playerHand = cards;
        },
        onSetOpponentHand: (cards) => {
          this.opponentHand = cards;
        },
        onSetPlayer1Hand: (cards) => {
          this.player1Hand = cards;
        },
        onSetPlayer2Hand: (cards) => {
          this.player2Hand = cards;
        },
        onSetScore: (score) => {
          this.score = score;
        },
        onSetGameWon: (won) => {
          this.gameWon = won;
        },
        onSetGameLost: (lost) => {
          this.gameLost = lost;
        },
        onSetIsPlayerTurn: (isPlayerTurn) => {
          this.isPlayerTurn = isPlayerTurn;
        },
        onSetCurrentTurn: (turn) => {
          this.currentTurn = turn;
        },
        onLayoutAxisCards: () => {
          this.layoutAxisCards();
        },
        onLayoutHand: () => {
          this.layoutHand();
        },
        onLayoutHotseatHands: () => {
          this.layoutHotseatHands();
        },
        onAnimateCardToGraveyard: (card) => {
          this.animateCardToGraveyard(card);
        },
        onAnimateCardToHand: (card) => {
          if (this.cardDealerManager) {
            this.cardDealerManager.animateCardToHand(card);
          }
        },
        onPlaySound: (soundType) => {
          soundManager.play(soundType);
        },
        onTurnComplete: () => {
          this.isPlayerTurn = true;
          this.currentTurn++;
          this.isAITurnInProgress = false;
          if (this.turnTimerManager) {
            this.turnTimerManager.startTurnTimer();
          }
          this.updateInputHandlerConfig();
        },
        onStartTurnTimer: () => {
          if (this.turnTimerManager) {
            this.turnTimerManager.startTurnTimer();
          }
        },
        onStopTurnTimer: () => {
          if (this.turnTimerManager) {
            this.turnTimerManager.stopTurnTimer();
          }
        },
        onUpdateInputHandlerConfig: () => {
          this.updateInputHandlerConfig();
        },
        onAITurn: (opponentHand) => {
          if (this.aiManager) {
            // Pass false to playTurn - we're starting a new turn, not continuing one
            // playTurn will return true if the turn starts successfully
            this.isAITurnInProgress = this.aiManager.playTurn(opponentHand, false);
          }
        },
        onSetAITurnInProgress: (inProgress) => {
          this.isAITurnInProgress = inProgress;
        },
        onShowPlayerSwitchOverlay: () => {
          if (this.uiDialogManager) {
            this.uiDialogManager.showPlayerSwitchOverlay();
          }
        },
        onShowHotseatWinDialog: (winnerName) => {
          if (this.uiDialogManager) {
            this.uiDialogManager.showHotseatWinDialog(winnerName);
          }
        },
        onShowWinDialog: () => {
          if (this.uiDialogManager) {
            this.uiDialogManager.showWinDialog();
          }
        },
        onShowLoseDialog: () => {
          if (this.uiDialogManager) {
            this.uiDialogManager.showLoseDialog();
          }
        },
      },
    });

    // Initialize card placement handler
    this.cardPlacementHandler = new CardPlacementHandler({
      callbacks: {
        onGetBoardCards: () => ({
          boardCard: this.boardCard,
          placedLeft: this.placedLeft,
          placedRight: this.placedRight,
        }),
        onGetHands: () => ({
          playerHand: this.playerHand,
          opponentHand: this.opponentHand,
          player1Hand: this.player1Hand,
          player2Hand: this.player2Hand,
        }),
        onGetGameState: () => ({
          score: this.score,
          currentTurn: this.currentTurn,
          gameWon: this.gameWon,
          gameLost: this.gameLost,
          isPlayerTurn: this.isPlayerTurn,
          isLearningMode: this.isLearningMode,
          isHotseatMode: this.isHotseatMode,
          currentPlayerIndex: this.currentPlayerIndex,
        }),
        onGetRemainingCards: () => this.remainingCards,
        onGetCanvasDimensions: () => ({ width: this.gameCanvas.width, height: this.gameCanvas.height }),
        onSetBoardCard: (card) => { this.boardCard = card; },
        onSetPlacedLeft: (cards) => { this.placedLeft = cards; },
        onSetPlacedRight: (cards) => { this.placedRight = cards; },
        onSetPlayerHand: (cards) => { this.playerHand = cards; },
        onSetPlayer1Hand: (cards) => { this.player1Hand = cards; },
        onSetPlayer2Hand: (cards) => { this.player2Hand = cards; },
        onSetScore: (score) => { this.score = score; },
        onSetIsPlayerTurn: (isPlayerTurn) => {
          this.isPlayerTurn = isPlayerTurn;
          this.updateInputHandlerConfig();
        },
        onSetCurrentTurn: (turn) => { this.currentTurn = turn; },
        onSetWeiterButtonBounds: (bounds) => { this.weiterButtonBounds = bounds; },
        onSetIsAITurnInProgress: (inProgress) => { this.isAITurnInProgress = inProgress; },
        onLayoutAxisCards: () => this.layoutAxisCards(),
        onLayoutHand: () => this.layoutHand(),
        onLayoutHotseatHands: () => this.layoutHotseatHands(),
        onPlaySound: (soundType) => soundManager.play(soundType),
        onStopTurnTimer: () => {
          if (this.turnTimerManager) {
            this.turnTimerManager.stopTurnTimer();
          }
        },
        onStartTurnTimer: () => {
          if (this.turnTimerManager) {
            this.turnTimerManager.startTurnTimer();
          }
        },
        onCheckWin: () => {
          if (this.gameStateManager) {
            this.gameStateManager.checkForWin();
          }
        },
        onAITurn: (opponentHand) => {
          if (this.aiManager) {
            // Pass false to playTurn - we're starting a new turn, not continuing one
            // playTurn will return true if the turn starts successfully
            this.isAITurnInProgress = this.aiManager.playTurn(opponentHand, false);
          }
        },
        onShowPlayerSwitchOverlay: () => {
          if (this.uiDialogManager) {
            this.uiDialogManager.showPlayerSwitchOverlay();
          }
        },
        onShowTooltip: (card) => {
          if (this.learningModeManager) {
            this.learningModeManager.showTooltipForIncorrectCard(card);
          }
        },
        onMoveCardToGraveyard: (card) => {
          if (this.gameStateManager) {
            this.gameStateManager.moveCardToGraveyard(card, this.isLearningMode);
          }
        },
        onGiveNewCard: () => {
          if (this.gameStateManager) {
            this.gameStateManager.giveNewCard();
          }
        },
        onLog: (level, scope, msg, meta) => logger[level]({ scope, msg, meta }),
      },
    });

    // Initialize turn timer manager
    this.turnTimerManager = new TurnTimerManager({
      callbacks: {
        onGetGameState: () => ({
          gameDifficulty: this.gameDifficulty,
          isLearningMode: this.isLearningMode,
          isHotseatMode: this.isHotseatMode,
          isPlayerTurn: this.isPlayerTurn,
          currentTurn: this.currentTurn,
        }),
        onGetHands: () => ({
          playerHand: this.playerHand,
          opponentHand: this.opponentHand,
        }),
        onGetPlayerData: () => ({
          player1Data: this.player1Data,
          player2Data: this.player2Data,
          currentPlayerIndex: this.currentPlayerIndex,
        }),
        onGetTurnTimer: () => this.turnTimer,
        onSetTurnTimer: (timer) => {
          this.turnTimer = timer;
        },
        onSetTurnText: (text) => {
          this.turnText = text;
        },
        onSetIsPlayerTurn: (isPlayerTurn) => {
          this.isPlayerTurn = isPlayerTurn;
          this.updateInputHandlerConfig();
        },
        onSetCurrentTurn: (turn) => {
          this.currentTurn = turn;
        },
        onUpdateInputHandlerConfig: () => {
          this.updateInputHandlerConfig();
        },
        onAITurn: (opponentHand) => {
          if (this.aiManager && !this.isAITurnInProgress) {
            setTimeout(() => {
              this.isAITurnInProgress = this.aiManager!.playTurn(opponentHand, this.isAITurnInProgress);
            }, 500);
          }
        },
      },
    });

    // Initialize UI dialog manager
    this.uiDialogManager = new UIDialogManager({
      callbacks: {
        onGetGameState: () => ({
          score: this.score,
          currentTurn: this.currentTurn,
          currentPlayerIndex: this.currentPlayerIndex,
        }),
        onGetPlayerData: () => ({
          player1Data: this.player1Data,
          player2Data: this.player2Data,
        }),
        onGetHands: () => ({
          player1Hand: this.player1Hand,
          player2Hand: this.player2Hand,
        }),
        onSetPlayerSwitchOverlayVisible: (visible) => {
          this.playerSwitchOverlayVisible = visible;
        },
        onSetPlayerSwitchOverlayBounds: (bounds) => {
          this.playerSwitchOverlayBounds = bounds;
        },
        onSetIsPlayerTurn: (isPlayerTurn) => {
          this.isPlayerTurn = isPlayerTurn;
        },
        onSetCurrentPlayerIndex: (index) => {
          this.currentPlayerIndex = index;
        },
        onSetCurrentPlayerHand: (hand) => {
          this.currentPlayerHand = hand;
        },
        onSetNextPlayerHand: (hand) => {
          this.nextPlayerHand = hand;
        },
        onRestartGame: () => {
          this.restartGame();
        },
        onGoToMainMenu: () => {
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
        },
        onUpdateInputHandlerConfig: () => {
          this.updateInputHandlerConfig();
        },
        onLayoutHotseatHands: () => {
          this.layoutHotseatHands();
        },
        onUpdateTurnText: () => {
          if (this.turnTimerManager) {
            this.turnTimerManager.updateTurnText();
          }
        },
      },
    });

    // Initialize learning mode manager
    this.learningModeManager = new LearningModeManager({
      callbacks: {
        onGetBoardCards: () => ({
          boardCard: this.boardCard,
          placedLeft: this.placedLeft,
          placedRight: this.placedRight,
        }),
        onGetGraveyard: () => this.graveyard,
        onGetPlayerHand: () => this.playerHand,
        onGetRemainingCards: () => this.remainingCards,
        onGetGameState: () => ({
          score: this.score,
          currentTurn: this.currentTurn,
          isLearningMode: this.isLearningMode,
        }),
        onSetBoardCard: (card) => {
          this.boardCard = card;
        },
        onSetPlacedLeft: (cards) => {
          this.placedLeft = cards;
        },
        onSetPlacedRight: (cards) => {
          this.placedRight = cards;
        },
        onSetGraveyard: (cards) => {
          this.graveyard = cards;
        },
        onSetPlayerHand: (cards) => {
          this.playerHand = cards;
        },
        onSetScore: (score) => {
          this.score = score;
        },
        onSetCurrentTurn: (turn) => {
          this.currentTurn = turn;
        },
        onSetIsGameStarted: () => {},
        onSetIsPlayerTurn: (isPlayerTurn) => {
          this.isPlayerTurn = isPlayerTurn;
        },
        onSetTurnText: (text) => {
          this.turnText = text;
        },
        onSetTurnTimer: (timer) => {
          this.turnTimer = timer;
        },
        onSetTooltipVisible: (visible) => {
          this.tooltipVisible = visible;
        },
        onSetTooltipCard: (card) => {
          this.tooltipCard = card;
        },
        onSetHoveredCard: () => {},
        onSetWeiterButtonBounds: (bounds) => {
          this.weiterButtonBounds = bounds;
        },
        onSetClearBoardButtonBounds: (bounds) => {
          this.clearBoardButtonBounds = bounds;
        },
        onSetResetGameButtonBounds: (bounds) => {
          this.resetGameButtonBounds = bounds;
        },
        onAnimateCardToGraveyard: (card) => {
          this.animateCardToGraveyard(card);
        },
        onLayoutAxisCards: () => {
          this.layoutAxisCards();
        },
        onGiveNewCard: (skipGraveyardRecycle) => {
          if (this.gameStateManager) {
            this.gameStateManager.giveNewCard(skipGraveyardRecycle);
          }
        },
        onUpdateInputHandlerConfig: () => {
          this.updateInputHandlerConfig();
        },
        onLoadGame: async () => {
          if (this.gameInitializer) {
            await this.gameInitializer.loadGame();
          }
        },
        onStopTurnTimer: () => {
          if (this.turnTimerManager) {
            this.turnTimerManager.stopTurnTimer();
          }
        },
        onGetTooltipCard: () => this.tooltipCard,
      },
    });

    // Initialize board navigation manager
    this.boardNavigationManager = new BoardNavigationManager({
      callbacks: {
        onGetBoardCards: () => ({
          boardCard: this.boardCard,
          placedLeft: this.placedLeft,
          placedRight: this.placedRight,
        }),
        onGetScale: () => this.scale,
      },
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

      // Update game state manager config
      if (this.gameStateManager) {
        this.gameStateManager.updateConfig({
          scale,
          canvas: this.gameCanvas,
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

      // Update card dealer manager config
      if (this.cardDealerManager) {
        this.cardDealerManager.updateConfig({
          scale,
          canvas: this.gameCanvas,
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
    const savedDifficulty = getSelectedDifficulty();
    this.gameDifficulty = savedDifficulty || 'medium';

    // Initialize learning mode and hotseat mode from localStorage
    const savedGameType = getSelectedGameType();
    this.isLearningMode = savedGameType === 'educational';
    this.isHotseatMode = savedGameType === 'hotseat';

    // Initialize LAN mode from localStorage
    this.isLANMode = savedGameType === 'lan';
    if (this.isLANMode) {
      const lanSession = getLanSessionState();
      this.lanPlayerName = localStorage.getItem('axesMundiPlayer') ? JSON.parse(localStorage.getItem('axesMundiPlayer')!).name : 'Player';
      this.lanOpponentName = lanSession.clientPlayerName || 'Opponent';
      this.isLANServerClient = lanSession.isServerClient;

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
        timer: this.turnTimerManager ? this.turnTimerManager.getDifficultyTimer(this.gameDifficulty) : 10,
        isLearningMode: this.isLearningMode,
      },
    });

    // Initialize game initializer
    this.gameInitializer = new GameInitializer({
      canvas: this.gameCanvas,
      callbacks: {
        onGetGameState: () => ({
          isLearningMode: this.isLearningMode,
          isHotseatMode: this.isHotseatMode,
          currentPlayerIndex: this.currentPlayerIndex,
          gameDifficulty: this.gameDifficulty,
        }),
        onGetRemainingCards: () => this.remainingCards,
        onGetHands: () => ({
          player1Hand: this.player1Hand,
          player2Hand: this.player2Hand,
        }),
        onSetDeck: (deck) => {
          this.deck = deck;
        },
        onSetRemainingCards: (cards) => {
          this.remainingCards = cards;
        },
        onSetBoardCard: (card) => {
          this.boardCard = card;
        },
        onSetScale: (scale) => {
          this.scale = scale;
        },
        onSetSnapThreshold: (threshold) => {
          this.snapThreshold = threshold;
        },
        onSetLogoImage: (image) => {
          this.logoImage = image;
        },
        onSetArrowLeftImage: (image) => {
          this.arrowLeftImage = image;
        },
        onSetArrowRightImage: (image) => {
          this.arrowRightImage = image;
        },
        onSetBackgroundImage: (image) => {
          this.backgroundImage = image;
        },
        onSetCurrentPlayerHand: (hand) => {
          this.currentPlayerHand = hand;
        },
        onSetNextPlayerHand: (hand) => {
          this.nextPlayerHand = hand;
        },
        onUpdateGameStateManager: (deck) => {
          if (this.gameStateManager) {
            this.gameStateManager.updateConfig({ deck });
          }
        },
        onInitializeCardDealerManager: () => {
          if (this.deck) {
            this.cardDealerManager = new CardDealerManager({
              canvas: this.gameCanvas,
              scale: this.scale,
              deck: this.deck,
              callbacks: {
                onGetRemainingCards: () => this.remainingCards,
                onGetGraveyard: () => this.graveyard,
                onGetHands: () => ({
                  playerHand: this.playerHand,
                  opponentHand: this.opponentHand,
                  player1Hand: this.player1Hand,
                  player2Hand: this.player2Hand,
                }),
                onGetGameState: () => ({
                  gameDifficulty: this.gameDifficulty,
                  isLearningMode: this.isLearningMode,
                  isHotseatMode: this.isHotseatMode,
                  currentPlayerIndex: this.currentPlayerIndex,
                  boardCard: this.boardCard,
                  currentTurn: this.currentTurn,
                }),
                onAddCardToPlayerHand: (card) => {
                  this.playerHand.push(card);
                },
                onAddCardToOpponentHand: (card) => {
                  this.opponentHand.push(card);
                },
                onAddCardToPlayer1Hand: (card) => {
                  this.player1Hand.push(card);
                },
                onAddCardToPlayer2Hand: (card) => {
                  this.player2Hand.push(card);
                },
                onSetBoardCard: (card) => {
                  this.boardCard = card;
                },
                onSetIsPlayerTurn: (isPlayerTurn) => {
                  this.isPlayerTurn = isPlayerTurn;
                },
                onSetIsGameStarted: () => {},
                onSetCurrentTurn: (turn) => {
                  this.currentTurn = turn;
                },
                onLayoutHand: () => {
                  this.layoutHand();
                },
                onLayoutOpponentHand: () => {
                  this.layoutOpponentHand();
                },
                onLayoutHotseatHands: () => {
                  this.layoutHotseatHands();
                },
                onLayoutPlayer1Hand: () => {
                  this.layoutPlayer1Hand();
                },
                onLayoutPlayer2Hand: () => {
                  this.layoutPlayer2Hand();
                },
                onRecycleGraveyard: () => {
                  if (this.gameStateManager) {
                    this.gameStateManager.recycleGraveyard();
                  }
                },
                onUpdateInputHandlerConfig: () => {
                  this.updateInputHandlerConfig();
                },
                onStartTurnTimer: () => {
                  if (this.turnTimerManager) {
            this.turnTimerManager.startTurnTimer();
          }
                },
                onUpdateTurnText: () => {
                  if (this.turnTimerManager) {
            this.turnTimerManager.updateTurnText();
          }
                },
                onPlaySound: (soundType) => {
                  soundManager.play(soundType);
                },
              },
            });
          }
        },
        onAnimateFirstCardToCenter: (card) => {
          if (this.cardDealerManager) {
            this.cardDealerManager.animateFirstCardToCenter(card);
          }
        },
        onStartDealingCards: (mode) => {
          if (this.cardDealerManager) {
            if (mode === 'learning') {
              this.cardDealerManager.dealCardsToPlayersLearningMode();
            } else if (mode === 'hotseat') {
              this.cardDealerManager.dealCardsToPlayersHotseat();
              // Set current player hand based on starting player immediately
              this.currentPlayerHand = this.currentPlayerIndex === 0 ? this.player1Hand : this.player2Hand;
              this.nextPlayerHand = this.currentPlayerIndex === 0 ? this.player2Hand : this.player1Hand;
            } else {
              this.cardDealerManager.dealCardsToPlayers();
            }
          }
        },
      },
    });

    // Initialize canvas
    if (this.gameInitializer) {
      this.gameInitializer.initCanvas();
    }

    // Setup event listeners
    if (this.gameInitializer) {
      this.gameInitializer.setupEventListeners(this.resizeHandler, this.inputHandler);
    }

    this.hideLoadingScreen();
    // Calculate initial scale
    this.scale = calculateScale(window.innerWidth, window.innerHeight);
    this.snapThreshold = calculateSnapThreshold(this.scale);

    // Load all UI assets in parallel (fire-and-forget, they'll render when ready)
    if (this.gameInitializer) {
      this.gameInitializer.loadAssets();
    }

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
      if (this.gameInitializer) {
        // Load game asynchronously (don't await - start game loop immediately)
        this.gameInitializer.loadGame().catch((error) => {
          logger.error({
            scope: 'renderer/app',
            msg: 'failed to load game',
            err: { message: error.message },
          });
        });
      }
      this.startGameLoop();
    }
  }

  // REMOVED: Initialization methods - Now handled by GameInitializer



  // REMOVED: loadGame() - Now handled by GameInitializer

  // REMOVED: Card dealing methods - Now handled by CardDealerManager

  // REMOVED: handleCardDistributionFromServer() - Now handled by LANGameManager

  // REMOVED: setupLANIPCListeners() and startLANGame() - Now handled by LANGameManager

  // REMOVED: sendCardDistributionToClient() - Now handled by LANGameManager

  // REMOVED: Opponent card dealing methods - Now handled by CardDealerManager

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

  // REMOVED: updateTurnText() - Now handled by TurnTimerManager

  // REMOVED: Learning mode and hotseat card dealing methods - Now handled by CardDealerManager

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

  // REMOVED: Timer methods - Now handled by TurnTimerManager


  /**
   * Show tooltip for incorrect card automatically
   */
  // REMOVED: showTooltipForIncorrectCard() - Now handled by LearningModeManager

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

  // REMOVED: Learning mode methods - Now handled by LearningModeManager
  // clearBoard, resetLearningGame, removeCardFromBoard

  // REMOVED: Board navigation methods - Now handled by BoardNavigationManager
  // moveBoardCardsLeft, moveBoardCardsRight

  // REMOVED: handleCardPlacement() - Now handled by CardPlacementHandler

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

      requestAnimationFrame(this.gameLoop.bind(this));
    } catch (error: any) {
      logger.error({
        scope: 'renderer/gameloop',
        msg: 'game loop error',
        err: { message: (error as Error).message, stack: (error as Error).stack },
      });
      // Continue the loop even if there's an error
      requestAnimationFrame(this.gameLoop.bind(this));
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
  // REMOVED: showPlayerSwitchOverlay() and switchPlayer() - Now handled by UIDialogManager

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

  // REMOVED: Dialog methods - Now handled by UIDialogManager
  // showHotseatWinDialog, showWinDialog, showLoseDialog, showCustomWinDialog, goToMainMenu

  /**
   * Restart the game
   */
  private restartGame(): void {
    logger.info({
      scope: 'renderer/game',
      msg: 'restarting game',
    });

    // Stop any running timer
    if (this.turnTimerManager) {
      this.turnTimerManager.stopTurnTimer();
    }

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
    this.currentTurn = 0;
    this.isPlayerTurn = true;
    this.turnText = '';
    this.turnTimer = 30;
    this.playerSwitchOverlayVisible = false;
    this.updateInputHandlerConfig();
    this.playerSwitchOverlayBounds = null;

    // Reload the game
    if (this.gameInitializer) {
      this.gameInitializer.loadGame().catch((error) => {
        logger.error({
          scope: 'renderer/game',
          msg: 'failed to reload game',
          err: { message: error.message },
        });
      });
    }
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

function navigateToMenu(): Promise<void> {
  return backgroundMusicManager.fadeOutCurrent(700).finally(() => {
    window.location.href = './index.html';
  });
}

function quitApplication(): Promise<void> {
  if (window.AXM?.quitApp) {
    return window.AXM.quitApp().then(() => undefined);
  }

  window.close();
  return Promise.resolve();
}

function setupOptionsMenu(): void {
  const optionsMenu = new OptionsMenu({
    musicVolume: backgroundMusicManager.getVolume(),
    sfxVolume: soundManager.getVolume(),
    onMusicVolumeChange: (volume) => {
      backgroundMusicManager.setVolume(volume);
      optionsMenu.setMusicVolume(backgroundMusicManager.getVolume());
    },
    onSfxVolumeChange: (volume) => {
      soundManager.setVolume(volume);
      optionsMenu.setSfxVolume(soundManager.getVolume());
    },
    onReturn: () => {},
    onLeaveToMenu: () => {
      void navigateToMenu();
    },
    leaveToMenuLabel: 'Leave Game to Menu',
    onLeaveApp: () => {
      void backgroundMusicManager.fadeOutCurrent(500).finally(() => {
        void quitApplication();
      });
    },
  });
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize sound manager first
    await initSoundManagerAsync();
    await backgroundMusicManager.play('gameplay', { fadeInMs: 1600 });
    setupOptionsMenu();
    
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
