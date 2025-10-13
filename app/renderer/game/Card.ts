import { Card as CardData, Deck } from '@/data/types';
import { logger } from '@/utils/logger';

/**
 * Visual card component
 */
export class GameCard {
  public x: number;

  public y: number;

  public width: number;

  public height: number;

  public card: CardData;

  public deck: Deck; // Add deck reference for image folder

  public isSelected: boolean = false;

  public isDragging: boolean = false;

  public dragOffsetX: number = 0;

  public dragOffsetY: number = 0;

  public targetX: number | null = null;

  public targetY: number | null = null;

  public easingFactor: number = 0.2;

  public isHovered: boolean = false;

  public isCorrect: boolean | null = null;

  public isInHand: boolean = true; // Track if card is in hand or placed on axis

  public showCardBack: boolean = false; // Track if card should show back instead of front

  // Image loading
  private imageElement: HTMLImageElement | null = null;

  private imageLoaded: boolean = false;

  // Timer for correct card highlighting
  private correctTimer: number | null = null;

  // Preview position for drag feedback
  private previewX: number | null = null;

  private previewY: number | null = null;

  private originalX: number | null = null; // Store original position before preview

  private originalY: number | null = null;

  // Hand position for return to hand functionality
  private handX: number | null = null;

  private handY: number | null = null;

  // Weiter button bounds for learning mode
  public weiterButtonBounds: { x: number; y: number; width: number; height: number } | null = null;

  constructor(card: CardData, deck: Deck, x: number, y: number, scale: number = 1) {
    this.card = card;
    this.deck = deck;
    this.x = x;
    this.y = y;
    this.scale = scale;
    this.width = 200 * scale;
    this.height = 300 * scale;
  }

  private scale: number = 1;

  private readonly baseWidth: number = 200;

  private readonly baseHeight: number = 300;

  /**
   * Force reload card image (for scale changes)
   */
  private forceReloadCardImage(): void {
    if (!this.card.image) return;

    // Clear existing image state
    this.imageLoaded = false;
    this.imageElement = null;

    // Load the image again
    this.loadCardImage();
  }

  /**
   * Load card image if available
   */
  private loadCardImage(): void {
    if (!this.card.image) return;

    // Only load if not already loaded (for initial load)
    if (this.imageElement && this.imageLoaded) return;

    try {
      this.imageElement = new Image();
      this.imageElement.onload = () => {
        this.imageLoaded = true;
        logger.debug({
          scope: 'game/card',
          msg: 'card image loaded successfully',
          meta: { cardId: this.card.id, image: this.card.image },
        });
      };
      this.imageElement.onerror = () => {
        logger.warn({
          scope: 'game/card',
          msg: 'failed to load card image',
          meta: { cardId: this.card.id, image: this.card.image },
        });
      };

      // Load from assets folder using deck's imageFolder property
      // Try both .jpg and .png extensions since we have mixed formats
      // Handle cases where image name already contains file extension
      let imagePath: string;
      const imageName = this.card.image;

      // Check if image name already has an extension
      // Look for actual file extensions, not just dots in the name
      const hasExtension = imageName.toLowerCase().endsWith('.jpg')
                          || imageName.toLowerCase().endsWith('.png')
                          || imageName.toLowerCase().endsWith('.jpeg');

      // Build image path with RELATIVE path (./) - works in both Electron and browser
      // When the page is loaded from http://localhost:5179/game.html, ./assets/ resolves correctly
      if (this.deck.imageFolder && this.deck.imageFolder.trim() !== '') {
        if (hasExtension) {
          imagePath = `./assets/${this.deck.imageFolder}/${imageName}`;
        } else {
          imagePath = `./assets/${this.deck.imageFolder}/${imageName}.jpg`;
        }
      } else if (hasExtension) {
        imagePath = `./assets/${imageName}`;
      } else {
        imagePath = `./assets/${imageName}.jpg`;
      }

      // Try to load the image, if it fails, try .png extension
      console.log('🖼️ Loading card image:', imagePath);
      this.imageElement.src = imagePath;

      // Add fallback for .png files
      let triedPng = false;
      this.imageElement.onerror = () => {
        if (!triedPng) {
          // Try .png extension if .jpg failed
          let pngPath: string;
          if (imagePath.includes('.jpg')) {
            pngPath = imagePath.replace('.jpg', '.png');
          } else if (imagePath.includes('.jpeg')) {
            pngPath = imagePath.replace('.jpeg', '.png');
          } else {
            // If no extension found, try adding .png
            pngPath = imagePath.replace(/(\.[^.]*)?$/, '.png');
          }

          triedPng = true;
          logger.debug({
            scope: 'game/card',
            msg: 'trying .png extension as fallback',
            meta: { cardId: this.card.id, originalPath: imagePath, pngPath },
          });
          this.imageElement.src = pngPath;
        } else {
          logger.warn({
            scope: 'game/card',
            msg: 'failed to load card image (both .jpg and .png)',
            meta: { cardId: this.card.id, image: this.card.image },
          });
        }
      };
    } catch (error) {
      logger.error({
        scope: 'game/card',
        msg: 'error loading card image',
        err: { message: error.message, stack: error.stack },
      });
    }
  }

