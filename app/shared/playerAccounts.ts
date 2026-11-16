export type AccountGameMode = 'ai' | 'hotseat' | 'lan' | 'learning';
export type AccountDifficulty = 'easy' | 'medium' | 'hard';

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

  const scoreDelta = Math.max(0, Math.round(transaction.scoreDelta));
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
