import type { Project } from "../schemas/project.js";
import type { PatchMatch, WorldbookPatch, WorldbookPatchOperation } from "../schemas/worldbook-patch.js";
import type { WorldbookDraftEntry } from "../schemas/worldbook-draft.js";
import { createId, nowIso } from "../utils/ids.js";
import { applyAddOrUpdateDraftEntry, normalizeWorldbookEntry } from "./worldbook-entry-factory.js";
import { validateWorldbookDraft } from "./worldbook-validator.js";

export interface PatchDiffItem {
  op: WorldbookPatchOperation["op"];
  target: string;
  before?: unknown;
  after?: unknown;
}

export interface PatchApplicationResult {
  entries: WorldbookDraftEntry[];
  diff: PatchDiffItem[];
}

export function createPatch(input: { projectId: string; sourcePath?: string; operations: WorldbookPatchOperation[] }): WorldbookPatch {
  return {
    id: createId("patch"),
    projectId: input.projectId,
    sourcePath: input.sourcePath,
    operations: input.operations,
    createdAt: nowIso(),
  };
}

export function applyPatchToDraft(entries: WorldbookDraftEntry[], operations: WorldbookPatchOperation[]): PatchApplicationResult {
  const next = entries.map(cloneEntry);
  const diff: PatchDiffItem[] = [];

  for (const operation of operations) {
    switch (operation.op) {
      case "add_entry": {
        const entry = normalizeWorldbookEntry(operation.entry);
        next.push(entry);
        diff.push({ op: operation.op, target: `index=${next.length - 1}`, after: entry });
        break;
      }
      case "add_or_update_entry": {
        const applied = applyAddOrUpdateDraftEntry(next, operation.entry, { matchByKeys: operation.match_by_keys });
        const before = applied.action === "created" ? undefined : cloneEntry(next[applied.index]);
        next.splice(0, next.length, ...applied.entries);
        diff.push({ op: operation.op, target: targetLabel(applied.entry, applied.index), before, after: applied.entry });
        break;
      }
      case "update_entry": {
        const index = resolveIndex(next, operation.match);
        const before = cloneEntry(next[index]);
        next[index] = normalizeWorldbookEntry({
          comment: operation.changes.comment ?? next[index].comment,
          content: operation.changes.content ?? next[index].content,
          keys: operation.changes.keys ?? next[index].keys,
          secondaryKeys: operation.changes.secondaryKeys ?? operation.changes.secondary_keys ?? next[index].secondaryKeys,
          entryType: operation.changes.entryType ?? operation.changes.entry_type ?? next[index].entryType,
          characterName: operation.changes.characterName ?? operation.changes.character_name ?? next[index].characterName,
          constant: operation.changes.constant ?? next[index].constant,
          position: operation.changes.position ?? next[index].position,
          order: operation.changes.order ?? next[index].order,
          enabled: operation.changes.enabled ?? next[index].enabled,
          depth: operation.changes.depth ?? next[index].depth,
          scanDepth: operation.changes.scanDepth === null || operation.changes.scan_depth === null ? null : operation.changes.scanDepth ?? operation.changes.scan_depth ?? next[index].scanDepth,
        }, next[index]);
        diff.push({ op: operation.op, target: targetLabel(next[index], index), before, after: next[index] });
        break;
      }
      case "delete_entry": {
        const index = resolveIndex(next, operation.match);
        const [removed] = next.splice(index, 1);
        diff.push({ op: operation.op, target: targetLabel(removed, index), before: removed });
        break;
      }
      case "reorder_entry": {
        const index = resolveIndex(next, operation.match);
        const before = cloneEntry(next[index]);
        next[index] = normalizeWorldbookEntry({ ...next[index], order: operation.order });
        diff.push({ op: operation.op, target: targetLabel(next[index], index), before, after: next[index] });
        break;
      }
      case "toggle_entry": {
        const index = resolveIndex(next, operation.match);
        const before = cloneEntry(next[index]);
        next[index] = normalizeWorldbookEntry({ ...next[index], enabled: operation.enabled });
        diff.push({ op: operation.op, target: targetLabel(next[index], index), before, after: next[index] });
        break;
      }
    }
  }

  return { entries: next, diff };
}

export function previewPatch(project: Project, patch: WorldbookPatch): PatchApplicationResult & { validation: ReturnType<typeof validateWorldbookDraft> } {
  if (!project.draft) throw new Error("项目尚未保存 worldbook draft");
  const result = applyPatchToDraft(project.draft, patch.operations);
  return { ...result, validation: validateWorldbookDraft(result.entries) };
}

function resolveIndex(entries: WorldbookDraftEntry[], match: PatchMatch): number {
  if (match.index !== undefined) {
    if (!entries[match.index]) throw new Error(`未找到 index=${match.index} 的条目`);
    return match.index;
  }
  if (match.uid !== undefined) {
    const sourceUidIndex = entries.findIndex((entry) => entry.sourceUid === match.uid);
    if (sourceUidIndex >= 0) return sourceUidIndex;
    const hasSourceUid = entries.some((entry) => entry.sourceUid !== undefined);
    if (hasSourceUid) throw new Error(`未找到 sourceUid=${match.uid} 的条目`);
    throw new Error(`未找到 sourceUid=${match.uid} 的条目`);
  }
  const index = entries.findIndex((entry) => entry.comment === match.comment);
  if (index === -1) throw new Error(`未找到 comment=${match.comment} 的条目`);
  return index;
}

function cloneEntry(entry: WorldbookDraftEntry): WorldbookDraftEntry {
  return {
    ...entry,
    keys: [...entry.keys],
    secondaryKeys: [...entry.secondaryKeys],
  };
}

function targetLabel(entry: WorldbookDraftEntry, index: number): string {
  return `index=${index}; comment=${entry.comment}`;
}
