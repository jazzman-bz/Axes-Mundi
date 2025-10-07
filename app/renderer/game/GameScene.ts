import {
  Application, Container, Graphics, Text,
} from 'pixi.js';
import { logger } from '@/utils/logger';
import { soundManager, SoundType } from '@/utils/soundManager';
import { GameCard } from './Card';
import { Card as CardData } from '@/data/types';

/**
 * Game scene for Axes-Mundi
 */
export class GameScene {
  public container: Container;

  private app: Application;

  private axisLine: Graphics;

  private axisLabel: Text;

  private testCard: Graphics;

  // LAN mode support
  private isLANMode: boolean = false;

  private lanCards: GameCard[] = [];

  private lanBoardCard: GameCard | null = null;

  private lanPlayerHand: GameCard[] = [];

  private lanOpponentHand: GameCard[] = [];

  constructor(app: Application) {
    this.app = app;
    this.container = new Container();

    // Check if we're in LAN mode
    this.isLANMode = localStorage.getItem('selectedGameType') === 'lan';

    this.initAxis();
    this.initTestCard();
    this.setupEventListeners();

    // Initialize LAN mode if needed
    if (this.isLANMode) {
      this.initLANMode();
    }

    logger.info({ scope: 'renderer/game/scene', msg: 'game scene created', meta: { isLANMode: this.isLANMode } });
  }

  /**
   * Initialize LAN mode
   */
  private initLANMode(): void {
    try {
      logger.info({ scope: 'renderer/game/scene', msg: 'initializing LAN mode' });

      // Debug: Log all localStorage keys
      console.log('🎮 GameScene: All localStorage keys:', Object.keys(localStorage));
      console.log('🎮 GameScene: selectedGameType:', localStorage.getItem('selectedGameType'));
      console.log('🎮 GameScene: lanCardDistribution exists:', !!localStorage.getItem('lanCardDistribution'));

      // Load card distribution from localStorage
      const cardDistributionStr = localStorage.getItem('lanCardDistribution');
      if (cardDistributionStr) {
        console.log('🎮 GameScene: Found lanCardDistribution in localStorage');
        const cardDistribution = JSON.parse(cardDistributionStr);
        console.log('🎮 GameScene: Parsed card distribution:', cardDistribution);
        this.setupLANCards(cardDistribution);
      } else {
        console.warn('🎮 GameScene: No lanCardDistribution found in localStorage');
        logger.warn({ scope: 'renderer/game/scene', msg: 'no LAN card distribution found' });
      }
    } catch (error) {
      console.error('🎮 GameScene: Error in initLANMode:', error);
      logger.error({
        scope: 'renderer/game/scene',
        msg: 'failed to initialize LAN mode',
        err: { message: error.message, stack: error.stack },
      });
    }
  }

  /**
   * Setup LAN cards from distribution data
   */
  private setupLANCards(distribution: any): void {
    try {
      console.log('🎮 GameScene: setupLANCards called with distribution:', distribution);
      logger.info({ scope: 'renderer/game/scene', msg: 'setting up LAN cards', meta: { deckId: distribution.deckId } });

      // Load deck for image folder reference
      this.loadDeckForLAN(distribution.deckId).then((deck) => {
        console.log('🎮 GameScene: Deck loaded:', deck);
        if (deck) {
          this.createLANCards(distribution, deck);
        } else {
          console.error('🎮 GameScene: Failed to load deck');
        }
      }).catch((error) => {
        console.error('🎮 GameScene: Error loading deck:', error);
      });
    } catch (error) {
      console.error('🎮 GameScene: Error in setupLANCards:', error);
      logger.error({
        scope: 'renderer/game/scene',
        msg: 'failed to setup LAN cards',
        err: { message: error.message, stack: error.stack },
      });
    }
  }

  /**
   * Load deck for LAN mode
   */
  private async loadDeckForLAN(deckId: string): Promise<any> {
    try {
      // Import deck loader dynamically to avoid circular dependencies
      const { loadDeck } = await import('@/data/deckLoader');
      return await loadDeck(deckId);
    } catch (error) {
      logger.error({
        scope: 'renderer/game/scene',
        msg: 'failed to load deck for LAN mode',
        err: { message: error.message, stack: error.stack },
      });
      return null;
    }
  }

