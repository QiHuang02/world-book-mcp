import fs from "node:fs/promises";
import path from "node:path";
import { AssetsDraftSchema, RegexScriptDraftSchema, type AssetsDraft, type CardDraft, type RegexScriptDraft, type WorldbookDraft, type WorldbookEntryDraft } from "../schemas/draft.js";
import type { Project } from "../schemas/project.js";
import { draftPath, projectDir, projectPath, readDraft } from "../storage/workspace.js";
import { backupIfExists, resolveDraftReference, resolveExportFilePath } from "../storage/path-policy.js";
import { readTextFile, readYamlFile, writeTextFile, writeYamlFile } from "../utils/yaml.js";
import { positionToNumber } from "./position.js";
import { readMaybeReference, validateProject } from "./validation.js";

export interface GenerateOptions {
  target?: "worldbook" | "character_card" | "both";
  overwrite?: boolean;
  output_path?: string;
  output_paths?: { worldbook?: string; character_card?: string };
  force?: boolean;
}

export interface GenerateResult {
  ok: boolean;
  validation: Awaited<ReturnType<typeof validateProject>>;
  outputs: Array<{ target: "worldbook" | "character_card"; path: string; backup_path?: string }>;
  report_path: string;
}

export async function generateJson(project: Project, options: GenerateOptions = {}): Promise<GenerateResult> {
  const validation = await validateProject(project);
  if (!validation.ok && !options.force) throw new Error(`项目校验失败，拒绝生成 JSON：${validation.summary.errors} 个错误`);
  const target = options.target ?? project.kind.output;
  if (target === "both" && options.output_path) throw new Error("target=both 时请使用 output_paths.worldbook / output_paths.character_card");

  const draft = await readDraft(project);
  const outputs: GenerateResult["outputs"] = [];
  const exportsDir = projectPath(project, "exports");
  await fs.mkdir(exportsDir, { recursive: true });

  const builtAt = new Date().toISOString();
  if ((target === "worldbook" || target === "both") && draft.worldbook) {
    const worldbook = await buildWorldbookJson(project, draft.worldbook, draft.assets);
    const outputPath = resolveOutput(project, options.output_paths?.worldbook ?? (target === "worldbook" ? options.output_path : undefined), `${project.name}.worldbook.json`);
    const backup = options.overwrite ? await backupIfExists(outputPath) : undefined;
    await writeJsonFile(outputPath, worldbook, options.overwrite);
    outputs.push({ target: "worldbook", path: outputPath, backup_path: backup });
  }
  if ((target === "character_card" || target === "both") && draft.card) {
    const card = await buildCharacterCardJson(project, draft.card, draft.worldbook, draft.assets, builtAt);
    const outputPath = resolveOutput(project, options.output_paths?.character_card ?? (target === "character_card" ? options.output_path : undefined), `${project.name}.card.json`);
    const backup = options.overwrite ? await backupIfExists(outputPath) : undefined;
    await writeJsonFile(outputPath, card, options.overwrite);
    outputs.push({ target: "character_card", path: outputPath, backup_path: backup });
  }

  const reportPath = path.resolve(projectPath(project, "reports"), "build-report.yaml");
  await writeYamlFile(reportPath, { schemaVersion: 5, generatedAt: builtAt, project: { id: project.id, name: project.name, output: project.kind.output }, validation: validation.summary, outputs });
  return { ok: true, validation, outputs, report_path: reportPath };
}

export async function buildWorldbookJson(project: Project, worldbook: WorldbookDraft, assets?: AssetsDraft): Promise<unknown> {
  const allEntries = [...worldbook.entries, ...await generatedAssetEntries(project, assets)];
  const sorted = sortEntries(allEntries);
  const entries: Record<string, unknown> = {};
  for (const [index, entry] of sorted.entries()) entries[String(index)] = await buildWorldbookEntry(project, entry, index);
  return { name: worldbook.name, entries };
}

