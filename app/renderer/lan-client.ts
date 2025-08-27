import { logger } from '@/utils/logger';

interface LANMessage {
  type: string;
  [key: string]: any;
}

export class LANClient {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private playerName: string;
  private onMessageCallback: ((message: LANMessage) => void) | null = null;
  private onConnectionChangeCallback: ((connected: boolean) => void) | null = null;

  constructor(serverUrl: string, playerName: string) {
    this.serverUrl = serverUrl;
    this.playerName = playerName;
  }

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    try {
      logger.info({ 
        scope: 'lan/client', 
        msg: 'Connecting to server', 
        meta: { serverUrl: this.serverUrl, playerName: this.playerName } 
      });

      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        logger.info({ scope: 'lan/client', msg: 'Connected to server' });
        
        // Send join message
        this.sendMessage({
          type: 'join',
          playerName: this.playerName
        });

        if (this.onConnectionChangeCallback) {
          this.onConnectionChangeCallback(true);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          logger.debug({ 
            scope: 'lan/client', 
            msg: 'Received message', 
            meta: { type: message.type } 
          });

          if (this.onMessageCallback) {
            this.onMessageCallback(message);
          }
        } catch (error) {
          logger.error({ 
            scope: 'lan/client', 
            msg: 'Failed to parse message', 
            err: { message: error.message } 
          });
        }
      };

      this.ws.onclose = () => {
        logger.info({ scope: 'lan/client', msg: 'Disconnected from server' });
        
        if (this.onConnectionChangeCallback) {
          this.onConnectionChangeCallback(false);
        }
      };

      this.ws.onerror = (error) => {
        logger.error({ 
          scope: 'lan/client', 
          msg: 'WebSocket error', 
          err: { message: error.toString() } 
        });
      };

    } catch (error) {
      logger.error({ 
        scope: 'lan/client', 
        msg: 'Failed to connect', 
        err: { message: error.message } 
      });
      throw error;
    }
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send a message to the server
   */
  sendMessage(message: LANMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      logger.debug({ 
        scope: 'lan/client', 
        msg: 'Sent message', 
        meta: { type: message.type } 
      });
    } else {
      logger.warn({ 
        scope: 'lan/client', 
        msg: 'Cannot send message - not connected' 
      });
    }
  }

  /**
   * Send ready status
   */
  sendReady(): void {
    this.sendMessage({
      type: 'ready',
      playerName: this.playerName
    });
  }

  /**
   * Set message callback
   */
  onMessage(callback: (message: LANMessage) => void): void {
    this.onMessageCallback = callback;
  }

  /**
   * Set connection change callback
   */
  onConnectionChange(callback: (connected: boolean) => void): void {
    this.onConnectionChangeCallback = callback;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