  /**
   * Create LAN cards with animations
   */
  private createLANCards(distribution: any, deck: any): void {
    try {
      console.log('🎮 GameScene: createLANCards called');
      logger.info({ scope: 'renderer/game/scene', msg: 'creating LAN cards with animations' });

      console.log('🎮 GameScene: App screen dimensions:', this.app.screen.width, 'x', this.app.screen.height);
      console.log('🎮 GameScene: Distribution boardCard:', distribution.boardCard);
      console.log('🎮 GameScene: Distribution serverHand:', distribution.serverHand?.length);
      console.log('🎮 GameScene: Distribution clientHand:', distribution.clientHand?.length);

      // Create board card with sound
      soundManager.play(SoundType.CARD_SHUFFLE);

      // Create board card
      if (distribution.boardCard) {
        console.log('🎮 GameScene: Creating board card:', distribution.boardCard.title);
        this.lanBoardCard = new GameCard(
          distribution.boardCard,
          deck,
          this.app.screen.width / 2,
          this.app.screen.height / 2,
          1.2, // Slightly larger for board card
        );

        // Board card is on axis, not in hand - so show the measurement value
        this.lanBoardCard.isInHand = false;

        // Add card to scene (GameCard uses canvas, not PixiJS container)
        const pixiCard = this.createPixiCardRepresentation(this.lanBoardCard);
        this.container.addChild(pixiCard);
        console.log('🎮 GameScene: Board card added to scene');
        console.log('🎮 GameScene: Board card isInHand set to false for measurement display');

        // Animate board card appearance
        this.animateCardAppearance(this.lanBoardCard, 0);
      }

      // Create player hand cards with synchronized sounds
      if (distribution.serverHand && distribution.serverHand.length > 0) {
        console.log('🎮 GameScene: Creating', distribution.serverHand.length, 'player hand cards');
        distribution.serverHand.forEach((cardData: any, index: number) => {
          setTimeout(() => {
            soundManager.play(SoundType.CARD_SHUFFLE); // Play sound exactly when card animates
            
            const card = new GameCard(
              cardData,
              deck,
              50, // Start at deck position
              this.app.screen.height - 320, // Deck Y position
              1,
            );

            this.lanPlayerHand.push(card);
            const pixiCard = this.createPixiCardRepresentation(card);
            this.container.addChild(pixiCard);

            // Animate card appearance
            this.animateCardAppearance(card, 0);
          }, index * 200);
        });
        console.log('🎮 GameScene: Player hand cards created');
      }

      // Create opponent hand cards (show card backs) with synchronized sounds
      if (distribution.clientHand && distribution.clientHand.length > 0) {
        console.log('🎮 GameScene: Creating', distribution.clientHand.length, 'opponent hand cards');
        distribution.clientHand.forEach((cardData: any, index: number) => {
          setTimeout(() => {
            soundManager.play(SoundType.CARD_SHUFFLE); // Play sound exactly when card animates
            
            const card = new GameCard(
              cardData,
              deck,
              this.app.screen.width - 250, // Start at right side
              50, // Top position
              1,
            );

            // Show card back for opponent
            card.showCardBack = true;

            this.lanOpponentHand.push(card);
            const pixiCard = this.createPixiCardRepresentation(card);
            this.container.addChild(pixiCard);

            // Animate card appearance
            this.animateCardAppearance(card, 0);
          }, 1200 + index * 200);
        });
        console.log('🎮 GameScene: Opponent hand cards created');
      }

      // Layout hands after all cards are created
      setTimeout(() => {
        console.log('🎮 GameScene: Starting layout of hands');
        this.layoutLANHands();
      }, 2000);
    } catch (error) {
      console.error('🎮 GameScene: Error in createLANCards:', error);
      logger.error({
        scope: 'renderer/game/scene',
        msg: 'failed to create LAN cards',
        err: { message: error.message, stack: error.stack },
      });
    }
  }

