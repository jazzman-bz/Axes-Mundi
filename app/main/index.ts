import {
  app, BrowserWindow, ipcMain, dialog, protocol, session,
} from 'electron';
import { randomUUID } from 'crypto';
import { join } from 'path';
import {
  readFile, writeFile, mkdir, readdir, rename, copyFile, stat,
} from 'fs/promises';
import { existsSync } from 'fs';
import AdmZip from 'adm-zip';
import { logger } from './logger';
import { LANWebSocketServer } from './websocket-server';
import versionInfo from '../generated/version';
import {
  assertDeckArchiveEntries,
  assertDeckArchiveSize,
  assertSafeDeckId,
  getImageContentType,
  isDeckImageEntry,
  isDeckJsonEntry,
  parseImportedDeck,
  resolveUserDeckAssetPath,
} from '../shared/deckSecurity';
import { isAllowedAppUrl } from './navigationPolicy';
import {
  parseLanCardDistribution,
  parseLanGameState,
} from '../shared/lanProtocol';
import {
  MatchScoreTransaction,
  PlayerAccount,
  PlayerAccountsFile,
  applyScoreTransaction,
  createPlayerAccount,
  normalizeAccountName,
  normalizeAvatar,
  parseMatchScoreTransaction,
  parsePlayerAccountsFile,
} from '../shared/playerAccounts';

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
    },
  },
]);

// User data paths for imported decks
const getUserDecksDir = () => join(app.getPath('userData'), 'decks');
const getUserDeckImagesDir = () => join(app.getPath('userData'), 'deck-images');
const getPlayerAccountsPath = () => join(app.getPath('userData'), 'accounts.json');

const DEV_SERVER_URL = 'http://localhost:5179';

function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.AXM_ENV === 'development';
}

function getAppUrlPolicy() {
  return isDevelopment()
    ? { devServerUrl: DEV_SERVER_URL }
    : { rendererDir: join(__dirname, '../../renderer') };
}

/**
 * Account changes read, modify and write one file. Running them one after another
 * keeps two quick IPC calls (e.g. both Hotseat scores) from overwriting each other.
 */
let accountsQueue: Promise<unknown> = Promise.resolve();
function withAccountsLock<T>(task: () => Promise<T>): Promise<T> {
  const run = accountsQueue.then(task, task);
  accountsQueue = run.catch(() => undefined);
  return run;
}

function getAccountsBackupPath(kind: 'corrupt' | 'backup'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return join(app.getPath('userData'), `accounts.${kind}-${timestamp}.json`);
}

/**
 * Reads the accounts file. Never loses data on a bad file:
 * - unreadable (permissions, I/O): throws, so nothing gets written over it
 * - not valid JSON or not an accounts file: moved aside to accounts.corrupt-<time>.json
 * - some entries unusable: a copy is kept as accounts.backup-<time>.json before they are dropped
 */
async function readPlayerAccountsFile(): Promise<PlayerAccountsFile> {
  const accountsPath = getPlayerAccountsPath();
  if (!existsSync(accountsPath)) {
    return { version: 1, accounts: [] };
  }

  const fileContents = await readFile(accountsPath, 'utf-8');

  let parsed: ReturnType<typeof parsePlayerAccountsFile>;
  try {
    parsed = parsePlayerAccountsFile(JSON.parse(fileContents));
  } catch (error: any) {
    const corruptPath = getAccountsBackupPath('corrupt');
    await rename(accountsPath, corruptPath);
    logger.error({
      scope: 'main/accounts',
      msg: 'Player accounts file was unreadable and has been moved aside',
      meta: { path: accountsPath, movedTo: corruptPath },
      err: { message: error.message },
    });
    return { version: 1, accounts: [] };
  }

  if (parsed.droppedAccounts > 0) {
    const backupPath = getAccountsBackupPath('backup');
    await copyFile(accountsPath, backupPath);
    logger.warn({
      scope: 'main/accounts',
      msg: 'Skipped invalid player accounts; kept a copy of the original file',
      meta: { droppedAccounts: parsed.droppedAccounts, backupPath },
    });
  }

  return parsed.file;
}

