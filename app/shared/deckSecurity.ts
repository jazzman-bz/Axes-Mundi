import { extname, resolve, sep } from 'path';
import { z } from 'zod';

const SAFE_DECK_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const SAFE_FOLDER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _-]*$/;
const SAFE_ASSET_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._()'-]*\.(png|jpe?g|webp)$/i;

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
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
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
  if (!SAFE_ASSET_NAME_PATTERN.test(value)) {
    throw new Error(`${label} contains unsupported characters`);
  }

  return value;
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
