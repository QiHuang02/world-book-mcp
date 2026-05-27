import type { EjsConfig } from "../schemas/ejs.js";
export interface EjsAnalysis { variable_paths: string[]; getvar_paths: string[]; getwi_refs: string[] }
export function analyzeEjsConfig(ejs: EjsConfig): EjsAnalysis { const variable_paths = [...new Set(ejs.entries.flatMap((entry) => entry.variablePaths))]; const content = ejs.entries.map((entry) => entry.content).join("\n"); return { variable_paths, getvar_paths: extract(content, /getvar\(["'`]([^"'`]+)["'`]\)/g), getwi_refs: extract(content, /getwi\(["'`]([^"'`]+)["'`]\)/g) }; }
function extract(text: string, pattern: RegExp): string[] { const values: string[] = []; for (const match of text.matchAll(pattern)) values.push(String(match[1])); return [...new Set(values)]; }
