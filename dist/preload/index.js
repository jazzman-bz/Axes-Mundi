"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
/**
 * Expose protected methods that allow the renderer process to use
 * the ipcRenderer without exposing the entire object
 */
electron_1.contextBridge.exposeInMainWorld('AXM', {
    // App info
    version: '1.0.0',
    logLevel: process.env.AXM_LOG_LEVEL || 'info',
    // IPC methods
    getVersion: () => electron_1.ipcRenderer.invoke('get-version'),
    getEnvironment: () => electron_1.ipcRenderer.invoke('get-environment'),
    placeCard: (index) => electron_1.ipcRenderer.invoke('place-card', index),
    // LAN Server management
    startLANServer: (playerName) => electron_1.ipcRenderer.invoke('start-lan-server', playerName),
    stopLANServer: () => electron_1.ipcRenderer.invoke('stop-lan-server'),
    sendDeckSelection: (deckId) => electron_1.ipcRenderer.invoke('send-deck-selection', deckId),
    sendCurrentPlayerUpdate: (currentPlayer) => electron_1.ipcRenderer.invoke('send-current-player-update', currentPlayer),
    sendCardDistribution: (distribution) => electron_1.ipcRenderer.invoke('send-card-distribution', distribution),
    sendGameStartTrigger: () => electron_1.ipcRenderer.invoke('send-game-start-trigger'),
    // LAN Game actions
    placeLANCard: (cardId, position) => electron_1.ipcRenderer.invoke('lan-place-card', cardId, position),
    updateGameState: (gameState) => electron_1.ipcRenderer.invoke('update-lan-game-state', gameState),
    // Test IPC connection
    testIPC: () => electron_1.ipcRenderer.invoke('test-ipc'),
    // Event listeners
    on: (channel, func) => {
        // Whitelist channels
        const validChannels = ['game-update', 'score-update', 'lan-status-update'];
        if (validChannels.includes(channel)) {
            electron_1.ipcRenderer.on(channel, (_event, ...args) => func(...args));
        }
    },
    removeAllListeners: (channel) => {
        const validChannels = ['game-update', 'score-update', 'lan-status-update'];
        if (validChannels.includes(channel)) {
            electron_1.ipcRenderer.removeAllListeners(channel);
        }
    },
});
