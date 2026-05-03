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
});
