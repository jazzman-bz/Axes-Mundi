import { WebSocketServer, WebSocket } from 'ws';
import { logger } from './logger';

interface Player {
  id: string;
  name: string;
  ws: WebSocket;
}

export class LANWebSocketServer {
  private wss: WebSocketServer | null = null;
  private players: Map<string, Player> = new Map();
  private port: number;
  private serverPlayerName: string;

  constructor(port: number = 8080, serverPlayerName: string = 'Server') {
    this.port = port;
    this.serverPlayerName = serverPlayerName;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        logger.info({ 
          scope: 'main/websocket', 
          msg: 'Creating WebSocket server', 
          meta: { port: this.port } 
        });
        
        this.wss = new WebSocketServer({ port: this.port });
        
        this.wss.on('listening', () => {
          logger.info({ 
            scope: 'main/websocket', 
            msg: 'LAN server started successfully', 
            meta: { port: this.port } 
          });
          resolve();
        });

        this.wss.on('connection', (ws: WebSocket) => {
          this.handleConnection(ws);
        });

        this.wss.on('error', (error) => {
          logger.error({ 
            scope: 'main/websocket', 
            msg: 'WebSocket server error', 
            err: { message: error.message, stack: error.stack } 
          });
          reject(error);
        });

      } catch (error: any) {
        logger.error({ 
          scope: 'main/websocket', 
          msg: 'Failed to create WebSocket server', 
          err: { message: error.message, stack: error.stack } 
        });
        reject(error);
      }
    });
  }

  private handleConnection(ws: WebSocket): void {
    const playerId = this.generatePlayerId();
    
    logger.info({ 
      scope: 'main/websocket', 
      msg: 'New client connected', 
      meta: { playerId } 
    });

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(playerId, ws, message);
      } catch (error: any) {
        logger.error({ 
          scope: 'main/websocket', 
          msg: 'Failed to parse message', 
          err: { message: error.message } 
        });
      }
    });

    ws.on('close', () => {
      this.handleDisconnection(playerId);
    });

    ws.on('error', (error) => {
      logger.error({ 
        scope: 'main/websocket', 
        msg: 'WebSocket connection error', 
        meta: { playerId },
        err: { message: error.message } 
      });
      this.handleDisconnection(playerId);
    });
  }

  private handleMessage(playerId: string, ws: WebSocket, message: any): void {
    logger.info({ 
      scope: 'main/websocket', 
      msg: 'Received message from client', 
      meta: { playerId, messageType: message.type, message } 
    });

    switch (message.type) {
      case 'join':
        this.handleJoin(playerId, ws, message.playerName);
        break;
      case 'ready':
        this.handleReady(playerId);
        break;
      case 'deckSelection':
        this.handleDeckSelection(playerId, message.deckId);
        break;
      case 'deckResponse':
        this.handleDeckResponse(playerId, message.deckId, message.available);
        break;
      case 'startingPlayer':
        this.handleStartingPlayer(playerId, message.startingPlayer, message.serverStarts);
        break;
      case 'cardDistribution':
        this.handleCardDistribution(playerId, message);
        break;
      default:
        logger.warn({ 
          scope: 'main/websocket', 
          msg: 'Unknown message type', 
          meta: { playerId, messageType: message.type } 
        });
    }
  }

  private handleJoin(playerId: string, ws: WebSocket, playerName: string): void {
    const player: Player = {
      id: playerId,
      name: playerName,
      ws
    };

    this.players.set(playerId, player);

    logger.info({ 
      scope: 'main/websocket', 
      msg: 'Player joined', 
      meta: { playerId, playerName } 
    });

    // Send confirmation to the joining player with SERVER's name
    const joinedMessage = {
      type: 'joined',
      playerId,
      message: `Connected to server successfully`,
      playerName: this.serverPlayerName  // Send SERVER's name to client
    };
    
    ws.send(JSON.stringify(joinedMessage));
    logger.info({ 
      scope: 'main/websocket', 
      msg: 'Sent joined confirmation to client', 
      meta: { 
        playerId, 
        clientPlayerName: playerName,  // Client's name
        serverPlayerName: this.serverPlayerName,  // Server's name
        message: joinedMessage 
      } 
    });

    // Notify all other players about the new player
    this.broadcastToOthers(playerId, {
      type: 'playerJoined',
      playerName,
      message: `${playerName} has joined the game!`
    });

    // Log that we have a player connected
    logger.info({ 
      scope: 'main/websocket', 
      msg: 'Player connected - server is no longer waiting', 
      meta: { 
        playerId, 
        playerName,
        totalPlayers: this.players.size
      } 
    });

    // Send notification to renderer process to update UI with client name
    if (global.mainWindow && global.mainWindow.webContents) {
      global.mainWindow.webContents.send('lan-status-update', {
        type: 'playerConnected',
        playerName,
        clientPlayerName: playerName, // Store client name for server-client
        message: `Player ${playerName} connected to server!`
      });
    }

    // Log current server state
    logger.info({ 
      scope: 'main/websocket', 
      msg: 'Server state after player joined', 
      meta: { 
        playerId, 
        playerName,
        totalPlayers: this.players.size,
        allPlayerNames: Array.from(this.players.values()).map(p => p.name)
      } 
    });
  }

  private handleReady(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) {
      logger.warn({ 
        scope: 'main/websocket', 
        msg: 'Player not found for ready message', 
        meta: { playerId } 
      });
      return;
    }

    logger.info({ 
      scope: 'main/websocket', 
      msg: 'Player ready', 
      meta: { 
        playerId, 
        playerName: player.name,
        totalPlayers: this.players.size,
        allPlayerNames: Array.from(this.players.values()).map(p => p.name)
      } 
    });

    // Send confirmation to the player who sent ready
    const readyConfirmedMessage = {
      type: 'readyConfirmed',
      playerName: player.name,
      message: 'You are ready!'
    };
    
    player.ws.send(JSON.stringify(readyConfirmedMessage));
    logger.info({ 
      scope: 'main/websocket', 
      msg: 'Sent ready confirmation to player', 
      meta: { playerId, playerName: player.name } 
    });

    // Notify all other players
    const playerReadyMessage = {
      type: 'playerReady',
      playerName: player.name
    };
    
    this.broadcastToOthers(playerId, playerReadyMessage);
    logger.info({ 
      scope: 'main/websocket', 
      msg: 'Broadcasted player ready to others', 
      meta: { 
        playerId, 
        playerName: player.name,
        otherPlayersCount: this.players.size - 1
      } 
    });

    // Send notification to renderer process to update UI
    if (global.mainWindow && global.mainWindow.webContents) {
      global.mainWindow.webContents.send('lan-status-update', {
        type: 'playerReady',
        playerName: player.name,
        message: `Player ${player.name} is ready! Handshake complete!`
      });
    }
  }

  /**
   * Send deck selection to client
   */
  async sendDeckSelection(deckId: string): Promise<void> {
    logger.info({ 
      scope: 'main/websocket', 
      msg: 'Sending deck selection to client', 
      meta: { deckId } 
    });

    // Send to all connected clients
    for (const [, player] of this.players) {
      player.ws.send(JSON.stringify({
        type: 'deckSelection',
        deckId,
        message: `Server selected deck: ${deckId}`
      }));
    }
  }

  /**
   * Send card distribution to all connected clients
   */
  async sendCardDistribution(distribution: any): Promise<void> {
    logger.info({
      scope: 'main/websocket',
      msg: 'Sending card distribution to client',
      meta: { 
        boardCard: distribution.boardCard?.id,
        serverHandSize: distribution.serverHand?.length,
        clientHandSize: distribution.clientHand?.length,
        deckSize: distribution.deckOrder?.length
      }
    });

    // Debug: Log the complete distribution received from renderer
    console.log('🎴 Main process received card distribution:');
    console.log('🎴 Deck ID:', distribution.deckId);
    console.log('🎴 Deck Name:', distribution.deckName);
    console.log('🎴 Board Card:', distribution.boardCard ? distribution.boardCard.title : 'none');
    console.log('🎴 Server Hand Size:', distribution.serverHand?.length || 0);
    console.log('🎴 Client Hand Size:', distribution.clientHand?.length || 0);
    console.log('🎴 Deck Size:', distribution.deckOrder?.length || 0);
    console.log('🎴 Starting Player:', distribution.startingPlayer);

    // Send to all connected clients
    for (const [, player] of this.players) {
      const message = {
        type: 'cardDistribution',
        distribution: distribution, // Wrap in distribution object for consistency
        message: 'Card distribution received from server'
      };
      
      logger.info({
        scope: 'main/websocket',
        msg: 'Sending card distribution message to client',
        meta: { 
          playerId: player.id,
          playerName: player.name,
          messageType: message.type,
          boardCard: distribution.boardCard?.title || 'none',
          serverHandSize: distribution.serverHand?.length || 0,
          clientHandSize: distribution.clientHand?.length || 0,
          deckSize: distribution.deckOrder?.length || 0
        }
      });
      
      player.ws.send(JSON.stringify(message));
    }

    // Send notification to renderer process to update UI
    if (global.mainWindow && global.mainWindow.webContents) {
      global.mainWindow.webContents.send('lan-status-update', {
        type: 'cardDistribution',
        distribution,
        message: 'Card distribution sent to client'
      });
    }
  }

  /**
   * Send starting player selection to all connected clients
   */
  async sendStartingPlayer(startingPlayer: string, serverStarts: boolean): Promise<void> {
    logger.info({
      scope: 'main/websocket',
      msg: 'Sending starting player selection to client',
      meta: { startingPlayer, serverStarts }
    });

    // Send to all connected clients
    for (const [, player] of this.players) {
      player.ws.send(JSON.stringify({
        type: 'startingPlayer',
        startingPlayer,
        serverStarts,
        message: `Starting player selected: ${startingPlayer}`
      }));
    }

    // Send notification to renderer process to update UI
    if (global.mainWindow && global.mainWindow.webContents) {
      global.mainWindow.webContents.send('lan-status-update', {
        type: 'startingPlayer',
        startingPlayer,
        serverStarts,
        message: `Spieler ${startingPlayer} beginnt das Spiel!`
      });
    }
  }

  /**
   * Send game start trigger to all connected clients
   */
  async sendGameStartTrigger(): Promise<void> {
    logger.info({
      scope: 'main/websocket',
      msg: 'Sending game start trigger to client'
    });

    // Send to all connected clients
    for (const [, player] of this.players) {
      player.ws.send(JSON.stringify({
        type: 'startGame',
        message: 'Game start trigger received from server'
      }));
    }

    // Send notification to renderer process to update UI
    if (global.mainWindow && global.mainWindow.webContents) {
      global.mainWindow.webContents.send('lan-status-update', {
        type: 'startGame',
        message: 'Game start trigger sent to client'
      });
    }
  }

  /**
   * Handle deck selection from server
   */
  private handleDeckSelection(_playerId: string, deckId: string): void {
    const player = this.players.get(_playerId);
    if (!player) {
      logger.warn({ 
        scope: 'main/websocket', 
        msg: 'Player not found for deck selection', 
        meta: { playerId: _playerId } 
      });
      return;
    }

    logger.info({ 
      scope: 'main/websocket', 
      msg: 'Received deck selection from client', 
      meta: { playerId: _playerId, playerName: player.name, deckId } 
    });

    // This would normally check if the deck is available
    // For now, we'll assume it's available and send back a response
    player.ws.send(JSON.stringify({
      type: 'deckResponse',
      deckId,
      available: true,
      message: `Deck ${deckId} is available`
    }));

    // Explicitly use playerId to satisfy TypeScript
    logger.debug({ 
      scope: 'main/websocket', 
      msg: 'Deck selection handled', 
      meta: { playerId: _playerId } 
    });
  }

  /**
   * Handle deck response from client
   */
  private handleDeckResponse(playerId: string, deckId: string, available: boolean): void {
    const player = this.players.get(playerId);
    if (!player) return;

    logger.info({ 
      scope: 'main/websocket', 
      msg: 'Received deck response from client', 
      meta: { playerId, playerName: player.name, deckId, available } 
    });

    // Send notification to renderer process to update UI
    if (global.mainWindow && global.mainWindow.webContents) {
      global.mainWindow.webContents.send('lan-status-update', {
        type: 'deckResponse',
        deckId,
        available,
        playerName: player.name,
        message: available ? 
          `Deck ${deckId} wurde gewählt und ist vorhanden!` : 
          `Deck ${deckId} nicht vorhanden!`
      });
    }
  }

  /**
   * Handle card distribution from client
   */
  private handleCardDistribution(playerId: string, message: any): void {
    const player = this.players.get(playerId);
    if (!player) return;

    logger.info({ 
      scope: 'main/websocket', 
      msg: 'Received card distribution from client', 
      meta: { 
        playerId, 
        playerName: player.name,
        boardCard: message.boardCard?.id,
        serverHandSize: message.serverHand?.length,
        clientHandSize: message.clientHand?.length,
        deckSize: message.deckOrder?.length
      } 
    });

    // Send notification to renderer process to update UI
    if (global.mainWindow && global.mainWindow.webContents) {
      global.mainWindow.webContents.send('lan-status-update', {
        type: 'cardDistribution',
        distribution: message,
        message: 'Card distribution received from client'
      });
    }
  }

  /**
   * Handle starting player selection from client
   */
  private handleStartingPlayer(playerId: string, startingPlayer: string, serverStarts: boolean): void {
    const player = this.players.get(playerId);
    if (!player) return;

    logger.info({ 
      scope: 'main/websocket', 
      msg: 'Received starting player selection from client', 
      meta: { playerId, playerName: player.name, startingPlayer, serverStarts } 
    });

    // Send notification to renderer process to update UI
    if (global.mainWindow && global.mainWindow.webContents) {
      global.mainWindow.webContents.send('lan-status-update', {
        type: 'startingPlayer',
        startingPlayer,
        serverStarts,
        message: `Spieler ${startingPlayer} beginnt das Spiel!`
      });
    }
  }

  private handleDisconnection(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;

    this.players.delete(playerId);

    logger.info({ 
      scope: 'main/websocket', 
      msg: 'Player disconnected', 
      meta: { playerId, playerName: player.name } 
    });

    // Notify remaining players
    this.broadcastToAll({
      type: 'playerLeft',
      playerName: player.name,
      message: `${player.name} has left the game`
    });
  }

  private broadcastToAll(message: any): void {
    const messageStr = JSON.stringify(message);
    this.players.forEach(player => {
      if (player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(messageStr);
      }
    });
  }

  private broadcastToOthers(excludePlayerId: string, message: any): void {
    const messageStr = JSON.stringify(message);
    this.players.forEach(player => {
      if (player.id !== excludePlayerId && player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(messageStr);
      }
    });
  }

  private generatePlayerId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  stop(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
      this.players.clear();
      logger.info({ scope: 'main/websocket', msg: 'LAN server stopped' });
    }
  }

  getPlayerCount(): number {
    return this.players.size;
  }
}