export async function buildCharacterCardJson(project: Project, card: CardDraft, worldbook: WorldbookDraft | undefined, assets: AssetsDraft | undefined, builtAt: string): Promise<unknown> {
  if (card.description !== "") throw new Error("description 只能为空字符串");
  const firstMes = await readMaybeReference(project, draftPath(project, "card"), card.first_mes) ?? "";
  const alternateGreetings = await Promise.all(card.alternate_greetings.map(async (item) => await readMaybeReference(project, draftPath(project, "card"), item) ?? ""));
  const field = async (value: string) => await readMaybeReference(project, draftPath(project, "card"), value) ?? value;
  const entries = worldbook && card.worldbook.include ? await buildCharacterBookEntries(project, worldbook, assets) : [];
  const regexScripts = await buildRegexScripts(project, assets);
  const tavernHelperScripts = await buildTavernHelperScripts(project, assets);
  const data = {
    name: card.name,
    description: "",
    personality: await field(card.personality),
    scenario: await field(card.scenario),
    first_mes: firstMes,
    mes_example: await field(card.mes_example),
    creator_notes: await field(card.creator_notes),
    system_prompt: await field(card.system_prompt),
    post_history_instructions: await field(card.post_history_instructions),
    tags: card.tags,
    creator: card.creator,
    character_version: card.character_version,
    alternate_greetings: alternateGreetings,
    group_only_greetings: [],
    extensions: {
      talkativeness: card.talkativeness,
      fav: card.fav,
      world: card.worldbook.name ?? card.name,
      depth_prompt: { prompt: "", depth: 4, role: "system" },
      regex_scripts: regexScripts,
      TavernHelper_scripts: tavernHelperScripts,
    },
    character_book: { name: card.worldbook.name ?? card.name, entries },
  };
  return {
    name: card.name,
    description: "",
    personality: data.personality,
    scenario: data.scenario,
    first_mes: firstMes,
    mes_example: data.mes_example,
    creatorcomment: "",
    avatar: "none",
    talkativeness: card.talkativeness,
    fav: card.fav,
    tags: card.tags,
    spec: "chara_card_v3",
    spec_version: "3.0",
    data,
    create_date: builtAt,
  };
}

async function buildCharacterBookEntries(project: Project, worldbook: WorldbookDraft, assets?: AssetsDraft): Promise<unknown[]> {
  const entries = [...worldbook.entries, ...await generatedAssetEntries(project, assets)];
  const sorted = sortEntries(entries);
  return Promise.all(sorted.map((entry, index) => buildCharacterBookEntry(project, entry, index)));
}

async function buildWorldbookEntry(project: Project, entry: WorldbookEntryDraft, uid: number): Promise<unknown> {
  const content = await readEntryContent(project, entry);
  return {
    uid,
    key: entry.keys,
    keysecondary: entry.secondary_keys,
    comment: entry.comment,
    content,
    constant: entry.constant,
    vectorized: false,
    selective: !entry.constant,
    selectiveLogic: 0,
    addMemo: true,
    order: entry.order,
    position: positionToNumber(entry.position),
    disable: !entry.enabled,
    ignoreBudget: false,
    excludeRecursion: true,
    preventRecursion: true,
    matchPersonaDescription: false,
    matchCharacterDescription: false,
    matchCharacterPersonality: false,
    matchCharacterDepthPrompt: false,
    matchScenario: false,
    matchCreatorNotes: false,
    delayUntilRecursion: false,
    probability: 100,
    useProbability: true,
    depth: entry.depth ?? (entry.position === "at_depth" ? 0 : 4),
    outletName: "",
    group: "",
    groupOverride: false,
    groupWeight: 100,
    scanDepth: entry.scanDepth ?? (!entry.constant ? 2 : null),
    caseSensitive: null,
    matchWholeWords: null,
    useGroupScoring: false,
    automationId: "",
    role: 0,
    sticky: 0,
    cooldown: 0,
    delay: 0,
    triggers: [],
    displayIndex: uid,
    extensions: {},
    characterFilter: { isExclude: false, names: [], tags: [] },
  };
}

