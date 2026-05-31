import fs from "node:fs/promises";
import path from "node:path";
import type { Project } from "../schemas/project.js";
import { RegexScriptDraftSchema, TavernHelperScriptDraftSchema, type RegexScriptDraft, type TavernHelperScriptDraft, type WorldbookEntryDraft } from "../schemas/draft.js";
import { draftPath, projectDir, readDraft, writeDraft } from "../storage/workspace.js";
import { resolveDraftReference, resolveSourceFilePath } from "../storage/path-policy.js";
import { parseYaml, readTextFile, stringifyYaml, writeTextFile } from "../utils/yaml.js";
import { applyMvuPreset } from "./mvu-variables.js";
import { DEFAULT_PART_ORDER } from "./configure-draft.js";

export interface EjsStageTemplateInput {
  controller_id?: string;
  variable: string;
  base_profile?: string;
  common_derivations?: string[];
  stages: Array<{ id: string; label: string; value: string; condition?: string; content?: string; exclusive_derivations?: string[]; rephrase_notes?: string[] }>;
  overwrite?: boolean;
}

export interface StatusbarTemplateInput {
  mode?: "safe_macro" | "dynamic_js";
  title?: string;
  variables: Array<{ label: string; path: string }>;
  theme?: "simple" | "dark" | "moon";
  overwrite?: boolean;
}

export interface FrontendBeautifyTemplateInput {
  id: string;
  label?: string;
  tag: string;
  mode?: "text" | "structured";
  html?: string;
  css?: string;
  overwrite?: boolean;
}

export interface UpsertRegexScriptInput extends RegexScriptDraft { overwrite?: boolean }

export interface UpsertTavernHelperScriptInput {
  id: string;
  name: string;
  content?: string;
  content_file?: string;
  enabled?: boolean;
  info?: string;
  allow_external?: boolean;
  buttons?: Array<{ name: string; visible?: boolean }>;
  data?: Record<string, unknown>;
  overwrite?: boolean;
}

export interface AdultEntryTemplateInput {
  id: string;
  character_name: string;
  type: "character_nsfw_palette" | "character_sexual_characteristics" | "character_xp_card";
  source_path?: string;
  title?: string;
  content?: string;
  keys?: string[];
  strategy?: "blue" | "green";
  consent_boundary?: string[];
  age_gate?: "adult_confirmed";
  overwrite?: boolean;
  register?: boolean;
}

const REGEX_SCRIPTS_REF = "../source/regex/scripts.yaml";
const TAVERN_HELPER_SCRIPTS_REF = "../source/tavern-helper/scripts.yaml";
const FORBIDDEN_FRONTEND_TAGS = new Set(["think", "thinking", "content", "updatevariable", "analysis", "jsonpatch"]);

