import { Deck, Card } from './types';
import { logger } from '@/utils/logger';

/**
 * Extended Deck interface with user deck flag
 */
export interface ExtendedDeck extends Deck {
  isUserDeck?: boolean;
}

/**
 * Load deck from JSON file
 * First tries bundled decks, then falls back to user-imported decks via IPC
 */
export async function loadDeck(deckId: string): Promise<ExtendedDeck> {
  // First try to load from bundled decks
  try {
    const response = await fetch(`./decks/${deckId}.json`);
    if (response.ok) {
      const deck: ExtendedDeck = await response.json();
      deck.isUserDeck = false;

      logger.info({
        scope: 'data/deckLoader',
        msg: 'deck loaded successfully from bundled decks',
        meta: { deckId, cardCount: deck.cards.length, source: 'bundled' },
      });

      return deck;
    }
  } catch (fetchError) {
    // Fetch failed (e.g., file:// protocol ERR_FILE_NOT_FOUND in production)
    // Fall through to try user decks via IPC
    logger.debug({
      scope: 'data/deckLoader',
      msg: 'bundled deck fetch failed, will try user decks',
      meta: { deckId },
    });
  }

  // If bundled deck not found, try user decks via IPC
  logger.info({
    scope: 'data/deckLoader',
    msg: 'bundled deck not found, trying user decks',
    meta: { deckId },
  });

  // Check if AXM API is available (running in Electron)
  if (window.AXM && window.AXM.loadUserDeck) {
    const result = await window.AXM.loadUserDeck(deckId);
    
    if (result.success && result.deck) {
      const deck: ExtendedDeck = result.deck;
      deck.isUserDeck = true;

      logger.info({
        scope: 'data/deckLoader',
        msg: 'deck loaded successfully from user decks',
        meta: { deckId, cardCount: deck.cards.length, source: 'user' },
      });

      return deck;
    }
  }

  throw new Error(`Deck not found: ${deckId}`);
}

/**
 * Shuffle array of cards
 */
export function shuffleCards(cards: Card[]): Card[] {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Shuffle array of cards in-place (mutates the array)
 * @param cards - Array of cards to shuffle
 */
export function shuffleCardsInPlace(cards: Card[]): void {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
}

/**
 * Deal cards to players
 */
export function dealCards(deck: Deck, handSize: number = 5): {
  playerHand: Card[];
  remainingCards: Card[];
} {
  const shuffledCards = shuffleCards(deck.cards);
  const playerHand = shuffledCards.slice(0, handSize);
  const remainingCards = shuffledCards.slice(handSize);

  logger.info({
    scope: 'data/deckLoader',
    msg: 'cards dealt',
    meta: { handSize, remainingCount: remainingCards.length },
  });

  return { playerHand, remainingCards };
}

/**
 * Get a random card for the board
 */
export function getRandomBoardCard(deck: Deck): Card {
  const randomIndex = Math.floor(Math.random() * deck.cards.length);
  const card = deck.cards[randomIndex];

  logger.info({
    scope: 'data/deckLoader',
    msg: 'random board card selected',
    meta: { cardId: card.id, cardTitle: card.title },
  });

  return card;
}
