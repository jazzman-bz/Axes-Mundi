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
    // currentPlayer wird beim startingPlayer Event gesetzt
    
    console.log('🎮 LANGameManager constructor - isServerClient set to:', this.isServerClient);
    console.log('🎮 LANGameManager constructor - serverPlayerName:', this.serverPlayerName);
    console.log('🎮 LANGameManager constructor - clientPlayerName:', this.clientPlayerName);
  }

  /**
   * Set current player from starting player event
   */
  setStartingPlayer(startingPlayer: string): void {
    this.currentPlayer = startingPlayer;
    
    logger.info({
      scope: 'renderer/lan',
      msg: 'starting player set',
      meta: { startingPlayer: this.currentPlayer }
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
      
      // Send card distribution to client
      this.sendCardDistributionToClient();
      
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
   * Send card distribution to client
   */
  private sendCardDistributionToClient(): void {
    try {
      // Create card distribution data
      const distribution = {
        type: 'cardDistribution',
        boardCard: {
          id: this.boardCard?.id || '',
          title: this.boardCard?.title || '',
          position: 0
        },
        serverHand: this.playerHand.map((card, index) => ({
          id: card.id,
          title: card.title,
          position: index + 1
        })),
        clientHand: this.opponentHand.map((card, index) => ({
          id: card.id,
          title: card.title,
          position: index + 6
        })),
        deckOrder: this.remainingCards.map((card, index) => ({
          id: card.id,
          title: card.title,
          position: index + 11
        })),
        startingPlayer: this.currentPlayer // Jetzt currentPlayer statt currentLANPlayer
      };

      // Send via IPC to main process
      if (window.AXM && window.AXM.sendCardDistribution) {
        window.AXM.sendCardDistribution(distribution);
        
        logger.info({
          scope: 'renderer/lan',
          msg: 'send to client...',
          meta: {
            boardCard: distribution.boardCard.id,
            serverHandSize: distribution.serverHand.length,
            clientHandSize: distribution.clientHand.length,
            deckSize: distribution.deckOrder.length,
            startingPlayer: distribution.startingPlayer
          }
        });
      } else {
        logger.warn({
          scope: 'renderer/lan',
          msg: 'AXM.sendCardDistribution not available'
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
          startingPlayer: distribution.startingPlayer
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
        meta: { boardCard: distribution.boardCard?.title || 'none' }
      });

      logger.info({
        scope: 'renderer/lan',
        msg: 'server player hand received (list)',
        meta: { 
          serverHand: distribution.serverHand?.map((card: any) => card.title) || [],
          serverHandSize: distribution.serverHand?.length || 0
        }
      });

      logger.info({
        scope: 'renderer/lan',
        msg: 'client-player hand received (list)',
        meta: { 
          clientHand: distribution.clientHand?.map((card: any) => card.title) || [],
          clientHandSize: distribution.clientHand?.length || 0
        }
      });

      logger.info({
        scope: 'renderer/lan',
        msg: 'deck karten received (list)',
        meta: { 
          deckCards: distribution.deckOrder?.map((card: any) => card.title) || [],
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
          startingPlayer: distribution.startingPlayer
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
