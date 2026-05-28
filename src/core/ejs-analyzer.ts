import type { EjsConfig } from "../schemas/ejs.js";

export interface EjsAnalysis {
  variablePaths: string[];
  declaredVariablePaths: string[];
  contentVariablePaths: string[];
  getvarPaths: string[];
  getwiRefs: Array<{ entryName: string; ref: string }>;
  unawaitedGetwiRefs: Array<{ entryName: string; ref: string }>;
}

export function normalizeEjsUiPath(path: string): string {
  return toStatDataPath(path);
}

function normalizeRawPath(path: string): string {
  return path.trim().replace(/\[(\d+)\]/g, ".$1").replace(/\.+/g, ".").replace(/^\.|\.$/g, "");
}

function toStatDataPath(path: string): string {
  const normalized = normalizeRawPath(path);
  return normalized === "stat_data" || normalized.startsWith("stat_data.") ? normalized : `stat_data.${normalized}`;
}

export function analyzeEjsConfig(ejs: EjsConfig): EjsAnalysis {
  const entries = ejs.entries ?? [];
  const declaredVariablePaths = unique(entries.flatMap((entry) => entry.variablePaths ?? []).map(toStatDataPath));
  const contentVariablePaths = unique(entries.flatMap((entry) => extractContentPaths(entry.content ?? "")));
  const getvarPaths = unique(entries.flatMap((entry) => extract(entry.content ?? "", /getvar\(\s*["'`]([^"'`]+)["'`]/g).map(toStatDataPath)));
  const getwiRefs = entries.flatMap((entry) => extract(entry.content ?? "", /getwi\(\s*["'`]([^"'`]+)["'`]\s*\)/g).map((ref) => ({ entryName: entry.name, ref })));
  const unawaitedGetwiRefs = entries.flatMap((entry) => extractUnawaitedGetwi(entry.content ?? "").map((ref) => ({ entryName: entry.name, ref })));
  return { variablePaths: unique([...declaredVariablePaths, ...contentVariablePaths]), declaredVariablePaths, contentVariablePaths, getvarPaths, getwiRefs: uniqueRefs(getwiRefs), unawaitedGetwiRefs: uniqueRefs(unawaitedGetwiRefs) };
}

function extractContentPaths(content: string): string[] {
  const paths = new Set<string>();
  for (const value of extract(content, /getvar\(\s*["'`]([^"'`]+)["'`]/g)) paths.add(toStatDataPath(value));
  for (const value of extract(content, /_\.get\(\s*stat_data\s*,\s*["'`]([^"'`]+)["'`]/g)) paths.add(toStatDataPath(value));
  for (const value of extract(content, /_\.get\(\s*getvar\(\s*["'`]stat_data["'`]\s*\)\s*,\s*["'`]([^"'`]+)["'`]/g)) paths.add(toStatDataPath(value));
  return [...paths];
}

function extract(text: string, pattern: RegExp): string[] {
  const values: string[] = [];
  for (const match of text.matchAll(pattern)) values.push(String(match[1]));
  return values;
}

function extractUnawaitedGetwi(content: string): string[] {
  const refs: string[] = [];
  const pattern = /getwi\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
  for (const match of content.matchAll(pattern)) {
    const before = content.slice(Math.max(0, match.index - 16), match.index);
    if (!/await\s*$/.test(before)) refs.push(String(match[1]));
  }
  return refs;
}

function unique(values: string[]): string[] { return [...new Set(values.filter(Boolean))]; }
function uniqueRefs<T extends { entryName: string; ref: string }>(refs: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const ref of refs) {
    const key = `${ref.entryName}\u0000${ref.ref}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(ref);
  }
  return result;
}
