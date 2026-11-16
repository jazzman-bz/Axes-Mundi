export const PLAYER_RANKS = [
  {
    id: 'bronze', label: 'Bronze', level: 1, minimum: 0,
  },
  {
    id: 'silver', label: 'Silver', level: 2, minimum: 150,
  },
  {
    id: 'gold', label: 'Gold', level: 3, minimum: 500,
  },
  {
    id: 'platinum', label: 'Platinum', level: 4, minimum: 1000,
  },
  {
    id: 'diamond', label: 'Diamond', level: 5, minimum: 2000,
  },
  {
    id: 'epic', label: 'Epic', level: 6, minimum: 3500,
  },
] as const;

export type PlayerRank = typeof PLAYER_RANKS[number];

export function getRankProgress(totalScore: number): {
  rank: PlayerRank;
  nextRank: PlayerRank | undefined;
  pointsRemaining: number;
  percent: number;
} {
  const score = Number.isFinite(totalScore) ? Math.max(0, totalScore) : 0;
  const nextIndex = PLAYER_RANKS.findIndex((rank) => rank.minimum > score);
  if (nextIndex === -1) {
    return {
      rank: PLAYER_RANKS[PLAYER_RANKS.length - 1], nextRank: undefined, pointsRemaining: 0, percent: 100,
    };
  }

  const rank = PLAYER_RANKS[nextIndex - 1];
  const nextRank = PLAYER_RANKS[nextIndex];
  return {
    rank,
    nextRank,
    pointsRemaining: nextRank.minimum - score,
    percent: (score - rank.minimum) / (nextRank.minimum - rank.minimum) * 100,
  };
}
