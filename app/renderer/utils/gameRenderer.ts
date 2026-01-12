import { GameCard } from '@/game/Card';
import { drawRoundedRect, wrapText } from '@/utils/canvasUtils';
import { getOpponentCardCount } from '@/utils/cardDealer';
import { logger } from '@/utils/logger';

/**
 * Get avatar emoji from avatar ID
 */
function getAvatarEmoji(avatarId: string | number | null | undefined): string {
  const AVATAR_EMOJIS: Record<string, string> = {
    '1': '👨‍🚀', // Astronaut
    '2': '🧙‍♂️', // Magier
    '3': '🏴‍☠️', // Pirat
    '4': '🦄', // Einhorn
    '5': '🤖', // Roboter
    '6': '🐉', // Drache
  };
  if (!avatarId) return '👤';
  return AVATAR_EMOJIS[String(avatarId)] || '👤';
}

/**
 * Render state - all data needed for rendering
 */
export interface RenderState {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  backgroundImage: HTMLImageElement | null;
  logoImage: HTMLImageElement | null;
  arrowLeftImage: HTMLImageElement | null;
  arrowRightImage: HTMLImageElement | null;
  scale: number;
  boardCard: GameCard | null;
  playerHand: GameCard[];
  opponentHand: GameCard[];
  placedLeft: GameCard[];
  placedRight: GameCard[];
  graveyard: GameCard[];
  draggingCard: GameCard | null;
  score: number;
  currentTurn: number;
  turnText: string;
  turnTimer: number;
  gameWon: boolean;
  gameLost: boolean;
  isLearningMode: boolean;
  isHotseatMode: boolean;
  tooltipVisible: boolean;
  tooltipCard: GameCard | null;
  playerSwitchOverlayVisible: boolean;
  remainingCards: number;
  gameDifficulty: 'easy' | 'medium' | 'hard';
  player1Data: { name: string; avatar: string } | null;
  player2Data: { name: string; avatar: string } | null;
  currentPlayerIndex: number;
  player1Hand: GameCard[];
  player2Hand: GameCard[];
}

/**
 * Callbacks for button bounds storage
 */
export interface GameRendererCallbacks {
  /** Store Weiter button bounds */
  onWeiterButtonBounds?: (bounds: { x: number; y: number; width: number; height: number } | null) => void;

  /** Store Clear Board button bounds */
  onClearBoardButtonBounds?: (bounds: { x: number; y: number; width: number; height: number } | null) => void;

  /** Store Reset Game button bounds */
  onResetGameButtonBounds?: (bounds: { x: number; y: number; width: number; height: number } | null) => void;

  /** Store Player Switch Overlay bounds */
  onPlayerSwitchOverlayBounds?: (bounds: { x: number; y: number; width: number; height: number } | null) => void;

  /** Get difficulty timer */
  onGetDifficultyTimer?: () => number;
}

/**
 * Game Renderer - Handles all canvas rendering and drawing
 */
export class GameRenderer {
  private callbacks: GameRendererCallbacks;

