import { Deck, Card } from './types';
import { logger } from '@/utils/logger';

/**
 * Load deck from JSON file
 */
export async function loadDeck(deckId: string): Promise<Deck> {
  try {
    const response = await fetch(`./content/decks/${deckId}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load deck: ${response.statusText}`);
    }
    
    const deck: Deck = await response.json();
    
    logger.info({ 
      scope: 'data/deckLoader', 
      msg: 'deck loaded successfully', 
      meta: { deckId, cardCount: deck.cards.length } 
    });
    
    return deck;
  } catch (error) {
    logger.error({ 
      scope: 'data/deckLoader', 
      msg: 'failed to load deck', 
      meta: { deckId },
      err: { message: error.message, stack: error.stack } 
    });
    throw error;
  }
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
    meta: { handSize, remainingCount: remainingCards.length } 
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
    meta: { cardId: card.id, cardTitle: card.title } 
  });
  
  return card;
}


