import {
  describe, it, expect, beforeEach, afterEach, vi,
} from 'vitest';
import { AIManager, AIManagerCallbacks } from '@/utils/aiManager';
import { GameCard } from '@/game/Card';
import { Card } from '@/data/types';
import { SoundType } from '@/utils/soundManager';

// Mock canvas
const createMockCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  return canvas;
};

// Mock card data
const createMockCardData = (id: string, value: number, unit: string = 'm'): Card => ({
  id,
  title: `Card ${id}`,
  axis: 'height',
  value,
  unit,
  displayValue: `${value} ${unit}`,
  image: `image_${id}`,
  facts: [],
  sources: [],
  difficulty: 'easy',
});

// Mock GameCard
const createMockGameCard = (cardData: Card, x: number = 0, y: number = 0): GameCard => {
  const card = new GameCard(
    cardData,
    {
      id: 'test-deck',
      name: 'Test Deck',
      axis: 'height',
      theme: 'test',
      locale: 'en',
      version: '1.0.0',
      imageFolder: 'test',
      cards: [],
      isUserDeck: false,
    },
    x,
    y,
    1,
  );
  return card;
};

describe('AIManager', () => {
  let canvas: HTMLCanvasElement;
  let callbacks: AIManagerCallbacks;
  let aiManager: AIManager;

  beforeEach(() => {
    vi.useFakeTimers();
    canvas = createMockCanvas();
    callbacks = {
      onGetDifficulty: () => 'medium',
      onGetBoardCards: vi.fn(() => ({
        boardCard: null,
        placedLeft: [],
        placedRight: [],
      })),
      onCardRemovedFromHand: vi.fn(),
      onLayoutOpponentHand: vi.fn(),
      onCardPlaced: vi.fn(),
      onLayoutAxisCards: vi.fn(),
      onCardSetCorrect: vi.fn(),
      onIncorrectPlacement: vi.fn(),
      onTurnComplete: vi.fn(),
      onCheckWin: vi.fn(),
      onStartTurnTimer: vi.fn(),
      onShowPreview: vi.fn(),
      onHidePreview: vi.fn(),
      onPlaySound: vi.fn(),
    };
    aiManager = new AIManager({
      canvas,
      scale: 1,
      isLearningMode: false,
      callbacks,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('playTurn', () => {
    it('should skip turn in learning mode', () => {
      aiManager.updateConfig({ isLearningMode: true });
      const hand = [createMockGameCard(createMockCardData('1', 10))];

      const result = aiManager.playTurn(hand, false);

      expect(result).toBe(false);
      expect(callbacks.onCardRemovedFromHand).not.toHaveBeenCalled();
    });

    it('should skip turn if already in progress', () => {
      const hand = [createMockGameCard(createMockCardData('1', 10))];

      const result = aiManager.playTurn(hand, true);

      expect(result).toBe(false);
      expect(callbacks.onCardRemovedFromHand).not.toHaveBeenCalled();
    });

    it('should skip turn if hand is empty', () => {
      const result = aiManager.playTurn([], false);

      expect(result).toBe(false);
      expect(callbacks.onCardRemovedFromHand).not.toHaveBeenCalled();
    });

    it('should start turn with valid hand', () => {
      const hand = [createMockGameCard(createMockCardData('1', 10))];
      // Mock card methods
      hand[0].startDrag = vi.fn();
      hand[0].updateDrag = vi.fn();
      hand[0].stopDrag = vi.fn();
      hand[0].width = 200;
      hand[0].height = 300;
      hand[0].x = 100;
      hand[0].y = 100;

      const result = aiManager.playTurn(hand, false);

      expect(result).toBe(true);
      expect(hand[0].startDrag).toHaveBeenCalled();
    });
  });

  describe('findCorrectPosition', () => {
    it('should calculate position for first card', () => {
      const card = createMockGameCard(createMockCardData('1', 10));
      card.width = 200;
      card.height = 300;

      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [],
        placedRight: [],
      }));

      // Access private method via reflection (for testing)
      // In a real scenario, we'd test this through playTurn
      // For now, we'll test the behavior through the public API
      const hand = [card];
      card.startDrag = vi.fn();
      card.updateDrag = vi.fn();
      card.stopDrag = vi.fn();
      card.x = 100;
      card.y = 100;

      const result = aiManager.playTurn(hand, false);
      expect(result).toBe(true);
    });

    it('should calculate position with existing cards', () => {
      const boardCard = createMockGameCard(createMockCardData('board', 50));
      boardCard.width = 200;
      boardCard.height = 300;

      const newCard = createMockGameCard(createMockCardData('new', 30));
      newCard.width = 200;
      newCard.height = 300;
      newCard.startDrag = vi.fn();
      newCard.updateDrag = vi.fn();
      newCard.stopDrag = vi.fn();
      newCard.x = 100;
      newCard.y = 100;

      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard,
        placedLeft: [],
        placedRight: [],
      }));

      const result = aiManager.playTurn([newCard], false);
      expect(result).toBe(true);
    });
  });

  describe('callbacks', () => {
    it('should call onCardRemovedFromHand when card is placed', () => {
      const hand = [createMockGameCard(createMockCardData('1', 10))];
      hand[0].startDrag = vi.fn();
      hand[0].updateDrag = vi.fn();
      hand[0].stopDrag = vi.fn();
      hand[0].width = 200;
      hand[0].height = 300;
      hand[0].x = 100;
      hand[0].y = 100;
      hand[0].isInHand = true;

      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [],
        placedRight: [],
      }));

      aiManager.playTurn(hand, false);

      // Wait for animation to complete (800ms + 400ms delay)
      vi.advanceTimersByTime(1500);

      expect(callbacks.onCardRemovedFromHand).toHaveBeenCalledWith(hand[0]);
      expect(callbacks.onCardPlaced).toHaveBeenCalled();
      expect(callbacks.onLayoutAxisCards).toHaveBeenCalled();
      expect(callbacks.onCardSetCorrect).toHaveBeenCalledWith(hand[0]);
      expect(callbacks.onTurnComplete).toHaveBeenCalled();
      expect(callbacks.onCheckWin).toHaveBeenCalled();
      expect(callbacks.onPlaySound).toHaveBeenCalledWith(SoundType.CARD_PLACE);
    }, 2000);

    it('should call onShowPreview during animation', () => {
      const hand = [createMockGameCard(createMockCardData('1', 10))];
      hand[0].startDrag = vi.fn();
      hand[0].updateDrag = vi.fn();
      hand[0].stopDrag = vi.fn();
      hand[0].width = 200;
      hand[0].height = 300;
      hand[0].x = 100;
      hand[0].y = 100;

      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [],
        placedRight: [],
      }));

      aiManager.playTurn(hand, false);

      // Preview should show after 30% of animation (240ms)
      vi.advanceTimersByTime(300);

      expect(callbacks.onShowPreview).toHaveBeenCalled();
    }, 500);

    it('should call onHidePreview after placement', () => {
      const hand = [createMockGameCard(createMockCardData('1', 10))];
      hand[0].startDrag = vi.fn();
      hand[0].updateDrag = vi.fn();
      hand[0].stopDrag = vi.fn();
      hand[0].width = 200;
      hand[0].height = 300;
      hand[0].x = 100;
      hand[0].y = 100;

      callbacks.onGetBoardCards = vi.fn(() => ({
        boardCard: null,
        placedLeft: [],
        placedRight: [],
      }));

      aiManager.playTurn(hand, false);

      // Hide preview should be called after placement delay (400ms)
      vi.advanceTimersByTime(1300);

      expect(callbacks.onHidePreview).toHaveBeenCalled();
    }, 2000);
  });

  describe('difficulty and incorrect placements', () => {
    it.each([
      ['easy', 0.199, 0.20],
      ['medium', 0.099, 0.10],
      ['hard', 0.049, 0.05],
    ] as const)('uses the %s error threshold per turn', (difficulty, below, threshold) => {
      callbacks.onGetDifficulty = () => difficulty;
      const boardCard = createMockGameCard(createMockCardData('board', 50));
      callbacks.onGetBoardCards = () => ({ boardCard, placedLeft: [], placedRight: [] });
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(below)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(threshold);
      const incorrectCard = createMockGameCard(createMockCardData('low', 30));
      const correctCard = createMockGameCard(createMockCardData('lower', 20));

      aiManager.playTurn([incorrectCard], false);
      vi.advanceTimersByTime(1200);
      expect(incorrectCard.isCorrect).toBe(false);
      expect(callbacks.onCardPlaced).toHaveBeenCalledWith(incorrectCard, false);
      expect(callbacks.onPlaySound).toHaveBeenCalledWith(SoundType.ERROR);
      expect(callbacks.onTurnComplete).not.toHaveBeenCalled();
      vi.advanceTimersByTime(2000);
      expect(callbacks.onIncorrectPlacement).toHaveBeenCalledWith(incorrectCard);
      expect(callbacks.onCheckWin).not.toHaveBeenCalled();
      expect(callbacks.onTurnComplete).toHaveBeenCalledOnce();

      aiManager.playTurn([correctCard], false);
      vi.advanceTimersByTime(1200);
      expect(callbacks.onCardPlaced).toHaveBeenCalledWith(correctCard, true);
      expect(callbacks.onCardSetCorrect).toHaveBeenCalledWith(correctCard);
      expect(callbacks.onIncorrectPlacement).toHaveBeenCalledOnce();
      expect(callbacks.onCheckWin).toHaveBeenCalledOnce();
    });

    it('skips equal gaps when choosing a wrong position', () => {
      const boardCard = createMockGameCard(createMockCardData('board', 1, 'km'));
      const smallerCard = createMockGameCard(createMockCardData('small', 200));
      const equalCard = createMockGameCard(createMockCardData('equal', 1000));
      callbacks.onGetBoardCards = () => ({ boardCard, placedLeft: [smallerCard], placedRight: [] });
      vi.spyOn(Math, 'random').mockReturnValue(0);

      aiManager.playTurn([equalCard], false);
      vi.advanceTimersByTime(1200);
      expect(equalCard.x + equalCard.width).toBeLessThan(canvas.width / 2 - equalCard.width / 2);
      expect(equalCard.isCorrect).toBe(false);
    });

    it('plays correctly when every gap is valid', () => {
      const boardCard = createMockGameCard(createMockCardData('board', 1, 'km'));
      const equalCard = createMockGameCard(createMockCardData('equal', 1000));
      callbacks.onGetBoardCards = () => ({ boardCard, placedLeft: [], placedRight: [] });
      vi.spyOn(Math, 'random').mockReturnValue(0);

      aiManager.playTurn([equalCard], false);
      vi.advanceTimersByTime(3200);
      expect(callbacks.onCardSetCorrect).toHaveBeenCalledWith(equalCard);
      expect(callbacks.onIncorrectPlacement).not.toHaveBeenCalled();
    });

    it('cancels pending discard and turn changes when restarting during feedback', () => {
      const boardCard = createMockGameCard(createMockCardData('board', 50));
      const card = createMockGameCard(createMockCardData('low', 30));
      callbacks.onGetBoardCards = () => ({ boardCard, placedLeft: [], placedRight: [] });
      vi.spyOn(Math, 'random').mockReturnValue(0);

      aiManager.playTurn([card], false);
      vi.advanceTimersByTime(1200);
      expect(card.isCorrect).toBe(false);
      aiManager.cancelTurn();
      vi.runAllTimers();
      expect(callbacks.onIncorrectPlacement).not.toHaveBeenCalled();
      expect(callbacks.onTurnComplete).not.toHaveBeenCalled();
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const newCanvas = createMockCanvas();
      newCanvas.width = 800;
      newCanvas.height = 600;

      aiManager.updateConfig({
        scale: 2,
        canvas: newCanvas,
        isLearningMode: true,
      });

      // Config should be updated (tested by behavior)
      const hand = [createMockGameCard(createMockCardData('1', 10))];
      const result = aiManager.playTurn(hand, false);
      expect(result).toBe(false); // Should skip in learning mode
    });
  });
});
