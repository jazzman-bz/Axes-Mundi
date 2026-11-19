import { GameCard } from '@/game/Card';
import { logger } from '@/utils/logger';

/**
 * Callbacks for input events
 */
export interface InputHandlerCallbacks {
  /** Called when a card is selected (mouse down on card) */
  onCardSelected?: (card: GameCard) => void;

  /** Called when a card is placed on the axis */
  onCardPlaced?: (card: GameCard, x: number, y: number, isLeft: boolean, isFirstCard: boolean) => void;

  /** Called when a card is returned to hand (released outside axis) */
  onCardReturnedToHand?: (card: GameCard) => void;

  /** Called when Weiter button is clicked */
  onWeiterButtonClick?: () => void;

  /** Called when Clear Board button is clicked */
  onClearBoardButtonClick?: () => void;

  /** Called when Reset Game button is clicked */
  onResetGameButtonClick?: () => void;

  /** Called when navigation arrow is clicked */
  onNavigationArrowClick?: (direction: 'left' | 'right') => void;

  /** Called when player switch overlay is clicked */
  onPlayerSwitchOverlayClick?: () => void;

  /** Called when a card is removed (learning mode) */
  onCardRemoved?: (card: GameCard) => void;

  /** Called when tooltip hover changes */
  onTooltipHover?: (card: GameCard | null) => void;

  /** Get current board cards for preview system */
  onGetBoardCards?: () => {
    boardCard: GameCard | null;
    placedLeft: GameCard[];
    placedRight: GameCard[];
  };

  /** Get current player hands for card selection */
  onGetPlayerHands?: () => {
    playerHand: GameCard[];
    currentPlayerHand?: GameCard[];
    nextPlayerHand?: GameCard[];
  };

  /** Get button bounds for click detection */
  onGetButtonBounds?: () => {
    weiterButtonBounds?: { x: number; y: number; width: number; height: number } | null;
    clearBoardButtonBounds?: { x: number; y: number; width: number; height: number } | null;
    resetGameButtonBounds?: { x: number; y: number; width: number; height: number } | null;
    playerSwitchOverlayBounds?: { x: number; y: number; width: number; height: number } | null;
  };

  /** Get total board card count */
  onGetBoardCardCount?: () => number;

  /** Check if there's an incorrect card on board */
  onHasIncorrectCard?: () => boolean;

  /** Find incorrect card on board */
  onFindIncorrectCard?: () => GameCard | null;

  /** Optional structured logger passthrough */
  onLog?: (level: 'debug' | 'info' | 'warn' | 'error', scope: string, msg: string, meta?: Record<string, unknown>) => void;
}

/**
 * Configuration for InputHandler
 */
export interface InputHandlerConfig {
  canvas: HTMLCanvasElement;
  scale: number;
  snapThreshold: number;
  isLearningMode: boolean;
  isHotseatMode: boolean;
  isPlayerTurn: boolean;
  gameWon: boolean;
  gameLost: boolean;
  playerSwitchOverlayVisible: boolean;
  callbacks: InputHandlerCallbacks;
}

/**
 * Input handler for mouse events
 */
export class InputHandler {
  private canvas: HTMLCanvasElement;

  private config: InputHandlerConfig;

  private selectedCard: GameCard | null = null;

  private isDragging: boolean = false;

  private isPreviewActive: boolean = false;

  private lastPreviewX: number = 0;

  private boundHandlers: {
    mousedown?: (e: MouseEvent) => void;
    mousemove?: (e: MouseEvent) => void;
    mouseup?: (e: MouseEvent) => void;
    click?: (e: MouseEvent) => void;
  } = {};

  private isAttached: boolean = false;

  constructor(config: InputHandlerConfig) {
    this.canvas = config.canvas;
    this.config = config;
  }

