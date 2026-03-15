import type { Deck } from '@/data/types';

type DeckCardLike = Pick<Deck, 'description' | 'theme' | 'axis' | 'locale'> & {
  cardCount?: number;
};

function toTitleCase(value: string | undefined): string {
  if (!value) return 'Custom';
  return value
    .split(/[\s-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getDeckThemeLabel(deck: Pick<Deck, 'theme' | 'axis'>): string {
  return `${toTitleCase(deck.theme)} & ${toTitleCase(deck.axis)}`;
}

export function getDeckLocaleLabel(locale?: string): string {
  switch (locale) {
  case 'en':
    return 'English';
  case 'de':
    return 'German';
  default:
    return locale || 'Unknown';
  }
}

export function getDeckDescription(deck: DeckCardLike, isUserDeck: boolean = false): string {
  const trimmedDescription = deck.description?.trim();
  if (trimmedDescription) {
    return trimmedDescription;
  }

  const cardCountText = deck.cardCount ? `${deck.cardCount} cards` : 'a custom card set';
  const themeLabel = toTitleCase(deck.theme);
  const axisLabel = toTitleCase(deck.axis);
  const localeLabel = getDeckLocaleLabel(deck.locale);

  if (isUserDeck) {
    return `User-imported ${themeLabel.toLowerCase()} deck for ${axisLabel.toLowerCase()} with ${cardCountText} in ${localeLabel}.`;
  }

  return `Explore ${themeLabel.toLowerCase()} through ${cardCountText} sorted by ${axisLabel.toLowerCase()}.`;
}
