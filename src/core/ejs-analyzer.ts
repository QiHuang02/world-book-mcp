import type { EjsConfig } from "../schemas/ejs.js";
import { normalizePath, toUiPath } from "./mvu-path-analyzer.js";

export interface EjsStageInfo {
  name: string;
  condition: string;
  condition_variables: string[];
}

export interface EjsEntryAnalysis {
  entry_name: string;
  entry_role: string;
  getvar_paths: string[];
  lodash_get_paths: string[];
  getwi_refs: string[];
  defined_names: string[];
  condition_branch_count: number;
  has_else_fallback: boolean;
  stages: EjsStageInfo[];
}

export interface EjsAnalysis {
  declared_variable_paths: string[];
  content_variable_paths: string[];
  getwi_refs: Array<{ entry_name: string; ref: string }>;
  entries: EjsEntryAnalysis[];
}

export function analyzeEjsConfig(ejs: EjsConfig): EjsAnalysis {
  const entries = ejs.entries.map((entry) => analyzeEjsEntry(entry.name, entry.role, entry.content, entry.stages));
  return {
    declared_variable_paths: [...new Set(ejs.variable_paths.map(normalizeEjsUiPath))],
    content_variable_paths: [...new Set(entries.flatMap((entry) => [...entry.getvar_paths, ...entry.lodash_get_paths]).map(normalizeEjsUiPath))],
    getwi_refs: entries.flatMap((entry) => entry.getwi_refs.map((ref) => ({ entry_name: entry.entry_name, ref }))),
    entries,
  };
}

export function normalizeEjsUiPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "";
  if (trimmed === "stat_data") return "stat_data";
  return toUiPath(normalizePath(trimmed));
}

function analyzeEjsEntry(entryName: string, entryRole: string, content: string, stages?: Array<{ name: string; condition: string }>): EjsEntryAnalysis {
  const branchCount = countConditionBranches(content);
  return {
    entry_name: entryName,
    entry_role: entryRole,
    getvar_paths: [...content.matchAll(/getvar\(\s*['"]([^'"]+)['"]\s*\)/g)].map((match) => normalizeEjsUiPath(match[1])),
    lodash_get_paths: extractLodashGetPaths(content).map(normalizeEjsUiPath),
    getwi_refs: [...content.matchAll(/getwi\(\s*['"]([^'"]+)['"]/g)].map((match) => match[1]),
    defined_names: [...content.matchAll(/\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=/g)].map((match) => match[1]),
    condition_branch_count: branchCount.ifCount,
    has_else_fallback: branchCount.hasElse,
    stages: (stages ?? []).map((stage) => ({
      name: stage.name,
      condition: stage.condition,
      condition_variables: extractConditionVariables(stage.condition),
    })),
  };
}

function countConditionBranches(content: string): { ifCount: number; hasElse: boolean } {
  // Count top-level if/else if branches in EJS content
  const ifMatches = content.match(/<%_?\s*(?:}\s*else\s+)?if\s*\(/g);
  const ifCount = ifMatches?.length ?? 0;
  // Check if there's a final else (not else if) fallback
  const hasElse = /<%_?\s*}\s*else\s*{\s*_%?>/.test(content);
  return { ifCount, hasElse };
}

function extractConditionVariables(condition: string): string[] {
  // Extract variable names referenced in a condition expression
  const vars = new Set<string>();
  for (const match of condition.matchAll(/\b([a-zA-Z_$][\w$]*)\b/g)) {
    const name = match[1];
    // Skip JS keywords and literals
    if (!["if", "else", "true", "false", "null", "undefined", "typeof", "var", "const", "let", "return", "function", "new", "this"].includes(name)) {
      vars.add(name);
    }
  }
  return [...vars];
}

function extractLodashGetPaths(content: string): string[] {
  const paths: string[] = [];
  for (const match of content.matchAll(/_\.get\(\s*(?:stat_data|getvar\(['"]stat_data['"]\))\s*,\s*(['"])(.*?)\1/g)) {
    paths.push(`stat_data.${match[2].replace(/\[(\d+)\]/g, ".$1")}`);
  }
  return paths;
}
