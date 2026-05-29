import fs from "node:fs/promises";
import path from "node:path";
import type { Project } from "../schemas/project.js";
import type { WorldbookEntryDraft } from "../schemas/draft.js";
import { draftPath, projectDir, projectPath, readDraft, writeDraft } from "../storage/workspace.js";
import { resolveDraftReference, resolveExportFilePath, resolveReportFilePath } from "../storage/path-policy.js";
import { readTextFile, writeYamlFile } from "../utils/yaml.js";

export type EntryStatus = "planned" | "drafted" | "reviewed" | "done";
export interface EntryStatusUpdate { status?: EntryStatus; abstract?: string; sourceRefs?: string[]; part?: string; scope?: "catalog" | "specific" }
export interface QueryEntriesOptions { status?: EntryStatus; part?: string; scope?: "catalog" | "specific"; include_content?: boolean }

export async function updateEntryStatus(project: Project, entryId: string, update: EntryStatusUpdate): Promise<{ ok: boolean; project_id: string; entry: unknown }> {
  const draft = await readDraft(project);
  if (!draft.worldbook) throw new Error("缺少 draft/worldbook.yaml");
  const index = draft.worldbook.entries.findIndex((entry) => entry.id === entryId);
  if (index === -1) throw new Error(`未找到世界书条目: ${entryId}`);
  const next = { ...draft.worldbook.entries[index], ...definedOnly({ ...update }) };
  const entries = [...draft.worldbook.entries];
  entries[index] = next;
  await writeDraft(project, "worldbook", { ...draft.worldbook, entries });
  return { ok: true, project_id: project.id, entry: summarizeEntry(project, next, false) };
}

export async function queryEntries(project: Project, options: QueryEntriesOptions = {}): Promise<{ ok: boolean; project_id: string; summary: unknown; entries: unknown[] }> {
  const draft = await readDraft(project);
  const entries = draft.worldbook?.entries ?? [];
  const filtered = entries.filter((entry) => (!options.status || entry.status === options.status) && (!options.part || entry.part === options.part) && (!options.scope || entry.scope === options.scope));
  const summaries = await Promise.all(filtered.map((entry) => summarizeEntry(project, entry, Boolean(options.include_content))));
  return { ok: true, project_id: project.id, summary: await entrySummary(project, entries), entries: summaries };
}

export async function entrySummary(project: Project, entries: WorldbookEntryDraft[]): Promise<Record<string, unknown>> {
  const byStatus: Record<string, number> = {};
  const byPart: Record<string, number> = {};
  let missingContent = 0;
  let missingAbstract = 0;
  let missingSourceRefs = 0;
  for (const entry of entries) {
    const status = entry.status ?? "planned";
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    const part = entry.part ?? entry.type ?? "other";
    byPart[part] = (byPart[part] ?? 0) + 1;
    if (!entry.abstract) missingAbstract += 1;
    if ((project.kind.source === "derivative" || project.kind.source === "composite") && (!entry.sourceRefs || entry.sourceRefs.length === 0)) missingSourceRefs += 1;
    try {
      const contentPath = resolveDraftReference(projectDir(project.slug), draftPath(project, "worldbook"), entry.content);
      await fs.access(contentPath);
    } catch {
      missingContent += 1;
    }
  }
  return {
    total: entries.length,
    by_status: byStatus,
    by_part: byPart,
    missing_content: missingContent,
    missing_abstract: missingAbstract,
    missing_source_refs: missingSourceRefs,
    next_planned: entries.find((entry) => (entry.status ?? "planned") === "planned")?.id ?? null,
    needs_review: entries.filter((entry) => entry.status === "drafted").map((entry) => entry.id),
  };
}

export async function generateTavernSyncConfig(project: Project, options: { name?: string; type?: "worldbook" | "preset"; tavern_name?: string; local_path?: string; export_path?: string; user_name?: string; output_path?: string; overwrite?: boolean }): Promise<{ ok: boolean; project_id: string; path: string; config: unknown }> {
  const configName = options.name ?? project.name;
  const outputPath = resolveReportFilePath(projectDir(project.slug), project.paths.reports, options.output_path, "tavern-sync.yaml");
  if (!options.overwrite) {
    try { await fs.access(outputPath); throw new Error(`文件已存在: ${outputPath}`); } catch (error) { if (error instanceof Error && error.message.startsWith("文件已存在")) throw error; }
  }
  const localPath = options.local_path ?? path.relative(path.dirname(outputPath), draftPath(project, "worldbook")).replace(/\\/g, "/");
  const exportPath = options.export_path ?? path.relative(path.dirname(outputPath), resolveExportFilePath(projectDir(project.slug), project.paths.exports, undefined, `${project.slug}.worldbook.json`)).replace(/\\/g, "/");
  const config = {
    "user名称": options.user_name ?? "<user>",
    "配置": {
      [configName]: {
        "类型": options.type === "preset" ? "预设" : "世界书",
        "酒馆中的名称": options.tavern_name ?? project.name,
        "本地文件路径": localPath,
        "导出文件路径": exportPath,
      },
    },
  };
  await writeYamlFile(outputPath, config);
  return { ok: true, project_id: project.id, path: outputPath, config };
}

async function summarizeEntry(project: Project, entry: WorldbookEntryDraft, includeContent: boolean): Promise<Record<string, unknown>> {
  const contentPath = resolveDraftReference(projectDir(project.slug), draftPath(project, "worldbook"), entry.content);
  let contentExists = true;
  let content: string | undefined;
  try { content = includeContent ? await readTextFile(contentPath) : undefined; if (!includeContent) await fs.access(contentPath); } catch { contentExists = false; }
  return { id: entry.id, comment: entry.comment, type: entry.type, part: entry.part, scope: entry.scope, status: entry.status ?? "planned", abstract: entry.abstract, sourceRefs: entry.sourceRefs ?? [], content: entry.content, content_exists: contentExists, text: content };
}

function definedOnly<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}
