import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { getScore } from '@/data/scoring';
import { Card, Deck } from '@/data/types';

const rendererDir = join(__dirname, '../../app/renderer');
const decksDir = join(rendererDir, 'content/decks');
const deckFiles = readdirSync(decksDir).filter((file) => file.endsWith('.json'));
const EXPECTED_POINTS: Record<string, number> = {
  easy: 10, medium: 20, hard: 30, expert: 40,
};

describe('built-in decks', () => {
  it('are served from content/decks only', () => {
    expect(deckFiles.length).toBeGreaterThan(0);
    // A second copy under assets/decks was never loaded and drifted apart.
    expect(existsSync(join(rendererDir, 'assets/decks'))).toBe(false);
  });

  it.each(deckFiles)('%s scores every card by its difficulty', (file) => {
    const deck = JSON.parse(readFileSync(join(decksDir, file), 'utf-8')) as Deck;

    expect(deck.id).toBe(file.replace(/\.json$/, ''));
    expect(new Set(deck.cards.map((card) => card.id)).size).toBe(deck.cards.length);
    deck.cards.forEach((card: Card) => {
      expect(Number.isFinite(card.value), `${card.id} value`).toBe(true);
      expect(EXPECTED_POINTS[card.difficulty], `${card.id} difficulty "${card.difficulty}"`).toBeDefined();
      expect(getScore(card), `${card.id} score`).toBe(EXPECTED_POINTS[card.difficulty]);
    });
  });
});
