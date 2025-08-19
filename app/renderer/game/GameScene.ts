import { Application, Container, Graphics, Text } from 'pixi.js';
import { logger } from '@/utils/logger';

/**
 * Game scene for Axes-Mundi
 */
export class GameScene {
  public container: Container;
  private app: Application;
  private axisLine: Graphics;
  private axisLabel: Text;
  private testCard: Graphics;

  constructor(app: Application) {
    this.app = app;
    this.container = new Container();
    
    this.initAxis();
    this.initTestCard();
    this.setupEventListeners();
    
    logger.info({ scope: 'renderer/game/scene', msg: 'game scene created' });
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
        err: { message: error.message, stack: error.stack } 
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
        err: { message: error.message, stack: error.stack } 
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
        err: { message: error.message, stack: error.stack } 
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
        meta: { result } 
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
        err: { message: error.message, stack: error.stack } 
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
        meta: { width, height } 
      });
    } catch (error) {
      logger.error({ 
        scope: 'renderer/game/scene', 
        msg: 'resize failed', 
        err: { message: error.message, stack: error.stack } 
      });
    }
  }
}
