/**
 * Landing Page Navigation Logic
 * Handles section transitions, form validation, and localStorage integration
 */

// Silent logger for production
const logger = {
  info: () => {},
  debug: () => {},
  warn: () => {},
  error: () => {}
};

/**
 * Landing Page Controller
 */
class LandingPageController {
      constructor() {
      this.currentSection = 'player-setup';
      this.sections = [
        'player-setup',
        'game-mode-selection', 
        'singleplayer-options',
        'ai-difficulty',
        'multiplayer-options',
        'lan-options',
        'second-player-setup',
        'deck-selection'
      ];
      
      this.playerData = {
        name: '',
        avatar: null
      };
      
      this.secondPlayerData = {
        name: '',
        avatar: null
      };
      
           this.gameConfig = {
        mode: null,
        type: null,
        difficulty: null
      };
      
      // LAN connection state
      this.isServerClient = false;
      this.serverPlayerName = null;
      this.clientPlayerName = null; // Store client player name for server-client
      this.lanClient = null;
      
      this.init();
    }

  /**
   * Initialize the landing page
   */
  init() {
    try {
      logger.info({ scope: 'landing/init', msg: 'initializing landing page' });
      
      // Hide loading screen after a short delay
      setTimeout(() => {
        this.hideLoadingScreen();
      }, 1500);
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Set up IPC listeners for LAN status updates
      this.setupIPCListeners();
      
      // Load saved data if available
      this.loadSavedData();
      
      // Update progress
      this.updateProgress();
      
      logger.info({ scope: 'landing/init', msg: 'landing page initialized successfully' });
      
    } catch (error) {
      logger.error({ 
        scope: 'landing/init', 
        msg: 'failed to initialize landing page', 
        err: { message: error.message, stack: error.stack } 
      });
    }
  }

  /**
   * Hide loading screen and show main app
   */
  hideLoadingScreen() {
    try {
      const loadingScreen = document.getElementById('loading-screen');
      const appContainer = document.getElementById('app');
      
      if (loadingScreen && appContainer) {
        loadingScreen.classList.add('hidden');
        appContainer.style.display = 'flex';
        
        logger.debug({ scope: 'landing/loading', msg: 'loading screen hidden' });
      }
    } catch (error) {
      logger.error({ 
        scope: 'landing/loading', 
        msg: 'failed to hide loading screen', 
        err: { message: error.message } 
      });
    }
  }

  /**
   * Set up all event listeners
   */
  setupEventListeners() {
    try {
      // Player form submission
      const playerForm = document.getElementById('player-form');
      if (playerForm) {
        playerForm.addEventListener('submit', this.handlePlayerFormSubmit.bind(this));
      }

      // Avatar selection (for both player forms)
      const avatarOptions = document.querySelectorAll('.avatar-option');
      avatarOptions.forEach(option => {
        option.addEventListener('click', this.handleAvatarSelection.bind(this));
      });

      // Second player form submission
      const secondPlayerForm = document.getElementById('second-player-form');
      if (secondPlayerForm) {
        secondPlayerForm.addEventListener('submit', this.handleSecondPlayerFormSubmit.bind(this));
      }

      // Game mode selection
      const gameModeCards = document.querySelectorAll('.game-mode-card');
      gameModeCards.forEach(card => {
        card.addEventListener('click', this.handleGameModeSelection.bind(this));
      });

      // Single player options
      const optionCards = document.querySelectorAll('.option-card');
      optionCards.forEach(card => {
        card.addEventListener('click', this.handleOptionSelection.bind(this));
      });

      // AI difficulty selection
      const difficultyCards = document.querySelectorAll('.difficulty-card');
      difficultyCards.forEach(card => {
        card.addEventListener('click', this.handleDifficultySelection.bind(this));
      });

      // Deck selection
      const deckCards = document.querySelectorAll('.deck-card');
      deckCards.forEach(card => {
        card.addEventListener('click', this.handleDeckSelection.bind(this));
      });

      // Back buttons
      const backButtons = document.querySelectorAll('.back-btn');
      backButtons.forEach(button => {
        button.addEventListener('click', this.goBack.bind(this));
      });

      logger.debug({ scope: 'landing/events', msg: 'event listeners set up' });
      
    } catch (error) {
      logger.error({ 
        scope: 'landing/events', 
        msg: 'failed to set up event listeners', 
        err: { message: error.message, stack: error.stack } 
      });
    }
  }

