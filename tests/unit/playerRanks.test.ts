import { describe, expect, it } from 'vitest';
import { getRankProgress } from '@/data/playerRanks';

describe('player ranks', () => {
  it.each([
    [150, 'Bronze', 'Silver', 2],
    [500, 'Silver', 'Gold', 3],
    [1000, 'Gold', 'Platinum', 4],
    [2000, 'Platinum', 'Diamond', 5],
    [3500, 'Diamond', 'Epic', 6],
  ] as const)('awards the next rank exactly at %i points', (threshold, before, after, level) => {
    expect(getRankProgress(threshold - 1)).toMatchObject({
      rank: { label: before },
      nextRank: { label: after },
      pointsRemaining: 1,
    });
    expect(getRankProgress(threshold).rank).toMatchObject({ label: after, level });
  });

  it('counts surplus points towards the next rank after a promotion', () => {
    expect(getRankProgress(545)).toMatchObject({
      rank: { label: 'Gold' },
      nextRank: { label: 'Platinum' },
      pointsRemaining: 455,
      percent: 9,
    });
  });

  it('starts a new profile at Bronze and caps the bar at Epic', () => {
    expect(getRankProgress(0)).toMatchObject({
      rank: { label: 'Bronze', level: 1 },
      percent: 0,
    });
    expect(getRankProgress(9000)).toMatchObject({
      rank: { label: 'Epic', level: 6 },
      nextRank: undefined,
      pointsRemaining: 0,
      percent: 100,
    });
  });
});
