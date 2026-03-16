import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UIDialogManager, UIDialogManagerCallbacks } from '@/utils/uiDialogManager';

// Mock the logger
vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock soundManager
vi.mock('@/utils/soundManager', () => ({
  soundManager: {
    play: vi.fn(),
  },
  SoundType: {
    BUTTON_CLICK: 'BUTTON_CLICK',
  },
}));

/**
 * Helper to create mock callbacks
 */
function createMockCallbacks(): UIDialogManagerCallbacks {
  let currentPlayerIndex = 0;

  return {
    onGetGameState: vi.fn(() => ({
      score: 100,
      currentTurn: 5,
      currentPlayerIndex,
    })),
    onGetPlayerData: vi.fn(() => ({
      player1Data: { name: 'Player 1', avatar: '👤' },
      player2Data: { name: 'Player 2', avatar: '👤' },
    })),
    onGetHands: vi.fn(() => ({
      player1Hand: [{ id: '1' }, { id: '2' }],
      player2Hand: [{ id: '3' }, { id: '4' }, { id: '5' }],
    })),
    onSetPlayerSwitchOverlayVisible: vi.fn(),
    onSetPlayerSwitchOverlayBounds: vi.fn(),
    onSetIsPlayerTurn: vi.fn(),
    onSetCurrentPlayerIndex: vi.fn((index: number) => {
      currentPlayerIndex = index;
    }),
    onSetCurrentPlayerHand: vi.fn(),
    onSetNextPlayerHand: vi.fn(),
    onRestartGame: vi.fn(),
    onGoToMainMenu: vi.fn(),
    onUpdateInputHandlerConfig: vi.fn(),
    onLayoutHotseatHands: vi.fn(),
    onUpdateTurnText: vi.fn(),
  };
}

