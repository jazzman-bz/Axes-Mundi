import { LANGameManager } from './lan-game';
import { logger } from '@/utils/logger';
import { GameCard } from './game/Card';

/**
 * LAN Game Main Application
 * Handles the canvas initialization and card distribution for LAN mode
 * Based on Single-Player AI mechanics
 */
class LANGameApp {
  private lanGame: LANGameManager | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private isInitialized: boolean = false;
  private lastLoggedPlayer: string | null = null;
  private logoImage: HTMLImageElement | null = null;
  
  // Game state (like Single-Player)
  private playerHand: any[] = [];
  private opponentHand: any[] = [];
  private boardCard: any = null;
  private remainingCards: any[] = [];
  private scale: number = 1;
  
  // Drag & Drop variables
  private isDragging: boolean = false;
  private selectedCard: any = null;
  private snapThreshold: number = 50; // Distance to axis for snapping
  
  // Card placement arrays (like Single-Player)
  private placedLeft: any[] = []; // Cards placed to the left of center
  private placedRight: any[] = []; // Cards placed to the right of center
  private isPreviewActive: boolean = false; // Track if preview is currently active
  private readonly stackSpacing: number = 140; // px spacing between placed cards

  constructor() {
    console.log('🎮 LANGameApp constructor called');
    this.init();
    
    // Set up mouse event handlers for hover effects
    this.setupMouseEvents();
  }

  /**
   * Initialize the LAN game application
   */
  async init(): Promise<void> {
    try {
      console.log('🎮 Initializing LAN game application...');
      
      // Check if we're in LAN mode
      const isLANMode = localStorage.getItem('selectedGameType') === 'lan';
      const isServerClient = localStorage.getItem('isServerClient') === 'true';
      
      console.log('🎮 LAN mode check:', { isLANMode, isServerClient });
      
      if (!isLANMode) {
        console.error('🎮 Not in LAN mode, redirecting to landing page');
        window.location.href = './index.html';
        return;
      }

      // Initialize canvas
      this.initCanvas();
      
             // Initialize canvas context
       this.initCanvasContext();
       
       // Load logo image
       this.loadLogoImage();
       
             // Initialize LAN game manager
      await this.initLANGame();
      
      // Set up game state update callback for WebSocket integration
      if (this.lanGame) {
        this.lanGame.onGameStateUpdate((gameState: any) => {
          this.handleGameStateUpdate(gameState);
        });
      }
      
      // Start game loop (like Single-Player)
      this.startGameLoop();
      
             // For server-client: distribute cards on canvas first, then send to client
       if (isServerClient) {
         await this.handleServerClientFlow();
       } else {
         // For client: load card distribution from localStorage and display
         await this.handleClientFlow();
       }
       
              // Update LAN info display AFTER card distribution is handled
       this.updateLANInfo();
       
       // Initialize current player display
       this.initializeCurrentPlayer();
       
             // Set up periodic refresh of LAN info to catch current player changes
      this.setupLANInfoRefresh();
      
      // Set up WebSocket event listeners for real-time updates
      this.setupWebSocketEventListeners();
      
      this.isInitialized = true;
      console.log('🎮 LAN game application initialized successfully');
      
    } catch (error) {
      console.error('🎮 Failed to initialize LAN game application:', error);
      this.showError('Fehler beim Initialisieren des LAN-Spiels.');
    }
  }

  /**
   * Initialize the canvas
   */
  private initCanvas(): void {
    try {
      console.log('🎮 Initializing canvas...');
      
      this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      if (!this.canvas) {
        throw new Error('Canvas element not found');
      }
      
      // Set canvas size to window size (like Single-Player)
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      
      console.log('🎮 Canvas initialized successfully');
      
    } catch (error) {
      console.error('🎮 Failed to initialize canvas:', error);
      throw error;
    }
  }

  /**
   * Initialize Canvas context (like Single-Player)
   */
  private initCanvasContext(): void {
    try {
      console.log('🎮 Initializing Canvas context...');
      
      if (!this.canvas) {
        throw new Error('Canvas not initialized');
      }
      
      // Get 2D context (like Single-Player)
      const context = this.canvas.getContext('2d');
      if (!context) {
        throw new Error('Failed to get 2D canvas context');
      }
      this.ctx = context;
      
      // Calculate scale factor (like Single-Player)
      this.calculateScale();
      
      console.log('🎮 Canvas context initialized successfully');
      
    } catch (error) {
      console.error('🎮 Failed to initialize Canvas context:', error);
      throw error;
    }
  }

  /**
   * Calculate scale factor based on window size (like Single-Player)
   */
  private calculateScale(): void {
    // Base size: 1920x1080, scale down for smaller screens
    const baseWidth = 1920;
    const baseHeight = 1080;
    const scaleX = window.innerWidth / baseWidth;
    const scaleY = window.innerHeight / baseHeight;
    this.scale = Math.min(scaleX, scaleY, 1.5); // Cap at 1.5x for very large screens
    
    console.log('🎮 Scale calculated:', this.scale);
  }

  /**
   * Load Axes Mundi logo image
   */
  private loadLogoImage(): void {
    try {
      this.logoImage = new Image();
      this.logoImage.onload = () => {
        console.log('🎮 Logo image loaded successfully');
      };
      this.logoImage.onerror = () => {
        console.warn('🎮 Failed to load logo image, using fallback');
        this.logoImage = null;
      };
      this.logoImage.src = './assets/axes-mundi logo.png';
    } catch (error) {
      console.error('🎮 Error loading logo image:', error);
      this.logoImage = null;
    }
  }

  /**
   * Initialize LAN game manager
   */
  private async initLANGame(): Promise<void> {
    try {
      console.log('🎮 Initializing LANGameManager...');
      
      this.lanGame = new LANGameManager();
      
      // Set player names from localStorage
      const serverPlayerName = localStorage.getItem('serverPlayerName');
      const clientPlayerName = localStorage.getItem('clientPlayerName');
      
      if (serverPlayerName && clientPlayerName) {
        this.lanGame.setPlayerNames(serverPlayerName, clientPlayerName);
        console.log('🎮 Player names set:', { serverPlayerName, clientPlayerName });
      }
      
      // Initialize LAN game (this prepares card distribution but doesn't send it)
      await this.lanGame.initializeLANGame();
      
      console.log('🎮 LANGameManager initialized successfully');
      
    } catch (error) {
      console.error('🎮 Failed to initialize LANGameManager:', error);
      throw error;
    }
  }

  /**
   * Handle server-client flow: distribute cards on canvas first, then send to client
   */
  private async handleServerClientFlow(): Promise<void> {
    try {
      console.log('🎮 Handling server-client flow...');
      
      // Get card distribution from LANGameManager
      if (this.lanGame) {
        const distribution = this.lanGame.getCardDistribution();
        if (distribution) {
          console.log('🎮 Distributing cards on canvas...');
          this.updateLANStatus('Karten werden verteilt...');
          
          // Create GameCard objects and distribute them (like Single-Player)
          await this.distributeCardsOnCanvas(distribution);
          
                  // Small delay to ensure cards are visible
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Animate board card to center
        if (this.boardCard) {
          this.animateBoardCardToCenter();
        }
        
        // Then: send card distribution to client
        console.log('🎮 Sending card distribution to client...');
        this.lanGame.sendCardDistributionAfterCanvasInit();
          
          this.updateLANStatus('Kartenverteilung an Client gesendet!');
          console.log('🎮 Card distribution sent to client successfully');
        }
      }
      
    } catch (error) {
      console.error('🎮 Failed to handle server-client flow:', error);
      throw error;
    }
  }