  /**
   * Create PixiJS representation of a GameCard
   */
  private createPixiCardRepresentation(card: GameCard): Container {
    try {
      console.log('🎮 GameScene: Creating PixiJS representation for card:', card.card.title);
      console.log('🎮 GameScene: Card dimensions:', card.width, 'x', card.height);
      console.log('🎮 GameScene: Card position:', card.x, ',', card.y);

      const container = new Container();

      // Create card background
      const cardBg = new Graphics();
      cardBg.beginFill(0xffffff);
      cardBg.drawRoundedRect(0, 0, card.width, card.height, 8);
      cardBg.endFill();
      cardBg.lineStyle(2, 0x000000);
      cardBg.drawRoundedRect(0, 0, card.width, card.height, 8);

      // Create card text
      const cardText = new Text(card.card.title, {
        fontFamily: 'Arial',
        fontSize: 14,
        fill: 0x000000,
        align: 'center',
        wordWrap: true,
        wordWrapWidth: card.width - 10,
      });
      cardText.anchor.set(0.5);
      cardText.position.set(card.width / 2, card.height / 2);

      // Create value text
      const valueText = new Text(card.card.displayValue || '', {
        fontFamily: 'Arial',
        fontSize: 12,
        fill: 0x666666,
        align: 'center',
      });
      valueText.anchor.set(0.5);
      valueText.position.set(card.width / 2, card.height / 2 + 20);

      container.addChild(cardBg);
      container.addChild(cardText);
      if (card.card.displayValue) {
        container.addChild(valueText);
      }

      // Position container
      container.position.set(card.x, card.y);

      // Store reference to GameCard for later use
      container.userData = { gameCard: card };

      console.log('🎮 GameScene: PixiJS card representation created successfully');
      return container;
    } catch (error) {
      console.error('🎮 GameScene: Error creating PixiJS card representation:', error);
      throw error;
    }
  }

  /**
   * Animate card appearance
   */
  private animateCardAppearance(card: GameCard, delay: number): void {
    setTimeout(() => {
      // Find the PixiJS container for this card
      const pixiContainer = this.findPixiContainerForCard(card);
      if (pixiContainer) {
        // Start from deck position and animate to target
        pixiContainer.alpha = 0;
        pixiContainer.scale.set(0.5);

        // Fade in and scale up
        pixiContainer.alpha = 1;
        pixiContainer.scale.set(1);

        logger.debug({ scope: 'renderer/game/scene', msg: 'card appearance animated', meta: { cardTitle: card.card.title } });
      }
    }, delay);
  }

  /**
   * Find PixiJS container for a GameCard
   */
  private findPixiContainerForCard(card: GameCard): Container | null {
    // Search through all children to find the container that represents this card
    for (let i = 0; i < this.container.children.length; i++) {
      const child = this.container.children[i];
      if (child instanceof Container && child.userData && child.userData.gameCard === card) {
        return child;
      }
    }
    return null;
  }

  /**
   * Layout LAN hands
   */
  private layoutLANHands(): void {
    try {
      // Layout player hand at bottom
      if (this.lanPlayerHand.length > 0) {
        const cardWidth = 200;
        const startX = (this.app.screen.width - (this.lanPlayerHand.length * cardWidth)) / 2;
        const startY = this.app.screen.height - 320;

        this.lanPlayerHand.forEach((card, index) => {
          const targetX = startX + (index * cardWidth);
          const targetY = startY;

          // Animate to final position
          this.animateCardToPosition(card, targetX, targetY, 500);
        });
      }

      // Layout opponent hand at top
      if (this.lanOpponentHand.length > 0) {
        const cardWidth = 200;
        const startX = (this.app.screen.width - (this.lanOpponentHand.length * cardWidth)) / 2;
        const startY = 50;

        this.lanOpponentHand.forEach((card, index) => {
          const targetX = startX + (index * cardWidth);
          const targetY = startY;

          // Animate to final position
          this.animateCardToPosition(card, targetX, targetY, 500);
        });
      }

      logger.info({ scope: 'renderer/game/scene', msg: 'LAN hands laid out' });
    } catch (error) {
      logger.error({
        scope: 'renderer/game/scene',
        msg: 'failed to layout LAN hands',
        err: { message: error.message, stack: error.stack },
      });
    }
  }

  /**
   * Animate card to position
   */
  private animateCardToPosition(card: GameCard, targetX: number, targetY: number, duration: number): void {
    // Find the PixiJS container for this card
    const pixiContainer = this.findPixiContainerForCard(card);
    if (!pixiContainer) return;

    // Simple animation using GSAP-like easing
    const startX = pixiContainer.x;
    const startY = pixiContainer.y;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out)
      const easeProgress = 1 - (1 - progress) ** 3;