describe('UIDialogManager', () => {
  let manager: UIDialogManager;
  let callbacks: UIDialogManagerCallbacks;
  let mockDocument: any;

  beforeEach(() => {
    vi.useFakeTimers();
    callbacks = createMockCallbacks();

    // Mock DOM methods
    const mockElements: any[] = [];
    mockDocument = {
      createElement: vi.fn((tag: string) => {
        const element = {
          tagName: tag.toUpperCase(),
          textContent: '',
          style: {} as any,
          addEventListener: vi.fn(),
          appendChild: vi.fn(),
        };
        mockElements.push(element);
        return element;
      }),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    };

    // Replace global document
    global.document = mockDocument as any;

    manager = new UIDialogManager({ callbacks });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('showWinDialog', () => {
    it('should create dialog with correct title', () => {
      manager.showWinDialog();

      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
      expect(mockDocument.createElement).toHaveBeenCalledWith('h2');
      const titleElement = mockDocument.createElement.mock.results.find(
        (r: any) => r.value.tagName === 'H2',
      )?.value;
      expect(titleElement?.textContent).toBe('🎉 Congratulations! 🎉');
    });

    it('should create dialog with correct message including score and turns', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        score: 150,
        currentTurn: 10,
        currentPlayerIndex: 0,
      }));

      manager.showWinDialog();

      const messageElement = mockDocument.createElement.mock.results.find(
        (r: any) => r.value.tagName === 'P',
      )?.value;
      expect(messageElement?.textContent).toContain('You successfully sorted all the cards!');
      expect(messageElement?.textContent).toContain('Final score: 150');
      expect(messageElement?.textContent).toContain('Number of turns: 10');
    });

    it('should call showCustomDialog with correct parameters', () => {
      manager.showWinDialog();

      expect(mockDocument.createElement).toHaveBeenCalled();
      expect(mockDocument.body.appendChild).toHaveBeenCalled();
    });

    it('should log info message', async () => {
      const { logger } = await import('@/utils/logger');
      manager.showWinDialog();

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'renderer/dialog',
          msg: 'win dialog shown',
        }),
      );
    });
  });

  describe('showLoseDialog', () => {
    it('should create dialog with correct title', () => {
      manager.showLoseDialog();

      const titleElement = mockDocument.createElement.mock.results.find(
        (r: any) => r.value.tagName === 'H2',
      )?.value;
      expect(titleElement?.textContent).toBe('😔 You Lost! 😔');
    });

    it('should create dialog with correct message including score and turns', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        score: 75,
        currentTurn: 8,
        currentPlayerIndex: 0,
      }));

      manager.showLoseDialog();

      const messageElement = mockDocument.createElement.mock.results.find(
        (r: any) => r.value.tagName === 'P',
      )?.value;
      expect(messageElement?.textContent).toContain('Your opponent sorted all cards first!');
      expect(messageElement?.textContent).toContain('Final score: 75');
      expect(messageElement?.textContent).toContain('Number of turns: 8');
    });

    it('should log info message', async () => {
      const { logger } = await import('@/utils/logger');
      manager.showLoseDialog();

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'renderer/dialog',
          msg: 'lose dialog shown',
        }),
      );
    });
  });

  describe('showHotseatWinDialog', () => {
    it('should create dialog with correct title', () => {
      manager.showHotseatWinDialog('Alice');

      const titleElement = mockDocument.createElement.mock.results.find(
        (r: any) => r.value.tagName === 'H2',
      )?.value;
      expect(titleElement?.textContent).toBe('🎉 Congratulations! 🎉');
    });

    it('should create dialog with correct message including winner name', () => {
      manager.showHotseatWinDialog('Bob');

      const messageElement = mockDocument.createElement.mock.results.find(
        (r: any) => r.value.tagName === 'P',
      )?.value;
      expect(messageElement?.textContent).toContain('Bob won the game!');
      expect(messageElement?.textContent).toContain('All cards were sorted successfully!');
    });

    it('should handle empty winner name', () => {
      manager.showHotseatWinDialog('');

      const messageElement = mockDocument.createElement.mock.results.find(
        (r: any) => r.value.tagName === 'P',
      )?.value;
      expect(messageElement?.textContent).toContain('won the game!');
    });

    it('should log info message', async () => {
      const { logger } = await import('@/utils/logger');
      manager.showHotseatWinDialog('Alice');

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'renderer/dialog',
          msg: 'hotseat win dialog shown',
          meta: { winnerName: 'Alice' },
        }),
      );
    });
  });

  describe('showCustomDialog', () => {
    it('should create overlay element with correct styles', () => {
      manager.showWinDialog();

      const overlay = mockDocument.createElement.mock.results[0]?.value;
      expect(overlay?.tagName).toBe('DIV');
      expect(overlay?.style.cssText).toContain('position: fixed');
      expect(overlay?.style.cssText).toContain('z-index: 10000');
    });

    it('should create dialog box with correct styles', () => {
      manager.showWinDialog();

      const dialog = mockDocument.createElement.mock.results[1]?.value;
      expect(dialog?.tagName).toBe('DIV');
      expect(dialog?.style.cssText).toContain('border-radius: 20px');
    });

    it('should create "Play Again" button with correct text', () => {
      manager.showWinDialog();

      const buttons = mockDocument.createElement.mock.results.filter(
        (r: any) => r.value.tagName === 'BUTTON',
      );
      const playAgainButton = buttons[0]?.value;
      expect(playAgainButton?.textContent).toBe('Play Again');
    });

    it('should create "Main Menu" button with correct text', () => {
      manager.showWinDialog();

      const buttons = mockDocument.createElement.mock.results.filter(
        (r: any) => r.value.tagName === 'BUTTON',
      );
      const mainMenuButton = buttons[1]?.value;
      expect(mainMenuButton?.textContent).toBe('Main Menu');
    });

    it('should add hover effects to buttons', () => {
      manager.showWinDialog();

      const buttons = mockDocument.createElement.mock.results.filter(
        (r: any) => r.value.tagName === 'BUTTON',
      );
      buttons.forEach((button: any) => {
        expect(button.value.addEventListener).toHaveBeenCalledWith('mouseenter', expect.any(Function));
        expect(button.value.addEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function));
      });
    });

    it('should prevent double-clicks (debouncing)', () => {
      manager.showWinDialog();

      const buttons = mockDocument.createElement.mock.results.filter(
        (r: any) => r.value.tagName === 'BUTTON',
      );
      const playAgainButton = buttons[0]?.value;

      // Find click handler
      const clickHandler = playAgainButton.addEventListener.mock.calls.find(
        (call: any[]) => call[0] === 'click',
      )?.[1];

      // Simulate first click
      clickHandler?.();
      expect(callbacks.onRestartGame).not.toHaveBeenCalled(); // Should be delayed

      // Simulate second click immediately (should be ignored)
      clickHandler?.();

      // Advance timer
      vi.advanceTimersByTime(100);

      // Should only be called once
      expect(callbacks.onRestartGame).toHaveBeenCalledTimes(1);
    });

    it('should play sound on button click', async () => {
      const { soundManager } = await import('@/utils/soundManager');
      manager.showWinDialog();

      const buttons = mockDocument.createElement.mock.results.filter(
        (r: any) => r.value.tagName === 'BUTTON',
      );
      const playAgainButton = buttons[0]?.value;

      const clickHandler = playAgainButton.addEventListener.mock.calls.find(
        (call: any[]) => call[0] === 'click',
      )?.[1];

      clickHandler?.();
      vi.advanceTimersByTime(100);

      expect(soundManager.play).toHaveBeenCalledWith('BUTTON_CLICK');
    });

    it('should call onRestartGame when "Play Again" clicked', () => {
      manager.showWinDialog();

      const buttons = mockDocument.createElement.mock.results.filter(
        (r: any) => r.value.tagName === 'BUTTON',
      );
      const playAgainButton = buttons[0]?.value;

      const clickHandler = playAgainButton.addEventListener.mock.calls.find(
        (call: any[]) => call[0] === 'click',
      )?.[1];

      clickHandler?.();
      vi.advanceTimersByTime(100);

      expect(callbacks.onRestartGame).toHaveBeenCalled();
      expect(mockDocument.body.removeChild).toHaveBeenCalled();
    });

    it('should call onGoToMainMenu when "Main Menu" clicked', () => {
      manager.showWinDialog();

      const buttons = mockDocument.createElement.mock.results.filter(
        (r: any) => r.value.tagName === 'BUTTON',
      );
      const mainMenuButton = buttons[1]?.value;

      const clickHandler = mainMenuButton.addEventListener.mock.calls.find(
        (call: any[]) => call[0] === 'click',
      )?.[1];

      clickHandler?.();
      vi.advanceTimersByTime(100);

      expect(callbacks.onGoToMainMenu).toHaveBeenCalled();
      expect(mockDocument.body.removeChild).toHaveBeenCalled();
    });

    it('should remove overlay from DOM after button click', () => {
      manager.showWinDialog();

      const overlay = mockDocument.createElement.mock.results[0]?.value;
      const buttons = mockDocument.createElement.mock.results.filter(
        (r: any) => r.value.tagName === 'BUTTON',
      );
      const playAgainButton = buttons[0]?.value;

      const clickHandler = playAgainButton.addEventListener.mock.calls.find(
        (call: any[]) => call[0] === 'click',
      )?.[1];

      clickHandler?.();
      vi.advanceTimersByTime(100);

      expect(mockDocument.body.removeChild).toHaveBeenCalledWith(overlay);
    });

    it('should handle errors gracefully (fallback to confirm)', () => {
      // Mock document.createElement to throw error
      mockDocument.createElement = vi.fn(() => {
        throw new Error('DOM error');
      });

      // Mock confirm
      global.confirm = vi.fn(() => true);

      manager.showWinDialog();

      expect(global.confirm).toHaveBeenCalled();
      expect(callbacks.onRestartGame).toHaveBeenCalled();
    });

    it('should call onGoToMainMenu if confirm returns false', () => {
      mockDocument.createElement = vi.fn(() => {
        throw new Error('DOM error');
      });

      global.confirm = vi.fn(() => false);

      manager.showWinDialog();

      expect(callbacks.onGoToMainMenu).toHaveBeenCalled();
    });
  });

  describe('showPlayerSwitchOverlay', () => {
    it('should set overlay visible via callback', () => {
      manager.showPlayerSwitchOverlay();

      expect(callbacks.onSetPlayerSwitchOverlayVisible).toHaveBeenCalledWith(true);
    });

    it('should disable player turn via callback', () => {
      manager.showPlayerSwitchOverlay();

      expect(callbacks.onSetIsPlayerTurn).toHaveBeenCalledWith(false);
    });

    it('should update input handler config', () => {
      manager.showPlayerSwitchOverlay();

      expect(callbacks.onUpdateInputHandlerConfig).toHaveBeenCalled();
    });

    it('should log info message', async () => {
      const { logger } = await import('@/utils/logger');
      manager.showPlayerSwitchOverlay();

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'renderer/dialog',
          msg: 'player switch overlay shown',
        }),
      );
    });
  });

  describe('switchPlayers', () => {
    it('should switch player index from 0 to 1', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        score: 100,
        currentTurn: 5,
        currentPlayerIndex: 0,
      }));

      manager.switchPlayers();

      expect(callbacks.onSetCurrentPlayerIndex).toHaveBeenCalledWith(1);
    });

    it('should switch player index from 1 to 0', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        score: 100,
        currentTurn: 5,
        currentPlayerIndex: 1,
      }));

      manager.switchPlayers();

      expect(callbacks.onSetCurrentPlayerIndex).toHaveBeenCalledWith(0);
    });

    it('should update current player hand correctly (0 → 1)', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        score: 100,
        currentTurn: 5,
        currentPlayerIndex: 0,
      }));

      manager.switchPlayers();

      expect(callbacks.onSetCurrentPlayerHand).toHaveBeenCalledWith([
        { id: '3' },
        { id: '4' },
        { id: '5' },
      ]);
    });

    it('should update next player hand correctly (0 → 1)', () => {
      callbacks.onGetGameState = vi.fn(() => ({
        score: 100,
        currentTurn: 5,
        currentPlayerIndex: 0,
      }));

      manager.switchPlayers();

      expect(callbacks.onSetNextPlayerHand).toHaveBeenCalledWith([
        { id: '1' },
        { id: '2' },
      ]);
    });

    it('should call layoutHotseatHands', () => {
      manager.switchPlayers();

      expect(callbacks.onLayoutHotseatHands).toHaveBeenCalled();
    });

    it('should call updateTurnText', () => {
      manager.switchPlayers();

      expect(callbacks.onUpdateTurnText).toHaveBeenCalled();
    });

    it('should hide overlay and clear bounds', () => {
      manager.switchPlayers();

      expect(callbacks.onSetPlayerSwitchOverlayVisible).toHaveBeenCalledWith(false);
      expect(callbacks.onSetPlayerSwitchOverlayBounds).toHaveBeenCalledWith(null);
    });

    it('should re-enable player turn', () => {
      manager.switchPlayers();

      expect(callbacks.onSetIsPlayerTurn).toHaveBeenCalledWith(true);
    });

    it('should update input handler config', () => {
      manager.switchPlayers();

      expect(callbacks.onUpdateInputHandlerConfig).toHaveBeenCalled();
    });

    it('should log info message', async () => {
      const { logger } = await import('@/utils/logger');
      manager.switchPlayers();

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'renderer/dialog',
          msg: 'player switched',
        }),
      );
    });
  });
});
