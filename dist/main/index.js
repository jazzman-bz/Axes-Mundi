"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = require("path");
const logger_1 = require("./logger");
const websocket_server_1 = require("./websocket-server");
// Keep a global reference of the window object
let mainWindow = null;
let lanServer = null;
global.mainWindow = mainWindow;
/**
 * Create the main application window
 */
function createWindow() {
    try {
        // Create the browser window
        mainWindow = new electron_1.BrowserWindow({
            width: 1200,
            height: 800,
            minWidth: 800,
            minHeight: 600,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
                preload: (0, path_1.join)(__dirname, '../preload/index.js'),
            },
            title: 'Axes-Mundi',
            icon: (0, path_1.join)(__dirname, '../assets/icon.png'), // Will be added later
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
        }
        else {
            mainWindow.loadFile((0, path_1.join)(__dirname, '../renderer/index.html'));
        }
        // Show window when ready to prevent visual flash
        mainWindow.once('ready-to-show', () => {
            mainWindow?.show();
            logger_1.logger.info({ scope: 'main/window', msg: 'window ready to show' });
        });
        // Handle window closed
        mainWindow.on('closed', () => {
            mainWindow = null;
            logger_1.logger.info({ scope: 'main/window', msg: 'window closed' });
        });
        logger_1.logger.info({ scope: 'main/window', msg: 'window created' });
    }
    catch (error) {
        logger_1.logger.error({
            scope: 'main/window',
            msg: 'failed to create window',
            err: { message: error.message, stack: error.stack }
        });
    }
}
/**
 * Set up IPC handlers
 */
