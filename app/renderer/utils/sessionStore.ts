import type { LanCardDistributionPayload } from '../../shared/lanProtocol';

type Difficulty = 'easy' | 'medium' | 'hard';
type GameType = string | null;

const KEYS = {
  selectedDifficulty: 'selectedDifficulty',
  selectedGameType: 'selectedGameType',
  lastServerIP: 'lastServerIP',
  lanServerUrl: 'lanServerUrl',
  lanServerInfo: 'lanServerInfo',
  isServerClient: 'isServerClient',
  serverPlayerName: 'serverPlayerName',
  serverPlayerAvatar: 'serverPlayerAvatar',
  clientPlayerName: 'clientPlayerName',
  clientPlayerAvatar: 'clientPlayerAvatar',
  currentPlayer: 'currentPlayer',
  lanCardDistribution: 'lanCardDistribution',
} as const;

function readString(key: string): string | null {
  return localStorage.getItem(key);
}

function writeString(key: string, value: string | null): void {
  if (value === null) {
    localStorage.removeItem(key);
    return;
  }

  localStorage.setItem(key, value);
}

function readJson<T>(key: string): T | null {
  const rawValue = readString(key);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getSelectedGameType(): GameType {
  return (readString(KEYS.selectedGameType) as GameType) ?? null;
}

export function setSelectedGameType(gameType: Exclude<GameType, null>): void {
  writeString(KEYS.selectedGameType, gameType);
}

export function getSelectedDifficulty(): Difficulty | null {
  return (readString(KEYS.selectedDifficulty) as Difficulty | null) ?? null;
}

export function setSelectedDifficulty(difficulty: Difficulty): void {
  writeString(KEYS.selectedDifficulty, difficulty);
}

export function getLastServerIP(): string | null {
  return readString(KEYS.lastServerIP);
}

export function setLastServerIP(ipAddress: string): void {
  writeString(KEYS.lastServerIP, ipAddress);
}

export function setLanServerUrl(serverUrl: string): void {
  writeString(KEYS.lanServerUrl, serverUrl);
}

export function getLanServerInfo<T>(): T | null {
  return readJson<T>(KEYS.lanServerInfo);
}

export function setLanServerInfo(serverInfo: unknown): void {
  writeJson(KEYS.lanServerInfo, serverInfo);
}

export function setLanServerPlayer(playerName: string, avatar: string, isServerClient: boolean): void {
  writeString(KEYS.serverPlayerName, playerName);
  writeString(KEYS.serverPlayerAvatar, avatar);
  writeString(KEYS.isServerClient, String(isServerClient));
}

export function setLanClientPlayer(playerName: string, avatar: string): void {
  writeString(KEYS.clientPlayerName, playerName);
  writeString(KEYS.clientPlayerAvatar, avatar);
}

export function setCurrentPlayer(playerName: string): void {
  writeString(KEYS.currentPlayer, playerName);
}

export function setLanCardDistribution(
  distribution: Pick<LanCardDistributionPayload, 'deckId'> & Partial<LanCardDistributionPayload>,
): void {
  writeJson(KEYS.lanCardDistribution, distribution);
}

export function getLanCardDistribution(): LanCardDistributionPayload | null {
  return readJson<LanCardDistributionPayload>(KEYS.lanCardDistribution);
}

export function getLanSessionState() {
  return {
    isServerClient: readString(KEYS.isServerClient) === 'true',
    serverPlayerName: readString(KEYS.serverPlayerName),
    serverPlayerAvatar: readString(KEYS.serverPlayerAvatar),
    clientPlayerName: readString(KEYS.clientPlayerName),
    clientPlayerAvatar: readString(KEYS.clientPlayerAvatar),
    currentPlayer: readString(KEYS.currentPlayer),
    lanCardDistribution: getLanCardDistribution(),
  };
}

export function clearLanSessionState(): void {
  [
    KEYS.isServerClient,
    KEYS.serverPlayerName,
    KEYS.serverPlayerAvatar,
    KEYS.clientPlayerName,
    KEYS.clientPlayerAvatar,
    KEYS.currentPlayer,
    KEYS.lanCardDistribution,
    KEYS.lanServerInfo,
    KEYS.lanServerUrl,
  ].forEach((key) => localStorage.removeItem(key));
}
