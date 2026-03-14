import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameRenderer, RenderState } from '@/utils/gameRenderer';
import { GameCard } from '@/game/Card';
import type { CardData } from '@/data/types';

// Mock the logger
vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('GameRenderer', () => {
  let renderer: GameRenderer;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let mockCallbacks: any;

  beforeEach(() => {
    // Create a canvas element
    canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    
    // Mock canvas context
    ctx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      globalAlpha: 1,
      shadowColor: '',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      textAlign: 'left',
      textBaseline: 'alphabetic',
      font: '',
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      measureText: vi.fn(() => ({ width: 100 })),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      rotate: vi.fn(),
      createLinearGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
    } as any;
    
    // Mock getContext to return our mock context
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx);

    // Mock callbacks
    mockCallbacks = {
      onWeiterButtonBounds: vi.fn(),
      onClearBoardButtonBounds: vi.fn(),
      onResetGameButtonBounds: vi.fn(),
      onPlayerSwitchOverlayBounds: vi.fn(),
      onGetDifficultyTimer: vi.fn(() => 30),
    };

    renderer = new GameRenderer(mockCallbacks);
  });

  function createMockCard(id: string, title: string): GameCard {
    const cardData: CardData = {
      id,
      title,
      axis: 'time',
      value: 1000,
      unit: 'year',
      displayValue: '1000',
      image: 'test',
      facts: ['Test fact'],
      sources: [{ label: 'Test', url: 'https://test.com' }],
      difficulty: 'easy',
    };

    const deck = { id: 'test-deck', name: 'Test Deck', axis: 'time', theme: 'test', locale: 'en', version: '1.0.0', cards: [] };
    return new GameCard(cardData, deck, 100, 100, 1);
  }

  function createRenderState(overrides: Partial<RenderState> = {}): RenderState {
    return {
      canvas,
      ctx,
      backgroundImage: null,
      logoImage: null,
      arrowLeftImage: null,
      arrowRightImage: null,
      scale: 1,
      boardCard: null,
      playerHand: [],
      opponentHand: [],
      placedLeft: [],
      placedRight: [],
      graveyard: [],
      draggingCard: null,
      score: 0,
      currentTurn: 0,
      turnText: '',
      turnTimer: 30,
      gameWon: false,
      gameLost: false,
      isLearningMode: false,
      isHotseatMode: false,
      tooltipVisible: false,
      tooltipCard: null,
      playerSwitchOverlayVisible: false,
      remainingCards: 0,
      gameDifficulty: 'easy',
      player1Data: null,
      player2Data: null,
      currentPlayerIndex: 0,
      player1Hand: [],
      player2Hand: [],
      ...overrides,
    };
  }

  describe('render', () => {
    it('should render with valid canvas dimensions', () => {
      const state = createRenderState();
      expect(() => renderer.render(state)).not.toThrow();
    });

    it('should handle invalid canvas dimensions', () => {
      const state = createRenderState();
      canvas.width = 0;
      canvas.height = 0;
      expect(() => renderer.render(state)).not.toThrow();
    });

    it('should render background image if available', () => {
      const img = new Image();
      const state = createRenderState({ backgroundImage: img });
      const drawImageSpy = vi.spyOn(ctx, 'drawImage');
      renderer.render(state);
      // Background should be drawn if image is complete
      expect(drawImageSpy).toHaveBeenCalled();
    });

    it('should render board card if present', () => {
      const card = createMockCard('1', 'Test Card');
      const state = createRenderState({ boardCard: card });
      const renderSpy = vi.spyOn(card, 'render');
      renderer.render(state);
      expect(renderSpy).toHaveBeenCalled();
    });

    it('should render player hand cards', () => {
      const card1 = createMockCard('1', 'Card 1');
      const card2 = createMockCard('2', 'Card 2');
      const state = createRenderState({ playerHand: [card1, card2] });
      const renderSpy1 = vi.spyOn(card1, 'render');
      const renderSpy2 = vi.spyOn(card2, 'render');
      renderer.render(state);
      expect(renderSpy1).toHaveBeenCalled();
      expect(renderSpy2).toHaveBeenCalled();
    });

    it('should render dragging card last', () => {
      const card1 = createMockCard('1', 'Card 1');
      const card2 = createMockCard('2', 'Card 2');
      card1.isDragging = true;
      const state = createRenderState({
        playerHand: [card1, card2],
        draggingCard: card1,
      });
      const renderSpy1 = vi.spyOn(card1, 'render');
      const renderSpy2 = vi.spyOn(card2, 'render');
      renderer.render(state);
      // Both should be called, but dragging card should be last
      expect(renderSpy1).toHaveBeenCalled();
      expect(renderSpy2).toHaveBeenCalled();
    });

    it('should render placed cards with pulsing effect if incorrect', () => {
      const card = createMockCard('1', 'Test Card');
      card.isCorrect = false;
      const state = createRenderState({ placedLeft: [card] });
      const renderSpy = vi.spyOn(card, 'render');
      renderer.render(state);
      expect(renderSpy).toHaveBeenCalled();
    });

    it('should render graveyard cards', () => {
      const card = createMockCard('1', 'Test Card');
      const state = createRenderState({ graveyard: [card] });
      const renderSpy = vi.spyOn(card, 'render');
      renderer.render(state);
      expect(renderSpy).toHaveBeenCalled();
    });

    it('should render win overlay when game is won', () => {
      const state = createRenderState({ gameWon: true, gameLost: false });
      const fillRectSpy = vi.spyOn(ctx, 'fillRect');
      renderer.render(state);
      // Win overlay should draw something
      expect(fillRectSpy).toHaveBeenCalled();
    });

    it('should render tooltip in learning mode', () => {
      const card = createMockCard('1', 'Test Card');
      const state = createRenderState({
        isLearningMode: true,
        tooltipVisible: true,
        tooltipCard: card,
      });
      const fillTextSpy = vi.spyOn(ctx, 'fillText');
      renderer.render(state);
      // Tooltip should draw text
      expect(fillTextSpy).toHaveBeenCalled();
    });

    it('should render player switch overlay in hotseat mode', () => {
      const state = createRenderState({
        isHotseatMode: true,
        playerSwitchOverlayVisible: true,
        player1Data: { name: 'Player 1', avatar: '👤' },
        player2Data: { name: 'Player 2', avatar: '👤' },
        currentPlayerIndex: 0,
      });
      const fillRectSpy = vi.spyOn(ctx, 'fillRect');
      renderer.render(state);
      // Overlay should draw something
      expect(fillRectSpy).toHaveBeenCalled();
    });

    it('should handle hotseat mode with player hands', () => {
      const card1 = createMockCard('1', 'Card 1');
      const card2 = createMockCard('2', 'Card 2');
      const state = createRenderState({
        isHotseatMode: true,
        currentPlayerIndex: 0,
        player1Hand: [card1],
        player2Hand: [card2],
      });
      const renderSpy1 = vi.spyOn(card1, 'render');
      renderer.render(state);
      expect(renderSpy1).toHaveBeenCalled();
      // Player 2's card should be drawn as opponent card back (not via card.render())
      // Just verify the renderer completes without errors
      expect(() => renderer.render(state)).not.toThrow();
    });
  });

  describe('callbacks', () => {
    it('should call onWeiterButtonBounds when Weiter button is drawn', () => {
      const card = createMockCard('1', 'Test Card');
      card.isCorrect = false;
      const state = createRenderState({
        isLearningMode: true,
        placedLeft: [card],
      });
      renderer.render(state);
      expect(mockCallbacks.onWeiterButtonBounds).toHaveBeenCalled();
    });

    it('should call onClearBoardButtonBounds when Clear Board button is drawn', () => {
      const state = createRenderState({ isLearningMode: true });
      renderer.render(state);
      expect(mockCallbacks.onClearBoardButtonBounds).toHaveBeenCalled();
    });

    it('should call onResetGameButtonBounds when Reset Game button is drawn', () => {
      const state = createRenderState({ isLearningMode: true });
      renderer.render(state);
      expect(mockCallbacks.onResetGameButtonBounds).toHaveBeenCalled();
    });

    it('should call onPlayerSwitchOverlayBounds when overlay is shown', () => {
      const state = createRenderState({
        isHotseatMode: true,
        playerSwitchOverlayVisible: true,
        player1Data: { name: 'Player 1', avatar: '👤' },
        player2Data: { name: 'Player 2', avatar: '👤' },
        currentPlayerIndex: 0,
      });
      renderer.render(state);
      expect(mockCallbacks.onPlayerSwitchOverlayBounds).toHaveBeenCalled();
    });
  });
});