function setupIPC() {
    // Get app version
    electron_1.ipcMain.handle('get-version', () => {
        logger_1.logger.debug({ scope: 'main/ipc', msg: 'get-version requested' });
        return electron_1.app.getVersion();
    });
    // Get app environment
    electron_1.ipcMain.handle('get-environment', () => {
        logger_1.logger.debug({ scope: 'main/ipc', msg: 'get-environment requested' });
        return {
            env: process.env.AXM_ENV || 'development',
            logLevel: process.env.AXM_LOG_LEVEL || 'info',
        };
    });
    // Test IPC connection
    electron_1.ipcMain.handle('test-ipc', () => {
        logger_1.logger.info({ scope: 'main/ipc', msg: 'test-ipc requested' });
        return { success: true, message: 'IPC connection working' };
    });
    // Send deck selection to client
    electron_1.ipcMain.handle('send-deck-selection', async (_, deckId) => {
        try {
            logger_1.logger.info({ scope: 'main/lan', msg: 'Sending deck selection to client', meta: { deckId } });
            if (lanServer) {
                await lanServer.sendDeckSelection(deckId);
                return { success: true };
            }
            else {
                logger_1.logger.warn({ scope: 'main/lan', msg: 'No LAN server running' });
                return { success: false, error: 'No LAN server running' };
            }
        }
        catch (error) {
            logger_1.logger.error({
                scope: 'main/lan',
                msg: 'Failed to send deck selection',
                err: { message: error.message }
            });
            return { success: false, error: error.message };
        }
    });
    // Send card distribution to client
    electron_1.ipcMain.handle('send-card-distribution', async (_, distribution) => {
        try {
            logger_1.logger.info({
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
            }
            else {
                logger_1.logger.warn({ scope: 'main/lan', msg: 'No LAN server running' });
                return { success: false, error: 'No LAN server running' };
            }
        }
        catch (error) {
            logger_1.logger.error({
                scope: 'main/lan',
                msg: 'Failed to send card distribution',
                err: { message: error.message }
            });
            return { success: false, error: error.message };
        }
    });
    // Send game start trigger to client
    electron_1.ipcMain.handle('send-game-start-trigger', async () => {
        try {
            logger_1.logger.info({
                scope: 'main/lan',
                msg: 'Sending game start trigger to client'
            });
            if (lanServer) {
                await lanServer.sendGameStartTrigger();
                return { success: true };
            }
            else {
                logger_1.logger.warn({ scope: 'main/lan', msg: 'No LAN server running' });
                return { success: false, error: 'No LAN server running' };
            }
        }
        catch (error) {
            logger_1.logger.error({
                scope: 'main/lan',
                msg: 'Failed to send game start trigger',
                err: { message: error.message }
            });
            return { success: false, error: error.message };
        }
    });
    // Send current player update to client
    electron_1.ipcMain.handle('send-current-player-update', async (_, currentPlayer) => {
        try {
            logger_1.logger.info({
                scope: 'main/lan',
                msg: 'Sending current player update to client',
                meta: { currentPlayer }
            });
            if (lanServer) {
                await lanServer.sendCurrentPlayerUpdate(currentPlayer);
                return { success: true };
            }
            else {
                logger_1.logger.warn({ scope: 'main/lan', msg: 'No LAN server running' });
                return { success: false, error: 'No LAN server running' };
            }
        }
        catch (error) {
            logger_1.logger.error({
                scope: 'main/lan',
                msg: 'Failed to send current player update',
                err: { message: error.message }
            });
            return { success: false, error: error.message };
        }
    });
    // LAN card placement with WebSocket integration
    electron_1.ipcMain.handle('lan-place-card', async (_, cardId, position) => {
        try {
            logger_1.logger.info({
                scope: 'main/lan',
                msg: 'LAN card placement requested',
                meta: { cardId, position }
            });
            // Validate input
            if (typeof cardId !== 'string' || !cardId) {
                throw new Error('Invalid card ID');
            }
            if (position !== 'left' && position !== 'right') {
                throw new Error('Invalid position - must be left or right');
            }
            // Send card placement to all connected clients via WebSocket
            if (lanServer) {
                // Get current player from renderer (this would need to be passed)
                const currentPlayer = 'Server'; // TODO: Get actual current player
                await lanServer.sendCardPlacement(cardId, position, currentPlayer);
                logger_1.logger.info({
                    scope: 'main/lan',
                    msg: 'card placement sent to clients via WebSocket',
                    meta: { cardId, position, currentPlayer }
                });
                return { success: true, message: 'Card placement sent to clients' };
            }
            else {
                logger_1.logger.warn({ scope: 'main/lan', msg: 'No LAN server running' });
                return { success: false, error: 'No LAN server running' };
            }
        }
        catch (error) {
            logger_1.logger.error({
                scope: 'main/lan',
                msg: 'Failed to handle LAN card placement',
                err: { message: error.message }
            });
            return { success: false, error: error.message };
        }
    });
    // Update LAN game state (local only, no WebSocket)
    electron_1.ipcMain.handle('update-lan-game-state', async (_, gameState) => {
        try {
            logger_1.logger.info({
                scope: 'main/lan',
                msg: 'LAN game state update requested (local only)',
                meta: {
                    currentPlayer: gameState.currentPlayer,
                    placedCardsCount: gameState.placedCards?.length || 0
                }
            });
            // For now, just log the game state update - no WebSocket transmission
            // Later we can add WebSocket functionality here
            logger_1.logger.info({
                scope: 'main/lan',
                msg: 'game state updated locally',
                meta: {
                    currentPlayer: gameState.currentPlayer,
                    placedCardsCount: gameState.placedCards?.length || 0
                }
            });
            return { success: true, message: 'Game state updated locally' };
        }
        catch (error) {
            logger_1.logger.error({
                scope: 'main/lan',
                msg: 'Failed to update LAN game state',
                err: { message: error.message }
            });
            return { success: false, error: error.message };
        }
    });
    // LAN Server management
    electron_1.ipcMain.handle('start-lan-server', async (_, playerName) => {
        try {
            logger_1.logger.info({ scope: 'main/lan', msg: 'Starting LAN server...', meta: { playerName } });
            if (lanServer) {
                logger_1.logger.info({ scope: 'main/lan', msg: 'Stopping existing server' });
                lanServer.stop();
            }
            // Try different ports if 8080 is busy
            const ports = [8080, 8081, 8082, 8083, 8084];
            let startedPort = null;
            let lastError = null;
            for (const port of ports) {
                try {
                    logger_1.logger.info({ scope: 'main/lan', msg: `Trying port ${port}...` });
                    lanServer = new websocket_server_1.LANWebSocketServer(port, playerName);
                    await lanServer.start();
                    startedPort = port;
                    logger_1.logger.info({ scope: 'main/lan', msg: `Successfully started on port ${port}` });
                    break;
                }
                catch (error) {
                    lastError = error;
                    logger_1.logger.warn({
                        scope: 'main/lan',
                        msg: `Port ${port} failed: ${error.message}`,
                        err: { message: error.message }
                    });
                }
            }
            if (startedPort) {
                logger_1.logger.info({ scope: 'main/lan', msg: 'LAN server started successfully', meta: { port: startedPort, playerName } });
                return { success: true, port: startedPort };
            }
            else {
                const errorMsg = lastError ? lastError.message : 'No available ports';
                logger_1.logger.error({
                    scope: 'main/lan',
                    msg: 'All ports failed',
                    err: { message: errorMsg }
                });
                return { success: false, error: errorMsg };
            }
        }
        catch (error) {
            logger_1.logger.error({
                scope: 'main/lan',
                msg: 'Failed to start LAN server',
                err: { message: error.message, stack: error.stack }
            });
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('stop-lan-server', async () => {
        try {
            if (lanServer) {
                lanServer.stop();
                lanServer = null;
                logger_1.logger.info({ scope: 'main/lan', msg: 'LAN server stopped' });
            }
            return { success: true };
        }
        catch (error) {
            logger_1.logger.error({
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
function setupAppEvents() {
    // App ready
    electron_1.app.whenReady().then(() => {
        logger_1.logger.info({ scope: 'main/app', msg: 'app ready' });
        createWindow();
        setupIPC();
    });
    // Quit when all windows are closed
    electron_1.app.on('window-all-closed', () => {
        logger_1.logger.info({ scope: 'main/app', msg: 'all windows closed, quitting' });
        if (process.platform !== 'darwin') {
            electron_1.app.quit();
        }
    });
    // Activate (macOS)
    electron_1.app.on('activate', () => {
        logger_1.logger.debug({ scope: 'main/app', msg: 'app activated' });
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
    // App quit
    electron_1.app.on('before-quit', () => {
        logger_1.logger.info({ scope: 'main/app', msg: 'app quitting' });
        if (lanServer) {
            lanServer.stop();
        }
    });
}
// Set up global error handlers
process.on('uncaughtException', (error) => {
    logger_1.logger.error({
        scope: 'main/uncaught',
        msg: 'uncaught exception',
        err: { message: error.message, stack: error.stack }
    });
    electron_1.app.quit();
});
process.on('unhandledRejection', (reason) => {
    logger_1.logger.error({
        scope: 'main/unhandled',
        msg: 'unhandled rejection',
        err: { reason: String(reason) }
    });
});
// Initialize the app
setupAppEvents();