  /**
   * Handle player form submission
   */
  handlePlayerFormSubmit(event) {
    event.preventDefault();
    
    try {
      const nameInput = document.getElementById('player-name');
      const playerName = nameInput.value.trim();
      
      if (!playerName) {
        this.showError('Bitte gib deinen Namen ein.');
        return;
      }
      
      if (!this.playerData.avatar) {
        this.showError('Bitte wähle einen Avatar aus.');
        return;
      }
      
      // Save player data
      this.playerData.name = playerName;
      this.savePlayerData();
      
      // Navigate to next section
      this.navigateToSection('game-mode-selection');
      
      logger.info({ 
        scope: 'landing/player', 
        msg: 'player data saved', 
        meta: { name: playerName, avatar: this.playerData.avatar } 
      });
      
    } catch (error) {
      logger.error({ 
        scope: 'landing/player', 
        msg: 'failed to handle player form submission', 
        err: { message: error.message } 
      });
      this.showError('Fehler beim Speichern der Spielerdaten.');
    }
  }

  /**
   * Handle avatar selection
   */
  handleAvatarSelection(event) {
    try {
      const avatarOption = event.currentTarget;
      const avatarId = avatarOption.dataset.avatar;
      const avatarSection = avatarOption.closest('section');
      
      // Remove previous selection in current section only
      avatarSection.querySelectorAll('.avatar-option').forEach(option => {
        option.classList.remove('selected');
      });
      
      // Select new avatar
      avatarOption.classList.add('selected');
      
      // Determine which player this is for
      if (avatarSection.id === 'second-player-setup') {
        this.secondPlayerData.avatar = avatarId;
        logger.debug({ 
          scope: 'landing/avatar', 
          msg: 'second player avatar selected', 
          meta: { avatarId } 
        });
      } else {
        this.playerData.avatar = avatarId;
        logger.debug({ 
          scope: 'landing/avatar', 
          msg: 'first player avatar selected', 
          meta: { avatarId } 
        });
      }
      
    } catch (error) {
      logger.error({ 
        scope: 'landing/avatar', 
        msg: 'failed to handle avatar selection', 
        err: { message: error.message } 
      });
    }
  }

  /**
   * Handle game mode selection
   */
  handleGameModeSelection(event) {
    try {
      const gameModeCard = event.currentTarget;
      const mode = gameModeCard.dataset.mode;
      
      this.gameConfig.mode = mode;
      
      // Navigate based on mode
      if (mode === 'singleplayer') {
        this.navigateToSection('singleplayer-options');
      } else if (mode === 'multiplayer') {
        this.navigateToSection('multiplayer-options');
      }
      
      logger.info({ 
        scope: 'landing/game-mode', 
        msg: 'game mode selected', 
        meta: { mode } 
      });
      
    } catch (error) {
      logger.error({ 
        scope: 'landing/game-mode', 
        msg: 'failed to handle game mode selection', 
        err: { message: error.message } 
      });
    }
  }

  /**
   * Handle option selection (AI vs Educational)
   */
  handleOptionSelection(event) {
    try {
      console.log('🔍 handleOptionSelection called!', event);
      
      const optionCard = event.currentTarget;
      const option = optionCard.dataset.option;
      
      console.log('🔍 Option selected:', option);
      
      // Check if option is coming soon
      if (optionCard.classList.contains('coming-soon')) {
        this.showComingSoonMessage();
        return;
      }
      
      this.gameConfig.type = option;
      
      if (option === 'ai') {
        this.navigateToSection('ai-difficulty');
      } else if (option === 'educational') {
        // Educational mode - go directly to deck selection
        this.navigateToSection('deck-selection');
      } else if (option === 'hotseat') {
        // Hotseat mode - go to second player setup
        this.navigateToSection('second-player-setup');
      } else if (option === 'lan') {
        // LAN mode - go to LAN options
        this.navigateToSection('lan-options');
      } else if (option === 'start-game') {
        this.startLANServer();
      } else if (option === 'join-game') {
        this.joinLANGame();
      }
      
      logger.info({ 
        scope: 'landing/option', 
        msg: 'option selected', 
        meta: { option } 
      });
      
    } catch (error) {
      logger.error({ 
        scope: 'landing/option', 
        msg: 'failed to handle option selection', 
        err: { message: error.message } 
      });
    }
  }

