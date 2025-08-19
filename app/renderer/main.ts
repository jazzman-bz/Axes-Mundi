import { logger } from '@/utils/logger';
import { loadDeck, dealCards, getRandomBoardCard } from '@/data/deckLoader';
import { isAxisCorrectlySorted, getScore } from '@/data/scoring';
import { GameCard } from '@/game/Card';
import { Card as CardData } from '@/data/types';

/**
 * Main application class
 */
class AxesMundiApp {
  private fpsCounter: HTMLElement;
  private versionElement: HTMLElement;
  private envElement: HTMLElement;
  private loadingElement: HTMLElement;
  private gameCanvas: HTMLCanvasElement;
  private gameContext: CanvasRenderingContext2D;
  private animationId: number;
  private lastTime: number;
  private fps: number = 60;
  private logoImage: HTMLImageElement | null = null;
  
  // Game state
  private playerHand: GameCard[] = [];
  private opponentHand: GameCard[] = []; // AI opponent hand
  private boardCard: GameCard | null = null;
  private selectedCard: GameCard | null = null;
  private isDragging: boolean = false;
  private placedLeft: GameCard[] = [];
  private placedRight: GameCard[] = [];
  private graveyard: GameCard[] = []; // Cards that were placed incorrectly
  private score: number = 0;
  private remainingCards: CardData[] = [];
  private gameWon: boolean = false; // Track if player has won
  private gameLost: boolean = false; // Track if player has lost
  private snapThreshold: number = 80; // px distance to axis
  private readonly stackSpacing: number = 140; // px spacing between placed cards
  private isPreviewActive: boolean = false; // Track if preview is currently active
  private scale: number = 1; // Global scale factor
  private isGameStarted: boolean = false; // Track if first card has been placed on axis
  private currentTurn: number = 0; // Track current turn
  private isPlayerTurn: boolean = true; // Track whose turn it is (true = player, false = AI)
  private turnText: string = ''; // Display turn information

  constructor() {
    this.fpsCounter = document.getElementById('fps') as HTMLElement;
    this.versionElement = document.getElementById('version') as HTMLElement;
    this.envElement = document.getElementById('env') as HTMLElement;
    this.loadingElement = document.getElementById('loading') as HTMLElement;
    this.gameCanvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.gameContext = this.gameCanvas.getContext('2d')!;

    this.initCanvas();
    this.setupEventListeners();
    this.loadAppInfo();
    this.calculateScale(); // Calculate initial scale
    this.loadLogo(); // Load the Axes Mundi logo
    this.loadGame();
    this.startGameLoop();
  }

  /**
   * Initialize canvas
   */
  private initCanvas(): void {
    try {
      this.gameCanvas.width = window.innerWidth;
      this.gameCanvas.height = window.innerHeight;
      
      logger.info({ scope: 'renderer/app', msg: 'canvas initialized' });
    } catch (error) {
      logger.error({ 
        scope: 'renderer/app', 
        msg: 'failed to initialize canvas', 
        err: { message: error.message, stack: error.stack } 
      });
      throw error;
    }
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Window resize
    window.addEventListener('resize', this.handleResize.bind(this));
    
    // Mouse events for card interaction - use window for mousemove/mouseup to handle drag outside canvas
    this.gameCanvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    window.addEventListener('mousemove', this.handleMouseMove.bind(this));
    window.addEventListener('mouseup', this.handleMouseUp.bind(this));
    
    logger.debug({ scope: 'renderer/app', msg: 'event listeners set up' });
  }

  /**
   * Load the Axes Mundi logo image
   */
  private loadLogo(): void {
    try {
      this.logoImage = new Image();
      this.logoImage.onload = () => {
        logger.info({ scope: 'renderer/app', msg: 'logo loaded successfully' });
      };
      this.logoImage.onerror = () => {
        logger.error({ scope: 'renderer/app', msg: 'failed to load logo' });
        this.logoImage = null;
      };
      this.logoImage.src = './assets/axes-mundi logo.png';
    } catch (error) {
      logger.error({ 
        scope: 'renderer/app', 
        msg: 'failed to load logo', 
        err: { message: error.message, stack: error.stack } 
      });
      this.logoImage = null;
    }
  }

  /**
   * Calculate scale factor based on window size
   */
  private calculateScale(): void {
    // Base size: 1920x1080, scale down for smaller screens
    const baseWidth = 1920;
    const baseHeight = 1080;
    const scaleX = window.innerWidth / baseWidth;
    const scaleY = window.innerHeight / baseHeight;
    this.scale = Math.min(scaleX, scaleY, 1.5); // Cap at 1.5x for very large screens
    this.snapThreshold = 80 * this.scale;
  }

  /**
   * Handle window resize
   */
  private handleResize(): void {
    try {
      this.gameCanvas.width = window.innerWidth;
      this.gameCanvas.height = window.innerHeight;
      
      // Recalculate scale factor
      this.calculateScale();
      
      logger.debug({ 
        scope: 'renderer/app', 
        msg: 'window resized', 
        meta: { 
          width: window.innerWidth, 
          height: window.innerHeight,
          scale: this.scale
        } 
      });
      
      // Update scale for all existing cards
      this.updateAllCardsScale();
      
      // Re-layout on resize with new scale
      this.layoutHand();
      this.layoutOpponentHand();
      this.layoutAxisCards();
      
      // Re-position board card if it exists
      if (this.boardCard) {
        const centerX = this.gameCanvas.width / 2 - this.boardCard.width / 2;
        const centerY = this.gameCanvas.height / 2 - this.boardCard.height / 2;
        this.boardCard.setTargetPosition(centerX, centerY);
      }
      
      // Update snap threshold for new scale
      this.snapThreshold = 80 * this.scale;
    } catch (error) {
      logger.error({ 
        scope: 'renderer/app', 
        msg: 'resize failed', 
        err: { message: error.message, stack: error.stack } 
      });
    }
  }

  /**
   * Load game data
   */
  private async loadGame(): Promise<void> {
    try {
      // Load deck from localStorage
      const selectedDeck = localStorage.getItem('selectedDeck') || 'space-height-de';
      const deck = await loadDeck(selectedDeck);
      
      // Initialize remaining cards from deck and shuffle them
      this.remainingCards = [...deck.cards];
      this.shuffleDeck();
      
      // Ensure scale is calculated with correct canvas dimensions
      this.calculateScale();
      
      // Get first card for board (turn-based: first card goes to center)
      const boardCardData = this.remainingCards.shift()!;
      this.boardCard = new GameCard(
        boardCardData,
        50 * this.scale, // Start at deck position
        this.gameCanvas.height - 320 * this.scale, // Deck Y position (same as player hand)
        this.scale
      );
      this.boardCard.isInHand = false; // Board card is on axis, not in hand
      
      // Animate first card from deck to center of axis
      this.animateFirstCardToCenter();
      
      // Start dealing cards immediately (don't wait for animation)
      logger.info({
        scope: 'renderer/game',
        msg: 'starting dealCardsToPlayers immediately',
        meta: { remainingCards: this.remainingCards.length }
      });
      this.dealCardsToPlayers();
      
      logger.info({ 
        scope: 'renderer/game', 
        msg: 'game loaded successfully', 
        meta: { boardCard: boardCardData.title, remainingCards: this.remainingCards.length } 
      });
    } catch (error) {
      logger.error({ 
        scope: 'renderer/game', 
        msg: 'failed to load game', 
        err: { message: error.message, stack: error.stack } 
      });
    }
  }

