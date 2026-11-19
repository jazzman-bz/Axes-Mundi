import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import {
  clearLanSessionState,
  getLanSessionState,
  getSelectedDifficulty,
  getSelectedGameType,
  setCurrentPlayer,
  setLanCardDistribution,
  setLanClientPlayer,
  setLanServerPlayer,
  setSelectedDifficulty,
  setSelectedGameType,
} from '@/utils/sessionStore';

describe('sessionStore', () => {
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

    clearLanSessionState();
    localStorage.removeItem('selectedGameType');
    localStorage.removeItem('selectedDifficulty');
  });

  it('stores and retrieves selected game metadata', () => {
    setSelectedGameType('lan');
    setSelectedDifficulty('medium');

    expect(getSelectedGameType()).toBe('lan');
    expect(getSelectedDifficulty()).toBe('medium');
  });

  it('stores and clears LAN session state', () => {
    setLanServerPlayer('Server', '1', true);
    setLanClientPlayer('Client', '2');
    setCurrentPlayer('Server');
    setLanCardDistribution({ deckId: 'buildings-height-en' });

    expect(getLanSessionState()).toMatchObject({
      isServerClient: true,
      serverPlayerName: 'Server',
      clientPlayerName: 'Client',
      currentPlayer: 'Server',
    });

    clearLanSessionState();
    expect(getLanSessionState()).toMatchObject({
      isServerClient: false,
      serverPlayerName: null,
      clientPlayerName: null,
      currentPlayer: null,
      lanCardDistribution: null,
    });
  });
});
