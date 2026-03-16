import { contextBridge, ipcRenderer } from 'electron';

interface AppVersionInfo {
  appVersion: string;
  commit: string;
  branch?: string;
  dirty?: boolean;
  buildDate?: string;
}

/**
 * Expose protected methods that allow the renderer process to use
 * the ipcRenderer without exposing the entire object
 */
contextBridge.exposeInMainWorld('AXM', {
  // App info
  version: process.env.npm_package_version || 'unknown',
  logLevel: process.env.AXM_LOG_LEVEL || 'info',

  // IPC methods
  getVersion: () => ipcRenderer.invoke('get-version'),
  getVersionInfo: () => ipcRenderer.invoke('get-version-info'),
  getEnvironment: () => ipcRenderer.invoke('get-environment'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  placeCard: (index: number) => ipcRenderer.invoke('place-card', index),

  // LAN Server management
  startLANServer: (playerName: string, playerAvatar?: string) => ipcRenderer.invoke('start-lan-server', playerName, playerAvatar || 'default'),
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

  // Deck Import methods
  importDeck: () => ipcRenderer.invoke('import-deck'),
  getUserDecks: () => ipcRenderer.invoke('get-user-decks'),
  loadUserDeck: (deckId: string) => ipcRenderer.invoke('load-user-deck', deckId),
  deleteUserDeck: (deckId: string) => ipcRenderer.invoke('delete-user-deck', deckId),
  getUserDataPaths: () => ipcRenderer.invoke('get-user-data-paths'),

  // Debug method to log from renderer to main process terminal
  debugLog: (message: string, data?: any) => ipcRenderer.invoke('debug-log', message, data),

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
      getVersionInfo: () => Promise<AppVersionInfo>;
      getEnvironment: () => Promise<{ env: string; logLevel: string }>;
      quitApp: () => Promise<{ success: boolean }>;
      placeCard: (index: number) => Promise<{ success: boolean; score: number }>;
      startLANServer: (playerName: string, playerAvatar?: string) => Promise<{ success: boolean; port: number }>;
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

      // Deck Import methods
      importDeck: () => Promise<{
        success: boolean;
        cancelled?: boolean;
        error?: string;
        deck?: {
          id: string;
          name: string;
          description?: string;
          axis: string;
          theme: string;
          locale: string;
          cardCount: number;
          imageFolder: string;
          isUserDeck: boolean;
        };
      }>;
      getUserDecks: () => Promise<{
        success: boolean;
        error?: string;
        decks: Array<{
          id: string;
          name: string;
          description?: string;
          axis: string;
          theme: string;
          locale: string;
          cardCount: number;
          imageFolder: string;
          isUserDeck: boolean;
        }>;
      }>;
      loadUserDeck: (deckId: string) => Promise<{
        success: boolean;
        error?: string;
        deck?: any;
      }>;
      deleteUserDeck: (deckId: string) => Promise<{
        success: boolean;
        error?: string;
      }>;
      getUserDataPaths: () => Promise<{
        userDataPath: string;
        decksPath: string;
        imagesPath: string;
      }>;
    };
  }
}
