import { describe, expect, it } from 'vitest';
import {
  parseLanCardDistribution,
  parseLanGameState,
  parseLanMessage,
} from '../../app/shared/lanProtocol';

describe('lanProtocol', () => {
  it('parses valid deck selection messages', () => {
    const message = parseLanMessage({ type: 'deckSelection', deckId: 'buildings-height-en' });
    expect(message.type).toBe('deckSelection');
    expect(message.deckId).toBe('buildings-height-en');
  });

  it('rejects invalid join messages', () => {
    expect(() => parseLanMessage({ type: 'join', playerName: '' })).toThrow();
  });

  it('parses card distribution payloads with defaults', () => {
    const payload = parseLanCardDistribution({ deckId: 'buildings-height-en' });
    expect(payload.serverHand).toEqual([]);
    expect(payload.clientHand).toEqual([]);
    expect(payload.deckOrder).toEqual([]);
  });

  it('parses LAN game state snapshots', () => {
    const snapshot = parseLanGameState({ currentPlayer: 'Jochen', placedCards: [{ id: 'c1' }] });
    expect(snapshot.currentPlayer).toBe('Jochen');
    expect(snapshot.placedCards).toHaveLength(1);
  });
});
