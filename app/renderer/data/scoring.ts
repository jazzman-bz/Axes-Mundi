import { Card } from './types';
import { logger } from '@/utils/logger';

/**
 * Check if the entire axis is correctly sorted
 */
export function isAxisCorrectlySorted(allCards: Card[]): boolean {
  try {
    if (allCards.length <= 1) {
      return true; // Single card or no cards is always "sorted"
    }

    // Convert all values to comparable units for comparison
    const cardValues = allCards.map((card) => ({
      card,
      value: convertToComparable(card.value, card.unit),
    }));

    // Check if values are in ascending order
    for (let i = 1; i < cardValues.length; i++) {
      if (cardValues[i].value < cardValues[i - 1].value) {
        logger.info({
          scope: 'data/scoring',
          msg: 'axis not correctly sorted',
          meta: {
            allCards: cardValues.map((cv) => ({ title: cv.card.title, value: cv.value })),
            problemIndex: i,
            problemCard: cardValues[i].card.title,
            previousCard: cardValues[i - 1].card.title,
          },
        });
        return false;
      }
    }

    logger.info({
      scope: 'data/scoring',
      msg: 'axis correctly sorted',
      meta: {
        allCards: cardValues.map((cv) => ({ title: cv.card.title, value: cv.value })),
      },
    });

    return true;
  } catch (error) {
    logger.error({
      scope: 'data/scoring',
      msg: 'failed to check axis sorting',
      err: { message: error.message, stack: error.stack },
    });
    return false;
  }
}

/**
 * Evaluate if a card is correctly placed relative to center card
 */
export function evaluatePlacement(
  placedCard: Card,
  centerCard: Card,
  isLeft: boolean,
): boolean {
  try {
    // Convert all values to comparable units for comparison
    const placedValue = convertToComparable(placedCard.value, placedCard.unit);
    const centerValue = convertToComparable(centerCard.value, centerCard.unit);

    const isCorrect = isLeft
      ? placedValue <= centerValue // Left should be smaller/equal
      : placedValue >= centerValue; // Right should be larger/equal

    logger.info({
      scope: 'data/scoring',
      msg: 'placement evaluated',
      meta: {
        placedCard: placedCard.title,
        centerCard: centerCard.title,
        placedValue,
        centerValue,
        isLeft,
        isCorrect,
      },
    });

    return isCorrect;
  } catch (error) {
    logger.error({
      scope: 'data/scoring',
      msg: 'failed to evaluate placement',
      err: { message: error.message, stack: error.stack },
    });
    return false;
  }
}

/**
 * Convert value to comparable units for sorting
 */
function convertToComparable(value: number, unit: string): number {
  switch (unit.toLowerCase()) {
  // Height units
  case 'm':
    return value;
  case 'km':
    return value * 1000;
  case 'cm':
    return value / 100;
  case 'mm':
    return value / 1000;

    // Time units
  case 'bc':
    // BC values are already negative, so they sort correctly (older = smaller)
    return value;
  case 'ad':
    // AD values are positive, so they sort correctly (newer = larger)
    return value;

    // Temperature units
  case '°c':
  case 'c':
    // Celsius values are already comparable (colder = smaller, hotter = larger)
    return value;

  default:
    // For unknown units, assume they're already in comparable format
    return value;
  }
}

/**
 * Get score for correct placement
 */
export function getScore(card: Card): number {
  switch (card.difficulty) {
  case 'easy':
    return 10;
  case 'medium':
    return 20;
  case 'hard':
    return 30;
  default:
    return 10;
  }
}