export async function createEjsStageTemplate(project: Project, input: EjsStageTemplateInput): Promise<{ ok: boolean; project_id: string; files: string[]; controller_id: string }> {
  if ((await readDraft(project)).assets?.mvu.enabled !== true) await applyMvuPreset(project, { preset: "minimal", overwrite: false });
  const controllerId = input.controller_id ?? "stage-controller";
  const files: string[] = [];
  const controllerRel = `ejs/${safeSegment(controllerId)}.ejs`;
  const controllerPath = resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, controllerRel);
  const controllerContent = buildController(input.variable, input.stages);
  await writeTemplateFile(controllerPath, controllerContent, Boolean(input.overwrite));
  files.push(controllerPath);
  const stageEntries: Array<{ id: string; file: string; role: "stage"; enabled: boolean; position: "at_depth"; order: number; depth: number; conditionVariables: string[]; complexity: "entry_visibility" }> = [];
  for (const stage of input.stages) {
    const rel = `ejs/stage-${safeSegment(stage.id)}.ejs`;
    const filePath = resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, rel);
    const variablePath = input.variable.startsWith("stat_data.") ? input.variable : `stat_data.${input.variable}`;
    const content = stage.content ?? `<stage_profile id="${escapeXml(stage.id)}">\n${stringifyYaml({ phase: stage.value, label: stage.label, condition: stage.condition ?? `${variablePath} == ${stage.value}`, base_profile: input.base_profile ?? "", common_derivations: input.common_derivations ?? [], exclusive_derivations: stage.exclusive_derivations ?? [], rephrase_notes: stage.rephrase_notes ?? [] })}</stage_profile>\n`;
    await writeTemplateFile(filePath, content, Boolean(input.overwrite));
    files.push(filePath);
    stageEntries.push({ id: `stage-${stage.id}`, file: `../source/${rel}`, role: "stage", enabled: false, position: "at_depth", order: 16010 + stageEntries.length, depth: 0, conditionVariables: [input.variable.startsWith("stat_data.") ? input.variable : `stat_data.${input.variable}`], complexity: "entry_visibility" });
  }
  const draft = await readDraft(project);
  await writeDraft(project, "assets", {
    ...(draft.assets ?? {}),
    mvu: { ...(draft.assets?.mvu ?? {}), enabled: true },
    ejs: {
      ...(draft.assets?.ejs ?? {}),
      enabled: true,
      entries: [
        ...((draft.assets?.ejs.entries ?? []).filter((entry) => entry.id !== controllerId && !stageEntries.some((stage) => stage.id === entry.id))),
        { id: controllerId, file: `../source/${controllerRel}`, role: "controller", enabled: true, position: "at_depth", order: 16000, depth: 0, conditionVariables: [input.variable.startsWith("stat_data.") ? input.variable : `stat_data.${input.variable}`], complexity: "dynamic_text" },
        ...stageEntries,
      ],
    },
  });
  return { ok: true, project_id: project.id, files, controller_id: controllerId };
}

export async function createStatusbarTemplate(project: Project, input: StatusbarTemplateInput): Promise<{ ok: boolean; project_id: string; files: string[]; mode: "safe_macro" | "dynamic_js" }> {
  const mode = input.mode ?? "safe_macro";
  const theme = input.theme ?? "dark";
  const html = mode === "dynamic_js" ? buildDynamicStatusbarHtml(input.title ?? project.name, input.variables, theme) : buildSafeStatusbarHtml(input.title ?? project.name, input.variables);
  const css = buildStatusbarCss(theme);
  const files: string[] = [];
  const htmlPath = resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, "html/statusbar.html");
  const cssPath = resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, "html/statusbar.css");
  await writeTemplateFile(htmlPath, html, Boolean(input.overwrite));
  await writeTemplateFile(cssPath, css, Boolean(input.overwrite));
  files.push(htmlPath, cssPath);
  const draft = await readDraft(project);
  await writeDraft(project, "assets", {
    ...(draft.assets ?? {}),
    html: { ...(draft.assets?.html ?? {}), statusbar: { ...(draft.assets?.html.statusbar ?? {}), enabled: true, mode, html: "../source/html/statusbar.html", css: "../source/html/statusbar.css", variablePaths: input.variables.map((item) => normalizeMvuPath(item.path)) } },
  });
  if (draft.card) await ensureFirstMesPlaceholder(project, draft.card.first_mes);
  return { ok: true, project_id: project.id, files, mode };
}

export async function createFrontendBeautifyTemplate(project: Project, input: FrontendBeautifyTemplateInput): Promise<{ ok: boolean; project_id: string; files: string[]; regex_id: string; tag: string }> {
  assertFrontendTag(input.tag);
  const id = safeSegment(input.id);
  const files: string[] = [];
  const htmlRel = `html/${id}.html`;
  const htmlPath = resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, htmlRel);
  const cssRel = `html/${id}.css`;
  const cssPath = resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, cssRel);
  const css = input.css ?? buildFrontendCss(id);
  const html = input.html ?? buildFrontendHtml(id, input.tag, input.mode ?? "text", Boolean(input.css));
  await writeTemplateFile(htmlPath, html, Boolean(input.overwrite));
  files.push(htmlPath);
  if (css.trim()) {
    await writeTemplateFile(cssPath, css, Boolean(input.overwrite));
    files.push(cssPath);
  }
  const script = RegexScriptDraftSchema.parse({ id, name: input.label ?? `${input.tag} 前端美化`, findRegex: `/<${input.tag}>[\\s\\S]*?<\\/${input.tag}>/g`, replaceFile: `../html/${id}.html`, markdownOnly: true, promptOnly: false, placement: [2], runOnEdit: true });
  await upsertRegexScript(project, script, { overwrite: true });
  return { ok: true, project_id: project.id, files, regex_id: id, tag: input.tag };
}

