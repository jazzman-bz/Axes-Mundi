import { logger } from '@/utils/logger';
import { soundManager, SoundType } from '@/utils/soundManager';

/**
 * Callbacks for UIDialogManager to interact with game state
 */
export interface UIDialogManagerCallbacks {
  /** Get current game state */
  onGetGameState: () => {
    score: number;
    currentTurn: number;
    currentPlayerIndex: number;
  };

  /** Get player data for hotseat mode */
  onGetPlayerData: () => {
    player1Data: { name: string; avatar: string } | null;
    player2Data: { name: string; avatar: string } | null;
  };

  /** Get hands for player switching */
  onGetHands: () => {
    player1Hand: any[];
    player2Hand: any[];
  };

  /** Set player switch overlay visibility */
  onSetPlayerSwitchOverlayVisible: (visible: boolean) => void;

  /** Set player switch overlay bounds */
  onSetPlayerSwitchOverlayBounds: (bounds: { x: number; y: number; width: number; height: number } | null) => void;

  /** Set player turn state */
  onSetIsPlayerTurn: (isPlayerTurn: boolean) => void;

  /** Set current player index */
  onSetCurrentPlayerIndex: (index: number) => void;

  /** Set current player hand */
  onSetCurrentPlayerHand: (hand: any[]) => void;

  /** Set next player hand */
  onSetNextPlayerHand: (hand: any[]) => void;

  /** Actions */
  onRestartGame: () => void;
  onGoToMainMenu: () => void;
  onUpdateInputHandlerConfig: () => void;
  onLayoutHotseatHands: () => void;
  onUpdateTurnText: () => void;
}

/**
 * Configuration for UIDialogManager
 */
export interface UIDialogManagerConfig {
  callbacks: UIDialogManagerCallbacks;
}

/**
 * UIDialogManager - Handles UI dialogs and overlays
 */
export class UIDialogManager {
  private config: UIDialogManagerConfig;

  constructor(config: UIDialogManagerConfig) {
    this.config = config;
  }

  /**
   * Show win dialog (single-player mode)
   */
  public showWinDialog(): void {
    const gameState = this.config.callbacks.onGetGameState();
    const title = '🎉 Congratulations! 🎉';
    const message = `You successfully sorted all the cards!\n\nFinal score: ${gameState.score}\nNumber of turns: ${gameState.currentTurn}`;

    this.showCustomDialog(title, message);

    logger.info({
      scope: 'renderer/dialog',
      msg: 'win dialog shown',
      meta: {
        score: gameState.score,
        turns: gameState.currentTurn,
      },
    });
  }

  /**
   * Show lose dialog (single-player mode)
   */
  public showLoseDialog(): void {
    const gameState = this.config.callbacks.onGetGameState();
    const title = '😔 Verloren! 😔';
    const message = `Your opponent sorted all cards first!\n\nFinal score: ${gameState.score}\nNumber of turns: ${gameState.currentTurn}`;

    this.showCustomDialog(title, message);

    logger.info({
      scope: 'renderer/dialog',
      msg: 'lose dialog shown',
      meta: {
        score: gameState.score,
        turns: gameState.currentTurn,
      },
    });
  }

  /**
   * Show hotseat win dialog
   */
  public showHotseatWinDialog(winnerName: string): void {
    const title = '🎉 Congratulations! 🎉';
    const message = `${winnerName} hat das Spiel gewonnen!\n\nAlle Karten wurden erfolgreich sortiert!`;

    this.showCustomDialog(title, message);

    logger.info({
      scope: 'renderer/dialog',
      msg: 'hotseat win dialog shown',
      meta: { winnerName },
    });
  }

