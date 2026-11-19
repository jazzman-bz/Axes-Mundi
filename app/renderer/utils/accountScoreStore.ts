import {
  applyScoreTransaction,
  type MatchScoreCommitSuccess,
  type MatchScoreTransaction,
  type PlayerAccount,
} from '../../shared/playerAccounts';

export const LOCAL_ACCOUNTS_STORAGE_KEY = 'axesMundiLocalAccounts';

function isPlayerAccount(value: unknown): value is PlayerAccount {
  const account = value as PlayerAccount;
  return Boolean(
    account
      && typeof account === 'object'
      && typeof account.id === 'string'
      && typeof account.name === 'string'
      && account.stats
      && typeof account.stats.totalScore === 'number'
      && Array.isArray(account.stats.processedMatchIds),
  );
}

export function readLocalPlayerAccounts(storage: Storage = localStorage): PlayerAccount[] {
  const rawValue = storage.getItem(LOCAL_ACCOUNTS_STORAGE_KEY);
  if (!rawValue) {
    return [];
  }

  try {
    const accounts = JSON.parse(rawValue);
    return Array.isArray(accounts) ? accounts.filter(isPlayerAccount) : [];
  } catch {
    return [];
  }
}

export function writeLocalPlayerAccounts(
  accounts: PlayerAccount[],
  storage: Storage = localStorage,
): void {
  storage.setItem(LOCAL_ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
}

export function commitLocalMatchScore(
  transaction: MatchScoreTransaction,
  storage: Storage = localStorage,
): MatchScoreCommitSuccess {
  const accounts = readLocalPlayerAccounts(storage);
  const accountIndex = accounts.findIndex((account) => account.id === transaction.accountId);
  if (accountIndex === -1) {
    throw new Error('Account not found');
  }

  const previousTotalScore = accounts[accountIndex].stats.totalScore;
  const result = applyScoreTransaction(accounts[accountIndex], transaction);
  accounts[accountIndex] = result.account;

  if (result.applied) {
    writeLocalPlayerAccounts(accounts, storage);
  }

  return {
    success: true, account: result.account, applied: result.applied, previousTotalScore,
  };
}
