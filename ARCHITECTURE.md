# Axes-Mundi Architecture Documentation

**Last Updated:** 2026-05-27
**Status:** Electron process split, renderer module refactor, shared validation layer, and LAN hardening documented

## Overview

The Axes-Mundi application is an Electron desktop game with separate main, preload, renderer, and shared TypeScript layers. The renderer game flow has been refactored from a monolithic `main.ts` file (~4,400 lines) into focused, testable components. The architecture follows a callback-based pattern for loose coupling between modules. Current `app/renderer/main.ts` size: ~1,700 lines.

## Architecture Principles

1. **Separation of Concerns**: Each module handles a specific domain (rendering, input, state, etc.)
2. **Callback Pattern**: Modules communicate via typed callbacks to maintain loose coupling
3. **Testability**: All modules are unit testable with mocked dependencies
4. **Single Responsibility**: Each module has one clear purpose

## Runtime Architecture

Axes-Mundi is split along Electron's process boundaries:

### Main Process (`app/main/`)
- Creates the Electron `BrowserWindow`
- Owns privileged Node/Electron APIs such as filesystem access, dialogs, custom protocols, and app lifecycle
- Imports deck ZIP files with `adm-zip`
- Serves imported user deck images through the privileged `user-deck-image://` protocol
- Starts and coordinates the LAN WebSocket server
- Uses structured logging through `app/main/logger.ts`
- Hardens every window: new windows are denied, navigation is limited to the app's own pages (`app/main/navigationPolicy.ts`), `<webview>` is blocked and browser permission requests are refused
- Checks deck ZIP sizes before reading and unpacking (`DECK_ARCHIVE_LIMITS` in `app/shared/deckSecurity.ts`)
- Writes `accounts.json` atomically and runs account changes one at a time; an unreadable file is moved aside instead of being overwritten

### Preload Process (`app/preload/index.ts`)
- Exposes a narrow `window.AXM` API via `contextBridge`
- Keeps `ipcRenderer` hidden from renderer code
- Whitelists renderer event channels
- Provides typed methods for version info, deck import/loading, LAN server control, LAN game actions, and debug logging

### Renderer Process (`app/renderer/`)
- Built by Vite from `app/renderer`
- Contains landing/game/LAN HTML entry points, each with a strict Content-Security-Policy (`script-src 'self'`, no `eval`, no inline scripts, `object-src 'none'`); `tests/unit/contentSecurityPolicy.test.ts` checks every page Vite builds
- Runs the canvas game loop, UI state, input handling, deck loading, audio, and LAN client code
- Uses `AxesMundiApp` in `app/renderer/main.ts` as the orchestration layer for focused utility modules

### Shared Layer (`app/shared/`)
- Contains schemas and safety helpers used across process boundaries
- Validates imported decks, IPC payloads, and LAN messages before they enter game logic

## Module Structure

### Completed Renderer Modules (Steps 1-16)

#### 1. **ResizeHandler** (`app/renderer/utils/resizeHandler.ts`)
- **Purpose**: Handles window resize events and scale calculations
- **Key Methods**: `attach()`, `onResize()`, `updateConfig()`
- **Dependencies**: None (standalone utility)

#### 2. **ScaleUtils** (`app/renderer/utils/scaleUtils.ts`)
- **Purpose**: Scale calculation utilities
- **Key Functions**: `calculateScale()`, `calculateSnapThreshold()`
- **Dependencies**: None (pure functions)

#### 3. **CardLayout** (`app/renderer/utils/cardLayout.ts`)
- **Purpose**: Card layout and positioning logic
- **Key Classes**: `CardLayoutManager`
- **Key Methods**: `layoutHand()`, `layoutAxisCards()`, `recycleGraveyard()`
- **Dependencies**: Scale calculations

#### 4. **CardDealer** (`app/renderer/utils/cardDealer.ts`)
- **Purpose**: Card dealing utilities
- **Key Functions**: `getOpponentCardCount()`, `dealCard()`
- **Dependencies**: None (pure functions)

#### 5. **AssetLoader** (`app/renderer/utils/assetLoader.ts`)
- **Purpose**: Asset loading and caching
- **Key Functions**: `loadImage()`
- **Dependencies**: None (standalone utility)

#### 6. **CanvasUtils** (`app/renderer/utils/canvasUtils.ts`)
- **Purpose**: Canvas 2D drawing utilities
- **Key Functions**: `drawRoundedRect()`, `wrapText()`, `convertImageToWhite()`
- **Dependencies**: None (pure functions)