/** Writes to a temporary file first, so a crash mid-write never leaves a half-written accounts file. */
async function writePlayerAccountsFile(accountsFile: PlayerAccountsFile): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true });
  const accountsPath = getPlayerAccountsPath();
  const temporaryPath = `${accountsPath}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(accountsFile, null, 2), 'utf-8');
  await rename(temporaryPath, accountsPath);
}

/**
 * Keeps every window on the app's own pages: no new windows, no navigation to other
 * sites or files, no <webview>, and no browser permissions (camera, location, ...).
 */
function hardenWebContents(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      logger.warn({ scope: 'main/security', msg: 'Blocked new window', meta: { url } });
      return { action: 'deny' };
    });

    const blockForeignNavigation = (event: Electron.Event, url: string) => {
      if (!isAllowedAppUrl(url, getAppUrlPolicy())) {
        event.preventDefault();
        logger.warn({ scope: 'main/security', msg: 'Blocked navigation', meta: { url } });
      }
    };
    contents.on('will-navigate', blockForeignNavigation);
    contents.on('will-redirect', blockForeignNavigation);

    contents.on('will-attach-webview', (event) => {
      event.preventDefault();
      logger.warn({ scope: 'main/security', msg: 'Blocked webview' });
    });
  });
}

function denyPermissionRequests(): void {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    logger.warn({ scope: 'main/security', msg: 'Denied permission request', meta: { permission } });
    callback(false);
  });
}

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
      const finalPath = resolveUserDeckAssetPath(getUserDeckImagesDir(), imageFolder, imageName);
      if (!existsSync(finalPath)) {
        return new Response('Not Found', { status: 404 });
      }

      // Read file and serve
      const fileData = await readFile(finalPath);
      const uint8Array = new Uint8Array(fileData);

      return new Response(uint8Array, {
        status: 200,
        headers: {
          'Content-Type': getImageContentType(imageName),
          'Content-Length': fileData.length.toString(),
        },
      });
    } catch (error: any) {
      logger.error({
        scope: 'main/protocol',
        msg: 'Failed to serve user deck image',
        meta: { url: request.url },
        err: { message: error.message },
      });
      return new Response('Internal Error', { status: 500 });
    }
  });
}

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;
let lanServer: LANWebSocketServer | null = null;

async function tryStartLanServer(
  ports: number[],
  playerName: string,
  playerAvatar: string,
  index: number = 0,
): Promise<{ port: number | null; error: Error | null }> {
  if (index >= ports.length) {
    return { port: null, error: null };
  }

  const port = ports[index];

  try {
    logger.info({ scope: 'main/lan', msg: `Trying port ${port}...` });
    lanServer = new LANWebSocketServer(port, playerName, playerAvatar);
    await lanServer.start();
    logger.info({ scope: 'main/lan', msg: `Successfully started on port ${port}` });
    return { port, error: null };
  } catch (error: any) {
    logger.warn({
      scope: 'main/lan',
      msg: `Port ${port} failed: ${error.message}`,
      err: { message: error.message },
    });

    const nextAttempt = await tryStartLanServer(ports, playerName, playerAvatar, index + 1);
    return nextAttempt.port
      ? nextAttempt
      : { port: null, error };
  }
}

// Make mainWindow globally available for WebSocket server
declare global {
  // eslint-disable-next-line no-var, vars-on-top
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
        preload: join(__dirname, '../../preload/preload/index.js'),
      },
      title: 'Axes-Mundi',
      icon: join(__dirname, '../assets/icon.png'), // Will be added later
      show: false, // Don't show until ready
    });

    // Update global reference
    global.mainWindow = mainWindow;

    // Load the app
    // Check if we're in development mode
    if (isDevelopment()) {
      mainWindow.loadURL(DEV_SERVER_URL);
      mainWindow.webContents.openDevTools();
    } else {
      mainWindow.loadFile(join(__dirname, '../../renderer/index.html'));
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

  ipcMain.handle('get-version-info', () => {
    logger.debug({ scope: 'main/ipc', msg: 'get-version-info requested' });
    return {
      ...versionInfo,
      appVersion: app.getVersion(),
    };
  });

  // Get app environment
  ipcMain.handle('get-environment', () => {
    logger.debug({ scope: 'main/ipc', msg: 'get-environment requested' });
    return {
      env: process.env.AXM_ENV || 'development',
      logLevel: process.env.AXM_LOG_LEVEL || 'info',
    };
  });

  ipcMain.handle('quit-app', () => {
    logger.info({ scope: 'main/ipc', msg: 'quit-app requested' });
    setImmediate(() => {
      app.quit();
    });
    return { success: true };
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

  ipcMain.handle('get-player-accounts', async () => {
    try {
      const accountsFile = await withAccountsLock(readPlayerAccountsFile);
      return { success: true, accounts: accountsFile.accounts };
    } catch (error: any) {
      logger.error({
        scope: 'main/accounts',
        msg: 'failed to read player accounts',
        err: { message: error.message },
      });
      return { success: false, error: error.message, accounts: [] };
    }
  });

  ipcMain.handle('create-player-account', async (_, input: any) => {
    try {
      const account = await withAccountsLock(async () => {
        const accountsFile = await readPlayerAccountsFile();
        const createdAccount = createPlayerAccount(input, randomUUID(), new Date().toISOString());
        accountsFile.accounts.push(createdAccount);
        await writePlayerAccountsFile(accountsFile);
        return createdAccount;
      });

      logger.info({
        scope: 'main/accounts',
        msg: 'player account created',
        meta: { accountId: account.id, name: account.name },
      });

      return { success: true, account };
    } catch (error: any) {
      logger.error({
        scope: 'main/accounts',
        msg: 'failed to create player account',
        err: { message: error.message },
      });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('update-player-account', async (_, accountId: string, input: any) => {
    try {
      if (typeof accountId !== 'string' || accountId.trim().length === 0) {
        throw new Error('Account id is required');
      }

      const updatedAccount = await withAccountsLock(async () => {
        const accountsFile = await readPlayerAccountsFile();
        const accountIndex = accountsFile.accounts.findIndex((account) => account.id === accountId);
        if (accountIndex === -1) {
          throw new Error('Account not found');
        }

        const existingAccount = accountsFile.accounts[accountIndex];
        const nextAccount: PlayerAccount = {
          ...existingAccount,
          name: input?.name === undefined ? existingAccount.name : normalizeAccountName(input.name),
          avatar: input?.avatar === undefined ? existingAccount.avatar : normalizeAvatar(input.avatar),
          updatedAt: new Date().toISOString(),
        };

        accountsFile.accounts[accountIndex] = nextAccount;
        await writePlayerAccountsFile(accountsFile);
        return nextAccount;
      });

      logger.info({
        scope: 'main/accounts',
        msg: 'player account updated',
        meta: { accountId: updatedAccount.id, name: updatedAccount.name },
      });

      return { success: true, account: updatedAccount };
    } catch (error: any) {
      logger.error({
        scope: 'main/accounts',
        msg: 'failed to update player account',
        err: { message: error.message },
      });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('commit-match-score', async (_, rawTransaction: unknown) => {
    try {
      const transaction: MatchScoreTransaction = parseMatchScoreTransaction(rawTransaction);

      const { result, previousTotalScore } = await withAccountsLock(async () => {
        const accountsFile = await readPlayerAccountsFile();
        const accountIndex = accountsFile.accounts.findIndex((account) => account.id === transaction.accountId);
        if (accountIndex === -1) {
          throw new Error('Account not found');
        }

        const previousTotal = accountsFile.accounts[accountIndex].stats.totalScore;
        const scoreResult = applyScoreTransaction(accountsFile.accounts[accountIndex], transaction);
        accountsFile.accounts[accountIndex] = scoreResult.account;

        if (scoreResult.applied) {
          await writePlayerAccountsFile(accountsFile);
        }
        return { result: scoreResult, previousTotalScore: previousTotal };
      });

      logger.info({
        scope: 'main/accounts',
        msg: result.applied ? 'match score committed' : 'match score already committed',
        meta: {
          accountId: transaction.accountId,
          matchId: transaction.matchId,
          scoreDelta: transaction.scoreDelta,
        },
      });

      return {
        success: true, account: result.account, applied: result.applied, previousTotalScore,
      };
    } catch (error: any) {
      logger.error({
        scope: 'main/accounts',
        msg: 'failed to commit match score',
        err: { message: error.message },
      });
      return { success: false, error: error.message };
    }
  });

  // Send deck selection to client
  ipcMain.handle('send-deck-selection', async (_, deckId: string) => {
    try {
      assertSafeDeckId(deckId, 'Deck id');
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
      const parsedDistribution = parseLanCardDistribution(distribution);
      logger.info({
        scope: 'main/lan',
        msg: 'Sending card distribution to client',
        meta: {
          boardCard: parsedDistribution.boardCard?.id,
          serverHandSize: parsedDistribution.serverHand.length,
          clientHandSize: parsedDistribution.clientHand.length,
          deckSize: parsedDistribution.deckOrder.length,
        },
      });

      if (lanServer) {
        await lanServer.sendCardDistribution(parsedDistribution);
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
      if (typeof currentPlayer !== 'string' || currentPlayer.trim().length === 0) {
        throw new Error('Current player name is required');
      }

      logger.info({
        scope: 'main/lan',
        msg: 'Sending current player update to client',
        meta: { currentPlayer: currentPlayer.trim() },
      });

      if (lanServer) {
        await lanServer.sendCurrentPlayerSet(currentPlayer.trim());
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
      if (typeof cardId !== 'string' || !cardId.trim()) {
        throw new Error('Invalid card ID');
      }
      if (!Number.isFinite(boardPosition)) {
        throw new Error('Invalid board position - must be a finite number');
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
      const parsedGameState = parseLanGameState(gameState);
      logger.info({
        scope: 'main/lan',
        msg: 'LAN game state update requested (local only)',
        meta: {
          currentPlayer: parsedGameState.currentPlayer,
          placedCardsCount: parsedGameState.placedCards.length,
        },
      });

      // For now, just log the game state update - no WebSocket transmission
      // Later we can add WebSocket functionality here
      logger.info({
        scope: 'main/lan',
        msg: 'game state updated locally',
        meta: {
          currentPlayer: parsedGameState.currentPlayer,
          placedCardsCount: parsedGameState.placedCards.length,
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
      if (typeof playerName !== 'string' || playerName.trim().length === 0) {
        throw new Error('Player name is required');
      }

      logger.info({ scope: 'main/lan', msg: 'Starting LAN server...', meta: { playerName, playerAvatar } });

      if (lanServer) {
        logger.info({ scope: 'main/lan', msg: 'Stopping existing server' });
        lanServer.stop();
      }

      // Try different ports if 8080 is busy
      const ports = [8080, 8081, 8082, 8083, 8084];
      const { port: startedPort, error: lastError } = await tryStartLanServer(
        ports,
        playerName,
        playerAvatar,
      );

      if (startedPort) {
        const serverInfo = lanServer!.getServerInfo();
        logger.info({
          scope: 'main/lan',
          msg: 'LAN server started successfully',
          meta: { port: startedPort, playerName },
        });

        if (global.mainWindow && global.mainWindow.webContents) {
          global.mainWindow.webContents.send('lan-status-update', {
            type: 'serverStarted',
            serverInfo,
            message: `Server started on ${serverInfo.ip}:${serverInfo.port}`,
          });
          global.mainWindow.webContents.send('server-info-update', serverInfo);
        }

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
   * - description in deck.json (optional but recommended for richer deck tiles)
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

      // Check sizes before anything is read into memory or unpacked
      assertDeckArchiveSize((await stat(zipPath)).size);
      const zip = new AdmZip(zipPath);
      const zipEntries = zip.getEntries();
      assertDeckArchiveEntries(zipEntries.map((entry) => ({
        name: entry.entryName,
        size: entry.header.size,
        isDirectory: entry.isDirectory,
      })));

      // Find deck.json in the ZIP
      const deckJsonEntry = zipEntries.find((entry) => !entry.isDirectory && isDeckJsonEntry(entry.entryName));

      if (!deckJsonEntry) {
        logger.error({ scope: 'main/deck', msg: 'No deck.json found in ZIP' });
        return { success: false, error: 'No deck.json found in the ZIP file' };
      }

      // Parse and validate deck.json
      const deckJsonContent = deckJsonEntry.getData().toString('utf8');
      let deck;
      try {
        deck = parseImportedDeck(JSON.parse(deckJsonContent));
      } catch (parseError: any) {
        logger.error({
          scope: 'main/deck',
          msg: 'Invalid deck.json payload',
          err: { message: parseError.message },
        });
        return { success: false, error: parseError.message };
      }

      // Create user decks directory if it doesn't exist
      const userDecksDir = getUserDecksDir();
      if (!existsSync(userDecksDir)) {
        await mkdir(userDecksDir, { recursive: true });
        logger.info({ scope: 'main/deck', msg: 'Created user decks directory', meta: { path: userDecksDir } });
      }

      // Each imported deck keeps its images in a folder named after its id,
      // so one deck can never overwrite (or, on delete, remove) another deck's images.
      const imageFolder = assertSafeDeckId(deck.id);
      const storedDeck = { ...deck, imageFolder };

      // Save deck.json to user decks folder
      const deckTargetPath = join(userDecksDir, `${imageFolder}.json`);
      await writeFile(deckTargetPath, JSON.stringify(storedDeck, null, 2), 'utf-8');
      logger.info({ scope: 'main/deck', msg: 'Deck JSON saved', meta: { path: deckTargetPath } });

      // Extract images if present
      const userImagesDir = join(getUserDeckImagesDir(), imageFolder);

      // Image entries live in an images/ folder; ZIP tools write / or \\ as separator
      const imageEntries = zipEntries.filter((entry) => !entry.isDirectory && isDeckImageEntry(entry.entryName));

      if (imageEntries.length > 0) {
        if (!existsSync(userImagesDir)) {
          await mkdir(userImagesDir, { recursive: true });
          logger.info({ scope: 'main/deck', msg: 'Created user images directory', meta: { path: userImagesDir } });
        }

        // Extract each image
        await Promise.all(imageEntries.map(async (imageEntry) => {
          // Normalize path separators and get just the filename
          const normalizedPath = imageEntry.entryName.replace(/\\/g, '/');
          const imageName = normalizedPath.split('/').pop(); // Get just filename
          if (imageName) {
            const imageTargetPath = resolveUserDeckAssetPath(getUserDeckImagesDir(), imageFolder, imageName);
            const imageData = imageEntry.getData();
            await writeFile(imageTargetPath, imageData);
          }
        }));
        logger.info({
          scope: 'main/deck',
          msg: 'Images extracted',
          meta: { count: imageEntries.length, folder: imageFolder },
        });
      }

      logger.info({
        scope: 'main/deck',
        msg: 'Deck imported successfully',
        meta: {
          deckId: deck.id,
          name: deck.name,
          cardCount: deck.cards.length,
          imageCount: imageEntries.length,
        },
      });

      return {
        success: true,
        deck: {
          id: deck.id,
          name: deck.name,
          description: deck.description,
          axis: deck.axis,
          theme: deck.theme || 'custom',
          locale: deck.locale || 'en',
          cardCount: deck.cards.length,
          imageFolder,
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
      const deckFiles = files.filter((f) => f.endsWith('.json'));

      const decks = (await Promise.all(deckFiles.map(async (file) => {
        try {
          const content = await readFile(join(userDecksDir, file), 'utf-8');
          const deck = parseImportedDeck(JSON.parse(content));
          return {
            id: deck.id,
            name: deck.name,
            description: deck.description,
            axis: deck.axis,
            theme: deck.theme,
            locale: deck.locale,
            cardCount: deck.cards.length,
            imageFolder: deck.imageFolder,
            isUserDeck: true,
          };
        } catch (e) {
          logger.warn({ scope: 'main/deck', msg: 'Failed to read user deck', meta: { file } });
          return null;
        }
      }))).filter(Boolean);

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
    try {
      const safeDeckId = assertSafeDeckId(deckId, 'Deck id');
      const deckPath = join(getUserDecksDir(), `${safeDeckId}.json`);

      if (!existsSync(deckPath)) {
        return { success: false, error: 'Deck not found' };
      }

      const content = await readFile(deckPath, 'utf-8');
      const deck = parseImportedDeck(JSON.parse(content));
      logger.info({ scope: 'main/deck', msg: 'User deck loaded', meta: { deckId: safeDeckId, cardCount: deck.cards.length } });
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
      const safeDeckId = assertSafeDeckId(deckId, 'Deck id');
      const deckPath = join(getUserDecksDir(), `${safeDeckId}.json`);

      if (!existsSync(deckPath)) {
        return { success: false, error: 'Deck not found' };
      }

      // Read deck to get imageFolder before deleting
      const content = await readFile(deckPath, 'utf-8');
      const deck = parseImportedDeck(JSON.parse(content));
      const { imageFolder } = deck;

      // Delete deck JSON
      const { unlink, rm } = await import('fs/promises');
      await unlink(deckPath);

      // Delete images folder if exists
      const imagesPath = join(getUserDeckImagesDir(), imageFolder);
      if (existsSync(imagesPath)) {
        await rm(imagesPath, { recursive: true, force: true });
      }

      logger.info({ scope: 'main/deck', msg: 'User deck deleted', meta: { deckId: safeDeckId } });
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
  ipcMain.handle('get-user-data-paths', async () => ({
    userDataPath: app.getPath('userData'),
    decksPath: getUserDecksDir(),
    imagesPath: getUserDeckImagesDir(),
    accountsPath: getPlayerAccountsPath(),
  }));
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
    denyPermissionRequests();

    setupIPC();
    createWindow();
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
hardenWebContents();
setupAppEvents();
