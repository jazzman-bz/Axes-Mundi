import { GameCard } from '@/game/Card';
import { convertToComparable } from '@/data/scoring';
import { logger } from '@/utils/logger';

/**
 * Layout configuration
 */
export interface LayoutConfig {
  /** Scale factor */
  scale: number;
  /** Canvas width */
  canvasWidth: number;
  /** Canvas height */
  canvasHeight: number;
  /** Card spacing for hands (default: 220) */
  cardSpacing?: number;
  /** Card width (default: 200) */
  cardWidth?: number;
  /** Axis spacing between cards (default: 5) */
  axisSpacing?: number;
}

/**
 * Position result for a card
 */
export interface CardPosition {
  x: number;
  y: number;
}

/**
 * Calculate hand layout positions
 * @param cardCount - Number of cards in hand
 * @param config - Layout configuration
 * @param position - 'top' or 'bottom' (default: 'bottom')
 * @returns Array of positions for each card
 */
export function calculateHandLayout(
  cardCount: number,
  config: LayoutConfig,
  position: 'top' | 'bottom' = 'bottom',
): CardPosition[] {
  const {
    scale,
    canvasWidth,
    canvasHeight,
    cardSpacing = 220,
  } = config;

  if (cardCount === 0) {
    return [];
  }

  const spacing = cardSpacing * scale;
  const totalWidth = cardCount * spacing - 20 * scale;
  const startX = (canvasWidth - totalWidth) / 2;

  const y = position === 'bottom'
    ? canvasHeight - 320 * scale
    : 20 * scale;

  const positions: CardPosition[] = [];
  for (let i = 0; i < cardCount; i++) {
    positions.push({
      x: startX + i * spacing,
      y,
    });
  }

  return positions;
}

/**
 * Calculate axis layout positions for cards
 * @param cards - Array of cards to layout (will be sorted by value)
 * @param config - Layout configuration
 * @returns Array of positions for each card (sorted by value)
 */
export function calculateAxisLayout(
  cards: GameCard[],
  config: LayoutConfig,
): { card: GameCard; position: CardPosition }[] {
  const {
    scale,
    canvasWidth,
    canvasHeight,
    cardWidth = 200,
    axisSpacing = 5,
  } = config;

  if (cards.length === 0) {
    return [];
  }

  // Sort cards by their axis value
  const sortedCards = [...cards].sort((a, b) => {
    const aValue = convertToComparable(a.card.value, a.card.unit);
    const bValue = convertToComparable(b.card.value, b.card.unit);
    return aValue - bValue;
  });

  // Calculate spacing
  const spacing = axisSpacing * scale;
  const cardWidthScaled = cardWidth * scale;
  const totalWidth = sortedCards.length * cardWidthScaled + (sortedCards.length - 1) * spacing;
  const startX = (canvasWidth - totalWidth) / 2;
  const axisY = canvasHeight / 2;

  return sortedCards.map((card, index) => ({
    card,
    position: {
      x: startX + index * (cardWidthScaled + spacing),
      y: axisY - card.height / 2,
    },
  }));
}

/**
 * Card layout manager
 */
export class CardLayoutManager {
  private config: LayoutConfig;

  constructor(config: LayoutConfig) {
    this.config = config;
  }

  /**
   * Update layout configuration
   */
  updateConfig(config: Partial<LayoutConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): LayoutConfig {
    return { ...this.config };
  }

  /**
   * Layout hand cards
   * @param cards - Array of cards to layout
   * @param position - 'top' or 'bottom'
   */
  layoutHand(cards: GameCard[], position: 'top' | 'bottom' = 'bottom'): void {
    const positions = calculateHandLayout(cards.length, this.config, position);

    cards.forEach((card, index) => {
      const pos = positions[index];
      if (pos) {
        card.setTargetPosition(pos.x, pos.y);
      }
    });
  }

  /**
   * Layout axis cards
   * @param cards - Array of cards to layout (will be sorted)
   */
  layoutAxis(cards: GameCard[]): void {
    if (cards.length === 0) {
      return;
    }

    const layout = calculateAxisLayout(cards, this.config);

    layout.forEach(({ card, position }) => {
      card.setTargetPosition(position.x, position.y);
    });
  }

  /**
   * Update scale for all cards
   * @param cards - Array of all cards to update
   */
  updateScale(cards: GameCard[]): void {
    cards.forEach((card) => {
      card.updateScale(this.config.scale);
    });
  }
}

/**
 * Graveyard management utilities
 */

/**
 * Extract card data from GameCard objects
 * @param gameCards - Array of GameCard objects
 * @returns Array of card data
 */
export function extractCardData<TCard>(
  gameCards: Array<{ card: TCard }>,
): TCard[] {
  return gameCards.map((gameCard) => gameCard.card);
}

/**
 * Recycle graveyard cards to deck
 * @param graveyard - Array of GameCard objects in graveyard
 * @param deck - Array of card data to add to
 * @returns New deck array with graveyard cards added
 */
export function recycleGraveyard<TCard>(
  graveyard: Array<{ card: TCard }>,
  deck: TCard[],
): TCard[] {
  if (graveyard.length === 0) {
    return [...deck]; // Return new array even if empty
  }

  const graveyardCardData = extractCardData(graveyard);

  logger.info({
    scope: 'utils/cardLayout',
    msg: 'recycling graveyard cards to deck',
    meta: {
      graveyardSize: graveyard.length,
      deckSizeBefore: deck.length,
      deckSizeAfter: deck.length + graveyardCardData.length,
    },
  });

  return [...deck, ...graveyardCardData];
}