export async function upsertRegexScript(project: Project, input: RegexScriptDraft, options: { overwrite?: boolean } = {}): Promise<{ ok: boolean; project_id: string; path: string; count: number; script_id: string }> {
  const script = RegexScriptDraftSchema.parse(input);
  const scriptsPath = resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, "regex/scripts.yaml");
  const scripts = await readRegexScripts(scriptsPath);
  const scriptId = script.id ?? safeSegment(script.name);
  const nextScript = { ...script, id: scriptId };
  const index = scripts.findIndex((item) => (item.id ?? safeSegment(item.name)) === scriptId || item.name === script.name);
  if (index >= 0 && !options.overwrite) throw new Error(`regex script 已存在: ${scriptId}`);
  const next = index >= 0 ? scripts.map((item, itemIndex) => itemIndex === index ? nextScript : item) : [...scripts, nextScript];
  await writeTextFile(scriptsPath, stringifyYaml(next));
  await enableRegexAssets(project);
  return { ok: true, project_id: project.id, path: scriptsPath, count: next.length, script_id: scriptId };
}

export async function upsertTavernHelperScript(project: Project, input: UpsertTavernHelperScriptInput): Promise<{ ok: boolean; project_id: string; scripts_path: string; script_path?: string; count: number; script_id: string }> {
  if (!input.content && !input.content_file) throw new Error("upsert_tavern_helper_script 需要 content 或 content_file");
  const scriptId = safeSegment(input.id);
  const scriptsPath = resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, "tavern-helper/scripts.yaml");
  let scriptPath: string | undefined;
  let contentFile = input.content_file;
  if (input.content !== undefined) {
    contentFile = `${scriptId}.js`;
    scriptPath = resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, `tavern-helper/${contentFile}`);
    await writeTemplateFile(scriptPath, input.content.endsWith("\n") ? input.content : `${input.content}\n`, Boolean(input.overwrite));
  } else if (contentFile) {
    scriptPath = resolveDraftReference(projectDir(project.slug), scriptsPath, contentFile);
  }
  const nextScript = TavernHelperScriptDraftSchema.parse({ id: scriptId, name: input.name, contentFile, enabled: input.enabled ?? false, info: input.info ?? "", allowExternal: input.allow_external ?? false, buttons: input.buttons ?? [], data: input.data ?? {} });
  const scripts = await readTavernHelperScripts(scriptsPath);
  const index = scripts.findIndex((item) => item.id === scriptId);
  if (index >= 0 && !input.overwrite) throw new Error(`Tavern Helper script 已存在: ${scriptId}`);
  const next = index >= 0 ? scripts.map((item, itemIndex) => itemIndex === index ? nextScript : item) : [...scripts, nextScript];
  await writeTextFile(scriptsPath, stringifyYaml(next));
  await enableTavernHelperAssets(project);
  return { ok: true, project_id: project.id, scripts_path: scriptsPath, script_path: scriptPath, count: next.length, script_id: scriptId };
}