  constructor(callbacks: GameRendererCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /**
   * Main render method - orchestrates all drawing
   */
  public render(state: RenderState): void {
    const { ctx, canvas, backgroundImage } = state;
    const { width } = canvas;
    const { height } = canvas;

    // Validate canvas dimensions
    if (width <= 0 || height <= 0) {
      logger.warn({ scope: 'renderer/render', msg: 'invalid canvas dimensions', meta: { width, height } });
      return;
    }

    // Draw background
    if (backgroundImage && backgroundImage.complete) {
      ctx.drawImage(backgroundImage, 0, 0, width, height);
    } else {
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, 0, width, height);
    }

    // Draw hand position indicators (gray boxes) - BEFORE cards so cards are on top
    this.drawHandIndicators(ctx, state);

    // Draw board card (if exists)
    if (state.boardCard) {
      state.boardCard.render(ctx);
    }

    // Draw player hand cards
    if (state.isHotseatMode) {
      // Draw current player hand (bottom) - show card fronts
      if (state.currentPlayerIndex === 0) {
        for (const card of state.player1Hand) {
          if (card.isDragging) {
            state.draggingCard = card;
          } else {
            card.render(ctx);
          }
        }
        // Player 2 is next player - show player2Hand at top as card backs
        for (const card of state.player2Hand) {
          this.drawOpponentCardBack(ctx, card, state);
        }
      } else {
        // Player 2 is current player - show player2Hand at bottom
        for (const card of state.player2Hand) {
          if (card.isDragging) {
            state.draggingCard = card;
          } else {
            card.render(ctx);
          }
        }
        // Player 1 is next player - show player1Hand at top as card backs
        for (const card of state.player1Hand) {
          this.drawOpponentCardBack(ctx, card, state);
        }
      }
    } else {
      // Normal mode
      for (const card of state.playerHand) {
        if (card.isDragging) {
          state.draggingCard = card;
        } else {
          card.render(ctx);
        }
      }

      // Draw opponent hand cards (show card backs) - check for AI dragging
      for (const card of state.opponentHand) {
        if (card.isDragging) {
          state.draggingCard = card;
        } else {
          this.drawOpponentCardBack(ctx, card, state);
        }
      }
    }

    // Draw placed stacks
    for (const card of state.placedLeft) {
      if (card.isCorrect === false) {
        const pulseIntensity = 0.5 + 0.5 * Math.sin(Date.now() * 0.01);
        ctx.globalAlpha = pulseIntensity;
      }
      card.render(ctx);
      ctx.globalAlpha = 1;
    }
    for (const card of state.placedRight) {
      if (card.isCorrect === false) {
        const pulseIntensity = 0.5 + 0.5 * Math.sin(Date.now() * 0.01);
        ctx.globalAlpha = pulseIntensity;
      }
      card.render(ctx);
      ctx.globalAlpha = 1;
    }

    // Draw dragging card LAST so it appears on top of everything
    if (state.draggingCard) {
      state.draggingCard.render(ctx);
    }

    // Draw score and turn information
    this.drawScoreAndTurn(ctx, state);

    // Draw deck stack
    this.drawDeckStack(ctx, state);

    // Draw learning mode buttons (if needed)
    if (state.isLearningMode) {
      this.drawWeiterButton(ctx, state);
      this.drawLearningButtons(ctx, state);
    }

    // Draw graveyard cards
    for (const card of state.graveyard) {
      card.render(ctx);
    }

    // Draw win overlay if game is won (not in learning mode)
    if (state.gameWon && !state.isLearningMode) {
      this.drawWinOverlay(ctx, state);
    }

    // Draw navigation arrows if more than 5 cards on board
    this.drawNavigationArrows(ctx, state);

    // Learning mode: draw tooltips for placed cards
    if (state.isLearningMode && state.tooltipVisible && state.tooltipCard) {
      this.drawTooltip(ctx, state.tooltipCard, state);
    }

    // Hotseat mode: draw player switch overlay
    if (state.isHotseatMode && state.playerSwitchOverlayVisible) {
      this.drawPlayerSwitchOverlay(ctx, state);
    }
  }

