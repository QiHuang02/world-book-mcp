import type { EjsConfig } from "../schemas/ejs.js";
import { normalizePath, toUiPath } from "./mvu-path-analyzer.js";

export interface EjsEntryAnalysis {
  entry_name: string;
  entry_role: string;
  getvar_paths: string[];
  lodash_get_paths: string[];
  getwi_refs: string[];
  defined_names: string[];
}

export interface EjsAnalysis {
  declared_variable_paths: string[];
  content_variable_paths: string[];
  getwi_refs: Array<{ entry_name: string; ref: string }>;
  entries: EjsEntryAnalysis[];
}

export function analyzeEjsConfig(ejs: EjsConfig): EjsAnalysis {
  const entries = ejs.entries.map((entry) => analyzeEjsEntry(entry.name, entry.role, entry.content));
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

function analyzeEjsEntry(entryName: string, entryRole: string, content: string): EjsEntryAnalysis {
  return {
    entry_name: entryName,
    entry_role: entryRole,
    getvar_paths: [...content.matchAll(/getvar\(\s*['"]([^'"]+)['"]\s*\)/g)].map((match) => normalizeEjsUiPath(match[1])),
    lodash_get_paths: extractLodashGetPaths(content).map(normalizeEjsUiPath),
    getwi_refs: [...content.matchAll(/getwi\(\s*['"]([^'"]+)['"]/g)].map((match) => match[1]),
    defined_names: [...content.matchAll(/\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=/g)].map((match) => match[1]),
  };
}

function extractLodashGetPaths(content: string): string[] {
  const paths: string[] = [];
  for (const match of content.matchAll(/_\.get\(\s*(?:stat_data|getvar\(['"]stat_data['"]\))\s*,\s*(['"])(.*?)\1/g)) {
    paths.push(`stat_data.${match[2].replace(/\[(\d+)\]/g, ".$1")}`);
  }
  return paths;
}
