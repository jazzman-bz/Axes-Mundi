import { app, BrowserWindow, ipcMain, dialog, protocol } from 'electron';
import { join } from 'path';
import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import AdmZip from 'adm-zip';
import { logger } from './logger';
import { LANWebSocketServer } from './websocket-server';

// Register custom protocol scheme as privileged BEFORE app.ready
// This is required for the protocol to work with image loading in the renderer
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'user-deck-image',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true,
    },
  },
]);
console.log('[Protocol] Scheme registered as privileged: user-deck-image');

// User data paths for imported decks
const getUserDecksDir = () => join(app.getPath('userData'), 'decks');
const getUserDeckImagesDir = () => join(app.getPath('userData'), 'deck-images');

/**
 * Register custom protocol for serving user deck images
 * This allows the renderer to load images from the user data folder
 * using URLs like: user-deck-image://imageFolder/imageName.png
 */
function registerUserDeckImageProtocol(): void {
  protocol.handle('user-deck-image', async (request) => {
    try {
      // URL format: user-deck-image://imageFolder/imageName.png
      const url = new URL(request.url);
      const imageFolder = decodeURIComponent(url.hostname);
      const imageName = decodeURIComponent(url.pathname.slice(1)); // Remove leading /
      
      const imagePath = join(getUserDeckImagesDir(), imageFolder, imageName);
      let finalPath = imagePath;
      let contentType = 'image/jpeg';

      if (!existsSync(imagePath)) {
        // Try .png if .jpg was requested
        if (imagePath.endsWith('.jpg')) {
          const pngPath = imagePath.replace('.jpg', '.png');
          if (existsSync(pngPath)) {
            finalPath = pngPath;
            contentType = 'image/png';
          } else {
            return new Response('Not Found', { status: 404 });
          }
        } else {
          return new Response('Not Found', { status: 404 });
        }
      } else if (imagePath.endsWith('.png')) {
        contentType = 'image/png';
      }

      // Read file and serve
      const fileData = await readFile(finalPath);
      const uint8Array = new Uint8Array(fileData);
      
      return new Response(uint8Array, {
        status: 200,
        headers: { 
          'Content-Type': contentType,
          'Content-Length': fileData.length.toString(),
        },
      });
    } catch (error: any) {
      logger.error({ scope: 'main/protocol', msg: 'Failed to serve user deck image', meta: { url: request.url }, err: { message: error.message } });
      return new Response('Internal Error', { status: 500 });
    }
  });

  console.log('[Protocol] Registered user-deck-image protocol');
}

/**
 * Validate deck JSON structure
 */
