"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.rotateIfNeeded = rotateIfNeeded;
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
const pino_1 = __importDefault(require("pino"));
/**
 * Resolve log directory based on environment
 */
function resolveLogDir() {
    const appData = process.env.APPDATA || node_path_1.default.join(node_os_1.default.homedir(), 'AppData', 'Roaming');
    const base = process.env.AXM_ENV === 'development'
        ? node_path_1.default.join(process.cwd(), 'logs')
        : node_path_1.default.join(appData, 'Axes-Mundi', 'logs');
    node_fs_1.default.mkdirSync(base, { recursive: true });
    return base;
}
const logDir = resolveLogDir();
const logFile = node_path_1.default.join(logDir, 'latest.log');
/**
 * Main process logger
 */
exports.logger = (0, pino_1.default)({
    level: process.env.AXM_LOG_LEVEL || (process.env.AXM_ENV === 'development' ? 'info' : 'info'),
    base: null,
    timestamp: () => `,"t":"${new Date().toISOString()}"`,
    formatters: {
        level: (label) => ({ lvl: label }),
    },
}, pino_1.default.destination({ dest: logFile, sync: false }));
/**
 * Rotate logs if needed (called daily at 00:05)
 */
function rotateIfNeeded() {
    try {
        const today = new Date().toISOString().slice(0, 10);
        const daily = node_path_1.default.join(logDir, `app-${today}.log`);
        if (!node_fs_1.default.existsSync(daily)) {
            node_fs_1.default.copyFileSync(logFile, daily);
            exports.logger.info({ scope: 'main/logger', msg: 'log rotated', meta: { daily } });
        }
        // Clean up old logs (keep last 14 days)
        const files = node_fs_1.default.readdirSync(logDir)
            .filter(file => file.startsWith('app-') && file.endsWith('.log'))
            .map(file => ({ name: file, path: node_path_1.default.join(logDir, file) }))
            .map(file => ({ ...file, stat: node_fs_1.default.statSync(file.path) }))
            .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());
        // Remove files older than 14 days
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 14);
        files.slice(14).forEach(file => {
            if (file.stat.mtime < cutoff) {
                node_fs_1.default.unlinkSync(file.path);
                exports.logger.debug({ scope: 'main/logger', msg: 'removed old log', meta: { file: file.name } });
            }
        });
    }
    catch (error) {
        exports.logger.error({
            scope: 'main/logger',
            msg: 'log rotation failed',
            err: { message: error.message, stack: error.stack }
        });
    }
}
// Set up rotation check on startup
setTimeout(rotateIfNeeded, 1000);
