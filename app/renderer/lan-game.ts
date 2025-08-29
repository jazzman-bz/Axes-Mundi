import { logger } from '@/utils/logger';
import { loadDeck } from '@/data/deckLoader';
import { Card as CardData } from '@/data/types';

/**
 * LAN Game Manager - Handles card distribution for LAN mode without full game UI
 */
export class LANGameManager {
  private deck: any = null;
  private remainingCards: CardData[] = [];
  private playerHand: CardData[] = [];
  private opponentHand: CardData[] = [];
  private boardCard: CardData | null = null;
  private isServerClient: boolean = false;
  private serverPlayerName: string = '';
  private clientPlayerName: string = '';
  private currentPlayer: string = ''; // Wer ist am Zug

  constructor() {
    console.log('🎮 LANGameManager constructor called');
    console.log('🎮 localStorage.getItem("isServerClient"):', localStorage.getItem('isServerClient'));
    
    this.isServerClient = localStorage.getItem('isServerClient') === 'true';
    this.serverPlayerName = localStorage.getItem('serverPlayerName') || 'Server';
    this.clientPlayerName = localStorage.getItem('clientPlayerName') || 'Client';
    // currentPlayer wird beim Spielstart zufällig gesetzt
    
    console.log('🎮 LANGameManager constructor - isServerClient set to:', this.isServerClient);
    console.log('🎮 LANGameManager constructor - serverPlayerName:', this.serverPlayerName);
    console.log('🎮 LANGameManager constructor - clientPlayerName:', this.clientPlayerName);
  }

  /**
   * Set current player randomly at game start
   */
  setCurrentPlayerRandomly(): void {
    // Random selection: true = server starts, false = client starts
    const serverStarts = Math.random() < 0.5;
    this.currentPlayer = serverStarts ? this.serverPlayerName : this.clientPlayerName;
    
    // Store current player in localStorage for consistency
    localStorage.setItem('currentPlayer', this.currentPlayer);
    
    logger.info({
      scope: 'renderer/lan',
      msg: 'current player set randomly',
      meta: { currentPlayer: this.currentPlayer, serverStarts }
    });
  }

  /**
   * Update current player after turn
   */
  updateCurrentPlayer(): void {
    if (this.currentPlayer === this.serverPlayerName) {
      this.currentPlayer = this.clientPlayerName;
    } else {
      this.currentPlayer = this.serverPlayerName;
    }
    
    logger.info({
      scope: 'renderer/lan',
      msg: 'current player updated',
      meta: { currentPlayer: this.currentPlayer }
    });
  }

  /**
   * Get current player name
   */
  getCurrentPlayer(): string {
    return this.currentPlayer;
  }

  /**
   * Get board card
   */
  getBoardCard(): CardData | null {
    return this.boardCard;
  }

  /**
   * Get server hand (player hand)
   */
  getServerHand(): CardData[] {
    return this.playerHand;
  }

  /**
   * Get client hand (opponent hand)
   */
  getClientHand(): CardData[] {
    return this.opponentHand;
  }

  /**
   * Get card distribution for canvas rendering
   */
  getCardDistribution(): any {
    if (!this.deck || !this.boardCard) {
      return null;
    }
    
    return {
      deckId: this.deck.id,
      boardCard: this.boardCard,
      serverHand: this.playerHand,
      clientHand: this.opponentHand,
      deckOrder: this.remainingCards,
      currentPlayer: this.currentPlayer
    };
  }

  /**
   * Set player names from landing page
   */
  setPlayerNames(serverPlayerName: string, clientPlayerName: string): void {
    this.serverPlayerName = serverPlayerName;
    this.clientPlayerName = clientPlayerName;
    
    console.log('🎮 LANGameManager: Player names set:', this.serverPlayerName, this.clientPlayerName);
    
    logger.info({
      scope: 'renderer/lan',
      msg: 'player names set',
      meta: { serverPlayerName: this.serverPlayerName, clientPlayerName: this.clientPlayerName }
    });
  }