async function buildCharacterBookEntry(project: Project, entry: WorldbookEntryDraft, index: number): Promise<unknown> {
  const base = await buildWorldbookEntry(project, entry, index) as Record<string, unknown>;
  return {
    keys: entry.keys,
    secondary_keys: entry.secondary_keys,
    constant: entry.constant,
    selective: !entry.constant,
    use_regex: true,
    id: index,
    comment: entry.comment,
    content: await readEntryContent(project, entry),
    enabled: entry.enabled,
    position: entry.position,
    insertion_order: entry.order,
    extensions: {
      exclude_recursion: true,
      probability: 100,
      useProbability: true,
      selectiveLogic: 0,
      group: "",
      group_override: false,
      group_weight: 100,
      prevent_recursion: true,
      delay_until_recursion: false,
      scan_depth: entry.scanDepth ?? (!entry.constant ? 2 : null),
      match_whole_words: null,
      use_group_scoring: false,
      case_sensitive: null,
      automation_id: "",
      vectorized: false,
      sticky: 0,
      cooldown: 0,
      delay: 0,
      match_persona_description: false,
      match_character_description: false,
      match_character_personality: false,
      match_scenario: false,
      match_creator_notes: false,
      triggers: [],
      ignore_budget: false,
      position: base.position,
      display_index: index,
      depth: entry.depth ?? 4,
      role: 0,
    },
  };
}

async function readEntryContent(project: Project, entry: WorldbookEntryDraft): Promise<string> {
  return readTextFile(resolveDraftReference(projectDir(project.slug), draftPath(project, "worldbook"), entry.content));
}

async function generatedAssetEntries(_project: Project, assets?: AssetsDraft): Promise<WorldbookEntryDraft[]> {
  return [...mvuEntries(assets), ...ejsEntries(assets)];
}

function mvuEntries(assets?: AssetsDraft): WorldbookEntryDraft[] {
  if (!assets?.mvu.enabled) return [];
  const baseOrder = 14720;
  const file = (ref: string | undefined, fallback: string) => ref ?? fallback;
  const entries: WorldbookEntryDraft[] = [];
  const add = (entry: Omit<WorldbookEntryDraft, "preventRecursion" | "excludeRecursion" | "keys" | "secondary_keys" | "enabled" | "constant" | "type" | "scanDepth"> & { enabled?: boolean; constant?: boolean; keys?: string[]; secondary_keys?: string[]; scanDepth?: number | null }) => entries.push({ type: "other", enabled: entry.enabled ?? true, constant: entry.constant ?? true, keys: entry.keys ?? [], secondary_keys: entry.secondary_keys ?? [], scanDepth: entry.scanDepth, preventRecursion: true, excludeRecursion: true, ...entry });
  add({ id: "mvu-initvar", comment: "[initvar]变量初始化", content: file(assets.mvu.initvar, "../source/mvu/initvar.yaml"), enabled: false, constant: false, position: "before_char", order: baseOrder, depth: 4 });
  add({ id: "mvu-variable-list", comment: "变量列表", content: file(assets.mvu.variableList, "../source/mvu/variable-list.md"), position: "at_depth", order: baseOrder + 1, depth: 0 });
  add({ id: "mvu-update-rules", comment: "[mvu_update]变量更新规则", content: file(assets.mvu.updateRules, "../source/mvu/update-rules.yaml"), position: "at_depth", order: baseOrder + 2, depth: 0 });
  add({ id: "mvu-output-format", comment: "[mvu_update]变量输出格式", content: file(assets.mvu.outputFormat, "../source/mvu/output-format.md"), position: "at_depth", order: baseOrder + 3, depth: 0 });
  return entries;
}

function ejsEntries(assets?: AssetsDraft): WorldbookEntryDraft[] {
  if (!assets?.ejs.enabled) return [];
  const entries: WorldbookEntryDraft[] = [];
  if (assets.ejs.preprocess) {
    entries.push({ id: "ejs-preprocess", comment: "[EJS]预处理", type: "other", content: assets.ejs.preprocess.file, enabled: true, constant: true, keys: [], secondary_keys: [], position: assets.ejs.preprocess.position, order: assets.ejs.preprocess.order, depth: assets.ejs.preprocess.depth, scanDepth: null, preventRecursion: true, excludeRecursion: true });
  }
  entries.push(...assets.ejs.entries.filter((entry) => entry.enabled).map((entry) => ({
    id: `ejs-${entry.id}`,
    comment: `[EJS]${entry.role}:${entry.id}${entry.complexity ? `:${entry.complexity}` : ""}`,
    type: "other" as const,
    content: entry.file,
    enabled: true,
    constant: true,
    keys: [],
    secondary_keys: [],
    position: entry.position,
    order: entry.order,
    depth: entry.depth,
    scanDepth: null,
    preventRecursion: true as const,
    excludeRecursion: true as const,
  })));
  return entries;
}