  /**
   * Animate cards from deck to hand one by one with 1-second intervals
   */
  private animateCardsToHand(handCards: GameCard[]): void {
    handCards.forEach((card, index) => {
      setTimeout(() => {
        this.playerHand.push(card);
        this.layoutHand(); // Center the hand after each card
      }, index * 2000); // 2 second interval (slower)
    });
  }

  /**
   * Animate first card from deck to center of axis
   */
  private animateFirstCardToCenter(): void {
    logger.info({
      scope: 'renderer/game',
      msg: 'animateFirstCardToCenter called',
      meta: { hasBoardCard: !!this.boardCard }
    });
    
    if (!this.boardCard) return;
    
    // Calculate center position
    const centerX = this.gameCanvas.width / 2 - this.boardCard.width / 2;
    const centerY = this.gameCanvas.height / 2 - this.boardCard.height / 2;
    
    // Animate to center with smooth transition
    this.boardCard.setTargetPosition(centerX, centerY);
    
    // Mark game as started after animation
    setTimeout(() => {
      this.isGameStarted = true;
      this.currentTurn = 1;
      
      logger.info({
        scope: 'renderer/game',
        msg: 'first card placed on axis, game started',
        meta: { cardTitle: this.boardCard!.card.title, turn: this.currentTurn }
      });
    }, 2000); // Wait for animation to complete (slower)
    
    logger.info({
      scope: 'renderer/game',
      msg: 'animating first card to center',
      meta: { cardTitle: this.boardCard.card.title }
    });
  }

