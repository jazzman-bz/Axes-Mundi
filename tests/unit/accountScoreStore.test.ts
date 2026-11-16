import { describe, expect, it } from 'vitest';
import {
  commitLocalMatchScore,
  LOCAL_ACCOUNTS_STORAGE_KEY,
  readLocalPlayerAccounts,
} from '@/utils/accountScoreStore';
import { createPlayerAccount } from '../../app/shared/playerAccounts';

function createStorage(initialValue?: string): Storage {
  const values = new Map<string, string>();
  if (initialValue !== undefined) {
    values.set(LOCAL_ACCOUNTS_STORAGE_KEY, initialValue);
  }

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe('accountScoreStore', () => {
  it('reads only valid local player accounts', () => {
    const account = createPlayerAccount(
      { name: 'Jo', avatar: '1' },
      'account-1',
      '2026-06-22T10:00:00.000Z',
    );
    const storage = createStorage(JSON.stringify([account, { id: 'broken' }]));

    expect(readLocalPlayerAccounts(storage)).toEqual([account]);
  });

  it('commits match score to local account storage once', () => {
    const account = createPlayerAccount(
      { name: 'Jo', avatar: '1' },
      'account-1',
      '2026-06-22T10:00:00.000Z',
    );
    const storage = createStorage(JSON.stringify([account]));
    const transaction = {
      matchId: 'match-1',
      accountId: 'account-1',
      scoreDelta: 175,
      didWin: true,
      mode: 'ai' as const,
      difficulty: 'medium' as const,
      deckId: 'buildings-height-de',
      createdAt: '2026-06-22T10:10:00.000Z',
    };

    const firstResult = commitLocalMatchScore(transaction, storage);
    const secondResult = commitLocalMatchScore(transaction, storage);
    const [updatedAccount] = readLocalPlayerAccounts(storage);

    expect(firstResult.applied).toBe(true);
    expect(firstResult.previousTotalScore).toBe(0);
    expect(secondResult.applied).toBe(false);
    expect(secondResult.previousTotalScore).toBe(175);
    expect(updatedAccount.stats.totalScore).toBe(175);
    expect(updatedAccount.stats.matchesPlayed).toBe(1);
    expect(updatedAccount.stats.matchesWon).toBe(1);
    expect(updatedAccount.stats.aiWins).toBe(1);
  });

  it('returns the before and after totals when defeat still earns a promotion', () => {
    const account = createPlayerAccount({ name: 'Joe' }, 'account-1', '2026-06-22T10:00:00.000Z');
    account.stats.totalScore = 470;
    const storage = createStorage(JSON.stringify([account]));

    const result = commitLocalMatchScore({
      matchId: 'match-2',
      accountId: account.id,
      scoreDelta: 75,
      didWin: false,
      mode: 'ai',
      deckId: 'buildings-height-de',
      createdAt: '2026-06-22T10:10:00.000Z',
    }, storage);

    expect(result).toMatchObject({ applied: true, previousTotalScore: 470 });
    expect(readLocalPlayerAccounts(storage)[0].stats).toMatchObject({ totalScore: 545, matchesLost: 1 });
  });

  it('throws when the transaction account does not exist locally', () => {
    const storage = createStorage(JSON.stringify([]));

    expect(() => commitLocalMatchScore({
      matchId: 'match-1',
      accountId: 'missing-account',
      scoreDelta: 50,
      didWin: false,
      mode: 'ai',
      difficulty: 'easy',
      deckId: 'buildings-height-de',
      createdAt: '2026-06-22T10:10:00.000Z',
    }, storage)).toThrow('Account not found');
  });
});
