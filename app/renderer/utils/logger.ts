import pino from 'pino';

/**
 * Renderer process logger
 */
export const logger = pino({
  level: (window as any).AXM?.logLevel || 'info',
  browser: { asObject: true },
  base: null,
  timestamp: () => `,"t":"${new Date().toISOString()}"`,
  formatters: {
    level: (label) => ({ lvl: label }),
  },
});

// Log renderer startup
logger.info({ scope: 'renderer/logger', msg: 'renderer logger initialized' });

// Log renderer startup
logger.info({ scope: 'renderer/logger', msg: 'renderer logger initialized' });
