# Player Accounts

Axes-Mundi now treats player identity as a persistent local account instead of a loose name/avatar pair in `localStorage`.

## Sprint Summary

1. Account store and IPC
   - Added shared account types and score transaction helpers.
   - Added Electron main-process account persistence in `accounts.json` under `app.getPath("userData")`.
   - Exposed account APIs through the preload bridge.

2. Landing account flow
   - The first screen asks whether to use an existing account or create a new account.
   - Legacy `axesMundiPlayer` and `axesMundiSecondPlayerData` data is migrated into accounts when no accounts exist yet.
   - Hotseat mode asks the second player to choose or create a separate account.

3. Game integration
   - Game state now carries account IDs with player name and avatar snapshots.
   - Existing visual player labels continue to use name and avatar.

4. Score persistence
   - Match score is committed once at the final win/loss state.
   - Each match has a stable `matchId`, and each account tracks processed match IDs to prevent duplicate score application.
   - Hotseat tracks separate internal session scores for player 1 and player 2.

## Ranks and Profile Progress

| Level | Rank | Minimum total points | Matches at 100 points each |
| ---: | --- | ---: | ---: |
| 1 | Bronze | 0 | 0 |
| 2 | Silver | 500 | 5 |
| 3 | Gold | 1,000 | 10 |
| 4 | Platinum | 2,000 | 20 |
| 5 | Diamond | 4,000 | 40 |
| 6 | Epic | 10,000 | 100 |

Ranks are derived from the existing lifetime score, `stats.totalScore`. The match counts above describe the pace at 100 points per game. Existing accounts keep their points and immediately show the rank that matches the current thresholds. The account tile shows the rank, the avatar frame and level, and progress between the current and next thresholds. At Epic the bar stays full.

The result dialog shows progress after a completed AI or Hotseat match, including defeats. A successful score commit supplies the previous total and the saved account. A promotion fills the previous rank's bar, reveals the new frame and level, and puts any surplus points towards the next rank. With reduced motion enabled, the dialog shows the new state immediately. Hotseat saves and shows each participating account separately. A repeated match ID does not grant points or replay a promotion.

## Account File

Accounts are stored in:

```text
<Electron userData>/accounts.json
```

Shape:

```ts
type PlayerAccount = {
  id: string;
  name: string;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
  stats: {
    totalScore: number;
    matchesPlayed: number;
    matchesWon: number;
    matchesLost: number;
    bestScore: number;
    aiWins: number;
    humanWins: number;
    lanWins: number;
    processedMatchIds: string[];
  };
};
```

## Runtime Storage

`localStorage` is still used for selection/session state:

```text
selectedAccountId
selectedSecondAccountId
selectedGameType
selectedDifficulty
selectedDeck
```

Legacy keys are kept as compatibility snapshots while the game pages transition:

```text
axesMundiPlayer
axesMundiSecondPlayerData
axesMundiPlayer1Data
axesMundiPlayer2Data
```

## IPC API

Renderer code uses `window.AXM`:

```ts
getPlayerAccounts()
createPlayerAccount({ name, avatar })
updatePlayerAccount(accountId, patch)
commitMatchScore(transaction)
```

Successful score commits return the saved account, `previousTotalScore`, and an `applied` flag for duplicate detection. Score transactions are idempotent:

```ts
type MatchScoreTransaction = {
  matchId: string;
  accountId: string;
  scoreDelta: number;
  didWin: boolean;
  mode: 'ai' | 'hotseat' | 'lan' | 'learning';
  difficulty?: 'easy' | 'medium' | 'hard';
  deckId: string;
  createdAt: string;
};
```

## Verification

Useful checks:

```bash
npm test -- tests/unit/playerAccounts.test.ts
npm test -- tests/unit/playerRanks.test.ts tests/unit/rankPresentation.test.ts tests/unit/accountScoreStore.test.ts
npm test -- tests/unit/gameStateManager.test.ts tests/unit/cardPlacementHandler.test.ts tests/unit/playerAccounts.test.ts
npm run typecheck
npm run vite:build
```
