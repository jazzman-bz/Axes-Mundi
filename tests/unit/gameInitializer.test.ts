import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { GameInitializer, GameInitializerCallbacks } from '@/utils/gameInitializer';
import { GameCard } from '@/game/Card';
import { Card as CardData } from '@/data/types';
import { ExtendedDeck } from '@/data/deckLoader';

// Mock the logger
vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock assetLoader
vi.mock('@/utils/assetLoader', () => ({
  loadImage: vi.fn(),
}));

// Mock deckLoader
vi.mock('@/data/deckLoader', () => ({
  loadDeck: vi.fn(),
  shuffleCardsInPlace: vi.fn(),
}));

// Mock scaleUtils
vi.mock('@/utils/scaleUtils', () => ({
  calculateScale: vi.fn(() => 1),
  calculateSnapThreshold: vi.fn(() => 80),
}));

/**
 * Helper to create test cards
 */
function createTestCard(id: string, title: string): CardData {
  return {
    id,
    title,
    axis: 'height',
    value: 100,
    unit: 'm',
    displayValue: '100 m',
    image: 'test.jpg',
    facts: ['Test fact'],
    sources: [{ label: 'Test', url: 'https://test.com' }],
    difficulty: 'medium',
  };
}

/**
 * Helper to create mock deck
 */
function createMockDeck(): ExtendedDeck {
  return {
    id: 'test-deck',
    name: 'Test Deck',
    axis: 'height',
    theme: 'test',
    locale: 'en',
    version: '1.0.0',
    imageFolder: 'test',
    cards: [
      createTestCard('1', 'Card 1'),
      createTestCard('2', 'Card 2'),
      createTestCard('3', 'Card 3'),
    ],
    isUserDeck: false,
  };
}

/**
 * Helper to create mock canvas
 */
function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  return canvas;
}

/**
 * Helper to create mock callbacks
 */
function createMockCallbacks(): GameInitializerCallbacks {
  let remainingCards: CardData[] = [];

  return {
    onGetGameState: vi.fn(() => ({
      isLearningMode: false,
      isHotseatMode: false,
      currentPlayerIndex: 0,
      gameDifficulty: 'medium' as const,
    })),
    onGetRemainingCards: vi.fn(() => remainingCards),
    onGetHands: vi.fn(() => ({
      player1Hand: [],
      player2Hand: [],
    })),
    onSetDeck: vi.fn(),
    onSetRemainingCards: vi.fn((cards: CardData[]) => {
      remainingCards = cards;
    }),
    onSetBoardCard: vi.fn(),
    onSetScale: vi.fn(),
    onSetSnapThreshold: vi.fn(),
    onSetLogoImage: vi.fn(),
    onSetArrowLeftImage: vi.fn(),
    onSetArrowRightImage: vi.fn(),
    onSetBackgroundImage: vi.fn(),
    onSetCurrentPlayerHand: vi.fn(),
    onSetNextPlayerHand: vi.fn(),
    onUpdateGameStateManager: vi.fn(),
    onInitializeCardDealerManager: vi.fn(),
    onAnimateFirstCardToCenter: vi.fn(),
    onStartDealingCards: vi.fn(),
  };
}

