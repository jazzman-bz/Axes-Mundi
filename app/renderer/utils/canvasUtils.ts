import { logger } from '@/utils/logger';

/**
 * Draw a rounded rectangle on a canvas context
 * @param ctx - Canvas 2D rendering context
 * @param x - X coordinate of top-left corner
 * @param y - Y coordinate of top-left corner
 * @param width - Width of the rectangle
 * @param height - Height of the rectangle
 * @param radius - Corner radius
 */
export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  // Ensure radius doesn't exceed half the smallest dimension
  const safeRadius = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
  ctx.fill();
}

/**
 * Wrap text to fit within a specified width
 * @param text - The text to wrap
 * @param maxWidth - Maximum width in pixels
 * @param ctx - Canvas 2D rendering context (needed for text measurement)
 * @returns Array of text lines
 */
export function wrapText(
  text: string,
  maxWidth: number,
  ctx: CanvasRenderingContext2D,
): string[] {
  if (!text || maxWidth <= 0) {
    return text ? [text] : [];
  }

  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Convert an image's non-transparent pixels to white
 * Useful for icons that need to be displayed in different colors
 * @param image - The source HTMLImageElement
 * @returns Promise that resolves to the white version of the image
 */
export function convertImageToWhite(image: HTMLImageElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    try {
      if (!image.complete || image.width === 0) {
        reject(new Error('Image not loaded or has zero dimensions'));
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not get canvas 2D context'));
        return;
      }

      canvas.width = image.width;
      canvas.height = image.height;

      ctx.drawImage(image, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { data } = imageData;

      // Convert all non-transparent pixels to white
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha > 0) {
          data[i] = 255; // Red
          data[i + 1] = 255; // Green
          data[i + 2] = 255; // Blue
        }
      }

      ctx.putImageData(imageData, 0, 0);

      const whiteImage = new Image();
      whiteImage.onload = () => {
        logger.debug({ scope: 'utils/canvasUtils', msg: 'image converted to white' });
        resolve(whiteImage);
      };
      whiteImage.onerror = () => {
        reject(new Error('Failed to create white image from canvas'));
      };
      whiteImage.src = canvas.toDataURL();
    } catch (error: unknown) {
      const err = error as Error;
      logger.error({
        scope: 'utils/canvasUtils',
        msg: 'failed to convert image to white',
        err: { message: err.message, stack: err.stack },
      });
      reject(error);
    }
  });
}