  /**
   * Handle difficulty selection
   */
  handleDifficultySelection(event) {
    try {
      const difficultyCard = event.currentTarget;
      const difficulty = difficultyCard.dataset.difficulty;
      
      // Save difficulty to game config
      this.gameConfig.difficulty = difficulty;
      
      // Save difficulty to localStorage for game access
      localStorage.setItem('selectedDifficulty', difficulty);
      
      // Navigate to deck selection
      this.navigateToSection('deck-selection');
      
      logger.info({ 
        scope: 'landing/difficulty', 
        msg: 'difficulty selected', 
        meta: { difficulty } 
      });
      
    } catch (error) {
      logger.error({ 
        scope: 'landing/difficulty', 
        msg: 'failed to handle difficulty selection', 
        err: { message: error.message } 
      });
    }
  }

  /**
   * Handle second player form submission
   */
  handleSecondPlayerFormSubmit(event) {
    event.preventDefault();
    
    try {
      const nameInput = document.getElementById('second-player-name');
      const playerName = nameInput.value.trim();
      
      if (!playerName) {
        this.showError('Bitte gib den Namen des zweiten Spielers ein.');
        return;
      }
      
      if (!this.secondPlayerData.avatar) {
        this.showError('Bitte wähle einen Avatar für den zweiten Spieler aus.');
        return;
      }
      
      // Save second player data
      this.secondPlayerData.name = playerName;
      this.saveSecondPlayerData();
      
      // Navigate to deck selection
      this.navigateToSection('deck-selection');
      
      logger.info({ 
        scope: 'landing/second-player', 
        msg: 'second player data saved', 
        meta: { name: playerName, avatar: this.secondPlayerData.avatar } 
      });
      
    } catch (error) {
      logger.error({ 
        scope: 'landing/second-player', 
        msg: 'failed to handle second player form submission', 
        err: { message: error.message } 
      });
      this.showError('Fehler beim Speichern der Spielerdaten.');
    }
  }

  /**
   * Test IPC Connection
   */
  async testIPCConnection() {
    try {
      console.log('🧪 Testing IPC connection...');
      const result = await window.AXM.testIPC();
      console.log('🧪 IPC test result:', result);
      
      if (result.success) {
        console.log('✅ IPC connection working!');
        this.showConnectionStatus('IPC connection working!', false);
      } else {
        console.log('❌ IPC connection failed!');
        this.showConnectionStatus('IPC connection failed!', false);
      }
    } catch (error) {
      console.error('❌ IPC test error:', error);
      this.showConnectionStatus(`IPC test error: ${error.message}`, false);
    }
  }

  /**
   * Start LAN Server
   */
  async startLANServer() {
    try {
      console.log('🚀 startLANServer called!');
      logger.info({ scope: 'landing/lan', msg: 'Starting LAN server' });
      
      // Test IPC connection first
      await this.testIPCConnection();
      
      // Show loading state
      this.showConnectionStatus('Starting server...', true);
      
      // Start server via IPC (Electron main process)
      console.log('🚀 Calling window.AXM.startLANServer()...');
      
      // Check if window.AXM exists
      if (!window.AXM) {
        throw new Error('window.AXM is not available - not running in Electron');
      }
      
      if (!window.AXM.startLANServer) {
        throw new Error('window.AXM.startLANServer is not available');
      }
      
             const result = await window.AXM.startLANServer(this.playerData.name);
      console.log('🚀 Result from startLANServer:', result);
       
               if (result.success) {
          this.isServerClient = true; // Mark as server-client
          this.showConnectionStatus(`Server started on port ${result.port}! Waiting for players...`, false);
          logger.info({ scope: 'landing/lan', msg: 'LAN server started', meta: { port: result.port } });
          
          // Store the server port for clients to connect to
          this.serverPort = result.port;
        } else {
         const errorMsg = result.error || 'Unknown error';
         this.showConnectionStatus(`Failed to start server: ${errorMsg}`, false);
         logger.error({ scope: 'landing/lan', msg: 'Failed to start LAN server', meta: { error: errorMsg } });
       }
      
    } catch (error) {
      this.showConnectionStatus('Failed to start server', false);
      logger.error({ 
        scope: 'landing/lan', 
        msg: 'Failed to start LAN server', 
        err: { message: error.message } 
      });
    }
  }