function validateDeckStructure(deck: any): { valid: boolean; error?: string } {
  if (!deck || typeof deck !== 'object') {
    return { valid: false, error: 'Invalid JSON structure' };
  }
  if (!deck.id || typeof deck.id !== 'string') {
    return { valid: false, error: 'Missing or invalid deck id' };
  }
  if (!deck.name || typeof deck.name !== 'string') {
    return { valid: false, error: 'Missing or invalid deck name' };
  }
  if (!deck.axis || typeof deck.axis !== 'string') {
    return { valid: false, error: 'Missing or invalid axis' };
  }
  if (!deck.cards || !Array.isArray(deck.cards) || deck.cards.length === 0) {
    return { valid: false, error: 'Missing or empty cards array' };
  }
  
  // Validate each card has required fields
  for (let i = 0; i < deck.cards.length; i++) {
    const card = deck.cards[i];
    if (!card.id || !card.title || card.value === undefined) {
      return { valid: false, error: `Card at index ${i} missing required fields (id, title, value)` };
    }
  }
  
  return { valid: true };
}

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
      autoHideMenuBar: true, // Hide menu bar (press Alt to show temporarily)
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
    // Check if we're in development mode
    const isDev = process.env.NODE_ENV === 'development' || process.env.AXM_ENV === 'development';
    console.log('🔧 NODE_ENV:', process.env.NODE_ENV);
    console.log('🔧 AXM_ENV:', process.env.AXM_ENV);
    console.log('🔧 isDev:', isDev);
    if (isDev) {
      console.log('🚀 Loading dev server: http://localhost:5179');
      mainWindow.loadURL('http://localhost:5179');
      mainWindow.webContents.openDevTools();
    } else {
      console.log('📦 Loading production build');
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
      err: { message: error.message, stack: error.stack },
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

  // Debug logging from renderer to main process terminal
  ipcMain.handle('debug-log', (_, message: string, data?: any) => {
    console.log('[RENDERER]', message, data ? JSON.stringify(data) : '');
    return { success: true };
  });

  // Send deck selection to client
  ipcMain.handle('send-deck-selection', async (_, deckId: string) => {
    try {
      logger.info({ scope: 'main/lan', msg: 'Sending deck selection to client', meta: { deckId } });

      if (lanServer) {
        await lanServer.sendDeckSelection(deckId);
        return { success: true };
      }
      logger.warn({ scope: 'main/lan', msg: 'No LAN server running' });
      return { success: false, error: 'No LAN server running' };
    } catch (error: any) {
      logger.error({
        scope: 'main/lan',
        msg: 'Failed to send deck selection',
        err: { message: error.message },
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
          deckSize: distribution.deckOrder?.length,
        },
      });

      if (lanServer) {
        await lanServer.sendCardDistribution(distribution);
        return { success: true };
      }
      logger.warn({ scope: 'main/lan', msg: 'No LAN server running' });
      return { success: false, error: 'No LAN server running' };
    } catch (error: any) {
      logger.error({
        scope: 'main/lan',
        msg: 'Failed to send card distribution',
        err: { message: error.message },
      });
      return { success: false, error: error.message };
    }
  });

  // Send game start trigger to client
  ipcMain.handle('send-game-start-trigger', async () => {
    try {
      logger.info({
        scope: 'main/lan',
        msg: 'Sending game start trigger to client',
      });

      if (lanServer) {
        await lanServer.sendGameStartTrigger();
        return { success: true };
      }
      logger.warn({ scope: 'main/lan', msg: 'No LAN server running' });
      return { success: false, error: 'No LAN server running' };
    } catch (error: any) {
      logger.error({
        scope: 'main/lan',
        msg: 'Failed to send game start trigger',
        err: { message: error.message },
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
        meta: { currentPlayer },
      });

      if (lanServer) {
        await lanServer.sendCurrentPlayerSet(currentPlayer);
        return { success: true };
      }
      logger.warn({ scope: 'main/lan', msg: 'No LAN server running' });
      return { success: false, error: 'No LAN server running' };
    } catch (error: any) {
      logger.error({
        scope: 'main/lan',
        msg: 'Failed to send current player update',
        err: { message: error.message },
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
        meta: { cardId, boardPosition },
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
        // Get the actual server player name from the WebSocket server
        const currentPlayer = lanServer.getServerPlayerName();

        await lanServer.sendCardPlacement(cardId, boardPosition, currentPlayer);

        logger.info({
          scope: 'main/lan',
          msg: 'card placement sent to clients via WebSocket',
          meta: { cardId, boardPosition, currentPlayer },
        });

        return { success: true, message: 'Card placement sent to clients' };
      }
      logger.warn({ scope: 'main/lan', msg: 'No LAN server running' });
      return { success: false, error: 'No LAN server running' };
    } catch (error: any) {
      logger.error({
        scope: 'main/lan',
        msg: 'Failed to handle LAN card placement',
        err: { message: error.message },
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
          placedCardsCount: gameState.placedCards?.length || 0,
        },
      });

      // For now, just log the game state update - no WebSocket transmission
      // Later we can add WebSocket functionality here
      logger.info({
        scope: 'main/lan',
        msg: 'game state updated locally',
        meta: {
          currentPlayer: gameState.currentPlayer,
          placedCardsCount: gameState.placedCards?.length || 0,
        },
      });

      return { success: true, message: 'Game state updated locally' };
    } catch (error: any) {
      logger.error({
        scope: 'main/lan',
        msg: 'Failed to update LAN game state',
        err: { message: error.message },
      });
      return { success: false, error: error.message };
    }
  });

  // LAN Server management
  ipcMain.handle('start-lan-server', async (_, playerName: string, playerAvatar: string = 'default') => {
    try {
      logger.info({ scope: 'main/lan', msg: 'Starting LAN server...', meta: { playerName, playerAvatar } });

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
          lanServer = new LANWebSocketServer(port, playerName, playerAvatar);
          await lanServer.start();
          startedPort = port;
      logger.info({ scope: 'main/lan', msg: `Successfully started on port ${port}` });
      
      // Get server info and send to renderer
      const serverInfo = lanServer.getServerInfo();
      logger.info({ 
        scope: 'main/lan', 
        msg: 'LAN server info', 
        meta: serverInfo 
      });
      
      // Send server info to renderer process
      if (global.mainWindow && global.mainWindow.webContents) {
        global.mainWindow.webContents.send('lan-status-update', {
          type: 'serverStarted',
          serverInfo,
          message: `Server started on ${serverInfo.ip}:${serverInfo.port}`,
        });
        
        // Also send the server info via IPC for immediate access
        global.mainWindow.webContents.send('server-info-update', serverInfo);
      }
      
      break;
        } catch (error: any) {
          lastError = error;
          logger.warn({
            scope: 'main/lan',
            msg: `Port ${port} failed: ${error.message}`,
            err: { message: error.message },
          });
        }
      }

      if (startedPort) {
        logger.info({ scope: 'main/lan', msg: 'LAN server started successfully', meta: { port: startedPort, playerName } });
        return { success: true, port: startedPort };
      }
      const errorMsg = lastError ? lastError.message : 'No available ports';
      logger.error({
        scope: 'main/lan',
        msg: 'All ports failed',
        err: { message: errorMsg },
      });
      return { success: false, error: errorMsg };
    } catch (error: any) {
      logger.error({
        scope: 'main/lan',
        msg: 'Failed to start LAN server',
        err: { message: error.message, stack: error.stack },
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
        err: { message: error.message },
      });
      throw error;
    }
  });

  // ========== DECK IMPORT HANDLERS ==========

  /**
   * Import a deck from a ZIP file
   * ZIP structure expected:
   * - deck.json (required)
   * - images/ folder with card images (optional)
   */
  ipcMain.handle('import-deck', async () => {
    try {
      logger.info({ scope: 'main/deck', msg: 'Opening deck import dialog' });

      // Show file picker dialog
      const result = await dialog.showOpenDialog({
        title: 'Import Deck',
        filters: [
          { name: 'Deck Archives', extensions: ['zip'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        logger.info({ scope: 'main/deck', msg: 'Import cancelled by user' });
        return { success: false, cancelled: true };
      }

      const zipPath = result.filePaths[0];
      logger.info({ scope: 'main/deck', msg: 'Processing ZIP file', meta: { path: zipPath } });

      // Extract ZIP file
      const zip = new AdmZip(zipPath);
      const zipEntries = zip.getEntries();

      // Find deck.json in the ZIP
      let deckJsonEntry = zipEntries.find(entry => 
        entry.entryName === 'deck.json' || entry.entryName.endsWith('/deck.json')
      );

      if (!deckJsonEntry) {
        logger.error({ scope: 'main/deck', msg: 'No deck.json found in ZIP' });
        return { success: false, error: 'No deck.json found in the ZIP file' };
      }

      // Parse and validate deck.json
      const deckJsonContent = deckJsonEntry.getData().toString('utf8');
      let deck: any;
      try {
        deck = JSON.parse(deckJsonContent);
      } catch (parseError: any) {
        logger.error({ scope: 'main/deck', msg: 'Invalid JSON in deck.json', err: { message: parseError.message } });
        return { success: false, error: 'Invalid JSON in deck.json' };
      }

      // Validate deck structure
      const validation = validateDeckStructure(deck);
      if (!validation.valid) {
        logger.error({ scope: 'main/deck', msg: 'Deck validation failed', meta: { error: validation.error } });
        return { success: false, error: validation.error };
      }

      // Create user decks directory if it doesn't exist
      const userDecksDir = getUserDecksDir();
      if (!existsSync(userDecksDir)) {
        await mkdir(userDecksDir, { recursive: true });
        logger.info({ scope: 'main/deck', msg: 'Created user decks directory', meta: { path: userDecksDir } });
      }

      // Save deck.json to user decks folder
      const deckTargetPath = join(userDecksDir, `${deck.id}.json`);
      await writeFile(deckTargetPath, JSON.stringify(deck, null, 2), 'utf-8');
      logger.info({ scope: 'main/deck', msg: 'Deck JSON saved', meta: { path: deckTargetPath } });

      // Extract images if present
      const imageFolder = deck.imageFolder || deck.id;
      const userImagesDir = join(getUserDeckImagesDir(), imageFolder);
      
      // Find image entries (look for images/ folder or image files at root)
      // Note: ZIP entries may use forward or backslashes depending on how they were created
      const imageEntries = zipEntries.filter(entry => {
        const name = entry.entryName.toLowerCase();
        // Normalize path separators for cross-platform compatibility
        const normalizedName = name.replace(/\\/g, '/');
        return !entry.isDirectory && 
               (normalizedName.startsWith('images/') || normalizedName.includes('/images/')) &&
               (normalizedName.endsWith('.jpg') || normalizedName.endsWith('.jpeg') || normalizedName.endsWith('.png'));
      });

      if (imageEntries.length > 0) {
        if (!existsSync(userImagesDir)) {
          await mkdir(userImagesDir, { recursive: true });
          logger.info({ scope: 'main/deck', msg: 'Created user images directory', meta: { path: userImagesDir } });
        }

        // Extract each image
        for (const imageEntry of imageEntries) {
          // Normalize path separators and get just the filename
          const normalizedPath = imageEntry.entryName.replace(/\\/g, '/');
          const imageName = normalizedPath.split('/').pop(); // Get just filename
          if (imageName) {
            const imageTargetPath = join(userImagesDir, imageName);
            const imageData = imageEntry.getData();
            await writeFile(imageTargetPath, imageData);
          }
        }
        logger.info({ scope: 'main/deck', msg: 'Images extracted', meta: { count: imageEntries.length, folder: imageFolder } });
      }

      logger.info({ 
        scope: 'main/deck', 
        msg: 'Deck imported successfully', 
        meta: { 
          deckId: deck.id, 
          name: deck.name, 
          cardCount: deck.cards.length,
          imageCount: imageEntries.length 
        } 
      });

      return {
        success: true,
        deck: {
          id: deck.id,
          name: deck.name,
          axis: deck.axis,
          theme: deck.theme || 'custom',
          locale: deck.locale || 'en',
          cardCount: deck.cards.length,
          imageFolder: imageFolder,
          isUserDeck: true,
        },
      };
    } catch (error: any) {
      logger.error({
        scope: 'main/deck',
        msg: 'Failed to import deck',
        err: { message: error.message, stack: error.stack },
      });
      return { success: false, error: error.message };
    }
  });

  /**
   * Get list of user-imported decks
   */
  ipcMain.handle('get-user-decks', async () => {
    try {
      const userDecksDir = getUserDecksDir();
      
      if (!existsSync(userDecksDir)) {
        return { success: true, decks: [] };
      }

      const files = await readdir(userDecksDir);
      const deckFiles = files.filter(f => f.endsWith('.json'));
      
      const decks = [];
      for (const file of deckFiles) {
        try {
          const content = await readFile(join(userDecksDir, file), 'utf-8');
          const deck = JSON.parse(content);
          decks.push({
            id: deck.id,
            name: deck.name,
            axis: deck.axis,
            theme: deck.theme || 'custom',
            locale: deck.locale || 'en',
            cardCount: deck.cards?.length || 0,
            imageFolder: deck.imageFolder || deck.id,
            isUserDeck: true,
          });
        } catch (e) {
          logger.warn({ scope: 'main/deck', msg: 'Failed to read user deck', meta: { file } });
        }
      }

      logger.info({ scope: 'main/deck', msg: 'User decks retrieved', meta: { count: decks.length } });
      return { success: true, decks };
    } catch (error: any) {
      logger.error({
        scope: 'main/deck',
        msg: 'Failed to get user decks',
        err: { message: error.message },
      });
      return { success: false, error: error.message, decks: [] };
    }
  });

  /**
   * Load a specific user deck by ID
   */
  ipcMain.handle('load-user-deck', async (_, deckId: string) => {
    console.log('[LoadUserDeck] ==== CALLED with deckId:', deckId);
    try {
      if (!deckId || typeof deckId !== 'string') {
        console.log('[LoadUserDeck] ERROR: Invalid deck ID');
        return { success: false, error: 'Invalid deck ID' };
      }

      const deckPath = join(getUserDecksDir(), `${deckId}.json`);
      console.log('[LoadUserDeck] Looking for deck at:', deckPath);
      
      if (!existsSync(deckPath)) {
        console.log('[LoadUserDeck] ERROR: Deck file not found');
        return { success: false, error: 'Deck not found' };
      }

      const content = await readFile(deckPath, 'utf-8');
      const deck = JSON.parse(content);

      console.log('[LoadUserDeck] SUCCESS: Loaded deck with', deck.cards?.length, 'cards, imageFolder:', deck.imageFolder);
      logger.info({ scope: 'main/deck', msg: 'User deck loaded', meta: { deckId, cardCount: deck.cards?.length } });
      return { success: true, deck };
    } catch (error: any) {
      logger.error({
        scope: 'main/deck',
        msg: 'Failed to load user deck',
        err: { message: error.message },
      });
      return { success: false, error: error.message };
    }
  });

  /**
   * Delete a user-imported deck
   */
  ipcMain.handle('delete-user-deck', async (_, deckId: string) => {
    try {
      if (!deckId || typeof deckId !== 'string') {
        return { success: false, error: 'Invalid deck ID' };
      }

      const deckPath = join(getUserDecksDir(), `${deckId}.json`);
      
      if (!existsSync(deckPath)) {
        return { success: false, error: 'Deck not found' };
      }

      // Read deck to get imageFolder before deleting
      const content = await readFile(deckPath, 'utf-8');
      const deck = JSON.parse(content);
      const imageFolder = deck.imageFolder || deckId;

      // Delete deck JSON
      const { unlink, rm } = await import('fs/promises');
      await unlink(deckPath);

      // Delete images folder if exists
      const imagesPath = join(getUserDeckImagesDir(), imageFolder);
      if (existsSync(imagesPath)) {
        await rm(imagesPath, { recursive: true, force: true });
      }

      logger.info({ scope: 'main/deck', msg: 'User deck deleted', meta: { deckId } });
      return { success: true };
    } catch (error: any) {
      logger.error({
        scope: 'main/deck',
        msg: 'Failed to delete user deck',
        err: { message: error.message },
      });
      return { success: false, error: error.message };
    }
  });

  /**
   * Get the user data paths (for renderer to construct image URLs)
   */
  ipcMain.handle('get-user-data-paths', async () => {
    return {
      userDataPath: app.getPath('userData'),
      decksPath: getUserDecksDir(),
      imagesPath: getUserDeckImagesDir(),
    };
  });
}

/**
 * App event handlers
 */
function setupAppEvents(): void {
  // App ready
  app.whenReady().then(() => {
    logger.info({ scope: 'main/app', msg: 'app ready' });
    
    // Register custom protocol for user deck images BEFORE creating window
    registerUserDeckImageProtocol();
    
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
    err: { message: error.message, stack: error.stack },
  });
  app.quit();
});

process.on('unhandledRejection', (reason) => {
  logger.error({
    scope: 'main/unhandled',
    msg: 'unhandled rejection',
    err: { reason: String(reason) },
  });
});

// Initialize the app
setupAppEvents();