  /**
   * Distribute cards on canvas (like Single-Player AI mode)
   */
  private async distributeCardsOnCanvas(distribution: any): Promise<void> {
    try {
      console.log('🎮 Starting card distribution on canvas...');
      
             // Load deck for image folder reference
       const { loadDeck } = await import('@/data/deckLoader');
       console.log('🎮 Loading deck with ID:', distribution.deckId);
       const deck = await loadDeck(distribution.deckId);
       
       if (!deck) {
         throw new Error('Failed to load deck');
       }
       
               console.log('🎮 Deck loaded successfully:', {
          id: deck.id,
          name: deck.name,
          imageFolder: deck.imageFolder,
          cardCount: deck.cards.length
        });
        
        // Store remaining cards for deck visualization
        this.remainingCards = [...deck.cards];
      
                     // Create board card
        if (distribution.boardCard) {
          // Find the actual card data by ID
          const boardCardData = deck.cards.find(card => card.id === distribution.boardCard.id);
          if (boardCardData) {
            console.log('🎮 Creating board card with data:', boardCardData);
            this.boardCard = new GameCard(
              boardCardData,
              deck,
              50 * this.scale, // Start at deck position
              this.canvas!.height - 320 * this.scale, // Deck Y position
              this.scale
            );
            // Board card is on axis, not in hand - so show the measurement value
            this.boardCard.isInHand = false;
            console.log('🎮 Board card created:', boardCardData.title);
            console.log('🎮 Board card object:', this.boardCard);
            console.log('🎮 Board card isInHand set to false for measurement display');
          } else {
            console.error('🎮 Board card data not found for ID:', distribution.boardCard.id);
          }
        } else {
          console.log('🎮 No board card in distribution');
        }
      
             // Create player hand cards with animation delays (like Single-Player)
       if (distribution.serverHand && distribution.serverHand.length > 0) {
         console.log('🎮 Creating', distribution.serverHand.length, 'player hand cards');
         console.log('🎮 Server hand data:', distribution.serverHand);
         for (let i = 0; i < distribution.serverHand.length; i++) {
           setTimeout(() => {
             this.dealCardToPlayer(distribution.serverHand[i], deck);
           }, i * 200); // 200ms delay between each card
         }
       } else {
         console.log('🎮 No server hand cards in distribution');
       }
      
             // Create opponent hand cards with animation delays (like Single-Player)
       if (distribution.clientHand && distribution.clientHand.length > 0) {
         console.log('🎮 Creating', distribution.clientHand.length, 'opponent hand cards');
         console.log('🎮 Client hand data:', distribution.clientHand);
         for (let i = 0; i < distribution.clientHand.length; i++) {
           setTimeout(() => {
             this.dealCardToOpponent(distribution.clientHand[i], deck);
           }, 1200 + i * 200); // Start after player cards
         }
       } else {
         console.log('🎮 No client hand cards in distribution');
       }
      
      console.log('🎮 Card distribution completed');
      
    } catch (error) {
      console.error('🎮 Failed to distribute cards on canvas:', error);
      throw error;
    }
  }

  /**
   * Deal a card to the player (like Single-Player)
   */
     private dealCardToPlayer(cardData: any, deck: any): void {
     console.log('🎮 Dealing card to player:', cardData);
     
     // Find the actual card data by ID
     const actualCardData = deck.cards.find(card => card.id === cardData.id);
     if (!actualCardData) {
       console.error('🎮 Card not found in deck:', cardData.id);
       return;
     }
     
     console.log('🎮 Found actual card data:', actualCardData);
     
     const card = new GameCard(
       actualCardData,
       deck,
       50 * this.scale, // Start at deck position
       this.canvas!.height - 320 * this.scale, // Deck Y position
       this.scale
     );
     
     console.log('🎮 GameCard created:', card);
     
     // Add to hand first
     this.playerHand.push(card);
     
     // Then layout to set target positions (this will animate the cards)
     this.layoutHand();
     
     console.log('🎮 Card dealt to player:', actualCardData.title);
     console.log('🎮 Player hand now has', this.playerHand.length, 'cards');
   }

  /**
   * Deal a card to the opponent (like Single-Player)
   */
     private dealCardToOpponent(cardData: any, deck: any): void {
     console.log('🎮 Dealing card to opponent:', cardData);
     
     // Find the actual card data by ID
     const actualCardData = deck.cards.find(card => card.id === cardData.id);
     if (!actualCardData) {
       console.error('🎮 Card not found in deck:', cardData.id);
       return;
     }
     
     console.log('🎮 Found actual card data:', actualCardData);
     
     const card = new GameCard(
       actualCardData,
       deck,
       50 * this.scale, // Start at deck position
       this.canvas!.height - 320 * this.scale, // Deck Y position
       this.scale
     );
     
     console.log('🎮 GameCard created:', card);
     
     // Show card back for opponent
     card.showCardBack = true;
     
     // Add to hand first
     this.opponentHand.push(card);
     
     // Then layout to set target positions (this will animate the cards)
     this.layoutOpponentHand();
     
     console.log('🎮 Card dealt to opponent:', actualCardData.title);
     console.log('🎮 Opponent hand now has', this.opponentHand.length, 'cards');
   }

  /**
   * Deal a card to the client (client perspective - own hand at bottom)
   */
  private dealCardToClient(cardData: any, deck: any): void {
    console.log('🎮 Client: Dealing card to client hand:', cardData);
    
    // Find the actual card data by ID
    const actualCardData = deck.cards.find(card => card.id === cardData.id);
    if (!actualCardData) {
      console.error('🎮 Client: Card not found in deck:', cardData.id);
      return;
    }
    
    console.log('🎮 Client: Found actual card data:', actualCardData);
    
    const card = new GameCard(
      actualCardData,
      deck,
      50 * this.scale, // Start at deck position
      this.canvas!.height - 320 * this.scale, // Deck Y position
      this.scale
    );
    
    console.log('🎮 Client: GameCard created:', card);
    
    // Add to player hand (client sees their own cards at bottom)
    this.playerHand.push(card);
    
    // Then layout to set target positions (this will animate the cards)
    this.layoutHand();
    
    console.log('🎮 Client: Card dealt to client hand:', actualCardData.title);
    console.log('🎮 Client: Player hand now has', this.playerHand.length, 'cards');
  }

