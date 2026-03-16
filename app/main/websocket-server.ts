import { WebSocketServer, WebSocket } from 'ws';
import { networkInterfaces } from 'os';
import { logger } from './logger';

interface Player {
  id: string;
  name: string;
  avatar: string;
  ws: WebSocket;
}

export class LANWebSocketServer {
  private wss: WebSocketServer | null = null;

  private players: Map<string, Player> = new Map();

  private port: number;

  private serverPlayerName: string;

  private serverPlayerAvatar: string;

  private serverIP: string;

  constructor(port: number = 8080, serverPlayerName: string = 'Server', serverPlayerAvatar: string = 'default') {
    this.port = port;
    this.serverPlayerName = serverPlayerName;
    this.serverPlayerAvatar = serverPlayerAvatar;
    this.serverIP = LANWebSocketServer.getLocalIPAddress();
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        logger.info({
          scope: 'main/websocket',
          msg: 'Creating WebSocket server',
          meta: { port: this.port },
        });

        this.wss = new WebSocketServer({ port: this.port });

        this.wss.on('listening', () => {
          logger.info({
            scope: 'main/websocket',
            msg: 'LAN server started successfully',
            meta: { port: this.port },
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
            err: { message: error.message, stack: error.stack },
          });
          reject(error);
        });
      } catch (error: any) {
        logger.error({
          scope: 'main/websocket',
          msg: 'Failed to create WebSocket server',
          err: { message: error.message, stack: error.stack },
        });
        reject(error);
      }
    });
  }

  private handleConnection(ws: WebSocket): void {
    const playerId = LANWebSocketServer.generatePlayerId();

    logger.info({
      scope: 'main/websocket',
      msg: 'New client connected',
      meta: { playerId },
    });

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(playerId, ws, message);
      } catch (error: any) {
        logger.error({
          scope: 'main/websocket',
          msg: 'Failed to parse message',
          err: { message: error.message },
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
        err: { message: error.message },
      });
      this.handleDisconnection(playerId);
    });
  }

  private handleMessage(playerId: string, ws: WebSocket, message: any): void {
    // Add console.log for debugging
    console.log('🎮 WebSocket Server: Received message from client:', {
      playerId,
      messageType: message.type,
      message,
    });

    logger.info({
      scope: 'main/websocket',
      msg: 'Received message from client',
      meta: { playerId, messageType: message.type, message },
    });

    /* eslint-disable indent, @typescript-eslint/indent */
    switch (message.type) {
      case 'join':
        this.handleJoin(playerId, ws, message.playerName, message.playerAvatar || 'default');
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
      case 'currentPlayerSet':
        this.handleCurrentPlayerSet(playerId, message.currentPlayer);
        break;
      case 'playerTurnChanged':
        this.handlePlayerTurnChanged(playerId, message.currentPlayer);
        break;
      case 'cardDistribution':
        this.handleCardDistribution(playerId, message);
        break;
      case 'placeCard':
      case 'cardPlacement':
        this.handleCardPlacement(playerId, message);
        break;
      case 'playerSwitch':
        this.handlePlayerSwitch(playerId, message);
        break;
      case 'gameRestart':
        this.handleGameRestart(playerId, message);
        break;
      case 'remainingCardsUpdate':
        this.handleRemainingCardsUpdate(playerId, message);
        break;
      case 'gameStateUpdate':
        this.handleGameStateUpdate(playerId, message);
        break;
      default:
        logger.warn({
          scope: 'main/websocket',
          msg: 'Unknown message type',
          meta: { playerId, messageType: message.type },
        });
    }
    /* eslint-enable indent, @typescript-eslint/indent */
  }

  private handleJoin(playerId: string, ws: WebSocket, playerName: string, playerAvatar: string): void {
    const player: Player = {
      id: playerId,
      name: playerName,
      avatar: playerAvatar,
      ws,
    };

    this.players.set(playerId, player);

    logger.info({
      scope: 'main/websocket',
      msg: 'Player joined',
      meta: { playerId, playerName, playerAvatar },
    });

    // Send confirmation to the joining player with SERVER's name, avatar and CLIENT's name
    const joinedMessage = {
      type: 'joined',
      playerId,
      message: 'Connected to server successfully',
      playerName: this.serverPlayerName, // Send SERVER's name to client
      playerAvatar: this.serverPlayerAvatar, // Send SERVER's avatar to client
      clientPlayerName: playerName, // Send CLIENT's name back to client
    };

    ws.send(JSON.stringify(joinedMessage));
    logger.info({
      scope: 'main/websocket',
      msg: 'Sent joined confirmation to client',
      meta: {
        playerId,
        clientPlayerName: playerName, // Client's name
        serverPlayerName: this.serverPlayerName, // Server's name
        serverPlayerAvatar: this.serverPlayerAvatar, // Server's avatar
        message: joinedMessage,
      },
    });

    // IMPORTANT: Notify the server-client (Electron) about the new client player name and avatar
    // This ensures the overlay shows the real client name instead of "Waiting for client..."
    if (global.mainWindow && global.mainWindow.webContents) {
      global.mainWindow.webContents.send('client-player-joined', {
        clientPlayerName: playerName,
        clientPlayerAvatar: playerAvatar,
        playerId,
      });

      logger.info({
        scope: 'main/websocket',
        msg: 'Notified server-client about new client player',
        meta: {
          clientPlayerName: playerName,
          clientPlayerAvatar: playerAvatar,
          playerId,
        },
      });
    }

    // Notify all other players about the new player
    this.broadcastToOthers(playerId, {
      type: 'playerJoined',
      playerName,
      message: `${playerName} has joined the game!`,
    });

    // Log that we have a player connected
    logger.info({
      scope: 'main/websocket',
      msg: 'Player connected - server is no longer waiting',
      meta: {
        playerId,
        playerName,
        totalPlayers: this.players.size,
      },
    });

    // Log current server state
    logger.info({
      scope: 'main/websocket',
      msg: 'Server state after player joined',
      meta: {
        playerId,
        playerName,
        totalPlayers: this.players.size,
        allPlayerNames: Array.from(this.players.values()).map((p) => p.name),
      },
    });
  }

  private handleReady(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) {
      logger.warn({
        scope: 'main/websocket',
        msg: 'Player not found for ready message',
        meta: { playerId },
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
        allPlayerNames: Array.from(this.players.values()).map((p) => p.name),
      },
    });

    // Send confirmation to the player who sent ready
    const readyConfirmedMessage = {
      type: 'readyConfirmed',
      playerName: player.name,
      message: 'You are ready!',
    };

    player.ws.send(JSON.stringify(readyConfirmedMessage));
    logger.info({
      scope: 'main/websocket',
      msg: 'Sent ready confirmation to player',
      meta: { playerId, playerName: player.name },
    });

    // Notify all other players
    const playerReadyMessage = {
      type: 'playerReady',
      playerName: player.name,
    };

    this.broadcastToOthers(playerId, playerReadyMessage);
    logger.info({
      scope: 'main/websocket',
      msg: 'Broadcasted player ready to others',
      meta: {
        playerId,
        playerName: player.name,
        otherPlayersCount: this.players.size - 1,
      },
    });

    // Send notification to renderer process to update UI
    if (global.mainWindow && global.mainWindow.webContents) {
      global.mainWindow.webContents.send('lan-status-update', {
        type: 'playerReady',
        playerName: player.name,
        message: `Player ${player.name} is ready! Handshake complete!`,
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
      meta: { deckId },
    });

    // Send to all connected clients
    this.players.forEach((player) => {
      player.ws.send(JSON.stringify({
        type: 'deckSelection',
        deckId,
        message: `Server selected deck: ${deckId}`,
      }));
    });
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
        deckSize: distribution.deckOrder?.length,
      },
    });

    // Log card distribution details (structured logging)
    logger.info({
      scope: 'main/websocket',
      msg: 'Card distribution details',
      meta: {
        deckId: distribution.deckId,
        boardCard: distribution.boardCard?.title || 'none',
        serverHandSize: distribution.serverHand?.length || 0,
        clientHandSize: distribution.clientHand?.length || 0,
        deckSize: distribution.deckOrder?.length || 0,
        // currentPlayer will be set separately after distribution
      },
    });

    // Send to all connected clients
    this.players.forEach((player) => {
      const message = {
        type: 'cardDistribution',
        distribution, // Wrap in distribution object for consistency
        message: 'Card distribution received from server',
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
          deckSize: distribution.deckOrder?.length || 0,
        },
      });

      player.ws.send(JSON.stringify(message));
    });

    // Card distribution sent - no UI update needed
    logger.info({
      scope: 'main/websocket',
      msg: 'Card distribution sent to all clients - no UI update needed',
    });
  }

  /**
   * Send current player set event to all connected clients
   */
  async sendCurrentPlayerSet(currentPlayer: string): Promise<void> {
    console.log('🎮 WebSocket Server: Sending currentPlayerSet to clients:', currentPlayer);
    logger.info({
      scope: 'main/websocket',
      msg: 'Sending current player set event to clients',
      meta: { currentPlayer },
    });

    // Debug: Check if we have any connected players
    console.log('🎮 WebSocket Server: Connected players count:', this.players.size);
    this.players.forEach((player, playerId) => {
      console.log('🎮 WebSocket Server: Player:', { id: playerId, name: player.name, wsState: player.ws.readyState });
    });

    // Send to all connected clients
    this.players.forEach((player) => {
      const message = {
        type: 'currentPlayerSet',
        currentPlayer,
        message: `Game started! ${currentPlayer} goes first.`,
      };

      console.log('🎮 WebSocket Server: Sending to player:', player.name, 'message:', message);

      try {
        player.ws.send(JSON.stringify(message));
        console.log('🎮 WebSocket Server: Message sent successfully to:', player.name);
      } catch (error: any) {
        console.error('🎮 WebSocket Server: Failed to send message to:', player.name, 'error:', error);
        logger.error({
          scope: 'main/websocket',
          msg: 'Failed to send current player message to client',
          meta: { currentPlayer, playerName: player.name },
          err: { message: error.message, stack: error.stack },
        });
      }
    });

    // Send notification to renderer process to update UI
    if (global.mainWindow && global.mainWindow.webContents) {
      global.mainWindow.webContents.send('lan-status-update', {
        type: 'currentPlayerSet',
        currentPlayer,
        message: `Game started! ${currentPlayer} goes first.`,
      });
    }
  }

  /**
   * Send game start trigger to all connected clients
   */
  async sendGameStartTrigger(): Promise<void> {
    logger.info({
      scope: 'main/websocket',
      msg: 'Sending game start trigger to client',
    });

    // Send to all connected clients
    this.players.forEach((player) => {
      player.ws.send(JSON.stringify({
        type: 'startGame',
        message: 'Game start trigger received from server',
      }));
    });

    // Send notification to renderer process to update UI
    if (global.mainWindow && global.mainWindow.webContents) {
      global.mainWindow.webContents.send('lan-status-update', {
        type: 'startGame',
        message: 'Game start trigger sent to client',
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
        meta: { playerId: _playerId },
      });
      return;
    }

    logger.info({
      scope: 'main/websocket',
      msg: 'Received deck selection from client',
      meta: { playerId: _playerId, playerName: player.name, deckId },
    });

    // This would normally check if the deck is available
    // For now, we'll assume it's available and send back a response
    player.ws.send(JSON.stringify({
      type: 'deckResponse',
      deckId,
      available: true,
      message: `Deck ${deckId} is available`,
    }));

    // Explicitly use playerId to satisfy TypeScript
    logger.debug({
      scope: 'main/websocket',
      msg: 'Deck selection handled',
      meta: { playerId: _playerId },
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
      meta: {
        playerId, playerName: player.name, deckId, available,
      },
    });

    // Send notification to renderer process to update UI
    if (global.mainWindow && global.mainWindow.webContents) {
      global.mainWindow.webContents.send('lan-status-update', {
        type: 'deckResponse',
        deckId,
        available,
        playerName: player.name,
        message: available
          ? `Deck ${deckId} was selected and is available!`
          : `Deck ${deckId} is not available!`,
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
        deckSize: message.deckOrder?.length,
      },
    });

    // Card distribution doesn't need UI update - just log it
    logger.info({
      scope: 'main/websocket',
      msg: 'Card distribution received from client - no UI update needed',
      meta: { playerId, playerName: player.name },
    });
  }

  /**
   * Handle current player set event from client
   */
  private handleCurrentPlayerSet(playerId: string, currentPlayer: string): void {
    const player = this.players.get(playerId);
    if (!player) return;

    logger.info({
      scope: 'main/websocket',
      msg: 'Received current player set event from client',
      meta: { playerId, playerName: player.name, currentPlayer },
    });

    // Send notification to renderer process to update UI
    if (global.mainWindow && global.mainWindow.webContents) {
      global.mainWindow.webContents.send('lan-status-update', {
        type: 'currentPlayerSet',
        currentPlayer,
        message: `Game started! ${currentPlayer} goes first.`,
      });
    }
  }

  /**
   * Handle player turn changed event from client
   */
  private handlePlayerTurnChanged(playerId: string, currentPlayer: string): void {
    const player = this.players.get(playerId);
    if (!player) return;

    logger.info({
      scope: 'main/websocket',
      msg: 'Received player turn changed event from client',
      meta: { playerId, playerName: player.name, currentPlayer },
    });

    // Send notification to renderer process to update UI
    if (global.mainWindow && global.mainWindow.webContents) {
      global.mainWindow.webContents.send('lan-status-update', {
        type: 'playerTurnChanged',
        currentPlayer,
        message: `${currentPlayer} ist am Zug!`,
      });
    }
  }

  /**
   * Get the server player name
   */
  getServerPlayerName(): string {
    return this.serverPlayerName;
  }

  /**
   * Send card placement to all connected clients
   */
  async sendCardPlacement(cardId: string, boardPosition: number, playerName: string): Promise<void> {
    logger.info({
      scope: 'main/websocket',
      msg: 'Sending card placement to clients',
      meta: { cardId, boardPosition, playerName },
    });

    // Send to all connected clients
    this.players.forEach((player) => {
      player.ws.send(JSON.stringify({
        type: 'cardPlacement',
        cardId,
        boardPosition,
        playerName,
      }));
    });

    // Only send UI update for card placement (important game event)
    if (global.mainWindow && global.mainWindow.webContents) {
      global.mainWindow.webContents.send('lan-status-update', {
        type: 'cardPlacement',
        cardId,
        boardPosition,
        playerName,
        message: `Card ${cardId} placed at board position ${boardPosition} by ${playerName}`,
      });
    }
  }

  /**
   * Handle card placement from client
   */
  private handleCardPlacement(playerId: string, message: any): void {
    const player = this.players.get(playerId);
    if (!player) {
      console.error('🎮 WebSocket Server: Player not found for cardPlacement:', playerId);
      return;
    }

    console.log('🎮 WebSocket Server: Received cardPlacement from client:', {
      playerId,
      playerName: player.name,
      cardId: message.cardId,
      boardPosition: message.boardPosition,
    });

    logger.info({
      scope: 'main/websocket',
      msg: 'Received card placement from client',
      meta: {
        playerId,
        playerName: player.name,
        cardId: message.cardId,
        boardPosition: message.boardPosition,
      },
    });

    // Broadcast card placement to all other clients
    this.broadcastToOthers(playerId, {
      type: 'cardPlacement',
      cardId: message.cardId,
      boardPosition: message.boardPosition,
      playerName: player.name,
    });

    // Send notification to renderer process to update UI
    if (global.mainWindow && global.mainWindow.webContents) {
      const statusUpdate = {
        type: 'cardPlacement',
        cardId: message.cardId,
        boardPosition: message.boardPosition,
        playerName: player.name,
        message: `Karte ${message.cardId} wurde von `
          + `${player.name} an Board-Position ${message.boardPosition} platziert`,
      };

      console.log('🎮 WebSocket Server: Sending lan-status-update to renderer:', statusUpdate);
      console.log('🎮 WebSocket Server: mainWindow available:', !!global.mainWindow);
      console.log('🎮 WebSocket Server: webContents available:', !!(global.mainWindow && global.mainWindow.webContents));

      global.mainWindow.webContents.send('lan-status-update', statusUpdate);
      console.log('🎮 WebSocket Server: lan-status-update sent to renderer successfully');

      // Also log the broadcast to other WebSocket clients
      console.log('🎮 WebSocket Server: Broadcasting cardPlacement to other WebSocket clients');
    } else {
      console.error('🎮 WebSocket Server: Cannot send lan-status-update - mainWindow not available');
      console.error('🎮 WebSocket Server: mainWindow:', !!global.mainWindow);
      console.error('🎮 WebSocket Server: webContents:', !!(global.mainWindow && global.mainWindow.webContents));
    }
  }

  /**
   * Handle player switch from client
   */
  private handlePlayerSwitch(playerId: string, message: any): void {
    const player = this.players.get(playerId);
    if (!player) {
      console.error('🎮 WebSocket Server: Player not found for playerSwitch:', playerId);
      return;
    }

    console.log('🎮 WebSocket Server: Received playerSwitch from client:', {
      playerId,
      playerName: player.name,
      nextPlayer: message.nextPlayer,
    });

    logger.info({
      scope: 'main/websocket',
      msg: 'Received player switch from client',
      meta: {
        playerId,
        playerName: player.name,
        nextPlayer: message.nextPlayer,
      },
    });

    // Broadcast player switch to all other clients
    this.broadcastToOthers(playerId, {
      type: 'playerSwitch',
      nextPlayer: message.nextPlayer,
      playerName: player.name,
    });

    // Send notification to renderer process to update UI
    if (global.mainWindow && global.mainWindow.webContents) {
      const statusUpdate = {
        type: 'playerSwitch',
        nextPlayer: message.nextPlayer,
        playerName: player.name,
        message: `Turn switched to ${message.nextPlayer} by ${player.name}`,
      };

      global.mainWindow.webContents.send('lan-status-update', statusUpdate);
      console.log('🎮 WebSocket Server: lan-status-update sent to renderer successfully');

      // Also log the broadcast to other WebSocket clients
      console.log('🎮 WebSocket Server: Broadcasting playerSwitch to other WebSocket clients');
    } else {
      console.error('🎮 WebSocket Server: Cannot send lan-status-update - mainWindow not available');
      console.error('🎮 WebSocket Server: mainWindow:', !!global.mainWindow);
      console.error('🎮 WebSocket Server: webContents:', !!(global.mainWindow && global.mainWindow.webContents));
    }
  }

  /**
   * Handle game restart from client
   */
  private handleGameRestart(playerId: string, _message: any): void {
    const player = this.players.get(playerId);
    if (!player) {
      console.error('🎮 WebSocket Server: Player not found for gameRestart:', playerId);
      return;
    }

    console.log('🎮 WebSocket Server: Received gameRestart from client:', {
      playerId,
      playerName: player.name,
    });

    logger.info({
      scope: 'main/websocket',
      msg: 'Received game restart from client',
      meta: {
        playerId,
        playerName: player.name,
      },
    });

    // Broadcast game restart to all other clients
    this.broadcastToOthers(playerId, {
      type: 'gameRestart',
      playerName: player.name,
    });

    // Send notification to renderer process to update UI
    if (global.mainWindow && global.mainWindow.webContents) {
      const statusUpdate = {
        type: 'gameRestart',
        playerName: player.name,
        message: `Game is being restarted by ${player.name}`,
      };

      global.mainWindow.webContents.send('lan-status-update', statusUpdate);
      console.log('🎮 WebSocket Server: lan-status-update sent to renderer successfully');

      // Also log the broadcast to other WebSocket clients
      console.log('🎮 WebSocket Server: Broadcasting gameRestart to other WebSocket clients');
    } else {
      console.error('🎮 WebSocket Server: Cannot send lan-status-update - mainWindow not available');
      console.error('🎮 WebSocket Server: mainWindow:', !!global.mainWindow);
      console.error('🎮 WebSocket Server: webContents:', !!(global.mainWindow && global.mainWindow.webContents));
    }
  }

  /**
   * Handle remaining cards update from client
   */
  private handleRemainingCardsUpdate(playerId: string, message: any): void {
    const player = this.players.get(playerId);
    if (!player) {
      console.error('🎮 WebSocket Server: Player not found for remainingCardsUpdate:', playerId);
      return;
    }

    console.log('🎮 WebSocket Server: Received remainingCardsUpdate from client:', {
      playerId,
      playerName: player.name,
      remainingCardsCount: message.remainingCardsCount,
    });

    logger.info({
      scope: 'main/websocket',
      msg: 'Received remaining cards update from client',
      meta: {
        playerId,
        playerName: player.name,
        remainingCardsCount: message.remainingCardsCount,
      },
    });

    // Broadcast remaining cards update to all other clients
    this.broadcastToOthers(playerId, {
      type: 'remainingCardsUpdate',
      remainingCardsCount: message.remainingCardsCount,
      playerName: player.name,
    });

    // Send notification to renderer process to update UI
    if (global.mainWindow && global.mainWindow.webContents) {
      const statusUpdate = {
        type: 'remainingCardsUpdate',
        remainingCardsCount: message.remainingCardsCount,
        playerName: player.name,
        message: `Remaining cards updated: ${message.remainingCardsCount} cards left`,
      };

      global.mainWindow.webContents.send('lan-status-update', statusUpdate);
      console.log('🎮 WebSocket Server: lan-status-update sent to renderer successfully');

      // Also log the broadcast to other WebSocket clients
      console.log('🎮 WebSocket Server: Broadcasting remainingCardsUpdate to other WebSocket clients');
    } else {
      console.error('🎮 WebSocket Server: Cannot send lan-status-update - mainWindow not available');
      console.error('🎮 WebSocket Server: mainWindow:', !!global.mainWindow);
      console.error('🎮 WebSocket Server: webContents:', !!(global.mainWindow && global.mainWindow.webContents));
    }
  }

  /**
   * Handle game state update from client
   */
  private handleGameStateUpdate(playerId: string, message: any): void {
    const player = this.players.get(playerId);
    if (!player) return;

    logger.info({
      scope: 'main/websocket',
      msg: 'Received game state update from client',
      meta: {
        playerId,
        playerName: player.name,
        currentPlayer: message.currentPlayer,
        placedCardsCount: message.placedCards?.length || 0,
      },
    });

    // Broadcast game state update to all other clients
    this.broadcastToOthers(playerId, {
      type: 'gameStateUpdate',
      currentPlayer: message.currentPlayer,
      placedCards: message.placedCards,
      playerName: player.name,
    });

    // Send notification to renderer process to update UI
    if (global.mainWindow && global.mainWindow.webContents) {
      global.mainWindow.webContents.send('lan-status-update', {
        type: 'gameStateUpdate',
        currentPlayer: message.currentPlayer,
        placedCards: message.placedCards,
        message: 'Game state updated from client',
      });

      // Also send current player set event separately for UI synchronization
      global.mainWindow.webContents.send('lan-status-update', {
        type: 'currentPlayerSet',
        currentPlayer: message.currentPlayer,
        message: `Game started! ${message.currentPlayer} goes first.`,
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
      meta: { playerId, playerName: player.name },
    });

    // Notify remaining players
    this.broadcastToAll({
      type: 'playerLeft',
      playerName: player.name,
      message: `${player.name} has left the game`,
    });
  }

  private broadcastToAll(message: any): void {
    const messageStr = JSON.stringify(message);
    this.players.forEach((player) => {
      if (player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(messageStr);
      }
    });
  }

  private broadcastToOthers(excludePlayerId: string, message: any): void {
    const messageStr = JSON.stringify(message);
    this.players.forEach((player) => {
      if (player.id !== excludePlayerId && player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(messageStr);
      }
    });
  }

  private static generatePlayerId(): string {
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

  /**
   * Get the server's local IP address
   */
  private static getLocalIPAddress(): string {
    const interfaces = networkInterfaces();
    const externalAddress = Object.keys(interfaces)
      .flatMap((name) => interfaces[name] || [])
      .find((alias) => alias.family === 'IPv4' && !alias.internal)?.address;

    if (externalAddress) {
      return externalAddress;
    }

    // Fallback to localhost if no external IP found
    return '127.0.0.1';
  }

  /**
   * Get server connection info for clients
   */
  getServerInfo(): { ip: string; port: number; playerName: string } {
    return {
      ip: this.serverIP,
      port: this.port,
      playerName: this.serverPlayerName,
    };
  }
}
