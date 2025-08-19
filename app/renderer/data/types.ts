/**
 * Card data structure
 */
export interface Card {
  id: string;
  title: string;
  axis: string;
  value: number;
  unit: string;
  displayValue: string;
  image: string;
  facts: string[];
  sources: Array<{
    label: string;
    url: string;
  }>;
  difficulty: 'easy' | 'medium' | 'hard';
}

/**
 * Deck data structure
 */
export interface Deck {
  id: string;
  name: string;
  axis: string;
  theme: string;
  locale: string;
  version: string;
  cards: Card[];
}

/**
 * Game state
 */
export interface GameState {
  deck: Deck;
  playerHand: Card[];
  boardCards: Card[];
  currentPlayer: number;
  score: number;
  isGameOver: boolean;
}

/**
 * Card position on board
 */
export interface CardPosition {
  x: number;
  y: number;
  card: Card;
}