  /**
   * Deal a card to the server (client perspective - server's hand at top, card backs)
   */
  private dealCardToServer(cardData: any, deck: any): void {
    console.log('🎮 Client: Dealing card to server hand (card back):', cardData);
    
    // Find the actual card data by ID
    const actualCardData = deck.cards.find(card => card.id === cardData.id);
    if (!actualCardData) {
      console.error('🎮 Client: Card not found in deck:', cardData.id);
      return;
    }
    
    console.log('🎮 Client: Found actual card data:', actualCardData);
    
    const card = new GameCard(
      actualCardData,
      deck,
      50 * this.scale, // Start at deck position
      this.canvas!.height - 320 * this.scale, // Deck Y position
      this.scale
    );
    
    console.log('🎮 Client: GameCard created:', card);
    
    // Show card back for server's hand (client can't see server's cards)
    card.showCardBack = true;
    
    // Add to opponent hand (client sees server's cards at top)
    this.opponentHand.push(card);
    
    // Then layout to set target positions (this will animate the cards)
    this.layoutOpponentHand();
    
    console.log('🎮 Client: Card dealt to server hand (card back):', actualCardData.title);
    console.log('🎮 Client: Opponent hand now has', this.opponentHand.length, 'cards');
  }

  /**
   * Start game loop (like Single-Player)
   */
  private startGameLoop(): void {
    const gameLoop = () => {
      if (this.ctx && this.canvas) {
        // Update all cards (animate to target positions)
        this.updateCards();
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background
        this.ctx.fillStyle = '#2a2a2a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw axis line
        this.drawAxis();
        
        // Draw all cards
        this.drawCards();
        
        // Draw deck stack
        this.drawDeckStack();
        
        // Request next frame
        requestAnimationFrame(gameLoop);
      }
    };
    
    // Start the game loop
    gameLoop();
    console.log('🎮 Game loop started');
  }