  /**
   * Initialize LAN game (server-client only)
   */
  async initializeLANGame(): Promise<void> {
    try {
      console.log('🎮 LANGameManager.initializeLANGame() called');
      console.log('🎮 isServerClient:', this.isServerClient);
      
      if (!this.isServerClient) {
        console.log('🎮 Not server client, returning early');
        logger.info({
          scope: 'renderer/lan',
          msg: 'LAN client - waiting for card distribution from server'
        });
        return;
      }

      console.log('🎮 Server client detected, proceeding with initialization');

      // Load deck from localStorage
      const selectedDeck = localStorage.getItem('selectedDeck') || 'space-height-de';
      console.log('🎮 Selected deck from localStorage:', selectedDeck);
      console.log('🎮 All localStorage keys:', Object.keys(localStorage));
      console.log('🎮 selectedDeck value:', localStorage.getItem('selectedDeck'));
      console.log('🎮 selectedGameType value:', localStorage.getItem('selectedGameType'));
      
      logger.info({
        scope: 'renderer/lan',
        msg: 'initializing LAN game',
        meta: { 
          selectedDeck,
          isServerClient: this.isServerClient
        }
      });
      
      this.deck = await loadDeck(selectedDeck);
      
      // Initialize remaining cards from deck and shuffle them
      this.remainingCards = [...this.deck.cards];
      this.shuffleDeck();
      
      // Get first card for board
      const boardCardData = this.remainingCards.shift()!;
      this.boardCard = boardCardData;
      
      // Deal cards for LAN mode
      this.dealCardsForLAN();
      
      // Set current player randomly
      this.setCurrentPlayerRandomly();
      
      // Card distribution is prepared but NOT sent yet
      // It will be sent after the canvas is initialized and cards are displayed
      console.log('🎴 Card distribution prepared but not sent yet');
      
      logger.info({ 
        scope: 'renderer/lan', 
        msg: 'LAN game initialized successfully', 
        meta: { 
          boardCard: boardCardData.title, 
          remainingCards: this.remainingCards.length,
          playerHandSize: this.playerHand.length,
          opponentHandSize: this.opponentHand.length
        } 
      });
    } catch (error) {
      logger.error({ 
        scope: 'renderer/lan', 
        msg: 'failed to initialize LAN game', 
        err: { message: error.message, stack: error.stack } 
      });
    }
  }

  /**
   * Shuffle deck
   */
  private shuffleDeck(): void {
    for (let i = this.remainingCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.remainingCards[i], this.remainingCards[j]] = [this.remainingCards[j], this.remainingCards[i]];
    }
    