describe('GameInitializer', () => {
  let initializer: GameInitializer;
  let callbacks: GameInitializerCallbacks;
  let canvas: HTMLCanvasElement;
  let mockLocalStorage: Storage;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup window dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1920,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 1080,
    });

    mockLocalStorage = {
      getItem: vi.fn(() => 'test-deck'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(() => null),
      length: 0,
    } as unknown as Storage;

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: mockLocalStorage,
    });

    callbacks = createMockCallbacks();
    canvas = createMockCanvas();

    initializer = new GameInitializer({
      canvas,
      callbacks,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initCanvas', () => {
    it('should set canvas width to window.innerWidth', () => {
      initializer.initCanvas();

      expect(canvas.width).toBe(1920);
    });

    it('should set canvas height to window.innerHeight', () => {
      initializer.initCanvas();

      expect(canvas.height).toBe(1080);
    });

    it('should handle errors gracefully', () => {
      // Create a canvas that throws on property access
      const badCanvas = {
        get width() {
          throw new Error('Test error');
        },
        set width(_val: number) {
          throw new Error('Test error');
        },
        get height() {
          return 0;
        },
        set height(_val: number) {
          // no-op
        },
      } as unknown as HTMLCanvasElement;

      const badInitializer = new GameInitializer({
        canvas: badCanvas,
        callbacks,
      });

      expect(() => {
        badInitializer.initCanvas();
      }).toThrow();
    });
  });

  describe('setupEventListeners', () => {
    it('should attach resize handler if provided', () => {
      const resizeHandler = {
        attach: vi.fn(),
      };

      initializer.setupEventListeners(resizeHandler, null);

      expect(resizeHandler.attach).toHaveBeenCalled();
    });

    it('should attach input handler if provided', () => {
      const inputHandler = {
        attach: vi.fn(),
      };

      initializer.setupEventListeners(null, inputHandler);

      expect(inputHandler.attach).toHaveBeenCalled();
    });

    it('should attach both handlers if both provided', () => {
      const resizeHandler = {
        attach: vi.fn(),
      };
      const inputHandler = {
        attach: vi.fn(),
      };

      initializer.setupEventListeners(resizeHandler, inputHandler);

      expect(resizeHandler.attach).toHaveBeenCalled();
      expect(inputHandler.attach).toHaveBeenCalled();
    });

    it('should handle null handlers gracefully', () => {
      expect(() => {
        initializer.setupEventListeners(null, null);
      }).not.toThrow();
    });
  });

  describe('loadLogo', () => {
    it('should load logo image successfully', async () => {
      const { loadImage } = await import('@/utils/assetLoader');
      const mockImage = document.createElement('img');
      vi.mocked(loadImage).mockResolvedValue({
        image: mockImage,
        width: 100,
        height: 100,
      });

      await initializer.loadLogo();

      expect(loadImage).toHaveBeenCalledWith('./assets/axes-mundi logo.png', {
        scope: 'renderer/initializer',
      });
      expect(callbacks.onSetLogoImage).toHaveBeenCalledWith(mockImage);
    });

    it('should handle load failure gracefully', async () => {
      const { loadImage } = await import('@/utils/assetLoader');
      vi.mocked(loadImage).mockRejectedValue(new Error('Load failed'));

      await initializer.loadLogo();

      expect(callbacks.onSetLogoImage).toHaveBeenCalledWith(null);
    });

    it('should handle null asset result', async () => {
      const { loadImage } = await import('@/utils/assetLoader');
      vi.mocked(loadImage).mockResolvedValue(null);

      await initializer.loadLogo();

      expect(callbacks.onSetLogoImage).toHaveBeenCalledWith(null);
    });
  });

  describe('loadArrowImages', () => {
    it('should load both arrow images in parallel', async () => {
      const { loadImage } = await import('@/utils/assetLoader');
      const leftImage = document.createElement('img');
      const rightImage = document.createElement('img');

      vi.mocked(loadImage)
        .mockResolvedValueOnce({
          image: leftImage,
          width: 50,
          height: 50,
        })
        .mockResolvedValueOnce({
          image: rightImage,
          width: 50,
          height: 50,
        });

      await initializer.loadArrowImages();

      expect(loadImage).toHaveBeenCalledTimes(2);
      expect(loadImage).toHaveBeenCalledWith('./assets/arrow left.png', {
        convertToWhite: true,
        scope: 'renderer/initializer',
      });
      expect(loadImage).toHaveBeenCalledWith('./assets/arrow right.png', {
        convertToWhite: true,
        scope: 'renderer/initializer',
      });
      expect(callbacks.onSetArrowLeftImage).toHaveBeenCalledWith(leftImage);
      expect(callbacks.onSetArrowRightImage).toHaveBeenCalledWith(rightImage);
    });

    it('should handle load failure gracefully', async () => {
      const { loadImage } = await import('@/utils/assetLoader');
      vi.mocked(loadImage).mockRejectedValue(new Error('Load failed'));

      await initializer.loadArrowImages();

      expect(callbacks.onSetArrowLeftImage).toHaveBeenCalledWith(null);
      expect(callbacks.onSetArrowRightImage).toHaveBeenCalledWith(null);
    });
  });

  describe('loadBackgroundImage', () => {
    it('should load background image successfully', async () => {
      const { loadImage } = await import('@/utils/assetLoader');
      const mockImage = document.createElement('img');
      vi.mocked(loadImage).mockResolvedValue({
        image: mockImage,
        width: 1920,
        height: 1080,
      });

      await initializer.loadBackgroundImage();

      expect(loadImage).toHaveBeenCalledWith('./assets/background.jpg', {
        scope: 'renderer/initializer',
      });
      expect(callbacks.onSetBackgroundImage).toHaveBeenCalledWith(mockImage);
    });

    it('should handle load failure gracefully', async () => {
      const { loadImage } = await import('@/utils/assetLoader');
      vi.mocked(loadImage).mockRejectedValue(new Error('Load failed'));

      await initializer.loadBackgroundImage();

      expect(callbacks.onSetBackgroundImage).toHaveBeenCalledWith(null);
    });
  });

  describe('loadAssets', () => {
    it('should load all assets in parallel', async () => {
      const { loadImage } = await import('@/utils/assetLoader');
      vi.mocked(loadImage).mockResolvedValue({
        image: document.createElement('img'),
        width: 100,
        height: 100,
      });

      initializer.loadAssets();

      // Wait for promises to resolve
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(loadImage).toHaveBeenCalledTimes(4); // logo (1) + arrows (2) + background (1)
    });

    it('should handle errors without throwing', async () => {
      const { loadImage } = await import('@/utils/assetLoader');
      vi.mocked(loadImage).mockRejectedValue(new Error('Load failed'));

      expect(() => {
        initializer.loadAssets();
      }).not.toThrow();

      // Wait for promises to resolve
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  });

  describe('loadGame', () => {
    it('should load deck from localStorage', async () => {
      const { loadDeck } = await import('@/data/deckLoader');
      const mockDeck = createMockDeck();
      vi.mocked(loadDeck).mockResolvedValue(mockDeck);

      await initializer.loadGame();

      expect(loadDeck).toHaveBeenCalledWith('test-deck');
      expect(callbacks.onSetDeck).toHaveBeenCalledWith(mockDeck);
    });

    it('should fall back to default deck if localStorage is empty', async () => {
      vi.mocked(mockLocalStorage.getItem).mockReturnValue(null);
      const { loadDeck } = await import('@/data/deckLoader');
      const mockDeck = createMockDeck();
      vi.mocked(loadDeck).mockResolvedValue(mockDeck);

      await initializer.loadGame();

      expect(loadDeck).toHaveBeenCalledWith('buildings-height-en');
    });

    it('should update game state manager with deck', async () => {
      const { loadDeck } = await import('@/data/deckLoader');
      const mockDeck = createMockDeck();
      vi.mocked(loadDeck).mockResolvedValue(mockDeck);

      await initializer.loadGame();

      expect(callbacks.onUpdateGameStateManager).toHaveBeenCalledWith(mockDeck);
    });

    it('should initialize card dealer manager', async () => {
      const { loadDeck } = await import('@/data/deckLoader');
      const mockDeck = createMockDeck();
      vi.mocked(loadDeck).mockResolvedValue(mockDeck);

      await initializer.loadGame();

      expect(callbacks.onInitializeCardDealerManager).toHaveBeenCalled();
    });

    it('should initialize remaining cards and shuffle', async () => {
      const { loadDeck, shuffleCardsInPlace } = await import('@/data/deckLoader');
      const mockDeck = createMockDeck();
      vi.mocked(loadDeck).mockResolvedValue(mockDeck);

      await initializer.loadGame();

      expect(shuffleCardsInPlace).toHaveBeenCalled();
      expect(callbacks.onSetRemainingCards).toHaveBeenCalled();
    });

    it('should calculate scale and snap threshold', async () => {
      const { loadDeck } = await import('@/data/deckLoader');
      const { calculateScale, calculateSnapThreshold } = await import('@/utils/scaleUtils');
      const mockDeck = createMockDeck();
      vi.mocked(loadDeck).mockResolvedValue(mockDeck);
      vi.mocked(calculateScale).mockReturnValue(1.5);
      vi.mocked(calculateSnapThreshold).mockReturnValue(120);

      await initializer.loadGame();

      expect(calculateScale).toHaveBeenCalledWith(1920, 1080);
      expect(calculateSnapThreshold).toHaveBeenCalledWith(1.5);
      expect(callbacks.onSetScale).toHaveBeenCalledWith(1.5);
      expect(callbacks.onSetSnapThreshold).toHaveBeenCalledWith(120);
    });

    it('should create first board card', async () => {
      const { loadDeck } = await import('@/data/deckLoader');
      const mockDeck = createMockDeck();
      vi.mocked(loadDeck).mockResolvedValue(mockDeck);

      await initializer.loadGame();

      expect(callbacks.onSetBoardCard).toHaveBeenCalled();
      const boardCardCall = (callbacks.onSetBoardCard as Mock).mock.calls[0][0];
      expect(boardCardCall).toBeInstanceOf(GameCard);
      expect(boardCardCall.isInHand).toBe(false);
    });

    it('should animate first card to center', async () => {
      const { loadDeck } = await import('@/data/deckLoader');
      const mockDeck = createMockDeck();
      vi.mocked(loadDeck).mockResolvedValue(mockDeck);

      await initializer.loadGame();

      expect(callbacks.onAnimateFirstCardToCenter).toHaveBeenCalled();
    });

    it('should start dealing cards for learning mode', async () => {
      const { loadDeck } = await import('@/data/deckLoader');
      const mockDeck = createMockDeck();
      vi.mocked(loadDeck).mockResolvedValue(mockDeck);
      callbacks.onGetGameState = vi.fn(() => ({
        isLearningMode: true,
        isHotseatMode: false,
        currentPlayerIndex: 0,
        gameDifficulty: 'medium' as const,
      }));

      await initializer.loadGame();

      expect(callbacks.onStartDealingCards).toHaveBeenCalledWith('learning');
    });

    it('should start dealing cards for hotseat mode', async () => {
      const { loadDeck } = await import('@/data/deckLoader');
      const mockDeck = createMockDeck();
      vi.mocked(loadDeck).mockResolvedValue(mockDeck);
      callbacks.onGetGameState = vi.fn(() => ({
        isLearningMode: false,
        isHotseatMode: true,
        currentPlayerIndex: 0,
        gameDifficulty: 'medium' as const,
      }));

      await initializer.loadGame();

      expect(callbacks.onStartDealingCards).toHaveBeenCalledWith('hotseat');
    });

    it('should start dealing cards for normal mode', async () => {
      const { loadDeck } = await import('@/data/deckLoader');
      const mockDeck = createMockDeck();
      vi.mocked(loadDeck).mockResolvedValue(mockDeck);
      callbacks.onGetGameState = vi.fn(() => ({
        isLearningMode: false,
        isHotseatMode: false,
        currentPlayerIndex: 0,
        gameDifficulty: 'medium' as const,
      }));

      await initializer.loadGame();

      expect(callbacks.onStartDealingCards).toHaveBeenCalledWith('normal');
    });

    it('should handle errors gracefully', async () => {
      const { loadDeck } = await import('@/data/deckLoader');
      vi.mocked(loadDeck).mockRejectedValue(new Error('Deck load failed'));

      await expect(initializer.loadGame()).rejects.toThrow('Deck load failed');
    });

    it('should throw error if no cards available', async () => {
      const { loadDeck } = await import('@/data/deckLoader');
      const emptyDeck = createMockDeck();
      emptyDeck.cards = [];
      vi.mocked(loadDeck).mockResolvedValue(emptyDeck);
      callbacks.onGetRemainingCards = vi.fn(() => []);

      await expect(initializer.loadGame()).rejects.toThrow('No cards available');
    });
  });
});