  /**
   * Show custom dialog with two buttons (Play Again and Main Menu)
   */
  private showCustomDialog(title: string, message: string): void {
    try {
      // Create dialog overlay
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: Arial, sans-serif;
      `;

      // Create dialog box
      const dialog = document.createElement('div');
      dialog.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 20px;
        padding: 40px;
        max-width: 500px;
        width: 90%;
        text-align: center;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        color: white;
        border: 2px solid rgba(255, 255, 255, 0.2);
      `;

      // Create title
      const titleElement = document.createElement('h2');
      titleElement.textContent = title;
      titleElement.style.cssText = `
        margin: 0 0 20px 0;
        font-size: 28px;
        font-weight: bold;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
      `;

      // Create message
      const messageElement = document.createElement('p');
      messageElement.textContent = message;
      messageElement.style.cssText = `
        margin: 0 0 30px 0;
        font-size: 16px;
        line-height: 1.5;
        white-space: pre-line;
      `;

      // Create button container
      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = `
        display: flex;
        gap: 15px;
        justify-content: center;
        flex-wrap: wrap;
      `;

      // Create "Nochmal spielen" button
      const playAgainButton = document.createElement('button');
      playAgainButton.textContent = 'Nochmal spielen';
      playAgainButton.style.cssText = `
        background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
        color: white;
        border: none;
        padding: 15px 30px;
        border-radius: 25px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
        min-width: 150px;
      `;

      // Create "Main Menu" button
      const mainMenuButton = document.createElement('button');
      mainMenuButton.textContent = 'Main Menu';
      mainMenuButton.style.cssText = `
        background: linear-gradient(135deg, #FF6B6B 0%, #ee5a52 100%);
        color: white;
        border: none;
        padding: 15px 30px;
        border-radius: 25px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(255, 107, 107, 0.3);
        min-width: 150px;
      `;

      // Add hover effects
      playAgainButton.addEventListener('mouseenter', () => {
        playAgainButton.style.transform = 'translateY(-2px)';
        playAgainButton.style.boxShadow = '0 6px 20px rgba(76, 175, 80, 0.4)';
      });
      playAgainButton.addEventListener('mouseleave', () => {
        playAgainButton.style.transform = 'translateY(0)';
        playAgainButton.style.boxShadow = '0 4px 15px rgba(76, 175, 80, 0.3)';
      });

      mainMenuButton.addEventListener('mouseenter', () => {
        mainMenuButton.style.transform = 'translateY(-2px)';
        mainMenuButton.style.boxShadow = '0 6px 20px rgba(255, 107, 107, 0.4)';
      });
      mainMenuButton.addEventListener('mouseleave', () => {
        mainMenuButton.style.transform = 'translateY(0)';
        mainMenuButton.style.boxShadow = '0 4px 15px rgba(255, 107, 107, 0.3)';
      });

      // Add click handlers with debouncing
      let isButtonClicked = false;

      playAgainButton.addEventListener('click', () => {
        if (isButtonClicked) return;
        isButtonClicked = true;

        soundManager.play(SoundType.BUTTON_CLICK);
        playAgainButton.style.opacity = '0.6';

        // Small delay to allow sound to play before removing overlay
        setTimeout(() => {
          document.body.removeChild(overlay);
          this.config.callbacks.onRestartGame();
        }, 100);
      });

      mainMenuButton.addEventListener('click', () => {
        if (isButtonClicked) return;
        isButtonClicked = true;

        soundManager.play(SoundType.BUTTON_CLICK);
        mainMenuButton.style.opacity = '0.6';

        // Small delay to allow sound to play before navigation
        setTimeout(() => {
          document.body.removeChild(overlay);
          this.config.callbacks.onGoToMainMenu();
        }, 100);
      });

      // Assemble dialog
      buttonContainer.appendChild(playAgainButton);
      buttonContainer.appendChild(mainMenuButton);
      dialog.appendChild(titleElement);
      dialog.appendChild(messageElement);
      dialog.appendChild(buttonContainer);
      overlay.appendChild(dialog);

      // Add to page
      document.body.appendChild(overlay);

      logger.info({
        scope: 'renderer/dialog',
        msg: 'custom dialog displayed',
        meta: { title },
      });
    } catch (error: any) {
      logger.error({
        scope: 'renderer/dialog',
        msg: 'failed to show custom dialog',
        err: { message: (error as Error).message },
      });

      // Fallback to simple confirm
      const playAgain = confirm(`${title}\n\n${message}\n\nNochmal spielen?`);
      if (playAgain) {
        this.config.callbacks.onRestartGame();
      } else {
        this.config.callbacks.onGoToMainMenu();
      }
    }
  }

  /**
   * Show player switch overlay (hotseat mode)
   * Note: The actual rendering is done by GameRenderer, this just manages state
   */
  public showPlayerSwitchOverlay(): void {
    this.config.callbacks.onSetPlayerSwitchOverlayVisible(true);
    // Disable player turn while overlay is visible
    this.config.callbacks.onSetIsPlayerTurn(false);
    this.config.callbacks.onUpdateInputHandlerConfig();

    logger.info({
      scope: 'renderer/dialog',
      msg: 'player switch overlay shown',
      meta: {
        currentPlayerIndex: this.config.callbacks.onGetGameState().currentPlayerIndex,
      },
    });
  }

  /**
   * Switch players in hotseat mode
   */
  public switchPlayers(): void {
    const gameState = this.config.callbacks.onGetGameState();
    const hands = this.config.callbacks.onGetHands();

    // Switch player index
    const newPlayerIndex = gameState.currentPlayerIndex === 0 ? 1 : 0;
    this.config.callbacks.onSetCurrentPlayerIndex(newPlayerIndex);

    // Update current and next player hands based on new index
    const currentPlayerHand = newPlayerIndex === 0 ? hands.player1Hand : hands.player2Hand;
    const nextPlayerHand = newPlayerIndex === 0 ? hands.player2Hand : hands.player1Hand;
    this.config.callbacks.onSetCurrentPlayerHand(currentPlayerHand);
    this.config.callbacks.onSetNextPlayerHand(nextPlayerHand);

    // Layout hands (card backs are handled in render method)
    this.config.callbacks.onLayoutHotseatHands();

    // Update turn text to show new current player
    this.config.callbacks.onUpdateTurnText();

    // Hide overlay and re-enable player turn
    this.config.callbacks.onSetPlayerSwitchOverlayVisible(false);
    this.config.callbacks.onSetPlayerSwitchOverlayBounds(null);
    this.config.callbacks.onSetIsPlayerTurn(true);
    this.config.callbacks.onUpdateInputHandlerConfig();

    logger.info({
      scope: 'renderer/dialog',
      msg: 'player switched',
      meta: {
        newPlayerIndex,
        currentPlayerCards: currentPlayerHand.length,
        nextPlayerCards: nextPlayerHand.length,
      },
    });
  }
}
