import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { LANGameClient } from '@/lan-client';

describe('LANGameClient', () => {
  class MockWebSocket {
    static OPEN = 1;

    readyState = MockWebSocket.OPEN;

    onopen: (() => void) | null = null;

    onmessage: ((event: { data: string }) => void) | null = null;

    onclose: (() => void) | null = null;

    onerror: ((error: unknown) => void) | null = null;

    sentMessages: string[] = [];

    constructor(public readonly url: string) {}

    send(message: string): void {
      this.sentMessages.push(message);
    }
  }

  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    });
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
  });

  it('forwards cardPlacement messages to the external callback only once', async () => {
    const client = new LANGameClient('ws://127.0.0.1:8080', 'Client');
    const onMessage = vi.fn();

    client.onMessage(onMessage);
    await client.connect();

    const socket = (client as any).ws as MockWebSocket;
    expect(socket).toBeTruthy();

    socket.onmessage?.({
      data: JSON.stringify({
        type: 'cardPlacement',
        cardId: 'card-1',
        boardPosition: 1,
        playerName: 'Server',
      }),
    });

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith({
      type: 'cardPlacement',
      cardId: 'card-1',
      boardPosition: 1,
      playerName: 'Server',
    });
  });

  it('persists joined players and LAN distribution through session storage helpers', async () => {
    const client = new LANGameClient('ws://127.0.0.1:8080', 'Client', '2');
    await client.connect();

    const socket = (client as any).ws as MockWebSocket;

    socket.onmessage?.({
      data: JSON.stringify({
        type: 'joined',
        playerName: 'Server',
        playerAvatar: '1',
        clientPlayerName: 'Client',
      }),
    });

    expect(localStorage.getItem('serverPlayerName')).toBe('Server');
    expect(localStorage.getItem('serverPlayerAvatar')).toBe('1');
    expect(localStorage.getItem('clientPlayerName')).toBe('Client');
    expect(localStorage.getItem('clientPlayerAvatar')).toBe('2');

    socket.onmessage?.({
      data: JSON.stringify({
        type: 'cardDistribution',
        distribution: {
          deckId: 'biology-mass-en',
          currentPlayer: 'Server',
          boardCard: { id: 'b1' },
          serverHand: [],
          clientHand: [],
        },
      }),
    });

    expect(localStorage.getItem('currentPlayer')).toBe('Server');
    expect(localStorage.getItem('lanCardDistribution')).toContain('biology-mass-en');
  });
});
