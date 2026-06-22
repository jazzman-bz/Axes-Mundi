import { describe, expect, it } from 'vitest';
import {
  applyScoreTransaction,
  createPlayerAccount,
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
