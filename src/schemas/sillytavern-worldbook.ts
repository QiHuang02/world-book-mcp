import { z } from "zod";

export const SillyTavernWorldbookEntrySchema = z.object({
  uid: z.number().int().min(0),
  key: z.array(z.string()),
  keysecondary: z.array(z.string()),
  comment: z.string(),
  content: z.string(),
  constant: z.boolean(),
  vectorized: z.boolean(),
  selective: z.boolean(),
  selectiveLogic: z.number().int(),
  addMemo: z.boolean(),
  order: z.number(),
  position: z.number().int().min(0).max(7),
  disable: z.boolean(),
  ignoreBudget: z.boolean(),
  excludeRecursion: z.boolean(),
  preventRecursion: z.boolean(),
  matchPersonaDescription: z.boolean(),
  matchCharacterDescription: z.boolean(),
  matchCharacterPersonality: z.boolean(),
  matchCharacterDepthPrompt: z.boolean(),
  matchScenario: z.boolean(),
  matchCreatorNotes: z.boolean(),
  delayUntilRecursion: z.boolean(),
  probability: z.number(),
  useProbability: z.boolean(),
  depth: z.number().int(),
  outletName: z.string(),
  group: z.string(),
  groupOverride: z.boolean(),
  groupWeight: z.number(),
  scanDepth: z.number().nullable(),
  caseSensitive: z.boolean().nullable(),
  matchWholeWords: z.boolean().nullable(),
  useGroupScoring: z.boolean(),
  automationId: z.string(),
  role: z.number().int(),
  sticky: z.number().int(),
  cooldown: z.number().int(),
  delay: z.number().int(),
  triggers: z.array(z.string()),
  displayIndex: z.number().int().min(0),
  extensions: z.record(z.string(), z.unknown()),
  characterFilter: z.object({
    isExclude: z.boolean(),
    names: z.array(z.string()),
    tags: z.array(z.string()),
  }),
});

export const SillyTavernWorldbookSchema = z.object({
  name: z.string(),
  entries: z.record(z.string(), SillyTavernWorldbookEntrySchema),
});

export type SillyTavernWorldbookEntry = z.infer<typeof SillyTavernWorldbookEntrySchema>;
export type SillyTavernWorldbook = z.infer<typeof SillyTavernWorldbookSchema>;
