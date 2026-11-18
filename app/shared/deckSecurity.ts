import { extname, resolve, sep } from 'path';
import { z } from 'zod';

const SAFE_DECK_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const SAFE_FOLDER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _-]*$/;
const SAFE_ASSET_EXTENSION_PATTERN = /\.(png|jpe?g|webp)$/i;
const PATH_SEPARATOR_PATTERN = /[\\/]/;

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const charCode = character.charCodeAt(0);
    return charCode < 32 || charCode === 127;
  });
}

const sourceSchema = z.object({
  label: z.string().min(1),
  url: z.string().url(),
});

const importedCardSchema = z.object({
  id: z.string().min(1).regex(SAFE_DECK_ID_PATTERN, 'Card id may only contain lowercase letters, numbers, and hyphens'),
  title: z.string().min(1),
  axis: z.string().min(1).optional(),
  value: z.number().finite(),
  unit: z.string().min(1).optional(),
  displayValue: z.string().min(1).optional(),
  image: z.string().min(1).optional(),
  facts: z.array(z.string().min(1)).optional(),
  sources: z.array(sourceSchema).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard', 'expert']).optional(),
});

export const importedDeckSchema = z.object({
  id: z.string().min(1).regex(SAFE_DECK_ID_PATTERN, 'Deck id may only contain lowercase letters, numbers, and hyphens'),
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  axis: z.string().min(1),
  theme: z.string().min(1).default('custom'),
  locale: z.string().min(2).default('en'),
  version: z.string().min(1).default('1.0.0'),
  imageFolder: z.string().min(1).regex(SAFE_FOLDER_PATTERN, 'Image folder contains unsupported characters').optional(),
  cards: z.array(importedCardSchema).min(1),
});

export type ImportedDeck = z.infer<typeof importedDeckSchema>;
export type NormalizedImportedDeck = Omit<ImportedDeck, 'imageFolder'> & { imageFolder: string };

export function isSafeDeckId(value: string): boolean {
  return SAFE_DECK_ID_PATTERN.test(value);
}

export function assertSafeDeckId(value: string, label: string = 'Deck id'): string {
  if (!isSafeDeckId(value)) {
    throw new Error(`${label} contains unsupported characters`);
  }

  return value;
}

export function assertSafeImageFolder(value: string, label: string = 'Image folder'): string {
  if (!SAFE_FOLDER_PATTERN.test(value)) {
    throw new Error(`${label} contains unsupported characters`);
  }

  return value;
}

export function assertSafeAssetName(value: string, label: string = 'Asset name'): string {
  if (
    value.length === 0
    || value.startsWith('.')
    || !SAFE_ASSET_EXTENSION_PATTERN.test(value)
    || PATH_SEPARATOR_PATTERN.test(value)
    || containsControlCharacter(value)
  ) {
    throw new Error(`${label} contains unsupported characters`);
  }

  return value;
}

const MEGABYTE = 1024 * 1024;

/** Size limits for imported deck ZIP files. The bundled decks stay far below them. */
export const DECK_ARCHIVE_LIMITS = {
  maxArchiveBytes: 200 * MEGABYTE,
  maxEntries: 2000,
  maxDeckJsonBytes: 2 * MEGABYTE,
  maxImageBytes: 20 * MEGABYTE,
  maxTotalBytes: 500 * MEGABYTE,
} as const;

export type DeckArchiveLimits = { [K in keyof typeof DECK_ARCHIVE_LIMITS]: number };

/** What the import needs to know about a ZIP entry before unpacking it. */
export interface DeckArchiveEntryInfo {
  name: string;
  /** Uncompressed size declared in the ZIP header. adm-zip never inflates past it. */
  size: number;
  isDirectory: boolean;
}

function normalizeEntryName(name: string): string {
  return name.replace(/\\/g, '/').toLowerCase();
}

function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / MEGABYTE)} MB`;
}

export function isDeckJsonEntry(name: string): boolean {
  const normalizedName = normalizeEntryName(name);
  return normalizedName === 'deck.json' || normalizedName.endsWith('/deck.json');
}

export function isDeckImageEntry(name: string): boolean {
  const normalizedName = normalizeEntryName(name);
  return (normalizedName.startsWith('images/') || normalizedName.includes('/images/'))
    && SAFE_ASSET_EXTENSION_PATTERN.test(normalizedName);
}

/** Checked before the ZIP is read into memory. */
export function assertDeckArchiveSize(
  archiveBytes: number,
  limits: DeckArchiveLimits = DECK_ARCHIVE_LIMITS,
): void {
  if (archiveBytes > limits.maxArchiveBytes) {
    throw new Error(`Deck archive is larger than ${formatMegabytes(limits.maxArchiveBytes)}`);
  }
}

/**
 * Rejects archives that are too large to unpack safely or ambiguous about their deck.json.
 * Sizes come from the ZIP headers, so nothing has been decompressed yet.
 */
export function assertDeckArchiveEntries(
  entries: DeckArchiveEntryInfo[],
  limits: DeckArchiveLimits = DECK_ARCHIVE_LIMITS,
): void {
  if (entries.length > limits.maxEntries) {
    throw new Error(`Deck archive has more than ${limits.maxEntries} files`);
  }

  const files = entries.filter((entry) => !entry.isDirectory);
  const deckJsonEntries = files.filter((entry) => isDeckJsonEntry(entry.name));
  if (deckJsonEntries.length > 1) {
    throw new Error('Deck archive contains more than one deck.json');
  }

  const [deckJsonEntry] = deckJsonEntries;
  if (deckJsonEntry && deckJsonEntry.size > limits.maxDeckJsonBytes) {
    throw new Error(`deck.json is larger than ${formatMegabytes(limits.maxDeckJsonBytes)}`);
  }

  const oversizedImage = files.find((entry) => isDeckImageEntry(entry.name) && entry.size > limits.maxImageBytes);
  if (oversizedImage) {
    throw new Error(`Image "${oversizedImage.name}" is larger than ${formatMegabytes(limits.maxImageBytes)}`);
  }

  const totalBytes = files.reduce((sum, entry) => sum + Math.max(0, entry.size), 0);
  if (totalBytes > limits.maxTotalBytes) {
    throw new Error(`Deck archive unpacks to more than ${formatMegabytes(limits.maxTotalBytes)}`);
  }
}

export function parseImportedDeck(input: unknown): NormalizedImportedDeck {
  const deck = importedDeckSchema.parse(input);
  return {
    ...deck,
    imageFolder: deck.imageFolder ?? deck.id,
  };
}

export function getImageContentType(assetName: string): string {
  switch (extname(assetName).toLowerCase()) {
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.jpg':
    case '.jpeg':
    default:
      return 'image/jpeg';
  }
}

export function resolveUserDeckAssetPath(baseDir: string, imageFolder: string, assetName: string): string {
  const safeFolder = assertSafeImageFolder(imageFolder);
  const safeAssetName = assertSafeAssetName(assetName);
  const candidatePath = resolve(baseDir, safeFolder, safeAssetName);
  const expectedPrefix = `${resolve(baseDir, safeFolder)}${sep}`;

  if (!candidatePath.startsWith(expectedPrefix)) {
    throw new Error('Resolved asset path escaped the deck image directory');
  }

  return candidatePath;
}
