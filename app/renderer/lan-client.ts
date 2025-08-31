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

  private onMessageCallback: ((message: LANMessage) => void) | null = null;

  private onConnectionChangeCallback: ((connected: boolean) => void) | null = null;

  // Game state management for client
  private currentPlayer: string = '';

  private placedCards: CardData[] = [];

  private serverHand: CardData[] = [];

  private clientHand: CardData[] = [];

  private gameStarted: boolean = false;

  private onGameStateUpdateCallback: ((gameState: any) => void) | null = null;

  constructor(serverUrl: string, playerName: string) {
    this.serverUrl = serverUrl;
    this.playerName = playerName;

    console.log('🎮 LANGameClient constructor called for:', playerName);
    console.log('🎮 Connecting to server:', serverUrl);
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

        // Send join message
        this.sendMessage({
          type: 'join',
          playerName: this.playerName,
        });

        if (this.onConnectionChangeCallback) {
          this.onConnectionChangeCallback(true);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          console.log('🎮 LAN client: Raw WebSocket message received:', event.data);
          const message = JSON.parse(event.data);
          console.log('🎮 LAN client: Parsed message:', message);
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
        } catch (error) {
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
    } catch (error) {
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
      console.log('🎮 LAN client received message:', message.type);
      console.log('🎮 LAN client full message:', message);

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
        console.log('🎮 LAN client: RECEIVED currentPlayerSet message:', message);
        this.handleCurrentPlayerSet(message);
        break;
      case 'cardDistribution':
        this.handleCardDistributionFromServer(message.distribution);
        break;
      default:
        console.log('🎮 Unknown message type:', message.type);
      }
    } catch (error) {
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
      console.log('🎮 LAN client: Handling joined message:', message);

      // Store server player name from the joined message
      if (message.playerName) {
        localStorage.setItem('serverPlayerName', message.playerName);
        console.log('🎮 LAN client: Stored server player name:', message.playerName);
      }

      // Store client player name (our own name)
      localStorage.setItem('clientPlayerName', this.playerName);
      console.log('🎮 LAN client: Stored client player name:', this.playerName);

      // Update UI immediately with player names (no current player yet)
      console.log('🎮 LAN client: About to update player names UI...');
      this.updatePlayerNamesUI();
      console.log('🎮 LAN client: Player names UI update completed');

      // DISABLED: currentPlayer logic before card distribution
      // localStorage.setItem('currentPlayer', message.playerName);
      console.log('🎮 LAN client: DISABLED - would set current player to server:', message.playerName);

      logger.info({
        scope: 'lan/client',
        msg: 'joined message processed',
        meta: {
          serverPlayerName: message.playerName,
          clientPlayerName: this.playerName,
          currentPlayer: 'WAITING_FOR_CARD_DISTRIBUTION',
        },
      });
    } catch (error) {
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
      console.log('🎮 LAN Client: Handling remote card placement:', message);

      // IMPORTANT: Forward this message to the main callback so lan-game-main.ts can process it
      if (this.onMessageCallback) {
        console.log('🎮 LAN Client: Forwarding cardPlacement to main callback');
        this.onMessageCallback(message);
      } else {
        console.warn('🎮 LAN Client: No main callback set for cardPlacement');
      }

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
    } catch (error) {
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
      console.log('🎮 Handling remote game state update:', message);

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
    } catch (error) {
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
      console.log('🎮 Handling remote current player update:', message.currentPlayer);

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
    } catch (error) {
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
      console.log('🎮 Handling card distribution from server:', distribution);

      // Update local game state
      // DISABLED: currentPlayer logic before card distribution
      // this.currentPlayer = distribution.currentPlayer;
      this.placedCards = distribution.placedCards || [];
      this.gameStarted = distribution.gameStarted || false;

      // Store card distribution in localStorage for UI rendering
      localStorage.setItem('lanCardDistribution', JSON.stringify(distribution));

      // DISABLED: currentPlayer logic before card distribution
      // localStorage.setItem('currentPlayer', this.currentPlayer);

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

      // Cards received successfully - no confirmation needed
      console.log('🎮 Cards received successfully - ready to play!');

      // Notify callback if set
      if (this.onGameStateUpdateCallback) {
        this.onGameStateUpdateCallback(this.getGameState());
      }
    } catch (error) {
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
    console.log('🎮 LAN Client: sendMessage called with:', message);
    console.log('🎮 LAN Client: WebSocket available:', !!this.ws);
    console.log('🎮 LAN Client: WebSocket readyState:', this.ws?.readyState);
    console.log('🎮 LAN Client: WebSocket.OPEN constant:', WebSocket.OPEN);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const messageStr = JSON.stringify(message);
      console.log('🎮 LAN Client: Sending message string:', messageStr);

      this.ws.send(messageStr);
      console.log('🎮 LAN Client: Message sent successfully');

      logger.debug({
        scope: 'lan/client',
        msg: 'Sent message',
        meta: { type: message.type },
      });
    } else {
      console.warn('🎮 LAN Client: Cannot send message - not connected');
      console.warn('🎮 LAN Client: WebSocket state:', this.ws?.readyState);

      logger.warn({
        scope: 'lan/client',
        msg: 'Cannot send message - not connected',
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
    console.log('🎮 LAN Client: Sending card placement:', { cardId, boardPosition });
    console.log('🎮 LAN Client: WebSocket state:', this.ws?.readyState);
    console.log('🎮 LAN Client: Is connected:', this.isConnected());

    this.sendMessage({
      type: 'cardPlacement',
      cardId,
      boardPosition,
    });

    console.log('🎮 LAN Client: Card placement message sent');
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
      console.log('🎮 LAN client: Handling current player set:', message);

      // NOW ACTIVE: currentPlayer logic after card distribution
      const { currentPlayer } = message;

      if (currentPlayer) {
        localStorage.setItem('currentPlayer', currentPlayer);
        console.log('🎮 LAN client: Current player set to:', currentPlayer);

        // Debug: Check localStorage values
        console.log('🎮 LAN client: localStorage values:', {
          currentPlayer: localStorage.getItem('currentPlayer'),
          serverPlayerName: localStorage.getItem('serverPlayerName'),
          clientPlayerName: localStorage.getItem('clientPlayerName'),
          thisPlayerName: this.playerName,
        });

        // Update UI to show current player
        this.updateCurrentPlayerUI(currentPlayer);

        logger.info({
          scope: 'lan/client',
          msg: 'current player set successfully',
          meta: { currentPlayer },
        });
      } else {
        console.warn('🎮 LAN client: No current player in message');
      }
    } catch (error) {
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
      console.log('🎮 LAN client: Updating player names UI');

      const serverPlayerName = localStorage.getItem('serverPlayerName') || 'Server';
      const clientPlayerName = localStorage.getItem('clientPlayerName') || this.playerName;

      // Update UI elements to show player names
      const playerNameElement = document.getElementById('playerName');
      const opponentNameElement = document.getElementById('opponentName');
      const currentTurnElement = document.getElementById('currentTurn');

      if (playerNameElement) {
        playerNameElement.textContent = `Spieler: ${clientPlayerName}`;
        playerNameElement.classList.add('waiting-turn');
        playerNameElement.classList.remove('current-turn');
      }

      if (opponentNameElement) {
        opponentNameElement.textContent = `Gegner: ${serverPlayerName}`;
        opponentNameElement.classList.add('waiting-turn');
        opponentNameElement.classList.remove('current-turn');
      }

      if (currentTurnElement) {
        currentTurnElement.textContent = 'Zug: Warte auf Spielstart...';
      }

      console.log('🎮 LAN client: Player names UI updated successfully');
    } catch (error) {
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
      console.log('🎮 LAN client: Updating current player UI:', currentPlayer);

      // Debug: Check all values before updating UI
      const serverPlayerName = localStorage.getItem('serverPlayerName') || 'Server';
      const clientPlayerName = localStorage.getItem('clientPlayerName') || this.playerName;

      console.log('🎮 LAN client: Values for UI update:', {
        currentPlayer,
        serverPlayerName,
        clientPlayerName,
        thisPlayerName: this.playerName,
      });

      // Update UI elements to show current player
      const playerNameElement = document.getElementById('playerName');
      const opponentNameElement = document.getElementById('opponentName');
      const currentTurnElement = document.getElementById('currentTurn');

      console.log('🎮 LAN client: UI Elements found:', {
        playerNameElement: !!playerNameElement,
        opponentNameElement: !!opponentNameElement,
        currentTurnElement: !!currentTurnElement,
      });

      if (playerNameElement) {
        playerNameElement.textContent = `Spieler: ${clientPlayerName}`;
        if (currentPlayer === clientPlayerName) {
          playerNameElement.classList.add('current-turn');
          playerNameElement.classList.remove('waiting-turn');
          console.log('🎮 LAN client: Client is current player - highlighting');
        } else {
          playerNameElement.classList.add('waiting-turn');
          playerNameElement.classList.remove('current-turn');
          console.log('🎮 LAN client: Client is waiting - not highlighting');
        }
      }

      if (opponentNameElement) {
        opponentNameElement.textContent = `Gegner: ${serverPlayerName}`;
        if (currentPlayer === serverPlayerName) {
          opponentNameElement.classList.add('current-turn');
          opponentNameElement.classList.remove('waiting-turn');
          console.log('🎮 LAN client: Server is current player - highlighting');
        } else {
          opponentNameElement.classList.add('waiting-turn');
          opponentNameElement.classList.remove('current-turn');
          console.log('🎮 LAN client: Server is waiting - not highlighting');
        }
      }

      if (currentTurnElement) {
        currentTurnElement.textContent = `Zug: ${currentPlayer}`;
        console.log('🎮 LAN client: Current turn element updated to:', currentPlayer);
      }

      console.log('🎮 LAN client: Current player UI updated successfully');
    } catch (error) {
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
    } catch (error) {
      logger.error({
        scope: 'lan/client',
        msg: 'failed to send card distribution confirmation',
        err: { message: error.message, stack: error.stack },
      });
    }
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Legacy export for backward compatibility
export class LANClient extends LANGameClient {}
