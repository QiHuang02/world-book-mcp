import { z } from "zod";
import { CharacterGreetingsChangesSchema, CharacterProfileChangesSchema } from "../core/character-card-project-editor.js";

export const UpdateCharacterProfileInputSchema = z.object({
  project_id: z.string(),
  changes: CharacterProfileChangesSchema,
  expected_project_revision: z.number().int().nonnegative().optional(),
});

export const UpdateCharacterGreetingsInputSchema = z.object({
  project_id: z.string(),
  changes: CharacterGreetingsChangesSchema,
  expected_project_revision: z.number().int().nonnegative().optional(),
});