      pixiContainer.x = startX + (targetX - startX) * easeProgress;
      pixiContainer.y = startY + (targetY - startY) * easeProgress;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  /**
   * Initialize the axis line
   */
  private initAxis(): void {
    try {
      // Create axis line
      this.axisLine = new Graphics();
      this.axisLine.lineStyle(4, 0xffffff, 0.8);
      this.axisLine.moveTo(100, this.app.screen.height / 2);
      this.axisLine.lineTo(this.app.screen.width - 100, this.app.screen.height / 2);

      // Create axis label
      this.axisLabel = new Text('Höhe (m)', {
        fontFamily: 'Arial',
        fontSize: 24,
        fill: 0xffffff,
        align: 'center',
      });
      this.axisLabel.anchor.set(0.5);
      this.axisLabel.position.set(this.app.screen.width / 2, this.app.screen.height / 2 - 50);

      this.container.addChild(this.axisLine);
      this.container.addChild(this.axisLabel);

      logger.debug({ scope: 'renderer/game/scene', msg: 'axis initialized' });
    } catch (error) {
      logger.error({
        scope: 'renderer/game/scene',
        msg: 'failed to initialize axis',
        err: { message: error.message, stack: error.stack },
      });
      throw error;
    }
  }

  /**
   * Initialize test card
   */
  private initTestCard(): void {
    try {
      // Create a simple test card
      this.testCard = new Graphics();
      this.testCard.beginFill(0x4a90e2);
      this.testCard.drawRoundedRect(0, 0, 120, 80, 8);
      this.testCard.endFill();

      // Add card text
      const cardText = new Text('Test\nKarte', {
        fontFamily: 'Arial',
        fontSize: 14,
        fill: 0xffffff,
        align: 'center',
      });
      cardText.anchor.set(0.5);
      cardText.position.set(60, 40);

      this.testCard.addChild(cardText);
      this.testCard.position.set(50, this.app.screen.height - 150);

      // Make card interactive
      this.testCard.eventMode = 'static';
      this.testCard.cursor = 'pointer';

      this.container.addChild(this.testCard);

      logger.debug({ scope: 'renderer/game/scene', msg: 'test card initialized' });
    } catch (error) {
      logger.error({
        scope: 'renderer/game/scene',
        msg: 'failed to initialize test card',
        err: { message: error.message, stack: error.stack },
      });
      throw error;
    }
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    try {
      // Test card click
      this.testCard.on('pointerdown', this.handleCardClick.bind(this));

      logger.debug({ scope: 'renderer/game/scene', msg: 'event listeners set up' });
    } catch (error) {
      logger.error({
        scope: 'renderer/game/scene',
        msg: 'failed to set up event listeners',
        err: { message: error.message, stack: error.stack },
      });
    }
  }

  /**
   * Handle card click
   */
  private async handleCardClick(): Promise<void> {
    try {
      logger.info({ scope: 'renderer/game/scene', msg: 'test card clicked' });

      // Check if AXM API is available
      if (!window.AXM) {
        logger.warn({ scope: 'renderer/game/scene', msg: 'AXM API not available, using fallback' });
        // Visual feedback for fallback
        this.testCard.tint = 0x4caf50;
        setTimeout(() => {
          this.testCard.tint = 0xffffff;
        }, 1000);
        return;
      }

      // Call main process via IPC
      const result = await window.AXM.placeCard(0);

      logger.info({
        scope: 'renderer/game/scene',
        msg: 'card placement result',
        meta: { result },
      });

      // Visual feedback
      this.testCard.tint = result.success ? 0x4caf50 : 0xf44336;

      // Reset tint after 1 second
      setTimeout(() => {
        this.testCard.tint = 0xffffff;
      }, 1000);
    } catch (error) {
      logger.error({
        scope: 'renderer/game/scene',
        msg: 'card click failed',
        err: { message: error.message, stack: error.stack },
      });

      // Visual error feedback
      this.testCard.tint = 0xf44336;
      setTimeout(() => {
        this.testCard.tint = 0xffffff;
      }, 1000);
    }
  }

  /**
   * Handle window resize
   */
  public handleResize(width: number, height: number): void {
    try {
      console.log('🎮 GameScene: handleResize called with dimensions:', width, 'x', height);

      // Update axis line
      this.axisLine.clear();
      this.axisLine.lineStyle(4, 0xffffff, 0.8);
      this.axisLine.moveTo(100, height / 2);
      this.axisLine.lineTo(width - 100, height / 2);

      // Update axis label position
      this.axisLabel.position.set(width / 2, height / 2 - 50);

      // Update test card position
      this.testCard.position.set(50, height - 150);

      logger.debug({
        scope: 'renderer/game/scene',
        msg: 'scene resized',
        meta: { width, height },
      });
    } catch (error) {
      console.error('🎮 GameScene: Error in handleResize:', error);
      logger.error({
        scope: 'renderer/game/scene',
        msg: 'resize failed',
        err: { message: error.message, stack: error.stack },
      });
    }
  }
}