  /**
   * Draw axis line (like Single-Player)
   */
  private drawAxis(): void {
    if (!this.ctx || !this.canvas) return;
    
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.lineWidth = 4 * this.scale;
    this.ctx.beginPath();
    this.ctx.moveTo(100 * this.scale, this.canvas.height / 2);
    this.ctx.lineTo(this.canvas.width - 100 * this.scale, this.canvas.height / 2);
    this.ctx.stroke();
    
    // Draw axis label
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = `${24 * this.scale}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Höhe (m)', this.canvas.width / 2, this.canvas.height / 2 - 50 * this.scale);
  }

  /**
   * Animate board card to center
   */
  private animateBoardCardToCenter(): void {
    if (!this.boardCard) return;
    
    // Calculate center position
    const centerX = this.canvas!.width / 2 - this.boardCard.width / 2;
    const centerY = this.canvas!.height / 2 - this.boardCard.height / 2;
    
    // Set target position for animation
    this.boardCard.setTargetPosition(centerX, centerY);
    
    console.log('🎮 Board card animating to center:', { centerX, centerY });
  }

  /**
   * Update all cards (animate to target positions)
   */
  private updateCards(): void {
    // Update board card
    if (this.boardCard) {
      this.boardCard.tick();
    }
    
    // Update placed cards on the axis (left and right of center)
    this.placedLeft.forEach(card => {
      card.tick();
    });
    
    this.placedRight.forEach(card => {
      card.tick();
    });
    
    // Update player hand cards
    this.playerHand.forEach(card => {
      card.tick();
    });
    
    // Update opponent hand cards
    this.opponentHand.forEach(card => {
      card.tick();
    });
  }

  /**
   * Draw all cards (like Single-Player)
   */
  private drawCards(): void {
    // Draw board card
    if (this.boardCard) {
      this.boardCard.render(this.ctx!);
    }
    
    // Draw placed cards on the axis (left and right of center)
    this.placedLeft.forEach(card => {
      card.render(this.ctx!);
    });
    
    this.placedRight.forEach(card => {
      card.render(this.ctx!);
    });
    
    // Draw player hand
    this.playerHand.forEach(card => {
      card.render(this.ctx!);
    });
    
    // Draw opponent hand (with card backs)
    this.opponentHand.forEach(card => {
      if (card.showCardBack) {
        this.drawOpponentCardBack(this.ctx!, card);
      } else {
        card.render(this.ctx!);
      }
    });
  }

  /**
   * Draw opponent card back (Axes Mundi logo)
   */
  private drawOpponentCardBack(ctx: CanvasRenderingContext2D, card: any): void {
    // Save context
    ctx.save();
    
    // Set position and size
    const x = card.x;
    const y = card.y;
    const width = card.width;
    const height = card.height;
    
    // Draw card back with Axes Mundi logo (same as deck)
    this.drawAxesMundiLogoImage(ctx, x, y, width, height);
    
    // Restore context
    ctx.restore();
  }

  /**
   * Draw deck stack
   */
  private drawDeckStack(): void {
    if (!this.ctx || !this.canvas) return;
    
    const deckX = 50 * this.scale;
    const deckY = this.canvas.height - 320 * this.scale; // Same height as player hand
    const cardWidth = 200 * this.scale;
    const cardHeight = 300 * this.scale;
    const stackHeight = Math.min(this.remainingCards.length, 5); // Max 5 cards visible
    
    // Draw stacked cards
    for (let i = 0; i < stackHeight; i++) {
      const offsetY = i * 2; // Small offset for stack effect
      
      // Card background
      this.ctx.fillStyle = '#4a90e2';
      this.ctx.globalAlpha = 0.8 - (i * 0.1); // Fade effect
      this.roundRect(this.ctx, deckX, deckY - offsetY, cardWidth, cardHeight, 8);
      this.ctx.fill();
      
      // Card border
      this.ctx.strokeStyle = '#2a5a8a';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      
      // Card back pattern - Axes Mundi Logo
      this.drawAxesMundiLogoImage(this.ctx, deckX, deckY - offsetY, cardWidth, cardHeight);
    }
    
    // Reset alpha
    this.ctx.globalAlpha = 1;
    
    // Draw deck count
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = `${16 * this.scale}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`${this.remainingCards.length}`, deckX + cardWidth / 2, deckY + cardHeight + 25 * this.scale);
  }

  /**
   * Draw rounded rectangle
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

  /**
   * Draw Axes Mundi Logo using the actual image
   */
  private drawAxesMundiLogoImage(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
    if (!this.logoImage) {
      // Fallback to drawn logo if image not loaded
      this.drawAxesMundiLogo(ctx, x, y, width, height);
      return;
    }
    
    // Save context
    ctx.save();
    ctx.globalAlpha = 1.0;
    
    // Fill white background with rounded corners
    ctx.fillStyle = '#ffffff';
    this.roundRect(ctx, x, y, width, height, 6);
    ctx.fill();
    
    // Calculate logo dimensions to fit nicely on the card
    const logoSize = Math.min(width, height) * 0.8;
    const logoX = x + (width - logoSize) / 2;
    const logoY = y + (height - logoSize) / 2;
    
    // Draw the logo image
    ctx.drawImage(this.logoImage, logoX, logoY, logoSize, logoSize);
    
    // Restore context
    ctx.restore();
  }

  /**
   * Draw Axes Mundi Logo (fallback drawn version)
   */
  private drawAxesMundiLogo(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
    const logoColor = '#D4AF37'; // Metallic gold color
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    
    // Save context
    ctx.save();
    ctx.globalAlpha = 1.0;
    
    // Fill white background with rounded corners
    ctx.fillStyle = '#ffffff';
    this.roundRect(ctx, x, y, width, height, 6);
    ctx.fill();
    
    // Calculate logo dimensions to fill most of the card
    const logoSize = Math.min(width, height) * 0.9;
    const symbolSize = logoSize * 0.7;
    const textSize = logoSize * 0.3;
    
    // Draw symbol (compass rose)
    const symbolX = centerX;
    const symbolY = centerY - textSize * 0.4;
    
    // Main circle
    ctx.strokeStyle = logoColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(symbolX, symbolY, symbolSize * 0.4, 0, 2 * Math.PI);
    ctx.stroke();
    
    // Center dot
    ctx.fillStyle = logoColor;
    ctx.beginPath();
    ctx.arc(symbolX, symbolY, symbolSize * 0.08, 0, 2 * Math.PI);
    ctx.fill();
    
    // Cross lines
    ctx.lineWidth = 4;
    ctx.strokeStyle = logoColor;
    ctx.beginPath();
    // Vertical line
    ctx.moveTo(symbolX, symbolY - symbolSize * 0.5);
    ctx.lineTo(symbolX, symbolY + symbolSize * 0.5);
    // Horizontal line
    ctx.moveTo(symbolX - symbolSize * 0.5, symbolY);
    ctx.lineTo(symbolX + symbolSize * 0.5, symbolY);
    ctx.stroke();
    
    // Arrowheads
    const arrowSize = symbolSize * 0.15;
    // Top arrow
    ctx.beginPath();
    ctx.moveTo(symbolX, symbolY - symbolSize * 0.5);
    ctx.lineTo(symbolX - arrowSize, symbolY - symbolSize * 0.5 + arrowSize);
    ctx.lineTo(symbolX + arrowSize, symbolY - symbolSize * 0.5 + arrowSize);
    ctx.closePath();
    ctx.fill();
    
    // Bottom arrow
    ctx.beginPath();
    ctx.moveTo(symbolX, symbolY + symbolSize * 0.5);
    ctx.lineTo(symbolX - arrowSize, symbolY + symbolSize * 0.5 - arrowSize);
    ctx.lineTo(symbolX + arrowSize, symbolY + symbolSize * 0.5 - arrowSize);
    ctx.closePath();
    ctx.fill();
    
    // Left arrow
    ctx.beginPath();
    ctx.moveTo(symbolX - symbolSize * 0.5, symbolY);
    ctx.lineTo(symbolX - symbolSize * 0.5 + arrowSize, symbolY - arrowSize);
    ctx.lineTo(symbolX - symbolSize * 0.5 + arrowSize, symbolY + arrowSize);
    ctx.closePath();
    ctx.fill();
    
    // Right arrow
    ctx.beginPath();
    ctx.moveTo(symbolX + symbolSize * 0.5, symbolY);
    ctx.lineTo(symbolX + symbolSize * 0.5 - arrowSize, symbolY - arrowSize);
    ctx.lineTo(symbolX + symbolSize * 0.5 - arrowSize, symbolY + arrowSize);
    ctx.closePath();
    ctx.fill();
    
    // Restore context
    ctx.restore();
  }

  /**
   * Handle client flow: load card distribution from localStorage and display
   */
  private async handleClientFlow(): Promise<void> {
    try {
      console.log('🎮 Handling client flow...');
      
      this.updateLANStatus('Lade Kartenverteilung...');
      
      // Client loads card distribution from localStorage (received via WebSocket)
      const cardDistributionStr = localStorage.getItem('lanCardDistribution');
      if (cardDistributionStr) {
        const distribution = JSON.parse(cardDistributionStr);
        console.log('🎮 Client: Loaded card distribution from localStorage:', distribution);
        
        // Load deck for image folder reference
        const { loadDeck } = await import('@/data/deckLoader');
        const deck = await loadDeck(distribution.deckId);
        
        if (!deck) {
          throw new Error('Failed to load deck');
        }
        
        console.log('🎮 Client: Deck loaded successfully:', deck.name);
        
        // Store remaining cards for deck visualization
        this.remainingCards = [...deck.cards];
        
        // CLIENT PERSPECTIVE: 
        // - Client sees their own hand (clientHand) at the bottom
        // - Client sees server's hand (serverHand) at the top (card backs)
        // - Board card is in the center
        
        // Create board card
        if (distribution.boardCard) {
          const boardCardData = deck.cards.find(card => card.id === distribution.boardCard.id);
          if (boardCardData) {
            console.log('🎮 Client: Creating board card:', boardCardData.title);
            this.boardCard = new GameCard(
              boardCardData,
              deck,
              50 * this.scale,
              this.canvas!.height - 320 * this.scale,
              this.scale
            );
            // Board card is on axis, not in hand - so show the measurement value
            this.boardCard.isInHand = false;
            console.log('🎮 Client: Board card created with measurement display');
          }
        }
        
        // Create CLIENT hand cards (bottom) - these are the client's own cards
        if (distribution.clientHand && distribution.clientHand.length > 0) {
          console.log('🎮 Client: Creating', distribution.clientHand.length, 'client hand cards (bottom)');
          for (let i = 0; i < distribution.clientHand.length; i++) {
            setTimeout(() => {
              this.dealCardToClient(distribution.clientHand[i], deck);
            }, i * 200);
          }
        }
        
        // Create SERVER hand cards (top) - show as card backs
        if (distribution.serverHand && distribution.serverHand.length > 0) {
          console.log('🎮 Client: Creating', distribution.serverHand.length, 'server hand cards (top, card backs)');
          for (let i = 0; i < distribution.serverHand.length; i++) {
            setTimeout(() => {
              this.dealCardToServer(distribution.serverHand[i], deck);
            }, 1200 + i * 200);
          }
        }
        
        // Animate board card to center
        setTimeout(() => {
          if (this.boardCard) {
            this.animateBoardCardToCenter();
          }
        }, 3000);
        
        this.updateLANStatus('Kartenverteilung geladen! Spiel bereit.');
        
      } else {
        throw new Error('No card distribution found in localStorage');
      }
      
    } catch (error) {
      console.error('🎮 Failed to handle client flow:', error);
      this.showError('Fehler beim Laden der Kartenverteilung.');
      throw error;
    }
  }

  // Cards are now distributed automatically by GameScene in LAN mode

  /**
   * Handle window resize (like Single-Player)
   */
  public handleResize(width: number, height: number): void {
    try {
      if (this.canvas) {
        this.canvas.width = width;
        this.canvas.height = height;
      }
      
      // Recalculate scale factor
      this.calculateScale();
      
      // Re-layout all cards with new scale
      this.layoutHand();
      this.layoutOpponentHand();
      
      logger.debug({ 
        scope: 'renderer/lan-game', 
        msg: 'window resized', 
        meta: { width, height, scale: this.scale } 
      });
    } catch (error) {
      logger.error({ 
        scope: 'renderer/lan-game', 
        msg: 'resize failed', 
        err: { message: error.message, stack: error.stack } 
      });
    }
  }

  /**
   * Layout player hand (like Single-Player)
   */
  private layoutHand(): void {
    const cardSpacing = 220 * this.scale;
    const totalWidth = this.playerHand.length * cardSpacing - 20 * this.scale;
    const startX = (this.canvas!.width - totalWidth) / 2;
    
    this.playerHand.forEach((card, index) => {
      const x = startX + index * cardSpacing;
      const y = this.canvas!.height - 320 * this.scale; // Bottom position
      
      // Store hand position for return to hand functionality
      card.storeHandPosition(x, y);
      
      // Set target position for animation
      card.setTargetPosition(x, y);
    });
    
    console.log('🎮 Player hand laid out:', this.playerHand.length, 'cards');
  }

     /**
    * Layout opponent hand (like Single-Player)
    */
   private layoutOpponentHand(): void {
     const cardSpacing = 220 * this.scale;
     const totalWidth = this.opponentHand.length * cardSpacing - 20 * this.scale;
     const startX = (this.canvas!.width - totalWidth) / 2;
     
     this.opponentHand.forEach((card, index) => {
       const x = startX + index * cardSpacing;
       const y = 20 * this.scale; // Top position
       
       // Store hand position for return to hand functionality
       card.storeHandPosition(x, y);
       
       // Set target position for animation
       card.setTargetPosition(x, y);
     });
     
     console.log('🎮 Opponent hand laid out:', this.opponentHand.length, 'cards');
   }

   /**
    * Layout all cards on the axis - center them with proper spacing (like Single-Player)
    */
   private layoutAxisCards(): void {
     if (!this.boardCard) return;
     
     // Combine all placed cards with the board card
     const allCards = [
       this.boardCard,
       ...this.placedLeft,
       ...this.placedRight
     ];
     
     if (allCards.length <= 1) return; // No need to spread if only one card
     
     // Sort cards by their current X position to maintain relative order
     const sortedCards = allCards.sort((a, b) => a.x - b.x);
     
     // Use fixed spacing between cards (like Single-Player)
     const cardWidth = 200 * this.scale;
     const spacing = 5 * this.scale; // Fixed 5px spacing
     
     // Calculate total width needed
     const totalWidth = sortedCards.length * cardWidth + (sortedCards.length - 1) * spacing;
     const startX = (this.canvas!.width - totalWidth) / 2; // Center the entire spread
     
     // Set target positions for smooth animation
     const axisY = this.canvas!.height / 2;
     
     sortedCards.forEach((card, index) => {
       const x = startX + index * (cardWidth + spacing);
       const y = axisY - card.height / 2;
       card.setTargetPosition(x, y);
     });
     
     console.log('🎮 Axis cards laid out:', sortedCards.length, 'cards with', spacing, 'px spacing');
   }

  /**
   * Update LAN status display
   */
  private updateLANStatus(message: string): void {
    try {
      const statusElement = document.getElementById('lan-status');
      if (statusElement) {
        statusElement.textContent = message;
        console.log('🎮 LAN status updated:', message);
      }
    } catch (error) {
      console.error('🎮 Failed to update LAN status:', error);
    }
  }

  /**
   * Initialize current player from localStorage and update overlay
   */
  public initializeCurrentPlayer(): void {
    try {
      const currentPlayer = localStorage.getItem('currentPlayer');
      if (currentPlayer) {
        console.log('🎮 Initializing current player from localStorage:', currentPlayer);
        this.updateLANInfo();
      } else {
        console.warn('🎮 No current player found in localStorage');
      }
    } catch (error) {
      console.error('🎮 Failed to initialize current player:', error);
    }
  }

  /**
   * Set up periodic refresh of LAN info to catch current player changes
   * REMOVED: No longer needed with WebSocket real-time updates
   */
  private setupLANInfoRefresh(): void {
    try {
      // No more periodic refresh - WebSocket updates handle this in real-time
      console.log('🎮 LAN info refresh interval removed - using WebSocket updates instead');
    } catch (error) {
      console.error('🎮 Failed to set up LAN info refresh:', error);
    }
  }

  /**
   * Set up WebSocket event listeners for real-time updates
   */
  private setupWebSocketEventListeners(): void {
    try {
      if (window.AXM && window.AXM.on) {
        // Listen for LAN status updates from main process
        window.AXM.on('lan-status-update', (data: any) => {
          this.handleLANStatusUpdate(data);
        });
        
        console.log('🎮 WebSocket event listeners set up');
      } else {
        console.warn('🎮 AXM.on not available for WebSocket events');
      }
    } catch (error) {
      console.error('🎮 Failed to set up WebSocket event listeners:', error);
    }
  }

  /**
   * Handle LAN status updates from WebSocket
   */
  private handleLANStatusUpdate(data: any): void {
    try {
      console.log('🎮 Received LAN status update:', data.type);
      
      switch (data.type) {
        case 'cardPlacement':
          this.handleRemoteCardPlacement(data);
          break;
        case 'gameStateUpdate':
          this.handleGameStateUpdate(data);
          break;
        case 'currentPlayerUpdate':
          this.updateCurrentPlayer(data.currentPlayer);
          break;
        default:
          console.log('🎮 Unknown LAN status update type:', data.type);
      }
      
    } catch (error) {
      logger.error({
        scope: 'renderer/lan-game',
        msg: 'failed to handle LAN status update',
        err: { message: error.message, stack: error.stack }
      });
    }
  }

  /**
   * Handle remote card placement from WebSocket
   */
  private handleRemoteCardPlacement(data: any): void {
    try {
      console.log('🎮 Handling remote card placement:', data);
      
      const { cardId, position, playerName } = data; // 'position' here is the boardPosition number
      
      // Convert board position number back to left/right for local visualization
      let placementPosition: 'left' | 'right';
      if (position < 0) {
        placementPosition = 'left';
      } else if (position > 0) {
        placementPosition = 'right';
      } else {
        placementPosition = 'right'; // Default for center (shouldn't happen)
      }
      
      console.log('🎮 Converted board position', position, 'to', placementPosition);
      
      // Find the card in the appropriate hand
      let card = this.playerHand.find(c => c.card.id === cardId);
      if (!card) {
        card = this.opponentHand.find(c => c.card.id === cardId);
      }
      
      if (card) {
        // Remove from hand
        this.playerHand = this.playerHand.filter(c => c !== card);
        this.opponentHand = this.opponentHand.filter(c => c !== card);
        
        // Add to placed cards based on position
        if (placementPosition === 'left') {
          this.placedLeft.push(card);
        } else {
          this.placedRight.push(card);
        }
        
        // Set card as placed (not in hand)
        card.isInHand = false;
        
        // Re-layout hands and axis
        this.layoutHand();
        this.layoutOpponentHand();
        this.layoutAxisCards();
        
        console.log('🎮 Remote card placement processed:', {
          cardId,
          boardPosition: position,
          placementPosition,
          playerName,
          leftCount: this.placedLeft.length,
          rightCount: this.placedRight.length
        });
      }
      
    } catch (error) {
      logger.error({
        scope: 'renderer/lan-game',
        msg: 'failed to handle remote card placement',
        err: { message: error.message, stack: error.stack }
      });
    }
  }

  /**
   * Update current player and refresh overlay
   */
  public updateCurrentPlayer(newCurrentPlayer: string): void {
    try {
      console.log('🎮 Updating current player to:', newCurrentPlayer);
      localStorage.setItem('currentPlayer', newCurrentPlayer);
      this.updateLANInfo();
    } catch (error) {
      console.error('🎮 Failed to update current player:', error);
    }
  }

  /**
   * Update LAN info display with player names and current player
   */
  private updateLANInfo(): void {
    try {
      const isServerClient = localStorage.getItem('isServerClient') === 'true';
      const serverPlayerName = localStorage.getItem('serverPlayerName') || 'Server';
      const clientPlayerName = localStorage.getItem('clientPlayerName') || 'Client';
      const currentPlayer = localStorage.getItem('currentPlayer');
      
      // Only log when actually updating (not on every call)
      if (this.lastLoggedPlayer !== currentPlayer) {
        console.log('🎮 Updating LAN info for player:', currentPlayer);
        this.lastLoggedPlayer = currentPlayer;
      }
      
      if (!currentPlayer) {
        console.warn('🎮 No current player found, using server player as default');
        localStorage.setItem('currentPlayer', serverPlayerName);
      }
      
      const playerNameElement = document.getElementById('player-name');
      const opponentNameElement = document.getElementById('opponent-name');
      const currentTurnElement = document.getElementById('current-turn');
      
      if (isServerClient) {
        // Server-Client perspective
        if (playerNameElement) {
          playerNameElement.textContent = `Spieler: ${serverPlayerName}`;
          // Highlight if it's server's turn
          if (currentPlayer === serverPlayerName) {
            playerNameElement.classList.add('current-turn');
            playerNameElement.classList.remove('waiting-turn');
          } else {
            playerNameElement.classList.add('waiting-turn');
            playerNameElement.classList.remove('current-turn');
          }
        }
        if (opponentNameElement) {
          opponentNameElement.textContent = `Gegner: ${clientPlayerName}`;
          // Highlight if it's client's turn
          if (currentPlayer === clientPlayerName) {
            opponentNameElement.classList.add('current-turn');
            opponentNameElement.classList.remove('waiting-turn');
          } else {
            opponentNameElement.classList.add('waiting-turn');
            opponentNameElement.classList.remove('current-turn');
          }
        }
      } else {
        // Client perspective
        if (playerNameElement) {
          playerNameElement.textContent = `Spieler: ${clientPlayerName}`;
          // Highlight if it's client's turn
          if (currentPlayer === clientPlayerName) {
            playerNameElement.classList.add('current-turn');
            playerNameElement.classList.remove('waiting-turn');
          } else {
            playerNameElement.classList.add('waiting-turn');
            playerNameElement.classList.remove('current-turn');
          }
        }
        if (opponentNameElement) {
          opponentNameElement.textContent = `Gegner: ${serverPlayerName}`;
          // Highlight if it's server's turn
          if (currentPlayer === serverPlayerName) {
            opponentNameElement.classList.add('current-turn');
            opponentNameElement.classList.remove('waiting-turn');
          } else {
            opponentNameElement.classList.add('waiting-turn');
            opponentNameElement.classList.remove('current-turn');
          }
        }
      }
      
      if (currentTurnElement) {
        currentTurnElement.textContent = `Zug: ${currentPlayer}`;
      }
      
      // Only log when player actually changes
      if (this.lastLoggedPlayer !== currentPlayer) {
        console.log('🎮 LAN info updated for player:', currentPlayer);
      }
    } catch (error) {
      console.error('🎮 Failed to update LAN info:', error);
    }
  }

     

     /**
   * Set up mouse event handlers for hover effects and drag & drop
   */
  private setupMouseEvents(): void {
    try {
      if (!this.canvas) {
        console.warn('🎮 Canvas not available for mouse events');
        return;
      }

      // Add mouse down event listener for drag & drop
      this.canvas.addEventListener('mousedown', (event) => {
        this.handleMouseDown(event);
      });

      // Add mouse move event listener for hover effects and dragging
      this.canvas.addEventListener('mousemove', (event) => {
        this.handleMouseMove(event);
      });

      // Add mouse up event listener for drag & drop
      this.canvas.addEventListener('mouseup', (event) => {
        this.handleMouseUp(event);
      });

      // Add mouse leave event listener to clear hover effects
      this.canvas.addEventListener('mouseleave', () => {
        this.clearAllHoverEffects();
        // Also stop dragging if mouse leaves canvas
        if (this.isDragging) {
          this.stopDragging();
        }
      });

      console.log('🎮 Mouse events set up for hover effects and drag & drop');
    } catch (error) {
      console.error('🎮 Failed to set up mouse events:', error);
    }
  }

  /**
   * Handle mouse down for drag & drop
   */
  private handleMouseDown(event: MouseEvent): void {
    try {
      // Only allow interaction during current player's turn
      const currentPlayer = localStorage.getItem('currentPlayer');
      const isServerClient = localStorage.getItem('isServerClient') === 'true';
      const serverPlayerName = localStorage.getItem('serverPlayerName');
      const clientPlayerName = localStorage.getItem('clientPlayerName');
      
      if (!currentPlayer) {
        console.warn('🎮 No current player set, cannot start drag');
        return;
      }
      
      // Check if it's the current player's turn
      let isCurrentPlayerTurn = false;
      if (isServerClient) {
        // Server-client: check if server is current player
        isCurrentPlayerTurn = currentPlayer === serverPlayerName;
      } else {
        // Client: check if client is current player
        isCurrentPlayerTurn = currentPlayer === clientPlayerName;
      }
      
      if (!isCurrentPlayerTurn) {
        console.log('🎮 Not current player turn, cannot start drag');
        return;
      }
      
      if (!this.canvas) return;

      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      console.log('🎮 Mouse down at:', { x, y, isCurrentPlayerTurn });

      // Check player hand cards for drag start
      for (const card of this.playerHand) {
        if (card.containsPoint(x, y)) {
          console.log('🎮 Card selected for drag:', card.card.title);
          this.selectedCard = card;
          card.startDrag(x, y);
          this.isDragging = true;
          break;
        }
      }

      console.log('🎮 After mouse down:', { 
        isDragging: this.isDragging, 
        hasSelectedCard: !!this.selectedCard 
      });
    } catch (error) {
      console.error('🎮 Failed to handle mouse down:', error);
    }
  }

  /**
   * Handle mouse move for hover effects and dragging
   */
  private handleMouseMove(event: MouseEvent): void {
    try {
      if (!this.canvas) return;

      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Handle dragging if active
      if (this.isDragging && this.selectedCard) {
        console.log('🎮 Dragging card to:', { x, y });
        this.selectedCard.updateDrag(x, y);
        
        // Show preview of where card would be placed on axis
        this.showPlacementPreview(x, y);
        return; // Skip hover effects while dragging
      }

      // Clear all hover effects first
      this.clearAllHoverEffects();

      // Only show hover effects for current player's turn
      const currentPlayer = localStorage.getItem('currentPlayer');
      const isServerClient = localStorage.getItem('isServerClient') === 'true';
      
      if (!currentPlayer) return;

      // Determine which hand should show hover effects
      let activeHand: any[] = [];
      if (isServerClient) {
        // Server-client: hover over server hand (playerHand) if it's server's turn
        if (currentPlayer === localStorage.getItem('serverPlayerName')) {
          activeHand = this.playerHand;
        }
      } else {
        // Client: hover over client hand (playerHand) if it's client's turn
        if (currentPlayer === localStorage.getItem('clientPlayerName')) {
          activeHand = this.playerHand;
        }
      }

      // Set hover effect for card under mouse in active hand
      for (const card of activeHand) {
        if (card.containsPoint(x, y)) {
          card.isHovered = true;
          console.log('🎮 Hover effect set for card:', card.card.title);
          break;
        }
      }

    } catch (error) {
      console.error('🎮 Failed to handle mouse move:', error);
    }
  }

  /**
   * Handle mouse up for drag & drop completion
   */
  private handleMouseUp(event: MouseEvent): void {
    try {
      if (this.isDragging && this.selectedCard) {
        // Snap logic: if released near axis, place left/right of center
        const releasedCard = this.selectedCard;
        releasedCard.stopDrag();

        const axisY = this.canvas!.height / 2;
        const distToAxis = Math.abs((releasedCard.y + releasedCard.height / 2) - axisY);
        
        if (distToAxis <= this.snapThreshold) {
          // SNAP: Snap to axis at exact position
          const snapX = releasedCard.x + releasedCard.width / 2;
          const snapY = axisY - releasedCard.height / 2;
          
          // SPECIAL CASE: If this is the first card after clearing the board, make it the boardCard
          if (!this.boardCard) {
            this.boardCard = releasedCard;
            releasedCard.isInHand = false;
            
            // Center the first card on the axis
            const centerX = this.canvas!.width / 2 - releasedCard.width / 2;
            releasedCard.setTargetPosition(centerX, snapY);
            
            console.log('🎮 First card set as boardCard:', releasedCard.card.title);
          } else {
            // Normal case: Determine if it's left or right of center for array placement
            const boardCenterX = this.boardCard.x + this.boardCard.width / 2;
            const isLeft = snapX < boardCenterX;
            
            // Set the exact position where the card was dropped
            releasedCard.setTargetPosition(snapX - releasedCard.width / 2, snapY);
            releasedCard.isInHand = false;
            
            // Add to appropriate array based on position relative to center
            if (isLeft) {
              this.placedLeft.push(releasedCard);
              console.log('🎮 Card placed to LEFT of center:', releasedCard.card.title);
            } else {
              this.placedRight.push(releasedCard);
              console.log('🎮 Card placed to RIGHT of center:', releasedCard.card.title);
            }
          }

          // Clear any preview positions
          this.hidePlacementPreview();
          
                     // Remove hover effect from the placed card
           releasedCard.isHovered = false;
           
           // Remove from hand AFTER successful placement
           this.playerHand = this.playerHand.filter((c) => c !== releasedCard);
           
           // Center the player hand after card removal
           this.layoutHand();
           
           // Center all cards on the axis with proper spacing
           this.layoutAxisCards();
           
                       // Send placeCard event for synchronization
            // Calculate board center X - use boardCard if available, otherwise use canvas center
            const boardCenterX = this.boardCard ? this.boardCard.x + this.boardCard.width / 2 : this.canvas!.width / 2;
            const position = snapX < boardCenterX ? 'left' : 'right';
            
            console.log('🎮 Card placement:', { cardId: releasedCard.card.id, position, boardCenterX, snapX });
            
            // Calculate the actual position number on the board (0 = center, 1 = right, -1 = left, etc.)
            let boardPosition = 0; // Default to center
            
            if (this.boardCard) {
              // If we have a board card, calculate relative position
              if (position === 'left') {
                // Count how many cards are already to the left
                boardPosition = -this.placedLeft.length - 1;
              } else {
                // Count how many cards are already to the right
                boardPosition = this.placedRight.length + 1;
              }
            }
            
            console.log('🎮 Calculated board position:', boardPosition, 'for card:', releasedCard.card.title);
            
            // Always use WebSocket communication for card placement
            if (this.lanGame && this.lanGame.lanClient) {
              try {
                // Send card placement via WebSocket with board position number
                this.lanGame.lanClient.sendCardPlacement(releasedCard.card.id, boardPosition);
                console.log('🎮 Card placement sent via WebSocket:', { 
                  cardId: releasedCard.card.id, 
                  boardPosition,
                  originalPosition: position 
                });
              } catch (error) {
                console.error('🎮 Failed to send card placement via WebSocket:', error);
              }
            } else {
              console.warn('🎮 No WebSocket client available for card placement');
            }
           
           console.log('🎮 Card successfully placed on axis');
        } else {
          // Not near axis, return card to hand
          console.log('🎮 Card not near axis, returning to hand');
          releasedCard.returnToHand();
        }

        // Clear dragging state
        this.stopDragging();
      }
    } catch (error) {
      console.error('🎮 Failed to handle mouse up:', error);
      this.stopDragging();
    }
  }

  /**
   * Stop dragging and reset state
   */
  private stopDragging(): void {
    try {
      if (this.selectedCard) {
        this.selectedCard.stopDrag();
        this.selectedCard = null;
      }
      this.isDragging = false;
      console.log('🎮 Dragging stopped');
    } catch (error) {
      console.error('🎮 Failed to stop dragging:', error);
    }
  }

  /**
   * Show preview of where card would be placed on axis
   */
  private showPlacementPreview(mouseX: number, mouseY: number): void {
    try {
      // Define the axis area as a collision box
      const axisY = this.canvas!.height / 2;
      const axisHeight = 100; // Height of the axis collision area
      const axisTop = axisY - axisHeight / 2;
      const axisBottom = axisY + axisHeight / 2;
      
      // Check if mouse is within the axis collision box
      const isOverAxis = mouseY >= axisTop && mouseY <= axisBottom;
      
      if (isOverAxis) {
        // Only show preview if not already active
        if (!this.isPreviewActive) {
          console.log('🎮 Mouse over axis, showing placement preview');
          this.showAxisPreview(mouseX);
        }
      } else {
        // Hide preview if mouse is not over axis
        if (this.isPreviewActive) {
          this.hidePlacementPreview();
        }
      }
    } catch (error) {
      console.error('🎮 Failed to show placement preview:', error);
    }
  }

  /**
   * Show axis preview by moving cards to make space
   */
  private showAxisPreview(previewX: number): void {
    try {
      if (!this.boardCard) return;
      
      // Only move cards if preview is not already active
      if (this.isPreviewActive) {
        return;
      }
      
      console.log('🎮 showAxisPreview called with previewX:', previewX);
      
      // Combine all cards in their current order (board + left + right)
      const allCards = [
        this.boardCard,
        ...this.placedLeft,
        ...this.placedRight
      ];
      
      if (allCards.length === 0) return;
      
      // Create a subtle spread effect - only 40px each side
      const spreadDistance = 40; // Reduced from 120px to 40px
      
      allCards.forEach((card) => {
        const cardCenterX = card.x + card.width / 2;
        let newX = card.x;
        
        if (cardCenterX < previewX - 20) {
          // Move cards to the left of preview position slightly left
          newX = card.x - spreadDistance;
        } else if (cardCenterX > previewX + 20) {
          // Move cards to the right of preview position slightly right
          newX = card.x + spreadDistance;
        }
        // Cards very close to preview position stay in place
        
        card.setPreviewPosition(newX, card.y);
        
        console.log('🎮 Set preview position for card:', card.card.title, 'from', card.x, 'to', newX);
      });
      
      // Mark preview as active
      this.isPreviewActive = true;
      
      console.log('🎮 Preview activated with', allCards.length, 'cards');
    } catch (error) {
      console.error('🎮 Failed to show axis preview:', error);
    }
  }

  /**
   * Hide placement preview
   */
  private hidePlacementPreview(): void {
    try {
      // Only restore if preview was active
      if (!this.isPreviewActive) {
        return;
      }
      
      console.log('🎮 Hiding placement preview, restoring original positions');
      
      // Restore original positions for all cards
      if (this.boardCard) this.boardCard.clearPreviewPosition();
      for (const card of this.placedLeft) card.clearPreviewPosition();
      for (const card of this.placedRight) card.clearPreviewPosition();
      
      // Mark preview as inactive
      this.isPreviewActive = false;
      
      console.log('🎮 Preview deactivated');
    } catch (error) {
      console.error('🎮 Failed to hide placement preview:', error);
    }
  }

  /**
   * Clear all hover effects
   */
  private clearAllHoverEffects(): void {
    try {
      // Clear hover on all cards
      if (this.boardCard) {
        this.boardCard.isHovered = false;
      }
      
      this.playerHand.forEach(card => {
        card.isHovered = false;
      });
      
      this.opponentHand.forEach(card => {
        card.isHovered = false;
      });

      console.log('🎮 All hover effects cleared');
    } catch (error) {
      console.error('🎮 Failed to clear hover effects:', error);
    }
  }

  /**
   * Handle game state updates from WebSocket
   */
  private handleGameStateUpdate(gameState: any): void {
    try {
      console.log('🎮 Handling game state update:', gameState);
      
      // Update current player
      if (gameState.currentPlayer) {
        this.updateCurrentPlayer(gameState.currentPlayer);
      }
      
      // Update placed cards visualization
      if (gameState.placedCards) {
        this.updatePlacedCardsVisualization(gameState.placedCards);
      }
      
      logger.debug({
        scope: 'renderer/lan-game',
        msg: 'game state updated from WebSocket',
        meta: { 
          currentPlayer: gameState.currentPlayer,
          placedCardsCount: gameState.placedCards?.length || 0
        }
      });
      
    } catch (error) {
      logger.error({
        scope: 'renderer/lan-game',
        msg: 'failed to handle game state update',
        err: { message: error.message, stack: error.stack }
      });
    }
  }

  /**
   * Update placed cards visualization based on game state
   */
  private updatePlacedCardsVisualization(placedCards: any[]): void {
    try {
      console.log('🎮 Updating placed cards visualization:', placedCards.length, 'cards');
      
      // Clear current placed cards arrays
      this.placedLeft = [];
      this.placedRight = [];
      
      // Rebuild placed cards arrays based on new game state
      if (this.boardCard && placedCards.length > 0) {
        const boardCenterX = this.boardCard.x + this.boardCard.width / 2;
        
        placedCards.forEach((cardData: any) => {
          // Skip board card
          if (cardData.id === this.boardCard?.card.id) {
            return;
          }
          
          // Find the card in player or opponent hand
          let card = this.playerHand.find(c => c.card.id === cardData.id);
          if (!card) {
            card = this.opponentHand.find(c => c.card.id === cardData.id);
          }
          
          if (card) {
            // Determine position relative to board card
            const cardCenterX = card.x + card.width / 2;
            const isLeft = cardCenterX < boardCenterX;
            
            // Add to appropriate array
            if (isLeft) {
              this.placedLeft.push(card);
            } else {
              this.placedRight.push(card);
            }
            
            // Remove from hand
            this.playerHand = this.playerHand.filter(c => c !== card);
            this.opponentHand = this.opponentHand.filter(c => c !== card);
            
            // Set card as placed (not in hand)
            card.isInHand = false;
          }
        });
        
        // Re-layout hands and axis
        this.layoutHand();
        this.layoutOpponentHand();
        this.layoutAxisCards();
        
        console.log('🎮 Placed cards visualization updated:', {
          left: this.placedLeft.length,
          right: this.placedRight.length
        });
      }
      
    } catch (error) {
      logger.error({
        scope: 'renderer/lan-game',
        msg: 'failed to update placed cards visualization',
        err: { message: error.message, stack: error.stack }
      });
    }
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    try {
      console.error('🎮 Error:', message);
      alert(`LAN-Spiel Fehler: ${message}`);
    } catch (error) {
      console.error('🎮 Failed to show error:', error);
    }
  }
}

