import { z } from 'zod';

const ACCOUNT_GAME_MODES = ['ai', 'hotseat', 'lan', 'learning'] as const;
const ACCOUNT_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

export type AccountGameMode = typeof ACCOUNT_GAME_MODES[number];
export type AccountDifficulty = typeof ACCOUNT_DIFFICULTIES[number];

export interface PlayerAccountStats {
  totalScore: number;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  bestScore: number;
  aiWins: number;
  humanWins: number;
  lanWins: number;
  processedMatchIds: string[];
}

export interface PlayerAccount {
  id: string;
  name: string;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
  stats: PlayerAccountStats;
}

export interface PlayerAccountsFile {
  version: 1;
  accounts: PlayerAccount[];
}

export interface CreatePlayerAccountInput {
  name: string;
  avatar?: string | null;
}

export interface UpdatePlayerAccountInput {
  name?: string;
  avatar?: string | null;
}

export interface MatchScoreTransaction {
  matchId: string;
  accountId: string;
  scoreDelta: number;
  didWin: boolean;
  mode: AccountGameMode;
  difficulty?: AccountDifficulty;
  deckId: string;
  createdAt: string;
}

export interface MatchScoreCommitSuccess {
  success: true;
  account: PlayerAccount;
  applied: boolean;
  previousTotalScore: number;
}

export type MatchScoreCommitResult = MatchScoreCommitSuccess | { success: false; error: string };

export function createEmptyStats(): PlayerAccountStats {
  return {
    totalScore: 0,
    matchesPlayed: 0,
    matchesWon: 0,
    matchesLost: 0,
    bestScore: 0,
    aiWins: 0,
    humanWins: 0,
    lanWins: 0,
    processedMatchIds: [],
  };
}

export function normalizeAccountName(name: unknown): string {
  if (typeof name !== 'string') {
    throw new Error('Account name is required');
  }

  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    throw new Error('Account name is required');
  }

  if (trimmedName.length > 40) {
    throw new Error('Account name must be 40 characters or fewer');
  }

  return trimmedName;
}

export function normalizeAvatar(avatar: unknown): string | null {
  if (avatar === undefined || avatar === null || avatar === '') {
    return null;
  }

  if (typeof avatar !== 'string') {
    throw new Error('Avatar must be a string');
  }

  const trimmedAvatar = avatar.trim();
  if (trimmedAvatar.length > 40) {
    throw new Error('Avatar must be 40 characters or fewer');
  }

  return trimmedAvatar || null;
}

export function createPlayerAccount(
  input: CreatePlayerAccountInput,
  id: string,
  now: string,
): PlayerAccount {
  return {
    id,
    name: normalizeAccountName(input.name),
    avatar: normalizeAvatar(input.avatar),
    createdAt: now,
    updatedAt: now,
    stats: createEmptyStats(),
  };
}

export function applyScoreTransaction(
  account: PlayerAccount,
  transaction: MatchScoreTransaction,
): { account: PlayerAccount; applied: boolean } {
  if (account.id !== transaction.accountId) {
    throw new Error('Score transaction account mismatch');
  }

  if (account.stats.processedMatchIds.includes(transaction.matchId)) {
    return { account, applied: false };
  }

  const roundedDelta = Math.round(transaction.scoreDelta);
  const scoreDelta = Number.isFinite(roundedDelta) ? Math.max(0, roundedDelta) : 0;
  const processedMatchIds = [
    transaction.matchId,
    ...account.stats.processedMatchIds,
  ].slice(0, 200);

  const stats: PlayerAccountStats = {
    ...account.stats,
    totalScore: account.stats.totalScore + scoreDelta,
    matchesPlayed: account.stats.matchesPlayed + 1,
    matchesWon: account.stats.matchesWon + (transaction.didWin ? 1 : 0),
    matchesLost: account.stats.matchesLost + (transaction.didWin ? 0 : 1),
    bestScore: Math.max(account.stats.bestScore, scoreDelta),
    aiWins: account.stats.aiWins + (transaction.didWin && transaction.mode === 'ai' ? 1 : 0),
    humanWins: account.stats.humanWins + (transaction.didWin && transaction.mode === 'hotseat' ? 1 : 0),
    lanWins: account.stats.lanWins + (transaction.didWin && transaction.mode === 'lan' ? 1 : 0),
    processedMatchIds,
  };

  return {
    account: {
      ...account,
      updatedAt: transaction.createdAt,
      stats,
    },
    applied: true,
  };
}

/** A counter that older or damaged files may lack or hold as null; it falls back to 0. */
const counterSchema = z.number().min(0).catch(0);

const storedStatsSchema = z.object({
  totalScore: counterSchema,
  matchesPlayed: counterSchema,
  matchesWon: counterSchema,
  matchesLost: counterSchema,
  bestScore: counterSchema,
  aiWins: counterSchema,
  humanWins: counterSchema,
  lanWins: counterSchema,
  processedMatchIds: z.array(z.string()).catch([]),
});

const storedAccountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  avatar: z.string().nullable().catch(null),
  createdAt: z.string().catch(''),
  updatedAt: z.string().catch(''),
  stats: storedStatsSchema,
});

export interface ParsedPlayerAccountsFile {
  file: PlayerAccountsFile;
  /** Entries that had no usable id, name or stats and were left out. */
  droppedAccounts: number;
}

/**
 * Reads the stored accounts file. Throws when the content is not an accounts file at all,
 * so the caller can keep the original instead of overwriting it with an empty list.
 */
export function parsePlayerAccountsFile(rawValue: unknown): ParsedPlayerAccountsFile {
  if (
    !rawValue
    || typeof rawValue !== 'object'
    || !Array.isArray((rawValue as { accounts?: unknown }).accounts)
  ) {
    throw new Error('Player accounts file has no accounts list');
  }

  const rawAccounts: unknown[] = (rawValue as { accounts: unknown[] }).accounts;
  const accounts = rawAccounts.flatMap((rawAccount) => {
    const result = storedAccountSchema.safeParse(rawAccount);
    return result.success ? [result.data as PlayerAccount] : [];
  });

  return {
    file: { version: 1, accounts },
    droppedAccounts: rawAccounts.length - accounts.length,
  };
}

const matchScoreTransactionSchema = z.object({
  matchId: z.string().min(1).max(200),
  accountId: z.string().min(1).max(200),
  scoreDelta: z.number().min(0).max(1_000_000),
  didWin: z.boolean(),
  mode: z.enum(ACCOUNT_GAME_MODES),
  difficulty: z.enum(ACCOUNT_DIFFICULTIES).optional(),
  deckId: z.string().min(1).max(200),
  createdAt: z.string().min(1).max(100),
});

/** Validates a score transaction that arrives from the renderer over IPC. */
export function parseMatchScoreTransaction(input: unknown): MatchScoreTransaction {
  const result = matchScoreTransactionSchema.safeParse(input);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.') || 'transaction'))];
    throw new Error(`Invalid score transaction: ${fields.join(', ')}`);
  }

  const { difficulty, ...transaction } = result.data;
  return difficulty === undefined ? transaction : { ...transaction, difficulty };
}