  /**
   * Join LAN Game
   */
  async joinLANGame() {
    try {
      logger.info({ scope: 'landing/lan', msg: 'Joining LAN game' });
      
      // Show loading state
      this.showConnectionStatus('Connecting to server...', true);
      
      // Import LAN client
      const { LANClient } = await import('./lan-client.ts');
      
      // Try to find the server on different ports
      const ports = [8080, 8081, 8082, 8083, 8084];
      let connectedClient = null;
      
             for (const port of ports) {
         try {
           console.log(`🔍 Trying to connect to port ${port}...`);
           const client = new LANClient(`ws://localhost:${port}`, this.playerData.name);
           
           client.onMessage((message) => {
             console.log(`📨 Received message on port ${port}:`, message);
             this.handleLANMessage(message);
           });
           
                       client.onConnectionChange((connected) => {
              console.log(`🔗 Connection change on port ${port}:`, connected);
              if (connected) {
                this.showConnectionStatus('Connected to server! Waiting for server response...', false);
              } else {
                this.showConnectionStatus('Disconnected from server', false);
              }
            });
           
           await client.connect();
           connectedClient = client;
           console.log(`✅ Successfully connected to port ${port}`);
           break;
         } catch (error) {
           console.log(`❌ Port ${port} failed: ${error.message}`);
           continue;
         }
       }
      
      if (!connectedClient) {
        throw new Error('Could not connect to any server port');
      }
      
      // Store client for later use
      this.lanClient = connectedClient;
      
      logger.info({ scope: 'landing/lan', msg: 'Joined LAN game' });
      
    } catch (error) {
      this.showConnectionStatus('Failed to connect to server', false);
      logger.error({ 
        scope: 'landing/lan', 
        msg: 'Failed to join LAN game', 
        err: { message: error.message } 
      });
    }
  }

  /**
   * Handle LAN messages
   */
  handleLANMessage(message) {
    try {
      logger.debug({ 
        scope: 'landing/lan', 
        msg: 'Received LAN message', 
        meta: { type: message.type } 
      });
      
                   switch (message.type) {
        case 'joined':
          console.log('✅ Server confirmed connection for player:', message.playerName);
          this.serverPlayerName = message.playerName; // Store server player name
          this.showConnectionStatus(`Connected to server ${message.playerName}! Waiting for other players...`, false);
          // Send ready message to server
          if (this.lanClient) {
            this.lanClient.sendMessage({ type: 'ready' });
            console.log('📤 Sent ready message to server');
          }
          break;
       case 'playerJoined':
         this.showConnectionStatus(`${message.playerName} has joined the game!`, false);
         break;
        case 'playerLeft':
          this.showConnectionStatus(`${message.playerName} has left the game`, false);
          break;
        case 'playerReady':
          this.showConnectionStatus(`${message.playerName} is ready!`, false);
          break;
                 case 'readyConfirmed':
           this.showConnectionStatus('You are ready! Connected to player ' + this.serverPlayerName, false);
           // Navigate to deck selection for server-client
           if (this.isServerClient) {
             this.navigateToSection('deck-selection');
           }
           break;
                   case 'deckSelection':
            console.log('🎴 Received deck selection from server:', message.deckId);
            this.handleDeckSelectionFromServer(message.deckId);
            break;
          case 'startingPlayer':
            console.log('🎲 Received starting player selection:', message.startingPlayer);
            this.showConnectionStatus(`Spieler ${message.startingPlayer} beginnt das Spiel!`, false);
            break;

         default:
           logger.warn({ 
             scope: 'landing/lan', 
             msg: 'Unknown LAN message type', 
             meta: { type: message.type } 
           });
      }
      
    } catch (error) {
      logger.error({ 
        scope: 'landing/lan', 
        msg: 'Failed to handle LAN message', 
        err: { message: error.message } 
      });
    }
  }



  /**
   * Set up IPC listeners for LAN status updates
   */
  setupIPCListeners() {
    try {
      // Listen for LAN status updates from main process
      if (window.AXM && window.AXM.on) {
        window.AXM.on('lan-status-update', (data) => {
          console.log('📡 Received LAN status update:', data);
          this.handleLANStatusUpdate(data);
        });
      }
      
      logger.debug({ scope: 'landing/ipc', msg: 'IPC listeners set up' });
    } catch (error) {
      logger.error({ 
        scope: 'landing/ipc', 
        msg: 'Failed to set up IPC listeners', 
        err: { message: error.message } 
      });
    }
  }

