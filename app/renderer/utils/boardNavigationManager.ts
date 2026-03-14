import { GameCard } from '@/game/Card';
import { logger } from '@/utils/logger';

/**
 * Callbacks for BoardNavigationManager to interact with game state
 */
export interface BoardNavigationManagerCallbacks {
  // State getters
  onGetBoardCards: () => {
    boardCard: GameCard | null;
    placedLeft: GameCard[];
    placedRight: GameCard[];
  };

  onGetScale: () => number;
}

/**
 * Configuration for BoardNavigationManager
 */
export interface BoardNavigationManagerConfig {
  callbacks: BoardNavigationManagerCallbacks;
}

/**
 * BoardNavigationManager - Handles board navigation and card movement
 */
export class BoardNavigationManager {
  private config: BoardNavigationManagerConfig;

  constructor(config: BoardNavigationManagerConfig) {
    this.config = config;
  }

  /**
   * Move all board cards one card width to the left
   */
  public moveBoardCardsLeft(): void {
    const scale = this.config.callbacks.onGetScale();
    const cardWidth = 200 * scale;
    const spacing = 5 * scale;
    const moveDistance = cardWidth + spacing;

    const boardCards = this.config.callbacks.onGetBoardCards();

    // Move board card
    if (boardCards.boardCard) {
      const newX = boardCards.boardCard.x + moveDistance;
      boardCards.boardCard.setTargetPosition(newX, boardCards.boardCard.y);
    }

    // Move placed left cards
    for (const card of boardCards.placedLeft) {
      const newX = card.x + moveDistance;
      card.setTargetPosition(newX, card.y);
    }

    // Move placed right cards
    for (const card of boardCards.placedRight) {
      const newX = card.x + moveDistance;
      card.setTargetPosition(newX, card.y);
    }

    logger.info({
      scope: 'renderer/navigation',
      msg: 'board cards moved left',
      meta: {
        moveDistance,
        totalCards: (boardCards.boardCard ? 1 : 0) + boardCards.placedLeft.length + boardCards.placedRight.length,
      },
    });
  }

  /**
   * Move all board cards one card width to the right
   */
  public moveBoardCardsRight(): void {
    const scale = this.config.callbacks.onGetScale();
    const cardWidth = 200 * scale;
    const spacing = 5 * scale;
    const moveDistance = cardWidth + spacing;

    const boardCards = this.config.callbacks.onGetBoardCards();

    // Move board card
    if (boardCards.boardCard) {
      const newX = boardCards.boardCard.x - moveDistance;
      boardCards.boardCard.setTargetPosition(newX, boardCards.boardCard.y);
    }

    // Move placed left cards
    for (const card of boardCards.placedLeft) {
      const newX = card.x - moveDistance;
      card.setTargetPosition(newX, card.y);
    }

    // Move placed right cards
    for (const card of boardCards.placedRight) {
      const newX = card.x - moveDistance;
      card.setTargetPosition(newX, card.y);
    }

    logger.info({
      scope: 'renderer/navigation',
      msg: 'board cards moved right',
      meta: {
        moveDistance,
        totalCards: (boardCards.boardCard ? 1 : 0) + boardCards.placedLeft.length + boardCards.placedRight.length,
      },
    });
  }
}
