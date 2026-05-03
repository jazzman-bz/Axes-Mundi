import { logger } from '@/utils/logger';
import { Card as CardData } from '@/data/types';

interface LANMessage {
  type: string;
  [key: string]: any;
}

/**
 * LAN Game Client - Handles LAN client logic for non-server clients
 * # LAN-Client-Logik
 */
export class LANGameClient {
  private ws: WebSocket | null = null;

  private serverUrl: string;

  private playerName: string;

  private playerAvatar: string;

  private onMessageCallback: ((message: LANMessage) => void) | null = null;

  private onConnectionChangeCallback: ((connected: boolean) => void) | null = null;

  // Game state management for client
  private currentPlayer: string = '';

  private placedCards: CardData[] = [];

  private serverHand: CardData[] = [];

  private clientHand: CardData[] = [];

  private gameStarted: boolean = false;

  private onGameStateUpdateCallback: ((gameState: any) => void) | null = null;

  constructor(serverUrl: string, playerName: string, playerAvatar: string = 'default') {
    this.serverUrl = serverUrl;
    this.playerName = playerName;
    this.playerAvatar = playerAvatar;

  }

  /**
   * Create client with server IP and port
   */
  static createWithServerInfo(serverIP: string, port: number, playerName: string, playerAvatar: string = 'default'): LANGameClient {
    const serverUrl = `ws://${serverIP}:${port}`;
    return new LANGameClient(serverUrl, playerName, playerAvatar);
  }

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    try {
      logger.info({
        scope: 'lan/client',
        msg: 'Connecting to server',
        meta: { serverUrl: this.serverUrl, playerName: this.playerName },
      });

      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        logger.info({ scope: 'lan/client', msg: 'Connected to server' });

        // Send join message with avatar
        this.sendMessage({
          type: 'join',
          playerName: this.playerName,
          playerAvatar: this.playerAvatar,
        });

        if (this.onConnectionChangeCallback) {
          this.onConnectionChangeCallback(true);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          logger.debug({
            scope: 'lan/client',
            msg: 'Received message',
            meta: { type: message.type },
          });

          // Handle message internally first
          this.handleWebSocketMessage(message);

          // Then forward to external callback if set
          if (this.onMessageCallback) {
            this.onMessageCallback(message);
          }
        } catch (error: any) {
          logger.error({
            scope: 'lan/client',
            msg: 'Failed to parse message',
            err: { message: error.message },
          });
        }
      };

      this.ws.onclose = () => {
        logger.info({ scope: 'lan/client', msg: 'Disconnected from server' });

        if (this.onConnectionChangeCallback) {
          this.onConnectionChangeCallback(false);
        }
      };