#### 7. **InputHandler** (`app/renderer/utils/inputHandler.ts`)
- **Purpose**: Mouse input handling and card interaction
- **Key Methods**: `attach()`, `updateConfig()`, `handleMouseDown()`, `handleMouseMove()`, `handleMouseUp()`
- **Dependencies**: Card layout, game state (via callbacks)
- **Callbacks**: `onCardSelected`, `onCardPlaced`, `onCardReturnedToHand`, `onWeiterButtonClick`, etc.

#### 8. **AIManager** (`app/renderer/utils/aiManager.ts`)
- **Purpose**: AI opponent logic and card placement
- **Key Methods**: `playTurn()`, `simulateDrag()`, `placeCard()`
- **Dependencies**: Game state (via callbacks)
- **Callbacks**: `onGetBoardCards`, `onCardRemovedFromHand`, `onCardPlaced`, `onTurnComplete`, etc.

#### 9. **GameRenderer** (`app/renderer/utils/gameRenderer.ts`)
- **Purpose**: All canvas rendering operations
- **Key Methods**: `render()`, `renderCard()`, `renderUI()`, `renderTooltip()`, etc.
- **Dependencies**: Game state (via callbacks)
- **Callbacks**: `onGetBoardCards`, `onGetHands`, `onGetGameState`, etc.

#### 10. **GameStateManager** (`app/renderer/utils/gameStateManager.ts`)
- **Purpose**: Game state management (scoring, win conditions, graveyard, card distribution)
- **Key Methods**: `giveNewCard()`, `moveCardToGraveyard()`, `recycleGraveyard()`, `checkForWin()`
- **Dependencies**: Game state (via callbacks)
- **Callbacks**: `onGetBoardCards`, `onGetHands`, `onGetGraveyard`, `onSetScore`, `onCheckWin`, etc.

#### 10.5. **CardPlacementHandler** (`app/renderer/utils/cardPlacementHandler.ts`)
- **Purpose**: Card placement validation and turn management
- **Key Methods**: `handleCardPlacement()`, `evaluatePlacement()`, `handleCorrectPlacement()`, `handleIncorrectPlacement()`
- **Dependencies**: Game state (via callbacks)
- **Callbacks**: `onGetBoardCards`, `onGetGameState`, `onSetScore`, `onCheckWin`, `onAITurn`, etc.

#### 11. **CardDealerManager** (`app/renderer/utils/cardDealerManager.ts`)
- **Purpose**: Card dealing logic for all game modes
- **Key Methods**: `dealCardsToPlayers()`, `dealCardToPlayer()`, `dealCardToOpponent()`, `dealCardsToPlayersLearningMode()`, `dealCardsToPlayersHotseat()`, `animateFirstCardToCenter()`, etc.
- **Dependencies**: Game state (via callbacks)
- **Callbacks**: `onGetRemainingCards`, `onGetGraveyard`, `onGetHands`, `onGetGameState`, `onAddCardToPlayerHand`, etc.

#### 12. **GameInitializer** (`app/renderer/utils/gameInitializer.ts`)
- **Purpose**: Game loading and initialization
- **Key Methods**: `loadGame()`, `loadAssets()`, `loadLogo()`, `loadArrowImages()`, `loadBackgroundImage()`, `initCanvas()`, `setupEventListeners()`
- **Dependencies**: Asset loading, deck loading (via callbacks)
- **Callbacks**: `onGetGameState`, `onSetDeck`, `onSetRemainingCards`, `onSetBoardCard`, `onInitializeCardDealerManager`, etc.

#### 13. **TurnTimerManager** (`app/renderer/utils/turnTimerManager.ts`)
- **Purpose**: Turn timer management for single-player (AI) mode only
- **Key Methods**: `startTurnTimer()`, `stopTurnTimer()`, `endTurn()`, `getDifficultyTimer()`, `updateTurnText()`
- **Dependencies**: Game state (via callbacks)
- **Callbacks**: `onGetGameState`, `onGetHands`, `onGetPlayerData`, `onGetTurnTimer`, `onSetTurnTimer`, `onSetTurnText`, `onSetIsPlayerTurn`, `onAITurn`, etc.
- **Note**: Timer only works in single-player mode; skipped in learning/hotseat/LAN modes

#### 14. **UIDialogManager** (`app/renderer/utils/uiDialogManager.ts`)
- **Purpose**: UI dialogs and overlays management
- **Key Methods**: `showWinDialog()`, `showLoseDialog()`, `showHotseatWinDialog()`, `showPlayerSwitchOverlay()`, `switchPlayers()`
- **Dependencies**: Game state (via callbacks), DOM manipulation
- **Callbacks**: `onGetGameState`, `onGetPlayerData`, `onGetHands`, `onSetPlayerSwitchOverlayVisible`, `onSetIsPlayerTurn`, `onRestartGame`, `onGoToMainMenu`, etc.
- **Note**: Handles all dialog creation (DOM manipulation) and player switching logic for hotseat mode