         /**
     * Send deck selection to client
     */
    sendDeckSelectionToClient(deckId) {
      try {
        console.log('🎴 Sending deck selection to client:', deckId);
        
        // Send deck selection via IPC to main process
        if (window.AXM && window.AXM.sendDeckSelection) {
          window.AXM.sendDeckSelection(deckId);
          this.showConnectionStatus(`Deck ${deckId} wurde ausgewählt und an Client gesendet...`, false);
        } else {
          this.showError('Deck-Auswahl konnte nicht gesendet werden.');
        }
        
        logger.info({ 
          scope: 'landing/deck', 
          msg: 'deck selection sent to client', 
          meta: { deckId } 
        });
        
      } catch (error) {
        logger.error({ 
          scope: 'landing/deck', 
          msg: 'failed to send deck selection', 
          err: { message: error.message } 
        });
        this.showError('Fehler beim Senden der Deck-Auswahl.');
      }
    }

    /**
     * Select random starting player and communicate to client
     */
    selectRandomStartingPlayer() {
      try {
        console.log('🎲 Selecting random starting player...');
        
        // For server-client: we know our name and we need to get the client's name
        // For client: we know our name and we have the server's name from the connection
        let clientPlayerName = this.playerData.name; // Default to local player name
        
        if (this.isServerClient) {
          // Server-client: we have the client's name stored
          clientPlayerName = this.clientPlayerName || "Client";
        } else {
          // Client: we have the server's name from the connection
          clientPlayerName = this.serverPlayerName || "Server";
        }
        
        // Random selection: true = server starts, false = client starts
        const serverStarts = Math.random() < 0.5;
        const startingPlayer = serverStarts ? this.playerData.name : clientPlayerName;
        
        console.log('🎲 Random selection result:', { 
          serverStarts, 
          startingPlayer, 
          serverPlayerName: this.playerData.name,
          clientPlayerName: clientPlayerName,
          serverPlayerNameFromConnection: this.serverPlayerName,
          isServerClient: this.isServerClient
        });
        
        // Send starting player selection via IPC to main process
        if (window.AXM && window.AXM.sendStartingPlayer) {
          window.AXM.sendStartingPlayer(startingPlayer, serverStarts);
          this.showConnectionStatus(`Spieler ${startingPlayer} beginnt das Spiel!`, false);
        } else {
          this.showError('Spielerauswahl konnte nicht gesendet werden.');
        }
        
        logger.info({ 
          scope: 'landing/game', 
          msg: 'random starting player selected', 
          meta: { startingPlayer, serverStarts } 
        });
        
      } catch (error) {
        logger.error({ 
          scope: 'landing/game', 
          msg: 'failed to select starting player', 
          err: { message: error.message } 
        });
        this.showError('Fehler bei der Spielerauswahl.');
      }
    }

   /**
    * Handle deck selection from server (client side)
    */
   handleDeckSelectionFromServer(deckId) {
     try {
       console.log('🎴 Checking if deck is available:', deckId);
       
       // Check if deck is available (this would normally check the actual deck files)
       const availableDecks = [
         'buildings-height-de',
         'space-height-de', 
         'temperatures-temperature-de',
         'time-inventions-en'
       ];
       
       const isAvailable = availableDecks.includes(deckId);
       
       console.log('🎴 Deck availability check:', { deckId, isAvailable });
       
       // Send response back to server
       if (this.lanClient) {
         this.lanClient.sendMessage({ 
           type: 'deckResponse', 
           deckId, 
           available: isAvailable 
         });
         console.log('📤 Sent deck response to server');
       }
       
       // Show status message
       if (isAvailable) {
         this.showConnectionStatus(`Deck ${deckId} wurde gewählt und ist vorhanden!`, false);
       } else {
         this.showConnectionStatus(`Deck ${deckId} nicht vorhanden!`, false);
       }
       
       logger.info({ 
         scope: 'landing/deck', 
         msg: 'deck availability checked', 
         meta: { deckId, available: isAvailable } 
       });
       
     } catch (error) {
       logger.error({ 
         scope: 'landing/deck', 
         msg: 'failed to handle deck selection from server', 
         err: { message: error.message } 
       });
       this.showError('Fehler bei der Deck-Überprüfung.');
     }
   }

