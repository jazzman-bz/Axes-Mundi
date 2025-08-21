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
      'deck-selection'
    ];
    
    this.playerData = {
      name: '',
      avatar: null
    };
    
    this.gameConfig = {
      mode: null,
      type: null,
      difficulty: null
    };
    
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

      // Avatar selection
      const avatarOptions = document.querySelectorAll('.avatar-option');
      avatarOptions.forEach(option => {
        option.addEventListener('click', this.handleAvatarSelection.bind(this));
      });

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
      
      // Remove previous selection
      document.querySelectorAll('.avatar-option').forEach(option => {
        option.classList.remove('selected');
      });
      
      // Select new avatar
      avatarOption.classList.add('selected');
      this.playerData.avatar = avatarId;
      
      logger.debug({ 
        scope: 'landing/avatar', 
        msg: 'avatar selected', 
        meta: { avatarId } 
      });
      
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
      const optionCard = event.currentTarget;
      const option = optionCard.dataset.option;
      
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
   * Handle deck selection
   */
  handleDeckSelection(event) {
    try {
      const deckCard = event.currentTarget;
      const deckId = deckCard.dataset.deck;
      
      // Save all configuration
      this.saveGameConfiguration(deckId);
      
      // Show loading and redirect to game
      this.startGame(deckId);
      
      logger.info({ 
        scope: 'landing/deck', 
        msg: 'deck selected', 
        meta: { deckId } 
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
        window.location.href = './game.html';
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
}

// Initialize landing page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  try {
    new LandingPageController();
  } catch (error) {
    console.error('Failed to initialize landing page:', error);
  }
});
