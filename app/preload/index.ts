import { contextBridge, ipcRenderer } from 'electron';

/**
 * Expose protected methods that allow the renderer process to use
 * the ipcRenderer without exposing the entire object
 */
contextBridge.exposeInMainWorld('AXM', {
  // App info
  version: '1.0.0',
  logLevel: process.env.AXM_LOG_LEVEL || 'info',

  // IPC methods
  getVersion: () => ipcRenderer.invoke('get-version'),
  getEnvironment: () => ipcRenderer.invoke('get-environment'),
  placeCard: (index: number) => ipcRenderer.invoke('place-card', index),

  // LAN Server management
  startLANServer: (playerName: string) => ipcRenderer.invoke('start-lan-server', playerName),
  stopLANServer: () => ipcRenderer.invoke('stop-lan-server'),
  sendDeckSelection: (deckId: string) => ipcRenderer.invoke('send-deck-selection', deckId),
  sendCurrentPlayerUpdate: (currentPlayer: string) => ipcRenderer.invoke('send-current-player-update', currentPlayer),
  sendCardDistribution: (distribution: any) => ipcRenderer.invoke('send-card-distribution', distribution),
  sendGameStartTrigger: () => ipcRenderer.invoke('send-game-start-trigger'),

  // LAN Game actions
  placeLANCard: (cardId: string, boardPosition: number) => ipcRenderer.invoke('lan-place-card', cardId, boardPosition),
  updateGameState: (gameState: any) => ipcRenderer.invoke('update-lan-game-state', gameState),

  // Test IPC connection
  testIPC: () => ipcRenderer.invoke('test-ipc'),

  // Event listeners
  on: (channel: string, func: (...args: any[]) => void) => {
    // Whitelist channels
    const validChannels = ['game-update', 'score-update', 'lan-status-update', 'client-player-joined', 'server-info-update'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => func(...args));
    }
  },

  removeAllListeners: (channel: string) => {
    const validChannels = ['game-update', 'score-update', 'lan-status-update', 'client-player-joined', 'server-info-update'];
    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },
});

// Type definitions for TypeScript
declare global {
  interface Window {
    AXM: {
      version: string;
      logLevel: string;
      getVersion: () => Promise<string>;
      getEnvironment: () => Promise<{ env: string; logLevel: string }>;
      placeCard: (index: number) => Promise<{ success: boolean; score: number }>;
      startLANServer: (playerName: string) => Promise<{ success: boolean; port: number }>;
      stopLANServer: () => Promise<{ success: boolean }>;
      sendDeckSelection: (deckId: string) => Promise<{ success: boolean }>;
      sendCurrentPlayerUpdate: (currentPlayer: string) => Promise<{ success: boolean }>;
      sendCardDistribution: (distribution: any) => Promise<{ success: boolean }>;
      sendGameStartTrigger: () => Promise<{ success: boolean }>;

      // LAN Game actions
      placeLANCard: (cardId: string, boardPosition: number) => Promise<{ success: boolean; message: string }>;
      updateGameState: (gameState: any) => Promise<{ success: boolean; message: string }>;

      testIPC: () => Promise<{ success: boolean; message: string }>;
      on: (channel: string, func: (...args: any[]) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}
