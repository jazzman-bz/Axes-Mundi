import { z } from 'zod';

const nonEmptyString = z.string().trim().min(1);
const genericCardSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
}).passthrough();

export const lanCardDistributionSchema = z.object({
  deckId: nonEmptyString,
  boardCard: genericCardSchema.nullable().optional(),
  serverHand: z.array(genericCardSchema).default([]),
  clientHand: z.array(genericCardSchema).default([]),
  deckOrder: z.array(genericCardSchema).default([]),
}).passthrough();

export type LanCardDistributionPayload = z.infer<typeof lanCardDistributionSchema>;

export const lanGameStateSchema = z.object({
  currentPlayer: nonEmptyString,
  placedCards: z.array(genericCardSchema).default([]),
}).passthrough();

export type LanGameStateSnapshot = z.infer<typeof lanGameStateSchema>;

const joinMessageSchema = z.object({
  type: z.literal('join'),
  playerName: nonEmptyString,
  playerAvatar: nonEmptyString.optional(),
}).passthrough();

const readyMessageSchema = z.object({
  type: z.literal('ready'),
}).passthrough();

const deckSelectionMessageSchema = z.object({
  type: z.literal('deckSelection'),
  deckId: nonEmptyString,
}).passthrough();

const deckResponseMessageSchema = z.object({
  type: z.literal('deckResponse'),
  deckId: nonEmptyString,
  available: z.boolean(),
}).passthrough();

const currentPlayerSetMessageSchema = z.object({
  type: z.literal('currentPlayerSet'),
  currentPlayer: nonEmptyString,
}).passthrough();

const playerTurnChangedMessageSchema = z.object({
  type: z.literal('playerTurnChanged'),
  currentPlayer: nonEmptyString,
}).passthrough();

const cardDistributionMessageSchema = z.object({
  type: z.literal('cardDistribution'),
}).merge(lanCardDistributionSchema).passthrough();

const placeCardMessageSchema = z.object({
  type: z.literal('placeCard'),
  cardId: nonEmptyString,
  boardPosition: z.number().finite(),
  currentPlayer: nonEmptyString.optional(),
}).passthrough();

const cardPlacementMessageSchema = z.object({
  type: z.literal('cardPlacement'),
  cardId: nonEmptyString,
  boardPosition: z.number().finite(),
  currentPlayer: nonEmptyString.optional(),
}).passthrough();

const playerSwitchMessageSchema = z.object({
  type: z.literal('playerSwitch'),
  currentPlayer: nonEmptyString.optional(),
  nextPlayer: nonEmptyString.optional(),
}).passthrough();

const gameRestartMessageSchema = z.object({
  type: z.literal('gameRestart'),
}).passthrough();

const remainingCardsUpdateMessageSchema = z.object({
  type: z.literal('remainingCardsUpdate'),
  remainingCards: z.array(genericCardSchema).default([]),
}).passthrough();

const gameStateUpdateMessageSchema = z.object({
  type: z.literal('gameStateUpdate'),
}).merge(lanGameStateSchema).passthrough();

export const lanInboundMessageSchema = z.union([
  joinMessageSchema,
  readyMessageSchema,
  deckSelectionMessageSchema,
  deckResponseMessageSchema,
  currentPlayerSetMessageSchema,
  playerTurnChangedMessageSchema,
  cardDistributionMessageSchema,
  placeCardMessageSchema,
  cardPlacementMessageSchema,
  playerSwitchMessageSchema,
  gameRestartMessageSchema,
  remainingCardsUpdateMessageSchema,
  gameStateUpdateMessageSchema,
]);

export type LanInboundMessage = z.infer<typeof lanInboundMessageSchema>;

export function parseLanMessage(input: unknown): LanInboundMessage {
  return lanInboundMessageSchema.parse(input);
}

export function parseLanCardDistribution(input: unknown): LanCardDistributionPayload {
  return lanCardDistributionSchema.parse(input);
}

export function parseLanGameState(input: unknown): LanGameStateSnapshot {
  return lanGameStateSchema.parse(input);
}
