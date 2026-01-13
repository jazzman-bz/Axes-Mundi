# Axes-Mundi Architecture Documentation

**Last Updated:** 2025-01-12  
**Status:** Steps 1-14 completed, Steps 15-16 planned

## Overview

The Axes-Mundi application has been refactored from a monolithic `main.ts` file (~4,400 lines) into a modular architecture with focused, testable components. The architecture follows a callback-based pattern for loose coupling between modules.

## Architecture Principles

1. **Separation of Concerns**: Each module handles a specific domain (rendering, input, state, etc.)
2. **Callback Pattern**: Modules communicate via typed callbacks to maintain loose coupling
3. **Testability**: All modules are unit testable with mocked dependencies
4. **Single Responsibility**: Each module has one clear purpose

## Module Structure

### Completed Modules (Steps 1-10)

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

### Planned Modules (Steps 15-16)

#### 15. **LearningModeManager** (Planned)
- **Purpose**: Turn timer management
- **Methods**: `startTurnTimer()`, `stopTurnTimer()`, `endTurn()`, etc.

#### 14. **UIDialogManager** (Planned)
- **Purpose**: UI dialogs and overlays
- **Methods**: `showWinDialog()`, `showLoseDialog()`, `showPlayerSwitchOverlay()`, etc.

#### 15. **LearningModeManager** (Planned)
- **Purpose**: Learning mode specific functionality
- **Methods**: `clearBoard()`, `resetLearningGame()`, `removeCardFromBoard()`, etc.

#### 16. **BoardNavigationManager** (Planned)
- **Purpose**: Board navigation and card movement
- **Methods**: `moveBoardCardsLeft()`, `moveBoardCardsRight()`, etc.

## Main Application (`app/renderer/main.ts`)

The `AxesMundiApp` class now serves as the orchestrator that:
- Initializes all modules
- Wires up callbacks between modules
- Manages the game loop
- Coordinates module interactions

**Current Size**: ~1,900 lines (reduced from ~4,400 lines)

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
    └── GameStateManager (State management)
        └── Triggers callbacks for state changes
```

## File Structure

```
app/renderer/
  ├── main.ts                    # Main orchestrator (~2,100 lines)
  ├── utils/
  │   ├── resizeHandler.ts       # ✅ Step 1
  │   ├── scaleUtils.ts          # ✅ Step 2
  │   ├── cardLayout.ts          # ✅ Step 3
  │   ├── cardDealer.ts          # ✅ Step 4
  │   ├── assetLoader.ts         # ✅ Step 5
  │   ├── canvasUtils.ts         # ✅ Step 6
  │   ├── inputHandler.ts        # ✅ Step 7
  │   ├── aiManager.ts           # ✅ Step 8
  │   ├── gameRenderer.ts        # ✅ Step 9
  │   ├── gameStateManager.ts     # ✅ Step 10
  │   ├── cardPlacementHandler.ts # ✅ Step 10.5
  │   ├── cardDealerManager.ts    # ✅ Step 11
  │   ├── gameInitializer.ts     # ✅ Step 12
  │   ├── turnTimerManager.ts    # ✅ Step 13
  │   ├── uiDialogManager.ts     # ✅ Step 14
  │   ├── learningModeManager.ts # ⏳ Step 15 (Planned)
  │   └── boardNavigationManager.ts # ⏳ Step 16 (Planned)
  └── ...
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

## Migration Progress

- **Steps 1-14**: ✅ Completed
- **Steps 15-16**: ⏳ Planned (see TODO.md)

## Key Design Decisions

1. **Callback Pattern**: Chosen over events or direct dependencies for testability
2. **Module Size**: Each module is focused and typically < 500 lines
3. **State Management**: Centralized in GameStateManager, accessed via callbacks
4. **Rendering**: Separated into GameRenderer for all drawing operations
5. **Input Handling**: Isolated in InputHandler with configurable callbacks