// Initialize LAN game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  try {
    console.log('🎮 DOM ready, checking environment...');
    
    // Check if we're running in Electron or Browser
    // In Electron: window.AXM exists and has placeLANCard method
    // In Browser: window.AXM is undefined
    const hasAXM = typeof window.AXM !== 'undefined';
    const hasPlaceLANCard = hasAXM && typeof window.AXM.placeLANCard === 'function';
    const isElectron = hasAXM && hasPlaceLANCard;
    const isBrowser = !isElectron;
    
    console.log('🎮 Environment detection:', {
      hasAXM,
      hasPlaceLANCard,
      isElectron,
      isBrowser,
      availableMethods: hasAXM ? Object.keys(window.AXM) : 'none'
    });
    
    if (isElectron) {
      // Server-Client: Wait for AXM.placeLANCard
      console.log('🎮 Electron detected, waiting for AXM.placeLANCard...');
      
      const waitForAXM = () => {
        if (window.AXM && window.AXM.placeLANCard) {
          console.log('✅ AXM.placeLANCard is available, initializing LANGameApp...');
          console.log('✅ Available AXM methods:', Object.keys(window.AXM));
          
          const lanGameApp = new LANGameApp();
          
          // Add resize event listener
          window.addEventListener('resize', () => {
            lanGameApp.handleResize(window.innerWidth, window.innerHeight);
          });
          
        } else {
          console.log('⏳ Waiting for AXM.placeLANCard to be available...');
          console.log('⏳ Current AXM state:', {
            hasAXM: !!window.AXM,
            hasPlaceLANCard: !!(window.AXM && window.AXM.placeLANCard),
            availableMethods: window.AXM ? Object.keys(window.AXM) : []
          });
          setTimeout(waitForAXM, 100);
        }
      };
      
      waitForAXM();
      
    } else {
      // Browser-Client: Start immediately with WebSocket
      console.log('🎮 Browser detected, starting with WebSocket connection...');
      console.log('🎮 No AXM available, using direct WebSocket communication');
      
      const lanGameApp = new LANGameApp();
      
      // Add resize event listener
      window.addEventListener('resize', () => {
        lanGameApp.handleResize(window.innerWidth, window.innerHeight);
      });
    }
    
  } catch (error) {
    console.error('🎮 Failed to initialize LAN game:', error);
  }
});
