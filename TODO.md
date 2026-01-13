# Axes-Mundi TODO List

**Last Updated:** 2025-01-12  
**Status:** Active development tasks and future improvements

> **Note:** Completed tasks have been moved to [COMPLETED.md](./COMPLETED.md)

---

## 🎨 **Sprint 4: Polish & UX**

### **High Priority**
- [ ] **Performance Optimization** - 60 FPS garantieren (monitoring & optimization)
- [ ] **Memory Management** - Ressourcen-Optimierung (profiling & cleanup)

### **Medium Priority**
- [ ] **Responsive Design** - Verschiedene Bildschirmgrößen (mobile/tablet support)
- [ ] **Smooth Animations** - Übergänge zwischen Sektionen (GSAP transitions)
- [ ] **Error Handling** - Benutzerfreundliche Fehlermeldungen (error boundaries)
- [ ] **Loading States** - Visuelle Rückmeldung (loading indicators)
- [ ] **Accessibility** - Barrierefreiheit (WCAG compliance, keyboard navigation)
- [ ] **Internationalization** - Mehrsprachigkeit (i18n system)
- [ ] **Settings Menu** - Einstellungen (volume, graphics, etc.)

### **Low Priority**
- [ ] **Keyboard Navigation** - Vollständige Tastatur-Unterstützung (full keyboard control)

---

## 🎮 **Game Enhancements**

### **Medium Priority**
- [ ] **Progress Tracking** - Spieler-Fortschritt speichern (persistent stats)
- [ ] **Achievements** - Erfolge-System (achievement tracking)
- [ ] **Custom Decks** - Benutzerdefinierte Decks (deck import/creation)
- [ ] **Statistics** - Spieler-Statistiken (detailed game statistics)

---

## 🔧 **Technical Debt**

### **High Priority**
- [ ] **TypeScript Strict Mode** - Alle `any` Types entfernen (strict type safety)
- [ ] **Error Boundaries** - Robuste Fehlerbehandlung (React-style error boundaries)
- [ ] **E2E Tests** - Spielablauf testen (Playwright E2E tests)

### **Medium Priority**
- [ ] **Performance Monitoring** - FPS-Tracking (real-time performance metrics)

---

## 🐛 **Known Issues**

### **Critical**
- [ ] **Electron White Screen** - Electron lädt falsche URL (verify if still an issue)
- [ ] **Port 5179 Conflicts** - Vite-Server Port-Probleme (verify if still an issue)

### **Medium**
- [ ] **Memory Leaks** - Event Listener Cleanup (audit and fix)
- [ ] **Responsive Issues** - Mobile Layout (mobile device testing)

---

## 📊 **Success Metrics**

### **Performance**
- [ ] **Startup Time** < 3 Sekunden (measure and optimize)
- [ ] **FPS** = 60 FPS während Gameplay (monitor and maintain)
- [ ] **Memory Usage** < 200MB RAM (profile and optimize)

### **User Experience**
- [ ] **Navigation** - Max 3 Klicks zu jedem Feature (verify UX flow)
- [ ] **Error Rate** < 1% Fehler (monitor and track)
- [ ] **User Retention** - 80% Spieler spielen weiter (analytics)

---

## 🔧 **Main.ts Refactoring Steps (11-16)**

### **Step 11: Extract Card Dealing Logic** ✅
- [x] **Create CardDealerManager module** - Extract card dealing methods
  - [x] `dealCardsToPlayers()` - Main card dealing logic for AI mode
  - [x] `dealCardToPlayer()` - Deal single card to player
  - [x] `dealCardToOpponent()` - Deal single card to opponent
  - [x] `dealCardsToPlayersLearningMode()` - Learning mode card dealing
  - [x] `dealCardsToPlayersHotseat()` - Hotseat mode card dealing
  - [x] `dealCardToPlayer1()` - Deal card to player 1 (hotseat)
  - [x] `dealCardToPlayer2()` - Deal card to player 2 (hotseat)
  - [x] `animateCardToHand()` - Animate card from deck to hand
  - [x] `animateOpponentCardFromDeck()` - Animate opponent card from deck
  - [x] `animateFirstCardToCenter()` - Animate first card to board center
  - [x] Create unit tests for CardDealerManager (26 tests, all passing)
  - [x] Update main.ts to use CardDealerManager

