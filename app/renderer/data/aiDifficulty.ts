export const AI_DIFFICULTY = {
  easy: { errorChance: 0.20, turnSeconds: 30, opponentCards: 7 },
  medium: { errorChance: 0.10, turnSeconds: 20, opponentCards: 6 },
  hard: { errorChance: 0.05, turnSeconds: 10, opponentCards: 5 },
} as const;

export type GameDifficulty = keyof typeof AI_DIFFICULTY;