       /**
     * Handle LAN status updates from main process
     */
    handleLANStatusUpdate(data) {
     try {
       console.log('📡 Handling LAN status update:', data);
       
              switch (data.type) {
          case 'playerConnected':
            this.showConnectionStatus(`Player ${data.playerName} connected to server!`, false);
            // Store client player name for server-client
            if (this.isServerClient && data.clientPlayerName) {
              this.clientPlayerName = data.clientPlayerName;
              console.log('🎯 Server-client: Stored client player name:', this.clientPlayerName);
            }
            break;
          case 'playerReady':
            this.showConnectionStatus(`Player ${data.playerName} is ready! Handshake complete!`, false);
            // Navigate to deck selection for server-client after handshake
            if (this.isServerClient) {
              console.log('🎯 Server-client: Navigating to deck selection after handshake');
              this.navigateToSection('deck-selection');
            }
            break;
          case 'deckResponse':
            if (data.available) {
              this.showConnectionStatus(`Deck ${data.deckId} wurde gewählt und ist vorhanden!`, false);
              // After deck confirmation, select random starting player (server-client only)
              if (this.isServerClient) {
                console.log('🎲 Deck confirmed, selecting random starting player...');
                setTimeout(() => {
                  this.selectRandomStartingPlayer();
                }, 1000); // Small delay for better UX
              }
            } else {
              this.showConnectionStatus(`Deck ${data.deckId} nicht vorhanden!`, false);
            }
            break;
          case 'startingPlayer':
            this.showConnectionStatus(`Spieler ${data.startingPlayer} beginnt das Spiel!`, false);
            break;
          default:
            console.log('📡 Unknown LAN status update type:', data.type);
        }
     } catch (error) {
       logger.error({ 
         scope: 'landing/lan-status', 
         msg: 'Failed to handle LAN status update', 
         err: { message: error.message } 
       });
     }
   }

