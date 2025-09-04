import { logger } from '@/utils/logger';
import { loadDeck } from '@/data/deckLoader';
import { Card as CardData } from '@/data/types';
import { evaluatePlacement, isAxisCorrectlySorted } from '@/data/scoring';

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

  // WebSocket client for non-server clients
  public lanClient: any = null;

  private onGameStateUpdateCallback: ((gameState: any) => void) | null = null;

  private onMessageCallback: ((message: any) => void) | null = null;

  // Game state for card placement validation
  private placedCards: CardData[] = []; // Cards placed on the axis

  private gameStarted: boolean = false;

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
    // DISABLED: currentPlayer logic before card distribution
    console.log('🎮 DISABLED: setCurrentPlayerRandomly called - waiting for card distribution');

    // DISABLED: currentPlayer logic before card distribution
    // const serverStarts = Math.random() < 0.5;
    // this.currentPlayer = serverStarts ? this.serverPlayerName : this.clientPlayerName;
    //
    // // Store current player in localStorage for consistency
    // localStorage.setItem('currentPlayer', this.currentPlayer);
    //
    // logger.info({
    //   scope: 'renderer/lan',
    //   msg: 'current player set randomly',
    //   meta: { currentPlayer: this.currentPlayer, serverStarts }
    // });
  }

  /**
   * Update current player after turn
   */
  updateCurrentPlayer(): void {
    // DISABLED: currentPlayer logic before card distribution
    console.log('🎮 DISABLED: updateCurrentPlayer called - waiting for card distribution');

    // DISABLED: currentPlayer logic before card distribution
    // if (this.currentPlayer === this.serverPlayerName) {
    //   this.currentPlayer = this.clientPlayerName;
    // } else {
    //   this.currentPlayer = this.serverPlayerName;
    // }
    //
    // // Store updated current player
    // localStorage.setItem('currentPlayer', this.currentPlayer);
    //
    // logger.info({
    //   scope: 'renderer/lan',
    //   msg: 'current player updated',
    //   meta: { currentPlayer: this.currentPlayer }
    // });
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
   * Get placed cards on axis
   */
  getPlacedCards(): CardData[] {
    return this.placedCards;
  }

  /**
   * Check if game has started
   */
  isGameStarted(): boolean {
    return this.gameStarted;
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
      currentPlayer: this.currentPlayer,
      placedCards: this.placedCards,
      gameStarted: this.gameStarted,
    };
  }

  /**
   * Set player names from landing page
   */
  setPlayerNames(serverPlayerName: string, clientPlayerName: string): void {
    this.serverPlayerName = serverPlayerName;

    // Nur den Client-Namen setzen, wenn noch kein echter Name via WebSocket gesetzt wurde
    // oder wenn es der Platzhalter "Waiting for client..." ist
    if (!this.clientPlayerName || this.clientPlayerName === 'Waiting for client...' || this.clientPlayerName === 'Client') {
      this.clientPlayerName = clientPlayerName;
      localStorage.setItem('clientPlayerName', clientPlayerName);
    }

    // Store player names in localStorage for overlay display
    localStorage.setItem('serverPlayerName', serverPlayerName);

    // DISABLED: currentPlayer logic before card distribution
    // localStorage.setItem('currentPlayer', serverPlayerName);

    console.log('🎮 LANGameServer: Player names set:', this.serverPlayerName, this.clientPlayerName);
    console.log('🎮 LANGameServer: Player names stored in localStorage');
    console.log('🎮 LANGameServer: DISABLED - would set current player to:', serverPlayerName);

    logger.info({
      scope: 'renderer/lan/server',
      msg: 'player names set and stored in localStorage',
      meta: {
        serverPlayerName: this.serverPlayerName,
        clientPlayerName: this.clientPlayerName,
        currentPlayer: 'WAITING_FOR_CARD_DISTRIBUTION',
      },
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
        console.log('🎮 Not server client, initializing as LAN client');
        logger.info({
          scope: 'renderer/lan',
          msg: 'LAN client - initializing WebSocket connection',
        });

        // Initialize as LAN client
        await this.initializeAsLANClient();
        return;
      }

      console.log('🎮 Server client detected, proceeding with initialization');

      // Load deck from localStorage with validation
      let selectedDeck = localStorage.getItem('selectedDeck') || 'space-height-de';

      // Validate that the selected deck exists, fallback to space-height-de if not
      const validDecks = ['space-height-de', 'buildings-height-de', 'time-inventions-en', 'temperatures-temperature-de'];
      if (!validDecks.includes(selectedDeck)) {
        console.warn('🎮 Invalid deck ID in localStorage:', selectedDeck, 'falling back to space-height-de');
        selectedDeck = 'space-height-de';
        localStorage.setItem('selectedDeck', selectedDeck);
      }

      console.log('🎮 Selected deck from localStorage:', selectedDeck);
      console.log('🎮 All localStorage keys:', Object.keys(localStorage));
      console.log('🎮 selectedDeck value:', localStorage.getItem('selectedDeck'));
      console.log('🎮 selectedGameType value:', localStorage.getItem('selectedGameType'));

      logger.info({
        scope: 'renderer/lan',
        msg: 'initializing LAN game',
        meta: {
          selectedDeck,
          isServerClient: this.isServerClient,
        },
      });

      this.deck = await loadDeck(selectedDeck);

      // Initialize remaining cards from deck and shuffle them
      this.remainingCards = [...this.deck.cards];
      this.shuffleDeck();

      // Get first card for board
      const boardCardData = this.remainingCards.shift()!;
      this.boardCard = boardCardData;

      // Initialize placed cards with board card
      this.placedCards = [boardCardData];

      // Deal cards for LAN mode
      this.dealCardsForLAN();

      // DISABLED: currentPlayer logic before card distribution
      // this.setCurrentPlayerRandomly();

      // Mark game as started
      this.gameStarted = true;

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
          opponentHandSize: this.opponentHand.length,
          gameStarted: this.gameStarted,
        },
      });
    } catch (error) {
      logger.error({
        scope: 'renderer/lan',
        msg: 'failed to initialize LAN game',
        err: { message: error.message, stack: error.stack },
      });
    }
  }

  /**
   * Initialize as LAN client (non-server)
   */
  private async initializeAsLANClient(): Promise<void> {
    try {
      console.log('🎮 Initializing as LAN client...');

      // Get server connection details from localStorage
      const serverUrl = localStorage.getItem('lanServerUrl') || 'ws://localhost:8080';
      const playerName = this.clientPlayerName;

      console.log('🎮 Connecting to server:', serverUrl, 'as:', playerName);

      // Import and initialize LAN client
      const { LANClient } = await import('./lan-client');
      this.lanClient = new LANClient(serverUrl, playerName);

      // Set up message handlers
      this.lanClient.onMessage((message: any) => {
        console.log('🎮 LANGameManager: Received WebSocket message:', message.type);
        this.handleWebSocketMessage(message);
      });

      // Connect to server
      await this.lanClient.connect();

      // Send ready status
      this.lanClient.sendReady();

      logger.info({
        scope: 'renderer/lan',
        msg: 'LAN client initialized successfully',
        meta: { serverUrl, playerName },
      });
    } catch (error) {
      logger.error({
        scope: 'renderer/lan',
        msg: 'failed to initialize LAN client',
        err: { message: error.message, stack: error.stack },
      });
      throw error;
    }
  }

  /**
   * Handle WebSocket messages from server
   */
  private handleWebSocketMessage(message: any): void {
    try {
      console.log('🎮 LAN client received message:', message.type);

      switch (message.type) {
        case 'cardPlacement':
        // IMPORTANT: Forward cardPlacement messages to lan-game-main.ts for processing
          console.log('🎮 LANGameManager: Forwarding cardPlacement to lan-game-main.ts');
          if (this.onMessageCallback) {
            this.onMessageCallback(message);
          } else {
            console.warn('🎮 LANGameManager: No message callback set for cardPlacement');
          }
          break;
        case 'playerSwitch':
        // IMPORTANT: Forward playerSwitch messages to lan-game-main.ts for processing
          console.log('🎮 LANGameManager: Forwarding playerSwitch to lan-game-main.ts');
          if (this.onMessageCallback) {
            this.onMessageCallback(message);
          } else {
            console.warn('🎮 LANGameManager: No message callback set for playerSwitch');
          }
          break;
        case 'gameRestart':
        // IMPORTANT: Forward gameRestart messages to lan-game-main.ts for processing
          console.log('🎮 LANGameManager: Forwarding gameRestart to lan-game-main.ts');
          if (this.onMessageCallback) {
            this.onMessageCallback(message);
          } else {
            console.warn('🎮 LANGameManager: No message callback set for gameRestart');
          }
          break;
        case 'remainingCardsUpdate':
        // IMPORTANT: Forward remainingCardsUpdate messages to lan-game-main.ts for processing
          console.log('🎮 LANGameManager: Forwarding remainingCardsUpdate to lan-game-main.ts');
          if (this.onMessageCallback) {
            this.onMessageCallback(message);
          } else {
            console.warn('🎮 LANGameManager: No message callback set for remainingCardsUpdate');
          }
          break;
        case 'gameStateUpdate':
          this.handleRemoteGameStateUpdate(message);
          break;
        case 'currentPlayerUpdate':
        // DISABLED: currentPlayer logic before card distribution
          console.log('🎮 Received currentPlayerUpdate - IGNORED (waiting for card distribution)');
          break;
        default:
          console.log('🎮 Unknown message type:', message.type);
      }
    } catch (error) {
      logger.error({
        scope: 'renderer/lan',
        msg: 'failed to handle WebSocket message',
        err: { message: error.message, stack: error.stack },
      });
    }
  }

  /**
   * Handle remote card placement from server
   * DISABLED: Duplicate handler removed - main processing happens in lan-game-main.ts
   */
  private handleRemoteCardPlacement(message: any): void {
    // This method is disabled to prevent duplicate processing
    // Main card placement handling happens in lan-game-main.ts
    console.log('🎮 handleRemoteCardPlacement disabled - main processing in lan-game-main.ts');
  }

  /**
   * Handle remote game state update from server
   */
  private handleRemoteGameStateUpdate(message: any): void {
    try {
      console.log('🎮 Handling remote game state update:', message);

      // DISABLED: currentPlayer logic before card distribution
      // this.currentPlayer = message.currentPlayer;
      this.placedCards = message.placedCards || [];

      // DISABLED: currentPlayer logic before card distribution
      // localStorage.setItem('currentPlayer', this.currentPlayer);

      logger.info({
        scope: 'renderer/lan',
        msg: 'remote game state updated',
        meta: {
          currentPlayer: 'DISABLED_BEFORE_CARD_DISTRIBUTION',
          placedCardsCount: this.placedCards.length,
        },
      });

      // Notify callback if set
      if (this.onGameStateUpdateCallback) {
        this.onGameStateUpdateCallback(this.getGameState());
      }
    } catch (error) {
      logger.error({
        scope: 'renderer/lan',
        msg: 'failed to handle remote game state update',
        err: { message: error.message, stack: error.stack },
      });
    }
  }

  /**
   * Handle remote current player update from server
   */
  private handleRemoteCurrentPlayerUpdate(message: any): void {
    try {
      console.log('🎮 DISABLED: handleRemoteCurrentPlayerUpdate called - waiting for card distribution');
      console.log('🎮 Would set current player to:', message.currentPlayer);

      // DISABLED: currentPlayer logic before card distribution
      // this.currentPlayer = message.currentPlayer;
      // localStorage.setItem('currentPlayer', this.currentPlayer);

      // logger.info({
      //   scope: 'renderer/lan',
      //   msg: 'remote current player updated',
      //   meta: { currentPlayer: this.currentPlayer }
      // });

      // // Notify callback if set
      // if (this.onGameStateUpdateCallback) {
      //   this.onGameStateUpdateCallback(this.getGameState());
      // }
    } catch (error) {
      logger.error({
        scope: 'renderer/lan',
        msg: 'failed to handle remote current player update',
        err: { message: error.message, stack: error.stack },
      });
    }
  }

  /**
   * Update client player name when received via WebSocket
   * This is called when the browser client connects and sends their name
   */
  updateClientPlayerName(clientPlayerName: string): void {
    this.clientPlayerName = clientPlayerName;

    // Store updated client player name in localStorage
    localStorage.setItem('clientPlayerName', clientPlayerName);

    console.log('🎮 LANGameServer: Client player name updated via WebSocket:', clientPlayerName);

    logger.info({
      scope: 'renderer/lan/server',
      msg: 'client player name updated via WebSocket',
      meta: { clientPlayerName },
    });
  }

  /**
   * Get server player name
   */
  getServerPlayerName(): string {
    // Load names from localStorage if not already set
    if (!this.serverPlayerName) {
      this.serverPlayerName = localStorage.getItem('serverPlayerName') || 'Server';
      console.log('🎮 LANGameServer: Loaded server player name from localStorage:', this.serverPlayerName);
    }

    return this.serverPlayerName;
  }

  /**
   * Get client player name
   */
  getClientPlayerName(): string {
    // Load names from localStorage if not already set
    if (!this.clientPlayerName) {
      this.clientPlayerName = localStorage.getItem('clientPlayerName') || 'Client';
      console.log('🎮 LANGameServer: Loaded client player name from localStorage:', this.clientPlayerName);
    }

    return this.clientPlayerName;
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
      meta: { totalCards: this.remainingCards.length },
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
      meta: { boardCard: this.boardCard?.title || 'none' },
    });

    logger.info({
      scope: 'renderer/lan',
      msg: 'server player hand (list)',
      meta: {
        serverHand: this.playerHand.map((card) => card.title),
        serverHandSize: this.playerHand.length,
      },
    });

    logger.info({
      scope: 'renderer/lan',
      msg: 'client-player hand (list)',
      meta: {
        clientHand: this.opponentHand.map((card) => card.title),
        clientHandSize: this.opponentHand.length,
      },
    });

    logger.info({
      scope: 'renderer/lan',
      msg: 'deck karten (list)',
      meta: {
        deckCards: this.remainingCards.map((card) => card.title),
        deckSize: this.remainingCards.length,
      },
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
          position: 0,
        } : null,
        serverHand: this.playerHand.map((card, index) => ({
          id: card.id,
          position: index + 1,
        })),
        clientHand: this.opponentHand.map((card, index) => ({
          id: card.id,
          position: index + 6,
        })),
        deckOrder: this.remainingCards.map((card, index) => ({
          id: card.id,
          position: index + 11,
        })),
        currentPlayer: this.currentPlayer,
        placedCards: this.placedCards,
        gameStarted: this.gameStarted,
      };

      // Debug: Log the simplified distribution
      console.log('🎴 Simplified card distribution created:');
      console.log('🎴 Deck ID:', distribution.deckId);
      console.log('🎴 Board Card ID:', distribution.boardCard ? distribution.boardCard.id : 'none');
      console.log('🎴 Server Hand IDs:', distribution.serverHand.map((card) => card.id));
      console.log('🎴 Client Hand IDs:', distribution.clientHand.map((card) => card.id));
      console.log('🎴 Deck Order IDs:', distribution.deckOrder.map((card) => card.id));
      console.log('🎴 Current Player:', distribution.currentPlayer);
      console.log('🎴 Placed Cards:', distribution.placedCards.map((card) => card.id));
      console.log('🎴 Game Started:', distribution.gameStarted);

      // Save card distribution to localStorage for GameScene to use
      localStorage.setItem('lanCardDistribution', JSON.stringify(distribution));
      console.log('🎴 Card distribution saved to localStorage for GameScene');

      // Send via IPC to main process (this will handle WebSocket transmission to client)
      if (window.AXM && window.AXM.sendCardDistribution) {
        window.AXM.sendCardDistribution(distribution);

        console.log('🎴 Card distribution sent via IPC to main process:', distribution);
        console.log('🎴 Board card:', distribution.boardCard?.id);
        console.log('🎴 Server hand size:', distribution.serverHand.length);
        console.log('🎴 Client hand size:', distribution.clientHand.length);
        console.log('🎴 Deck size:', distribution.deckOrder.length);
        console.log('🎴 Current player:', distribution.currentPlayer);
        console.log('🎴 Placed Cards:', distribution.placedCards.map((card) => card.id));
        console.log('🎴 Game Started:', distribution.gameStarted);

        logger.info({
          scope: 'renderer/lan',
          msg: 'card distribution sent via IPC',
          meta: {
            boardCard: distribution.boardCard?.id || 'none',
            serverHandSize: distribution.serverHand.length,
            clientHandSize: distribution.clientHand.length,
            deckSize: distribution.deckOrder.length,
            currentPlayer: distribution.currentPlayer,
            placedCardsCount: distribution.placedCards.length,
            gameStarted: distribution.gameStarted,
          },
        });
      } else {
        console.error('🎴 AXM.sendCardDistribution not available - cannot send card distribution!');
        logger.error({
          scope: 'renderer/lan',
          msg: 'AXM.sendCardDistribution not available - cannot send card distribution',
        });
      }

      // Logging already done above
    } catch (error) {
      logger.error({
        scope: 'renderer/lan',
        msg: 'failed to send card distribution',
        err: { message: (error as Error).message, stack: (error as Error).stack },
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
          deckSize: distribution.deckOrder?.length,
          placedCardsCount: distribution.placedCards?.length,
          gameStarted: distribution.gameStarted,
        },
      });

      logger.info({
        scope: 'renderer/lan',
        msg: 'boardkarten received (list)',
        meta: { boardCard: distribution.boardCard?.id || 'none' },
      });

      logger.info({
        scope: 'renderer/lan',
        msg: 'server player hand received (list)',
        meta: {
          serverHand: distribution.serverHand?.map((card: any) => card.id) || [],
          serverHandSize: distribution.serverHand?.length || 0,
        },
      });

      logger.info({
        scope: 'renderer/lan',
        msg: 'client-player hand received (list)',
        meta: {
          clientHand: distribution.clientHand?.map((card: any) => card.id) || [],
          clientHandSize: distribution.clientHand?.length || 0,
        },
      });

      logger.info({
        scope: 'renderer/lan',
        msg: 'deck karten received (list)',
        meta: {
          deckCards: distribution.deckOrder?.map((card: any) => card.id) || [],
          deckSize: distribution.deckOrder?.length || 0,
        },
      });

      logger.info({
        scope: 'renderer/lan',
        msg: 'placed cards received (list)',
        meta: {
          placedCards: distribution.placedCards?.map((card: any) => card.id) || [],
          placedCardsCount: distribution.placedCards?.length || 0,
        },
      });

      logger.info({
        scope: 'renderer/lan',
        msg: 'game started received:',
        meta: { gameStarted: distribution.gameStarted },
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
          currentPlayer: distribution.currentPlayer,
          placedCardsCount: distribution.placedCards?.length || 0,
          gameStarted: distribution.gameStarted,
        },
      });

      // Send confirmation to server that client received cards
      this.sendCardDistributionConfirmation();
    } catch (error) {
      logger.error({
        scope: 'renderer/lan',
        msg: 'failed to handle card distribution from server',
        err: { message: (error as Error).message, stack: (error as Error).stack },
      });
    }
  }

  /**
   * Send confirmation to server that client received card distribution
   */
  private sendCardDistributionConfirmation(): void {
    try {
      if (this.isServerClient) {
        return; // Only client sends confirmation
      }

      logger.info({
        scope: 'renderer/lan',
        msg: 'sending card distribution confirmation to server',
      });

      // Send confirmation via WebSocket client
      if (this.lanClient && this.lanClient.isConnected()) {
        this.lanClient.sendCardDistributionConfirmation({
          type: 'cardDistributionConfirmation',
          playerName: this.clientPlayerName,
          message: 'Client received card distribution successfully',
        });

        logger.info({
          scope: 'renderer/lan',
          msg: 'card distribution confirmation sent to server',
        });
      } else {
        logger.warn({
          scope: 'renderer/lan',
          msg: 'WebSocket client not available for card distribution confirmation',
        });
      }
    } catch (error) {
      logger.error({
        scope: 'renderer/lan',
        msg: 'failed to send card distribution confirmation',
        err: { message: (error as Error).message, stack: (error as Error).stack },
      });
    }
  }

  /**
   * Place a card on the axis with validation (Server-Client only)
   */
  placeCard(cardId: string, position: 'left' | 'right'): { success: boolean; message: string; isCorrect: boolean; cardData: CardData | null } {
    try {
      // Only server-client can place cards
      if (!this.isServerClient) {
        logger.warn({
          scope: 'renderer/lan',
          msg: 'non-server client attempted to place card',
          meta: { cardId, currentPlayer: this.currentPlayer },
        });
        return {
          success: false, message: 'Only server-client can place cards', isCorrect: false, cardData: null,
        };
      }

      // Check if it's the current player's turn
      const isServerTurn = this.currentPlayer === this.serverPlayerName;
      const card = isServerTurn
        ? this.playerHand.find((c) => c.id === cardId)
        : this.opponentHand.find((c) => c.id === cardId);

      if (!card) {
        logger.warn({
          scope: 'renderer/lan',
          msg: 'card not found in player hand',
          meta: { cardId, currentPlayer: this.currentPlayer, isServerTurn },
        });
        return {
          success: false, message: 'Card not found in hand', isCorrect: false, cardData: null,
        };
      }

      // Check if card is already placed
      if (this.placedCards.some((c) => c.id === cardId)) {
        logger.warn({
          scope: 'renderer/lan',
          msg: 'card already placed on axis',
          meta: { cardId, cardTitle: card.title },
        });
        return {
          success: false, message: 'Card already placed', isCorrect: false, cardData: null,
        };
      }

      // Validate placement using the same logic as KI game
      const isCorrect = this.validateCardPlacement(card, position);

      if (isCorrect) {
        // Place card correctly - stays on axis and turns green
        this.placedCards.push(card);

        // Remove from player's hand
        if (isServerTurn) {
          this.playerHand = this.playerHand.filter((c) => c.id !== cardId);
        } else {
          this.opponentHand = this.opponentHand.filter((c) => c.id !== cardId);
        }

        // Give new card if available
        if (this.remainingCards.length > 0) {
          const newCard = this.remainingCards.shift()!;
          if (isServerTurn) {
            this.playerHand.push(newCard);
          } else {
            this.opponentHand.push(newCard);
          }
        }

        logger.info({
          scope: 'renderer/lan',
          msg: 'card placed correctly - stays on axis and turns green',
          meta: {
            cardId,
            cardTitle: card.title,
            position,
            currentPlayer: this.currentPlayer,
            placedCardsCount: this.placedCards.length,
          },
        });

        // Check if game is won
        if (this.checkGameWin()) {
          return {
            success: true,
            message: `Game won by ${this.currentPlayer}!`,
            isCorrect: true,
            cardData: card,
          };
        }

        // Switch turns
        this.updateCurrentPlayer();

        // Send game state update to other clients via WebSocket
        if (this.lanClient) {
          this.lanClient.sendGameStateUpdate({
            currentPlayer: this.currentPlayer,
            placedCards: this.placedCards,
          });
        }

        return {
          success: true,
          message: 'Card placed correctly! Stays on axis and turns green.',
          isCorrect: true,
          cardData: card,
        };
      }
      // Incorrect placement - card stays on axis but turns red
      // In this implementation, we don't move to graveyard yet
      this.placedCards.push(card);

      // Remove from player's hand
      if (isServerTurn) {
        this.playerHand = this.playerHand.filter((c) => c.id !== cardId);
      } else {
        this.opponentHand = this.opponentHand.filter((c) => c.id !== cardId);
      }

      // DISABLED: New card distribution is now handled by lan-game-main.ts
      // This prevents duplicate cards when a card is placed incorrectly
      // The lan-game-main.ts system handles graveyard and new card distribution

      logger.info({
        scope: 'renderer/lan',
        msg: 'card placed incorrectly - stays on axis but turns red',
        meta: {
          cardId,
          cardTitle: card.title,
          position,
          currentPlayer: this.currentPlayer,
          placedCardsCount: this.placedCards.length,
        },
      });

      // Switch turns
      this.updateCurrentPlayer();

      // Send game state update to other clients via WebSocket
      if (this.lanClient) {
        this.lanClient.sendGameStateUpdate({
          currentPlayer: this.currentPlayer,
          placedCards: this.placedCards,
        });
      }

      return {
        success: true,
        message: 'Card placed incorrectly - stays on axis but turns red.',
        isCorrect: false,
        cardData: card,
      };
    } catch (error) {
      logger.error({
        scope: 'renderer/lan',
        msg: 'failed to place card',
        err: { message: error.message, stack: error.stack },
      });
      return {
        success: false, message: 'Failed to place card', isCorrect: false, cardData: null,
      };
    }
  }

  /**
   * Validate card placement using the same logic as KI game
   */
  private validateCardPlacement(card: CardData, position: 'left' | 'right'): boolean {
    try {
      // If no cards are placed yet, any placement is valid
      if (this.placedCards.length === 0) {
        return true;
      }

      // Find the center card (first placed card - board card)
      const centerCard = this.placedCards[0];

      // Use the scoring function to validate placement (same as KI game)
      const isCorrect = evaluatePlacement(card, centerCard, position === 'left');

      logger.info({
        scope: 'renderer/lan',
        msg: 'card placement validated using KI game logic',
        meta: {
          cardTitle: card.title,
          centerCardTitle: centerCard.title,
          position,
          isCorrect,
          cardValue: card.value,
          cardUnit: card.unit,
          centerValue: centerCard.value,
          centerUnit: centerCard.unit,
        },
      });

      return isCorrect;
    } catch (error) {
      logger.error({
        scope: 'renderer/lan',
        msg: 'failed to validate card placement',
        err: { message: error.message, stack: error.stack },
      });
      return false;
    }
  }

  /**
   * Check if game is won (same logic as KI game)
   */
  private checkGameWin(): boolean {
    try {
      // Game is won when all cards from both hands are placed
      const totalHandCards = this.playerHand.length + this.opponentHand.length;
      const totalPlacedCards = this.placedCards.length;

      // Win condition: all hand cards placed + board card
      const isWon = totalHandCards === 0 && totalPlacedCards > 0;

      if (isWon) {
        logger.info({
          scope: 'renderer/lan',
          msg: 'game won - all cards placed',
          meta: {
            winner: this.currentPlayer,
            totalPlacedCards,
            totalHandCards,
          },
        });
      }

      return isWon;
    } catch (error) {
      logger.error({
        scope: 'renderer/lan',
        msg: 'failed to check game win',
        err: { message: error.message, stack: error.stack },
      });
      return false;
    }
  }

  /**
   * Get game state for synchronization
   */
  getGameState(): any {
    return {
      currentPlayer: this.currentPlayer,
      placedCards: this.placedCards,
      serverHand: this.playerHand,
      clientHand: this.opponentHand,
      remainingCards: this.remainingCards.length,
      gameStarted: this.gameStarted,
    };
  }

  /**
   * Update game state from server (for client)
   */
  updateGameState(gameState: any): void {
    try {
      if (this.isServerClient) {
        return; // Server-client doesn't receive game state updates
      }

      // DISABLED: currentPlayer logic before card distribution
      // this.currentPlayer = gameState.currentPlayer;
      this.placedCards = gameState.placedCards || [];
      this.playerHand = gameState.serverHand || [];
      this.opponentHand = gameState.clientHand || [];
      this.gameStarted = gameState.gameStarted || false;

      // DISABLED: currentPlayer logic before card distribution
      // localStorage.setItem('currentPlayer', this.currentPlayer);

      logger.info({
        scope: 'renderer/lan',
        msg: 'game state updated from server',
        meta: {
          currentPlayer: 'DISABLED_BEFORE_CARD_DISTRIBUTION',
          placedCardsCount: this.placedCards.length,
          serverHandSize: this.playerHand.length,
          clientHandSize: this.opponentHand.length,
        },
      });
    } catch (error) {
      logger.error({
        scope: 'renderer/lan',
        msg: 'failed to update game state',
        err: { message: error.message, stack: error.stack },
      });
    }
  }

  /**
   * Set callback for game state updates
   */
  onGameStateUpdate(callback: (gameState: any) => void): void {
    this.onGameStateUpdateCallback = callback;
  }

  /**
   * Set callback for WebSocket messages
   */
  onMessage(callback: (message: any) => void): void {
    this.onMessageCallback = callback;
  }
}
