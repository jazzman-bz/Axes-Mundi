import { logger } from '@/utils/logger';

/**
 * LAN Game Protocol - Handles message protocol between client and server
 * # Nachrichten-Protokoll
 */
export class LANGameProtocol {
  
  /**
   * Message types for LAN game communication
   */
  static readonly MESSAGE_TYPES = {
    // Connection messages
    JOIN: 'join',
    JOINED: 'joined',
    READY: 'ready',
    READY_CONFIRMED: 'readyConfirmed',
    PLAYER_JOINED: 'playerJoined',
    PLAYER_READY: 'playerReady',
    PLAYER_LEFT: 'playerLeft',
    
    // Game setup messages
    DECK_SELECTION: 'deckSelection',
    DECK_RESPONSE: 'deckResponse',
    CARD_DISTRIBUTION: 'cardDistribution',
    GAME_START: 'startGame',
    
    // Gameplay messages
    PLACE_CARD: 'placeCard',
    CARD_PLACEMENT: 'cardPlacement',
    GAME_STATE_UPDATE: 'gameStateUpdate',
    CURRENT_PLAYER_UPDATE: 'currentPlayerUpdate',
    
    // Error messages
    ERROR: 'error',
    INVALID_MESSAGE: 'invalidMessage'
  } as const;

  /**
   * Message validation schemas
   */
  private static readonly MESSAGE_SCHEMAS = {
    [LANGameProtocol.MESSAGE_TYPES.JOIN]: {
      required: ['type', 'playerName'],
      optional: []
    },
    [LANGameProtocol.MESSAGE_TYPES.READY]: {
      required: ['type', 'playerName'],
      optional: []
    },
    [LANGameProtocol.MESSAGE_TYPES.PLACE_CARD]: {
      required: ['type', 'cardId', 'position'],
      optional: ['playerName']
    },
    [LANGameProtocol.MESSAGE_TYPES.GAME_STATE_UPDATE]: {
      required: ['type', 'currentPlayer'],
      optional: ['placedCards', 'playerName']
    }
  };

  /**
   * Validate incoming message structure
   */
  static validateMessage(message: any): { isValid: boolean; errors: string[] } {
    try {
      const errors: string[] = [];
      
      // Check if message has required type
      if (!message || typeof message !== 'object') {
        errors.push('Message must be a valid object');
        return { isValid: false, errors };
      }
      
      if (!message.type || typeof message.type !== 'string') {
        errors.push('Message must have a valid type field');
        return { isValid: false, errors };
      }
      
      // Check if message type is known
      if (!Object.values(LANGameProtocol.MESSAGE_TYPES).includes(message.type)) {
        errors.push(`Unknown message type: ${message.type}`);
        return { isValid: false, errors };
      }
      
      // Validate against schema if available
      const schema = LANGameProtocol.MESSAGE_SCHEMAS[message.type as keyof typeof LANGameProtocol.MESSAGE_SCHEMAS];
      if (schema) {
        // Check required fields
        for (const field of schema.required) {
          if (!(field in message)) {
            errors.push(`Required field missing: ${field}`);
          }
        }
      }
      
      return { isValid: errors.length === 0, errors };
      
    } catch (error) {
      logger.error({
        scope: 'lan/protocol',
        msg: 'failed to validate message',
        err: { message: error.message, stack: error.stack }
      });
      return { isValid: false, errors: ['Message validation failed'] };
    }
  }

  /**
   * Create a join message
   */
  static createJoinMessage(playerName: string): any {
    return {
      type: LANGameProtocol.MESSAGE_TYPES.JOIN,
      playerName,
      timestamp: Date.now()
    };
  }

  /**
   * Create a ready message
   */
  static createReadyMessage(playerName: string): any {
    return {
      type: LANGameProtocol.MESSAGE_TYPES.READY,
      playerName,
      timestamp: Date.now()
    };
  }

  /**
   * Create a card placement message
   */
  static createCardPlacementMessage(cardId: string, position: number, playerName?: string): any {
    const message: any = {
      type: LANGameProtocol.MESSAGE_TYPES.PLACE_CARD,
      cardId,
      position,
      timestamp: Date.now()
    };
    
    if (playerName) {
      message.playerName = playerName;
    }
    
    return message;
  }

  /**
   * Create a game state update message
   */
  static createGameStateUpdateMessage(currentPlayer: string, placedCards?: any[], playerName?: string): any {
    const message: any = {
      type: LANGameProtocol.MESSAGE_TYPES.GAME_STATE_UPDATE,
      currentPlayer,
      timestamp: Date.now()
    };
    
    if (placedCards) {
      message.placedCards = placedCards;
    }
    
    if (playerName) {
      message.playerName = playerName;
    }
    
    return message;
  }

