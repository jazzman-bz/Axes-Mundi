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

  // Event listeners
  on: (channel: string, func: (...args: any[]) => void) => {
    // Whitelist channels
    const validChannels = ['game-update', 'score-update'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => func(...args));
    }
  },

  removeAllListeners: (channel: string) => {
    const validChannels = ['game-update', 'score-update'];
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
      on: (channel: string, func: (...args: any[]) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}
