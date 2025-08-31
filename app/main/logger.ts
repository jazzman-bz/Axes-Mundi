import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import pino from 'pino';

/**
 * Resolve log directory based on environment
 */
function resolveLogDir(): string {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const base = process.env.AXM_ENV === 'development'
    ? path.join(process.cwd(), 'logs')
    : path.join(appData, 'Axes-Mundi', 'logs');

  fs.mkdirSync(base, { recursive: true });
  return base;
}

const logDir = resolveLogDir();
const logFile = path.join(logDir, 'latest.log');

/**
 * Main process logger
 */
export const logger = pino({
  level: process.env.AXM_LOG_LEVEL || (process.env.AXM_ENV === 'development' ? 'info' : 'info'),
  base: null,
  timestamp: () => `,"t":"${new Date().toISOString()}"`,
  formatters: {
    level: (label) => ({ lvl: label }),
  },
}, pino.destination({ dest: logFile, sync: false }));

/**
 * Rotate logs if needed (called daily at 00:05)
 */
export function rotateIfNeeded(): void {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const daily = path.join(logDir, `app-${today}.log`);

    if (!fs.existsSync(daily)) {
      fs.copyFileSync(logFile, daily);
      logger.info({ scope: 'main/logger', msg: 'log rotated', meta: { daily } });
    }

    // Clean up old logs (keep last 14 days)
    const files = fs.readdirSync(logDir)
      .filter((file) => file.startsWith('app-') && file.endsWith('.log'))
      .map((file) => ({ name: file, path: path.join(logDir, file) }))
      .map((file) => ({ ...file, stat: fs.statSync(file.path) }))
      .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());

    // Remove files older than 14 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);

    files.slice(14).forEach((file) => {
      if (file.stat.mtime < cutoff) {
        fs.unlinkSync(file.path);
        logger.debug({ scope: 'main/logger', msg: 'removed old log', meta: { file: file.name } });
      }
    });
  } catch (error: any) {
    logger.error({
      scope: 'main/logger',
      msg: 'log rotation failed',
      err: { message: error.message, stack: error.stack },
    });
  }
}

// Set up rotation check on startup
setTimeout(rotateIfNeeded, 1000);