export async function createAdultEntryTemplate(project: Project, input: AdultEntryTemplateInput): Promise<{ ok: boolean; project_id: string; source_path: string; entry?: WorldbookEntryDraft; next_actions: string[] }> {
  const id = safeSegment(input.id);
  const rel = input.source_path ? input.source_path.replace(/^source[\/]/, "") : `entries/${id}.xyaml`;
  if (!rel.startsWith("entries/")) throw new Error("条目 source_path 必须位于 source/entries/");
  const filePath = resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, rel);
  const content = input.content ?? buildAdultTemplate(input);
  await writeTemplateFile(filePath, content, Boolean(input.overwrite));
  const nextActions = ["validate_project 检查条目", "按需 update_entry_status 标记 drafted/reviewed/done"];
  if (input.register === false) return { ok: true, project_id: project.id, source_path: filePath, next_actions: nextActions };
  const draft = await readDraft(project);
  const worldbook = draft.worldbook ?? { name: project.name, entries: [] };
  if (worldbook.entries.some((entry) => entry.id === id) && !input.overwrite) throw new Error(`世界书条目 id 已存在: ${id}`);
  const isGreen = input.strategy === "green";
  const entry: WorldbookEntryDraft = {
    id,
    comment: input.title ?? input.character_name,
    type: input.type,
    content: `../source/${rel.replace(/\\/g, "/")}`,
    enabled: true,
    constant: !isGreen,
    keys: isGreen ? (input.keys?.length ? input.keys : [input.character_name]) : [],
    secondary_keys: [],
    position: "after_char",
    order: defaultAdultOrder(input.type),
    depth: 4,
    scanDepth: isGreen ? 2 : null,
    preventRecursion: true,
    excludeRecursion: true,
    part: `${safeSegment(input.character_name)}.adult`,
    scope: isGreen ? "specific" : "catalog",
    status: input.content ? "drafted" : "planned",
    abstract: `${input.character_name} 成人向结构${(input.consent_boundary ?? []).length ? `；边界：${(input.consent_boundary ?? []).join("、")}` : ""}`,
  };
  await writeDraft(project, "worldbook", { ...worldbook, entries: [...worldbook.entries.filter((item) => item.id !== id), entry] });
  return { ok: true, project_id: project.id, source_path: filePath, entry, next_actions: nextActions };
}

async function writeTemplateFile(filePath: string, content: string, overwrite: boolean): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  if (overwrite) await writeTextFile(filePath, content);
  else await fs.writeFile(filePath, content, { encoding: "utf8", flag: "wx" });
}

async function ensureFirstMesPlaceholder(project: Project, firstMesRef: string): Promise<void> {
  const firstMesPath = resolveDraftReference(projectDir(project.slug), draftPath(project, "card"), firstMesRef);
  const current = await readTextFile(firstMesPath).catch(() => "");
  if (!current.includes("<StatusPlaceHolderImpl/>")) await writeTextFile(firstMesPath, current.trim() ? `<StatusPlaceHolderImpl/>\n${current}` : "<StatusPlaceHolderImpl/>\n");
}

async function enableRegexAssets(project: Project): Promise<void> {
  const draft = await readDraft(project);
  await writeDraft(project, "assets", { ...(draft.assets ?? {}), regex: { scripts: REGEX_SCRIPTS_REF } });
}

async function enableTavernHelperAssets(project: Project): Promise<void> {
  const draft = await readDraft(project);
  await writeDraft(project, "assets", { ...(draft.assets ?? {}), tavernHelper: { scripts: TAVERN_HELPER_SCRIPTS_REF } });
}

async function readRegexScripts(filePath: string): Promise<RegexScriptDraft[]> {
  const parsed = parseYaml<unknown>(await readTextFile(filePath).catch(() => "[]")) ?? [];
  return RegexScriptDraftSchema.array().parse(Array.isArray(parsed) ? parsed : []);
}

async function readTavernHelperScripts(filePath: string): Promise<TavernHelperScriptDraft[]> {
  const parsed = parseYaml<unknown>(await readTextFile(filePath).catch(() => "[]")) ?? [];
  return TavernHelperScriptDraftSchema.array().parse(Array.isArray(parsed) ? parsed : []);
}