#### 15. **LearningModeManager** (`app/renderer/utils/learningModeManager.ts`)
- **Purpose**: Learning mode specific functionality
- **Key Methods**: `clearBoard()`, `resetLearningGame()`, `removeCardFromBoard()`, `showTooltipForIncorrectCard()`, `handleWeiterButtonClick()`
- **Dependencies**: Game state (via callbacks)
- **Callbacks**: `onGetBoardCards`, `onGetGraveyard`, `onGetPlayerHand`, `onGetRemainingCards`, `onGetGameState`, `onSetBoardCard`, `onSetPlacedLeft`, `onSetPlacedRight`, `onSetGraveyard`, `onAnimateCardToGraveyard`, `onLayoutAxisCards`, `onGiveNewCard`, `onLoadGame`, `onStopTurnTimer`, etc.
- **Note**: Handles learning mode specific features like clearing board, resetting game, removing incorrect cards, and showing tooltips

#### 16. **BoardNavigationManager** (`app/renderer/utils/boardNavigationManager.ts`)
- **Purpose**: Board navigation and card movement
- **Key Methods**: `moveBoardCardsLeft()`, `moveBoardCardsRight()`
- **Dependencies**: Game state (via callbacks)
- **Callbacks**: `onGetBoardCards`, `onGetScale`
- **Note**: Handles moving all board cards left or right when navigation arrows are clicked. Navigation arrow rendering is in GameRenderer, click detection is in InputHandler.

## Main Application (`app/renderer/main.ts`)

The `AxesMundiApp` class now serves as the orchestrator that:
- Initializes all modules
- Wires up callbacks between modules
- Manages the game loop
- Coordinates module interactions

**Current Size**: ~1,700 lines (reduced from ~4,400 lines)

## Shared Hardening Layer

To reduce duplicated validation and fragile string-based state access, the project now also uses a small shared layer outside the renderer utilities:

### `app/shared/deckSecurity.ts`
- Validates imported deck payloads with Zod
- Enforces safe deck IDs, image folder names, and image asset names
- Resolves imported asset paths defensively to prevent directory traversal

### `app/shared/lanProtocol.ts`
- Defines shared schemas for LAN card distribution, LAN game state snapshots, and inbound WebSocket messages
- Keeps IPC and WebSocket payload validation aligned between main/preload/renderer

### `app/renderer/utils/sessionStore.ts`
- Centralizes the most important LAN/session `localStorage` keys
- Provides typed helpers for current player, server/client identities, selected mode/difficulty, and LAN card distribution
- Reduces cross-file key drift and makes future LAN refactors easier

### `app/renderer/utils/accountScoreStore.ts`
- Provides the browser/local-storage fallback for account score persistence when the Electron preload API is unavailable
- Reuses the shared `applyScoreTransaction` logic so Electron IPC commits and local browser commits update account statistics consistently
- Keeps local account score updates idempotent through processed match IDs

## Renderer Support Modules

The renderer also contains smaller focused helpers outside the original refactor sequence:

### `app/renderer/utils/audioSettings.ts`
- Persists and applies audio settings for sound and music controls

### `app/renderer/utils/backgroundMusicManager.ts` and `soundManager.ts`
- Manage background music and one-shot sound effects

### `app/renderer/utils/deckPresentation.ts` and `userDeckCard.ts`
- Normalize deck metadata for display and build imported deck tiles safely

### `app/renderer/utils/optionsMenu.ts`
- Handles in-game options menu behavior

### `app/renderer/utils/versionPresentation.ts`
- Formats release and build metadata for UI display

### `app/renderer/lan-client.ts`, `lan-game.ts`, `lan-game-main.ts`, `lan-game-protocol.ts`
- Implement the LAN client flow and LAN game entry point in the renderer

## Callback Pattern

All modules use a callback-based architecture for communication:

```typescript
interface ModuleCallbacks {
  onGetState: () => StateType;
  onSetState: (state: StateType) => void;
  onAction: (param: ParamType) => void;
}

class Module {
  constructor(config: { callbacks: ModuleCallbacks }) {
    this.config = config;
  }
}
```

**Benefits**:
- Loose coupling between modules
- Easy to test (mock callbacks)
- Clear dependencies
- Type-safe communication

## Module Interaction Flow

```
AxesMundiApp (Orchestrator)
    ├── GameInitializer (Game initialization)
    │   └── CardDealerManager (Card dealing)
    ├── ResizeHandler (Window events)
    ├── InputHandler (Mouse events)
    │   └── CardPlacementHandler (Placement logic)
    │       └── GameStateManager (State updates)
    ├── AIManager (AI turns)
    │   └── GameStateManager (State updates)
    ├── GameRenderer (Rendering)
    │   └── Gets state via callbacks
    ├── TurnTimerManager / UIDialogManager / LearningModeManager
    ├── BoardNavigationManager / OptionsMenu
    └── GameStateManager (State management)
        └── Triggers callbacks for state changes
```