### **Step 12: Extract Game Initialization Logic** ✅
- [x] **Create GameInitializer module** - Extract game loading and initialization
  - [x] `loadGame()` - Main game loading logic
  - [x] `loadAssets()` - Load UI assets (logo, arrows, background)
  - [x] `loadLogo()` - Load logo image
  - [x] `loadArrowImages()` - Load navigation arrows
  - [x] `loadBackgroundImage()` - Load background image
  - [x] `initCanvas()` - Canvas initialization
  - [x] `setupEventListeners()` - Event listener setup
  - [x] Create unit tests for GameInitializer (29 tests, all passing)
  - [x] Update main.ts to use GameInitializer

### **Step 13: Extract Turn Timer Management**
- [ ] **Create TurnTimerManager module** - Extract turn timer logic
  - [ ] `startTurnTimer()` - Start player turn timer
  - [ ] `stopTurnTimer()` - Stop turn timer
  - [ ] `endTurn()` - Handle turn timeout (switch to AI)
  - [ ] `getDifficultyTimer()` - Get timer duration based on difficulty
  - [ ] `updateTurnText()` - Update turn display text
  - [ ] Create unit tests for TurnTimerManager
  - [ ] Update main.ts to use TurnTimerManager

### **Step 14: Extract UI Dialogs and Overlays**
- [ ] **Create UIDialogManager module** - Extract dialog and overlay management
  - [ ] `showWinDialog()` - Show win dialog
  - [ ] `showLoseDialog()` - Show lose dialog
  - [ ] `showHotseatWinDialog()` - Show hotseat win dialog
  - [ ] `showPlayerSwitchOverlay()` - Show player switch overlay (hotseat)
  - [ ] `switchPlayers()` - Switch players in hotseat mode
  - [ ] Dialog rendering and button handling
  - [ ] Create unit tests for UIDialogManager
  - [ ] Update main.ts to use UIDialogManager

### **Step 15: Extract Learning Mode Logic**
- [ ] **Create LearningModeManager module** - Extract learning mode specific functionality
  - [ ] `clearBoard()` - Clear board and move cards to graveyard
  - [ ] `resetLearningGame()` - Reset learning game with same deck
  - [ ] `removeCardFromBoard()` - Remove incorrect card from board
  - [ ] `showTooltipForIncorrectCard()` - Show tooltip for incorrect placement
  - [ ] Learning mode specific button handling (Weiter, Clear Board, Reset)
  - [ ] Create unit tests for LearningModeManager
  - [ ] Update main.ts to use LearningModeManager

### **Step 16: Extract Board Navigation Logic**
- [ ] **Create BoardNavigationManager module** - Extract board navigation and card movement
  - [ ] `moveBoardCardsLeft()` - Move all cards left for navigation
  - [ ] `moveBoardCardsRight()` - Move all cards right for navigation
  - [ ] Navigation arrow rendering and click handling
  - [ ] Board bounds calculation and scrolling logic
  - [ ] Create unit tests for BoardNavigationManager
  - [ ] Update main.ts to use BoardNavigationManager

---

## 🚀 **Architecture Future Improvements**

### **High Priority**
- [ ] **State Machine Integration** - Consider using XState for complex game flows
- [ ] **UI Component Extraction** - Extract more UI logic into separate components
- [ ] **Dependency Injection** - Consider a dependency injection container for callback management
- [ ] **Integration Tests** - Add integration tests for module interactions

### **Medium Priority**
- [ ] **Event System** - Evaluate if event system would be better than callbacks for some use cases
- [ ] **Module Registry** - Create a module registry for dynamic module loading
- [ ] **Performance Monitoring** - Add performance metrics to module interactions
- [ ] **Documentation** - Add JSDoc comments to all public module APIs

### **Low Priority**
- [ ] **Module Bundling** - Optimize module bundling for production
- [ ] **Type Safety** - Enhance type safety with stricter TypeScript configurations
- [ ] **Code Generation** - Consider code generation for callback interfaces

---

## 📋 **Quick Reference**

### **Current Status**
- ✅ Core game features: **Complete**
- ✅ Landing page & navigation: **Complete**
- ✅ All game modes: **Complete** (Single Player, Hotseat, LAN, Learning)
- ✅ Architecture refactoring: **Steps 1-12 Complete** (Steps 13-16 pending)
- ✅ Unit tests: **Core modules covered** (55 tests passing)
- ⏳ Polish & UX: **In Progress**
- ⏳ E2E tests: **Pending**

### **Next Priorities**
1. Complete refactoring steps 13-16
2. Add E2E tests with Playwright
3. Performance optimization and monitoring
4. Polish UX (animations, responsive design, accessibility)
