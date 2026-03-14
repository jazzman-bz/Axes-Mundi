import { Card } from '@/data/types';
import { logger } from '@/utils/logger';

/**
 * Game difficulty levels
 */
export type GameDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Game mode types
 */
export type GameMode = 'normal' | 'learning' | 'hotseat';

/**
 * Card dealing configuration
 */
export interface DealConfig {
  /** Number of cards for player */
  playerCount?: number;
  /** Number of cards for opponent (normal mode only) */
  opponentCount?: number;
  /** Game difficulty (affects opponent count) */
  difficulty?: GameDifficulty;
  /** Game mode */
  mode?: GameMode;
}

/**
 * Default card counts per mode
 */
const DEFAULT_COUNTS = {
  normal: { player: 5, opponent: { easy: 7, medium: 6, hard: 5 } },
  learning: { player: 5 },
  hotseat: { player1: 5, player2: 5 },
} as const;

/**
 * Get opponent card count based on difficulty
 * @param difficulty - Game difficulty level
 * @returns Number of cards for opponent
 */
export function getOpponentCardCount(difficulty: GameDifficulty = 'medium'): number {
  return DEFAULT_COUNTS.normal.opponent[difficulty];
}

/**
 * Deal a single card from deck
 * @param deck - Array of remaining cards (will be mutated)
 * @returns Dealt card or null if deck is empty
 */
export function dealCard(deck: Card[]): Card | null {
  if (deck.length === 0) {
    return null;
  }
  return deck.shift()!;
}

/**
 * Deal multiple cards from deck
 * @param deck - Array of remaining cards (will be mutated)
 * @param count - Number of cards to deal
 * @returns Array of dealt cards
 */
export function dealCards(deck: Card[], count: number): Card[] {
  const dealt: Card[] = [];
  for (let i = 0; i < count && deck.length > 0; i++) {
    const card = dealCard(deck);
    if (card) {
      dealt.push(card);
    }
  }
  return dealt;
}

/**
 * Get card counts for a game mode
 * @param mode - Game mode
 * @param difficulty - Game difficulty (for normal mode)
 * @returns Card counts configuration
 */
export function getCardCounts(
  mode: GameMode = 'normal',
  difficulty: GameDifficulty = 'medium',
): { player: number; opponent?: number; player1?: number; player2?: number } {
  switch (mode) {
    case 'learning':
      return { player: DEFAULT_COUNTS.learning.player };
    case 'hotseat':
      return {
        player1: DEFAULT_COUNTS.hotseat.player1,
        player2: DEFAULT_COUNTS.hotseat.player2,
      };
    case 'normal':
    default:
      return {
        player: DEFAULT_COUNTS.normal.player,
        opponent: getOpponentCardCount(difficulty),
      };
  }
}
