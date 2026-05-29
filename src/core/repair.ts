import type { AssetsDraft, CardDraft, WorldbookDraft } from "../schemas/draft.js";
import type { Project } from "../schemas/project.js";
import { draftPath, projectDir, writeDraft } from "../storage/workspace.js";
import { resolveDraftReference, resolveSourceFilePath } from "../storage/path-policy.js";
import { parseYaml, readTextFile, writeTextFile } from "../utils/yaml.js";

export interface RepairProjectOptions { dry_run?: boolean }
export interface RepairAction { code: string; message: string; path?: string }
export interface RepairProjectResult { ok: boolean; project_id: string; dry_run: boolean; actions: RepairAction[] }

export async function repairProject(project: Project, options: RepairProjectOptions = {}): Promise<RepairProjectResult> {
  const dryRun = options.dry_run ?? false;
  const actions: RepairAction[] = [];
  const card = await readLooseDraft<CardDraft>(project, "card");
  const worldbook = await readLooseDraft<WorldbookDraft>(project, "worldbook");
  const assets = await readLooseDraft<AssetsDraft>(project, "assets");

  const repairedWorldbook = worldbook ? await repairWorldbook(project, worldbook, actions, dryRun) : undefined;
  const repairedCard = card ? await repairCard(project, card, repairedWorldbook, actions, dryRun) : undefined;
  const repairedAssets = assets ? await repairAssets(project, assets, actions, dryRun) : undefined;

  if (!dryRun) {
    if (repairedWorldbook) await writeDraft(project, "worldbook", repairedWorldbook);
    if (repairedCard) await writeDraft(project, "card", repairedCard);
    if (repairedAssets) await writeDraft(project, "assets", repairedAssets);
  }

  return { ok: true, project_id: project.id, dry_run: dryRun, actions };
}

async function readLooseDraft<T>(project: Project, target: "card" | "worldbook" | "assets"): Promise<T | undefined> {
  try {
    return parseYaml<T>(await readTextFile(draftPath(project, target)));
  } catch {
    return undefined;
  }
}

async function repairCard(project: Project, card: CardDraft, worldbook: WorldbookDraft | undefined, actions: RepairAction[], dryRun: boolean): Promise<CardDraft> {
  const next = { ...card } as CardDraft;
  if (typeof next.description === "string" && next.description.trim()) {
    const rel = "entries/000-repaired-description.xyaml";
    const filePath = resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, rel);
    if (!dryRun) await writeTextFile(filePath, next.description);
    if (worldbook) {
      worldbook.entries = [
        { id: "repaired-description", comment: "修复原 description", type: "character_basic", content: `../source/${rel}`, enabled: true, constant: true, keys: [], secondary_keys: [], position: "after_char", order: 0, depth: 4, scanDepth: null, preventRecursion: true, excludeRecursion: true },
        ...worldbook.entries.filter((entry) => entry.id !== "repaired-description"),
      ];
    }
    next.description = "";
    actions.push({ code: "card.description.moved_to_worldbook", message: "已将非空 description 转为世界书条目", path: filePath });
  }
  return next;
}

async function repairWorldbook(_project: Project, worldbook: WorldbookDraft, actions: RepairAction[], _dryRun: boolean): Promise<WorldbookDraft> {
  const entries = (worldbook.entries ?? []).map((entry) => {
    const next = { ...entry };
    if (next.preventRecursion !== true || next.excludeRecursion !== true) {
      next.preventRecursion = true;
      next.excludeRecursion = true;
      actions.push({ code: "worldbook.double_recursion.fixed", message: `已补齐双递归: ${entry.id}` });
    }
    if (!next.constant && (!Array.isArray(next.keys) || next.keys.length === 0)) {
      next.keys = [next.comment];
      actions.push({ code: "worldbook.green_keys.fixed", message: `绿灯条目已用 comment 补 keys: ${entry.id}` });
    }
    return next;
  });
  return { ...worldbook, entries };
}

async function repairAssets(project: Project, assets: AssetsDraft, actions: RepairAction[], dryRun: boolean): Promise<AssetsDraft> {
  const next: AssetsDraft = structuredClone(assets);
  if (next.html?.statusbar?.html) {
    const htmlPath = resolveDraftReference(projectDir(project.slug), draftPath(project, "assets"), next.html.statusbar.html);
    const html = await readTextFile(htmlPath).catch(() => undefined);
    if (html !== undefined) {
      let repaired = html;
      const cdata = repaired.match(/<!\[CDATA\[([\s\S]*?)\]\]>/i);
      if (cdata) {
        repaired = cdata[1] ?? "";
        actions.push({ code: "html.cdata.unwrapped", message: "已去除状态栏 HTML 外层 CDATA", path: htmlPath });
      }
      const macroFixed = repaired.replace(/{{\s*stat_data\.([^}]+?)\s*}}/g, "{{format_message_variable::stat_data.$1}}");
      if (macroFixed !== repaired) {
        repaired = macroFixed;
        actions.push({ code: "html.naked_stat_data.fixed", message: "已修复裸 {{stat_data.xxx}} 宏", path: htmlPath });
      }
      if (repaired !== html && !dryRun) await writeTextFile(htmlPath, repaired);
    }
  }
  if (next.mvu?.initvar) {
    const initvarPath = resolveDraftReference(projectDir(project.slug), draftPath(project, "assets"), next.mvu.initvar);
    const initvar = await readTextFile(initvarPath).catch(() => undefined);
    if (initvar && /^\s*stat_data\s*:\s*\r?\n/.test(initvar)) {
      const repaired = unwrapStatDataRoot(initvar);
      if (repaired !== initvar) {
        actions.push({ code: "mvu.initvar.stat_data_root.fixed", message: "已去除 initvar 外层 stat_data 根键", path: initvarPath });
        if (!dryRun) await writeTextFile(initvarPath, repaired);
      }
    }
  }
  return next;
}

function unwrapStatDataRoot(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const first = lines.findIndex((line) => /^\s*stat_data\s*:\s*$/.test(line));
  if (first === -1) return text;
  const before = lines.slice(0, first).filter((line) => line.trim()).join("\n");
  if (before.trim()) return text;
  const body = lines.slice(first + 1);
  const nonEmpty = body.filter((line) => line.trim());
  if (nonEmpty.length === 0) return "";
  const indent = Math.min(...nonEmpty.map((line) => (line.match(/^\s*/) ?? [""])[0].length));
  return `${body.map((line) => line.startsWith(" ".repeat(indent)) ? line.slice(indent) : line).join("\n").trimEnd()}\n`;
}
