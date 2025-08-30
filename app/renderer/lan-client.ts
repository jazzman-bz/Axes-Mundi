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
        meta: { serverUrl: this.serverUrl, playerName: this.playerName } 
      });

      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        logger.info({ scope: 'lan/client', msg: 'Connected to server' });
        
        // Send join message
        this.sendMessage({
          type: 'join',
          playerName: this.playerName
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
            meta: { type: message.type } 
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
            err: { message: error.message } 
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
          err: { message: error.toString() } 
        });
      };

    } catch (error) {
      logger.error({ 
        scope: 'lan/client', 
        msg: 'Failed to connect', 
        err: { message: error.message } 
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
        err: { message: error.message, stack: error.stack }
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
      
      // Set current player to server (server starts first)
      localStorage.setItem('currentPlayer', message.playerName);
      console.log('🎮 LAN client: Set current player to server:', message.playerName);
      
      logger.info({
        scope: 'lan/client',
        msg: 'joined message processed',
        meta: { 
          serverPlayerName: message.playerName,
          clientPlayerName: this.playerName,
          currentPlayer: message.playerName
        }
      });
      
    } catch (error) {
      logger.error({
        scope: 'lan/client',
        msg: 'failed to handle joined message',
        err: { message: error.message, stack: error.stack }
      });
    }
  }

  /**
   * Handle remote card placement from server
   */
  private handleRemoteCardPlacement(message: any): void {
    try {
      console.log('🎮 Handling remote card placement:', message);
      
      // Update local game state
      const { cardId, position, playerName } = message;
      
      // Find the card in the appropriate hand
      let card: CardData | undefined;
      if (playerName === localStorage.getItem('serverPlayerName')) {
        card = this.serverHand.find(c => c.id === cardId);
      } else {
        card = this.clientHand.find(c => c.id === cardId);
      }
      
      if (card) {
        // Remove from hand and add to placed cards
        if (playerName === localStorage.getItem('serverPlayerName')) {
          this.serverHand = this.serverHand.filter(c => c.id !== cardId);
        } else {
          this.clientHand = this.clientHand.filter(c => c.id !== cardId);
        }
        
        this.placedCards.push(card);
        
        logger.info({
          scope: 'lan/client',
          msg: 'remote card placement processed',
          meta: { cardId, position, playerName, placedCardsCount: this.placedCards.length }
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
        err: { message: error.message, stack: error.stack }
      });
    }
  }

  /**
   * Handle remote game state update from server
   */
  private handleRemoteGameStateUpdate(message: any): void {
    try {
      console.log('🎮 Handling remote game state update:', message);
      
      // Update local game state
      this.currentPlayer = message.currentPlayer;
      this.placedCards = message.placedCards || [];
      
      // Update localStorage
      localStorage.setItem('currentPlayer', this.currentPlayer);
      
      logger.info({
        scope: 'lan/client',
        msg: 'remote game state updated',
        meta: { 
          currentPlayer: this.currentPlayer,
          placedCardsCount: this.placedCards.length
        }
      });
      
      // Notify callback if set
      if (this.onGameStateUpdateCallback) {
        this.onGameStateUpdateCallback(this.getGameState());
      }
      
    } catch (error) {
      logger.error({
        scope: 'lan/client',
        msg: 'failed to handle remote game state update',
        err: { message: error.message, stack: error.stack }
      });
    }
  }

  /**
   * Handle remote current player update from server
   */
  private handleRemoteCurrentPlayerUpdate(message: any): void {
    try {
      console.log('🎮 Handling remote current player update:', message);
      
      // Update local current player
      this.currentPlayer = message.currentPlayer;
      localStorage.setItem('currentPlayer', this.currentPlayer);
      
      logger.info({
        scope: 'lan/client',
        msg: 'remote current player updated',
        meta: { currentPlayer: this.currentPlayer }
      });
      
      // Notify callback if set
      if (this.onGameStateUpdateCallback) {
        this.onGameStateUpdateCallback(this.getGameState());
      }
      
    } catch (error) {
      logger.error({
        scope: 'lan/client',
        msg: 'failed to handle remote current player update',
        err: { message: error.message, stack: error.stack }
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
      this.currentPlayer = distribution.currentPlayer;
      this.placedCards = distribution.placedCards || [];
      this.gameStarted = distribution.gameStarted || false;
      
      // Store card distribution in localStorage for UI rendering
      localStorage.setItem('lanCardDistribution', JSON.stringify(distribution));
      
      // Update localStorage
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
          gameStarted: distribution.gameStarted
        }
      });

      // Notify callback if set
      if (this.onGameStateUpdateCallback) {
        this.onGameStateUpdateCallback(this.getGameState());
      }
      
    } catch (error) {
      logger.error({
        scope: 'lan/client',
        msg: 'failed to handle card distribution from server',
        err: { message: error.message, stack: error.stack }
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
      this.ws.send(JSON.stringify(message));
      logger.debug({ 
        scope: 'lan/client', 
        msg: 'Sent message', 
        meta: { type: message.type } 
      });
    } else {
      logger.warn({ 
        scope: 'lan/client', 
        msg: 'Cannot send message - not connected' 
      });
    }
  }

  /**
   * Send ready status
   */
  sendReady(): void {
    this.sendMessage({
      type: 'ready',
      playerName: this.playerName
    });
  }

  /**
   * Send card placement
   */
  sendCardPlacement(cardId: string, position: number): void {
    this.sendMessage({
      type: 'placeCard',
      cardId,
      position
    });
  }

  /**
   * Send game state update
   */
  sendGameStateUpdate(gameState: any): void {
    this.sendMessage({
      type: 'gameStateUpdate',
      ...gameState
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
      gameStarted: this.gameStarted
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
}

// Legacy export for backward compatibility
export class LANClient extends LANGameClient {}
