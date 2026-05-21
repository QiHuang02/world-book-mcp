import type { WorldbookDraftEntry, WorldbookEntryPlan } from "../schemas/worldbook-draft.js";
import { getEntryTemplate } from "./entry-templates.js";

export function createDraftTemplate(plan: WorldbookEntryPlan[]): WorldbookDraftEntry[] {
  return plan.map((item) => ({
    comment: item.comment,
    entryType: item.entryType,
    keys: item.keys,
    secondaryKeys: [],
    content: getEntryTemplate(item.entryType).template,
    constant: item.constant,
    position: item.position,
    order: item.order,
    enabled: true,
    depth: item.position === "at_depth" ? 0 : undefined,
    scanDepth: item.constant ? undefined : 2,
    preventRecursion: true,
    excludeRecursion: true,
  }));
}
