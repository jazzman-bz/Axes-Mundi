/**
 * Landing Page Navigation Logic
 * Handles section transitions, form validation, and localStorage integration
 */

// Import sound manager
import { soundManager, SoundType } from './utils/soundManager.ts';
import { getDeckDescription, getDeckLocaleLabel, getDeckThemeLabel } from './utils/deckPresentation.ts';

// Silent logger for production
const logger = {
  info: () => {},
  debug: () => {},
  warn: () => {},
  error: () => {}
};

/**
 * Avatar emoji mapping
 * Maps avatar ID (1-6) to emoji
 */
const AVATAR_EMOJIS = {
  '1': '👨‍🚀', // Astronaut
  '2': '🧙‍♂️', // Wizard
  '3': '🏴‍☠️', // Pirate
  '4': '🦄', // Unicorn
  '5': '🤖', // Robot
  '6': '🐉', // Dragon
};

/**
 * Get avatar emoji from avatar ID
 */
function getAvatarEmoji(avatarId) {
  if (!avatarId) return '👤';
  return AVATAR_EMOJIS[String(avatarId)] || '👤';
}

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
        this.isServerClient = localStorage.getItem('isServerClient') === 'true';
        this.serverPlayerName = localStorage.getItem('serverPlayerName');
        this.clientPlayerName = localStorage.getItem('clientPlayerName'); // Store client player name for server-client
        this.currentPlayer = localStorage.getItem('currentPlayer') || this.playerData.name; // Current player (starts with local player)
        this.lanClient = null;
       
               console.log('🎮 Landing page initialized with LAN state:', {
          isServerClient: this.isServerClient,
          serverPlayerName: this.serverPlayerName,
          clientPlayerName: this.clientPlayerName,
          currentPlayer: this.currentPlayer
        });
      
      this.init();
    }

  /**
   * Initialize the landing page
   */
  async init() {
    try {
      logger.info({ scope: 'landing/init', msg: 'initializing landing page' });
      
      // Initialize sound manager
      await this.initializeSoundManager();
      
      // Initialize game mode if not set
      this.initializeGameMode();
      
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
   * Initialize sound manager
   */
  async initializeSoundManager() {
    try {
      logger.info({ scope: 'landing/sound', msg: 'Initializing sound manager' });
      await soundManager.init();
      logger.info({ scope: 'landing/sound', msg: 'Sound manager initialized successfully' });
    } catch (error) {
      logger.error({ 
        scope: 'landing/sound', 
        msg: 'Failed to initialize sound manager', 
        err: { message: error.message } 
      });
    }
  }

  /**
   * Play button click sound
   */
  playButtonSound() {
    try {
      soundManager.play(SoundType.BUTTON_CLICK);
    } catch (error) {
      logger.error({ 
        scope: 'landing/sound', 
        msg: 'Failed to play button sound', 
        err: { message: error.message } 
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

      // Player name input - update header display on input change
      const playerNameInput = document.getElementById('player-name');
      if (playerNameInput) {
        playerNameInput.addEventListener('input', (event) => {
          this.playerData.name = event.target.value.trim();
          this.updatePlayerInfoDisplay();
        });
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

      // Import deck button
      const importDeckBtn = document.getElementById('import-deck-btn');
      if (importDeckBtn) {
        importDeckBtn.addEventListener('click', this.handleImportDeck.bind(this));
      }

      // Load user decks on init
      this.loadUserDecks();

      // Back buttons
      const backButtons = document.querySelectorAll('.back-btn');
      backButtons.forEach(button => {
        button.addEventListener('click', this.goBack.bind(this));
      });

      // Connect server button
      const connectServerBtn = document.getElementById('connect-server-btn');
      if (connectServerBtn) {
        connectServerBtn.addEventListener('click', this.joinLANGame.bind(this));
      }

      // Server IP input - Enter key support
      const serverIPInput = document.getElementById('server-ip');
      if (serverIPInput) {
        serverIPInput.addEventListener('keypress', (event) => {
          if (event.key === 'Enter') {
            this.joinLANGame();
          }
        });
      }

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
      // Play button sound
      this.playButtonSound();
      
      const nameInput = document.getElementById('player-name');
      const playerName = nameInput.value.trim();
      
      if (!playerName) {
        this.showError('Please enter your name.');
        return;
      }
      
      if (!this.playerData.avatar) {
        this.showError('Please select an avatar.');
        return;
      }
      
      // Save player data
      this.playerData.name = playerName;
      this.savePlayerData();
      
      // Show player info in header
      this.updatePlayerInfoDisplay();
      
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
      this.showError('Error saving player data.');
    }
  }

  /**
   * Handle avatar selection
   */
  handleAvatarSelection(event) {
    try {
      // Play button sound
      this.playButtonSound();
      
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
        // Update header display immediately when avatar changes
        this.updatePlayerInfoDisplay();
        // Save avatar immediately to localStorage
        this.savePlayerData();
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
      // Play button sound
      this.playButtonSound();
      
      const gameModeCard = event.currentTarget;
      const mode = gameModeCard.dataset.mode;
      
      this.gameConfig.mode = mode;
      
      // Clean up LAN-specific variables when switching away from LAN mode
      this.cleanupLANVariables();
      
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
      // Play button sound
      this.playButtonSound();
      
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
      
      // Clean up LAN-specific variables when switching away from LAN mode
      if (option !== 'lan') {
        this.cleanupLANVariables();
      }
      
      // Save game type to localStorage immediately
      localStorage.setItem('selectedGameType', option);
      console.log('🎮 Game type saved to localStorage:', option);
      
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
        // Show IP input for joining
        const ipInput = document.getElementById('server-ip-input');
        if (ipInput) {
          ipInput.style.display = 'block';
          // Focus on the input field
          const inputField = document.getElementById('server-ip');
          if (inputField) {
            // Load previously saved IP address from localStorage
            const savedIP = localStorage.getItem('lastServerIP');
            if (savedIP) {
              inputField.value = savedIP;
              logger.info({ scope: 'landing/lan', msg: 'Loaded saved server IP', meta: { ip: savedIP } });
            }
            inputField.focus();
          }
        }
        // Don't call joinLANGame() immediately - wait for user to enter IP
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
      // Play button sound
      this.playButtonSound();
      
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
      // Play button sound
      this.playButtonSound();
      
      const nameInput = document.getElementById('second-player-name');
      const playerName = nameInput.value.trim();
      
      if (!playerName) {
        this.showError('Please enter the second player\'s name.');
        return;
      }
      
      if (!this.secondPlayerData.avatar) {
        this.showError('Please select an avatar for the second player.');
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
      this.showError('Error saving player data.');
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
      
             const result = await window.AXM.startLANServer(this.playerData.name, this.playerData.avatar);
      console.log('🚀 Result from startLANServer:', result);
       
                      if (result.success) {
         this.isServerClient = true; // Mark as server-client
         console.log('🎮 Server-client flag set to true');
         
         // Store in localStorage for persistence
         localStorage.setItem('isServerClient', 'true');
         localStorage.setItem('serverPlayerName', this.playerData.name);
         localStorage.setItem('serverPlayerAvatar', this.playerData.avatar || 'default');
         console.log('🎮 isServerClient saved to localStorage');
         console.log('🎮 serverPlayerName saved to localStorage:', this.playerData.name);
         console.log('🎮 serverPlayerAvatar saved to localStorage:', this.playerData.avatar);
         
        // Get server IP for display
        const serverIP = this.getServerIP();
        this.showConnectionStatus(`Server started on ${serverIP}:${result.port}! Waiting for players...`, false);
        logger.info({ scope: 'landing/lan', msg: 'LAN server started', meta: { port: result.port, ip: serverIP } });
         
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
   * Get current server IP from the server itself
   */
  getServerIP() {
    // Try to get the real server IP from the server info
    const serverInfo = localStorage.getItem('lanServerInfo');
    if (serverInfo) {
      try {
        const info = JSON.parse(serverInfo);
        if (info.ip && info.ip !== '127.0.0.1') {
          console.log('🎮 Using server IP from server info:', info.ip);
          return info.ip;
        }
      } catch (e) {
        console.warn('🎮 Failed to parse server info:', e);
      }
    }
    
    // Fallback: try to detect local IP (this won't work in renderer process)
    console.log('🎮 No server info available, using fallback');
    return 'localhost'; // Fallback to localhost
  }


  /**
   * Join LAN Game
   */
  async joinLANGame() {
    try {
      logger.info({ scope: 'landing/lan', msg: 'Joining LAN game' });
      
      // Get server IP from input
      const serverIPInput = document.getElementById('server-ip');
      if (!serverIPInput || !serverIPInput.value.trim()) {
        this.showError('Please enter the server IP address.');
        return;
      }
      
      const serverIP = serverIPInput.value.trim();
      const serverUrl = `ws://${serverIP}:8080`;
      console.log(`🔍 Connecting to server: ${serverUrl}`);
      
      // Store server IP and URL in localStorage for later use
      localStorage.setItem('lastServerIP', serverIP);
      localStorage.setItem('lanServerUrl', serverUrl);
      console.log(`🔍 Stored server IP and URL in localStorage: ${serverIP}`);
      logger.info({ scope: 'landing/lan', msg: 'Saved server IP to localStorage', meta: { ip: serverIP } });
      
      // Show loading state
      this.showConnectionStatus(`Connecting to ${serverIP}:8080...`, true);
      
      // Import LAN client
      const { LANClient } = await import('./lan-client.ts');
      
      // Try to connect to the specified server
      try {
        console.log(`🔍 Trying to connect to ${serverIP}:8080...`);
        const client = new LANClient(serverUrl, this.playerData.name, this.playerData.avatar || 'default');
           
           client.onMessage((message) => {
             console.log(`📨 Received message from ${serverIP}:8080:`, message);
             this.handleLANMessage(message);
           });
           
           client.onConnectionChange((connected) => {
              console.log(`🔗 Connection change to ${serverIP}:8080:`, connected);
              if (connected) {
                this.showConnectionStatus('Connected to server! Waiting for server response...', false);
              } else {
                this.showConnectionStatus('Disconnected from server', false);
              }
            });
           
           await client.connect();
           console.log(`✅ Successfully connected to ${serverIP}:8080`);
           
           // Store client for later use
           this.lanClient = client;
           logger.info({ scope: 'landing/lan', msg: 'Joined LAN game' });
           return;
         } catch (error) {
           console.log(`❌ Connection to ${serverIP}:8080 failed: ${error.message}`);
           this.showError(`Connection to ${serverIP}:8080 failed: ${error.message}`);
           return;
         }
      
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
           // Navigate to deck selection for server-client, show waiting message for browser client
           if (this.isServerClient) {
             this.showConnectionStatus('You are ready! Connected to player ' + this.serverPlayerName, false);
             this.navigateToSection('deck-selection');
           } else {
             this.showConnectionStatus('You are ready! Connected to player ' + this.serverPlayerName + ' - waiting for server to select deck...', false);
           }
           break;
                   case 'deckSelection':
            console.log('🎴 Received deck selection from server:', message.deckId);
            this.handleDeckSelectionFromServer(message.deckId);
            break;
          case 'cardDistribution':
            console.log('🎴 Received card distribution from server:', message);
            this.handleCardDistributionFromServer(message);
            break;
                   case 'currentPlayer':
           console.log('🎲 Received current player update:', message.currentPlayer);
           this.showConnectionStatus(`Player ${message.currentPlayer}'s turn!`, false);
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
        
        window.AXM.on('server-info-update', (serverInfo) => {
          console.log('📡 Received server info update:', serverInfo);
          this.handleServerInfoUpdate(serverInfo);
        });

        // Listen for client player joined events to store avatar early
        window.AXM.on('client-player-joined', (data) => {
          if (data.clientPlayerAvatar) {
            localStorage.setItem('clientPlayerAvatar', data.clientPlayerAvatar);
          }
          if (data.clientPlayerName) {
            localStorage.setItem('clientPlayerName', data.clientPlayerName);
          }
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
        console.log('🎴 this.isServerClient:', this.isServerClient);
        console.log('🎴 this.clientPlayerName:', this.clientPlayerName);
        
        // Save selected deck to localStorage for LANGameManager to use
        localStorage.setItem('selectedDeck', deckId);
        console.log('🎴 Selected deck saved to localStorage:', deckId);
        
        // Send deck selection via IPC to main process
        if (window.AXM && window.AXM.sendDeckSelection) {
          window.AXM.sendDeckSelection(deckId);
          this.showConnectionStatus(`Deck ${deckId} was selected and sent to client...`, false);
          console.log('🎴 Deck selection sent via IPC, waiting for client response...');
        } else {
          this.showError('Could not send deck selection.');
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
        this.showError('Error sending deck selection.');
      }
    }

    /**
     * Update current player after turn
     */
    updateCurrentPlayer() {
      try {
        console.log('🎲 Updating current player...');
        
        // For server-client: we know our name and we need to get the client's name
        // For client: we know our name and we have the server's name from the connection
        let clientPlayerName = this.playerData.name; // Default to local player name
        
        if (this.isServerClient) {
          // Server-client: we have the client's name stored
          clientPlayerName = this.clientPlayerName || "Waiting for client...";
        } else {
          // Client: we have the server's name from the connection
          clientPlayerName = this.serverPlayerName || "Server";
        }
        
        // Toggle current player
        const currentPlayer = this.currentPlayer === this.playerData.name ? clientPlayerName : this.playerData.name;
        
        // Update local state
        this.currentPlayer = currentPlayer;
        localStorage.setItem('currentPlayer', currentPlayer);
        
        console.log('🎲 Current player update result:', { 
          currentPlayer, 
          serverPlayerName: this.playerData.name,
          clientPlayerName: clientPlayerName,
          serverPlayerNameFromConnection: this.serverPlayerName,
          isServerClient: this.isServerClient
        });
        
        // Send current player update via IPC to main process
        if (window.AXM && window.AXM.sendCurrentPlayerUpdate) {
          window.AXM.sendCurrentPlayerUpdate(currentPlayer);
          this.showConnectionStatus(`Player ${currentPlayer}'s turn!`, false);
        } else {
          this.showError('Could not send player switch.');
        }
        
        logger.info({ 
          scope: 'landing/game', 
          msg: 'current player updated', 
          meta: { currentPlayer } 
        });
        
      } catch (error) {
        logger.error({ 
          scope: 'landing/game', 
          msg: 'failed to update current player', 
          err: { message: error.message } 
        });
        this.showError('Error during player switch.');
      }
    }

       /**
     * Handle card distribution from server (client side)
     */
    handleCardDistributionFromServer(message) {
      try {
        console.log('🎴 Client: Received card distribution from server');
        console.log('🎴 Client: Message type:', message.type);
        console.log('🎴 Client: Distribution object:', message.distribution);
        
        if (message.distribution) {
          const distribution = message.distribution;
          console.log('🎴 Client: Deck ID:', distribution.deckId);
          console.log('🎴 Client: Board Card:', distribution.boardCard?.title || 'none');
          console.log('🎴 Client: Server Hand Size:', distribution.serverHand?.length || 0);
          console.log('🎴 Client: Client Hand Size:', distribution.clientHand?.length || 0);
          console.log('🎴 Client: Deck Size:', distribution.deckOrder?.length || 0);
                     console.log('🎴 Client: Current Player:', distribution.currentPlayer);
          
                     // Store card distribution for later use
           localStorage.setItem('lanCardDistribution', JSON.stringify(distribution));
           console.log('🎴 Client: Card distribution saved to localStorage');
           
           // Store current player
           if (distribution.currentPlayer) {
             this.currentPlayer = distribution.currentPlayer;
             localStorage.setItem('currentPlayer', this.currentPlayer);
             console.log('🎴 Client: Current player set to:', this.currentPlayer);
           }
           
           // Show success message
           this.showConnectionStatus(`Card distribution received! Starting game...`, false);
          
          // CLIENT: Start the game automatically after receiving card distribution
          console.log('🎮 Client: Starting game after receiving card distribution');
          setTimeout(() => {
            this.startClientGame(distribution.deckId);
          }, 2000); // 2 second delay for better UX
          
        } else {
          console.error('🎴 Client: No distribution object in message');
          this.showError('Error: No card data received.');
        }
        
        logger.info({ 
          scope: 'landing/card-distribution', 
          msg: 'card distribution received from server', 
          meta: { 
            hasDistribution: !!message.distribution,
            deckId: message.distribution?.deckId,
            boardCard: message.distribution?.boardCard?.title
          } 
        });
        
      } catch (error) {
        console.error('🎴 Client: Failed to handle card distribution:', error);
        logger.error({ 
          scope: 'landing/card-distribution', 
          msg: 'failed to handle card distribution from server', 
          err: { message: error.message } 
        });
        this.showError('Error processing card data.');
      }
    }

    /**
     * Handle deck selection from server (client side)
     * Dynamically checks if deck is available (bundled or user-imported)
     */
    async handleDeckSelectionFromServer(deckId) {
     try {
       console.log('🎴 Client: Checking if deck is available:', deckId);
       console.log('🎴 Client: this.lanClient exists:', !!this.lanClient);
       
       // Dynamically check if deck is available (bundled or user-imported)
       let isAvailable = false;
       
       // First try bundled decks
       try {
         const response = await fetch(`./decks/${deckId}.json`);
         if (response.ok) {
           isAvailable = true;
           console.log('🎴 Client: Deck found in bundled decks');
         }
       } catch (fetchError) {
         console.log('🎴 Client: Deck not in bundled decks, checking user decks...');
       }
       
       // If not bundled, try user decks via IPC
       if (!isAvailable && window.AXM && window.AXM.loadUserDeck) {
         try {
           const result = await window.AXM.loadUserDeck(deckId);
           if (result.success) {
             isAvailable = true;
             console.log('🎴 Client: Deck found in user decks');
           }
         } catch (ipcError) {
           console.log('🎴 Client: Deck not found in user decks either');
         }
       }
       
       console.log('🎴 Client: Deck availability check:', { deckId, isAvailable });
       
       // Send response back to server
       if (this.lanClient) {
         const response = { 
           type: 'deckResponse', 
           deckId, 
           available: isAvailable 
         };
         console.log('📤 Client: Sending deck response to server:', response);
         this.lanClient.sendMessage(response);
         console.log('📤 Client: Deck response sent successfully');
       } else {
         console.error('🎴 Client: No lanClient available to send response');
       }
       
       // Show status message
       if (isAvailable) {
         this.showConnectionStatus(`Deck ${deckId} has been selected and is available!`, false);
       } else {
         this.showConnectionStatus(`Deck ${deckId} not available - please import it first!`, false);
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
       this.showError('Error checking deck.');
     }
   }

  /**
   * Handle server info updates from main process
   */
  handleServerInfoUpdate(serverInfo) {
    try {
      console.log('🎮 Handling server info update:', serverInfo);
      
      // Store server info in localStorage for later use
      localStorage.setItem('lanServerInfo', JSON.stringify(serverInfo));
      
      // Update the displayed server IP
      this.updateServerDisplay(serverInfo);
      
      logger.info({ 
        scope: 'landing/server-info', 
        msg: 'Server info updated', 
        meta: serverInfo 
      });
    } catch (error) {
      logger.error({ 
        scope: 'landing/server-info', 
        msg: 'Failed to handle server info update', 
        err: { message: error.message } 
      });
    }
  }

  /**
   * Update server display with real IP
   */
  updateServerDisplay(serverInfo) {
    try {
      const { ip, port } = serverInfo;
      console.log(`🎮 Updating server display: ${ip}:${port}`);
      
      // Update connection status if we're showing server info
      const statusElement = document.querySelector('.connection-status');
      if (statusElement && statusElement.textContent.includes('Server started')) {
        statusElement.textContent = `Server started on ${ip}:${port}! Waiting for players...`;
      }
      
      logger.debug({ 
        scope: 'landing/server-display', 
        msg: 'Server display updated', 
        meta: { ip, port } 
      });
    } catch (error) {
      logger.error({ 
        scope: 'landing/server-display', 
        msg: 'Failed to update server display', 
        err: { message: error.message } 
      });
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
               localStorage.setItem('clientPlayerName', this.clientPlayerName);
               console.log('🎯 Server-client: Stored client player name:', this.clientPlayerName);
               console.log('🎯 Server-client: Saved to localStorage');
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
               this.showConnectionStatus(`Deck ${data.deckId} was selected and is available!`, false);
               // After deck confirmation, start the game (server-client only)
               if (this.isServerClient) {
                 console.log('🎲 Deck confirmed, starting game...');
                 setTimeout(() => {
                   console.log('🎮 Starting game with deck:', data.deckId);
                   this.startGame(data.deckId);
                 }, 1000); // Small delay for better UX
               }
             } else {
               this.showConnectionStatus(`Deck ${data.deckId} nicht vorhanden!`, false);
             }
             break;
                           case 'currentPlayer':
          this.showConnectionStatus(`Player ${data.currentPlayer}'s turn!`, false);
          // Update current player in localStorage
          this.currentPlayer = data.currentPlayer;
          localStorage.setItem('currentPlayer', this.currentPlayer);
          console.log('🎲 Current player updated from LAN status:', this.currentPlayer);
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
       // Play button sound
       this.playButtonSound();
       
       const deckCard = event.currentTarget;
       const deckId = deckCard.dataset.deck;
       
       // Check if this is a LAN game
       if (this.isServerClient) {
         // Server-client: Send deck selection to client
         this.sendDeckSelectionToClient(deckId);
       } else if (this.lanClient) {
         // Client: This shouldn't happen, but handle gracefully
         this.showError('Only the server can select a deck.');
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
       this.showError('Error loading game.');
     }
   }

  /**
   * Handle import deck button click
   * Opens file dialog to select a ZIP file containing deck.json and images
   */
  async handleImportDeck() {
    try {
      // Play button sound
      this.playButtonSound();
      
      logger.info({ scope: 'landing/import', msg: 'Import deck button clicked' });
      
      // Check if AXM API is available (running in Electron)
      if (!window.AXM || !window.AXM.importDeck) {
        this.showError('Deck import is only available in the desktop app.');
        return;
      }
      
      // Call the main process to open file dialog and import deck
      const result = await window.AXM.importDeck();
      
      if (result.cancelled) {
        logger.info({ scope: 'landing/import', msg: 'Import cancelled by user' });
        return;
      }
      
      if (!result.success) {
        this.showError(result.error || 'Failed to import deck');
        return;
      }
      
      // Successfully imported - add deck card to UI
      this.addDeckCardToUI(result.deck);
      this.showSuccess(`Deck "${result.deck.name}" imported successfully! (${result.deck.cardCount} cards)`);
      
      logger.info({ 
        scope: 'landing/import', 
        msg: 'Deck imported successfully', 
        meta: result.deck 
      });
      
    } catch (error) {
      logger.error({ 
        scope: 'landing/import', 
        msg: 'Failed to import deck', 
        err: { message: error.message } 
      });
      this.showError('Error importing deck: ' + error.message);
    }
  }

  /**
   * Load user-imported decks and add them to the UI
   */
  async loadUserDecks() {
    try {
      // Check if AXM API is available
      if (!window.AXM || !window.AXM.getUserDecks) {
        logger.debug({ scope: 'landing/import', msg: 'AXM API not available, skipping user decks load' });
        return;
      }
      
      const result = await window.AXM.getUserDecks();
      
      if (!result.success || !result.decks || result.decks.length === 0) {
        logger.debug({ scope: 'landing/import', msg: 'No user decks found' });
        return;
      }
      
      // Add each user deck to the UI
      for (const deck of result.decks) {
        this.addDeckCardToUI(deck);
      }
      
      logger.info({ 
        scope: 'landing/import', 
        msg: 'User decks loaded', 
        meta: { count: result.decks.length } 
      });
      
    } catch (error) {
      logger.error({ 
        scope: 'landing/import', 
        msg: 'Failed to load user decks', 
        err: { message: error.message } 
      });
    }
  }

  /**
   * Add a deck card to the deck selection UI
   */
  addDeckCardToUI(deck) {
    const deckGrid = document.getElementById('deck-grid');
    if (!deckGrid) {
      logger.warn({ scope: 'landing/import', msg: 'Deck grid not found' });
      return;
    }
    
    // Check if deck already exists in UI
    const existingCard = deckGrid.querySelector(`[data-deck="${deck.id}"]`);
    if (existingCard) {
      logger.debug({ scope: 'landing/import', msg: 'Deck already in UI', meta: { deckId: deck.id } });
      return;
    }
    
    // Create deck card element
    const deckCard = document.createElement('div');
    deckCard.className = 'deck-card user-deck';
    deckCard.dataset.deck = deck.id;
    deckCard.dataset.isUserDeck = 'true';
    
    const themeDisplay = getDeckThemeLabel(deck);
    const localeDisplay = getDeckLocaleLabel(deck.locale);
    const description = getDeckDescription(deck, true);
    
    deckCard.innerHTML = `
      <button class="delete-deck-btn" title="Delete deck" data-deck-id="${deck.id}">✕</button>
      <div class="deck-theme">${themeDisplay}</div>
      <h3 class="deck-title">${deck.name}</h3>
      <p class="deck-description">${description}</p>
      <div class="deck-stats">
        <span>${deck.cardCount} Cards</span>
        <span>${localeDisplay}</span>
      </div>
    `;
    
    // Add click handler for deck selection
    deckCard.addEventListener('click', (e) => {
      // Don't trigger deck selection if delete button was clicked
      if (e.target.classList.contains('delete-deck-btn')) {
        return;
      }
      this.handleDeckSelection(e);
    });
    
    // Add click handler for delete button
    const deleteBtn = deckCard.querySelector('.delete-deck-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleDeleteDeck(deck.id, deck.name);
      });
    }
    
    // Add to deck grid
    deckGrid.appendChild(deckCard);
    
    logger.info({ 
      scope: 'landing/import', 
      msg: 'Deck card added to UI', 
      meta: { deckId: deck.id, name: deck.name } 
    });
  }

  /**
   * Handle delete deck button click
   */
  async handleDeleteDeck(deckId, deckName) {
    try {
      // Play button sound
      this.playButtonSound();
      
      // Confirm deletion
      const confirmed = confirm(`Are you sure you want to delete "${deckName}"?\n\nThis will remove the deck and all its images.`);
      if (!confirmed) {
        return;
      }
      
      // Check if AXM API is available
      if (!window.AXM || !window.AXM.deleteUserDeck) {
        this.showError('Deck deletion is only available in the desktop app.');
        return;
      }
      
      const result = await window.AXM.deleteUserDeck(deckId);
      
      if (!result.success) {
        this.showError(result.error || 'Failed to delete deck');
        return;
      }
      
      // Remove deck card from UI
      const deckGrid = document.getElementById('deck-grid');
      const deckCard = deckGrid?.querySelector(`[data-deck="${deckId}"]`);
      if (deckCard) {
        deckCard.remove();
      }
      
      this.showSuccess(`Deck "${deckName}" deleted successfully.`);
      
      logger.info({ 
        scope: 'landing/import', 
        msg: 'Deck deleted', 
        meta: { deckId } 
      });
      
    } catch (error) {
      logger.error({ 
        scope: 'landing/import', 
        msg: 'Failed to delete deck', 
        err: { message: error.message } 
      });
      this.showError('Error deleting deck: ' + error.message);
    }
  }

  /**
   * Show success message to user
   */
  showSuccess(message) {
    // Create and show a success toast/notification
    const toast = document.createElement('div');
    toast.className = 'toast toast-success';
    toast.innerHTML = `<span>✅</span> ${message}`;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      animation: slideIn 0.3s ease;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 500;
    `;
    
    document.body.appendChild(toast);
    
    // Remove after 4 seconds
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
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
      // Play button sound
      this.playButtonSound();
      
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
        progressText.textContent = `Step ${currentIndex + 1} of ${this.sections.length}`;
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
        
        // Show player info in header if player data exists
        if (this.playerData.name && this.playerData.avatar) {
          this.updatePlayerInfoDisplay();
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
      console.log('🎮 startGame called with deckId:', deckId);
      console.log('🎮 this.isServerClient:', this.isServerClient);
      console.log('🎮 this.serverPlayerName:', this.serverPlayerName);
      console.log('🎮 this.clientPlayerName:', this.clientPlayerName);
      
      // Check if this is a LAN game
      if (this.isServerClient) {
        console.log('🎮 Starting LAN game as server-client...');
        this.startLANGame(deckId);
        return;
      }
      
      // Show loading message
      this.showLoadingMessage('Starting game...');
      
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
   * Update player info display in header
   */
  updatePlayerInfoDisplay() {
    try {
      const playerInfoDisplay = document.getElementById('player-info-display');
      const avatarDisplay = document.getElementById('player-avatar-display');
      const nameDisplay = document.getElementById('player-name-display');
      
      if (playerInfoDisplay && avatarDisplay && nameDisplay) {
        // Show the player info
        playerInfoDisplay.style.display = 'flex';
        
        // Set avatar emoji
        const avatarEmoji = getAvatarEmoji(this.playerData.avatar);
        avatarDisplay.textContent = avatarEmoji;
        
        // Set player name
        nameDisplay.textContent = this.playerData.name;
        
        logger.debug({ 
          scope: 'landing/ui', 
          msg: 'player info display updated', 
          meta: { name: this.playerData.name, avatar: this.playerData.avatar } 
        });
      }
    } catch (error) {
      logger.error({ 
        scope: 'landing/ui', 
        msg: 'failed to update player info display', 
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
      alert('This feature will be available soon! 🚀');
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
   * Start LAN game (server-client only)
   */
  async startLANGame(deckId) {
    try {
      console.log('🎮 Starting LAN game for server-client...');
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
      
      // Set the selected deck in localStorage for LANGameManager to use
      localStorage.setItem('selectedDeck', deckId);
      console.log('🎮 Selected deck saved to localStorage:', deckId);
      
             // Initialize LAN game (this will create card distribution but NOT send it yet)
       console.log('🎮 Calling initializeLANGame()...');
       await lanGame.initializeLANGame();
       console.log('🎮 initializeLANGame() completed');
       
       console.log('🎮 LAN game card distribution created (not sent yet)');
       
       // Show success message and redirect to LAN game
       this.showConnectionStatus('LAN game started - Switching to game board...', false);
       
               // Set LAN mode flag in localStorage
        localStorage.setItem('selectedGameType', 'lan');
        
        // Store current player from LANGameManager
        const currentPlayer = lanGame.getCurrentPlayer();
        if (currentPlayer) {
          this.currentPlayer = currentPlayer;
          localStorage.setItem('currentPlayer', this.currentPlayer);
          console.log('🎮 Server-client: Current player set to:', this.currentPlayer);
        }
        
        // Redirect to LAN game after 2 seconds
        setTimeout(() => {
          console.log('🎮 Redirecting to lan-game.html...');
          // In development mode, use the full URL with Vite dev server
          const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          const lanGameUrl = isDev ? 'http://localhost:5179/lan-game.html' : './lan-game.html';
          window.location.href = lanGameUrl;
        }, 2000);
      
    } catch (error) {
      console.error('🎮 Failed to start LAN game:', error);
      console.error('🎮 Error stack:', error.stack);
      this.showError('Error starting LAN game.');
    }
  }

  /**
   * Start LAN game (client only)
   */
  async startClientGame(deckId) {
    try {
      console.log('🎮 Starting LAN game for client...');
      console.log('🎮 Deck ID:', deckId);
      console.log('🎮 isServerClient:', this.isServerClient);
      console.log('🎮 serverPlayerName:', this.serverPlayerName);
      console.log('🎮 clientPlayerName:', this.clientPlayerName);
      
      // Set the selected deck in localStorage
      localStorage.setItem('selectedDeck', deckId);
      console.log('🎮 Selected deck saved to localStorage:', deckId);
      
             // Set LAN mode flag in localStorage
       localStorage.setItem('selectedGameType', 'lan');
       
       // Store current player from card distribution
       const lanCardDistribution = localStorage.getItem('lanCardDistribution');
       if (lanCardDistribution) {
         try {
           const distribution = JSON.parse(lanCardDistribution);
           if (distribution.currentPlayer) {
             this.currentPlayer = distribution.currentPlayer;
             localStorage.setItem('currentPlayer', this.currentPlayer);
             console.log('🎮 Client: Current player set to:', this.currentPlayer);
           }
         } catch (error) {
           console.error('🎮 Client: Failed to parse card distribution:', error);
         }
       }
       
       // Show success message and redirect to LAN game
       this.showConnectionStatus('LAN game started - Switching to game board...', false);
      
      // Redirect to LAN game after 2 seconds
      setTimeout(() => {
        console.log('🎮 Client: Redirecting to lan-game.html...');
        // In development mode, use the full URL with Vite dev server
        // In production mode, use the relative path that works in Electron
        const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const lanGameUrl = isDev ? 'http://localhost:5179/lan-game.html' : 'lan-game.html';
        console.log('🎮 Client: Redirecting to:', lanGameUrl);
        window.location.href = lanGameUrl;
      }, 2000);
      
    } catch (error) {
      console.error('🎮 Client: Failed to start LAN game:', error);
      console.error('🎮 Client: Error stack:', error.stack);
      this.showError('Error starting LAN game.');
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
   * Initialize game mode if not set
   */
  initializeGameMode() {
    try {
      const currentGameType = localStorage.getItem('selectedGameType');
      
      if (!currentGameType) {
        // Set default game type if none exists
        localStorage.setItem('selectedGameType', 'singleplayer');
        console.log('🎮 Default game type set to singleplayer');
        
        logger.info({
          scope: 'landing/init',
          msg: 'default game type initialized',
          meta: { gameType: 'singleplayer' }
        });
      } else {
        console.log('🎮 Current game type from localStorage:', currentGameType);
      }
      
    } catch (error) {
      logger.error({
        scope: 'landing/init',
        msg: 'failed to initialize game mode',
        err: { message: error.message }
      });
    }
  }

  /**
   * Clean up LAN-specific variables from localStorage
   * Preserves player name and avatar data
   */
  cleanupLANVariables() {
    try {
      console.log('🧹 Cleaning up LAN-specific variables...');
      
      // Remove LAN-specific variables but preserve player data
      const variablesToRemove = [
        'isServerClient',
        'serverPlayerName', 
        'clientPlayerName',
        'currentPlayer',
        'lanCardDistribution',
        'lanPlayerName',
        'lanOpponentName'
      ];
      
      variablesToRemove.forEach(variable => {
        if (localStorage.getItem(variable)) {
          localStorage.removeItem(variable);
          console.log('🧹 Removed from localStorage:', variable);
        }
      });
      
      // Reset instance variables
      this.isServerClient = false;
      this.serverPlayerName = null;
      this.clientPlayerName = null;
      this.currentPlayer = this.playerData.name; // Reset to current player name
      
      console.log('🧹 LAN variables cleaned up successfully');
      
      logger.info({
        scope: 'landing/cleanup',
        msg: 'LAN variables cleaned up',
        meta: { 
          preservedPlayerName: this.playerData.name,
          preservedAvatar: this.playerData.avatar 
        }
      });
      
    } catch (error) {
      logger.error({
        scope: 'landing/cleanup',
        msg: 'failed to cleanup LAN variables',
        err: { message: error.message }
      });
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
