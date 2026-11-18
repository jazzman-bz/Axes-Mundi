import { describe, expect, it } from 'vitest';
import {
  applyScoreTransaction,
  createPlayerAccount,
  parseMatchScoreTransaction,
  parsePlayerAccountsFile,
} from '../../app/shared/playerAccounts';

describe('playerAccounts', () => {
  it('creates an account with normalized name and empty stats', () => {
    const account = createPlayerAccount(
      { name: '  Ada  ', avatar: '1' },
      'account-1',
      '2026-06-22T10:00:00.000Z',
    );

    expect(account).toMatchObject({
      id: 'account-1',
      name: 'Ada',
      avatar: '1',
      stats: {
        totalScore: 0,
        matchesPlayed: 0,
        matchesWon: 0,
        matchesLost: 0,
        bestScore: 0,
      },
    });
  });

  it('applies a score transaction once', () => {
    const account = createPlayerAccount(
      { name: 'Ada', avatar: '1' },
      'account-1',
      '2026-06-22T10:00:00.000Z',
    );

    const firstResult = applyScoreTransaction(account, {
      matchId: 'match-1',
      accountId: 'account-1',
      scoreDelta: 125,
      didWin: true,
      mode: 'ai',
      difficulty: 'hard',
      deckId: 'buildings-height-en',
      createdAt: '2026-06-22T10:10:00.000Z',
    });

    expect(firstResult.applied).toBe(true);
    expect(firstResult.account.stats.totalScore).toBe(125);
    expect(firstResult.account.stats.matchesPlayed).toBe(1);
    expect(firstResult.account.stats.matchesWon).toBe(1);
    expect(firstResult.account.stats.aiWins).toBe(1);

    const secondResult = applyScoreTransaction(firstResult.account, {
      matchId: 'match-1',
      accountId: 'account-1',
      scoreDelta: 125,
      didWin: true,
      mode: 'ai',
      difficulty: 'hard',
      deckId: 'buildings-height-en',
      createdAt: '2026-06-22T10:10:00.000Z',
    });

    expect(secondResult.applied).toBe(false);
    expect(secondResult.account.stats.totalScore).toBe(125);
    expect(secondResult.account.stats.matchesPlayed).toBe(1);
  });
});

describe('player accounts file and score validation', () => {
  const transaction = {
    matchId: 'match-1',
    accountId: 'account-1',
    scoreDelta: 120,
    didWin: true,
    mode: 'ai',
    difficulty: 'hard',
    deckId: 'buildings-height-de',
    createdAt: '2026-11-18T10:00:00.000Z',
  };

  it('throws instead of returning an empty list when the file is not an accounts file', () => {
    expect(() => parsePlayerAccountsFile(null)).toThrow('no accounts list');
    expect(() => parsePlayerAccountsFile({ accounts: 'broken' })).toThrow('no accounts list');
    expect(() => parsePlayerAccountsFile([])).toThrow('no accounts list');
  });

  it('keeps valid accounts, repairs damaged counters and reports dropped entries', () => {
    const valid = createPlayerAccount({ name: 'Ada' }, 'account-1', '2026-06-22T10:00:00.000Z');
    const damaged = {
      ...createPlayerAccount({ name: 'Bob' }, 'account-2', '2026-06-22T10:00:00.000Z'),
      stats: { totalScore: null, matchesPlayed: 3 },
    };

    const { file, droppedAccounts } = parsePlayerAccountsFile({
      version: 1,
      accounts: [valid, damaged, { name: 'no id' }, 'garbage'],
    });

    expect(droppedAccounts).toBe(2);
    expect(file.accounts.map((account) => account.id)).toEqual(['account-1', 'account-2']);
    expect(file.accounts[1].stats).toMatchObject({ totalScore: 0, matchesPlayed: 3, processedMatchIds: [] });
  });

  it('accepts a well-formed score transaction', () => {
    expect(parseMatchScoreTransaction(transaction)).toEqual(transaction);
  });

  it.each([
    ['scoreDelta', Number.NaN],
    ['scoreDelta', -5],
    ['scoreDelta', '100'],
    ['didWin', 'yes'],
    ['mode', 'cheat'],
    ['matchId', ''],
  ])('rejects a transaction with an invalid %s', (field, value) => {
    expect(() => parseMatchScoreTransaction({ ...transaction, [field]: value })).toThrow(field);
  });

  it('never stores a non-numeric score', () => {
    const account = createPlayerAccount({ name: 'Ada' }, 'account-1', '2026-06-22T10:00:00.000Z');
    const result = applyScoreTransaction(account, { ...transaction, scoreDelta: Number.NaN } as never);

    expect(result.account.stats.totalScore).toBe(0);
    expect(result.account.stats.bestScore).toBe(0);
  });
});
