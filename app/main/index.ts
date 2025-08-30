import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { logger } from './logger';
import { LANWebSocketServer } from './websocket-server';

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;
let lanServer: LANWebSocketServer | null = null;

// Make mainWindow globally available for WebSocket server
declare global {
  var mainWindow: BrowserWindow | null;
}
global.mainWindow = mainWindow;

/**
 * Create the main application window
 */
function createWindow(): void {
  try {
    // Create the browser window
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        preload: join(__dirname, '../preload/index.js'),
      },
      title: 'Axes-Mundi',
      icon: join(__dirname, '../assets/icon.png'), // Will be added later
      show: false, // Don't show until ready
    });

    // Update global reference
    global.mainWindow = mainWindow;

    // Load the app
    // Force development mode for now
    const isDev = true; // process.env.NODE_ENV === 'development' || process.env.AXM_ENV === 'development';
    if (isDev) {
      mainWindow.loadURL('http://localhost:5179');
      mainWindow.webContents.openDevTools();
    } else {
      mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }

    // Show window when ready to prevent visual flash
    mainWindow.once('ready-to-show', () => {
      mainWindow?.show();
      logger.info({ scope: 'main/window', msg: 'window ready to show' });
    });

    // Handle window closed
    mainWindow.on('closed', () => {
      mainWindow = null;
      logger.info({ scope: 'main/window', msg: 'window closed' });
    });

    logger.info({ scope: 'main/window', msg: 'window created' });
  } catch (error: any) {
    logger.error({ 
      scope: 'main/window', 
      msg: 'failed to create window', 
      err: { message: error.message, stack: error.stack } 
    });
  }
}

/**
 * Set up IPC handlers
 */