    logger.info({
      scope: 'renderer/lan',
      msg: 'deck shuffled...',
      meta: { totalCards: this.remainingCards.length }
    });
  }

  /**
   * Deal cards for LAN mode
   */
  private dealCardsForLAN(): void {
    // Deal 5 cards to server player
    for (let i = 0; i < 5; i++) {
      if (this.remainingCards.length > 0) {
        const cardData = this.remainingCards.shift()!;
        this.playerHand.push(cardData);
      }
    }
    
    // Deal 5 cards to client player
    for (let i = 0; i < 5; i++) {
      if (this.remainingCards.length > 0) {
        const cardData = this.remainingCards.shift()!;
        this.opponentHand.push(cardData);
      }
    }
    
    logger.info({
      scope: 'renderer/lan',
      msg: 'boardkarten (list)',
      meta: { boardCard: this.boardCard?.title || 'none' }
    });

    logger.info({
      scope: 'renderer/lan',
      msg: 'server player hand (list)',
      meta: { 
        serverHand: this.playerHand.map(card => card.title),
        serverHandSize: this.playerHand.length
      }
    });

    logger.info({
      scope: 'renderer/lan',
      msg: 'client-player hand (list)',
      meta: { 
        clientHand: this.opponentHand.map(card => card.title),
        clientHandSize: this.opponentHand.length
      }
    });

    logger.info({
      scope: 'renderer/lan',
      msg: 'deck karten (list)',
      meta: { 
        deckCards: this.remainingCards.map(card => card.title),
        deckSize: this.remainingCards.length
      }
    });
  }

     /**
    * Send card distribution to client AFTER canvas is initialized
    * This ensures the cards are displayed on the server-client before sending to client
    */
   public sendCardDistributionAfterCanvasInit(): void {
    try {
      // Create simplified card distribution (only IDs + positions)
      const distribution = {
        type: 'cardDistribution',
        deckId: this.deck.id,
        boardCard: this.boardCard ? {
          id: this.boardCard.id,
          position: 0
        } : null,
        serverHand: this.playerHand.map((card, index) => ({
          id: card.id,
          position: index + 1
        })),
        clientHand: this.opponentHand.map((card, index) => ({
          id: card.id,
          position: index + 6
        })),
        deckOrder: this.remainingCards.map((card, index) => ({
          id: card.id,
          position: index + 11
        })),
        currentPlayer: this.currentPlayer
      };

      // Debug: Log the simplified distribution
      console.log('🎴 Simplified card distribution created:');
      console.log('🎴 Deck ID:', distribution.deckId);
      console.log('🎴 Board Card ID:', distribution.boardCard ? distribution.boardCard.id : 'none');
      console.log('🎴 Server Hand IDs:', distribution.serverHand.map(card => card.id));
      console.log('🎴 Client Hand IDs:', distribution.clientHand.map(card => card.id));
      console.log('🎴 Deck Order IDs:', distribution.deckOrder.map(card => card.id));
      console.log('🎴 Current Player:', distribution.currentPlayer);

      // Send via IPC to main process AND directly via WebSocket
      if (window.AXM && window.AXM.sendCardDistribution) {
        window.AXM.sendCardDistribution(distribution);
        
        console.log('🎴 Starting card positions an client gesendet (IPC):', distribution);
        
        logger.info({
          scope: 'renderer/lan',
          msg: 'send to client via IPC...',
          meta: {
            boardCard: distribution.boardCard.id,
            serverHandSize: distribution.serverHand.length,
            clientHandSize: distribution.clientHand.length,
            deckSize: distribution.deckOrder.length,
            currentPlayer: distribution.currentPlayer
          }
        });
      } else {
        console.warn('🎴 AXM.sendCardDistribution not available');
        logger.warn({
          scope: 'renderer/lan',
          msg: 'AXM.sendCardDistribution not available'
        });
      }

      // Save card distribution to localStorage for GameScene to use
      localStorage.setItem('lanCardDistribution', JSON.stringify(distribution));
      console.log('🎴 Card distribution saved to localStorage for GameScene');
      
      // Send via IPC to main process (this will handle WebSocket transmission to client)
      if (window.AXM && window.AXM.sendCardDistribution) {
        window.AXM.sendCardDistribution(distribution);
        
        console.log('🎴 Card distribution sent via IPC to main process:', distribution);
        console.log('🎴 Board card:', distribution.boardCard?.title);
        console.log('🎴 Server hand size:', distribution.serverHand.length);
        console.log('🎴 Client hand size:', distribution.clientHand.length);
        console.log('🎴 Deck size:', distribution.deckOrder.length);
        console.log('🎴 Current player:', distribution.currentPlayer);
        
        logger.info({
          scope: 'renderer/lan',
          msg: 'card distribution sent via IPC',
          meta: {
            boardCard: distribution.boardCard?.id || 'none',
            serverHandSize: distribution.serverHand.length,
            clientHandSize: distribution.clientHand.length,
            deckSize: distribution.deckOrder.length,
            currentPlayer: distribution.currentPlayer
          }
        });
      } else {
        console.error('🎴 AXM.sendCardDistribution not available - cannot send card distribution!');
        logger.error({
          scope: 'renderer/lan',
          msg: 'AXM.sendCardDistribution not available - cannot send card distribution'
        });
      }

      logger.info({
        scope: 'renderer/lan',
        msg: 'card distribution sent to client',
        meta: {
          boardCard: distribution.boardCard.id,
          serverHandSize: distribution.serverHand.length,
          clientHandSize: distribution.clientHand.length,
          deckSize: distribution.deckOrder.length,
          currentPlayer: distribution.currentPlayer
        }
      });

    } catch (error) {
      logger.error({
        scope: 'renderer/lan',
        msg: 'failed to send card distribution',
        err: { message: (error as Error).message, stack: (error as Error).stack }
      });
    }
  }

  /**
   * Handle card distribution from server (client side)
   */
  handleCardDistributionFromServer(distribution: any): void {
    try {
      if (this.isServerClient) {
        return; // Server-client doesn't receive distribution
      }

      logger.info({
        scope: 'renderer/lan',
        msg: 'received card distribution from server',
        meta: {
          boardCard: distribution.boardCard?.id,
          serverHandSize: distribution.serverHand?.length,
          clientHandSize: distribution.clientHand?.length,
          deckSize: distribution.deckOrder?.length
        }
      });

      logger.info({
        scope: 'renderer/lan',
        msg: 'boardkarten received (list)',
        meta: { boardCard: distribution.boardCard?.id || 'none' }
      });

      logger.info({
        scope: 'renderer/lan',
        msg: 'server player hand received (list)',
        meta: { 
          serverHand: distribution.serverHand?.map((card: any) => card.id) || [],
          serverHandSize: distribution.serverHand?.length || 0
        }
      });

      logger.info({
        scope: 'renderer/lan',
        msg: 'client-player hand received (list)',
        meta: { 
          clientHand: distribution.clientHand?.map((card: any) => card.id) || [],
          clientHandSize: distribution.clientHand?.length || 0
        }
      });

      logger.info({
        scope: 'renderer/lan',
        msg: 'deck karten received (list)',
        meta: { 
          deckCards: distribution.deckOrder?.map((card: any) => card.id) || [],
          deckSize: distribution.deckOrder?.length || 0
        }
      });

      // For LAN client: Only log the distribution, don't create GameCard objects
      logger.info({
        scope: 'renderer/lan',
        msg: 'LAN client received card distribution - NO UI CREATION',
        meta: {
          boardCardId: distribution.boardCard?.id,
          serverHandIds: distribution.serverHand?.map((card: any) => card.id) || [],
          clientHandIds: distribution.clientHand?.map((card: any) => card.id) || [],
          deckCardIds: distribution.deckOrder?.map((card: any) => card.id) || [],
          currentPlayer: distribution.currentPlayer
        }
      });

    } catch (error) {
      logger.error({
        scope: 'renderer/lan',
        msg: 'failed to handle card distribution from server',
        err: { message: (error as Error).message, stack: (error as Error).stack }
      });
    }
  }
}
