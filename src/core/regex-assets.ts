import type { RegexScriptDraft, RegexSliceData } from "../schemas/regex.js";
import type { RegexScriptAsset } from "./mvu-assets.js";

export interface RegexScriptWithSource extends RegexScriptAsset {
  sourceMap: { source: "mvu" | "html" | "regex_slice" | "third_party"; sliceId?: string; scriptId?: string; generatedBy?: string };
}

export interface RegexArtifact {
  target: "regex";
  builtAt: string;
  scripts: RegexScriptWithSource[];
  summary: { script_count: number; source_counts: Record<string, number>; deduped_count: number; conflict_count: number; disabled_count: number };
  diagnostics: { duplicates: unknown[]; conflicts: unknown[]; warnings: unknown[] };
}

export function buildRegexArtifact(input: { builtAt: string; mvuScripts?: RegexScriptAsset[]; htmlScripts?: RegexScriptAsset[]; regexSlices?: Array<{ id: string; data: RegexSliceData }> }): RegexArtifact {
  const scripts: RegexScriptWithSource[] = [];
  for (const script of input.mvuScripts ?? []) scripts.push({ ...script, sourceMap: { source: "mvu", generatedBy: "mvu" } });
  for (const script of input.htmlScripts ?? []) scripts.push({ ...script, sourceMap: { source: "html", generatedBy: "html" } });
  for (const slice of input.regexSlices ?? []) {
    for (const draft of [...slice.data.scripts].sort((a, b) => a.order - b.order || a.scriptName.localeCompare(b.scriptName, "zh-Hans-CN"))) {
      scripts.push({ ...fromDraft(draft), sourceMap: { source: draft.source === "third_party" || slice.data.purpose === "third_party" ? "third_party" : "regex_slice", sliceId: slice.id, scriptId: draft.id } });
    }
  }
  const { deduped, duplicateCount, conflictCount } = dedupeScripts(scripts);
  const source_counts: Record<string, number> = {};
  for (const script of deduped) source_counts[script.sourceMap.source] = (source_counts[script.sourceMap.source] ?? 0) + 1;
  return { target: "regex", builtAt: input.builtAt, scripts: deduped, summary: { script_count: deduped.length, source_counts, deduped_count: duplicateCount, conflict_count: conflictCount, disabled_count: deduped.filter((script) => script.disabled).length }, diagnostics: { duplicates: [], conflicts: [], warnings: [] } };
}

export function fromDraft(script: RegexScriptDraft): RegexScriptAsset {
  return { id: script.id, scriptName: script.scriptName, findRegex: script.findRegex, replaceString: script.replaceString, trimStrings: script.trimStrings, placement: script.placement, disabled: script.disabled, markdownOnly: script.markdownOnly, promptOnly: script.promptOnly, runOnEdit: script.runOnEdit, substituteRegex: script.substituteRegex, minDepth: script.minDepth, maxDepth: script.maxDepth };
}

function dedupeScripts(scripts: RegexScriptWithSource[]): { deduped: RegexScriptWithSource[]; duplicateCount: number; conflictCount: number } {
  const seen = new Set<string>();
  const names = new Map<string, string>();
  const deduped: RegexScriptWithSource[] = [];
  let duplicateCount = 0;
  let conflictCount = 0;
  for (const script of scripts) {
    const signature = JSON.stringify({ scriptName: script.scriptName, findRegex: script.findRegex, replaceString: script.replaceString, placement: script.placement, disabled: script.disabled, markdownOnly: script.markdownOnly, promptOnly: script.promptOnly, runOnEdit: script.runOnEdit, substituteRegex: script.substituteRegex, minDepth: script.minDepth, maxDepth: script.maxDepth });
    if (seen.has(signature)) { duplicateCount += 1; continue; }
    const previous = names.get(script.scriptName);
    if (previous && previous !== signature) conflictCount += 1;
    names.set(script.scriptName, signature);
    seen.add(signature);
    deduped.push(script);
  }
  return { deduped, duplicateCount, conflictCount };
}