  /**
   * Check if point is inside card
   */
  public containsPoint(px: number, py: number): boolean {
    return px >= this.x && px <= this.x + this.width
           && py >= this.y && py <= this.y + this.height;
  }

  /**
   * Start dragging
   */
  public startDrag(mouseX: number, mouseY: number): void {
    this.isDragging = true;
    this.dragOffsetX = mouseX - this.x;
    this.dragOffsetY = mouseY - this.y;
    logger.debug({
      scope: 'game/card',
      msg: 'card drag started',
      meta: { cardId: this.card.id, mouseX, mouseY },
    });
  }

  /**
   * Update drag position
   */
  public updateDrag(mouseX: number, mouseY: number): void {
    if (this.isDragging) {
      this.x = mouseX - this.dragOffsetX;
      this.y = mouseY - this.dragOffsetY;
    }
  }

  /**
   * Stop dragging
   */
  public stopDrag(): void {
    this.isDragging = false;
    logger.debug({
      scope: 'game/card',
      msg: 'card drag stopped',
      meta: { cardId: this.card.id, finalX: this.x, finalY: this.y },
    });
  }

  /**
   * Store hand position for return to hand functionality
   */
  public storeHandPosition(x: number, y: number): void {
    this.handX = x;
    this.handY = y;
    logger.debug({
      scope: 'game/card',
      msg: 'hand position stored',
      meta: { cardId: this.card.id, handX: x, handY: y },
    });
  }

  /**
   * Return card to its hand position
   */
  public returnToHand(): void {
    if (this.handX !== null && this.handY !== null) {
      // Clear any target positions
      this.targetX = null;
      this.targetY = null;

      // Set target to hand position
      this.setTargetPosition(this.handX, this.handY);

      // Reset card state
      this.isInHand = true;

      logger.debug({
        scope: 'game/card',
        msg: 'card returning to hand',
        meta: { cardId: this.card.id, handX: this.handX, handY: this.handY },
      });
    } else {
      logger.warn({
        scope: 'game/card',
        msg: 'cannot return to hand - no hand position stored',
        meta: { cardId: this.card.id },
      });
    }
  }

  /**
   * Set smooth movement target
   */
  public setTargetPosition(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
  }

  /**
   * Set preview position for drag feedback
   */
  public setPreviewPosition(x: number, y: number): void {
    // Store original position if not already stored
    if (this.originalX === null && this.originalY === null) {
      this.originalX = this.x;
      this.originalY = this.y;
    }

    this.previewX = x;
    this.previewY = y;
  }

  /**
   * Clear preview position and restore original position
   */
  public clearPreviewPosition(): void {
    // Restore original position if available
    if (this.originalX !== null && this.originalY !== null) {
      this.x = this.originalX;
      this.y = this.originalY;
    }

    this.previewX = null;
    this.previewY = null;
    this.originalX = null;
    this.originalY = null;
  }

  /**
   * Tick animation
   */
  public tick(): void {
    if (this.isDragging) {
      return;
    }

    // Handle preview position (with easing for smooth animation)
    if (this.previewX !== null && this.previewY !== null) {
      const dx = this.previewX - this.x;
      const dy = this.previewY - this.y;

      // Use faster easing for preview (more responsive)
      const previewEasing = 0.3; // Faster than normal easing

      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        this.x = this.previewX;
        this.y = this.previewY;
      } else {
        this.x += dx * previewEasing;
        this.y += dy * previewEasing;
      }
      return;
    }