  /**
   * Draw deck stack
   */
  private drawDeckStack(ctx: CanvasRenderingContext2D, state: RenderState): void {
    const deckX = 50 * state.scale;
    const deckY = state.canvas.height - 320 * state.scale;
    const cardWidth = 200 * state.scale;
    const cardHeight = 300 * state.scale;
    const stackHeight = Math.min(state.remainingCards, 5);

    // Draw stacked cards
    for (let i = 0; i < stackHeight; i++) {
      const offsetY = i * 2;

      ctx.fillStyle = '#4a90e2';
      ctx.globalAlpha = 0.8 - (i * 0.1);
      this.roundRect(ctx, deckX, deckY - offsetY, cardWidth, cardHeight, 8);
      ctx.fill();

      ctx.strokeStyle = '#2a5a8a';
      ctx.lineWidth = 2;
      ctx.stroke();

      this.drawLogo(ctx, deckX, deckY - offsetY, cardWidth, cardHeight, state);
    }

    ctx.globalAlpha = 1;

    // Draw deck count
    ctx.fillStyle = '#ffffff';
    ctx.font = `${16 * state.scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(`${state.remainingCards}`, deckX + cardWidth / 2, deckY + cardHeight + 25 * state.scale);
  }

  /**
   * Draw hand position indicators
   */
  private drawHandIndicators(ctx: CanvasRenderingContext2D, state: RenderState): void {
    const cardHeight = 300 * state.scale;
    const cardSpacing = 220 * state.scale;

    const opponentCardCount = getOpponentCardCount(state.gameDifficulty);

    // Draw player hand area (bottom)
    const playerTotalWidth = 5 * cardSpacing - 20 * state.scale;
    const playerStartX = (state.canvas.width - playerTotalWidth) / 2;
    const playerY = state.canvas.height - 320 * state.scale;

    ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.5)';
    ctx.lineWidth = 2;

    this.roundRect(
      ctx,
      playerStartX - 10 * state.scale,
      playerY - 10 * state.scale,
      playerTotalWidth + 20 * state.scale,
      cardHeight + 20 * state.scale,
      12,
    );
    ctx.fill();
    ctx.stroke();

    // Draw opponent hand area (top) - not in learning mode
    if (!state.isLearningMode) {
      const opponentTotalWidth = opponentCardCount * cardSpacing - 20 * state.scale;
      const opponentStartX = (state.canvas.width - opponentTotalWidth) / 2;
      const opponentY = 20 * state.scale;

      this.roundRect(
        ctx,
        opponentStartX - 10 * state.scale,
        opponentY - 10 * state.scale,
        opponentTotalWidth + 20 * state.scale,
        cardHeight + 20 * state.scale,
        12,
      );
      ctx.fill();
      ctx.stroke();

      // Draw avatar boxes
      const avatarBoxWidth = 100 * state.scale;
      const avatarBoxHeight = 100 * state.scale;

      if (state.isHotseatMode) {
        const player1Name = state.player1Data?.name || 'Player 1';
        const player2Name = state.player2Data?.name || 'Player 2';
        const player1Avatar = getAvatarEmoji(state.player1Data?.avatar);
        const player2Avatar = getAvatarEmoji(state.player2Data?.avatar);

        const currentPlayerName = state.currentPlayerIndex === 0 ? player1Name : player2Name;
        const currentPlayerAvatar = state.currentPlayerIndex === 0 ? player1Avatar : player2Avatar;
        const nextPlayerName = state.currentPlayerIndex === 0 ? player2Name : player1Name;
        const nextPlayerAvatar = state.currentPlayerIndex === 0 ? player2Avatar : player1Avatar;

        this.drawAvatarBox(ctx, state.canvas.width / 2 - avatarBoxWidth / 2, playerY - avatarBoxHeight - 20 * state.scale, currentPlayerAvatar, currentPlayerName, state);
        this.drawAvatarBox(ctx, state.canvas.width / 2 - avatarBoxWidth / 2, opponentY + cardHeight + 20 * state.scale, nextPlayerAvatar, nextPlayerName, state);
      } else if (state.player1Data?.name) {
        const playerName = state.player1Data.name;
        const playerAvatar = getAvatarEmoji(state.player1Data?.avatar);
        this.drawAvatarBox(ctx, state.canvas.width / 2 - avatarBoxWidth / 2, playerY - avatarBoxHeight - 20 * state.scale, playerAvatar, playerName, state);
        this.drawAvatarBox(ctx, state.canvas.width / 2 - avatarBoxWidth / 2, opponentY + cardHeight + 20 * state.scale, '🤖', 'Opponent', state);
      } else {
        this.drawAvatarBox(ctx, state.canvas.width / 2 - avatarBoxWidth / 2, playerY - avatarBoxHeight - 20 * state.scale, '👤', 'Player', state);
        this.drawAvatarBox(ctx, state.canvas.width / 2 - avatarBoxWidth / 2, opponentY + cardHeight + 20 * state.scale, '🤖', 'Opponent', state);
      }
    } else {
      // Learning mode: only draw player avatar box
      const avatarBoxWidth = 100 * state.scale;
      const avatarBoxHeight = 100 * state.scale;
      const playerName = state.player1Data?.name || 'Player';
      const playerAvatar = getAvatarEmoji(state.player1Data?.avatar);
      this.drawAvatarBox(ctx, state.canvas.width / 2 - avatarBoxWidth / 2, playerY - avatarBoxHeight - 20 * state.scale, playerAvatar, playerName, state);
    }

    // Draw graveyard area indicator
    const graveyardX = state.canvas.width - 230 * state.scale;
    const graveyardY = 50 * state.scale;
    const graveyardBoxWidth = 200 * state.scale;
    const graveyardBoxHeight = cardHeight;

    ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.5)';
    ctx.lineWidth = 2;

    this.roundRect(
      ctx,
      graveyardX - 10 * state.scale,
      graveyardY - 10 * state.scale,
      graveyardBoxWidth + 20 * state.scale,
      graveyardBoxHeight + 20 * state.scale,
      12,
    );
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `${14 * state.scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('Graveyard', graveyardX + graveyardBoxWidth / 2, graveyardY - 20 * state.scale);

    // Draw score/timer area indicator (only in normal mode)
    if (!state.isLearningMode && !state.isHotseatMode) {
      const scoreBoxX = 10 * state.scale;
      const scoreBoxY = 20 * state.scale;
      const scoreBoxWidth = 260 * state.scale;
      const scoreBoxHeight = 95 * state.scale;

      ctx.fillStyle = 'rgba(128, 128, 128, 0.9)';
      ctx.strokeStyle = 'rgba(128, 128, 128, 0.9)';
      ctx.lineWidth = 2;

      this.roundRect(ctx, scoreBoxX, scoreBoxY, scoreBoxWidth, scoreBoxHeight, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = `${12 * state.scale}px Arial`;
      ctx.textAlign = 'left';
      ctx.fillText('Game Info', scoreBoxX + 10 * state.scale, scoreBoxY - 5 * state.scale);
    }
  }

  /**
   * Draw learning mode buttons
   */
  private drawLearningButtons(ctx: CanvasRenderingContext2D, state: RenderState): void {
    const buttonWidth = 360 * state.scale;
    const buttonHeight = 120 * state.scale;
    const buttonSpacing = 80 * state.scale;
    const borderRadius = 24 * state.scale;

    const totalWidth = buttonWidth * 2 + buttonSpacing;
    const startX = (state.canvas.width - totalWidth) / 2;
    const buttonY = 20 * state.scale;

    // Clear Board Button
    const clearButtonX = startX;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 20 * state.scale;
    ctx.shadowOffsetX = 6 * state.scale;
    ctx.shadowOffsetY = 6 * state.scale;

    const clearGradient = ctx.createLinearGradient(clearButtonX, buttonY, clearButtonX, buttonY + buttonHeight);
    clearGradient.addColorStop(0, '#e53935');
    clearGradient.addColorStop(1, '#b71c1c');
    ctx.fillStyle = clearGradient;
    drawRoundedRect(ctx, clearButtonX, buttonY, buttonWidth, buttonHeight, borderRadius);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 4 * state.scale;
    this.roundRect(ctx, clearButtonX, buttonY, buttonWidth, buttonHeight, borderRadius);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${36 * state.scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🗑️ Clear Board', clearButtonX + buttonWidth / 2, buttonY + buttonHeight / 2);

    // Reset Game Button
    const resetButtonX = startX + buttonWidth + buttonSpacing;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 20 * state.scale;
    ctx.shadowOffsetX = 6 * state.scale;
    ctx.shadowOffsetY = 6 * state.scale;

    const resetGradient = ctx.createLinearGradient(resetButtonX, buttonY, resetButtonX, buttonY + buttonHeight);
    resetGradient.addColorStop(0, '#43a047');
    resetGradient.addColorStop(1, '#1b5e20');
    ctx.fillStyle = resetGradient;
    drawRoundedRect(ctx, resetButtonX, buttonY, buttonWidth, buttonHeight, borderRadius);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 4 * state.scale;
    this.roundRect(ctx, resetButtonX, buttonY, buttonWidth, buttonHeight, borderRadius);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${36 * state.scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔄 Reset Game', resetButtonX + buttonWidth / 2, buttonY + buttonHeight / 2);

    // Store button bounds
    this.callbacks.onClearBoardButtonBounds?.({
      x: clearButtonX, y: buttonY, width: buttonWidth, height: buttonHeight,
    });
    this.callbacks.onResetGameButtonBounds?.({
      x: resetButtonX, y: buttonY, width: buttonWidth, height: buttonHeight,
    });
  }

  /**
   * Draw Weiter button
   */
  private drawWeiterButton(ctx: CanvasRenderingContext2D, state: RenderState): void {
    const incorrectCard = state.placedLeft.find((card) => card.isCorrect === false)
                         || state.placedRight.find((card) => card.isCorrect === false)
                         || (state.boardCard && state.boardCard.isCorrect === false ? state.boardCard : null);

    if (!incorrectCard) {
      this.callbacks.onWeiterButtonBounds?.(null);
      return;
    }

    const buttonWidth = 300 * state.scale;
    const buttonHeight = 110 * state.scale;
    const borderRadius = 24 * state.scale;

    const buttonX = (state.canvas.width - buttonWidth) / 2;
    const buttonY = state.canvas.height / 2 + 180 * state.scale;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 20 * state.scale;
    ctx.shadowOffsetX = 6 * state.scale;
    ctx.shadowOffsetY = 6 * state.scale;

    const weiterGradient = ctx.createLinearGradient(buttonX, buttonY, buttonX, buttonY + buttonHeight);
    weiterGradient.addColorStop(0, '#ffa726');
    weiterGradient.addColorStop(1, '#e65100');
    ctx.fillStyle = weiterGradient;
    drawRoundedRect(ctx, buttonX, buttonY, buttonWidth, buttonHeight, borderRadius);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 4 * state.scale;
    this.roundRect(ctx, buttonX, buttonY, buttonWidth, buttonHeight, borderRadius);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${40 * state.scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('➡️ Continue', buttonX + buttonWidth / 2, buttonY + buttonHeight / 2);

    this.callbacks.onWeiterButtonBounds?.({
      x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight,
    });
  }

  /**
   * Draw tooltip
   */
  private drawTooltip(ctx: CanvasRenderingContext2D, card: GameCard, state: RenderState): void {
    if (!card.card.facts || card.card.facts.length === 0) return;

    const tooltipText = card.card.facts[0];
    const tooltipWidth = 300 * state.scale;
    const tooltipHeight = 80 * state.scale;
    const tooltipPadding = 10 * state.scale;

    const tooltipX = card.x + card.width / 2 - tooltipWidth / 2;
    const tooltipY = card.y - tooltipHeight - 20 * state.scale;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 2 * state.scale;

    drawRoundedRect(ctx, tooltipX, tooltipY, tooltipWidth, tooltipHeight, 8 * state.scale);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `${14 * state.scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const maxWidth = tooltipWidth - tooltipPadding * 2;
    const lines = wrapText(tooltipText, maxWidth, ctx);

    const lineHeight = 18 * state.scale;
    const startY = tooltipY + tooltipHeight / 2 - (lines.length - 1) * lineHeight / 2;

    lines.forEach((line, index) => {
      const y = startY + index * lineHeight;
      ctx.fillText(line, tooltipX + tooltipWidth / 2, y);
    });
  }

  /**
   * Draw navigation arrows
   */
  private drawNavigationArrows(ctx: CanvasRenderingContext2D, state: RenderState): void {
    const totalBoardCards = (state.boardCard ? 1 : 0) + state.placedLeft.length + state.placedRight.length;

    if (totalBoardCards <= 5) return;

    const arrowWidth = 120 * state.scale;
    const arrowHeight = 120 * state.scale;
    const arrowY = state.canvas.height / 2 - arrowHeight / 2;

    const leftArrowX = 20 * state.scale;
    const rightArrowX = state.canvas.width - arrowWidth - 20 * state.scale;

    // Draw left arrow
    if (state.arrowLeftImage) {
      ctx.globalAlpha = 0.8;
      ctx.drawImage(state.arrowLeftImage, leftArrowX, arrowY, arrowWidth, arrowHeight);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.moveTo(leftArrowX + arrowWidth, arrowY);
      ctx.lineTo(leftArrowX, arrowY + arrowHeight / 2);
      ctx.lineTo(leftArrowX + arrowWidth, arrowY + arrowHeight);
      ctx.closePath();
      ctx.fill();
    }

    // Draw right arrow
    if (state.arrowRightImage) {
      ctx.globalAlpha = 0.8;
      ctx.drawImage(state.arrowRightImage, rightArrowX, arrowY, arrowWidth, arrowHeight);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.moveTo(rightArrowX, arrowY);
      ctx.lineTo(rightArrowX + arrowWidth, arrowY + arrowHeight / 2);
      ctx.lineTo(rightArrowX, arrowY + arrowHeight);
      ctx.closePath();
      ctx.fill();
    }
  }

  /**
   * Draw Axes Mundi Logo
   */
  private drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, state: RenderState): void {
    if (!state.logoImage) {
      this.drawAxesMundiLogo(ctx, x, y, width, height);
      return;
    }

    ctx.save();
    ctx.globalAlpha = 1.0;

    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, x, y, width, height, 6);
    ctx.fill();

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, x, y, width, height, 6);
    ctx.stroke();

    const logoSize = Math.min(width, height) * 0.8;
    const logoX = x + (width - logoSize) / 2;
    const logoY = y + (height - logoSize) / 2;

    ctx.drawImage(state.logoImage, logoX, logoY, logoSize, logoSize);

    ctx.restore();
  }

  /**
   * Draw Axes Mundi Logo (fallback drawn version)
   */
  private drawAxesMundiLogo(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
    const logoColor = '#D4AF37';
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    ctx.save();
    ctx.globalAlpha = 1.0;

    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, x, y, width, height, 6);
    ctx.fill();

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, x, y, width, height, 6);
    ctx.stroke();

    const logoSize = Math.min(width, height) * 0.9;
    const symbolSize = logoSize * 0.7;
    const textSize = logoSize * 0.3;

    const symbolX = centerX;
    const symbolY = centerY - textSize * 0.4;

    ctx.strokeStyle = logoColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(symbolX, symbolY, symbolSize * 0.4, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.fillStyle = logoColor;
    ctx.beginPath();
    ctx.arc(symbolX, symbolY, symbolSize * 0.08, 0, 2 * Math.PI);
    ctx.fill();

    ctx.lineWidth = 4;
    ctx.strokeStyle = logoColor;
    ctx.beginPath();
    ctx.moveTo(symbolX, symbolY - symbolSize * 0.5);
    ctx.lineTo(symbolX, symbolY + symbolSize * 0.5);
    ctx.moveTo(symbolX - symbolSize * 0.5, symbolY);
    ctx.lineTo(symbolX + symbolSize * 0.5, symbolY);
    ctx.stroke();

    const arrowSize = symbolSize * 0.15;
    ctx.beginPath();
    ctx.moveTo(symbolX, symbolY - symbolSize * 0.5);
    ctx.lineTo(symbolX - arrowSize, symbolY - symbolSize * 0.5 + arrowSize);
    ctx.lineTo(symbolX + arrowSize, symbolY - symbolSize * 0.5 + arrowSize);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(symbolX, symbolY + symbolSize * 0.5);
    ctx.lineTo(symbolX - arrowSize, symbolY + symbolSize * 0.5 - arrowSize);
    ctx.lineTo(symbolX + arrowSize, symbolY + symbolSize * 0.5 - arrowSize);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(symbolX - symbolSize * 0.5, symbolY);
    ctx.lineTo(symbolX - symbolSize * 0.5 + arrowSize, symbolY - arrowSize);
    ctx.lineTo(symbolX - symbolSize * 0.5 + arrowSize, symbolY + arrowSize);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(symbolX + symbolSize * 0.5, symbolY);
    ctx.lineTo(symbolX + symbolSize * 0.5 - arrowSize, symbolY - arrowSize);
    ctx.lineTo(symbolX + symbolSize * 0.5 - arrowSize, symbolY + arrowSize);
    ctx.closePath();
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(symbolX, symbolY, symbolSize * 0.3, 0, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(symbolX, symbolY, symbolSize * 0.2, 0, Math.PI);
    ctx.stroke();

    ctx.fillStyle = logoColor;
    ctx.font = `bold ${textSize * 0.4}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText('AXES', centerX, centerY + textSize * 0.3);
    ctx.fillText('MUNDI', centerX, centerY + textSize * 0.7);

    ctx.restore();
  }

  /**
   * Draw opponent card back
   */
  private drawOpponentCardBack(ctx: CanvasRenderingContext2D, card: GameCard, state: RenderState): void {
    ctx.save();
    this.drawLogo(ctx, card.x, card.y, card.width, card.height, state);
    ctx.restore();
  }

  /**
   * Draw avatar box
   */
  private drawAvatarBox(ctx: CanvasRenderingContext2D, x: number, y: number, avatar: string, name: string, state: RenderState): void {
    const boxWidth = 100 * state.scale;
    const boxHeight = 100 * state.scale;
    const borderRadius = 8 * state.scale;

    ctx.fillStyle = 'rgba(128, 128, 128, 0.9)';
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.9)';
    ctx.lineWidth = 2;

    this.roundRect(ctx, x, y, boxWidth, boxHeight, borderRadius);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.font = `${48 * state.scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(avatar, x + boxWidth / 2, y + boxHeight / 2 - 12 * state.scale);

    ctx.font = `bold ${13 * state.scale}px Arial`;
    ctx.textBaseline = 'top';
    ctx.fillText(name, x + boxWidth / 2, y + boxHeight / 2 + 18 * state.scale);

    ctx.textBaseline = 'alphabetic';
  }

  /**
   * Draw player switch overlay
   */
  private drawPlayerSwitchOverlay(ctx: CanvasRenderingContext2D, state: RenderState): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);

    const overlayWidth = 400 * state.scale;
    const overlayHeight = 200 * state.scale;
    const overlayX = (state.canvas.width - overlayWidth) / 2;
    const overlayY = (state.canvas.height - overlayHeight) / 2;

    this.callbacks.onPlayerSwitchOverlayBounds?.({
      x: overlayX,
      y: overlayY,
      width: overlayWidth,
      height: overlayHeight,
    });

    ctx.fillStyle = '#2c3e50';
    drawRoundedRect(ctx, overlayX, overlayY, overlayWidth, overlayHeight, 10 * state.scale);
    ctx.fill();

    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 3 * state.scale;
    ctx.strokeRect(overlayX, overlayY, overlayWidth, overlayHeight);

    const nextPlayerIndex = state.currentPlayerIndex === 0 ? 1 : 0;
    const nextPlayer = nextPlayerIndex === 0 ? state.player1Data : state.player2Data;

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${24 * state.scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `Now it's ${nextPlayer?.name || 'Player'}'s turn!`,
      overlayX + overlayWidth / 2,
      overlayY + overlayHeight / 2 - 30 * state.scale,
    );

    ctx.font = `${18 * state.scale}px Arial`;
    ctx.fillStyle = '#bdc3c7';
    ctx.fillText(
      'Klicke um fortzufahren',
      overlayX + overlayWidth / 2,
      overlayY + overlayHeight / 2 + 20 * state.scale,
    );
  }

  /**
   * Draw score and turn information
   */
  private drawScoreAndTurn(ctx: CanvasRenderingContext2D, state: RenderState): void {
    if (state.isHotseatMode) {
      const currentPlayer = state.currentPlayerIndex === 0 ? state.player1Data : state.player2Data;
      const turnText = `🎮 ${currentPlayer?.name || 'Player'}'s turn`;
      const fontSize = 28 * state.scale;
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.textAlign = 'left';

      const textMetrics = ctx.measureText(turnText);
      const textWidth = textMetrics.width;
      const padding = 14 * state.scale;
      const boxX = 12 * state.scale;
      const boxY = 12 * state.scale;
      const boxHeight = fontSize + padding * 1.4;

      ctx.fillStyle = 'rgba(180, 180, 180, 0.9)';
      ctx.beginPath();
      const radius = 10 * state.scale;
      this.roundRect(ctx, boxX, boxY, textWidth + padding * 2, boxHeight, radius);
      ctx.fill();

      ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
      ctx.lineWidth = 2 * state.scale;
      ctx.stroke();

      ctx.fillStyle = '#1a1a1a';
      ctx.fillText(turnText, boxX + padding, boxY + fontSize + padding * 0.2);
    } else if (!state.isLearningMode) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `${18 * state.scale}px Arial`;
      ctx.textAlign = 'left';
      ctx.fillText(`Score: ${state.score}`, 20 * state.scale, 40 * state.scale);
      ctx.fillText(`Turn: ${state.currentTurn}`, 20 * state.scale, 65 * state.scale);
    } else {
      const learningText = '📚 Learning Mode';
      const fontSize = 18 * state.scale;
      const padding = 10 * state.scale;
      const boxX = 15 * state.scale;
      const boxY = 20 * state.scale;

      ctx.font = `bold ${fontSize}px Arial`;
      const textWidth = ctx.measureText(learningText).width;
      const boxWidth = textWidth + padding * 2;
      const boxHeight = fontSize + padding * 1.5;

      ctx.fillStyle = 'rgba(80, 80, 80, 0.85)';
      ctx.beginPath();
      const radius = 6 * state.scale;
      this.roundRect(ctx, boxX, boxY, boxWidth, boxHeight, radius);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(learningText, boxX + padding, boxY + fontSize + padding * 0.2);
    }

    // Draw turn text (only in normal mode, not hotseat)
    if (state.turnText && !state.isLearningMode && !state.isHotseatMode) {
      ctx.fillStyle = state.turnText.includes('Your turn') ? '#7bed9f' : '#ff9800';
      ctx.font = `bold ${15 * state.scale}px Arial`;
      ctx.textAlign = 'left';
      ctx.fillText(state.turnText, 20 * state.scale, 90 * state.scale);
    }

    // Draw timer bar (only in normal mode)
    if (!state.isLearningMode && !state.isHotseatMode && state.turnTimer > 0) {
      const timerBarWidth = 200 * state.scale;
      const timerBarHeight = 8 * state.scale;
      const timerBarX = 20 * state.scale;
      const timerBarY = 100 * state.scale;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(timerBarX, timerBarY, timerBarWidth, timerBarHeight);

      const difficultyTimer = this.callbacks.onGetDifficultyTimer?.() || 10;
      const progress = state.turnTimer / difficultyTimer;
      const progressWidth = timerBarWidth * progress;

      let timerColor = '#7bed9f';
      if (state.turnTimer <= 3) {
        timerColor = '#ff4444';
      } else if (state.turnTimer <= 5) {
        timerColor = '#ff9800';
      }

      ctx.fillStyle = timerColor;
      ctx.fillRect(timerBarX, timerBarY, progressWidth, timerBarHeight);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(timerBarX, timerBarY, timerBarWidth, timerBarHeight);
    }
  }

  /**
   * Draw win overlay
   */
  private drawWinOverlay(ctx: CanvasRenderingContext2D, state: RenderState): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);

    ctx.fillStyle = '#4caf50';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🎉 Congratulations! 🎉', state.canvas.width / 2, state.canvas.height / 2 - 50);

    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Arial';
    ctx.fillText('You have successfully sorted all cards!', state.canvas.width / 2, state.canvas.height / 2);

    ctx.font = '20px Arial';
    ctx.fillText(`Final Score: ${state.score}`, state.canvas.width / 2, state.canvas.height / 2 + 40);

    ctx.font = '18px Arial';
    ctx.fillStyle = '#cccccc';
    ctx.fillText('Check the dialog for next steps...', state.canvas.width / 2, state.canvas.height / 2 + 80);
  }

  /**
   * Draw rounded rectangle helper
   */
  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
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
  }
}
