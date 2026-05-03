import { logger } from '@/utils/logger';
import {
  calculateScaleFromWindow,
  ScaleConfig,
} from '@/utils/scaleUtils';

/**
 * Resize handler callback function type
 */
export type ResizeCallback = (params: {
  width: number;
  height: number;
  scale: number;
}) => void;

/**
 * Resize handler options
 */
export interface ResizeHandlerOptions extends ScaleConfig {
  /** Debounce delay in milliseconds (default: 100) */
  debounceMs?: number;
  /** Scope for logging */
  scope?: string;
}

/**
 * Resize handler for managing window and canvas resizing
 */
export class ResizeHandler {
  private canvas: HTMLCanvasElement;

  private callbacks: Set<ResizeCallback> = new Set();

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  private currentScale: number = 1;

  private config: Required<ResizeHandlerOptions>;

  private boundHandleResize: () => void;

  private isAttached: boolean = false;

  constructor(
    canvas: HTMLCanvasElement,
    options: ResizeHandlerOptions = {},
  ) {
    this.canvas = canvas;
    const {
      debounceMs = 100,
      scope = 'utils/resizeHandler',
      ...scaleConfig
    } = options;

    this.config = {
      debounceMs,
      scope,
      baseWidth: scaleConfig.baseWidth ?? 1920,
      baseHeight: scaleConfig.baseHeight ?? 1080,
      maxScale: scaleConfig.maxScale ?? 1.5,
      minScale: scaleConfig.minScale ?? 0.5,
    };

    this.boundHandleResize = this.handleResize.bind(this);

    // Calculate initial scale
    this.currentScale = calculateScaleFromWindow(window, this.config);
  }

  /**
   * Get current scale factor
   */
  get scale(): number {
    return this.currentScale;
  }

  /**
   * Handle window resize (debounced)
   */
  handleResize(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.performResize();
    }, this.config.debounceMs);
  }

  /**
   * Perform actual resize operation
   */
  private performResize(): void {
    try {
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Resize canvas
      this.canvas.width = width;
      this.canvas.height = height;

      // Recalculate scale
      this.currentScale = calculateScaleFromWindow(window, this.config);

      logger.debug({
        scope: this.config.scope,
        msg: 'window resized',
        meta: {
          width,
          height,
          scale: this.currentScale,
        },
      });

      // Notify all callbacks
      this.callbacks.forEach((callback) => {
        try {
          callback({
            width,
            height,
            scale: this.currentScale,
          });
        } catch (error: any) {
          logger.error({
            scope: this.config.scope,
            msg: 'resize callback failed',
            err: { message: error.message },
          });
        }
      });
    } catch (error: any) {
      logger.error({
        scope: this.config.scope,
        msg: 'resize failed',
        err: { message: error.message, stack: error.stack },
      });
    }
  }

  /**
   * Register a callback for resize events
   * @param callback - Function to call on resize
   * @returns Unsubscribe function
   */
  onResize(callback: ResizeCallback): () => void {
    this.callbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Attach resize listener to window
   */
  attach(): void {
    if (this.isAttached) {
      logger.warn({
        scope: this.config.scope,
        msg: 'resize handler already attached',
      });
      return;
    }

    window.addEventListener('resize', this.boundHandleResize);
    this.isAttached = true;

    // Perform initial resize
    this.performResize();

    logger.debug({
      scope: this.config.scope,
      msg: 'resize handler attached',
    });
  }

  /**
   * Detach resize listener from window
   */
  detach(): void {
    if (!this.isAttached) {
      return;
    }

    window.removeEventListener('resize', this.boundHandleResize);
    this.isAttached = false;

    logger.debug({
      scope: this.config.scope,
      msg: 'resize handler detached',
    });
  }

  /**
   * Remove all callbacks and cleanup
   */
  destroy(): void {
    this.detach();

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.callbacks.clear();

    logger.debug({
      scope: this.config.scope,
      msg: 'resize handler destroyed',
    });
  }
}
