import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { logger } from './logger';

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;

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

    // Load the app
    const isDev = process.env.NODE_ENV === 'development' || process.env.AXM_ENV === 'development';
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

  // Place card (placeholder for game logic)
  ipcMain.handle('place-card', async (_, index: number) => {
    try {
      logger.info({ scope: 'main/game', msg: 'card placement requested', meta: { index } });
      
      // Validate input
      if (typeof index !== 'number' || index < 0) {
        throw new Error('Invalid card index');
      }

      // TODO: Implement actual game logic
      const result = { success: true, score: 100 };
      
      logger.info({ scope: 'main/game', msg: 'card placed successfully', meta: { index, result } });
      return result;
    } catch (error: any) {
      logger.error({ 
        scope: 'main/game', 
        msg: 'card placement failed', 
        meta: { index },
        err: { message: error.message, stack: error.stack } 
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