function buildController(variable: string, stages: EjsStageTemplateInput["stages"]): string {
  const safeVariable = variable.startsWith("stat_data.") ? variable : `stat_data.${variable}`;
  const lines = [
    "@@generate_before",
    "<%_",
    "if (typeof phase === 'undefined') {",
    `  var phase = getvar('${safeVariable}', { defaults: '' });`,
    "}",
    "_%>",
    "<%_",
    "if (typeof stageEntry === 'undefined') { var stageEntry = ''; }",
  ];
  for (const stage of stages) lines.push(`if (phase === ${JSON.stringify(stage.value)}) { stageEntry = ${JSON.stringify(`stage-${stage.id}`)}; }`);
  lines.push("if (stageEntry) {", "  await getwi(stageEntry);", "}", "_%>", "");
  return lines.join("\n");
}

function buildSafeStatusbarHtml(title: string, variables: StatusbarTemplateInput["variables"]): string {
  return `<div class="wb-statusbar wb-statusbar-safe">\n  <div class="wb-statusbar-title">${escapeHtml(title)}</div>\n  <div class="wb-statusbar-grid">\n${variables.map((item) => `    <div class="wb-statusbar-row"><span>${escapeHtml(item.label)}</span><strong>{{format_message_variable::${normalizeMvuPath(item.path)}}}</strong></div>`).join("\n")}\n  </div>\n</div>\n`;
}

function buildDynamicStatusbarHtml(title: string, variables: StatusbarTemplateInput["variables"], theme: string): string {
  return `<!doctype html>\n<html lang="zh-CN">\n<head>\n  <meta charset="utf-8">\n  <script type="module">\n    async function initWorldBookStatusbar() {\n      await waitGlobalInitialized('Mvu');\n      const fields = ${JSON.stringify(variables.map((item) => ({ label: item.label, path: normalizeMvuPath(item.path).replace(/^stat_data\./, "") })))};\n      function render() {\n        const allVariables = getAllVariables();\n        const statData = _.get(allVariables, 'stat_data', {});\n        const root = $('#wb-statusbar-values');\n        root.empty();\n        for (const field of fields) {\n          $('<div class="wb-statusbar-row"></div>').append($('<span></span>').text(field.label)).append($('<strong></strong>').text(_.get(statData, field.path, '未知'))).appendTo(root);\n        }\n      }\n      render();\n      if (typeof Mvu !== 'undefined' && Mvu.events) eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, render);\n    }\n    $(errorCatched(initWorldBookStatusbar));\n  </script>\n</head>\n<body>\n  <div class="wb-statusbar wb-statusbar-${escapeHtml(theme)}">\n    <div class="wb-statusbar-title">${escapeHtml(title)}</div>\n    <div id="wb-statusbar-values" class="wb-statusbar-grid"></div>\n  </div>\n</body>\n</html>\n`;
}

function buildStatusbarCss(theme: string): string {
  const dark = theme === "simple" ? { bg: "#ffffff", fg: "#1f2937", border: "rgba(31,41,55,.18)" } : theme === "moon" ? { bg: "linear-gradient(135deg,#111827,#312e81)", fg: "#eef2ff", border: "rgba(199,210,254,.28)" } : { bg: "rgba(15,23,42,.88)", fg: "#e2e8f0", border: "rgba(148,163,184,.28)" };
  return `.wb-statusbar {\n  width: 92%;\n  margin: 12px auto;\n  padding: 12px 14px;\n  border: 1px solid ${dark.border};\n  border-radius: 14px;\n  background: ${dark.bg};\n  color: ${dark.fg};\n  box-sizing: border-box;\n}\n.wb-statusbar-title {\n  font-weight: 700;\n  margin-bottom: 8px;\n}\n.wb-statusbar-grid {\n  display: grid;\n  gap: 6px;\n}\n.wb-statusbar-row {\n  display: flex;\n  justify-content: space-between;\n  gap: 12px;\n  align-items: center;\n}\n.wb-statusbar-row strong {\n  font-weight: 700;\n}\n`;
}

