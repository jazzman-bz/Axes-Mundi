import { LANGameManager } from './lan-game';
import { logger } from '@/utils/logger';
import { GameCard } from './game/Card';
import { soundManager, SoundType } from '@/utils/soundManager';

/**
 * LAN Game Main Application
 * Handles the canvas initialization and card distribution for LAN mode
 * Based on Single-Player AI mechanics
 */
class LANGameApp {
  private lanGame: LANGameManager | null = null;

  private canvas: HTMLCanvasElement | null = null;

  private ctx: CanvasRenderingContext2D | null = null;

  private lastLoggedPlayer: string | null = null;

  private logoImage: HTMLImageElement | null = null;

  // Game state (like Single-Player)
  private playerHand: any[] = [];

  private opponentHand: any[] = [];

  private board: any[] = []; // Alle Karten auf der Achse (inkl. zentrale Karte)

  private graveyard: any[] = []; // Karten, die falsch gelegt wurden

  private remainingCards: any[] = [];

  private gameWon: boolean = false; // Track if game has been won

  private scale: number = 1;

  // Drag & Drop variables
  private isDragging: boolean = false;

  private selectedCard: any = null;

  private snapThreshold: number = 50; // Distance to axis for snapping

  private isPreviewActive: boolean = false; // Track if preview is currently active

  private lastSentCardPlacement: string | null = null; // Prevent duplicate card placement sends

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

      // Initialize LAN game server
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
      // REMOVED: updateLANInfo() here - it overwrites currentPlayer!

      // Initialize game state - both sides start in waiting mode
      this.initializeGameState();

      // REMOVED: updateLANInfo() here - it overwrites currentPlayer!

      // Set up periodic refresh of LAN info to catch current player changes
      this.setupLANInfoRefresh();