  /**
   * Shuffle the deck using Fisher-Yates algorithm
   */
  private shuffleDeck(): void {
    try {
      for (let i = this.remainingCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.remainingCards[i], this.remainingCards[j]] = [this.remainingCards[j], this.remainingCards[i]];
      }
      
      logger.info({
        scope: 'renderer/game',
        msg: 'deck shuffled successfully',
        meta: { cardCount: this.remainingCards.length }
      });
    } catch (error) {
      logger.error({
        scope: 'renderer/game',
        msg: 'failed to shuffle deck',
        err: { message: error.message, stack: error.stack }
      });
    }
  }

  /**
   * Animate a single card from deck to hand
   */
  private animateCardToHand(card: GameCard): void {
    // Add to hand first
    this.playerHand.push(card);
    
    // Animate to hand position
    this.layoutHand();
    
    logger.info({
      scope: 'renderer/game',
      msg: 'card animated to hand',
      meta: { cardTitle: card.card.title }
    });
  }



  /**
   * Deal cards to both players (5 each at once)
   */
  private dealCardsToPlayers(): void {
    logger.info({
      scope: 'renderer/game',
      msg: 'dealCardsToPlayers called',
      meta: { remainingCards: this.remainingCards.length }
    });
    
    // Deal 5 cards to player with small delay
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this.dealCardToPlayer();
      }, i * 200); // 200ms delay between each card (slower)
    }
    
    // Deal 5 cards to opponent with small delay
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this.dealCardToOpponent();
      }, 1200 + i * 200); // Start after player cards, 200ms delay between each (slower)
    }
    
    // Set player turn after all cards are dealt
    setTimeout(() => {
      this.isPlayerTurn = true;
      this.updateTurnText();
      logger.info({
        scope: 'renderer/game',
        msg: 'game started, player turn',
        meta: { 
          turn: this.currentTurn,
          playerHandSize: this.playerHand.length,
          opponentHandSize: this.opponentHand.length,
          remainingCards: this.remainingCards.length
        }
      });
    }, 2400); // After all cards are dealt (slower)
  }

  /**
   * Deal a card to the player
   */
  private dealCardToPlayer(): void {
    if (this.remainingCards.length > 0) {
      const cardData = this.remainingCards.shift()!;
      const card = new GameCard(
        cardData,
        50 * this.scale, // Start at deck position
        this.gameCanvas.height - 320 * this.scale, // Deck Y position (same as player hand)
        this.scale
      );
      
      // Add to hand and animate to position
      this.playerHand.push(card);
      this.layoutHand();
      
      logger.info({
        scope: 'renderer/game',
        msg: 'card dealt to player',
        meta: { cardTitle: cardData.title, handSize: this.playerHand.length }
      });
    }
  }

  /**
   * Deal a card to the opponent
   */
  private dealCardToOpponent(): void {
    logger.info({
      scope: 'renderer/game',
      msg: 'dealCardToOpponent called',
      meta: { remainingCards: this.remainingCards.length, opponentHandSize: this.opponentHand.length }
    });
    
    if (this.remainingCards.length > 0) {
      const cardData = this.remainingCards.shift()!;
      const card = new GameCard(
        cardData,
        50 * this.scale, // Start at deck position
        this.gameCanvas.height - 320 * this.scale, // Deck Y position (same as player hand)
        this.scale
      );
      
      // Animate from deck to hand position (card will be added to hand in animateOpponentCardFromDeck)
      this.animateOpponentCardFromDeck(card);
      
      logger.info({
        scope: 'renderer/game',
        msg: 'opponent card positioned immediately',
        meta: { 
          cardTitle: cardData.title,
          handSize: this.opponentHand.length
        }
      });
      
      logger.info({
        scope: 'renderer/game',
        msg: 'card dealt to opponent',
        meta: { cardTitle: cardData.title, handSize: this.opponentHand.length, remainingCards: this.remainingCards.length }
      });
    } else {
      logger.warn({
        scope: 'renderer/game',
        msg: 'no cards remaining for opponent',
        meta: { remainingCards: this.remainingCards.length }
      });
    }
  }



  /**
   * Animate a card from deck to opponent hand (same logic as player hand)
   */
  private animateOpponentCardFromDeck(card: GameCard): void {
    // Add to hand first (same as animateCardToHand)
    this.opponentHand.push(card);
    
    // Layout the entire hand to get correct positions for all cards (same as layoutHand)
    this.layoutOpponentHand();
    
    logger.info({
      scope: 'renderer/game',
      msg: 'opponent card animated to hand',
      meta: { cardTitle: card.card.title }
    });
  }

  /**
   * Layout opponent hand cards at top of screen (same logic as player hand)
   */
  private layoutOpponentHand(): void {
    const cardSpacing = 220 * this.scale; // Same spacing as player hand
    const totalWidth = this.opponentHand.length * cardSpacing - 20 * this.scale; // Same calculation
    const startX = (this.gameCanvas.width - totalWidth) / 2; // Center the hand
    
    this.opponentHand.forEach((card, index) => {
      const x = startX + index * cardSpacing;
      const y = 20 * this.scale; // Top edge position
      
      // Use setTargetPosition like layoutHand (same logic)
      card.setTargetPosition(x, y);
    });
  }

  /**
   * Update turn text display
   */
  private updateTurnText(): void {
    if (this.isPlayerTurn) {
      this.turnText = `Your Turn (${this.playerHand.length} cards)`;
    } else {
      this.turnText = `Opponent's Turn (${this.opponentHand.length} cards)`;
    }
  }

  /**
   * Play AI turn - simulates player drag mechanics
   */
  private playAITurn(): void {
    logger.info({
      scope: 'renderer/ai',
      msg: 'playAITurn called',
      meta: { opponentHandSize: this.opponentHand.length }
    });
    
    if (this.opponentHand.length === 0) {
      // AI has no cards, check for win or skip turn
      logger.warn({
        scope: 'renderer/ai',
        msg: 'AI has no cards, skipping turn',
        meta: { opponentHandSize: this.opponentHand.length }
      });
      
      // Switch back to player turn
      this.isPlayerTurn = true;
      this.updateTurnText();
      return;
    }

    // AI randomly selects a card from hand
    const randomIndex = Math.floor(Math.random() * this.opponentHand.length);
    const aiCard = this.opponentHand[randomIndex];
    
    // Simulate player drag mechanics - find correct position by scanning
    this.simulateAIDragToCorrectPosition(aiCard);
    
    logger.info({
      scope: 'renderer/ai',
      msg: 'AI starting drag simulation',
      meta: { 
        cardTitle: aiCard.card.title
      }
    });
  }

  /**
   * Simulate AI drag to find correct position using player mechanics
   */
  private simulateAIDragToCorrectPosition(aiCard: GameCard): void {
    // Start drag from opponent hand position
    const startX = aiCard.x;
    const startY = aiCard.y;
    
    // Simulate picking up card from hand
    aiCard.startDrag(startX, startY);
    
    // Animate card from hand to start scan position (left edge of axis)
    const axisY = this.gameCanvas.height / 2; // Same height as axis cards
    const scanStartX = 50 * this.scale; // Left edge where scanning starts
    const handToScanDuration = 400; // 400ms to move from hand to scan start
    const handToScanSteps = 20; // 20 steps
    const stepDuration = handToScanDuration / handToScanSteps;
    
    let step = 0;
    const handToScanInterval = setInterval(() => {
      // Interpolate from hand position to scan start position
      const progress = step / handToScanSteps;
      const currentX = startX + (scanStartX - startX) * progress;
      const currentY = startY + (axisY - startY) * progress;
      
      // Move card to scan start position
      aiCard.updateDrag(currentX, currentY);
      
      step++;
      if (step >= handToScanSteps) {
        clearInterval(handToScanInterval);
        
        // Now start scanning across the axis from left to right
        this.scanAxisForCorrectPosition(aiCard, axisY);
      }
    }, stepDuration);
  }
  
  /**
   * Scan across the axis to find the correct position for AI card
   */
  private scanAxisForCorrectPosition(aiCard: GameCard, axisY: number): void {
    const stepSize = 20 * this.scale; // Larger steps for faster scanning
    let currentX = 50 * this.scale; // Start from left edge
    const maxX = this.gameCanvas.width - 50 * this.scale; // End at right edge
    
    const scanInterval = setInterval(() => {
      // Move card to current position
      aiCard.updateDrag(currentX, axisY);
      
      // Check if this position is correct using the same logic as player
      const isCorrect = this.checkPositionCorrectness(aiCard, currentX);
      
      if (isCorrect) {
        // Found correct position! Place the card
        clearInterval(scanInterval);
        this.placeAICardAtPosition(aiCard, currentX, axisY);
        return;
      }
      
      // Move to next position
      currentX += stepSize;
      
      // If we've scanned the entire axis, place at the end
      if (currentX > maxX) {
        clearInterval(scanInterval);
        this.placeAICardAtPosition(aiCard, maxX, axisY);
      }
    }, 20); // 20ms between steps for faster animation
  }

  /**
   * Check if a position is correct for a card (same logic as player)
   */
  private checkPositionCorrectness(card: GameCard, x: number): boolean {
    // Get all cards currently on axis
    const allCards = [
      this.boardCard,
      ...this.placedLeft,
      ...this.placedRight
    ].filter(Boolean) as GameCard[];
    
    // Add the new card to the list
    const cardsWithNew = [...allCards, card];
    
    // Sort by axis value to find correct order
    const sortedCards = cardsWithNew.sort((a, b) => {
      const aValue = this.convertToMeters(a.card.value, a.card.unit);
      const bValue = this.convertToMeters(b.card.value, b.card.unit);
      return aValue - bValue;
    });
    
    // Find the index of the new card in the sorted list
    const cardIndex = sortedCards.findIndex(c => c === card);
    
    // Calculate what the correct X position should be
    const cardWidth = 200 * this.scale;
    const spacing = 5 * this.scale;
    const totalWidth = sortedCards.length * cardWidth + (sortedCards.length - 1) * spacing;
    const startX = (this.gameCanvas.width - totalWidth) / 2;
    const correctX = startX + cardIndex * (cardWidth + spacing);
    
    // Check if current position is close to correct position
    const tolerance = 20 * this.scale; // 20px tolerance
    return Math.abs(x - correctX) < tolerance;
  }

  /**
   * Place AI card at the found position
   */
  private placeAICardAtPosition(aiCard: GameCard, x: number, y: number): void {
    // Stop dragging
    aiCard.stopDrag();
    
    // Set final position
    aiCard.setTargetPosition(x, y);
    
         // After animation, update game state
     setTimeout(() => {
       // Remove the specific card from opponent hand
       const cardIndex = this.opponentHand.indexOf(aiCard);
       if (cardIndex > -1) {
         this.opponentHand.splice(cardIndex, 1);
         this.layoutOpponentHand();
       }
      
      // Add to appropriate array based on position
      const boardCenterX = this.boardCard ? (this.boardCard.x + this.boardCard.width / 2) : this.gameCanvas.width / 2;
      const isLeft = x < boardCenterX;
      
      if (isLeft) {
        this.placedLeft.push(aiCard);
        aiCard.isInHand = false;
      } else {
        this.placedRight.push(aiCard);
        aiCard.isInHand = false;
      }
      
      // Center all cards
      this.layoutAxisCards();
      
      // Mark card as correct
              aiCard.setCorrect();
      
      // Switch back to player turn
      this.isPlayerTurn = true;
      this.currentTurn++;
      this.updateTurnText();
      
      // Check for AI win
      this.checkForWin();
      
      logger.info({
        scope: 'renderer/ai',
        msg: 'AI card placed successfully',
        meta: { 
          cardTitle: aiCard.card.title,
          turn: this.currentTurn,
          position: { x, y }
        }
      });
    }, 1000); // Wait for animation
  }

  /**
   * Find the correct position for a card on the axis
   */
  private findCorrectPosition(card: GameCard): number {
    // Get all cards currently on axis
    const allCards = [
      this.boardCard,
      ...this.placedLeft,
      ...this.placedRight
    ].filter(Boolean) as GameCard[];
    
    // Add the new card to the list
    const cardsWithNew = [...allCards, card];
    
    // Sort by axis value to find correct position
    const sortedCards = cardsWithNew.sort((a, b) => {
      const aValue = this.convertToMeters(a.card.value, a.card.unit);
      const bValue = this.convertToMeters(b.card.value, b.card.unit);
      return aValue - bValue;
    });
    
    // Find the index of the new card in the sorted list
    const cardIndex = sortedCards.findIndex(c => c === card);
    
    // Calculate position based on index
    const cardWidth = 200 * this.scale;
    const spacing = 5 * this.scale;
    const totalWidth = sortedCards.length * cardWidth + (sortedCards.length - 1) * spacing;
    const startX = (this.gameCanvas.width - totalWidth) / 2;
    
    return startX + cardIndex * (cardWidth + spacing);
  }

  /**
   * Animate AI card to its correct position
   */
  private animateAICardToPosition(card: GameCard, targetX: number): void {
    const axisY = this.gameCanvas.height / 2;
    const targetY = axisY - card.height / 2;
    
    // Animate card to position
    card.setTargetPosition(targetX, targetY);
    
    // After animation, update game state
    setTimeout(() => {
      // Remove from opponent hand
      this.opponentHand = this.opponentHand.filter(c => c !== card);
      this.layoutOpponentHand();
      
      // Add to appropriate array based on position
      const boardCenterX = this.boardCard ? (this.boardCard.x + this.boardCard.width / 2) : this.gameCanvas.width / 2;
      const isLeft = targetX < boardCenterX;
      
      if (isLeft) {
        this.placedLeft.push(card);
        card.isInHand = false;
      } else {
        this.placedRight.push(card);
        card.isInHand = false;
      }
      
      // Center all cards
      this.layoutAxisCards();
      
      // Mark card as correct
              card.setCorrect();
      
      // Switch back to player turn
      this.isPlayerTurn = true;
      this.currentTurn++;
      this.updateTurnText();
      
      // Check for AI win
      this.checkForWin();
      
      logger.info({
        scope: 'renderer/ai',
        msg: 'AI card placed successfully',
        meta: { 
          cardTitle: card.card.title,
          turn: this.currentTurn
        }
      });
    }, 1000); // Wait for animation
  }

  /**
   * Handle mouse down
   */
  private handleMouseDown(event: MouseEvent): void {
    // Only allow interaction during player turn
    if (!this.isPlayerTurn || this.gameWon || this.gameLost) {
      return;
    }
    
    const rect = this.gameCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    console.log('handleMouseDown called:', { x, y, handSize: this.playerHand.length });
    
    // Check player hand cards
    for (const card of this.playerHand) {
      if (card.containsPoint(x, y)) {
        console.log('Card selected:', card.card.title);
        this.selectedCard = card;
        card.startDrag(x, y);
        this.isDragging = true;
        break;
      }
    }
    
    console.log('After mouse down:', { 
      isDragging: this.isDragging, 
      hasSelectedCard: !!this.selectedCard 
    });
  }

  /**
   * Handle mouse move
   */
  private handleMouseMove(event: MouseEvent): void {
    console.log('handleMouseMove called:', { 
      isDragging: this.isDragging, 
      hasSelectedCard: !!this.selectedCard 
    });
    
    if (this.isDragging && this.selectedCard) {
      const rect = this.gameCanvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      console.log('Dragging card to:', { x, y });
      
      this.selectedCard.updateDrag(x, y);
      
      // Show preview of where card would be placed on axis
      this.showPlacementPreview(x, y);
    } else {
      // Handle hover effects for hand cards
      const rect = this.gameCanvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      // Clear hover on non-hand groups
      if (this.boardCard) this.boardCard.isHovered = false;
      for (const c of this.placedLeft) c.isHovered = false;
      for (const c of this.placedRight) c.isHovered = false;
      
      // Reset hover on hand
      for (const c of this.playerHand) c.isHovered = false;
      
      // Set hover for hand card under mouse
      for (const card of this.playerHand) {
        if (card.containsPoint(x, y)) {
          card.isHovered = true;
          break;
        }
      }
    }
  }

  /**
   * Show preview of where card would be placed on axis
   */
  private showPlacementPreview(mouseX: number, mouseY: number): void {
    // Define the axis area as a collision box
    const axisY = this.gameCanvas.height / 2;
    const axisHeight = 100; // Height of the axis collision area
    const axisTop = axisY - axisHeight / 2;
    const axisBottom = axisY + axisHeight / 2;
    
    // Check if mouse is within the axis collision box
    const isOverAxis = mouseY >= axisTop && mouseY <= axisBottom;
    
    // Simple test: log every time this method is called
    console.log('showPlacementPreview called:', { mouseX, mouseY, isOverAxis });
    
    logger.debug({
      scope: 'renderer/preview',
      msg: 'showPlacementPreview called',
      meta: { 
        mouseX, 
        mouseY, 
        axisY,
        axisTop,
        axisBottom,
        isOverAxis
      }
    });
    
    if (isOverAxis) {
      // Show preview by temporarily moving existing cards to make space
      this.showAxisPreview(mouseX);
    } else {
      // Hide preview by restoring original positions
      this.hideAxisPreview();
    }
  }

  /**
   * Show axis preview by moving cards to make space
   */
  private showAxisPreview(previewX: number): void {
    if (!this.boardCard) return;
    
    // Only move cards if preview is not already active
    if (this.isPreviewActive) {
      return;
    }
    
    console.log('showAxisPreview called with previewX:', previewX);
    
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
      
      logger.debug({
        scope: 'renderer/preview',
        msg: 'set preview position for card',
        meta: { 
          cardTitle: card.card.title,
          oldX: card.x,
          newX: newX,
          previewX: previewX,
          cardCenterX: cardCenterX
        }
      });
    });
    
    // Mark preview as active
    this.isPreviewActive = true;
    
    logger.debug({
      scope: 'renderer/preview',
      msg: 'preview activated',
      meta: { 
        previewX, 
        cardsCount: allCards.length,
        spreadDistance 
      }
    });
  }

  /**
   * Hide axis preview by restoring original positions
   */
  private hideAxisPreview(): void {
    // Only restore if preview was active
    if (!this.isPreviewActive) {
      return;
    }
    
    logger.debug({
      scope: 'renderer/preview',
      msg: 'hiding axis preview'
    });
    
    if (this.boardCard) this.boardCard.clearPreviewPosition();
    for (const card of this.placedLeft) card.clearPreviewPosition();
    for (const card of this.placedRight) card.clearPreviewPosition();
    
    // Mark preview as inactive
    this.isPreviewActive = false;
  }

  /**
   * Handle mouse up
   */
  private handleMouseUp(event: MouseEvent): void {
    if (this.isDragging && this.selectedCard) {
      // Snap logic: if released near axis, place left/right of center
      const releasedCard = this.selectedCard;
      releasedCard.stopDrag();

      const axisY = this.gameCanvas.height / 2;
      const distToAxis = Math.abs((releasedCard.y + releasedCard.height / 2) - axisY);
      if (distToAxis <= this.snapThreshold) {
        // 1. SNAP: Snap to axis at exact position
        const snapX = releasedCard.x + releasedCard.width / 2; // Use the exact X position where card was dropped
        const snapY = axisY - releasedCard.height / 2;
        
        // Determine if it's left or right of center for array placement
        const boardCenterX = this.boardCard ? (this.boardCard.x + this.boardCard.width / 2) : this.gameCanvas.width / 2;
        const isLeft = snapX < boardCenterX;
        
        // Set the exact position where the card was dropped
        releasedCard.setTargetPosition(snapX - releasedCard.width / 2, snapY);
        
        // Add to appropriate array based on position relative to center
        if (isLeft) {
          this.placedLeft.push(releasedCard);
          releasedCard.isInHand = false;
        } else {
          this.placedRight.push(releasedCard);
          releasedCard.isInHand = false;
        }

        // Remove from hand immediately after snap
        this.playerHand = this.playerHand.filter((c) => c !== releasedCard);
        this.layoutHand();

        // Clear any preview positions
        this.hideAxisPreview();

        // 3. CHECK: Evaluate placement correctness
        // Create a sorted list of all cards based on their actual X positions
        const allAxisCards = [
          this.boardCard,
          ...this.placedLeft,
          ...this.placedRight
        ].filter(Boolean) as GameCard[];
        
        // Sort by X position to get the actual order on the axis
        const sortedAxisCards = allAxisCards.sort((a, b) => a.x - b.x);
        
        // Extract just the card data for evaluation
        const sortedCardData = sortedAxisCards.map(gc => gc.card);
        
        const isCorrect = sortedCardData.length > 0 
          ? isAxisCorrectlySorted(sortedCardData)
          : true; // Default to correct if no cards

        if (isCorrect) {
          // 4. STAY: Correct placement - card stays and turns green
          this.score += getScore(releasedCard.card);
          releasedCard.setCorrect();
          
          // 5. CENTER: Center the axis immediately after correct placement
          this.layoutAxisCards();
          
          // 6. TURN-BASED: Switch turns
          this.isPlayerTurn = false;
          this.currentTurn++;
          this.updateTurnText();
          
          // 7. CHECK FOR WIN: Check if player has won
          this.checkForWin();
          
          // 8. AI TURN: If game not over and AI has cards, let AI play
          if (!this.gameWon && !this.gameLost && this.opponentHand.length > 0) {
            setTimeout(() => {
              this.playAITurn();
            }, 1000); // 1 second delay
          } else {
            // Keep player turn if AI has no cards
            this.isPlayerTurn = true;
            this.updateTurnText();
          }
          
          logger.info({
            scope: 'renderer/game',
            msg: 'card placed correctly, turned green',
            meta: { 
              cardTitle: releasedCard.card.title, 
              score: this.score,
              turn: this.currentTurn
            }
          });
        } else {
          // 4. REMOVE: Incorrect placement - card turns red and will be moved to graveyard
          releasedCard.setIncorrect();
          
          // Give player a new card from the deck
          this.giveNewCard();

          // Move card to graveyard after 2 seconds with animation
          setTimeout(() => {
            this.placedLeft = this.placedLeft.filter((c) => c !== releasedCard);
            this.placedRight = this.placedRight.filter((c) => c !== releasedCard);
            
            // Add to graveyard and animate to graveyard position
            this.graveyard.push(releasedCard);
            this.animateCardToGraveyard(releasedCard);
            
            // 5. CENTER: Re-center after removal
            this.layoutAxisCards();
          }, 2000);

          logger.info({
            scope: 'renderer/game',
            msg: 'card placed incorrectly, turned red, will be moved to graveyard in 2 seconds',
            meta: { 
              cardTitle: releasedCard.card.title,
              turn: this.currentTurn
            }
          });
        }
        
        logger.info({
          scope: 'renderer/game',
          msg: 'card placed on axis',
          meta: { 
            cardTitle: releasedCard.card.title,
            turn: this.currentTurn
          }
        });
      } else {
        // Card was released outside the axis - return it to hand
        console.log('Card released outside axis - returning to hand');
        
        // Clear any preview positions
        this.hideAxisPreview();
        
        // Return card to hand by re-layouting
        this.layoutHand();
        
        logger.info({
          scope: 'renderer/game',
          msg: 'card returned to hand (released outside axis)',
          meta: { cardTitle: releasedCard.card.title }
        });
      }

      this.isDragging = false;
      this.selectedCard = null;
    }
  }

  /**
   * Start game loop
   */
  private startGameLoop(): void {
    this.lastTime = performance.now();
    this.gameLoop();
  }

  /**
   * Game loop
   */
  private gameLoop(): void {
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastTime;
    
    if (deltaTime >= 1000 / this.fps) {
      this.update(deltaTime);
      this.render();
      this.lastTime = currentTime;
    }
    
    this.animationId = requestAnimationFrame(this.gameLoop.bind(this));
  }

  /**
   * Update game state
   */
  private update(deltaTime: number): void {
    // Update FPS counter
    this.fpsCounter.textContent = Math.round(1000 / deltaTime).toString();

    // Tick animations for all cards
    if (this.boardCard) {
      this.boardCard.tick?.();
    }
    for (const c of this.playerHand) {
      c.tick?.();
    }
    for (const c of this.opponentHand) {
      c.tick?.();
    }
    for (const c of this.placedLeft) {
      c.tick?.();
    }
    for (const c of this.placedRight) {
      c.tick?.();
    }
    for (const c of this.graveyard) {
      c.tick?.();
    }
  }

  /**
   * Render game
   */
  private render(): void {
    const ctx = this.gameContext;
    const width = this.gameCanvas.width;
    const height = this.gameCanvas.height;
    
    // Clear canvas
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, width, height);
    
    // Draw axis line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(100, height / 2);
    ctx.lineTo(width - 100, height / 2);
    ctx.stroke();
    
    // Draw axis collision area (debug visualization)
    const axisY = height / 2;
    const axisHeight = 100;
    const axisTop = axisY - axisHeight / 2;
    ctx.fillStyle = 'rgba(255, 255, 0, 0.2)'; // Semi-transparent yellow
    ctx.fillRect(100, axisTop, width - 200, axisHeight);
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(100, axisTop, width - 200, axisHeight);
    
    // Draw axis label
    ctx.fillStyle = '#ffffff';
    ctx.font = `${24 * this.scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('Höhe (m)', width / 2, height / 2 - 50 * this.scale);
    
    // Draw board card (if exists)
    if (this.boardCard) {
      this.boardCard.render(ctx);
    }
    
    // Draw player hand cards
    for (const card of this.playerHand) {
      card.render(ctx);
    }

    // Draw opponent hand cards (show card backs)
    for (const card of this.opponentHand) {
      this.drawOpponentCardBack(ctx, card);
    }
    
    // Debug: Log opponent hand size
    ctx.fillStyle = '#ff0000';
    ctx.font = `${12 * this.scale}px Arial`;
    ctx.textAlign = 'left';
    ctx.fillText(`Opponent: ${this.opponentHand.length} cards`, 20 * this.scale, 90 * this.scale);
    
    // Debug: Show opponent cards in plain text
    ctx.fillStyle = '#ffff00';
    ctx.font = `${10 * this.scale}px Arial`;
    ctx.textAlign = 'left';
    let yOffset = 120 * this.scale;
    ctx.fillText('Opponent Cards:', 20 * this.scale, yOffset);
    yOffset += 15 * this.scale;
    
    this.opponentHand.forEach((card, index) => {
      const cardText = `${index + 1}. ${card.card.title} (${card.card.displayValue}) [x:${Math.round(card.x)}, y:${Math.round(card.y)}]`;
      ctx.fillText(cardText, 20 * this.scale, yOffset);
      yOffset += 12 * this.scale;
      
      // Show target position if different from current
      if (card.targetX !== undefined && card.targetY !== undefined && card.targetX !== null && card.targetY !== null) {
        const targetText = `   Target: [x:${Math.round(card.targetX)}, y:${Math.round(card.targetY)}]`;
        ctx.fillText(targetText, 20 * this.scale, yOffset);
        yOffset += 12 * this.scale;
      }
    });
    
    // Debug: Show remaining cards info
    yOffset += 10 * this.scale;
    ctx.fillStyle = '#00ffff';
    ctx.fillText(`Remaining Cards: ${this.remainingCards.length}`, 20 * this.scale, yOffset);
    yOffset += 12 * this.scale;
    ctx.fillText(`Player Hand: ${this.playerHand.length}`, 20 * this.scale, yOffset);
    yOffset += 12 * this.scale;
    ctx.fillText(`Opponent Hand: ${this.opponentHand.length}`, 20 * this.scale, yOffset);
    yOffset += 12 * this.scale;
    ctx.fillText(`Total: ${this.remainingCards.length + this.playerHand.length + this.opponentHand.length + 1}`, 20 * this.scale, yOffset); // +1 for board card
    
    // Debug: Show player hand positions
    yOffset += 15 * this.scale;
    ctx.fillStyle = '#00ff00';
    ctx.fillText('Player Cards:', 20 * this.scale, yOffset);
    yOffset += 15 * this.scale;
    
    this.playerHand.forEach((card, index) => {
      const cardText = `${index + 1}. ${card.card.title} (${card.card.displayValue}) [x:${Math.round(card.x)}, y:${Math.round(card.y)}]`;
      ctx.fillText(cardText, 20 * this.scale, yOffset);
      yOffset += 12 * this.scale;
      
      // Show target position if different from current
      if (card.targetX !== undefined && card.targetY !== undefined && card.targetX !== null && card.targetY !== null) {
        const targetText = `   Target: [x:${Math.round(card.targetX)}, y:${Math.round(card.targetY)}]`;
        ctx.fillText(targetText, 20 * this.scale, yOffset);
        yOffset += 12 * this.scale;
      }
    });

    // Draw placed stacks
    for (const card of this.placedLeft) {
      if (card.isCorrect === false) {
        // Add pulsing effect for incorrect cards
        const pulseIntensity = 0.5 + 0.5 * Math.sin(Date.now() * 0.01); // Fast pulse
        ctx.globalAlpha = pulseIntensity;
      }
      card.render(ctx);
      ctx.globalAlpha = 1; // Reset alpha
    }
    for (const card of this.placedRight) {
      if (card.isCorrect === false) {
        // Add pulsing effect for incorrect cards
        const pulseIntensity = 0.5 + 0.5 * Math.sin(Date.now() * 0.01); // Fast pulse
        ctx.globalAlpha = pulseIntensity;
      }
      card.render(ctx);
      ctx.globalAlpha = 1; // Reset alpha
    }
    
    // Draw score and turn information
    ctx.fillStyle = '#ffffff';
    ctx.font = `${18 * this.scale}px Arial`;
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${this.score}`, 20 * this.scale, 40 * this.scale);
    ctx.fillText(`Turn: ${this.currentTurn}`, 20 * this.scale, 65 * this.scale);
    
    // Draw turn text
    if (this.turnText) {
      ctx.fillStyle = this.isPlayerTurn ? '#4caf50' : '#ff9800';
      ctx.font = `bold ${20 * this.scale}px Arial`;
      ctx.textAlign = 'left';
      ctx.fillText(this.turnText, 20 * this.scale, 110 * this.scale); // Directly under "Opponent: 5 cards"
    }
    
    // Draw deck stack
    this.drawDeckStack(ctx);
    
    // Draw hand position indicators (gray boxes)
    this.drawHandPositionIndicators(ctx);
    
    // Draw graveyard cards
    for (const card of this.graveyard) {
      card.render(ctx);
    }
    
    // Draw graveyard label
    if (this.graveyard.length > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `${16 * this.scale}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('Graveyard', this.gameCanvas.width - 150 * this.scale + 60 * this.scale, 30 * this.scale);
    }
    
    // Draw win overlay if game is won
    if (this.gameWon) {
      // Semi-transparent overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(0, 0, this.gameCanvas.width, this.gameCanvas.height);
      
      // Congratulations text
      ctx.fillStyle = '#4caf50';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('🎉 Congratulations! 🎉', this.gameCanvas.width / 2, this.gameCanvas.height / 2 - 50);
      
      // Subtitle
      ctx.fillStyle = '#ffffff';
      ctx.font = '24px Arial';
      ctx.fillText('You have successfully sorted all cards!', this.gameCanvas.width / 2, this.gameCanvas.height / 2);
      
      // Final score
      ctx.font = '20px Arial';
      ctx.fillText(`Final Score: ${this.score}`, this.gameCanvas.width / 2, this.gameCanvas.height / 2 + 40);
      
      // Instructions
      ctx.font = '18px Arial';
      ctx.fillStyle = '#cccccc';
      ctx.fillText('Check the dialog for next steps...', this.gameCanvas.width / 2, this.gameCanvas.height / 2 + 80);
    }
  }

     /**
    * Give player a new card from the deck (turn-based)
    */
   private giveNewCard(): void {
     if (this.remainingCards.length > 0) {
       const newCardData = this.remainingCards.shift()!;
       const newCard = new GameCard(
         newCardData,
         50 * this.scale, // Start position at deck (left)
         this.gameCanvas.height / 2 + 20 * this.scale, // Deck Y position
         this.scale
       );
       
       // Animate card from deck to hand (same as initial hand cards)
       this.animateCardToHand(newCard);
       
       // Switch to opponent turn after giving new card
       this.isPlayerTurn = false;
       this.updateTurnText();
       
       // Let AI play after a short delay
       setTimeout(() => {
         this.playAITurn();
       }, 1000);
       
       logger.info({
         scope: 'renderer/game',
         msg: 'new card given to player (turn-based)',
         meta: { 
           cardTitle: newCardData.title, 
           remainingCards: this.remainingCards.length,
           turn: this.currentTurn
         }
       });
     }
   }

   

   /**
    * Draw deck stack
    */
   private drawDeckStack(ctx: CanvasRenderingContext2D): void {
         const deckX = 50 * this.scale;
    const deckY = this.gameCanvas.height - 320 * this.scale; // Same height as player hand
         const cardWidth = 200 * this.scale;
    const cardHeight = 300 * this.scale;
     const stackHeight = Math.min(this.remainingCards.length, 5); // Max 5 cards visible
     
     // Draw stacked cards
     for (let i = 0; i < stackHeight; i++) {
       const offsetY = i * 2; // Small offset for stack effect
       
       // Card background
       ctx.fillStyle = '#4a90e2';
       ctx.globalAlpha = 0.8 - (i * 0.1); // Fade effect
       this.roundRect(ctx, deckX, deckY - offsetY, cardWidth, cardHeight, 8);
       ctx.fill();
       
       // Card border
       ctx.strokeStyle = '#2a5a8a';
       ctx.lineWidth = 2;
       ctx.stroke();
       
       // Card back pattern - Axes Mundi Logo
       this.drawAxesMundiLogoImage(ctx, deckX, deckY - offsetY, cardWidth, cardHeight);
     }
     
     // Reset alpha
     ctx.globalAlpha = 1;
     
         // Draw deck count
    ctx.fillStyle = '#ffffff';
    ctx.font = `${16 * this.scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(`${this.remainingCards.length}`, deckX + cardWidth / 2, deckY + cardHeight + 25 * this.scale);
   }

   /**
    * Draw hand position indicators (single gray box per hand)
    */
   private drawHandPositionIndicators(ctx: CanvasRenderingContext2D): void {
     const cardWidth = 200 * this.scale;
     const cardHeight = 300 * this.scale;
     const cardSpacing = 220 * this.scale;
     
     // Draw player hand area (bottom) - single large box
     const playerTotalWidth = 5 * cardSpacing - 20 * this.scale;
     const playerStartX = (this.gameCanvas.width - playerTotalWidth) / 2;
     const playerY = this.gameCanvas.height - 320 * this.scale;
     
     ctx.fillStyle = 'rgba(128, 128, 128, 0.2)'; // Semi-transparent gray
     ctx.strokeStyle = 'rgba(128, 128, 128, 0.5)';
     ctx.lineWidth = 2;
     
     // Single box covering entire player hand area
     this.roundRect(ctx, playerStartX - 10 * this.scale, playerY - 10 * this.scale, 
                   playerTotalWidth + 20 * this.scale, cardHeight + 20 * this.scale, 12);
     ctx.fill();
     ctx.stroke();
     
     // Draw opponent hand area (top) - single large box
     const opponentTotalWidth = 5 * cardSpacing - 20 * this.scale;
     const opponentStartX = (this.gameCanvas.width - opponentTotalWidth) / 2;
     const opponentY = 20 * this.scale;
     
     // Single box covering entire opponent hand area
     this.roundRect(ctx, opponentStartX - 10 * this.scale, opponentY - 10 * this.scale, 
                   opponentTotalWidth + 20 * this.scale, cardHeight + 20 * this.scale, 12);
     ctx.fill();
     ctx.stroke();
     
     // Draw labels
     ctx.fillStyle = '#ffffff';
     ctx.font = `${14 * this.scale}px Arial`;
     ctx.textAlign = 'center';
     ctx.fillText('Player Hand', this.gameCanvas.width / 2, playerY - 20 * this.scale);
     ctx.fillText('Opponent Hand', this.gameCanvas.width / 2, opponentY + cardHeight + 40 * this.scale);
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
     this.drawRoundedRect(ctx, x, y, width, height, 6);
     
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
   * Draw opponent card back (Axes Mundi logo)
   */
  private drawOpponentCardBack(ctx: CanvasRenderingContext2D, card: GameCard): void {
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
     this.drawRoundedRect(ctx, x, y, width, height, 6);
     
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
     
     // Latitude lines (curved)
     ctx.lineWidth = 2;
     ctx.beginPath();
     ctx.arc(symbolX, symbolY, symbolSize * 0.3, 0, Math.PI);
     ctx.stroke();
     ctx.beginPath();
     ctx.arc(symbolX, symbolY, symbolSize * 0.2, 0, Math.PI);
     ctx.stroke();
     
     // Draw text "AXES MUNDI"
     ctx.fillStyle = logoColor;
     ctx.font = `bold ${textSize * 0.4}px serif`;
     ctx.textAlign = 'center';
     ctx.fillText('AXES', centerX, centerY + textSize * 0.3);
     ctx.fillText('MUNDI', centerX, centerY + textSize * 0.7);
     
     // Restore context
     ctx.restore();
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

   /**
    * Layout remaining hand cards nicely along bottom
    */
   private layoutHand(): void {
         const cardSpacing = 220 * this.scale; // Increased spacing for larger cards
    const totalWidth = this.playerHand.length * cardSpacing - 20 * this.scale; // Scaled spacing
    const startX = (this.gameCanvas.width - totalWidth) / 2; // Center the hand
    this.playerHand.forEach((card, index) => {
      const x = startX + index * cardSpacing;
      const y = this.gameCanvas.height - 320 * this.scale;
      card.setTargetPosition(x, y);
    });
   }

  /**
   * Layout all cards on the axis - center them with fixed 5px spacing
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
    
    // Use fixed 5px spacing between cards
    const cardWidth = 200 * this.scale;
    const spacing = 5 * this.scale; // Fixed 5px spacing as requested
    
    // Calculate total width needed
    const totalWidth = sortedCards.length * cardWidth + (sortedCards.length - 1) * spacing;
    const startX = (this.gameCanvas.width - totalWidth) / 2; // Center the entire spread
    
    // Set target positions for smooth animation
    const axisY = this.gameCanvas.height / 2;
    
    sortedCards.forEach((card, index) => {
      const x = startX + index * (cardWidth + spacing);
      const y = axisY - card.height / 2;
      card.setTargetPosition(x, y);
    });
  }

  /**
   * Check if player has won the game (turn-based)
   */
  private checkForWin(): void {
    // Check for player win (hand empty)
    if (this.playerHand.length === 0 && !this.gameLost) {
      this.gameWon = true;
      
      logger.info({
        scope: 'renderer/game',
        msg: 'PLAYER WON THE GAME!',
        meta: { 
          finalScore: this.score,
          finalTurn: this.currentTurn,
          remainingCards: this.remainingCards.length
        }
      });
      
      // Show win dialog after 4 seconds delay
      setTimeout(() => {
        this.showWinDialog();
      }, 4000);
    }
    
    // Check for AI win (opponent hand empty)
    if (this.opponentHand.length === 0 && !this.gameWon) {
      this.gameLost = true;
      
      logger.info({
        scope: 'renderer/game',
        msg: 'PLAYER LOST THE GAME!',
        meta: { 
          finalScore: this.score,
          finalTurn: this.currentTurn,
          remainingCards: this.remainingCards.length
        }
      });
      
      // Show lose dialog after 4 seconds delay
      setTimeout(() => {
        this.showLoseDialog();
      }, 4000);
    }
  }

  /**
   * Show win dialog
   */
  private showWinDialog(): void {
    const playAgain = confirm('🎉 Congratulations! 🎉\n\nYou have successfully sorted all cards!\n\nFinal Score: ' + this.score + '\nTurns taken: ' + this.currentTurn + '\n\nWant to play again?');
    
    if (playAgain) {
      this.restartGame();
    } else {
      // Could close the app or show main menu
      logger.info({
        scope: 'renderer/game',
        msg: 'player chose not to play again'
      });
    }
  }

  /**
   * Show lose dialog
   */
  private showLoseDialog(): void {
    const playAgain = confirm('😔 You Lost! 😔\n\nYour opponent sorted all their cards first!\n\nFinal Score: ' + this.score + '\nTurns taken: ' + this.currentTurn + '\n\nWant to play again?');
    
    if (playAgain) {
      this.restartGame();
    } else {
      // Could close the app or show main menu
      logger.info({
        scope: 'renderer/game',
        msg: 'player chose not to play again after losing'
      });
    }
  }

  /**
   * Restart the game
   */
  private restartGame(): void {
    logger.info({
      scope: 'renderer/game',
      msg: 'restarting game'
    });
    
    // Reset game state
    this.gameWon = false;
    this.gameLost = false;
    this.score = 0;
    this.playerHand = [];
    this.opponentHand = [];
    this.placedLeft = [];
    this.placedRight = [];
    this.graveyard = [];
    this.selectedCard = null;
    this.isDragging = false;
    this.isPreviewActive = false;
    this.isGameStarted = false;
    this.currentTurn = 0;
    this.isPlayerTurn = true;
    this.turnText = '';
    
    // Reload the game
    this.loadGame();
  }

  /**
   * Animate card to graveyard position
   */
  private animateCardToGraveyard(card: GameCard): void {
    // Calculate graveyard position (top right corner)
    const graveyardX = this.gameCanvas.width - 150 * this.scale; // 150px from right edge
    const graveyardY = 50 * this.scale; // 50px from top
    
    // Set target position for smooth animation
    card.setTargetPosition(graveyardX, graveyardY);
    
    logger.info({
      scope: 'renderer/game',
      msg: 'card animated to graveyard',
      meta: { cardTitle: card.card.title, graveyardX, graveyardY }
    });
  }

  /**
   * Update scale for all existing cards
   */
  private updateAllCardsScale(): void {
    // Update board card
    if (this.boardCard) {
      this.boardCard.updateScale(this.scale);
    }
    
    // Update player hand cards
    for (const card of this.playerHand) {
      card.updateScale(this.scale);
    }
    
    // Update opponent hand cards
    for (const card of this.opponentHand) {
      card.updateScale(this.scale);
    }
    
    // Update placed cards
    for (const card of this.placedLeft) {
      card.updateScale(this.scale);
    }
    for (const card of this.placedRight) {
      card.updateScale(this.scale);
    }
    
    // Update graveyard cards
    for (const card of this.graveyard) {
      card.updateScale(this.scale);
    }
  }

  /**
   * Convert value to meters for comparison
   */
  private convertToMeters(value: number, unit: string): number {
    switch (unit.toLowerCase()) {
      case 'm':
        return value;
      case 'km':
        return value * 1000;
      case 'cm':
        return value / 100;
      case 'mm':
        return value / 1000;
      default:
        return value;
    }
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
    radius: number
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
   * Load app information from main process
   */
  private async loadAppInfo(): Promise<void> {
    try {
      // Always use fallback values for now to ensure app loads
      this.versionElement.textContent = '1.0.0';
      this.envElement.textContent = 'development';
      
      // Hide loading screen immediately
      this.loadingElement.style.display = 'none';
      
      logger.info({ 
        scope: 'renderer/app', 
        msg: 'app info loaded (fallback mode)', 
        meta: { version: '1.0.0', env: 'development' } 
      });
      
      // Try to get real values if AXM API is available
      if (window.AXM) {
        try {
          const [version, env] = await Promise.all([
            window.AXM.getVersion(),
            window.AXM.getEnvironment(),
          ]);
          
          this.versionElement.textContent = version;
          this.envElement.textContent = env.env;
          
          logger.info({ 
            scope: 'renderer/app', 
            msg: 'real app info loaded', 
            meta: { version, env: env.env } 
          });
        } catch (ipcError) {
          logger.warn({ 
            scope: 'renderer/app', 
            msg: 'IPC failed, keeping fallback values', 
            err: { message: ipcError.message } 
          });
        }
      } else {
        logger.warn({ scope: 'renderer/app', msg: 'AXM API not available, using fallback' });
      }
    } catch (error) {
      logger.error({ 
        scope: 'renderer/app', 
        msg: 'failed to load app info', 
        err: { message: error.message, stack: error.stack } 
      });
      
      // Ensure loading screen is hidden even on error
      this.loadingElement.style.display = 'none';
    }
  }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  try {
    new AxesMundiApp();
    logger.info({ scope: 'renderer/app', msg: 'app initialized successfully' });
  } catch (error) {
    logger.error({ 
      scope: 'renderer/app', 
      msg: 'app initialization failed', 
      err: { message: error.message, stack: error.stack } 
    });
    
    // Show error to user
    const loadingElement = document.getElementById('loading') as HTMLElement;
    if (loadingElement) {
      loadingElement.textContent = 'Failed to initialize app';
      loadingElement.style.color = '#ff4444';
    }
  }
});
