import { describe, expect, it } from 'vitest';
import {
  assertSafeDeckId,
  getImageContentType,
  parseImportedDeck,
  resolveUserDeckAssetPath,
} from '../../app/shared/deckSecurity';

describe('deckSecurity', () => {
  describe('parseImportedDeck', () => {
    it('fills defaults for optional deck metadata', () => {
      const deck = parseImportedDeck({
        id: 'custom-deck',
        name: 'Custom Deck',
        axis: 'time',
        cards: [
          { id: 'card-1', title: 'Card', value: 10 },
        ],
      });

      expect(deck.theme).toBe('custom');
      expect(deck.locale).toBe('en');
      expect(deck.version).toBe('1.0.0');
      expect(deck.imageFolder).toBe('custom-deck');
    });

    it('rejects unsafe deck ids', () => {
      expect(() => parseImportedDeck({
        id: '../escape',
        name: 'Unsafe Deck',
        axis: 'time',
        cards: [{ id: 'card-1', title: 'Card', value: 10 }],
      })).toThrow(/Deck id/);
    });
  });

  describe('resolveUserDeckAssetPath', () => {
    it('resolves safe asset names inside the deck directory', () => {
      const resolvedPath = resolveUserDeckAssetPath('/tmp/axes', 'Custom Deck', 'planet-1.png');
      expect(resolvedPath).toBe('/tmp/axes/Custom Deck/planet-1.png');
    });

    it('rejects traversal attempts', () => {
      expect(() => resolveUserDeckAssetPath('/tmp/axes', 'Custom Deck', '../secret.png')).toThrow(/unsupported/);
    });
  });

  describe('misc helpers', () => {
    it('validates safe deck ids', () => {
      expect(assertSafeDeckId('deck-1')).toBe('deck-1');
      expect(() => assertSafeDeckId('Deck 1')).toThrow(/unsupported/);
    });

    it('derives content type from file extension', () => {
      expect(getImageContentType('card.png')).toBe('image/png');
      expect(getImageContentType('card.webp')).toBe('image/webp');
      expect(getImageContentType('card.jpg')).toBe('image/jpeg');
    });
  });
});