      // Set up WebSocket event listeners for real-time updates
      this.setupWebSocketEventListeners();

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
   * Initialize LAN game server
   */
  private async initLANGame(): Promise<void> {
    try {
      console.log('🎮 Initializing LANGameServer...');

      this.lanGame = new LANGameManager();

      // Get isServerClient from localStorage
      const isServerClient = localStorage.getItem('isServerClient') === 'true';

      // For Server-Client (Electron): Set server player name from localStorage
      // Client player name will come via WebSocket from the browser client
      const serverPlayerName = localStorage.getItem('serverPlayerName');

      if (serverPlayerName) {
        // Set server player name immediately
        this.lanGame.setPlayerNames(serverPlayerName, 'Waiting for client...');
        console.log('🎮 Server player name set:', serverPlayerName);

        // Server starts in waiting mode - no current player set yet
        console.log('🎮 Server starts in waiting mode - no current player set yet');

        // Update overlay to show server name and waiting for client
        this.updateLANInfo();
        
        // Initialize current player display
        this.updateCurrentPlayerDisplay();
      } else {
        console.warn('🎮 No server player name found in localStorage, using default');
        const defaultServerName = 'Server';
        this.lanGame.setPlayerNames(defaultServerName, 'Waiting for client...');
        localStorage.setItem('serverPlayerName', defaultServerName);
        // Default server starts in waiting mode - no current player set yet
        console.log('🎮 Default server starts in waiting mode - no current player set yet');
        this.updateLANInfo();
        
        // Initialize current player display
        this.updateCurrentPlayerDisplay();
      }

      // For Client: Start in waiting mode - no current player loaded
      if (!isServerClient) {
        console.log('🎮 Client: Starting in waiting mode - no current player loaded yet');
      }

      // Note: Client player name will be set when received via WebSocket
      // This happens in the WebSocket event handlers

      // Initialize LAN game (this prepares card distribution but doesn't send it)
      await this.lanGame.initializeLANGame();

      // For Browser-Client: Ensure WebSocket client is initialized and set up message handling
      if (!isServerClient) {
        console.log('🎮 Browser-Client: Ensuring WebSocket client is initialized');
        // The LANGameManager should have already initialized the WebSocket client
        // But let's verify it's working
        if (this.lanGame.lanClient) {
          console.log('🎮 Browser-Client: WebSocket client is available');
          console.log('🎮 Browser-Client: WebSocket connection state:', this.lanGame.lanClient.isConnected());

          // Set up message callback to receive WebSocket messages
          this.lanGame.onMessage((message: any) => {
            console.log('🎮 Browser-Client: Received message from LANGameManager:', message.type);
            this.handleWebSocketMessageFromLANGame(message);
          });
          console.log('🎮 Browser-Client: Message callback set up successfully');
        } else {
          console.warn('🎮 Browser-Client: WebSocket client is not available');
        }
      }

      console.log('🎮 LANGameServer initialized successfully');
    } catch (error) {
      console.error('🎮 Failed to initialize LANGameServer:', error);
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
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Position board card at center
          if (this.board.length > 0) {
            this.layoutAxisCards(); // Alle Karten auf der Achse positionieren
          }

          // Then: send card distribution to client
          console.log('🎮 Sending card distribution to client...');
          this.lanGame.sendCardDistributionAfterCanvasInit();

          // Update LAN info to show current player
          this.updateLANInfo();

          // Start game AFTER client connects (not immediately)
          console.log('🎮 Card distribution ready - waiting for client to connect before starting game...');

          this.updateLANStatus('Kartenverteilung an Client gesendet!');
          console.log('🎮 Card distribution sent to client successfully');
        }
      }
    } catch (error: any) {
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
        cardCount: deck.cards.length,
      });

      // Store remaining cards for deck visualization
      // IMPORTANT: Use the deckOrder from the distribution, not the full deck
      // This ensures both players have the same remaining cards
      if (distribution.deckOrder && distribution.deckOrder.length > 0) {
        // Use the deckOrder from server (correct remaining cards)
        this.remainingCards = distribution.deckOrder.map((cardRef: any) => 
          deck.cards.find((card: any) => card.id === cardRef.id)
        ).filter((card: any) => card !== undefined);
        console.log('🎮 Server: Using deckOrder from distribution for remainingCards:', this.remainingCards.length);
      } else {
        // Fallback: use full deck (should not happen)
        this.remainingCards = [...deck.cards];
        console.warn('🎮 Server: No deckOrder found, using full deck as fallback');
      }

      // Create board card (zentrale Karte)
      if (distribution.boardCard) {
        // Find the actual card data by ID
        const boardCardData = deck.cards.find((card) => card.id === distribution.boardCard.id);
        if (boardCardData) {
          console.log('🎮 Creating central board card with data:', boardCardData);
          const centralCard = new GameCard(
            boardCardData,
            deck,
            50 * this.scale, // Start at deck position
            this.canvas!.height - 320 * this.scale, // Deck Y position
            this.scale,
          );
          // Board card is on axis, not in hand - so show the measurement value
          centralCard.isInHand = false;
          this.board.push(centralCard); // Erste Karte im Board-Array
          console.log('🎮 Central board card created:', boardCardData.title);
          console.log('🎮 Central board card object:', centralCard);
          console.log('🎮 Central board card isInHand set to false for measurement display');
        } else {
          console.error('🎮 Board card data not found for ID:', distribution.boardCard.id);
        }
      } else {
        console.log('🎮 No board card in distribution');
      }

      // Create board card first with sound
      if (distribution.boardCard) {
        soundManager.play(SoundType.CARD_SHUFFLE);
      }

      // Create player hand cards with animation delays and synchronized sounds
      if (distribution.serverHand && distribution.serverHand.length > 0) {
        console.log('🎮 Creating', distribution.serverHand.length, 'player hand cards');
        console.log('🎮 Server hand data:', distribution.serverHand);
        for (let i = 0; i < distribution.serverHand.length; i++) {
          setTimeout(() => {
            soundManager.play(SoundType.CARD_SHUFFLE); // Play sound exactly when card appears
            this.dealCardToPlayer(distribution.serverHand[i], deck);
          }, i * 200); // 200ms delay between each card
        }
      } else {
        console.log('🎮 No server hand cards in distribution');
      }

      // Create opponent hand cards with animation delays and synchronized sounds
      if (distribution.clientHand && distribution.clientHand.length > 0) {
        console.log('🎮 Creating', distribution.clientHand.length, 'opponent hand cards');
        console.log('🎮 Client hand data:', distribution.clientHand);
        for (let i = 0; i < distribution.clientHand.length; i++) {
          setTimeout(() => {
            soundManager.play(SoundType.CARD_SHUFFLE); // Play sound exactly when card appears
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
    const actualCardData = deck.cards.find((card) => card.id === cardData.id);
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
      this.scale,
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
    const actualCardData = deck.cards.find((card) => card.id === cardData.id);
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
      this.scale,
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
    const actualCardData = deck.cards.find((card) => card.id === cardData.id);
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
      this.scale,
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
    const actualCardData = deck.cards.find((card) => card.id === cardData.id);
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
      this.scale,
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
   * Update all cards (animate to target positions)
   */
  private updateCards(): void {
    // Update all board cards (inkl. zentrale Karte)
    this.board.forEach((card) => {
      card.tick();
    });

    // Update player hand cards
    this.playerHand.forEach((card) => {
      card.tick();
    });

    // Update opponent hand cards
    this.opponentHand.forEach((card) => {
      card.tick();
    });

    // Update graveyard cards
    this.graveyard.forEach((card) => {
      card.tick();
    });
  }

  /**
   * Draw all cards (like Single-Player)
   */
  private drawCards(): void {
    // Draw all board cards with front side (inkl. zentrale Karte)
    this.board.forEach((card) => {
      card.showCardBack = false; // ← Vorderseite zeigen
      card.render(this.ctx!);
    });

    // Draw player hand
    this.playerHand.forEach((card) => {
      card.render(this.ctx!);
    });

    // Draw opponent hand (with card backs)
    this.opponentHand.forEach((card) => {
      if (card.showCardBack) {
        this.drawOpponentCardBack(this.ctx!, card);
      } else {
        card.render(this.ctx!);
      }
    });

    // Draw graveyard cards
    this.graveyard.forEach((card) => {
      card.render(this.ctx!);
    });

    // Draw debug information
    this.drawDebugInfo();
  }

  /**
   * Draw opponent card back (Axes Mundi logo)
   */
  private drawOpponentCardBack(ctx: CanvasRenderingContext2D, card: any): void {
    // Save context
    ctx.save();

    // Set position and size
    const { x } = card;
    const { y } = card;
    const { width } = card;
    const { height } = card;

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
   * Draw debug information on canvas
   */
  private drawDebugInfo(): void {
    if (!this.ctx || !this.canvas) return;

    // Get current player info
    const isServerClient = localStorage.getItem('isServerClient') === 'true';
    const serverPlayerName = localStorage.getItem('serverPlayerName') || 'Unknown';
    const clientPlayerName = localStorage.getItem('clientPlayerName') || 'Unknown';
    const currentPlayer = localStorage.getItem('currentPlayer') || 'Unknown';

    // Save context
    this.ctx.save();

    // Set text style
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = `${16 * this.scale}px Arial`;
    this.ctx.textAlign = 'left';
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 2;

    // Draw debug info box - positioned below other overlays
    const debugX = 10 * this.scale;
    const debugY = 150 * this.scale; // Moved down from 10 to 150
    const debugWidth = 300 * this.scale;
    const debugHeight = 160 * this.scale; // Increased height for graveyard line

    // Background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.roundRect(this.ctx, debugX, debugY, debugWidth, debugHeight, 8);
    this.ctx.fill();

    // Border
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Debug text
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = `${14 * this.scale}px Arial`;
    this.ctx.textAlign = 'left';

    let yOffset = debugY + 25 * this.scale;
    this.ctx.fillText(`🎮 Who am I: ${isServerClient ? 'SERVER-CLIENT' : 'BROWSER-CLIENT'}`, debugX + 10, yOffset);

    yOffset += 20 * this.scale;
    this.ctx.fillText(`👤 My name: ${isServerClient ? serverPlayerName : clientPlayerName}`, debugX + 10, yOffset);

    yOffset += 20 * this.scale;
    this.ctx.fillText(`🏆 Current player: ${currentPlayer}`, debugX + 10, yOffset);

    yOffset += 20 * this.scale;
    this.ctx.fillText(`🃏 Hands: Server(${this.playerHand.length}) Client(${this.opponentHand.length})`, debugX + 10, yOffset);

    yOffset += 20 * this.scale;
    this.ctx.fillText(`📍 Board: ${this.board.length} cards (central: ${this.board.length > 0 ? 'yes' : 'no'})`, debugX + 10, yOffset);

    yOffset += 20 * this.scale;
    this.ctx.fillText(`⚰️ Graveyard: ${this.graveyard.length} cards`, debugX + 10, yOffset);

    yOffset += 20 * this.scale;

    // Waiting for (what this client is expecting)
    let waitingFor = 'nothing';
    if (isServerClient) {
      // Server-client perspective
      if (currentPlayer === serverPlayerName) {
        waitingFor = 'me to place card (browser-client will respond)';
      } else {
        waitingFor = 'browser-client to place card';
      }
    } else {
      // Browser-client perspective
      if (currentPlayer === clientPlayerName) {
        waitingFor = 'me to place card (server-client will respond)';
      } else {
        waitingFor = 'server-client to place card';
      }
    }
    this.ctx.fillText(`⏳ Waiting for: ${waitingFor}`, debugX + 10, yOffset);

    // Restore context
    this.ctx.restore();
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
        // IMPORTANT: Use the deckOrder from the distribution, not the full deck
        // This ensures both players have the same remaining cards
        if (distribution.deckOrder && distribution.deckOrder.length > 0) {
          // Use the deckOrder from server (correct remaining cards)
          this.remainingCards = distribution.deckOrder.map((cardRef: any) => 
            deck.cards.find((card: any) => card.id === cardRef.id)
          ).filter((card: any) => card !== undefined);
          console.log('🎮 Client: Using deckOrder from server for remainingCards:', this.remainingCards.length);
        } else {
          // Fallback: use full deck and remove distributed cards
          this.remainingCards = [...deck.cards];
          
          // Remove board card if it exists
          if (distribution.boardCard) {
            this.remainingCards = this.remainingCards.filter(card => card.id !== distribution.boardCard.id);
            console.log('🎮 Client: Removed board card from remainingCards:', distribution.boardCard.id);
          }
          
          // Remove server hand cards
          if (distribution.serverHand && distribution.serverHand.length > 0) {
            const serverHandIds = distribution.serverHand.map((cardRef: any) => cardRef.id);
            this.remainingCards = this.remainingCards.filter(card => !serverHandIds.includes(card.id));
            console.log('🎮 Client: Removed server hand cards from remainingCards:', serverHandIds);
          }
          
          // Remove client hand cards
          if (distribution.clientHand && distribution.clientHand.length > 0) {
            const clientHandIds = distribution.clientHand.map((cardRef: any) => cardRef.id);
            this.remainingCards = this.remainingCards.filter(card => !clientHandIds.includes(card.id));
            console.log('🎮 Client: Removed client hand cards from remainingCards:', clientHandIds);
          }
          
          console.log('🎮 Client: Fallback - remainingCards after removing distributed cards:', this.remainingCards.length);
        }

        // CLIENT PERSPECTIVE:
        // - Client sees their own hand (clientHand) at the bottom
        // - Client sees server's hand (serverHand) at the top (card backs)
        // - Board card is in the center

        // Create board card (zentrale Karte)
        if (distribution.boardCard) {
          const boardCardData = deck.cards.find((card) => card.id === distribution.boardCard.id);
          if (boardCardData) {
            console.log('🎮 Client: Creating central board card:', boardCardData.title);
            const centralCard = new GameCard(
              boardCardData,
              deck,
              50 * this.scale,
              this.canvas!.height - 320 * this.scale,
              this.scale,
            );
            // Board card is on axis, not in hand - so show the measurement value
            centralCard.isInHand = false;
            this.board.push(centralCard); // Erste Karte im Board-Array
            console.log('🎮 Client: Central board card created with measurement display');
          }
        }

        // Create board card first with sound
        if (distribution.boardCard) {
          soundManager.play(SoundType.CARD_SHUFFLE);
        }

        // Create CLIENT hand cards (bottom) - these are the client's own cards
        if (distribution.clientHand && distribution.clientHand.length > 0) {
          console.log('🎮 Client: Creating', distribution.clientHand.length, 'client hand cards (bottom)');
          for (let i = 0; i < distribution.clientHand.length; i++) {
            setTimeout(() => {
              soundManager.play(SoundType.CARD_SHUFFLE); // Play sound exactly when card appears
              this.dealCardToClient(distribution.clientHand[i], deck);
            }, i * 200);
          }
        }

        // Create SERVER hand cards (top) - show as card backs
        if (distribution.serverHand && distribution.serverHand.length > 0) {
          console.log('🎮 Client: Creating', distribution.serverHand.length, 'server hand cards (top, card backs)');
          for (let i = 0; i < distribution.serverHand.length; i++) {
            setTimeout(() => {
              soundManager.play(SoundType.CARD_SHUFFLE); // Play sound exactly when card appears
              this.dealCardToServer(distribution.serverHand[i], deck);
            }, 1200 + i * 200);
          }
        }

        // Position board card at center
        setTimeout(() => {
          if (this.board.length > 0) {
            this.layoutAxisCards(); // Alle Karten auf der Achse positionieren
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
        meta: { width, height, scale: this.scale },
      });
    } catch (error) {
      logger.error({
        scope: 'renderer/lan-game',
        msg: 'resize failed',
        err: { message: error.message, stack: error.stack },
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
   * Re-center the entire board after layout changes
   * This ensures all cards are properly positioned relative to the center
   */
  private recenterBoard(): void {
    try {
      if (this.board.length === 0) return;

      console.log('🎮 Recentering board with', this.board.length, 'cards');

      // Get the current board state
      const allPlacedCards = this.getAllPlacedCardsInOrder();

      // Calculate the total width needed for all cards
      const cardWidth = 200 * this.scale;
      const cardSpacing = 20 * this.scale;
      const totalWidth = allPlacedCards.length * cardWidth + (allPlacedCards.length - 1) * cardSpacing;

      // Calculate the starting X position to center the entire board
      const startX = (this.canvas!.width - totalWidth) / 2;
      const centerY = this.canvas!.height / 2 - cardWidth / 2;

      // Position each card with proper spacing
      allPlacedCards.forEach((card, index) => {
        const targetX = startX + index * (cardWidth + cardSpacing);
        card.setTargetPosition(targetX, centerY);

        console.log('🎮 Recentered card:', {
          index,
          title: card.card.title,
          targetX,
          centerY,
        });
      });

      // Update the board array to match the new order
      this.board = [...allPlacedCards];

      console.log('🎮 Board recentering completed');
    } catch (error) {
      console.error('🎮 Failed to recenter board:', error);
    }
  }


  /**
   * Layout all cards on the axis - center them with proper spacing (like Single-Player)
   */
  private layoutAxisCards(): void {
    if (this.board.length === 0) return;

    const cardWidth = 200 * this.scale;
    const cardHeight = 300 * this.scale;
    const cardSpacing = 20 * this.scale; // Use same spacing as recenterBoard
    const axisY = this.canvas!.height / 2;

    // Calculate the total width needed for all cards
    const totalWidth = this.board.length * cardWidth + (this.board.length - 1) * cardSpacing;

    // Calculate the starting X position to center the entire board
    const startX = (this.canvas!.width - totalWidth) / 2;
    const centerY = axisY - cardHeight / 2;

    console.log('🎮 layoutAxisCards - Starting layout:', {
      totalCards: this.board.length,
      totalWidth,
      startX,
      centerY,
      cardSpacing,
    });

    // Layout all cards sequentially based on their array index (sorted order)
    this.board.forEach((card, index) => {
      const targetX = startX + index * (cardWidth + cardSpacing);
      const targetY = centerY;

      console.log('🎮 layoutAxisCards - Card positioned:', {
        cardTitle: card.card.title,
        index,
        targetX,
        targetY,
      });

      card.setTargetPosition(targetX, targetY);
    });

    console.log('🎮 Axis cards laid out:', this.board.length, 'cards with', cardSpacing, 'px spacing');
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

      // DISABLED: currentPlayer check before card distribution
      // const currentTurnElement = document.getElementById('current-turn');
      // if (currentTurnElement && !localStorage.getItem('currentPlayer')) {
      //   currentTurnElement.textContent = 'Warte auf Spielstart...';
      // }
    } catch (error) {
      console.error('🎮 Failed to update LAN status:', error);
    }
  }

  /**
   * Initialize game state - both sides start in waiting mode
   */
  public initializeGameState(): void {
    try {
      console.log('🎮 Initializing game state - both sides start in waiting mode');

      // Both sides start in waiting mode - no current player set
      // Server will determine current player after everything is ready
      // REMOVED: updateLANInfo() here - it overwrites currentPlayer!
    } catch (error) {
      console.error('🎮 Failed to initialize game state:', error);
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
      console.log('🎮 Checking AXM availability:', {
        hasAXM: !!window.AXM,
        hasOn: !!(window.AXM && window.AXM.on),
        availableMethods: window.AXM ? Object.keys(window.AXM) : 'none',
      });

      if (window.AXM && window.AXM.on) {
        // Listen for LAN status updates from main process
        console.log('🎮 Setting up IPC listener for lan-status-update channel');
        window.AXM.on('lan-status-update', (data: any) => {
          console.log('🎮 IPC: Received lan-status-update from main process:', data.type);
          console.log('🎮 IPC: Full data received:', data);
          console.log('🎮 IPC: Data details:', {
            type: data.type,
            cardId: data.cardId,
            boardPosition: data.boardPosition,
            playerName: data.playerName,
          });
          this.handleLANStatusUpdate(data);
        });
        console.log('🎮 IPC listener for lan-status-update channel set up successfully');

        // Listen for client player joined events from main process
        window.AXM.on('client-player-joined', (data: any) => {
          this.handleClientPlayerJoined(data);
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
      console.log('🎮 IPC Handler: Processing LAN status update:', data.type);
      console.log('🎮 IPC Handler: Full data:', data);

      switch (data.type) {
        case 'cardPlacement':
          this.handleRemoteCardPlacement(data);
          break;
        case 'playerSwitch':
          this.handleRemotePlayerSwitch(data);
          break;
        case 'gameRestart':
          this.handleRemoteGameRestart(data);
          break;
        case 'remainingCardsUpdate':
          this.handleRemoteRemainingCardsUpdate(data);
          break;
        case 'gameStateUpdate':
          this.handleGameStateUpdate(data);
          break;
        case 'currentPlayerSet':
          // NOW ACTIVE: currentPlayer logic after card distribution
          console.log('🎮 Received currentPlayerSet - updating current player');
          this.updateCurrentPlayerFromServer(data.currentPlayer);
          break;
        case 'playerTurnChanged':
          // NOW ACTIVE: player turn change logic after card distribution
          console.log('🎮 Received playerTurnChanged - updating turn');
          this.handlePlayerTurnChange(data.currentPlayer);
          break;
        default:
          console.log('🎮 Unknown LAN status update type:', data.type);
      }
    } catch (error) {
      logger.error({
        scope: 'renderer/lan-game',
        msg: 'failed to handle LAN status update',
        err: { message: error.message, stack: error.stack },
      });
    }
  }

  /**
   * Handle WebSocket messages from LANGameManager (Browser-Client only)
   */
  private handleWebSocketMessageFromLANGame(message: any): void {
    try {
      console.log('🎮 Browser-Client: Processing WebSocket message from LANGameManager:', message.type);

      switch (message.type) {
        case 'cardPlacement':
          console.log('🎮 Browser-Client: Processing cardPlacement from WebSocket');
          this.handleRemoteCardPlacement(message);
          break;
        case 'gameStateUpdate':
          console.log('🎮 Browser-Client: Processing gameStateUpdate from WebSocket');
          this.handleGameStateUpdate(message);
          break;
        case 'currentPlayerSet':
          console.log('🎮 Browser-Client: Processing currentPlayerSet from WebSocket');
          this.updateCurrentPlayerFromServer(message.currentPlayer);
          break;
        default:
          console.log('🎮 Browser-Client: Unknown message type from WebSocket:', message.type);
      }
    } catch (error) {
      console.error('🎮 Browser-Client: Failed to handle WebSocket message:', error);
    }
  }

  /**
   * Handle client player joined event from main process
   * This is called when a browser client connects via WebSocket
   */
  private handleClientPlayerJoined(data: any): void {
    try {
      console.log('🎮 Received client player joined event:', data);

      const { clientPlayerName } = data;

      if (clientPlayerName) {
        // Update the client player name in the LAN game
        this.updateClientPlayerName(clientPlayerName);

        console.log('🎮 Client player name updated successfully:', clientPlayerName);
      } else {
        console.warn('🎮 No client player name in data:', data);
      }

      // Both sides start in waiting mode - no current player set yet
      console.log('🎮 Client joined - both sides now in waiting mode for game start');

      // Update UI to show waiting status
      this.updateLANStatus('Client verbunden. Warte auf Spielstart...');

      // NOW: Start the game after client is connected!
      console.log('🎮 Client connected - now starting game with random player');
      this.startGameAfterCardDistribution();
    } catch (error) {
      console.error('🎮 Failed to handle client player joined event:', error);
    }
  }

  /**
   * Handle remote player switch from WebSocket
   * This method is called when the other player switches turns
   */
  private handleRemotePlayerSwitch(data: any): void {
    try {
      console.log('🎮 Handling remote player switch:', data);
      
      const nextPlayer = data.nextPlayer;
      if (!nextPlayer) {
        console.error('🎮 Invalid player switch data - missing nextPlayer');
        return;
      }
      
      // Update current player in localStorage
      localStorage.setItem('currentPlayer', nextPlayer);
      
      // Update UI to reflect the new current player
      this.updateCurrentPlayerDisplay();
      
      console.log('🎮 Remote player switch completed. New current player:', nextPlayer);
      
    } catch (error) {
      console.error('🎮 Failed to handle remote player switch:', error);
    }
  }

  /**
   * Handle remote game restart from WebSocket
   * This method is called when the other player requests a game restart
   */
  private handleRemoteGameRestart(data: any): void {
    try {
      console.log('🎮 Handling remote game restart:', data);
      
      const playerName = data.playerName;
      if (!playerName) {
        console.error('🎮 Invalid game restart data - missing playerName');
        return;
      }
      
      console.log('🎮 Remote game restart requested by:', playerName);
      
      // Restart the game on this client as well
      this.restartLANGame();
      
      console.log('🎮 Remote game restart completed');
      
    } catch (error) {
      console.error('🎮 Failed to handle remote game restart:', error);
    }
  }

  /**
   * Handle remote remaining cards update from WebSocket
   * This method synchronizes the remaining cards count between players
   */
  private handleRemoteRemainingCardsUpdate(data: any): void {
    try {
      console.log('🎮 Handling remote remaining cards update:', data);
      
      const remainingCardsCount = data.remainingCardsCount;
      const playerName = data.playerName;
      
      if (typeof remainingCardsCount !== 'number') {
        console.error('🎮 Invalid remaining cards update data - missing or invalid remainingCardsCount');
        return;
      }
      
      console.log('🎮 Remote remaining cards update from:', playerName, 'count:', remainingCardsCount);
      
      // Update local remaining cards array to match the remote count
      // This ensures both players have the same remaining cards count
      if (this.remainingCards.length !== remainingCardsCount) {
        console.log('🎮 Synchronizing remaining cards:', {
          localCount: this.remainingCards.length,
          remoteCount: remainingCardsCount,
          difference: this.remainingCards.length - remainingCardsCount
        });
        
        // Adjust local remaining cards array to match remote count
        if (this.remainingCards.length > remainingCardsCount) {
          // Remove excess cards from the end
          this.remainingCards = this.remainingCards.slice(0, remainingCardsCount);
        } else if (this.remainingCards.length < remainingCardsCount) {
          // This shouldn't happen, but log it
          console.warn('🎮 Local remaining cards count is less than remote count - this is unexpected');
        }
        
        console.log('🎮 Remaining cards synchronized:', {
          newLocalCount: this.remainingCards.length,
          remoteCount: remainingCardsCount
        });
      }
      
    } catch (error) {
      console.error('🎮 Failed to handle remote remaining cards update:', error);
    }
  }

  /**
   * Handle remote card placement from WebSocket
   */
  private handleRemoteCardPlacement(data: any): void {
    try {
      console.log('🎮 Handling remote card placement:', data);
      console.log('🎮 Remote card placement details:', {
        cardId: data.cardId,
        boardPosition: data.boardPosition,
        playerName: data.playerName,
        type: data.type,
      });

      const { cardId, boardPosition, playerName } = data;

      // boardPosition ist jetzt ein absoluter Index (0 = erste Position, 1 = zweite Position, etc.)
      console.log('🎮 Received board position:', boardPosition);

      // Find the card in the appropriate hand based on playerName
      let card = null;
      const isServerClient = localStorage.getItem('isServerClient') === 'true';
      const serverPlayerName = localStorage.getItem('serverPlayerName');

      // IMPORTANT: Server-Client should ignore cardPlacement messages for cards it placed itself
      if (isServerClient && playerName === serverPlayerName) {
        console.log('🎮 Server-Client: Ignoring own card placement message:', { cardId, playerName });
        return; // Exit early - don't process own placement
      }

      // Find the card in the appropriate hand
      // First, let's debug what we have in our hands
      console.log('🎮 Debug: Looking for card in hands:', {
        cardId,
        playerName,
        isServerClient,
        serverPlayerName,
        playerHandCards: this.playerHand.map(c => c.card.id),
        opponentHandCards: this.opponentHand.map(c => c.card.id)
      });

      if (isServerClient) {
        // Server-Client: playerHand = server cards, opponentHand = client cards
        if (playerName === serverPlayerName) {
          // Card was placed by server - find in server's hand
          card = this.playerHand.find((c) => c.card.id === cardId);
        } else {
          // Card was placed by client - find in client's hand
          card = this.opponentHand.find((c) => c.card.id === cardId);
        }
      } else {
        // Browser-Client: playerHand = client cards, opponentHand = server cards
        if (playerName === serverPlayerName) {
          // Card was placed by server - find in server's hand
          card = this.opponentHand.find((c) => c.card.id === cardId);
        } else {
          // Card was placed by client - find in client's hand
          card = this.playerHand.find((c) => c.card.id === cardId);
        }
      }

      // The card should ALWAYS be found in the appropriate hand
      if (!card) {
        console.error('🎮 CRITICAL: Card not found in any hand for remote placement:', {
          cardId,
          playerName,
          isServerClient,
          serverPlayerName,
          playerHandCount: this.playerHand.length,
          opponentHandCount: this.opponentHand.length,
        });
        return; // Exit early - cannot process placement
      }

      console.log('🎮 Card found for remote placement:', {
        cardId,
        cardTitle: card.card.title,
        playerName,
        isServerClient,
        serverPlayerName,
      });

      // Remove the card from the appropriate hand based on perspective
      if (isServerClient) {
        // Server-Client perspective: playerHand = server cards, opponentHand = client cards
        if (playerName === serverPlayerName) {
          // Card was placed by server - remove from server's hand
          this.playerHand = this.playerHand.filter((c) => c !== card);
        } else {
          // Card was placed by client - remove from client's hand
          this.opponentHand = this.opponentHand.filter((c) => c !== card);
        }
      } else {
        // Browser-Client perspective: playerHand = client cards, opponentHand = server cards
        if (playerName === serverPlayerName) {
          // Card was placed by server - remove from server's hand
          this.opponentHand = this.opponentHand.filter((c) => c !== card);
        } else {
          // Card was placed by client - remove from client's hand
          this.playerHand = this.playerHand.filter((c) => c !== card);
        }
      }

      // Set card as placed (not in hand) and show front side
      card.isInHand = false;
      card.showCardBack = false; // ← WICHTIG: Vorderseite zeigen

      console.log('🎮 Card prepared for placement:', {
        cardId: card.card.id,
        cardTitle: card.card.title,
        isInHand: card.isInHand,
        showCardBack: card.showCardBack,
      });

      // Log board state BEFORE adding remote card
      console.log('🎮 === BEFORE REMOTE CARD PLACEMENT ===');

      // Add to board array at the CORRECT position based on received boardPosition
      // This ensures the passive player maintains the same sorted array order as the active player
      console.log('🎮 DEBUG: About to insert card at position:', {
        boardPosition,
        currentBoardLength: this.board.length,
        cardId: card.card.id,
        cardTitle: card.card.title,
      });

      if (boardPosition >= this.board.length) {
        // If position is at or beyond the end, push to end
        this.board.push(card);
        console.log('🎮 Card added to end of board array:', { cardId: card.card.id, boardPosition, arraySize: this.board.length });
      } else {
        // Insert at the specific position to maintain sorted order
        this.board.splice(boardPosition, 0, card);
        console.log('🎮 Card inserted at board position', boardPosition, ':', { cardId: card.card.id, arraySize: this.board.length });
      }

      // Log board state AFTER adding remote card
      console.log('🎮 === AFTER REMOTE CARD ADDED ===');

      // Calculate target coordinates based on board position (AFTER adding to array)
      const targetCoords = this.calculateTargetCoordinates(boardPosition);
      console.log('🎮 Calculated target coordinates for remote placement:', targetCoords);

      // Re-layout hands first (don't affect board cards)
      this.layoutHand();
      this.layoutOpponentHand();

      // IMPORTANT: Layout all cards on the axis with proper spacing
      // This will position the new card at the correct location
      this.layoutAxisCards();

      // VALIDATION: Check if the remote card was placed correctly AFTER animations complete
      // Wait for animations to finish before validating
      setTimeout(() => {
        this.validateCardPlacement(card);
      }, 1500); // Wait 1.5 seconds for animations to complete

      console.log('🎮 Remote card placement completed:', {
        cardId,
        boardPosition,
        targetCoords,
        playerName,
        boardCount: this.board.length,
      });
    } catch (error: any) {
      logger.error({
        scope: 'renderer/lan-game',
        msg: 'failed to handle remote card placement',
        err: { message: error.message, stack: error.stack },
      });
    }
  }

  /**
   * Update current player from server via WebSocket
   */
  public updateCurrentPlayerFromServer(newCurrentPlayer: string): void {
    try {
      console.log('🎮 Updating current player from server:', newCurrentPlayer);

      // Store current player locally
      localStorage.setItem('currentPlayer', newCurrentPlayer);

      // Update ONLY the current player UI (no full LAN update)
      this.updateCurrentPlayerUI(newCurrentPlayer);

      // Update status
      this.updateLANStatus(`Spiel gestartet! ${newCurrentPlayer} beginnt.`);
    } catch (error) {
      console.error('🎮 Failed to update current player from server:', error);
    }
  }

  /**
   * Update client player name when received via WebSocket
   * This is called from the main process when the browser client connects
   */
  public updateClientPlayerName(clientPlayerName: string): void {
    try {
      console.log('🎮 Updating client player name via WebSocket:', clientPlayerName);

      if (this.lanGame) {
        this.lanGame.updateClientPlayerName(clientPlayerName);

        // Update overlay to show the real client name
        // Always update LAN info to show the correct client name
        this.updateLANInfo();

        console.log('🎮 Client player name updated successfully');
      } else {
        console.warn('🎮 LANGame not initialized, cannot update client player name');
      }
    } catch (error: any) {
      console.error('🎮 Failed to update client player name:', error);
    }
  }

  /**
   * Start the game by setting current player and distributing cards
   * This method is called by the server-client after cards are distributed
   */
  public async startGameAfterCardDistribution(): Promise<void> {
    try {
      console.log('🎮 Starting game after card distribution...');

      // Cards are already distributed, now start game with random player
      await this.startGameWithRandomPlayer();
    } catch (error) {
      console.error('🎮 Failed to start game after card distribution:', error);
    }
  }

  /**
   * Handle player turn change from server
   */
  private handlePlayerTurnChange(newCurrentPlayer: string): void {
    try {
      console.log('🎮 Handling player turn change to:', newCurrentPlayer);

      // Update current player and UI
      this.updateCurrentPlayerFromServer(newCurrentPlayer);

      // Update status
      this.updateLANStatus(`${newCurrentPlayer} ist am Zug!`);
    } catch (error) {
      console.error('🎮 Failed to handle player turn change:', error);
    }
  }

  /**
   * Set current player randomly and send to client via WebSocket
   * This method is called by the server-client to start the game
   * DISABLED: currentPlayer logic before card distribution
   */
  public setCurrentPlayerAndStartGame(): void {
    try {
      console.log('🎮 DISABLED: setCurrentPlayerAndStartGame called - waiting for card distribution');
    } catch (error) {
      console.error('🎮 Failed to set current player and start game:', error);
    }
  }

  /**
   * Start game with random player after cards are distributed
   * This method is called AFTER cards are distributed - NO LAN UPDATE CONFLICTS
   */
  public async startGameWithRandomPlayer(): Promise<void> {
    try {
      console.log('🎮 Starting game with random player AFTER card distribution...');

      const serverPlayerName = localStorage.getItem('serverPlayerName');
      const clientPlayerName = localStorage.getItem('clientPlayerName');

      if (!serverPlayerName || !clientPlayerName) {
        console.warn('🎮 Cannot start game: missing player names');
        return;
      }

      // Randomly choose who starts (50/50 chance)
      const randomStart = Math.random() < 0.5;
      const currentPlayer = randomStart ? serverPlayerName : clientPlayerName;

      console.log('🎮 Randomly selected current player:', currentPlayer, 'randomStart:', randomStart);

      // Store current player locally
      localStorage.setItem('currentPlayer', currentPlayer);

      // Update ONLY the current player UI elements (no full LAN update)
      this.updateCurrentPlayerUI(currentPlayer);
      
      // Also update the current player display
      this.updateCurrentPlayerDisplay();

      // Send current player to client via WebSocket
      console.log('🎮 About to send current player to client:', currentPlayer);
      console.log('🎮 window.AXM available:', !!window.AXM);
      console.log('🎮 window.AXM.sendCurrentPlayerUpdate available:', !!(window.AXM && window.AXM.sendCurrentPlayerUpdate));

      if (window.AXM && window.AXM.sendCurrentPlayerUpdate) {
        console.log('🎮 Sending current player to client via WebSocket:', currentPlayer);
        try {
          const result = await window.AXM.sendCurrentPlayerUpdate(currentPlayer);
          console.log('🎮 IPC result:', result);

          if (result.success) {
            console.log('🎮 Current player sent to client successfully:', currentPlayer);
            this.updateLANStatus(`Spiel gestartet! ${currentPlayer} beginnt.`);
          } else {
            console.warn('🎮 Failed to send current player to client:', (result as any).error);
          }
        } catch (error: any) {
          console.error('🎮 Error sending current player to client:', error);
        }
      } else {
        console.warn('🎮 AXM.sendCurrentPlayerUpdate not available');
        console.log('🎮 Available AXM methods:', Object.keys(window.AXM || {}));
      }

      console.log('🎮 Game started successfully with current player:', currentPlayer);
    } catch (error) {
      console.error('🎮 Failed to start game with random player:', error);
    }
  }

  /**
   * Update ONLY the current player UI elements (no full LAN update)
   * This method updates the UI to show who's turn it is
   */
  private updateCurrentPlayerUI(currentPlayer: string): void {
    try {
      const isServerClient = localStorage.getItem('isServerClient') === 'true';
      const serverPlayerName = localStorage.getItem('serverPlayerName');
      const clientPlayerName = localStorage.getItem('clientPlayerName');

      if (!serverPlayerName || !clientPlayerName) {
        console.warn('🎮 Cannot update current player UI: missing player names');
        return;
      }

      // Get UI elements
      const playerNameElement = document.getElementById('playerName');
      const opponentNameElement = document.getElementById('opponentName');
      const currentTurnElement = document.getElementById('currentTurn');

      console.log('🎮 UI Elements found:', {
        playerNameElement: !!playerNameElement,
        opponentNameElement: !!opponentNameElement,
        currentTurnElement: !!currentTurnElement,
      });

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

      console.log('🎮 Current player UI updated:', currentPlayer);
    } catch (error) {
      console.error('🎮 Failed to update current player UI:', error);
    }
  }

  /**
   * Update LAN info display with player names and current player
   */
  private updateLANInfo(): void {
    try {
      const isServerClient = localStorage.getItem('isServerClient') === 'true';
      let serverPlayerName = localStorage.getItem('serverPlayerName');
      let clientPlayerName = localStorage.getItem('clientPlayerName');
      // DISABLED: currentPlayer logic before card distribution
      // const currentPlayer = localStorage.getItem('currentPlayer');

      // If names are not in localStorage, try to get them from LANGameServer
      if (!serverPlayerName || !clientPlayerName) {
        if (this.lanGame) {
          // Try to get names from LANGameServer instance
          serverPlayerName = this.lanGame.getServerPlayerName() || 'Server';
          clientPlayerName = this.lanGame.getClientPlayerName() || 'Waiting for client...';

          // Store them in localStorage for future use
          if (serverPlayerName && serverPlayerName !== 'Server') {
            localStorage.setItem('serverPlayerName', serverPlayerName);
          }
          if (clientPlayerName && clientPlayerName !== 'Waiting for client...') {
            localStorage.setItem('clientPlayerName', clientPlayerName);
          }

          console.log('🎮 Loaded names from LANGameServer:', { serverPlayerName, clientPlayerName });
        } else {
          // Fallback to localStorage defaults
          serverPlayerName = serverPlayerName || 'Server';
          clientPlayerName = clientPlayerName || 'Waiting for client...';
        }
      }

      // Log when names are loaded
      console.log('🎮 Updating LAN info with names:', { serverPlayerName, clientPlayerName });

      const playerNameElement = document.getElementById('player-name');
      const opponentNameElement = document.getElementById('opponent-name');
      const currentTurnElement = document.getElementById('current-turn');

      if (isServerClient) {
        // Server-Client perspective
        if (playerNameElement) {
          // DISABLED: currentPlayer logic before card distribution
          // Always show waiting mode
          playerNameElement.textContent = 'Warte auf Spielstart...';
          playerNameElement.classList.add('waiting-turn');
          playerNameElement.classList.remove('current-turn');
        }
        if (opponentNameElement) {
          // DISABLED: currentPlayer logic before card distribution
          // Always show waiting mode
          opponentNameElement.textContent = 'Warte auf Spielstart...';
          opponentNameElement.classList.add('waiting-turn');
          opponentNameElement.classList.remove('current-turn');
        }
      } else {
        // Client perspective
        if (playerNameElement) {
          // DISABLED: currentPlayer logic before card distribution
          // Always show waiting mode
          playerNameElement.textContent = 'Warte auf Spielstart...';
          playerNameElement.classList.add('waiting-turn');
          playerNameElement.classList.remove('current-turn');
        }
        if (opponentNameElement) {
          // DISABLED: currentPlayer logic before card distribution
          // Always show waiting mode
          opponentNameElement.textContent = 'Warte auf Spielstart...';
          opponentNameElement.classList.add('waiting-turn');
          opponentNameElement.classList.remove('current-turn');
        }
      }

      if (currentTurnElement) {
        // DISABLED: currentPlayer logic before card distribution
        // Always show waiting mode
        currentTurnElement.textContent = 'Warte auf Spielstart...';
      }

      // DISABLED: currentPlayer logging before card distribution
      console.log('🎮 LAN info updated with names:', { serverPlayerName, clientPlayerName, currentPlayer: 'WAITING_FOR_CARD_DISTRIBUTION' });
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
      if (!this.canvas) return;

      const rect = this.canvas.getBoundingClientRect();
      if (!rect) return;

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Check if game has started (current player is set)
      const currentPlayer = localStorage.getItem('currentPlayer');
      if (!currentPlayer || currentPlayer === 'WAITING_FOR_CARD_DISTRIBUTION') {
        console.log('🎮 Game not started yet - waiting for server to start game');
        return;
      }

      // Check if game has been won
      if (this.gameWon) {
        console.log('🎮 Game has ended - no more moves allowed');
        return;
      }

      // Check if it's the current player's turn
      const isServerClient = localStorage.getItem('isServerClient') === 'true';
      const serverPlayerName = localStorage.getItem('serverPlayerName');
      const clientPlayerName = localStorage.getItem('clientPlayerName');

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

      console.log('🎮 Mouse down at:', {
        x, y, gameStarted: true, isCurrentPlayerTurn,
      });

      // Check player hand cards for drag start (only for current player)
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
        hasSelectedCard: !!this.selectedCard,
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
      if (!rect) return;

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Handle dragging if active
      if (this.isDragging && this.selectedCard) {
        this.selectedCard.updateDrag(x, y);

        // Show preview of where card would be placed on axis
        this.showPlacementPreview(x, y);
        return; // Skip hover effects while dragging
      }

      // Clear all hover effects first
      this.clearAllHoverEffects();

      // Check if game has started (current player is set)
      const currentPlayer = localStorage.getItem('currentPlayer');
      if (!currentPlayer || currentPlayer === 'WAITING_FOR_CARD_DISTRIBUTION') {
        // Game not started yet - no hover effects
        return;
      }

      // Determine which hand should show hover effects based on current player
      const isServerClient = localStorage.getItem('isServerClient') === 'true';
      const serverPlayerName = localStorage.getItem('serverPlayerName');
      const clientPlayerName = localStorage.getItem('clientPlayerName');

      let activeHand: any[] = [];
      if (isServerClient) {
        // Server-client: hover over server hand (playerHand) if it's server's turn
        if (currentPlayer === serverPlayerName) {
          activeHand = this.playerHand;
        }
      } else {
        // Client: hover over client hand (playerHand) if it's client's turn
        if (currentPlayer === clientPlayerName) {
          activeHand = this.playerHand;
        }
      }

      // Apply hover effects only for the active player's hand
      for (const card of activeHand) {
        if (card.containsPoint(x, y)) {
          card.isHovered = true;
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
  private handleMouseUp(_event: MouseEvent): void {
    try {
      // Check if it's the current player's turn before allowing card placement
      const currentPlayer = localStorage.getItem('currentPlayer');
      if (!currentPlayer || currentPlayer === 'WAITING_FOR_CARD_DISTRIBUTION') {
        console.log('🎮 Game not started yet - cannot place cards');
        return;
      }

      const isServerClient = localStorage.getItem('isServerClient') === 'true';
      const serverPlayerName = localStorage.getItem('serverPlayerName');
      const clientPlayerName = localStorage.getItem('clientPlayerName');

      let isCurrentPlayerTurn = false;
      if (isServerClient) {
        isCurrentPlayerTurn = currentPlayer === serverPlayerName;
      } else {
        isCurrentPlayerTurn = currentPlayer === clientPlayerName;
      }

      if (!isCurrentPlayerTurn) {
        console.log('🎮 Not current player turn, cannot place cards');

        return;
      }

      if (this.isDragging && this.selectedCard) {
        // Snap logic: if released near axis, place on board
        const releasedCard = this.selectedCard;
        releasedCard.stopDrag();

        const axisY = this.canvas!.height / 2;
        const distToAxis = Math.abs((releasedCard.y + releasedCard.height / 2) - axisY);

        if (distToAxis <= this.snapThreshold) {
          // SNAP: Snap to axis at exact position
          const snapX = releasedCard.x + releasedCard.width / 2;
          const snapY = axisY - releasedCard.height / 2;

          // SPECIAL CASE: If this is the first card after clearing the board, make it the central card
          if (this.board.length === 0) {
            releasedCard.isInHand = false;

            // Center the first card on the axis
            const centerX = this.canvas!.width / 2 - releasedCard.width / 2;
            releasedCard.setTargetPosition(centerX, snapY);

            console.log('🎮 First card set as central card:', releasedCard.card.title);
          } else {
            // Play card placement sound
            soundManager.play(SoundType.CARD_PLACE);

            // Normal case: Calculate the correct array position based on visual drop position
            // Set the exact position where the card was dropped
            releasedCard.setTargetPosition(snapX - releasedCard.width / 2, snapY);
            releasedCard.isInHand = false;

            // Log board state BEFORE adding the card
            console.log('🎮 === BEFORE CARD PLACEMENT ===');

            // Calculate the correct insertion index based on visual position
            const cardCenterX = snapX;
            let insertIndex = this.board.length; // Default to end

            // Find the correct position by comparing with existing cards
            for (let i = 0; i < this.board.length; i++) {
              const existingCard = this.board[i];
              const existingCardCenterX = existingCard.x + existingCard.width / 2;

              if (cardCenterX < existingCardCenterX) {
                // Card should be inserted before this existing card
                insertIndex = i;
                break;
              }
            }

            // Insert card at the calculated position
            this.board.splice(insertIndex, 0, releasedCard);
            console.log('🎮 Card inserted at calculated position:', insertIndex, 'for card:', releasedCard.card.title);

            // Log board state AFTER adding the card
            console.log('🎮 === AFTER CARD ADDED TO BOARD ===');

            // Remove from hand AFTER adding to board
            this.playerHand = this.playerHand.filter((c) => c !== releasedCard);
            console.log('🎮 Card removed from hand and placed on board');

            // Clear any preview positions
            this.hidePlacementPreview();

            // Remove hover effect from the placed card
            releasedCard.isHovered = false;

            // Center the player hand after card removal
            this.layoutHand();

            // Center all cards on the axis with proper spacing
            this.layoutAxisCards();

            // The board position is now the same as the insertion index
            const boardPosition = insertIndex;

            console.log('🎮 Card placement calculated:', {
              cardId: releasedCard.card.id,
              cardTitle: releasedCard.card.title,
              boardPosition,
              totalPlacedCards: this.board.length,
              finalX: releasedCard.x,
              finalY: releasedCard.y,
            });

            // Send card placement via WebSocket to synchronize with other player
            // Only send the board position (0,1,2,3...), not coordinates
            this.sendCardPlacementViaWebSocket(releasedCard.card.id, boardPosition);

                  // VALIDATION: Check if the card was placed correctly AFTER animations complete
      // Wait for animations to finish before validating
      setTimeout(() => {
        this.validateCardPlacement(releasedCard);
      }, 1500); // Wait 1.5 seconds for animations to complete

            // Card placed successfully - server will handle player turn change
            console.log('🎮 Card placed successfully - waiting for server to change player turn');

            console.log('🎮 Card successfully placed on axis');
          }
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
   * Get all placed cards in their current array order
   */
  private getAllPlacedCardsInOrder(): any[] {
    try {
      // Board array is already sorted by insertion order
      // Return a copy to avoid mutations
      return [...this.board];
    } catch (error) {
      console.error('🎮 Failed to get placed cards in order:', error);
      return [];
    }
  }

  /**
   * Calculate target coordinates for a card based on board position
   */
  private calculateTargetCoordinates(boardPosition: number): { x: number, y: number } {
    try {
      const cardWidth = 200 * this.scale;
      const cardHeight = 300 * this.scale;
      const cardSpacing = 20 * this.scale; // Use same spacing as recenterBoard
      const axisY = this.canvas!.height / 2;

      // Get all currently placed cards (including the new one already added)
      const totalCards = this.board.length;

      console.log('🎮 calculateTargetCoordinates - Input:', {
        boardPosition,
        totalCards,
      });

      // Calculate the total width needed for all cards
      const totalWidth = totalCards * cardWidth + (totalCards - 1) * cardSpacing;

      // Calculate the starting X position to center the entire board
      const startX = (this.canvas!.width - totalWidth) / 2;
      const centerY = axisY - cardHeight / 2;

      // Calculate the target X position based on the board position
      const targetX = startX + boardPosition * (cardWidth + cardSpacing);

      console.log('🎮 calculateTargetCoordinates - Calculated position:', {
        boardPosition,
        totalCards,
        totalWidth,
        startX,
        targetX,
        centerY,
        cardSpacing,
      });

      return { x: targetX, y: centerY };
    } catch (error) {
      console.error('🎮 Failed to calculate target coordinates:', error);
      // Fallback to center position
      return {
        x: this.canvas!.width / 2 - 100 * this.scale,
        y: this.canvas!.height / 2 - 150 * this.scale,
      };
    }
  }

  /**
   * Calculate board position for a card based on current board state
   */
  private calculateBoardPositionForCard(cardId: string, allPlacedCards: any[]): number {
    try {
      // If no cards are placed yet, position 0
      if (allPlacedCards.length === 0) {
        return 0;
      }

      // Find the card that was just placed in the board array (not in hand anymore)
      const placedCard = this.board.find((c) => c.card.id === cardId);
      if (!placedCard) {
        console.warn('🎮 Card not found in board for board position calculation:', cardId);
        return allPlacedCards.length; // Place at the end
      }

      // Calculate the actual position based on where the card was dropped
      // Find the index of this card in the sorted array
      const cardIndex = allPlacedCards.findIndex((c) => c.card.id === cardId);
      if (cardIndex === -1) {
        console.warn('🎮 Card not found in sorted placed cards:', cardId);
        return allPlacedCards.length; // Place at the end
      }

      const boardPosition = cardIndex;

      console.log('🎮 Calculated board position for card:', {
        cardId,
        cardTitle: placedCard.card.title,
        boardPosition,
        totalPlacedCards: allPlacedCards.length,
        actualX: placedCard.x,
        sortedIndex: cardIndex,
      });

      return boardPosition;
    } catch (error) {
      console.error('🎮 Failed to calculate board position for card:', error);
      return 0;
    }
  }

  /**
   * Show axis preview by moving cards to make space
   */
  private showAxisPreview(previewX: number): void {
    try {
      if (this.board.length === 0) return;

      // Only move cards if preview is not already active
      if (this.isPreviewActive) {
        return;
      }

      console.log('🎮 showAxisPreview called with previewX:', previewX);

      // Get all cards in their current array order
      const allCards = [...this.board];

      if (allCards.length === 0) return;

      // Calculate where the new card would be inserted
      const cardWidth = 200 * this.scale;
      const cardSpacing = 20 * this.scale;
      const axisY = this.canvas!.height / 2;
      const centerY = axisY - (300 * this.scale) / 2;

      // Find the insertion point based on previewX
      let insertIndex = allCards.length; // Default to end
      
      for (let i = 0; i < allCards.length; i++) {
        const existingCard = allCards[i];
        const existingCardCenterX = existingCard.x + existingCard.width / 2;
        
        if (previewX < existingCardCenterX) {
          insertIndex = i;
          break;
        }
      }

      console.log('🎮 Preview insertion point:', insertIndex, 'for previewX:', previewX);

      // Calculate new positions for all cards to make space
      const totalWidth = (allCards.length + 1) * cardWidth + allCards.length * cardSpacing;
      const startX = (this.canvas!.width - totalWidth) / 2;

      // Move cards to make space for the new card
      for (let i = 0; i < allCards.length; i++) {
        const card = allCards[i];
        let targetX: number;
        
        if (i < insertIndex) {
          // Cards before insertion point stay in their original positions
          targetX = startX + i * (cardWidth + cardSpacing);
        } else {
          // Cards at and after insertion point move right to make space
          targetX = startX + (i + 1) * (cardWidth + cardSpacing);
        }
        
        // Set preview position for smooth animation
        card.setPreviewPosition(targetX, centerY);
      }

      // Mark preview as active
      this.isPreviewActive = true;

      console.log('🎮 Preview activated with', allCards.length, 'cards, making space at index:', insertIndex);
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
      // Clear preview for all board cards
      for (const card of this.board) card.clearPreviewPosition();

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
      if (this.board.length > 0) {
        this.board[0].isHovered = false;
      }

      this.playerHand.forEach((card) => {
        card.isHovered = false;
      });

      this.opponentHand.forEach((card) => {
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

      // currentPlayer update removed - waiting for server to implement
      // if (gameState.currentPlayer) {
      //   this.updateCurrentPlayerFromServer(gameState.currentPlayer);
      // }

      // Update placed cards visualization
      if (gameState.placedCards) {
        this.updatePlacedCardsVisualization(gameState.placedCards);
      }

      // DISABLED: currentPlayer logging before card distribution
      logger.debug({
        scope: 'renderer/lan-game',
        msg: 'game state updated from WebSocket',
        meta: {
          currentPlayer: 'DISABLED_BEFORE_CARD_DISTRIBUTION',
          placedCardsCount: gameState.placedCards?.length || 0,
        },
      });
    } catch (error) {
      logger.error({
        scope: 'renderer/lan-game',
        msg: 'failed to handle game state update',
        err: { message: error.message, stack: error.stack },
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
      this.board = [];

      // Rebuild placed cards arrays based on new game state
      if (this.board.length > 0 && placedCards.length > 0) {
        const centralCard = this.board[0]; // First card is always the central card

        placedCards.forEach((cardData: any) => {
          // Skip central card
          if (cardData.id === centralCard.card.id) {
            return;
          }

          // Find the card in player or opponent hand
          let card = this.playerHand.find((c) => c.card.id === cardData.id);
          if (!card) {
            card = this.opponentHand.find((c) => c.card.id === cardData.id);
          }

          if (card) {
            // Position is now based on array index, not left/right logic

            // Add to board array
            this.board.push(card);

            // Remove from hand
            this.playerHand = this.playerHand.filter((c) => c !== card);
            this.opponentHand = this.opponentHand.filter((c) => c !== card);

            // Set card as placed (not in hand)
            card.isInHand = false;
          }
        });

        // Re-layout hands and axis
        this.layoutHand();
        this.layoutOpponentHand();
        this.layoutAxisCards();

        console.log('🎮 Placed cards visualization updated:', {
          boardCount: this.board.length,
        });
      }
    } catch (error) {
      logger.error({
        scope: 'renderer/lan-game',
        msg: 'failed to update placed cards visualization',
        err: { message: error.message, stack: error.stack },
      });
    }
  }

  /**
   * Send card placement via WebSocket to synchronize with other player
   * This method sends ONLY the board position (0,1,2,3...), not coordinates
   */
  private sendCardPlacementViaWebSocket(cardId: string, boardPosition: number): void {
    try {
      // Prevent duplicate sends for the same card
      const sendKey = `${cardId}-${boardPosition}`;
      if (this.lastSentCardPlacement === sendKey) {
        console.log('🎮 Card placement already sent, skipping duplicate:', sendKey);
        return;
      }

      const isServerClient = localStorage.getItem('isServerClient') === 'true';

      console.log('🎮 Sending card placement via WebSocket:', {
        cardId,
        boardPosition,
        isServerClient,
        message: `Sending ONLY board position ${boardPosition}, coordinates will be calculated by receiver`,
      });

      if (isServerClient) {
        // Server-Client: Send via IPC to main process WebSocket server
        if (window.AXM && window.AXM.placeLANCard) {
          try {
            window.AXM.placeLANCard(cardId, boardPosition).then((result: any) => {
              if (result.success) {
                console.log('🎮 Server-Client: Card placement sent via IPC successfully');
                console.log('🎮 Server-Client: Sent board position:', boardPosition, 'for card:', cardId);
                // Mark as sent to prevent duplicates
                this.lastSentCardPlacement = sendKey;
              } else {
                console.warn('🎮 Server-Client: Failed to send card placement via IPC:', result.message);
              }
            }).catch((error: any) => {
              console.error('🎮 Server-Client: Error sending card placement via IPC:', error);
            });
          } catch (error) {
            console.error('🎮 Server-Client: Failed to call placeLANCard:', error);
          }
        } else {
          console.warn('🎮 Server-Client: AXM.placeLANCard not available');
        }
      } else {
        // Client: Send via LANGameClient WebSocket
        console.log('🎮 Client: Attempting to send card placement via WebSocket');
        console.log('🎮 Client: lanGame available:', !!this.lanGame);
        console.log('🎮 Client: lanClient available:', !!(this.lanGame && this.lanGame.lanClient));

        if (this.lanGame && this.lanGame.lanClient) {
          console.log('🎮 Client: Sending card placement via WebSocket client');
          console.log('🎮 Client: Sending board position:', boardPosition, 'for card:', cardId);
          this.lanGame.lanClient.sendCardPlacement(cardId, boardPosition);
          console.log('🎮 Client: Card placement sent via WebSocket client successfully');
          // Mark as sent to prevent duplicates
          this.lastSentCardPlacement = sendKey;
        } else {
          console.warn('🎮 Client: No WebSocket client available for card placement');
          console.warn('🎮 Client: lanGame:', this.lanGame);
          console.warn('🎮 Client: lanClient:', this.lanGame?.lanClient);
        }
      }
    } catch (error) {
      console.error('🎮 Failed to send card placement via WebSocket:', error);
    }
  }

  /**
   * Move incorrect card to graveyard and give player a new card
   * This method removes the card from the board and animates it to graveyard
   */
  private moveCardToGraveyard(card: GameCard): void {
    try {
      console.log('🎮 Moving incorrect card to graveyard:', card.card.title);

      // Remove from board array
      this.board = this.board.filter((c) => c !== card);

      // Add to graveyard and animate
      this.graveyard.push(card);
      this.animateCardToGraveyard(card);

      // Give player a new card
      this.giveNewCard();

      // Layout all cards on the axis with proper spacing after removing the incorrect card
      this.layoutAxisCards();

      console.log('🎮 Card moved to graveyard successfully:', {
        cardTitle: card.card.title,
        graveyardSize: this.graveyard.length,
        boardSize: this.board.length
      });

    } catch (error) {
      console.error('🎮 Failed to move card to graveyard:', error);
    }
  }

  /**
   * Animate card to graveyard position (top right corner)
   */
  private animateCardToGraveyard(card: GameCard): void {
    try {
      // Calculate graveyard position (top right corner)
      const graveyardX = this.canvas!.width - 150 * this.scale; // 150px from right edge
      const graveyardY = 50 * this.scale; // 50px from top

      // Set target position for smooth animation
      card.setTargetPosition(graveyardX, graveyardY);

      console.log('🎮 Card animated to graveyard:', {
        cardTitle: card.card.title,
        graveyardX,
        graveyardY
      });

    } catch (error) {
      console.error('🎮 Failed to animate card to graveyard:', error);
    }
  }

  /**
   * Give a new card to the player who placed the incorrect card
   * For active player: give to own hand
   * For passive player: give to opponent's hand (the one who placed the card)
   */
  private giveNewCard(): void {
    try {
      // Play card shuffle sound for drawing a single card
      soundManager.play(SoundType.CARD_SHUFFLE);
      
      if (this.remainingCards.length > 0) {
        const newCardData = this.remainingCards.shift()!;
        
        // Use the same deck that was used for the original card distribution
        // This ensures the correct imageFolder is used
        const originalDeckId = localStorage.getItem('lanCardDistribution') 
          ? JSON.parse(localStorage.getItem('lanCardDistribution')!).deckId 
          : 'buildings-height-de';
        
        import('@/data/deckLoader').then(({ loadDeck }) => {
          return loadDeck(originalDeckId);
        }).then((deck) => {
          if (!deck) {
            console.error('🎮 Failed to load deck for new card');
            return;
          }

          // IMPORTANT: Determine who should get the new card
          const isServerClient = localStorage.getItem('isServerClient') === 'true';
          const currentPlayer = localStorage.getItem('currentPlayer');
          const serverPlayerName = localStorage.getItem('serverPlayerName');
          const clientPlayerName = localStorage.getItem('clientPlayerName');

          // Determine who placed the incorrect card (and should get a new card)
          let shouldGiveToServer = false;
          if (isServerClient) {
            // Server-Client: If it's server's turn, give to server (playerHand)
            shouldGiveToServer = currentPlayer === serverPlayerName;
          } else {
            // Browser-Client: If it's server's turn, give to server (opponentHand)
            shouldGiveToServer = currentPlayer === serverPlayerName;
          }

          // Create the new card directly (since it's from remainingCards, not from deck.cards)
          const newCard = new GameCard(
            newCardData,
            deck,
            50 * this.scale, // Start position at deck (left)
            this.canvas!.height - 320 * this.scale, // Deck Y position
            this.scale,
          );

          // Use the existing dealCard methods for proper animation and image loading
          if (shouldGiveToServer) {
            // Give to server's hand
            if (isServerClient) {
              // Add to player hand and layout
              this.playerHand.push(newCard);
              this.layoutHand();
              console.log('🎮 New card given to server (playerHand):', newCardData.title);
            } else {
              // Show as card back for browser client
              newCard.showCardBack = true;
              this.opponentHand.push(newCard);
              this.layoutOpponentHand();
              console.log('🎮 New card given to server (opponentHand, card back):', newCardData.title);
            }
          } else {
            // Give to client's hand
            if (isServerClient) {
              // Show as card back for server client
              newCard.showCardBack = true;
              this.opponentHand.push(newCard);
              this.layoutOpponentHand();
              console.log('🎮 New card given to client (opponentHand, card back):', newCardData.title);
            } else {
              // Add to player hand and layout
              this.playerHand.push(newCard);
              this.layoutHand();
              console.log('🎮 New card given to client (playerHand):', newCardData.title);
            }
          }

          console.log('🎮 New card given successfully:', {
            cardTitle: newCardData.title,
            remainingCards: this.remainingCards.length,
            playerHandSize: this.playerHand.length,
            opponentHandSize: this.opponentHand.length,
            shouldGiveToServer,
            isServerClient,
            currentPlayer
          });

          // No need to send remaining cards update - both players have the same remainingCards list
          // The remainingCards are synchronized via the initial card distribution

          // Switch to the next player after giving the new card
          this.switchToNextPlayer();

        }).catch((error) => {
          console.error('🎮 Failed to load deck for new card:', error);
        });

      } else {
        console.log('🎮 No more cards available to give to player');
      }

    } catch (error) {
      console.error('🎮 Failed to give new card:', error);
    }
  }

  /**
   * Switch to the next player after a card placement
   * This method handles the turn switching logic for both server and client
   */
  private switchToNextPlayer(): void {
    try {
      console.log('🎮 Switching to next player...');
      
      const isServerClient = localStorage.getItem('isServerClient') === 'true';
      const currentPlayer = localStorage.getItem('currentPlayer');
      const serverPlayerName = localStorage.getItem('serverPlayerName');
      const clientPlayerName = localStorage.getItem('clientPlayerName');
      
      // Determine the next player
      const nextPlayer = currentPlayer === serverPlayerName ? clientPlayerName : serverPlayerName;
      
      console.log('🎮 Player switch:', {
        currentPlayer,
        nextPlayer,
        isServerClient,
        serverPlayerName,
        clientPlayerName
      });
      
      // Update current player in localStorage
      localStorage.setItem('currentPlayer', nextPlayer!);
      
      // Send player switch via WebSocket if this is the server client
      if (isServerClient && this.lanGame?.lanClient) {
        try {
          this.lanGame.lanClient.sendPlayerSwitch(nextPlayer!);
          console.log('🎮 Sent player switch via WebSocket:', nextPlayer);
        } catch (error) {
          console.error('🎮 Failed to send player switch via WebSocket:', error);
        }
      }
      
      // Update UI to reflect the new current player
      this.updateCurrentPlayerDisplay();
      
      console.log('🎮 Player switch completed. New current player:', nextPlayer);
      
    } catch (error) {
      console.error('🎮 Failed to switch to next player:', error);
    }
  }

  /**
   * Update the current player display in the UI
   * This method updates the visual indication of whose turn it is
   */
  private updateCurrentPlayerDisplay(): void {
    try {
      const currentPlayer = localStorage.getItem('currentPlayer');
      const serverPlayerName = localStorage.getItem('serverPlayerName');
      const clientPlayerName = localStorage.getItem('clientPlayerName');
      const isServerClient = localStorage.getItem('isServerClient') === 'true';
      
      console.log('🎮 Updating current player display:', {
        currentPlayer,
        serverPlayerName,
        clientPlayerName,
        isServerClient
      });
      
      // Update the current turn indicator (matches HTML element id="currentTurn")
      const currentTurnElement = document.getElementById('currentTurn');
      if (currentTurnElement) {
        currentTurnElement.textContent = `Zug: ${currentPlayer || 'Unknown'}`;
        console.log('🎮 Updated currentTurn element:', currentTurnElement.textContent);
      } else {
        console.warn('🎮 currentTurn element not found in DOM');
      }
      
      // Update player name elements with turn highlighting
      const playerNameElement = document.getElementById('playerName');
      const opponentNameElement = document.getElementById('opponentName');
      
      if (isServerClient) {
        // Server perspective
        if (playerNameElement) {
          playerNameElement.textContent = `Spieler: ${serverPlayerName}`;
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
          if (currentPlayer === serverPlayerName) {
            opponentNameElement.classList.add('current-turn');
            opponentNameElement.classList.remove('waiting-turn');
          } else {
            opponentNameElement.classList.add('waiting-turn');
            opponentNameElement.classList.remove('current-turn');
          }
        }
      }
      
      console.log('🎮 Updated current player display successfully:', {
        currentPlayer,
        isServerClient,
        isMyTurn: (isServerClient && currentPlayer === serverPlayerName) || 
                  (!isServerClient && currentPlayer === clientPlayerName)
      });
      
    } catch (error) {
      console.error('🎮 Failed to update current player display:', error);
    }
  }

  /**
   * Validate card placement and provide visual feedback
   * This method checks if the placed card is in the correct position
   * and provides green/red color feedback for 2 seconds
   */
  private validateCardPlacement(placedCard: GameCard): void {
    try {
      console.log('🎮 Validating card placement for:', placedCard.card.title);

      // Get all cards currently on the axis (board array)
      const allAxisCards = [...this.board];

      // IMPORTANT: The board array is already in the correct order (sorted by insertion)
      // We don't need to sort by X position - the array order IS the logical order
      // The cards are positioned based on their array index, not their X coordinates
      
      // Extract just the card data for evaluation (in array order)
      const sortedCardData = allAxisCards.map((gc) => gc.card);

      console.log('🎮 Board array order for validation:', {
        totalCards: sortedCardData.length,
        cardOrder: sortedCardData.map((c, index) => `${index}: ${c.title} (${c.value} ${c.unit})`)
      });

      // Import the validation function from scoring module
      import('@/data/scoring').then(({ isAxisCorrectlySorted }) => {
        const isCorrect = sortedCardData.length > 0
          ? isAxisCorrectlySorted(sortedCardData)
          : true; // Default to correct if no cards

        console.log('🎮 Card placement validation result:', {
          cardTitle: placedCard.card.title,
          isCorrect,
          totalCards: sortedCardData.length,
          arrayOrder: sortedCardData.map(c => c.title),
          values: sortedCardData.map(c => `${c.value} ${c.unit}`)
        });

        if (isCorrect) {
          // Correct placement - show green feedback for 2 seconds and play success sound
          placedCard.setCorrect();
          setTimeout(() => {
            soundManager.play(SoundType.SUCCESS);
          }, 300); // Small delay after placement sound
          console.log('🎮 Card placed correctly - showing green feedback');
          
          // Check for win condition after correct placement
          this.checkForWin();
          
          // Switch to the next player after correct placement
          setTimeout(() => {
            this.switchToNextPlayer();
          }, 2000); // Wait 2 seconds for green feedback
        } else {
          // Incorrect placement - show red feedback for 2 seconds, then move to graveyard and play error sound
          placedCard.setIncorrect();
          setTimeout(() => {
            soundManager.play(SoundType.ERROR);
          }, 300); // Small delay after placement sound
          console.log('🎮 Card placed incorrectly - showing red feedback');
          
          // After 2 seconds, move the incorrect card to graveyard
          setTimeout(() => {
            this.moveCardToGraveyard(placedCard);
          }, 2000); // Wait 2 seconds for red feedback
        }
      }).catch((error) => {
        console.error('🎮 Failed to import scoring module:', error);
        // Fallback: assume correct if import fails
        placedCard.setCorrect();
      });

    } catch (error) {
      console.error('🎮 Failed to validate card placement:', error);
      // Fallback: assume correct if validation fails
      placedCard.setCorrect();
    }
  }

  /**
    * Show error message
    */
  private showError(message: string): void {
    try {
      console.error('🎮 Error:', message);
      // Use console.error instead of alert for better UX
      console.error(`LAN-Spiel Fehler: ${message}`);
    } catch (error) {
      console.error('🎮 Failed to show error:', error);
    }
  }

  /**
   * Check if current player has won the game
   * Win condition: Player has no cards left in hand after placing a correct card
   */
  private checkForWin(): void {
    try {
      const isServerClient = localStorage.getItem('isServerClient') === 'true';
      const currentPlayer = localStorage.getItem('currentPlayer');
      const serverPlayerName = localStorage.getItem('serverPlayerName');
      const clientPlayerName = localStorage.getItem('clientPlayerName');
      
      // Determine which hand to check based on current player
      let currentPlayerHandLength = 0;
      let winnerName = '';
      
      if (currentPlayer === serverPlayerName) {
        // Server player's turn
        if (isServerClient) {
          // Server-Client: check playerHand
          currentPlayerHandLength = this.playerHand.length;
          winnerName = serverPlayerName || 'Server';
        } else {
          // Browser-Client: check opponentHand (server's hand)
          currentPlayerHandLength = this.opponentHand.length;
          winnerName = serverPlayerName || 'Server';
        }
      } else {
        // Client player's turn
        if (isServerClient) {
          // Server-Client: check opponentHand (client's hand)
          currentPlayerHandLength = this.opponentHand.length;
          winnerName = clientPlayerName || 'Waiting for client...';
        } else {
          // Browser-Client: check playerHand
          currentPlayerHandLength = this.playerHand.length;
          winnerName = clientPlayerName || 'Waiting for client...';
        }
      }
      
      console.log('🎮 Checking for win condition:', {
        currentPlayer,
        currentPlayerHandLength,
        winnerName,
        isServerClient,
        serverPlayerName,
        clientPlayerName
      });
      
      // Win condition: current player has no cards left
      if (currentPlayerHandLength === 0) {
        this.gameWon = true; // Mark game as won to prevent further moves
        
        console.log('🎮 GAME WON!', {
          winnerName,
          currentPlayer,
          currentPlayerHandLength,
          remainingCards: this.remainingCards.length,
          boardCards: this.board.length
        });
        
        // Show win dialog after 2 seconds delay
        setTimeout(() => {
          this.showLANWinDialog(winnerName);
        }, 2000);
      }
      
    } catch (error) {
      console.error('🎮 Failed to check for win condition:', error);
    }
  }

  /**
   * Show LAN win dialog with two buttons
   * Based on the hotseat implementation but with custom dialog
   */
  private showLANWinDialog(winnerName: string): void {
    try {
      const isServerClient = localStorage.getItem('isServerClient') === 'true';
      const currentPlayer = localStorage.getItem('currentPlayer');
      const serverPlayerName = localStorage.getItem('serverPlayerName');
      const clientPlayerName = localStorage.getItem('clientPlayerName');
      
      // Determine if this client is the winner
      const isWinner = (isServerClient && currentPlayer === serverPlayerName) || 
                      (!isServerClient && currentPlayer === clientPlayerName);
      
      let title = '';
      let message = '';
      if (isWinner) {
        title = '🎉 Glückwunsch! 🎉';
        message = `Du hast das Spiel gewonnen!\n\nAlle deine Karten wurden erfolgreich sortiert!\n\nGewinner: ${winnerName}`;
      } else {
        title = '🎉 Spiel beendet! 🎉';
        message = `${winnerName} hat das Spiel gewonnen!\n\nAlle Karten wurden erfolgreich sortiert!`;
      }
      
      this.showCustomWinDialog(title, message);
      
    } catch (error) {
      console.error('🎮 Failed to show LAN win dialog:', error);
    }
  }

  /**
   * Show custom win dialog with two buttons
   */
  private showCustomWinDialog(title: string, message: string): void {
    try {
      // Create dialog overlay
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: Arial, sans-serif;
      `;

      // Create dialog box
      const dialog = document.createElement('div');
      dialog.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 20px;
        padding: 40px;
        max-width: 500px;
        width: 90%;
        text-align: center;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        color: white;
        border: 2px solid rgba(255, 255, 255, 0.2);
      `;

      // Create title
      const titleElement = document.createElement('h2');
      titleElement.textContent = title;
      titleElement.style.cssText = `
        margin: 0 0 20px 0;
        font-size: 28px;
        font-weight: bold;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
      `;

      // Create message
      const messageElement = document.createElement('p');
      messageElement.textContent = message;
      messageElement.style.cssText = `
        margin: 0 0 30px 0;
        font-size: 16px;
        line-height: 1.5;
        white-space: pre-line;
      `;

      // Create button container
      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = `
        display: flex;
        gap: 15px;
        justify-content: center;
        flex-wrap: wrap;
      `;

      // Create "Nochmal spielen" button
      const playAgainButton = document.createElement('button');
      playAgainButton.textContent = 'Nochmal spielen';
      playAgainButton.style.cssText = `
        background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
        color: white;
        border: none;
        padding: 15px 30px;
        border-radius: 25px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
        min-width: 150px;
      `;

      // Create "Hauptmenü" button
      const mainMenuButton = document.createElement('button');
      mainMenuButton.textContent = 'Hauptmenü';
      mainMenuButton.style.cssText = `
        background: linear-gradient(135deg, #FF6B6B 0%, #ee5a52 100%);
        color: white;
        border: none;
        padding: 15px 30px;
        border-radius: 25px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(255, 107, 107, 0.3);
        min-width: 150px;
      `;

      // Add hover effects
      playAgainButton.addEventListener('mouseenter', () => {
        playAgainButton.style.transform = 'translateY(-2px)';
        playAgainButton.style.boxShadow = '0 6px 20px rgba(76, 175, 80, 0.4)';
      });
      playAgainButton.addEventListener('mouseleave', () => {
        playAgainButton.style.transform = 'translateY(0)';
        playAgainButton.style.boxShadow = '0 4px 15px rgba(76, 175, 80, 0.3)';
      });

      mainMenuButton.addEventListener('mouseenter', () => {
        mainMenuButton.style.transform = 'translateY(-2px)';
        mainMenuButton.style.boxShadow = '0 6px 20px rgba(255, 107, 107, 0.4)';
      });
      mainMenuButton.addEventListener('mouseleave', () => {
        mainMenuButton.style.transform = 'translateY(0)';
        mainMenuButton.style.boxShadow = '0 4px 15px rgba(255, 107, 107, 0.3)';
      });

      // Add click handlers with debouncing
      let isButtonClicked = false;
      
      playAgainButton.addEventListener('click', () => {
        if (isButtonClicked) return;
        isButtonClicked = true;
        
        soundManager.play(SoundType.BUTTON_CLICK);
        playAgainButton.style.opacity = '0.6';
        
        // Small delay to allow sound to play before removing overlay
        setTimeout(() => {
          document.body.removeChild(overlay);
          this.restartLANGameWithNotification();
        }, 100);
      });

      mainMenuButton.addEventListener('click', () => {
        if (isButtonClicked) return;
        isButtonClicked = true;
        
        soundManager.play(SoundType.BUTTON_CLICK);
        mainMenuButton.style.opacity = '0.6';
        
        // Small delay to allow sound to play before navigation
        setTimeout(() => {
          document.body.removeChild(overlay);
          this.goToMainMenu();
        }, 100);
      });

      // Assemble dialog
      buttonContainer.appendChild(playAgainButton);
      buttonContainer.appendChild(mainMenuButton);
      dialog.appendChild(titleElement);
      dialog.appendChild(messageElement);
      dialog.appendChild(buttonContainer);
      overlay.appendChild(dialog);

      // Add to page
      document.body.appendChild(overlay);

      console.log('🎮 Custom win dialog displayed');

    } catch (error) {
      console.error('🎮 Failed to show custom win dialog:', error);
      // Fallback to simple confirm
      const playAgain = confirm(`${title}\n\n${message}\n\nNochmal spielen?`);
      if (playAgain) {
        this.restartLANGame();
      } else {
        this.goToMainMenu();
      }
    }
  }

  /**
   * Navigate to main menu
   */
  private goToMainMenu(): void {
    try {
      console.log('🎮 Navigating to main menu...');
      window.location.href = './index.html';
    } catch (error) {
      console.error('🎮 Failed to navigate to main menu:', error);
    }
  }

  /**
   * Send remaining cards update to other player
   */
  private sendRemainingCardsUpdate(): void {
    try {
      console.log('🎮 Sending remaining cards update to other player...');
      
      const isServerClient = localStorage.getItem('isServerClient') === 'true';
      
      if (isServerClient && this.lanGame?.lanClient) {
        // Server-Client: Send via WebSocket client
        this.lanGame.lanClient.sendRemainingCardsUpdate(this.remainingCards.length);
        console.log('🎮 Sent remaining cards update via WebSocket client:', this.remainingCards.length);
      } else if (!isServerClient && this.lanGame?.lanClient) {
        // Browser-Client: Send via WebSocket client
        this.lanGame.lanClient.sendRemainingCardsUpdate(this.remainingCards.length);
        console.log('🎮 Sent remaining cards update via WebSocket client:', this.remainingCards.length);
      } else {
        console.warn('🎮 Cannot send remaining cards update - WebSocket client not available');
      }
      
    } catch (error) {
      console.error('🎮 Failed to send remaining cards update:', error);
    }
  }

  /**
   * Restart the LAN game with notification to other player
   * This method sends a restart request to the other player
   */
  private restartLANGameWithNotification(): void {
    try {
      console.log('🎮 Restarting LAN game with notification to other player...');
      
      // Send restart request to other player via WebSocket
      const isServerClient = localStorage.getItem('isServerClient') === 'true';
      
      if (isServerClient && this.lanGame?.lanClient) {
        // Server-Client: Send via WebSocket client
        this.lanGame.lanClient.sendGameRestart();
        console.log('🎮 Sent game restart request via WebSocket client');
      } else if (!isServerClient && this.lanGame?.lanClient) {
        // Browser-Client: Send via WebSocket client
        this.lanGame.lanClient.sendGameRestart();
        console.log('🎮 Sent game restart request via WebSocket client');
      } else {
        console.warn('🎮 Cannot send restart request - WebSocket client not available');
      }
      
      // Also restart locally
      this.restartLANGame();
      
    } catch (error) {
      console.error('🎮 Failed to restart LAN game with notification:', error);
      // Fallback: restart locally only
      this.restartLANGame();
    }
  }

  /**
   * Restart the LAN game with the same deck
   * The loser of the previous game will start the new game
   */
  private restartLANGame(): void {
    try {
      console.log('🎮 Restarting LAN game with same deck...');
      
      // Reset game state
      this.playerHand = [];
      this.opponentHand = [];
      this.board = [];
      this.graveyard = [];
      this.remainingCards = [];
      this.gameWon = false; // Reset game won state
      
      // Determine who should start (the loser of the previous game)
      const currentPlayer = localStorage.getItem('currentPlayer');
      const serverPlayerName = localStorage.getItem('serverPlayerName');
      const clientPlayerName = localStorage.getItem('clientPlayerName');
      
      // The current player (who just won) should NOT start - the other player should start
      const startingPlayer = currentPlayer === serverPlayerName ? clientPlayerName : serverPlayerName;
      
      console.log('🎮 Restarting game - previous winner:', currentPlayer, 'new starting player:', startingPlayer);
      
      // Set the loser as the starting player
      localStorage.setItem('currentPlayer', startingPlayer || 'Server');
      
      // Update UI
      this.updateCurrentPlayerDisplay();
      
      // Restart the entire LAN game initialization with the same deck
      this.restartLANGameWithSameDeck();
      
      console.log('🎮 LAN game restart initiated successfully');
      
    } catch (error) {
      console.error('🎮 Failed to restart LAN game:', error);
    }
  }

  /**
   * Start game with predetermined player (not random)
   * Used for game restarts where we want the loser to start
   */
  private async startGameWithPredeterminedPlayer(): Promise<void> {
    try {
      console.log('🎮 Starting game with predetermined player...');

      const currentPlayer = localStorage.getItem('currentPlayer');
      const serverPlayerName = localStorage.getItem('serverPlayerName');
      const clientPlayerName = localStorage.getItem('clientPlayerName');

      if (!currentPlayer || !serverPlayerName || !clientPlayerName) {
        console.warn('🎮 Cannot start game: missing player names');
        return;
      }

      console.log('🎮 Using predetermined current player:', currentPlayer);

      // Update ONLY the current player UI elements (no full LAN update)
      this.updateCurrentPlayerUI(currentPlayer);

      // Send current player to client via WebSocket
      console.log('🎮 About to send predetermined current player to client:', currentPlayer);
      console.log('🎮 window.AXM available:', !!window.AXM);
      console.log('🎮 window.AXM.sendCurrentPlayerUpdate available:', !!(window.AXM && window.AXM.sendCurrentPlayerUpdate));

      if (window.AXM && window.AXM.sendCurrentPlayerUpdate) {
        try {
          await window.AXM.sendCurrentPlayerUpdate(currentPlayer);
          console.log('🎮 Successfully sent predetermined current player to client:', currentPlayer);
        } catch (error) {
          console.error('🎮 Failed to send predetermined current player to client:', error);
        }
      } else {
        console.warn('🎮 Cannot send current player update - AXM not available');
      }

      console.log('🎮 Game started with predetermined player:', currentPlayer);

    } catch (error) {
      console.error('🎮 Failed to start game with predetermined player:', error);
    }
  }

  /**
   * Restart LAN game with the same deck (server-client only)
   */
  private async restartLANGameWithSameDeck(): Promise<void> {
    try {
      console.log('🎮 Restarting LAN game with same deck...');
      
      // Get the current deck ID from localStorage
      const deckId = localStorage.getItem('selectedDeckId') || 'buildings-height-de';
      console.log('🎮 Using same deck for restart:', deckId);
      
      // Re-initialize the LAN game with the same deck
      if (this.lanGame) {
        // Reset the LANGameManager state
        this.lanGame = new LANGameManager();
        
        // Initialize with the same deck
        await this.lanGame.initializeLANGame();
        
        // Handle server-client flow (distribute cards and send to client)
        await this.handleServerClientFlow();
        
        // Start game with the predetermined starting player (loser)
        await this.startGameWithPredeterminedPlayer();
        
        console.log('🎮 LAN game restarted with same deck successfully');
      } else {
        console.error('🎮 Cannot restart: lanGame is null');
      }
      
    } catch (error) {
      console.error('🎮 Failed to restart LAN game with same deck:', error);
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
      availableMethods: hasAXM ? Object.keys(window.AXM) : 'none',
    });

    if (isElectron) {
      // Server-Client: Wait for AXM.placeLANCard
      console.log('🎮 Electron detected, waiting for AXM.placeLANCard...');

      const waitForAXM = () => {
        if (window.AXM && window.AXM.placeLANCard) {
          console.log('✅ AXM.placeLANCard is available, initializing LANGameApp...');
          console.log('✅ Available AXM methods:', Object.keys(window.AXM));

          // Initialize sound manager first, then create LANGameApp
          soundManager.init().then(() => {
            logger.info({ scope: 'renderer/lan-game', msg: 'sound manager initialized' });
            const lanGameApp = new LANGameApp();

            // Add resize event listener
            window.addEventListener('resize', () => {
              lanGameApp.handleResize(window.innerWidth, window.innerHeight);
            });
          }).catch((error) => {
            logger.error({ 
              scope: 'renderer/lan-game', 
              msg: 'failed to initialize sound manager', 
              err: { message: error.message } 
            });
            // Continue anyway
            const lanGameApp = new LANGameApp();

            // Add resize event listener
            window.addEventListener('resize', () => {
              lanGameApp.handleResize(window.innerWidth, window.innerHeight);
            });
          });
        } else {
          console.log('⏳ Waiting for AXM.placeLANCard to be available...');
          console.log('⏳ Current AXM state:', {
            hasAXM: !!window.AXM,
            hasPlaceLANCard: !!(window.AXM && window.AXM.placeLANCard),
            availableMethods: window.AXM ? Object.keys(window.AXM) : [],
          });
          setTimeout(waitForAXM, 100);
        }
      };

      waitForAXM();
    } else {
    // Browser-Client: Start immediately with WebSocket
    console.log('🎮 Browser detected, starting with WebSocket connection...');
    console.log('🎮 No AXM available, using direct WebSocket communication');

      // Initialize sound manager first
      soundManager.init().then(() => {
        logger.info({ scope: 'renderer/lan-game', msg: 'sound manager initialized' });
        const lanGameApp = new LANGameApp();

        // Add resize event listener
        window.addEventListener('resize', () => {
          lanGameApp.handleResize(window.innerWidth, window.innerHeight);
        });
      }).catch((error) => {
        logger.error({ 
          scope: 'renderer/lan-game', 
          msg: 'failed to initialize sound manager', 
          err: { message: error.message } 
        });
        // Continue anyway
        const lanGameApp = new LANGameApp();

        // Add resize event listener
        window.addEventListener('resize', () => {
          lanGameApp.handleResize(window.innerWidth, window.innerHeight);
        });
      });
    }
  } catch (error) {
    console.error('🎮 Failed to initialize LAN game:', error);
  }
});
