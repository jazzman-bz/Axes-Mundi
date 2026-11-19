import { describe, expect, it } from 'vitest';
import {
  getDeckDescription,
  getDeckLocaleLabel,
  getDeckThemeLabel,
} from '@/utils/deckPresentation';

describe('deckPresentation', () => {
  describe('getDeckThemeLabel', () => {
    it('formats theme and axis as title case', () => {
      expect(getDeckThemeLabel({ theme: 'science', axis: 'temperature' })).toBe('Science & Temperature');
      expect(getDeckThemeLabel({ theme: 'political-events', axis: 'time' })).toBe('Political Events & Time');
    });
  });

  describe('getDeckLocaleLabel', () => {
    it('maps known locales to readable labels', () => {
      expect(getDeckLocaleLabel('en')).toBe('English');
      expect(getDeckLocaleLabel('de')).toBe('German');
      expect(getDeckLocaleLabel('fr')).toBe('fr');
      expect(getDeckLocaleLabel(undefined)).toBe('Unknown');
    });
  });

  describe('getDeckDescription', () => {
    it('prefers the explicit deck description when present', () => {
      expect(getDeckDescription({
        description: 'Sort iconic artworks by creation date.',
        theme: 'art',
        axis: 'time',
        locale: 'en',
        cardCount: 86,
      }, true)).toBe('Sort iconic artworks by creation date.');
    });

    it('creates a user deck fallback when no description is present', () => {
      expect(getDeckDescription({
        theme: 'science',
        axis: 'temperature',
        locale: 'en',
        cardCount: 52,
      }, true)).toBe('User-imported science deck for temperature with 52 cards in English.');
    });

    it('creates a generic bundled fallback when no description is present', () => {
      expect(getDeckDescription({
        theme: 'astronomy',
        axis: 'distance',
        locale: 'en',
        cardCount: 50,
      })).toBe('Explore astronomy through 50 cards sorted by distance.');
    });
  });
});
