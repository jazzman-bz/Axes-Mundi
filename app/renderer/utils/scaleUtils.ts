/**
 * Scale calculation configuration
 */
export interface ScaleConfig {
  /** Base width for scaling (default: 1920) */
  baseWidth?: number;
  /** Base height for scaling (default: 1080) */
  baseHeight?: number;
  /** Maximum scale factor (default: 1.5) */
  maxScale?: number;
  /** Minimum scale factor (default: 0.5) */
  minScale?: number;
}

const DEFAULT_CONFIG: Required<ScaleConfig> = {
  baseWidth: 1920,
  baseHeight: 1080,
  maxScale: 1.5,
  minScale: 0.5,
};

/**
 * Calculate scale factor based on window size
 * @param width - Current window width
 * @param height - Current window height
 * @param config - Scale configuration options
 * @returns Calculated scale factor
 */
export function calculateScale(
  width: number,
  height: number,
  config: ScaleConfig = {},
): number {
  const {
    baseWidth = DEFAULT_CONFIG.baseWidth,
    baseHeight = DEFAULT_CONFIG.baseHeight,
    maxScale = DEFAULT_CONFIG.maxScale,
    minScale = DEFAULT_CONFIG.minScale,
  } = config;

  const scaleX = width / baseWidth;
  const scaleY = height / baseHeight;
  const scale = Math.min(scaleX, scaleY);

  // Clamp between min and max
  return Math.max(minScale, Math.min(scale, maxScale));
}

/**
 * Calculate scale from window object
 * @param window - Window object (for browser compatibility)
 * @param config - Scale configuration options
 * @returns Calculated scale factor
 */
export function calculateScaleFromWindow(
  window: Window,
  config: ScaleConfig = {},
): number {
  return calculateScale(window.innerWidth, window.innerHeight, config);
}

/**
 * Calculate snap threshold based on scale
 * @param scale - Current scale factor
 * @param baseThreshold - Base threshold in pixels (default: 80)
 * @returns Scaled threshold
 */
export function calculateSnapThreshold(
  scale: number,
  baseThreshold: number = 80,
): number {
  return baseThreshold * scale;
}
