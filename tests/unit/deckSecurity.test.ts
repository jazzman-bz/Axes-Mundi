import { describe, expect, it } from 'vitest';
import {
  DECK_ARCHIVE_LIMITS,
  MIN_IMPORTED_DECK_CARDS,
  assertDeckArchiveEntries,
  assertPlayableDeck,
  assertDeckArchiveSize,
  isDeckImageEntry,
  isDeckJsonEntry,
  assertSafeDeckId,
  getImageContentType,
  parseImportedDeck,
  resolveUserDeckAssetPath,
} from '../../app/shared/deckSecurity';

describe('deckSecurity', () => {
  describe('parseImportedDeck', () => {
    it('accepts every card difficulty that has a score, including expert', () => {
      const deck = parseImportedDeck({
        id: 'custom-deck',
        name: 'Custom Deck',
        axis: 'time',
        cards: ['easy', 'medium', 'hard', 'expert'].map((difficulty, index) => ({
          id: `card-${index}`, title: 'Card', value: index, difficulty,
        })),
      });

      expect(deck.cards.map((card) => card.difficulty)).toEqual(['easy', 'medium', 'hard', 'expert']);
    });

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

    it('fills the value text shown on the axis when a card has none', () => {
      const deck = parseImportedDeck({
        id: 'custom-deck',
        name: 'Custom Deck',
        axis: 'height',
        cards: [
          {
 id: 'with-unit', title: 'Tower', value: 120, unit: 'm',
},
          { id: 'no-unit', title: 'Year', value: 1969 },
          {
 id: 'given', title: 'Peak', value: 8849, unit: 'm', displayValue: '8,849 m',
},
        ],
      });

      expect(deck.cards.map((card) => card.displayValue)).toEqual(['120 m', '1969', '8,849 m']);
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

  describe('assertPlayableDeck', () => {
    const deckWith = (count: number) => ({ cards: Array.from({ length: count }, (_, index) => ({ id: `c${index}` })) });

    it('accepts decks with enough cards for a full game', () => {
      expect(() => assertPlayableDeck(deckWith(MIN_IMPORTED_DECK_CARDS))).not.toThrow();
      expect(() => assertPlayableDeck(deckWith(62))).not.toThrow();
    });

    it('rejects decks that cannot fill the hands and the draw pile', () => {
      expect(() => assertPlayableDeck(deckWith(8))).toThrow(/at least 20 cards.*has 8/);
      expect(() => assertPlayableDeck(deckWith(MIN_IMPORTED_DECK_CARDS - 1))).toThrow();
    });

    it('covers the most cards a game deals: axis card, 5 for the player, 7 for an easy AI', () => {
      expect(MIN_IMPORTED_DECK_CARDS).toBeGreaterThan(1 + 5 + 7);
    });
  });

  describe('resolveUserDeckAssetPath', () => {
    it('resolves safe asset names inside the deck directory', () => {
      const resolvedPath = resolveUserDeckAssetPath('/tmp/axes', 'Custom Deck', 'planet-1.png');
      expect(resolvedPath).toBe('/tmp/axes/Custom Deck/planet-1.png');
    });

    it('allows punctuation used by imported art deck images', () => {
      const resolvedPath = resolveUserDeckAssetPath(
        '/tmp/axes',
        'art-time-en',
        'The Floating Piers (Christo + Jeanne Claude) - 2016.png',
      );

      expect(resolvedPath).toBe('/tmp/axes/art-time-en/The Floating Piers (Christo + Jeanne Claude) - 2016.png');
    });

    it('rejects traversal attempts', () => {
      expect(() => resolveUserDeckAssetPath('/tmp/axes', 'Custom Deck', '../secret.png')).toThrow(/unsupported/);
    });

    it('rejects path separators even when the extension is valid', () => {
      expect(() => resolveUserDeckAssetPath('/tmp/axes', 'Custom Deck', 'nested/planet.png')).toThrow(/unsupported/);
      expect(() => resolveUserDeckAssetPath('/tmp/axes', 'Custom Deck', 'nested\\planet.png')).toThrow(/unsupported/);
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

describe('deck archive limits', () => {
  const MB = 1024 * 1024;
  const file = (name: string, size: number) => ({ name, size, isDirectory: false });
  const validArchive = [
    { name: 'my-deck/', size: 0, isDirectory: true },
    file('my-deck/deck.json', 20_000),
    file('my-deck/images/card-1.png', 2 * MB),
    file('my-deck/images/card-2.jpg', 3 * MB),
  ];

  it('recognises deck.json and image entries with either path separator', () => {
    expect(isDeckJsonEntry('deck.json')).toBe(true);
    expect(isDeckJsonEntry('My Deck\\deck.json')).toBe(true);
    expect(isDeckJsonEntry('deck.json.bak')).toBe(false);
    expect(isDeckImageEntry('images/a.PNG')).toBe(true);
    expect(isDeckImageEntry('deck\\images\\b.webp')).toBe(true);
    expect(isDeckImageEntry('images/script.js')).toBe(false);
    expect(isDeckImageEntry('a.png')).toBe(false);
  });

  it('accepts a normal deck archive', () => {
    expect(() => assertDeckArchiveSize(10 * MB)).not.toThrow();
    expect(() => assertDeckArchiveEntries(validArchive)).not.toThrow();
  });

  it('rejects an archive file that is too large to read', () => {
    expect(() => assertDeckArchiveSize(DECK_ARCHIVE_LIMITS.maxArchiveBytes + 1)).toThrow('larger than 200 MB');
  });

  it('rejects too many files', () => {
    const entries = Array.from({ length: DECK_ARCHIVE_LIMITS.maxEntries + 1 }, (_, i) => file(`images/${i}.png`, 1));
    expect(() => assertDeckArchiveEntries(entries)).toThrow('more than 2000 files');
  });

  it('rejects an oversized deck.json or image', () => {
    expect(() => assertDeckArchiveEntries([file('deck.json', 3 * MB)])).toThrow('deck.json is larger than 2 MB');
    expect(() => assertDeckArchiveEntries([file('deck.json', 100), file('images/huge.png', 21 * MB)]))
      .toThrow('Image "images/huge.png" is larger than 20 MB');
  });

  it('rejects archives that unpack to too much data (decompression bombs)', () => {
    const entries = [file('deck.json', 100), ...Array.from({ length: 30 }, (_, i) => file(`data/${i}.bin`, 19 * MB))];
    expect(() => assertDeckArchiveEntries(entries)).toThrow('unpacks to more than 500 MB');
  });

  it('rejects archives with more than one deck.json', () => {
    expect(() => assertDeckArchiveEntries([file('deck.json', 100), file('other/deck.json', 100)]))
      .toThrow('more than one deck.json');
  });
});
