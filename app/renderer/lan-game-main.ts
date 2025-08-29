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
  private logoImage: HTMLImageElement | null = null;
  
  // Game state (like Single-Player)
  private playerHand: any[] = [];
  private opponentHand: any[] = [];
  private boardCard: any = null;
  private remainingCards: any[] = [];
  private scale: number = 1;

  constructor() {
    console.log('🎮 LANGameApp constructor called');
    this.init();
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
      card.setTargetPosition(x, y);
    });
    
    console.log('🎮 Opponent hand laid out:', this.opponentHand.length, 'cards');
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
   */
  private setupLANInfoRefresh(): void {
    try {
      // Refresh LAN info every 2 seconds to catch current player changes
      setInterval(() => {
        this.updateLANInfo();
      }, 2000);
      
      console.log('🎮 LAN info refresh interval set up');
    } catch (error) {
      console.error('🎮 Failed to set up LAN info refresh:', error);
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
      
      // Debug logging
      console.log('🎮 updateLANInfo called with:', {
        isServerClient,
        serverPlayerName,
        clientPlayerName,
        currentPlayer,
        localStorageCurrentPlayer: localStorage.getItem('currentPlayer')
      });
      
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
        console.log('🎮 Current player updated in overlay:', currentPlayer);
      }
      
      console.log('🎮 LAN info updated:', { isServerClient, serverPlayerName, clientPlayerName, currentPlayer });
    } catch (error) {
      console.error('🎮 Failed to update LAN info:', error);
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
    console.log('🎮 DOM ready, initializing LANGameApp...');
    const lanGameApp = new LANGameApp();
    
    // Add resize event listener
    window.addEventListener('resize', () => {
      lanGameApp.handleResize(window.innerWidth, window.innerHeight);
    });
    
  } catch (error) {
    console.error('🎮 Failed to initialize LANGameApp:', error);
  }
});
