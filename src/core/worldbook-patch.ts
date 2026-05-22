import type { Project } from "../schemas/project.js";
import type { PatchMatch, WorldbookPatch, WorldbookPatchOperation } from "../schemas/worldbook-patch.js";
import type { WorldbookDraftEntry } from "../schemas/worldbook-draft.js";
import { createId, nowIso } from "../utils/ids.js";
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
        const entry = normalizeEntry(operation.entry);
        next.push(entry);
        diff.push({ op: operation.op, target: `index=${next.length - 1}`, after: entry });
        break;
      }
      case "update_entry": {
        const index = resolveIndex(next, operation.match);
        const before = cloneEntry(next[index]);
        next[index] = normalizeEntry({
          ...next[index],
          ...operation.changes,
          scanDepth: operation.changes.scanDepth === null ? undefined : operation.changes.scanDepth ?? next[index].scanDepth,
        });
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
        next[index] = normalizeEntry({ ...next[index], order: operation.order });
        diff.push({ op: operation.op, target: targetLabel(next[index], index), before, after: next[index] });
        break;
      }
      case "toggle_entry": {
        const index = resolveIndex(next, operation.match);
        const before = cloneEntry(next[index]);
        next[index] = normalizeEntry({ ...next[index], enabled: operation.enabled });
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
    // 兼容旧项目：历史版本将 uid 当作 draft 数组下标处理。新项目应优先使用 sourceUid 或显式 index/comment。
    if (!entries[match.uid]) throw new Error(`未找到 uid=${match.uid} 的条目`);
    return match.uid;
  }
  const index = entries.findIndex((entry) => entry.comment === match.comment);
  if (index === -1) throw new Error(`未找到 comment=${match.comment} 的条目`);
  return index;
}

function normalizeEntry(entry: WorldbookDraftEntry): WorldbookDraftEntry {
  return {
    ...entry,
    keys: entry.keys ?? [],
    secondaryKeys: entry.secondaryKeys ?? [],
    enabled: entry.enabled ?? true,
    preventRecursion: true,
    excludeRecursion: true,
  };
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
