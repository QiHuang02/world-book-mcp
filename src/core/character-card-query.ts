import fs from "node:fs/promises";
import { safeJsonParse } from "../utils/json.js";
import { resolveReadableCardPath } from "../storage/path-policy.js";

export type CharacterCardQueryMode = "summary" | "worldbook_entries" | "greetings";

export async function queryCharacterCard(input: { path: string; mode: CharacterCardQueryMode }): Promise<unknown> {
  const resolvedPath = resolveReadableCardPath(input.path);
  const card = safeJsonParse<any>(await fs.readFile(resolvedPath, "utf8"));

  switch (input.mode) {
    case "summary":
      return {
        name: card.data?.name ?? card.name,
        spec: card.spec,
        spec_version: card.spec_version,
        greeting_count: 1 + (card.data?.alternate_greetings?.length ?? 0),
        worldbook_name: card.data?.character_book?.name,
        worldbook_entry_count: card.data?.character_book?.entries?.length ?? 0,
        tags: card.data?.tags ?? card.tags ?? [],
      };
    case "worldbook_entries":
      return {
        name: card.data?.name ?? card.name,
        entries: card.data?.character_book?.entries ?? [],
      };
    case "greetings":
      return {
        first_mes: card.data?.first_mes ?? card.first_mes,
        alternate_greetings: card.data?.alternate_greetings ?? [],
      };
  }
}