      this.ws.onerror = (error) => {
        logger.error({
          scope: 'lan/client',
          msg: 'WebSocket error',
          err: { message: error.toString() },
        });
      };
    } catch (error: any) {
      logger.error({
        scope: 'lan/client',
        msg: 'Failed to connect',
        err: { message: error.message },
      });
      throw error;
    }
  }

  /**
   * Handle WebSocket messages from server
   */
  private handleWebSocketMessage(message: any): void {
    try {
      switch (message.type) {
      case 'joined':
        this.handleJoinedMessage(message);
        break;
      case 'cardPlacement':
        this.handleRemoteCardPlacement(message);
        break;
      case 'gameStateUpdate':
        this.handleRemoteGameStateUpdate(message);
        break;
      case 'currentPlayerUpdate':
        this.handleRemoteCurrentPlayerUpdate(message);
        break;
      case 'currentPlayerSet':
        this.handleCurrentPlayerSet(message);
        break;
      case 'cardDistribution':
        this.handleCardDistributionFromServer(message.distribution);
        break;
      default:
        // Unknown message type
      }
    } catch (error: any) {
      logger.error({
        scope: 'lan/client',
        msg: 'failed to handle WebSocket message',
        err: { message: error.message, stack: error.stack },
      });
    }
  }

  /**
   * Handle joined message from server with player names
   */
  private handleJoinedMessage(message: any): void {
    try {
      // Store server player name from the joined message
      if (message.playerName) {
        localStorage.setItem('serverPlayerName', message.playerName);
      }

      // Store server player avatar from the joined message
      if (message.playerAvatar) {
        localStorage.setItem('serverPlayerAvatar', message.playerAvatar);
      } else {
        localStorage.setItem('serverPlayerAvatar', 'default');
      }

      // Store client player name from the joined message (server confirms our name)
      if (message.clientPlayerName) {
        localStorage.setItem('clientPlayerName', message.clientPlayerName);
      } else {
        // Fallback to our own name if server doesn't send it
        localStorage.setItem('clientPlayerName', this.playerName);
      }

      // Store client player avatar (our own)
      localStorage.setItem('clientPlayerAvatar', this.playerAvatar);

      // Update UI immediately with player names (no current player yet)
      this.updatePlayerNamesUI();

      logger.info({
        scope: 'lan/client',
        msg: 'joined message processed',
        meta: {
          serverPlayerName: message.playerName,
          clientPlayerName: this.playerName,
          currentPlayer: 'WAITING_FOR_CARD_DISTRIBUTION',
        },
      });
    } catch (error: any) {
      logger.error({
        scope: 'lan/client',
        msg: 'failed to handle joined message',
        err: { message: error.message, stack: error.stack },
      });
    }
  }

  /**
   * Handle remote card placement from server
   */
  private handleRemoteCardPlacement(message: any): void {
    try {
      // Also update local game state for consistency
      const { cardId, boardPosition, playerName } = message;

      // Find the card in the appropriate hand
      let card: CardData | undefined;
      if (playerName === localStorage.getItem('serverPlayerName')) {
        card = this.serverHand.find((c) => c.id === cardId);
      } else {
        card = this.clientHand.find((c) => c.id === cardId);
      }

      if (card) {
        // Remove from hand and add to placed cards
        if (playerName === localStorage.getItem('serverPlayerName')) {
          this.serverHand = this.serverHand.filter((c) => c.id !== cardId);
        } else {
          this.clientHand = this.clientHand.filter((c) => c.id !== cardId);
        }

        this.placedCards.push(card);

        logger.info({
          scope: 'lan/client',
          msg: 'remote card placement processed',
          meta: {
            cardId, boardPosition, playerName, placedCardsCount: this.placedCards.length,
          },
        });

        // Notify callback if set
        if (this.onGameStateUpdateCallback) {
          this.onGameStateUpdateCallback(this.getGameState());
        }
      }
    } catch (error: any) {
      logger.error({
        scope: 'lan/client',
        msg: 'failed to handle remote card placement',
        err: { message: error.message, stack: error.stack },
      });
    }
  }

  /**
   * Handle remote game state update from server
   */
  private handleRemoteGameStateUpdate(message: any): void {
    try {

      // NOW ACTIVE: currentPlayer logic after card distribution
      this.currentPlayer = message.currentPlayer;
      this.placedCards = message.placedCards || [];

      // Store current player
      localStorage.setItem('currentPlayer', this.currentPlayer);

      logger.info({
        scope: 'lan/client',
        msg: 'remote game state updated',
        meta: {
          currentPlayer: this.currentPlayer,
          placedCardsCount: this.placedCards.length,
        },
      });

      // Notify callback if set
      if (this.onGameStateUpdateCallback) {
        this.onGameStateUpdateCallback(this.getGameState());
      }
    } catch (error: any) {
      logger.error({
        scope: 'lan/client',
        msg: 'failed to handle remote game state update',
        err: { message: error.message, stack: error.stack },
      });
    }
  }

  /**
   * Handle remote current player update from server
   */
  private handleRemoteCurrentPlayerUpdate(message: any): void {
    try {
      // NOW ACTIVE: currentPlayer logic after card distribution
      this.currentPlayer = message.currentPlayer;
      localStorage.setItem('currentPlayer', this.currentPlayer);

      // Update UI
      this.updateCurrentPlayerUI(this.currentPlayer);

      logger.info({
        scope: 'lan/client',
        msg: 'remote current player updated',
        meta: { currentPlayer: this.currentPlayer },
      });

      // Notify callback if set
      if (this.onGameStateUpdateCallback) {
        this.onGameStateUpdateCallback(this.getGameState());
      }
    } catch (error: any) {
      logger.error({
        scope: 'lan/client',
        msg: 'failed to handle remote current player update',
        err: { message: error.message, stack: error.message },
      });
    }
  }

  /**
   * Handle card distribution from server
   */
  private handleCardDistributionFromServer(distribution: any): void {
    try {
      // Update local game state
      this.currentPlayer = distribution.currentPlayer;
      this.placedCards = distribution.placedCards || [];
      this.gameStarted = distribution.gameStarted || false;

      // Store card distribution in localStorage for UI rendering
      localStorage.setItem('lanCardDistribution', JSON.stringify(distribution));

      // Store current player in localStorage
      localStorage.setItem('currentPlayer', this.currentPlayer);

      logger.info({
        scope: 'lan/client',
        msg: 'card distribution received from server',
        meta: {
          boardCard: distribution.boardCard?.id,
          serverHandSize: distribution.serverHand?.length,
          clientHandSize: distribution.clientHand?.length,
          deckSize: distribution.deckOrder?.length,
          placedCardsCount: distribution.placedCards?.length,
          gameStarted: distribution.gameStarted,
        },
      });

      // Notify callback if set
      if (this.onGameStateUpdateCallback) {
        this.onGameStateUpdateCallback(this.getGameState());
      }
    } catch (error: any) {
      logger.error({
        scope: 'lan/client',
        msg: 'failed to handle card distribution from server',
        err: { message: error.message, stack: error.stack },
      });
    }
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send a message to the server
   */
  sendMessage(message: LANMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const messageStr = JSON.stringify(message);
      this.ws.send(messageStr);

      logger.debug({
        scope: 'lan/client',
        msg: 'Sent message',
        meta: { type: message.type },
      });
    } else {
      logger.warn({
        scope: 'lan/client',
        msg: 'Cannot send message - not connected',
        meta: {
          readyState: this.ws?.readyState ?? null,
          messageType: message.type,
        },
      });
    }
  }

  /**
   * Send ready status
   */
  sendReady(): void {
    this.sendMessage({
      type: 'ready',
      playerName: this.playerName,
    });
  }

  /**
   * Send card placement
   */
  sendCardPlacement(cardId: string, boardPosition: number): void {
    this.sendMessage({
      type: 'cardPlacement',
      cardId,
      boardPosition,
    });
  }

  /**
   * Send player switch
   */
  sendPlayerSwitch(nextPlayer: string): void {
    this.sendMessage({
      type: 'playerSwitch',
      nextPlayer,
    });
  }

  /**
   * Send game restart request
   */
  sendGameRestart(): void {
    this.sendMessage({
      type: 'gameRestart',
    });
  }

  /**
   * Send remaining cards update
   */
  sendRemainingCardsUpdate(remainingCardsCount: number): void {
    this.sendMessage({
      type: 'remainingCardsUpdate',
      remainingCardsCount,
    });
  }

  /**
   * Send game state update
   */
  sendGameStateUpdate(gameState: any): void {
    this.sendMessage({
      type: 'gameStateUpdate',
      ...gameState,
    });
  }

  /**
   * Get current player name
   */
  getCurrentPlayer(): string {
    return this.currentPlayer;
  }

  /**
   * Get placed cards on axis
   */
  getPlacedCards(): CardData[] {
    return this.placedCards;
  }

  /**
   * Check if game has started
   */
  isGameStarted(): boolean {
    return this.gameStarted;
  }

  /**
   * Get game state for synchronization
   */
  getGameState(): any {
    return {
      currentPlayer: this.currentPlayer,
      placedCards: this.placedCards,
      serverHand: this.serverHand,
      clientHand: this.clientHand,
      gameStarted: this.gameStarted,
    };
  }

  /**
   * Set callback for game state updates
   */
  onGameStateUpdate(callback: (gameState: any) => void): void {
    this.onGameStateUpdateCallback = callback;
  }

  /**
   * Set message callback
   */
  onMessage(callback: (message: LANMessage) => void): void {
    this.onMessageCallback = callback;
  }

  /**
   * Set connection change callback
   */
  onConnectionChange(callback: (connected: boolean) => void): void {
    this.onConnectionChangeCallback = callback;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Handle current player set event from server (after card distribution)
   */
  private handleCurrentPlayerSet(message: any): void {
    try {
      // NOW ACTIVE: currentPlayer logic after card distribution
      const { currentPlayer } = message;

      if (currentPlayer) {
        localStorage.setItem('currentPlayer', currentPlayer);

        // Update UI to show current player
        this.updateCurrentPlayerUI(currentPlayer);

        logger.info({
          scope: 'lan/client',
          msg: 'current player set successfully',
          meta: { currentPlayer },
        });
      }
    } catch (error: any) {
      logger.error({
        scope: 'lan/client',
        msg: 'failed to handle current player set',
        err: { message: error.message, stack: error.stack },
      });
    }
  }

  /**
   * Update player names UI (client-side) - called immediately after connection
   */
  private updatePlayerNamesUI(): void {
    try {
      const serverPlayerName = localStorage.getItem('serverPlayerName') || 'Server';
      const clientPlayerName = localStorage.getItem('clientPlayerName') || this.playerName;

      // Update UI elements to show player names
      const playerNameElement = document.getElementById('playerName');
      const opponentNameElement = document.getElementById('opponentName');
      const currentTurnElement = document.getElementById('currentTurn');

      if (playerNameElement) {
        playerNameElement.textContent = `Player: ${clientPlayerName}`;
        playerNameElement.classList.add('waiting-turn');
        playerNameElement.classList.remove('current-turn');
      }

      if (opponentNameElement) {
        opponentNameElement.textContent = `Opponent: ${serverPlayerName}`;
        opponentNameElement.classList.add('waiting-turn');
        opponentNameElement.classList.remove('current-turn');
      }

      if (currentTurnElement) {
        currentTurnElement.textContent = 'Turn: Waiting for game start...';
      }
    } catch (error: any) {
      logger.error({
        scope: 'lan/client',
        msg: 'failed to update player names UI',
        err: { message: error.message, stack: error.stack },
      });
    }
  }

  /**
   * Update current player UI (client-side)
   */
  private updateCurrentPlayerUI(currentPlayer: string): void {
    try {
      const serverPlayerName = localStorage.getItem('serverPlayerName') || 'Server';
      const clientPlayerName = localStorage.getItem('clientPlayerName') || this.playerName;

      // Update UI elements to show current player
      const playerNameElement = document.getElementById('playerName');
      const opponentNameElement = document.getElementById('opponentName');
      const currentTurnElement = document.getElementById('currentTurn');

      if (playerNameElement) {
        playerNameElement.textContent = `Player: ${clientPlayerName}`;
        if (currentPlayer === clientPlayerName) {
          playerNameElement.classList.add('current-turn');
          playerNameElement.classList.remove('waiting-turn');
        } else {
          playerNameElement.classList.add('waiting-turn');
          playerNameElement.classList.remove('current-turn');
        }
      }

      if (opponentNameElement) {
        opponentNameElement.textContent = `Opponent: ${serverPlayerName}`;
        if (currentPlayer === serverPlayerName) {
          opponentNameElement.classList.add('current-turn');
          opponentNameElement.classList.remove('waiting-turn');
        } else {
          opponentNameElement.classList.add('waiting-turn');
          opponentNameElement.classList.remove('current-turn');
        }
      }

      if (currentTurnElement) {
        currentTurnElement.textContent = `Turn: ${currentPlayer}`;
      }
    } catch (error: any) {
      logger.error({
        scope: 'lan/client',
        msg: 'failed to update current player UI',
        err: { message: error.message, stack: error.stack },
      });
    }
  }

  /**
   * Send card distribution confirmation to server
   */
  sendCardDistributionConfirmation(confirmation: any): void {
    try {
      logger.info({
        scope: 'lan/client',
        msg: 'sending card distribution confirmation to server',
      });

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(confirmation));

        logger.info({
          scope: 'lan/client',
          msg: 'card distribution confirmation sent to server',
        });
      } else {
        logger.warn({
          scope: 'lan/client',
          msg: 'WebSocket not available for card distribution confirmation',
        });
      }
    } catch (error: any) {
      logger.error({
        scope: 'lan/client',
        msg: 'failed to send card distribution confirmation',
        err: { message: error.message, stack: error.stack },
      });
    }
  }

}

// Legacy export for backward compatibility
export class LANClient extends LANGameClient {}