## Cross-Process Flow

```
Electron Main
    ├── BrowserWindow + app lifecycle
    ├── IPC handlers
    ├── Deck import and user deck image protocol
    └── LANWebSocketServer
            │
Preload Bridge (`window.AXM`)
            │
Renderer
    ├── Landing page and deck selection
    ├── AxesMundiApp game orchestrator
    ├── Canvas rendering/input/state modules
    └── LAN client screens and gameplay

Shared schemas validate deck, IPC, and LAN payloads across these boundaries.
```

## File Structure

```
app/
  ├── generated/
  │   └── version.ts                 # Generated build/version metadata
  ├── main/
  │   ├── index.ts                   # Electron main process, IPC, deck import, custom protocol
  │   ├── logger.ts                  # Structured main-process logger
  │   └── websocket-server.ts        # LAN WebSocket server
  ├── preload/
  │   └── index.ts                   # Safe contextBridge API exposed as window.AXM
  ├── renderer/
  │   ├── index.html                 # Landing entry
  │   ├── game.html                  # Main game entry
  │   ├── lan-game.html              # LAN game entry
  │   ├── main.ts                    # AxesMundiApp orchestrator (~1,700 lines)
  │   ├── landing.js                 # Landing page behavior
  │   ├── lan-client.ts              # LAN lobby/client flow
  │   ├── lan-game*.ts               # LAN game entry and protocol glue
  │   ├── data/                      # Deck loading, scoring, shared renderer types
  │   ├── game/                      # Card class
  │   ├── content/                   # Bundled decks, sounds, music, images
  │   ├── styles/                    # CSS
  │   └── utils/                     # Game, rendering, input, state, audio, LAN/session helpers
  └── shared/
      ├── deckSecurity.ts            # Deck import and asset path validation
      └── lanProtocol.ts             # LAN message and state schemas
```

## Testing Strategy

Each module has corresponding unit tests in `tests/unit/`:
- ✅ `resizeHandler.test.ts`
- ✅ `scaleUtils.test.ts`
- ✅ `cardLayout.test.ts`
- ✅ `cardDealer.test.ts`
- ✅ `assetLoader.test.ts`
- ✅ `canvasUtils.test.ts`
- ✅ `inputHandler.test.ts`
- ✅ `aiManager.test.ts`
- ✅ `gameRenderer.test.ts`
- ✅ `gameStateManager.test.ts`
- ✅ `cardPlacementHandler.test.ts`
- ✅ `cardDealerManager.test.ts`
- ✅ `gameInitializer.test.ts`
- ✅ `turnTimerManager.test.ts`
- ✅ `uiDialogManager.test.ts`
- ✅ `learningModeManager.test.ts`
- ✅ `boardNavigationManager.test.ts`
- ✅ `audioSettings.test.ts`
- ✅ `deckPresentation.test.ts`
- ✅ `deckSecurity.test.ts`
- ✅ `lanClient.test.ts`
- ✅ `lanProtocol.test.ts`
- ✅ `scoring.test.ts`
- ✅ `sessionStore.test.ts`
- ✅ `accountScoreStore.test.ts`
- ✅ `userDeckCard.test.ts`
- ✅ `versionPresentation.test.ts`

## Migration Progress

- **Steps 1-16**: ✅ Completed (core renderer module refactor)
- **Shared validation/security layer**: ✅ Deck import and LAN protocol schemas are centralized
- **Renderer session helpers**: ✅ Important LAN/session localStorage keys are wrapped by `sessionStore`
- **Account score persistence**: ✅ Electron uses main-process IPC, while browser/localhost mode falls back to `accountScoreStore`
- **LAN hardening**: ✅ WebSocket payload parsing and IPC/LAN state validation are schema-backed

## Key Design Decisions

1. **Callback Pattern**: Chosen over events or direct dependencies for testability
2. **Module Size**: Each module is focused and typically < 500 lines
3. **State Management**: Centralized in GameStateManager, accessed via callbacks
4. **Rendering**: Separated into GameRenderer for all drawing operations
5. **Input Handling**: Isolated in InputHandler with configurable callbacks
6. **Validation at Boundaries**: Deck import, IPC payloads, and LAN messages are validated before entering the game flow
7. **Session State Consolidation**: Renderer session persistence for key LAN/game settings is behind focused helpers instead of ad-hoc `localStorage` access
8. **Electron Boundary Hygiene**: Privileged APIs stay in the main process and are exposed to the renderer only through the typed preload bridge