    // Handle target position (with easing)
    if (this.targetX === null || this.targetY === null) {
      return;
    }

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.targetX = null;
      this.targetY = null;
      return;
    }
    this.x += dx * this.easingFactor;
    this.y += dy * this.easingFactor;
  }

  /**
   * Update scale for this card and adjust positions accordingly
   */
  public updateScale(newScale: number): void {
    const oldScale = this.scale;
    this.scale = newScale;
    this.width = this.baseWidth * newScale;
    this.height = this.baseHeight * newScale;

    // Adjust positions proportionally to maintain relative positioning
    if (oldScale !== newScale) {
      const scaleRatio = newScale / oldScale;
      this.x *= scaleRatio;
      this.y *= scaleRatio;

      // Also update target positions if they exist
      if (this.targetX !== null && this.targetY !== null) {
        this.targetX *= scaleRatio;
        this.targetY *= scaleRatio;
      }

      // Update preview positions if they exist
      if (this.previewX !== null && this.previewY !== null) {
        this.previewX *= scaleRatio;
        this.previewY *= scaleRatio;
      }

      // Force reload image with new scale for proper rendering
      this.forceReloadCardImage();

      logger.debug({
        scope: 'game/card',
        msg: 'card scale updated with image reload',
        meta: {
          cardId: this.card.id,
          oldScale,
          newScale,
          newWidth: this.width,
          newHeight: this.height,
          newX: this.x,
          newY: this.y,
        },
      });
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.correctTimer) {
      clearTimeout(this.correctTimer);
      this.correctTimer = null;
    }
    logger.debug({
      scope: 'game/card',
      msg: 'card destroyed, timer cleared',
      meta: { cardId: this.card.id },
    });
  }

  /**
   * Toggle selection
   */
  public toggleSelection(): void {
    this.isSelected = !this.isSelected;
    logger.debug({
      scope: 'game/card',
      msg: 'card selection toggled',
      meta: { cardId: this.card.id, isSelected: this.isSelected },
    });
  }

  /**
   * Set card as correct and start timer to remove highlighting
   */
  public setCorrect(): void {
    this.isCorrect = true;

    // Clear existing timer if any
    if (this.correctTimer) {
      clearTimeout(this.correctTimer);
    }

    // Set timer to remove green highlighting after 2 seconds
    this.correctTimer = setTimeout(() => {
      this.isCorrect = null;
      this.correctTimer = null;
      logger.debug({
        scope: 'game/card',
        msg: 'correct card highlighting removed',
        meta: { cardId: this.card.id },
      });
    }, 2000);

    logger.debug({
      scope: 'game/card',
      msg: 'card marked as correct, timer started',
      meta: { cardId: this.card.id },
    });
  }

  /**
   * Set card as incorrect
   */
  public setIncorrect(): void {
    this.isCorrect = false;

    // Clear existing timer if any
    if (this.correctTimer) {
      clearTimeout(this.correctTimer);
      this.correctTimer = null;
    }

    logger.debug({
      scope: 'game/card',
      msg: 'card marked as incorrect',
      meta: { cardId: this.card.id },
    });
  }

  /**
   * Render card
   */
  public render(ctx: CanvasRenderingContext2D): void {
    // Apply hover effects
    const hoverScale = this.isHovered ? 1.1 : 1.0;
    const hoverOffsetY = this.isHovered ? -10 : 0;

    // Save context for transformations
    ctx.save();
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    ctx.scale(hoverScale, hoverScale);
    ctx.translate(-(this.x + this.width / 2), -(this.y + this.height / 2));

    const cardX = this.x;
    const cardY = this.y + hoverOffsetY;

    // Draw dark textured border (outer frame) with rounded corners
    ctx.fillStyle = '#2a2a2a';
    this.drawRoundedRect(ctx, cardX - 2 * this.scale, cardY - 2 * this.scale, this.width + 4 * this.scale, this.height + 4 * this.scale, 8 * this.scale);

    // Draw main card background with rounded corners
    ctx.fillStyle = '#f5f5f5';
    this.drawRoundedRect(ctx, cardX, cardY, this.width, this.height, 6 * this.scale);

    // If showing card back, draw simple card back design
    if (this.showCardBack) {
      this.drawCardBack(ctx, cardX, cardY);
      ctx.restore();
      return;
    }

    // Draw light gray background for the entire top section (for images)
    const topSectionHeight = this.baseHeight * 0.6 * this.scale; // Use more of the card height
    const topSectionY = cardY + 4 * this.scale; // Start even closer to top (4px instead of 8px)
    ctx.fillStyle = '#f0f0f0'; // Light gray background
    ctx.fillRect(cardX + 4 * this.scale, topSectionY, (this.baseWidth - 8) * this.scale, topSectionHeight);

    // Load and draw card image
    this.loadCardImage();
    if (this.imageElement && this.imageLoaded) {
      try {
        // Calculate image dimensions with margin for nice border - centered on entire card
        const imageMargin = 8 * this.scale; // 8px margin for nice border
        const availableWidth = this.baseWidth * this.scale; // Full card width
        const availableImageWidth = availableWidth - (imageMargin * 2); // Margin on both sides
        const availableImageHeight = topSectionHeight - (imageMargin * 2); // Margin top/bottom

        // Center the image area on the entire card width
        const imageX = cardX + (availableWidth - availableImageWidth) / 2; // Centered on card
        const imageY = topSectionY + imageMargin; // Gray background + margin
        const imageWidth = availableImageWidth;
        const imageHeight = availableImageHeight;

        // Draw image maintaining aspect ratio with current scale
        const actualImageDimensions = this.drawImageMaintainingAspectRatio(
          ctx,
          this.imageElement,
          imageX,
          imageY,
          imageWidth,
          imageHeight,
        );

        // Draw black border exactly around the actual image (not the available space)
        if (actualImageDimensions) {
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2 * this.scale; // 2px border width
          ctx.strokeRect(
            actualImageDimensions.x,
            actualImageDimensions.y,
            actualImageDimensions.width,
            actualImageDimensions.height,
          );
        }
      } catch (error) {
        logger.error({
          scope: 'game/card',
          msg: 'error drawing card image',
          err: { message: error.message, stack: error.stack },
        });
      }
    }

    // Draw light gray bottom section (for description)
    const bottomSectionY = topSectionY + topSectionHeight + 4 * this.scale; // Space for title
    const bottomSectionHeight = this.height - bottomSectionY + cardY;
    ctx.fillStyle = '#e8e8e8';
    this.drawRoundedRect(ctx, cardX + 4 * this.scale, bottomSectionY, (this.baseWidth - 8) * this.scale, bottomSectionHeight, 4 * this.scale);

    // Draw metallic bar between title and description
    const barHeight = 4 * this.scale;
    const barY = bottomSectionY - 12 * this.scale; // Above the description section
    this.drawMetallicBar(ctx, cardX + 4 * this.scale, barY, (this.baseWidth - 8) * this.scale, barHeight);

    // Draw subtle pattern in bottom section
    this.drawPattern(ctx, cardX + 4 * this.scale, bottomSectionY, (this.baseWidth - 8) * this.scale, bottomSectionHeight);

    // Removed the small metallic element - measurement will be drawn directly on card

    // Apply state-based overlay
    if (this.isCorrect === true) {
      // Green overlay for correct cards
      ctx.fillStyle = 'rgba(76, 175, 80, 0.3)';
      ctx.fillRect(cardX, cardY, this.width, this.height);
    } else if (this.isCorrect === false) {
      // Red overlay for incorrect cards
      ctx.fillStyle = 'rgba(244, 67, 54, 0.3)';
      ctx.fillRect(cardX, cardY, this.width, this.height);
    }

    // Draw card title (in the gray section) - perfectly centered vertically with line breaks and bold
    ctx.fillStyle = '#000000';
    ctx.font = `bold ${16 * this.scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const maxTitleWidth = (this.baseWidth - 16) * this.scale;
    this.drawWrappedTextCentered(ctx, this.card.title, cardX + this.width / 2, bottomSectionY + bottomSectionHeight / 2, maxTitleWidth, 18 * this.scale);

    // Draw measurement value centered on the card (only when not in hand)
    if (!this.isInHand) {
      ctx.fillStyle = '#000000';
      ctx.font = `bold ${16 * this.scale}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.card.displayValue, cardX + this.width / 2, cardY + this.height - 12 * this.scale);
    }

    // Reset alpha and restore context
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /**
   * Draw rounded rectangle
   */
  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }

  /**
      * Draw image filling the entire available space (aspect ratio may be changed)
      * Images are stretched to fill the exact dimensions provided
      * Returns the actual dimensions and position of the drawn image
      */
  private drawImageMaintainingAspectRatio(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    maxWidth: number,
    maxHeight: number,
  ): { x: number; y: number; width: number; height: number } | null {
    // Always use the full available space - stretch image to fit exactly
    const drawWidth = maxWidth;
    const drawHeight = maxHeight;
    const drawX = x;
    const drawY = y;

    // Enable image smoothing for better quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Draw the image stretched to fill the entire available rectangle
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

    logger.debug({
      scope: 'game/card',
      msg: 'image drawn stretched to fill entire space',
      meta: {
        cardId: this.card.id,
        scale: this.scale,
        drawWidth,
        drawHeight,
        maxWidth,
        maxHeight,
        originalAspect: img.width / img.height,
        targetAspect: maxWidth / maxHeight,
        actualPosition: {
          x: drawX, y: drawY, width: drawWidth, height: drawHeight,
        },
      },
    });

    // Return actual image dimensions and position
    return {
      x: drawX,
      y: drawY,
      width: drawWidth,
      height: drawHeight,
    };
  }

  /**
   * Draw metallic bar with 3D effect
   */
  private drawMetallicBar(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
    // Main metallic color
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, '#c0c0c0');
    gradient.addColorStop(0.5, '#e0e0e0');
    gradient.addColorStop(1, '#a0a0a0');

    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);

    // Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillRect(x, y, width, height / 2);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(x, y + height / 2, width, height / 2);
  }

  /**
    * Draw subtle pattern in bottom section
    */
  private drawPattern(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.2)';
    ctx.lineWidth = 1 * this.scale; // Scale line width

    // Draw some subtle lines
    for (let i = 0; i < 3; i++) {
      const lineY = y + (height / 4) * (i + 1);
      ctx.beginPath();
      ctx.moveTo(x + 10 * this.scale, lineY);
      ctx.lineTo(x + width - 10 * this.scale, lineY);
      ctx.stroke();
    }
  }

  /**
   * Draw wrapped text
   */
  private drawWrappedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let i = 0; i < words.length; i++) {
      const testLine = `${line + words[i]} `;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && i > 0) {
        ctx.fillText(line, x, currentY);
        line = `${words[i]} `;
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
  }

  /**
   * Draw wrapped text centered
   */
  private drawWrappedTextCentered(ctx: CanvasRenderingContext2D, text: string, centerX: number, centerY: number, maxWidth: number, lineHeight: number): void {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    // First, split text into lines
    for (let i = 0; i < words.length; i++) {
      const testLine = `${currentLine + words[i]} `;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && i > 0) {
        lines.push(currentLine.trim());
        currentLine = `${words[i]} `;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }

    // Calculate total height and starting Y position
    const totalHeight = lines.length * lineHeight;
    const startY = centerY - totalHeight / 2 + lineHeight / 2;

    // Draw each line centered
    lines.forEach((line, index) => {
      const y = startY + index * lineHeight;
      ctx.fillText(line, centerX, y);
    });
  }

  /**
   * Draw card back design
   */
  private drawCardBack(ctx: CanvasRenderingContext2D, cardX: number, cardY: number): void {
    // Draw card back background
    ctx.fillStyle = '#2c3e50';
    this.drawRoundedRect(ctx, cardX, cardY, this.width, this.height, 6 * this.scale);

    // Draw black border (1px) around card back
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    this.drawRoundedRect(ctx, cardX, cardY, this.width, this.height, 6 * this.scale);
    ctx.stroke();

    // Draw decorative pattern
    ctx.fillStyle = '#34495e';
    const patternSize = 20 * this.scale;
    for (let x = cardX + 10 * this.scale; x < cardX + this.width - 10 * this.scale; x += patternSize) {
      for (let y = cardY + 10 * this.scale; y < cardY + this.height - 10 * this.scale; y += patternSize) {
        ctx.fillRect(x, y, patternSize - 2 * this.scale, patternSize - 2 * this.scale);
      }
    }

    // Draw "Axes-Mundi" text in center
    ctx.fillStyle = '#ecf0f1';
    ctx.font = `bold ${18 * this.scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Axes-Mundi', cardX + this.width / 2, cardY + this.height / 2);

    // Draw small logo or symbol
    ctx.fillStyle = '#3498db';
    ctx.font = `${24 * this.scale}px Arial`;
    ctx.fillText('🎯', cardX + this.width / 2, cardY + this.height / 2 - 40 * this.scale);
  }
}
