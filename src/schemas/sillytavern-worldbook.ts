import { z } from "zod";

export const SillyTavernWorldbookEntrySchema = z.object({
  uid: z.number().int().min(0).default(0),
  key: z.array(z.string()).default([]),
  keysecondary: z.array(z.string()).default([]),
  comment: z.string().default(""),
  content: z.string().default(""),
  constant: z.boolean().default(true),
  vectorized: z.boolean().default(false),
  selective: z.boolean().default(false),
  selectiveLogic: z.number().int().default(0),
  addMemo: z.boolean().default(true),
  order: z.number().default(0),
  position: z.number().int().min(0).max(7).default(1),
  disable: z.boolean().default(false),
  ignoreBudget: z.boolean().default(false),
  excludeRecursion: z.boolean().default(true),
  preventRecursion: z.boolean().default(true),
  matchPersonaDescription: z.boolean().default(false),
  matchCharacterDescription: z.boolean().default(false),
  matchCharacterPersonality: z.boolean().default(false),
  matchCharacterDepthPrompt: z.boolean().default(false),
  matchScenario: z.boolean().default(false),
  matchCreatorNotes: z.boolean().default(false),
  delayUntilRecursion: z.boolean().default(false),
  probability: z.number().default(100),
  useProbability: z.boolean().default(true),
  depth: z.number().int().default(0),
  outletName: z.string().default(""),
  group: z.string().default(""),
  groupOverride: z.boolean().default(false),
  groupWeight: z.number().default(100),
  scanDepth: z.number().nullable().default(null),
  caseSensitive: z.boolean().nullable().default(null),
  matchWholeWords: z.boolean().nullable().default(null),
  useGroupScoring: z.boolean().default(false),
  automationId: z.string().default(""),
  role: z.number().int().default(0),
  sticky: z.number().int().default(0),
  cooldown: z.number().int().default(0),
  delay: z.number().int().default(0),
  triggers: z.array(z.string()).default([]),
  displayIndex: z.number().int().min(0).default(0),
  extensions: z.record(z.string(), z.unknown()).default({}),
  characterFilter: z.object({
    isExclude: z.boolean().default(false),
    names: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
  }).default({ isExclude: false, names: [], tags: [] }),
});

export const SillyTavernWorldbookSchema = z.object({
  name: z.string(),
  entries: z.record(z.string(), SillyTavernWorldbookEntrySchema),
});

export type SillyTavernWorldbookEntry = z.infer<typeof SillyTavernWorldbookEntrySchema>;
export type SillyTavernWorldbook = z.infer<typeof SillyTavernWorldbookSchema>;
