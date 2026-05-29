import fs from "node:fs/promises";
import path from "node:path";
import type { Project } from "../schemas/project.js";
import { createProject, projectDir, writeDraft } from "../storage/workspace.js";
import { resolveSourceFilePath } from "../storage/path-policy.js";
import { parseYaml, readTextFile, writeTextFile } from "../utils/yaml.js";
import { sanitizeFilename } from "../utils/ids.js";

export interface NovaImportResult { ok: boolean; project_id: string; project_path: string; imported_from: string; notes: string[] }

export async function importNovaConfig(inputPath: string, nameOverride: string | undefined, ifExists: "error" | "overwrite"): Promise<NovaImportResult> {
  const absolutePath = path.resolve(inputPath);
  const baseDir = path.dirname(absolutePath);
  const config = parseYaml<Record<string, unknown>>(await fs.readFile(absolutePath, "utf8"));
  const name = nameOverride || String(config.name ?? path.basename(absolutePath, path.extname(absolutePath)));
  const created = await createProject({ name, output: "character_card", source: "modify_existing", ifExists });
  const project = created.project;
  const notes: string[] = [];
  const fields = (config.fields as Record<string, unknown> | undefined) ?? {};
  const cardRefs: Record<string, string> = { personality: "", scenario: "", creator_notes: "", mes_example: "", system_prompt: "", post_history_instructions: "" };
  const worldbookEntries: unknown[] = [];

  const firstMes = await readNovaRef(baseDir, fields.first_mes);
  await writeSource(project, "fields/first_mes.md", firstMes);

  for (const [field, type] of [["description", "character_basic"], ["personality", "character_personality"], ["scenario", "background"], ["creator_notes", "other"]] as const) {
    const content = await readNovaRef(baseDir, fields[field]);
    if (!content.trim()) continue;
    const rel = `entries/${String(worldbookEntries.length).padStart(3, "0")}-nova-${field}.xyaml`;
    await writeSource(project, rel, content);
    worldbookEntries.push(entry(`nova-${field}`, `Nova ${field}`, type, `../source/${rel}`, worldbookEntries.length));
    notes.push(`${field} 已转为世界书条目`);
  }

  for (const field of ["mes_example", "system_prompt", "post_history_instructions"] as const) {
    const content = await readNovaRef(baseDir, fields[field]);
    if (!content.trim()) continue;
    const rel = `fields/${field}.md`;
    await writeSource(project, rel, content);
    cardRefs[field] = `../source/${rel}`;
  }

  const characterBook = (config.character_book as Record<string, unknown> | undefined) ?? {};
  const entries = Array.isArray(characterBook.entries) ? characterBook.entries as Array<Record<string, unknown>> : [];
  for (const [index, raw] of entries.entries()) {
    const content = await readNovaRef(baseDir, raw.content);
    const rel = `entries/${String(index + worldbookEntries.length + 1).padStart(3, "0")}-${safeName(String(raw.comment ?? `entry-${index + 1}`))}.xyaml`;
    await writeSource(project, rel, content);
    worldbookEntries.push(entry(`nova-entry-${index + 1}`, String(raw.comment ?? `Nova Entry ${index + 1}`), "other", `../source/${rel}`, Number(raw.insertion_order ?? index + 1), { position: positionName(String(raw.position ?? "after_char")), depth: typeof raw.depth === "number" ? raw.depth : 4, enabled: raw.enabled !== false }));
  }

  const assets = { mvu: { enabled: false }, html: { statusbar: { enabled: false, mode: "safe_macro" } }, regex: {}, ejs: { enabled: false, entries: [] } } as Record<string, unknown>;
  const extensions = (config.extensions as Record<string, unknown> | undefined) ?? {};
  const statusBar = await readNovaRef(baseDir, extensions.status_bar);
  if (statusBar.trim()) {
    await writeSource(project, "html/statusbar.html", statusBar);
    assets.html = { statusbar: { enabled: true, html: "../source/html/statusbar.html", mode: /<script\b/i.test(statusBar) ? "dynamic_js" : "safe_macro" } };
  }

  const scripts = Array.isArray(config.scripts) ? config.scripts as Array<Record<string, unknown>> : [];
  for (const script of scripts) {
    const scriptName = String(script.name ?? "script");
    const content = await readNovaRef(baseDir, script.content);
    if (!content.trim()) continue;
    if (/变量结构|schema/i.test(scriptName)) {
      await writeSource(project, "mvu/schema.js", content);
      await ensureMvuDefaults(project);
      assets.mvu = { enabled: true, schema: "../source/mvu/schema.js", initvar: "../source/mvu/initvar.yaml", updateRules: "../source/mvu/update-rules.yaml", variableList: "../source/mvu/variable-list.md", outputFormat: "../source/mvu/output-format.md", variableListPath: "stat_data", hideRegex: true, beautifyRegex: true };
    } else {
      const rel = `mvu/scripts/${safeName(scriptName)}.js`;
      await writeSource(project, rel, content);
      notes.push(`TavernHelper 脚本 ${scriptName} 已保存到 source/${rel}，当前不会自动打包`);
    }
  }

  await writeDraft(project, "card", { name, description: "", ...cardRefs, first_mes: "../source/fields/first_mes.md", alternate_greetings: [], creator: String(config.creator ?? ""), character_version: String(config.character_version ?? "1.0"), talkativeness: String(extensions.talkativeness ?? "0.5"), fav: Boolean(extensions.fav ?? false), worldbook: { include: true, name: String(characterBook.name ?? name) } });
  await writeDraft(project, "worldbook", { name: String(characterBook.name ?? name), entries: worldbookEntries });
  await writeDraft(project, "assets", assets);
  return { ok: true, project_id: project.id, project_path: projectDir(project.slug), imported_from: absolutePath, notes };
}

async function readNovaRef(baseDir: string, value: unknown): Promise<string> {
  const ref = String(value ?? "");
  if (!ref.trim()) return "";
  const filePath = path.resolve(baseDir, ref);
  try { return await readTextFile(filePath); } catch { return ref; }
}

async function writeSource(project: Project, relativePath: string, content: string): Promise<void> {
  await writeTextFile(resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, relativePath), content);
}

async function ensureMvuDefaults(project: Project): Promise<void> {
  const defaults = { "mvu/initvar.yaml": "{}\n", "mvu/update-rules.yaml": "{}\n", "mvu/variable-list.md": "", "mvu/output-format.md": "" };
  for (const [relative, content] of Object.entries(defaults)) {
    const filePath = resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, relative);
    try { await fs.access(filePath); } catch { await writeTextFile(filePath, content); }
  }
}

function entry(id: string, comment: string, type: string, content: string, order: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { id, comment, type, content, enabled: extra.enabled ?? true, constant: true, keys: [], secondary_keys: [], position: extra.position ?? "after_char", order, depth: extra.depth ?? 4, scanDepth: null, preventRecursion: true, excludeRecursion: true };
}
function positionName(value: string): string {
  if (["before_char", "after_char", "before_an", "after_an", "at_depth", "before_em", "after_em", "outlet"].includes(value)) return value;
  return "after_char";
}
function safeName(value: string): string { return sanitizeFilename(value).replace(/\s+/g, "-"); }
