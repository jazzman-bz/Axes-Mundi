"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = require("path");
const logger_1 = require("./logger");
// Keep a global reference of the window object
let mainWindow = null;
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
        // Load the app
        const isDev = process.env.NODE_ENV === 'development' || process.env.AXM_ENV === 'development';
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
    // Place card (placeholder for game logic)
    electron_1.ipcMain.handle('place-card', async (_, index) => {
        try {
            logger_1.logger.info({ scope: 'main/game', msg: 'card placement requested', meta: { index } });
            // Validate input
            if (typeof index !== 'number' || index < 0) {
                throw new Error('Invalid card index');
            }
            // TODO: Implement actual game logic
            const result = { success: true, score: 100 };
            logger_1.logger.info({ scope: 'main/game', msg: 'card placed successfully', meta: { index, result } });
            return result;
        }
        catch (error) {
            logger_1.logger.error({
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