function sortEntries(entries: WorldbookEntryDraft[]): WorldbookEntryDraft[] {
  return [...entries].sort((a, b) => positionToNumber(a.position) - positionToNumber(b.position) || a.order - b.order || a.comment.localeCompare(b.comment, "zh-Hans-CN"));
}

async function buildRegexScripts(project: Project, assets?: AssetsDraft): Promise<unknown[]> {
  const scripts: RegexScriptDraft[] = [];
  if (assets?.mvu.enabled && assets.mvu.hideRegex) {
    scripts.push({ name: "[不发送]去除变量更新", findRegex: "/<(UpdateVariable|Analysis|JSONPatch)>[\\s\\S]*?<\\/\\1>/gm", replaceString: "", markdownOnly: true, promptOnly: true, placement: [2], minDepth: 4, maxDepth: null, runOnEdit: true, substituteRegex: 0, disabled: false });
  }
  if (assets?.html.statusbar.enabled) {
    scripts.push({ name: "[不发送]界面占位符", findRegex: "<StatusPlaceHolderImpl/>", replaceString: "", markdownOnly: false, promptOnly: true, placement: [2], minDepth: null, maxDepth: null, runOnEdit: true, substituteRegex: 0, disabled: false });
    if (assets.html.statusbar.html) {
      const html = await readTextFile(resolveDraftReference(projectDir(project.slug), draftPath(project, "assets"), assets.html.statusbar.html));
      const css = assets.html.statusbar.css ? await readTextFile(resolveDraftReference(projectDir(project.slug), draftPath(project, "assets"), assets.html.statusbar.css)) : "";
      scripts.push({ name: "[界面]状态栏", findRegex: "<StatusPlaceHolderImpl/>", replaceString: css ? `<style>\n${css}\n</style>\n${html}` : html, markdownOnly: true, promptOnly: false, placement: [2], minDepth: null, maxDepth: 2, runOnEdit: true, substituteRegex: 0, disabled: false });
    }
  }
  if (assets?.regex.scripts) {
    const ref = resolveDraftReference(projectDir(project.slug), draftPath(project, "assets"), assets.regex.scripts);
    const loaded = await readYamlFile(ref, RegexScriptDraftSchema.array());
    scripts.push(...loaded);
  }
  const mapped = [];
  for (const [index, script] of scripts.entries()) {
    const replaceString = script.replaceFile ? await readTextFile(resolveDraftReference(projectDir(project.slug), assets?.regex.scripts ? resolveDraftReference(projectDir(project.slug), draftPath(project, "assets"), assets.regex.scripts) : draftPath(project, "assets"), script.replaceFile)) : script.replaceString;
    mapped.push({ id: script.id ?? `regex-${index}`, scriptName: script.name, disabled: script.disabled, runOnEdit: script.runOnEdit, findRegex: script.findRegex, replaceString, trimStrings: [], placement: script.placement, substituteRegex: script.substituteRegex, minDepth: script.minDepth, maxDepth: script.maxDepth, markdownOnly: script.markdownOnly, promptOnly: script.promptOnly });
  }
  return mapped;
}

async function buildTavernHelperScripts(project: Project, assets?: AssetsDraft): Promise<unknown[]> {
  if (!assets?.mvu.enabled) return [];
  const scripts: unknown[] = [{ type: "script", value: { id: "mvu-runtime", name: "MVU Zod 脚本", content: "import 'https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js'", info: "", buttons: [{ name: "重新处理变量", visible: false }, { name: "重新读取初始变量", visible: false }, { name: "清除旧楼层变量", visible: false }], data: { "是否显示变量更新错误": "是", "构建信息": new Date().toISOString() }, enabled: true } }];
  if (assets.mvu.schema) {
    const content = await readTextFile(resolveDraftReference(projectDir(project.slug), draftPath(project, "assets"), assets.mvu.schema));
    scripts.push({ type: "script", value: { id: "mvu-schema", name: "变量结构设计", content, info: "", buttons: [], data: {}, enabled: true } });
  }
  return scripts;
}

function resolveOutput(project: Project, requested: string | undefined, fallback: string): string {
  return resolveExportFilePath(projectDir(project.slug), project.paths.exports, requested, fallback);
}

async function writeJsonFile(filePath: string, value: unknown, overwrite = false): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: overwrite ? "w" : "wx" });
}