function setupIPC(): void {
  // Get app version
  ipcMain.handle('get-version', () => {
    logger.debug({ scope: 'main/ipc', msg: 'get-version requested' });
    return app.getVersion();
  });

  // Get app environment
  ipcMain.handle('get-environment', () => {
    logger.debug({ scope: 'main/ipc', msg: 'get-environment requested' });
    return {
      env: process.env.AXM_ENV || 'development',
      logLevel: process.env.AXM_LOG_LEVEL || 'info',
    };
  });

  // Test IPC connection
  ipcMain.handle('test-ipc', () => {
    logger.info({ scope: 'main/ipc', msg: 'test-ipc requested' });
    return { success: true, message: 'IPC connection working' };
  });

    // Send deck selection to client
  ipcMain.handle('send-deck-selection', async (_, deckId: string) => {
    try {
      logger.info({ scope: 'main/lan', msg: 'Sending deck selection to client', meta: { deckId } });

      if (lanServer) {
        await lanServer.sendDeckSelection(deckId);
        return { success: true };
      } else {
        logger.warn({ scope: 'main/lan', msg: 'No LAN server running' });
        return { success: false, error: 'No LAN server running' };
      }
    } catch (error: any) {
      logger.error({
        scope: 'main/lan',
        msg: 'Failed to send deck selection',
        err: { message: error.message }
      });
      return { success: false, error: error.message };
    }
  });

  // Send card distribution to client
  ipcMain.handle('send-card-distribution', async (_, distribution: any) => {
    try {
      logger.info({ 
        scope: 'main/lan', 
        msg: 'Sending card distribution to client', 
        meta: { 
          boardCard: distribution.boardCard?.id,
          serverHandSize: distribution.serverHand?.length,
          clientHandSize: distribution.clientHand?.length,
          deckSize: distribution.deckOrder?.length
        } 
      });

      if (lanServer) {
        await lanServer.sendCardDistribution(distribution);
        return { success: true };
      } else {
        logger.warn({ scope: 'main/lan', msg: 'No LAN server running' });
        return { success: false, error: 'No LAN server running' };
      }
    } catch (error: any) {
      logger.error({
        scope: 'main/lan',
        msg: 'Failed to send card distribution',
        err: { message: error.message }
      });
      return { success: false, error: error.message };
    }
  });

  // Send game start trigger to client
  ipcMain.handle('send-game-start-trigger', async () => {
    try {
      logger.info({ 
        scope: 'main/lan', 
        msg: 'Sending game start trigger to client'
      });

      if (lanServer) {
        await lanServer.sendGameStartTrigger();
        return { success: true };
      } else {
        logger.warn({ scope: 'main/lan', msg: 'No LAN server running' });
        return { success: false, error: 'No LAN server running' };
      }
    } catch (error: any) {
      logger.error({
        scope: 'main/lan',
        msg: 'Failed to send game start trigger',
        err: { message: error.message }
      });
      return { success: false, error: error.message };
    }
  });

  // Send current player update to client
  ipcMain.handle('send-current-player-update', async (_, currentPlayer: string) => {
    try {
      logger.info({ 
        scope: 'main/lan', 
        msg: 'Sending current player update to client', 
        meta: { currentPlayer } 
      });

      if (lanServer) {
        await lanServer.sendCurrentPlayerSet(currentPlayer);
        return { success: true };
      } else {
        logger.warn({ scope: 'main/lan', msg: 'No LAN server running' });
        return { success: false, error: 'No LAN server running' };
      }
    } catch (error: any) {
      logger.error({
        scope: 'main/lan',
        msg: 'Failed to send current player update',
        err: { message: error.message }
      });
      return { success: false, error: error.message };
    }
  });

  // LAN card placement with WebSocket integration
  ipcMain.handle('lan-place-card', async (_, cardId: string, boardPosition: number) => {
    try {
      logger.info({ 
        scope: 'main/lan', 
        msg: 'LAN card placement requested', 
        meta: { cardId, boardPosition } 
      });
      
      // Validate input
      if (typeof cardId !== 'string' || !cardId) {
        throw new Error('Invalid card ID');
      }
      if (typeof boardPosition !== 'number') {
        throw new Error('Invalid board position - must be a number');
      }

      // Send card placement to all connected clients via WebSocket
      if (lanServer) {
        // Get current player from renderer (this would need to be passed)
        const currentPlayer = 'Server'; // TODO: Get actual current player
        
        await lanServer.sendCardPlacement(cardId, boardPosition, currentPlayer);
        
        logger.info({ 
          scope: 'main/lan', 
          msg: 'card placement sent to clients via WebSocket', 
          meta: { cardId, boardPosition, currentPlayer } 
        });
        
        return { success: true, message: 'Card placement sent to clients' };
      } else {
        logger.warn({ scope: 'main/lan', msg: 'No LAN server running' });
        return { success: false, error: 'No LAN server running' };
      }
      
    } catch (error: any) {
      logger.error({
        scope: 'main/lan',
        msg: 'Failed to handle LAN card placement',
        err: { message: error.message }
      });
      return { success: false, error: error.message };
    }
  });

  // Update LAN game state (local only, no WebSocket)
  ipcMain.handle('update-lan-game-state', async (_, gameState: any) => {
    try {
      logger.info({ 
        scope: 'main/lan', 
        msg: 'LAN game state update requested (local only)',
        meta: { 
          currentPlayer: gameState.currentPlayer,
          placedCardsCount: gameState.placedCards?.length || 0
        }
      });
      
      // For now, just log the game state update - no WebSocket transmission
      // Later we can add WebSocket functionality here
      logger.info({ 
        scope: 'main/lan', 
        msg: 'game state updated locally', 
        meta: { 
          currentPlayer: gameState.currentPlayer,
          placedCardsCount: gameState.placedCards?.length || 0
        }
      });
      
      return { success: true, message: 'Game state updated locally' };
      
    } catch (error: any) {
      logger.error({
        scope: 'main/lan',
        msg: 'Failed to update LAN game state',
        err: { message: error.message }
      });
      return { success: false, error: error.message };
    }
  });

  // LAN Server management
  ipcMain.handle('start-lan-server', async (_, playerName: string) => {
    try {
      logger.info({ scope: 'main/lan', msg: 'Starting LAN server...', meta: { playerName } });
      
      if (lanServer) {
        logger.info({ scope: 'main/lan', msg: 'Stopping existing server' });
        lanServer.stop();
      }
      
      // Try different ports if 8080 is busy
      const ports = [8080, 8081, 8082, 8083, 8084];
      let startedPort = null;
      let lastError = null;

      for (const port of ports) {
        try {
          logger.info({ scope: 'main/lan', msg: `Trying port ${port}...` });
          lanServer = new LANWebSocketServer(port, playerName);
          await lanServer.start();
          startedPort = port;
          logger.info({ scope: 'main/lan', msg: `Successfully started on port ${port}` });
          break;
        } catch (error: any) {
          lastError = error;
          logger.warn({ 
            scope: 'main/lan', 
            msg: `Port ${port} failed: ${error.message}`, 
            err: { message: error.message } 
          });
        }
      }

      if (startedPort) {
        logger.info({ scope: 'main/lan', msg: 'LAN server started successfully', meta: { port: startedPort, playerName } });
        return { success: true, port: startedPort };
      } else {
        const errorMsg = lastError ? lastError.message : 'No available ports';
        logger.error({ 
          scope: 'main/lan', 
          msg: 'All ports failed', 
          err: { message: errorMsg } 
        });
        return { success: false, error: errorMsg };
      }
    } catch (error: any) {
      logger.error({ 
        scope: 'main/lan', 
        msg: 'Failed to start LAN server', 
        err: { message: error.message, stack: error.stack } 
      });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('stop-lan-server', async () => {
    try {
      if (lanServer) {
        lanServer.stop();
        lanServer = null;
        logger.info({ scope: 'main/lan', msg: 'LAN server stopped' });
      }
      return { success: true };
    } catch (error: any) {
      logger.error({ 
        scope: 'main/lan', 
        msg: 'Failed to stop LAN server', 
        err: { message: error.message } 
      });
      throw error;
    }
  });
}

/**
 * App event handlers
 */
function setupAppEvents(): void {
  // App ready
  app.whenReady().then(() => {
    logger.info({ scope: 'main/app', msg: 'app ready' });
    createWindow();
    setupIPC();
  });

  // Quit when all windows are closed
  app.on('window-all-closed', () => {
    logger.info({ scope: 'main/app', msg: 'all windows closed, quitting' });
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // Activate (macOS)
  app.on('activate', () => {
    logger.debug({ scope: 'main/app', msg: 'app activated' });
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // App quit
  app.on('before-quit', () => {
    logger.info({ scope: 'main/app', msg: 'app quitting' });
    if (lanServer) {
      lanServer.stop();
    }
  });
}

// Set up global error handlers
process.on('uncaughtException', (error) => {
  logger.error({ 
    scope: 'main/uncaught', 
    msg: 'uncaught exception', 
    err: { message: error.message, stack: error.stack } 
  });
  app.quit();
});

process.on('unhandledRejection', (reason) => {
  logger.error({ 
    scope: 'main/unhandled', 
    msg: 'unhandled rejection', 
    err: { reason: String(reason) } 
  });
});

// Initialize the app
setupAppEvents();