  /**
   * Show connection status
   */
  showConnectionStatus(message, isLoading = false) {
    console.log('📡 showConnectionStatus called:', message, isLoading);
    
    const statusElement = document.querySelector('.connection-status');
    console.log('📡 Status element found:', statusElement);
    
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = `connection-status ${isLoading ? 'loading' : ''}`;
      console.log('📡 Status updated successfully');
    } else {
      console.error('📡 Status element not found!');
    }
  }

     /**
    * Handle deck selection
    */
   handleDeckSelection(event) {
     try {
       const deckCard = event.currentTarget;
       const deckId = deckCard.dataset.deck;
       
       // Check if this is a LAN game
       if (this.isServerClient) {
         // Server-client: Send deck selection to client
         this.sendDeckSelectionToClient(deckId);
       } else if (this.lanClient) {
         // Client: This shouldn't happen, but handle gracefully
         this.showError('Nur der Server kann ein Deck auswählen.');
         return;
       } else {
         // Normal singleplayer/multiplayer game
         this.saveGameConfiguration(deckId);
         this.startGame(deckId);
       }
       
       logger.info({ 
         scope: 'landing/deck', 
         msg: 'deck selected', 
         meta: { deckId, isServerClient: this.isServerClient } 
       });
       
     } catch (error) {
       logger.error({ 
         scope: 'landing/deck', 
         msg: 'failed to handle deck selection', 
         err: { message: error.message } 
       });
       this.showError('Fehler beim Laden des Spiels.');
     }
   }

  /**
   * Navigate to a specific section
   */
  navigateToSection(sectionId) {
    try {
      // Hide all sections
      document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
      });
      
      // Show target section
      const targetSection = document.getElementById(sectionId);
      if (targetSection) {
        targetSection.classList.add('active');
        this.currentSection = sectionId;
        this.updateProgress();
        
        logger.debug({ 
          scope: 'landing/navigation', 
          msg: 'navigated to section', 
          meta: { sectionId } 
        });
      }
      
    } catch (error) {
      logger.error({ 
        scope: 'landing/navigation', 
        msg: 'failed to navigate to section', 
        err: { message: error.message } 
      });
    }
  }

  /**
   * Go back to previous section
   */
  goBack() {
    try {
      const currentIndex = this.sections.indexOf(this.currentSection);
      if (currentIndex > 0) {
        const previousSection = this.sections[currentIndex - 1];
        this.navigateToSection(previousSection);
      }
      
      logger.debug({ 
        scope: 'landing/navigation', 
        msg: 'went back', 
        meta: { from: this.currentSection, to: this.sections[currentIndex - 1] } 
      });
      
    } catch (error) {
      logger.error({ 
        scope: 'landing/navigation', 
        msg: 'failed to go back', 
        err: { message: error.message } 
      });
    }
  }

  /**
   * Update progress bar
   */
  updateProgress() {
    try {
      const currentIndex = this.sections.indexOf(this.currentSection);
      const progress = ((currentIndex + 1) / this.sections.length) * 100;
      
      const progressFill = document.getElementById('progress-fill');
      const progressText = document.getElementById('progress-text');
      
      if (progressFill) {
        progressFill.style.width = `${progress}%`;
      }
      
      if (progressText) {
        progressText.textContent = `Schritt ${currentIndex + 1} von ${this.sections.length}`;
      }
      
      logger.debug({ 
        scope: 'landing/progress', 
        msg: 'progress updated', 
        meta: { progress, currentSection: this.currentSection } 
      });
      
    } catch (error) {
      logger.error({ 
        scope: 'landing/progress', 
        msg: 'failed to update progress', 
        err: { message: error.message } 
      });
    }
  }

  /**
   * Load saved data from localStorage
   */
  loadSavedData() {
    try {
      const savedPlayerData = localStorage.getItem('axesMundiPlayer');
      const savedGameConfig = localStorage.getItem('axesMundiGameConfig');
      
      if (savedPlayerData) {
        this.playerData = { ...this.playerData, ...JSON.parse(savedPlayerData) };
        
        // Restore avatar selection
        if (this.playerData.avatar) {
          const avatarOption = document.querySelector(`[data-avatar="${this.playerData.avatar}"]`);
          if (avatarOption) {
            avatarOption.classList.add('selected');
          }
        }
        
        // Restore player name
        const nameInput = document.getElementById('player-name');
        if (nameInput && this.playerData.name) {
          nameInput.value = this.playerData.name;
        }
      }
      
      if (savedGameConfig) {
        this.gameConfig = { ...this.gameConfig, ...JSON.parse(savedGameConfig) };
      }
      
      logger.debug({ 
        scope: 'landing/storage', 
        msg: 'saved data loaded', 
        meta: { playerData: this.playerData, gameConfig: this.gameConfig } 
      });
      
    } catch (error) {
      logger.error({ 
        scope: 'landing/storage', 
        msg: 'failed to load saved data', 
        err: { message: error.message } 
      });
    }
  }

  /**
   * Save player data to localStorage
   */
  savePlayerData() {
    try {
      localStorage.setItem('axesMundiPlayer', JSON.stringify(this.playerData));
      logger.debug({ 
        scope: 'landing/storage', 
        msg: 'player data saved', 
        meta: { playerData: this.playerData } 
      });
    } catch (error) {
      logger.error({ 
        scope: 'landing/storage', 
        msg: 'failed to save player data', 
        err: { message: error.message } 
      });
    }
  }

  /**
   * Save second player data to localStorage
   */
  saveSecondPlayerData() {
    try {
      localStorage.setItem('axesMundiSecondPlayerData', JSON.stringify(this.secondPlayerData));
      
      logger.info({ 
        scope: 'landing/storage', 
        msg: 'second player data saved', 
        meta: { data: this.secondPlayerData } 
      });
      
    } catch (error) {
      logger.error({ 
        scope: 'landing/storage', 
        msg: 'failed to save second player data', 
        err: { message: error.message } 
      });
    }
  }

  /**
   * Save game configuration to localStorage
   */
  saveGameConfiguration(deckId) {
    try {
      const fullConfig = {
        ...this.gameConfig,
        deckId,
        timestamp: Date.now()
      };
      
      localStorage.setItem('axesMundiGameConfig', JSON.stringify(fullConfig));
      localStorage.setItem('selectedDeck', deckId);
      localStorage.setItem('selectedGameType', this.gameConfig.type);
      
      // For hotseat mode, also save both player data
      if (this.gameConfig.type === 'hotseat') {
        localStorage.setItem('axesMundiPlayer1Data', JSON.stringify(this.playerData));
        localStorage.setItem('axesMundiPlayer2Data', JSON.stringify(this.secondPlayerData));
      }
      
      logger.info({ 
        scope: 'landing/storage', 
        msg: 'game configuration saved', 
        meta: { config: fullConfig } 
      });
      
    } catch (error) {
      logger.error({ 
        scope: 'landing/storage', 
        msg: 'failed to save game configuration', 
        err: { message: error.message } 
      });
    }
  }

  /**
   * Start the game
   */
  startGame(deckId) {
    try {
      // Show loading message
      this.showLoadingMessage('Spiel wird gestartet...');
      
      // Redirect to game page after a short delay
      setTimeout(() => {
        // In development mode, use the full URL with Vite dev server
        const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const gameUrl = isDev ? 'http://localhost:5179/game.html' : './game.html';
        window.location.href = gameUrl;
      }, 1000);
      
      logger.info({ 
        scope: 'landing/game', 
        msg: 'game starting', 
        meta: { deckId } 
      });
      
    } catch (error) {
      logger.error({ 
        scope: 'landing/game', 
        msg: 'failed to start game', 
        err: { message: error.message } 
      });
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    try {
      alert(message); // Simple alert for now, can be improved with a modal
      logger.warn({ 
        scope: 'landing/ui', 
        msg: 'error shown to user', 
        meta: { message } 
      });
    } catch (error) {
      logger.error({ 
        scope: 'landing/ui', 
        msg: 'failed to show error', 
        err: { message: error.message } 
      });
    }
  }

  /**
   * Show coming soon message
   */
  showComingSoonMessage() {
    try {
      alert('Diese Funktion wird bald verfügbar sein! 🚀');
      logger.info({ 
        scope: 'landing/ui', 
        msg: 'coming soon message shown' 
      });
    } catch (error) {
      logger.error({ 
        scope: 'landing/ui', 
        msg: 'failed to show coming soon message', 
        err: { message: error.message } 
      });
    }
  }

  /**
   * Show loading message
   */
  showLoadingMessage(message) {
    try {
      // Create loading overlay
      const overlay = document.createElement('div');
      overlay.className = 'loading-overlay';
      overlay.innerHTML = `
        <div class="loading-content">
          <div class="spinner"></div>
          <div class="loading-text">${message}</div>
        </div>
      `;
      
      // Add styles
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
      `;
      
      document.body.appendChild(overlay);
      
      logger.debug({ 
        scope: 'landing/ui', 
        msg: 'loading message shown', 
        meta: { message } 
      });
      
    } catch (error) {
      logger.error({ 
        scope: 'landing/ui', 
        msg: 'failed to show loading message', 
        err: { message: error.message } 
      });
    }
  }

  /**
   * Start LAN game (card distribution only)
   */
  async startLANGame(deckId) {
    try {
      console.log('🎮 Starting LAN game for card distribution...');
      console.log('🎮 Deck ID:', deckId);
      console.log('🎮 isServerClient:', this.isServerClient);
      console.log('🎮 serverPlayerName:', this.serverPlayerName);
      console.log('🎮 clientPlayerName:', this.clientPlayerName);
      
      // Import and use LAN game manager
      console.log('🎮 Importing LANGameManager...');
      const { LANGameManager } = await import('./lan-game.ts');
      console.log('🎮 LANGameManager imported successfully');
      
      console.log('🎮 Creating LANGameManager instance...');
      const lanGame = new LANGameManager();
      console.log('🎮 LANGameManager instance created');
      
      // Set the real player names in the LANGameManager
      if (this.serverPlayerName && this.clientPlayerName) {
        lanGame.setPlayerNames(this.serverPlayerName, this.clientPlayerName);
        console.log('🎮 Player names set in LANGameManager:', this.serverPlayerName, this.clientPlayerName);
      }
      
      // Initialize LAN game (this will handle card distribution)
      console.log('🎮 Calling initializeLANGame()...');
      await lanGame.initializeLANGame();
      console.log('🎮 initializeLANGame() completed');
      
      console.log('🎮 LAN game card distribution completed');
      
      // Show success message instead of redirecting to game.html
      this.showConnectionStatus('LAN-Spiel gestartet - Kartenverteilung abgeschlossen!', false);
      
    } catch (error) {
      console.error('🎮 Failed to start LAN game:', error);
      console.error('🎮 Error stack:', error.stack);
      this.showError('Fehler beim Starten des LAN-Spiels.');
    }
  }
}

// Initialize landing page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  try {
    new LandingPageController();
  } catch (error) {
    console.error('Failed to initialize landing page:', error);
  }
});
