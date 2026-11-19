import { GameCard } from '@/game/Card';
import { convertToComparable } from '@/data/scoring';
import { AI_DIFFICULTY, GameDifficulty } from '@/data/aiDifficulty';
import { SoundType } from '@/utils/soundManager';
import { logger } from '@/utils/logger';

/**
 * Callbacks for AI manager to interact with game state
 */
export interface AIManagerCallbacks {
  onGetDifficulty: () => GameDifficulty;

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

  /** Discard the incorrect card and deal a replacement to the opponent. */
  onIncorrectPlacement: (card: GameCard) => void;

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

interface AIPlacement {
  x: number;
  isLeft: boolean;
  isCorrect: boolean;
}

/**
 * AI Manager - Handles AI turn logic and card placement
 */
export class AIManager {
  private config: AIManagerConfig;

  private animationInterval: ReturnType<typeof setInterval> | undefined;

  private placementTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor(config: AIManagerConfig) {
    this.config = config;
  }

  /**
   * Play an AI turn at the selected difficulty
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

    const { errorChance } = AI_DIFFICULTY[this.config.callbacks.onGetDifficulty()];
    const placement = this.choosePlacement(aiCard, Math.random() < errorChance);
    this.simulateDrag(aiCard, placement);

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
   * Animate the chosen move from the opponent hand to the axis
   */
  private simulateDrag(aiCard: GameCard, placement: AIPlacement): void {
    // Start drag from opponent hand position
    const startX = aiCard.x;
    const startY = aiCard.y;

    const targetX = placement.x;
    const axisY = this.config.canvas.height / 2;
    const targetY = axisY - aiCard.height / 2;

    logger.info({
      scope: 'renderer/ai',
      msg: 'AI chose a card position',
      meta: {
        cardTitle: aiCard.card.title,
        cardValue: aiCard.card.value,
        cardUnit: aiCard.card.unit,
        startX,
        startY,
        targetX,
        targetY,
        isCorrect: placement.isCorrect,
      },
    });

    // Simulate picking up card from hand
    aiCard.startDrag(startX, startY);

    // Animate card from hand to the chosen position
    const animationDuration = 800; // 800ms to move from hand to target
    const animationSteps = 40; // 40 steps for smooth animation
    const stepDuration = animationDuration / animationSteps;

    // Calculate when to start showing the preview (when card is 30% through animation)
    const previewStartStep = Math.floor(animationSteps * 0.3);
    let previewShown = false;

    let step = 0;
    this.animationInterval = setInterval(() => {
      // Interpolate from hand position to target position
      const progress = (step + 1) / animationSteps;
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
        clearInterval(this.animationInterval);
        this.animationInterval = undefined;
        this.placeCard(aiCard, placement);
      }
    }, stepDuration);
  }

  private placeCard(aiCard: GameCard, { x, isLeft, isCorrect }: AIPlacement): void {
    aiCard.stopDrag();
    this.config.callbacks.onCardRemovedFromHand(aiCard);
    this.config.callbacks.onLayoutOpponentHand();
    this.config.callbacks.onCardPlaced(aiCard, isLeft);
    aiCard.isInHand = false;
    this.config.callbacks.onPlaySound(SoundType.CARD_PLACE);

    this.placementTimeout = setTimeout(() => {
      this.placementTimeout = undefined;
      if (!isCorrect) {
        aiCard.setIncorrect();
        this.config.callbacks.onPlaySound(SoundType.ERROR);
        this.placementTimeout = setTimeout(() => {
          this.placementTimeout = undefined;
          this.config.callbacks.onHidePreview();
          this.config.callbacks.onIncorrectPlacement(aiCard);
          this.config.callbacks.onLayoutAxisCards();
          this.config.callbacks.onTurnComplete();
        }, 2000);
        return;
      }

      this.config.callbacks.onHidePreview();
      this.config.callbacks.onLayoutAxisCards();
      this.config.callbacks.onCardSetCorrect(aiCard);
      this.config.callbacks.onPlaySound(SoundType.SUCCESS);
      this.config.callbacks.onCheckWin();
      this.config.callbacks.onTurnComplete();
      logger.info({
        scope: 'renderer/ai',
        msg: 'AI card placed successfully',
        meta: { cardTitle: aiCard.card.title, x, isLeft },
      });
    }, 400);
  }

  private choosePlacement(card: GameCard, attemptError: boolean): AIPlacement {
    const { boardCard, placedLeft, placedRight } = this.config.callbacks.onGetBoardCards();
    const board = [...placedLeft, ...(boardCard ? [boardCard] : []), ...placedRight]
      .map((placed) => ({ placed, value: convertToComparable(placed.card.value, placed.card.unit) }))
      .sort((a, b) => a.value - b.value);
    const value = convertToComparable(card.card.value, card.card.unit);

    // Any gap between the lower and upper bounds is valid, including ties.
    const firstGreater = board.findIndex((entry) => entry.value > value);
    const correctGap = firstGreater === -1 ? board.length : firstGreater;
    let gap = correctGap;
    if (attemptError) {
      // The gap after the first greater value is one step from the chosen valid gap.
      // At the right edge, skip equal values to find the nearest strictly smaller card.
      const wrongGap = correctGap < board.length
        ? correctGap + 1
        : board.filter((entry) => entry.value < value).length - 1;
      if (wrongGap >= 0) gap = wrongGap;
    }

    const spacing = 5 * this.config.scale;
    const totalWidth = (board.length + 1) * card.width + board.length * spacing;
    const startX = (this.config.canvas.width - totalWidth) / 2;
    const boardIndex = board.findIndex((entry) => entry.placed === boardCard);
    return {
      x: startX + gap * (card.width + spacing),
      isLeft: boardIndex >= 0 && gap <= boardIndex,
      isCorrect: gap === correctGap,
    };
  }

  public cancelTurn(): void {
    clearInterval(this.animationInterval);
    clearTimeout(this.placementTimeout);
    this.animationInterval = undefined;
    this.placementTimeout = undefined;
    this.config.callbacks.onHidePreview();
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<AIManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