function buildFrontendHtml(id: string, tag: string, mode: "text" | "structured", hasCss: boolean): string {
  return `${hasCss ? `<link rel="stylesheet" href="./${id}.css">\n` : ""}<div class="wb-front-${id}" data-source-tag="${escapeHtml(tag)}">\n  ${mode === "structured" ? "<div class=\"wb-front-title\">结构化数据面板</div>" : "<div class=\"wb-front-title\">正文美化</div>"}\n  <div class="wb-front-body">$0</div>\n</div>\n`;
}

function buildFrontendCss(id: string): string {
  return `.wb-front-${id} {\n  width: 92%;\n  margin: 12px auto;\n  padding: 12px 14px;\n  border: 1px solid rgba(148, 163, 184, .28);\n  border-radius: 14px;\n  background: rgba(15, 23, 42, .76);\n  color: #e2e8f0;\n  box-sizing: border-box;\n}\n.wb-front-${id} .wb-front-title {\n  font-weight: 700;\n  margin-bottom: 8px;\n}\n.wb-front-${id} .wb-front-body {\n  white-space: pre-wrap;\n  line-height: 1.65;\n}\n`;
}

function buildAdultTemplate(input: AdultEntryTemplateInput): string {
  const boundaries = input.consent_boundary?.length ? input.consent_boundary : [];
  const boundsBlock = boundaries.length ? `边界:\n${boundaries.map((item) => `  - ${item}`).join("\n")}\n` : "";
  if (input.type === "character_nsfw_palette") {
    return `<character_nsfw_palette>\nNSFW调色盘: 亲密行为是角色性格在身体层面的延续\n底色:\n  名称: 待补充\n  含义: 待补充\n主色调:\n  - 名称: 待补充\n    衍生:\n      - 行为: 待补充\n        背后原因: 待补充\n        台词:\n          - "纯台词占位"\n点缀:\n  - 名称: 待补充\n    触发条件: 待补充\n    衍生:\n      - 行为: 待补充\n        背后原因: 待补充\n${boundsBlock}作者二次解释:\n  关于亲密边界: |\n    待补充。\n</character_nsfw_palette>\n`;
  }
  if (input.type === "character_sexual_characteristics") {
    return `<character_sexual_characteristics>\nNSFW生理特征:\n${boundaries.length ? `  基础边界:\n${boundaries.map((item) => `    - ${item}`).join("\n")}\n` : ""}  性经验: 待补充或未知\n  性取向: 待补充\n  性角色倾向: 待补充，可随关系阶段变化\n  敏感带:\n    - 待补充\n  偏好:\n    - 待补充\n  禁区:\n    - 待补充\n  生理事实:\n    外观: 待补充\n    反应: 待补充\n</character_sexual_characteristics>\n`;
  }
  return `<character_xp_card>\nXP方向:\n  核心XP: 待补充\n  角色类型: 待补充\n  核心场景: 待补充\n触发场景:\n  - 场景: 待补充\n    进入条件: 待补充\n${boundsBlock}角色行为核心:\n  - 待补充\n台词占位:\n  - "纯台词占位"\n</character_xp_card>\n`;
}

function defaultAdultOrder(type: AdultEntryTemplateInput["type"]): number {
  return (DEFAULT_PART_ORDER[type] ?? 520) * 10;
}

function assertFrontendTag(tag: string): void {
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(tag)) throw new Error("前端美化 tag 只能包含字母、数字、下划线和连字符，并且以字母开头");
  if (FORBIDDEN_FRONTEND_TAGS.has(tag.toLowerCase())) throw new Error(`禁止使用前端美化 tag: ${tag}`);
}

function normalizeMvuPath(value: string): string {
  if (value.startsWith("stat_data.")) return value;
  if (value.startsWith("/")) return `stat_data.${value.slice(1).replace(/\//g, ".")}`;
  return `stat_data.${value}`;
}

function safeSegment(value: string): string { return value.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "entry"; }
function escapeXml(value: string): string { return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function escapeHtml(value: string): string { return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
