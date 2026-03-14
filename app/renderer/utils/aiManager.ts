import { GameCard } from '@/game/Card';
import { convertToComparable } from '@/data/scoring';
import { SoundType } from '@/utils/soundManager';
import { logger } from '@/utils/logger';

/**
 * Callbacks for AI manager to interact with game state
 */
export interface AIManagerCallbacks {
  /** Get current board cards for position calculation */
  onGetBoardCards: () => {
    boardCard: GameCard | null;
    placedLeft: GameCard[];
    placedRight: GameCard[];
  };

  /** Remove card from opponent hand */
  onCardRemovedFromHand: (card: GameCard) => void;

  /** Layout opponent hand after card removal */
  onLayoutOpponentHand: () => void;

  /** Add card to placed arrays */
  onCardPlaced: (card: GameCard, isLeft: boolean) => void;

  /** Layout axis cards after placement */
  onLayoutAxisCards: () => void;

  /** Mark card as correct */
  onCardSetCorrect: (card: GameCard) => void;

  /** Switch back to player turn */
  onTurnComplete: () => void;

  /** Check for win condition */
  onCheckWin: () => void;

  /** Start player turn timer */
  onStartTurnTimer: () => void;

  /** Show preview at position */
  onShowPreview: (x: number) => void;

  /** Hide preview */
  onHidePreview: () => void;

  /** Play sound effect */
  onPlaySound: (soundType: SoundType) => void;
}

/**
 * Configuration for AI Manager
 */
export interface AIManagerConfig {
  /** Canvas element for size calculations */
  canvas: HTMLCanvasElement;

  /** Scale factor for card sizing */
  scale: number;

  /** Whether learning mode is active (AI should not play) */
  isLearningMode: boolean;

  /** Callbacks for game state interaction */
  callbacks: AIManagerCallbacks;
}

/**
 * AI Manager - Handles AI turn logic and card placement
 */
export class AIManager {
  private config: AIManagerConfig;

  constructor(config: AIManagerConfig) {
    this.config = config;
  }

  /**
   * Play AI turn - selects a card and places it correctly
   * @param opponentHand - Array of cards in AI's hand
   * @param isAITurnInProgress - Flag to prevent multiple turns
   * @returns true if turn was started, false if skipped
   */
  public playTurn(
    opponentHand: GameCard[],
    isAITurnInProgress: boolean,
  ): boolean {
    // Don't play AI turn in learning mode
    if (this.config.isLearningMode) {
      logger.info({
        scope: 'renderer/ai',
        msg: 'AI turn skipped in learning mode',
        meta: { isLearningMode: true },
      });
      return false;
    }

    // Prevent multiple AI turns from running simultaneously
    if (isAITurnInProgress) {
      logger.warn({
        scope: 'renderer/ai',
        msg: 'AI turn already in progress, skipping duplicate call',
        meta: { opponentHandSize: opponentHand.length },
      });
      return false;
    }

    logger.info({
      scope: 'renderer/ai',
      msg: 'playAITurn called',
      meta: { opponentHandSize: opponentHand.length },
    });

    if (opponentHand.length === 0) {
      // AI has no cards, skip turn
      logger.warn({
        scope: 'renderer/ai',
        msg: 'AI has no cards, skipping turn',
        meta: { opponentHandSize: opponentHand.length },
      });
      return false;
    }

    // AI randomly selects a card from hand
    const randomIndex = Math.floor(Math.random() * opponentHand.length);
    const aiCard = opponentHand[randomIndex];

    // Simulate player drag mechanics - find correct position by scanning
    this.simulateDrag(aiCard);

    logger.info({
      scope: 'renderer/ai',
      msg: 'AI starting drag simulation',
      meta: {
        cardTitle: aiCard.card.title,
      },
    });

    return true;
  }

  /**
   * Simulate AI drag to find correct position - animates directly to the correct position
   */
  private simulateDrag(aiCard: GameCard): void {
    // Start drag from opponent hand position
    const startX = aiCard.x;
    const startY = aiCard.y;

    // Calculate the correct target position directly (no scanning needed)
    const targetX = this.findCorrectPosition(aiCard);
    const axisY = this.config.canvas.height / 2;
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
        this.config.callbacks.onShowPreview(targetX + aiCard.width / 2);
        previewShown = true;
      } else if (previewShown) {
        // Update preview position as card moves
        this.config.callbacks.onShowPreview(currentX + aiCard.width / 2);
      }

      step++;
      if (step >= animationSteps) {
        clearInterval(animationInterval);

        // DON'T hide preview here - let the card be placed into the open space
        // The preview will be cleared when layoutAxisCards() is called after placement

        // Place the card at the correct position (into the open space)
        this.placeCard(aiCard, targetX, axisY);
      }
    }, stepDuration);
  }

  /**
   * Place AI card at the calculated correct position
   */
  private placeCard(aiCard: GameCard, x: number, y: number): void {
    // Stop dragging
    aiCard.stopDrag();

    // The card is now at its position in the gap created by the preview
    // DON'T set target position yet - let the card stay where it is

    // Immediately update game state (no delay - card is already in position)
    // Remove the specific card from opponent hand
    this.config.callbacks.onCardRemovedFromHand(aiCard);
    this.config.callbacks.onLayoutOpponentHand();

    // Add to appropriate array based on card value (not position)
    // Determine left/right by comparing card value to board card value
    const boardCards = this.config.callbacks.onGetBoardCards();
    const aiCardValue = convertToComparable(aiCard.card.value, aiCard.card.unit);
    const boardCardValue = boardCards.boardCard
      ? convertToComparable(boardCards.boardCard.card.value, boardCards.boardCard.card.unit)
      : 0;
    const isLeft = aiCardValue < boardCardValue;

    // Play card placement sound for AI
    this.config.callbacks.onPlaySound(SoundType.CARD_PLACE);

    // Add card to appropriate side
    this.config.callbacks.onCardPlaced(aiCard, isLeft);
    aiCard.isInHand = false;

    // Small delay to show the card in position, then re-center all cards smoothly
    setTimeout(() => {
      // Clear preview positions before re-centering
      this.config.callbacks.onHidePreview();

      // Center all cards (including the newly placed AI card)
      this.config.callbacks.onLayoutAxisCards();

      // Mark card as correct and play success sound
      this.config.callbacks.onCardSetCorrect(aiCard);
      setTimeout(() => {
        this.config.callbacks.onPlaySound(SoundType.SUCCESS);
      }, 300); // Small delay after placement sound

      // Switch back to player turn
      this.config.callbacks.onTurnComplete();

      // Check for AI win
      this.config.callbacks.onCheckWin();

      logger.info({
        scope: 'renderer/ai',
        msg: 'AI card placed successfully',
        meta: {
          cardTitle: aiCard.card.title,
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
    const boardCards = this.config.callbacks.onGetBoardCards();
    const allCards = [
      boardCards.boardCard,
      ...boardCards.placedLeft,
      ...boardCards.placedRight,
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
    const cardWidth = 200 * this.config.scale;
    const spacing = 5 * this.config.scale;
    const totalWidth = sortedCards.length * cardWidth + (sortedCards.length - 1) * spacing;
    const startX = (this.config.canvas.width - totalWidth) / 2;

    return startX + cardIndex * (cardWidth + spacing);
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<AIManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