  /**
   * Create a card distribution message
   */
  static createCardDistributionMessage(distribution: any): any {
    return {
      type: LANGameProtocol.MESSAGE_TYPES.CARD_DISTRIBUTION,
      distribution,
      timestamp: Date.now()
    };
  }

  /**
   * Create a current player update message
   */
  static createCurrentPlayerUpdateMessage(currentPlayer: string): any {
    return {
      type: LANGameProtocol.MESSAGE_TYPES.CURRENT_PLAYER_UPDATE,
      currentPlayer,
      timestamp: Date.now()
    };
  }

  /**
   * Create an error message
   */
  static createErrorMessage(error: string, originalMessage?: any): any {
    const message: any = {
      type: LANGameProtocol.MESSAGE_TYPES.ERROR,
      error,
      timestamp: Date.now()
    };
    
    if (originalMessage) {
      message.originalMessage = originalMessage;
    }
    
    return message;
  }

  /**
   * Parse and validate incoming message
   */
  static parseMessage(data: string): { message: any; isValid: boolean; errors: string[] } {
    try {
      const message = JSON.parse(data);
      const validation = LANGameProtocol.validateMessage(message);
      
      if (!validation.isValid) {
        logger.warn({
          scope: 'lan/protocol',
          msg: 'invalid message received',
          meta: { 
            messageType: message.type, 
            errors: validation.errors,
            rawData: data.substring(0, 200) // Log first 200 chars for debugging
          }
        });
      }
      
      return {
        message,
        isValid: validation.isValid,
        errors: validation.errors
      };
      
    } catch (error) {
      logger.error({
        scope: 'lan/protocol',
        msg: 'failed to parse message JSON',
        err: { message: error.message, stack: error.stack },
        meta: { rawData: data.substring(0, 200) }
      });
      
      return {
        message: null,
        isValid: false,
        errors: ['Invalid JSON format']
      };
    }
  }

  /**
   * Serialize message to JSON string
   */
  static serializeMessage(message: any): string {
    try {
      return JSON.stringify(message);
    } catch (error) {
      logger.error({
        scope: 'lan/protocol',
        msg: 'failed to serialize message',
        err: { message: error.message, stack: error.stack },
        meta: { messageType: message.type }
      });
      throw error;
    }
  }

  /**
   * Check if message is of specific type
   */
  static isMessageType(message: any, type: string): boolean {
    return message && message.type === type;
  }

  /**
   * Extract timestamp from message
   */
  static getMessageTimestamp(message: any): number | null {
    return message?.timestamp || null;
  }

  /**
   * Check if message is recent (within specified time window)
   */
  static isMessageRecent(message: any, maxAgeMs: number = 30000): boolean {
    const timestamp = LANGameProtocol.getMessageTimestamp(message);
    if (!timestamp) return false;
    
    const age = Date.now() - timestamp;
    return age <= maxAgeMs;
  }

  /**
   * Log message for debugging
   */
  static logMessage(direction: 'in' | 'out', message: any, playerName?: string): void {
    try {
      const logData: any = {
        scope: 'lan/protocol',
        msg: `message ${direction}`,
        meta: { 
          type: message.type,
          timestamp: message.timestamp,
          direction
        }
      };
      
      if (playerName) {
        logData.meta.playerName = playerName;
      }
      
      // Log additional fields based on message type
      switch (message.type) {
        case LANGameProtocol.MESSAGE_TYPES.PLACE_CARD:
          logData.meta.cardId = message.cardId;
          logData.meta.position = message.position;
          break;
        case LANGameProtocol.MESSAGE_TYPES.GAME_STATE_UPDATE:
          logData.meta.currentPlayer = message.currentPlayer;
          logData.meta.placedCardsCount = message.placedCards?.length || 0;
          break;
        case LANGameProtocol.MESSAGE_TYPES.CARD_DISTRIBUTION:
          logData.meta.boardCard = message.distribution?.boardCard?.id;
          logData.meta.serverHandSize = message.distribution?.serverHand?.length;
          logData.meta.clientHandSize = message.distribution?.clientHand?.length;
          break;
      }
      
      logger.debug(logData);
      
    } catch (error) {
      logger.error({
        scope: 'lan/protocol',
        msg: 'failed to log message',
        err: { message: error.message, stack: error.stack }
      });
    }
  }
}