  /**
   * Attach event listeners
   */
  attach(): void {
    if (this.isAttached) {
      logger.warn({ scope: 'utils/inputHandler', msg: 'already attached' });
      return;
    }

    this.boundHandlers.mousedown = this.handleMouseDown.bind(this);
    this.boundHandlers.mousemove = this.handleMouseMove.bind(this);
    this.boundHandlers.mouseup = this.handleMouseUp.bind(this);
    this.boundHandlers.click = this.handleCanvasClick.bind(this);

    this.canvas.addEventListener('mousedown', this.boundHandlers.mousedown);
    window.addEventListener('mousemove', this.boundHandlers.mousemove);
    window.addEventListener('mouseup', this.boundHandlers.mouseup);
    this.canvas.addEventListener('click', this.boundHandlers.click);

    this.isAttached = true;

    logger.debug({ scope: 'utils/inputHandler', msg: 'event listeners attached' });
  }

  /**
   * Detach event listeners
   */
  detach(): void {
    if (!this.isAttached) return;

    if (this.boundHandlers.mousedown) {
      this.canvas.removeEventListener('mousedown', this.boundHandlers.mousedown);
    }
    if (this.boundHandlers.mousemove) {
      window.removeEventListener('mousemove', this.boundHandlers.mousemove);
    }
    if (this.boundHandlers.mouseup) {
      window.removeEventListener('mouseup', this.boundHandlers.mouseup);
    }
    if (this.boundHandlers.click) {
      this.canvas.removeEventListener('click', this.boundHandlers.click);
    }

    this.boundHandlers = {};
    this.isAttached = false;

    logger.debug({ scope: 'utils/inputHandler', msg: 'event listeners detached' });
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<InputHandlerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Show axis preview (public method for external calls, e.g., AI)
   */
  showPreview(previewX: number): void {
    this.showAxisPreview(previewX);
  }

  /**
   * Hide axis preview (public method for external calls)
   */
  hidePreview(): void {
    this.hideAxisPreview();
  }

  /**
   * Destroy handler and clean up
   */
  destroy(): void {
    this.detach();
    this.selectedCard = null;
    this.isDragging = false;
    this.hideAxisPreview();
  }

  /**
   * Handle mouse down
   */
  private handleMouseDown(event: MouseEvent): void {
    // Only allow interaction during player turn
    // In learning mode, ignore win/lose conditions
    if (!this.config.isPlayerTurn || (!this.config.isLearningMode && (this.config.gameWon || this.config.gameLost))) {
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Get player hands
    const hands = this.config.callbacks.onGetPlayerHands?.();
    if (!hands) return;

    // Check player hand cards
    if (this.config.isHotseatMode && hands.currentPlayerHand) {
      // Check current player hand in hotseat mode
      for (const card of hands.currentPlayerHand) {
        if (card.containsPoint(x, y)) {
          this.selectedCard = card;
          card.startDrag(x, y);
          this.isDragging = true;
          this.config.callbacks.onCardSelected?.(card);
          break;
        }
      }
    } else {
      // Check standard player hand in normal mode
      for (const card of hands.playerHand) {
        if (card.containsPoint(x, y)) {
          this.selectedCard = card;
          card.startDrag(x, y);
          this.isDragging = true;
          this.config.callbacks.onCardSelected?.(card);
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
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      this.selectedCard.updateDrag(x, y);

      // Show preview of where card would be placed on axis
      this.showPlacementPreview(x, y);
    } else {
      // Handle hover effects for hand cards
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      this.handleHover(x, y);
    }
  }

  /**
   * Handle hover effects
   */
  private handleHover(x: number, y: number): void {
    const boardCards = this.config.callbacks.onGetBoardCards?.();
    if (boardCards) {
      // Clear hover on non-hand groups
      if (boardCards.boardCard) boardCards.boardCard.isHovered = false;
      for (const c of boardCards.placedLeft) c.isHovered = false;
      for (const c of boardCards.placedRight) c.isHovered = false;
    }

    // Get player hands
    const hands = this.config.callbacks.onGetPlayerHands?.();
    if (!hands) return;

    // Reset hover on hand
    if (this.config.isHotseatMode && hands.currentPlayerHand && hands.nextPlayerHand) {
      // Reset hover on hotseat hands
      for (const c of hands.currentPlayerHand) c.isHovered = false;
      for (const c of hands.nextPlayerHand) c.isHovered = false;

      // Set hover for current player hand card under mouse
      for (const card of hands.currentPlayerHand) {
        if (card.containsPoint(x, y)) {
          card.isHovered = true;
          break;
        }
      }
    } else {
      // Reset hover on standard hand
      for (const c of hands.playerHand) c.isHovered = false;

      // Set hover for hand card under mouse
      for (const card of hands.playerHand) {
        if (card.containsPoint(x, y)) {
          card.isHovered = true;
          break;
        }
      }
    }

    // Learning mode: handle tooltip hover for placed cards
    if (this.config.isLearningMode) {
      this.handleTooltipHover(x, y);
    }
  }

  /**
   * Handle tooltip hover for learning mode
   */
  private handleTooltipHover(mouseX: number, mouseY: number): void {
    const boardCards = this.config.callbacks.onGetBoardCards?.();
    if (!boardCards) return;

    // Check if hovering over placed cards (left or right side)
    let hoveredCard: GameCard | null = null;

    // Check left side cards
    for (const card of boardCards.placedLeft) {
      if (card.containsPoint(mouseX, mouseY)) {
        hoveredCard = card;
        break;
      }
    }

    // Check right side cards
    if (!hoveredCard) {
      for (const card of boardCards.placedRight) {
        if (card.containsPoint(mouseX, mouseY)) {
          hoveredCard = card;
          break;
        }
      }
    }

    // Check center board card
    if (!hoveredCard && boardCards.boardCard && boardCards.boardCard.containsPoint(mouseX, mouseY)) {
      hoveredCard = boardCards.boardCard;
    }

    // Notify callback
    this.config.callbacks.onTooltipHover?.(hoveredCard);
  }

  /**
   * Show preview of where card would be placed on axis
   */
  private showPlacementPreview(mouseX: number, mouseY: number): void {
    // Use the CARD's position, not mouse position, for more intuitive dragging
    if (!this.selectedCard) return;

    const axisY = this.canvas.height / 2;
    const cardHeight = this.selectedCard.height;

    // Board cards bottom edge (cards are centered on axis)
    const boardCardsBottom = axisY + cardHeight / 2;

    // Dragged card top edge
    const draggedCardTop = this.selectedCard.y;

    // Trigger preview when card's TOP reaches board cards' BOTTOM
    const isNearAxis = draggedCardTop <= boardCardsBottom;

    logger.debug({
      scope: 'utils/inputHandler',
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
   * Show axis preview by spreading cards
   * Updates dynamically as the dragged card moves along the axis
   */
  private showAxisPreview(previewX: number): void {
    const boardCards = this.config.callbacks.onGetBoardCards?.();
    if (!boardCards || !boardCards.boardCard) return;

    // Update if preview position changed significantly (allows dynamic updates)
    if (this.isPreviewActive && Math.abs(previewX - this.lastPreviewX) < 20) {
      return;
    }

    this.lastPreviewX = previewX;

    // Combine all cards in their current order (board + left + right)
    const allCards = [
      boardCards.boardCard,
      ...boardCards.placedLeft,
      ...boardCards.placedRight,
    ];

    if (allCards.length === 0) return;

    // Spread distance - how far cards move apart
    const spreadDistance = 30 * this.config.scale;

    // Find where the new card would be inserted
    // Sort cards by their current X position
    const sortedCards = [...allCards].sort((a, b) => a.x - b.x);

    // Find insertion point
    let insertIndex = sortedCards.length;
    for (let i = 0; i < sortedCards.length; i++) {
      const cardCenterX = sortedCards[i].x + sortedCards[i].width / 2;
      if (previewX < cardCenterX) {
        insertIndex = i;
        break;
      }
    }

    // Spread cards: cards before insertion point move left, cards after move right
    for (let i = 0; i < sortedCards.length; i++) {
      const card = sortedCards[i];
      const originalX = card.getOriginalX();
      const originalY = card.getOriginalY();

      if (i < insertIndex) {
        // Move left
        card.setPreviewPosition(originalX - spreadDistance, originalY);
      } else {
        // Move right
        card.setPreviewPosition(originalX + spreadDistance, originalY);
      }
    }

    // Mark preview as active
    this.isPreviewActive = true;
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
      scope: 'utils/inputHandler',
      msg: 'hiding axis preview',
    });

    const boardCards = this.config.callbacks.onGetBoardCards?.();
    if (boardCards) {
      if (boardCards.boardCard) boardCards.boardCard.clearPreviewPosition();
      for (const card of boardCards.placedLeft) card.clearPreviewPosition();
      for (const card of boardCards.placedRight) card.clearPreviewPosition();
    }

    // Mark preview as inactive
    this.isPreviewActive = false;
    this.lastPreviewX = 0;
  }

  /**
   * Handle mouse up
   */
  private handleMouseUp(_event: MouseEvent): void {
    if (this.isDragging && this.selectedCard) {
      // Snap logic: if released near axis, place left/right of center
      const releasedCard = this.selectedCard;
      releasedCard.stopDrag();

      const axisY = this.canvas.height / 2;
      const distToAxis = Math.abs((releasedCard.y + releasedCard.height / 2) - axisY);
      if (distToAxis <= this.config.snapThreshold) {
        // SNAP: Snap to axis at exact position
        const snapX = releasedCard.x + releasedCard.width / 2; // Use the exact X position where card was dropped
        const snapY = axisY - releasedCard.height / 2;

        // Determine if it's the first card
        const boardCards = this.config.callbacks.onGetBoardCards?.();
        const isFirstCard = !boardCards?.boardCard;

        // Determine if it's left or right of center
        let isLeft = false;
        if (boardCards?.boardCard) {
          const boardCenterX = boardCards.boardCard.getOriginalX() + boardCards.boardCard.width / 2;
          isLeft = snapX < boardCenterX;
        }

        // Clear any preview positions
        this.hideAxisPreview();

        // Notify callback
        this.config.callbacks.onCardPlaced?.(releasedCard, snapX - releasedCard.width / 2, snapY, isLeft, isFirstCard);
      } else {
        // Card was released outside the axis - return it to hand
        this.hideAxisPreview();
        this.config.callbacks.onCardReturnedToHand?.(releasedCard);
      }

      this.isDragging = false;
      this.selectedCard = null;
    }
  }

  /**
   * Handle canvas click
   */
  private handleCanvasClick(event: MouseEvent): void {
    // Allow clicks if player turn is active OR if hotseat overlay is visible
    // In learning mode or hotseat mode, ignore win/lose conditions
    if ((!this.config.isPlayerTurn && !this.config.playerSwitchOverlayVisible) || (!this.config.isLearningMode && !this.config.isHotseatMode && (this.config.gameWon || this.config.gameLost))) {
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Hotseat mode: handle player switch overlay clicks
    if (this.config.isHotseatMode && this.config.playerSwitchOverlayVisible) {
      const bounds = this.config.callbacks.onGetButtonBounds?.()?.playerSwitchOverlayBounds;
      if (bounds) {
        if (x >= bounds.x && x <= bounds.x + bounds.width
            && y >= bounds.y && y <= bounds.y + bounds.height) {
          this.config.callbacks.onPlayerSwitchOverlayClick?.();
          return;
        }
      }
    }

    // Learning mode: handle card clicks for removal
    if (this.config.isLearningMode) {
      this.handleLearningModeClick(x, y);
    }

    // Check if click is on navigation arrows
    const totalBoardCards = this.config.callbacks.onGetBoardCardCount?.() ?? 0;

    // Only show arrows if more than 5 cards
    if (totalBoardCards > 5) {
      const arrowWidth = 120 * this.config.scale;
      const arrowHeight = 120 * this.config.scale;
      const arrowY = this.canvas.height / 2 - arrowHeight / 2;

      // Left arrow position
      const leftArrowX = 20 * this.config.scale;

      // Right arrow position
      const rightArrowX = this.canvas.width - arrowWidth - 20 * this.config.scale;

      // Check if click is on left arrow
      if (x >= leftArrowX && x <= leftArrowX + arrowWidth
          && y >= arrowY && y <= arrowY + arrowHeight) {
        this.config.callbacks.onNavigationArrowClick?.('left');
        return;
      }

      // Check if click is on right arrow
      if (x >= rightArrowX && x <= rightArrowX + arrowWidth
          && y >= arrowY && y <= arrowY + arrowHeight) {
        this.config.callbacks.onNavigationArrowClick?.('right');
      }
    }
  }

  /**
   * Handle learning mode clicks for card removal and buttons
   */
  private handleLearningModeClick(x: number, y: number): void {
    // Check if there's an incorrect card on the board (Weiter button is showing)
    const hasIncorrectCard = this.config.callbacks.onHasIncorrectCard?.() ?? false;

    // If we have an incorrect card, only allow the "Weiter" button to be clicked
    if (hasIncorrectCard) {
      // Only check for the "Weiter" button - block all other interactions
      const bounds = this.config.callbacks.onGetButtonBounds?.();
      if (bounds?.weiterButtonBounds) {
        const button = bounds.weiterButtonBounds;
        if (x >= button.x && x <= button.x + button.width
             && y >= button.y && y <= button.y + button.height) {
          this.config.callbacks.onWeiterButtonClick?.();
        }
      }
      return; // Block all other interactions when incorrect card is showing
    }

    // Check if click is on the "Clear Board" button (only when no incorrect card)
    const bounds = this.config.callbacks.onGetButtonBounds?.();
    if (bounds?.clearBoardButtonBounds) {
      const button = bounds.clearBoardButtonBounds;
      if (x >= button.x && x <= button.x + button.width
           && y >= button.y && y <= button.y + button.height) {
        this.config.callbacks.onClearBoardButtonClick?.();
        return; // Button click handled, don't process further
      }
    }

    // Check if click is on the "Reset Game" button (only when no incorrect card)
    if (bounds?.resetGameButtonBounds) {
      const button = bounds.resetGameButtonBounds;
      if (x >= button.x && x <= button.x + button.width
           && y >= button.y && y <= button.y + button.height) {
        this.config.callbacks.onResetGameButtonClick?.();
        return; // Button click handled, don't process further
      }
    }

    // Check if clicking on a placed card
    const boardCards = this.config.callbacks.onGetBoardCards?.();
    if (!boardCards) return;

    let clickedCard: GameCard | null = null;

    // Check left side cards
    for (const card of boardCards.placedLeft) {
      if (card.containsPoint(x, y)) {
        clickedCard = card;
        break;
      }
    }

    // Check right side cards
    if (!clickedCard) {
      for (const card of boardCards.placedRight) {
        if (card.containsPoint(x, y)) {
          clickedCard = card;
          break;
        }
      }
    }

    // Check center board card
    if (!clickedCard && boardCards.boardCard && boardCards.boardCard.containsPoint(x, y)) {
      clickedCard = boardCards.boardCard;
    }

    // If a card was clicked, only remove it if it's incorrect
    // Correctly placed cards should NOT be removable by clicking in learning mode
    if (clickedCard && clickedCard.isCorrect === false) {
      this.config.callbacks.onCardRemoved?.(clickedCard);
    } else if (clickedCard && clickedCard.isCorrect === true) {
      // Correctly placed card clicked - do nothing (card should stay on board)
      this.config.callbacks.onLog?.('debug', 'renderer/input', 'correct card clicked in learning mode - ignoring', {
        cardTitle: clickedCard.card.title,
      });
    }
  }
}
