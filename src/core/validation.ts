import fs from "node:fs/promises";
import path from "node:path";
import { WorkspaceSchema, type Project } from "../schemas/project.js";
import { RegexScriptDraftSchema, type AssetsDraft, type CardDraft, type WorldbookDraft } from "../schemas/draft.js";
import { WORKSPACE_PATH, draftPath, projectDir, projectPath, readDraft, readPlan } from "../storage/workspace.js";
import { resolveDraftReference } from "../storage/path-policy.js";
import { parseYaml, readTextFile, readYamlFile, writeTextFile } from "../utils/yaml.js";

export type IssueSeverity = "error" | "warning" | "info";
export interface ValidationIssue { severity: IssueSeverity; code: string; message: string; field?: string }
export interface ValidationReport {
  ok: boolean;
  project_id: string;
  generated_at: string;
  summary: { errors: number; warnings: number; infos: number };
  issues: ValidationIssue[];
  sections: Record<string, { ok: boolean; issues: ValidationIssue[] }>;
}

export async function validateProject(project: Project): Promise<ValidationReport> {
  const sections: ValidationReport["sections"] = {};
  const addSection = (name: string, issues: ValidationIssue[]) => { sections[name] = { ok: !issues.some((issue) => issue.severity === "error"), issues }; };

  addSection("workspace", await validateWorkspace(project));
  addSection("project", await validateProjectFiles(project));
  addSection("plan", await validatePlan(project));

  const draft = await readDraft(project).catch((error) => ({ error }));
  if ("error" in draft) {
    addSection("draft", [issue("error", "draft.read_failed", `读取 draft 失败: ${draft.error instanceof Error ? draft.error.message : String(draft.error)}`)]);
  } else {
    addSection("card", await validateCard(project, draft.card, draft.assets));
    addSection("worldbook", await validateWorldbook(project, draft.worldbook));
    addSection("plan_entries", await validatePlanEntries(project, draft.worldbook));
    addSection("assets", await validateAssets(project, draft.assets, draft.card));
  }

  const issues = Object.values(sections).flatMap((section) => section.issues);
  const summary = {
    errors: issues.filter((item) => item.severity === "error").length,
    warnings: issues.filter((item) => item.severity === "warning").length,
    infos: issues.filter((item) => item.severity === "info").length,
  };
  return { ok: summary.errors === 0, project_id: project.id, generated_at: new Date().toISOString(), summary, issues, sections };
}

async function validateWorkspace(project: Project): Promise<ValidationIssue[]> {
  try {
    const workspace = await readYamlFile(WORKSPACE_PATH, WorkspaceSchema);
    const issues: ValidationIssue[] = [];
    const entry = workspace.projects.find((item) => item.id === project.id || item.slug === project.slug);
    if (!entry) {
      issues.push(issue("error", "workspace.project_missing", `workspace.yaml 未登记当前项目: ${project.slug}`, "workspace.projects"));
      return issues;
    }
    if (entry.id !== project.id) issues.push(issue("error", "workspace.project_id_mismatch", `workspace project id 不一致: ${entry.id} != ${project.id}`, "workspace.projects"));
    if (entry.output !== project.kind.output) issues.push(issue("error", "workspace.output_mismatch", `workspace output 不一致: ${entry.output} != ${project.kind.output}`, "workspace.projects"));
    if (entry.source !== project.kind.source) issues.push(issue("error", "workspace.source_mismatch", `workspace source 不一致: ${entry.source} != ${project.kind.source}`, "workspace.projects"));
    if (!entry.projectPath.replace(/\\/g, "/").endsWith(`projects/${project.slug}`)) issues.push(issue("warning", "workspace.project_path_mismatch", `workspace projectPath 可能不匹配: ${entry.projectPath}`, "workspace.projects"));
    if (workspace.activeProject && !workspace.projects.some((item) => item.slug === workspace.activeProject)) issues.push(issue("warning", "workspace.active_project_missing", `activeProject 不存在: ${workspace.activeProject}`, "workspace.activeProject"));
    return issues;
  } catch (error) {
    return [issue("error", "workspace.read_failed", `读取 workspace.yaml 失败: ${messageOf(error)}`, "workspace")];
  }
}

async function validateProjectFiles(project: Project): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  for (const [label, filePath] of [["project", path.resolve(projectDir(project.slug), "project.yaml")], ["plan", projectPath(project, "plan")], ["card", draftPath(project, "card")], ["worldbook", draftPath(project, "worldbook")], ["assets", draftPath(project, "assets")]] as const) {
    if (!await exists(filePath)) issues.push(issue("error", `${label}.missing`, `缺少 ${label} 文件: ${filePath}`));
  }
  return issues;
}

async function validatePlan(project: Project): Promise<ValidationIssue[]> {
  try {
    const plan = await readPlan(project);
    const issues: ValidationIssue[] = [];
    if (!plan.includes("## 10. 验收标准")) issues.push(issue("warning", "plan.acceptance.missing", "plan.md 建议包含验收标准 section"));
    if (!plan.includes("## 11. 验证记录")) issues.push(issue("warning", "plan.verification.missing", "plan.md 建议包含验证记录 section"));
    return issues;
  } catch (error) {
    return [issue("error", "plan.read_failed", `读取 plan.md 失败: ${messageOf(error)}`)];
  }
}

async function validatePlanEntries(project: Project, worldbook: WorldbookDraft | undefined): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  if (!worldbook) return issues;
  const plan = await readPlan(project).catch(() => "");
  const block = [...plan.matchAll(/```ya?ml\s*\n([\s\S]*?)```/g)].map((match) => match[1]).find((content) => /^\s*entries\s*:/m.test(content));
  if (!block) return issues;
  let parsed: { entries?: Array<{ id?: string; source?: string; status?: string }> } | undefined;
  try {
    parsed = parseYaml<{ entries?: Array<{ id?: string; source?: string; status?: string }> }>(block);
  } catch (error) {
    return [issue("error", "plan.entries.invalid_yaml", `plan.md entries YAML 解析失败: ${messageOf(error)}`, "plan.entries")];
  }
  const planEntries = Array.isArray(parsed?.entries) ? parsed.entries : [];
  const draftById = new Map(worldbook.entries.map((entry) => [entry.id, entry]));
  const planIds = new Set(planEntries.map((entry) => entry.id).filter(Boolean) as string[]);
  for (const entry of planEntries) {
    if (!entry.id) continue;
    const draftEntry = draftById.get(entry.id);
    if (!draftEntry) {
      issues.push(issue("warning", "plan.entry.missing_in_draft", `plan.md 中的 entry 未注册到 draft/worldbook: ${entry.id}`, "plan.entries"));
      continue;
    }
    if (entry.source && normalizeSource(entry.source) !== normalizeSource(draftEntry.content)) issues.push(issue("warning", "plan.entry.source_mismatch", `plan.md 与 draft 的 source 不一致: ${entry.id}`, "plan.entries"));
    if (entry.status && draftEntry.status && entry.status !== draftEntry.status) issues.push(issue("info", "plan.entry.status_mismatch", `plan.md 与 draft 的 status 不一致: ${entry.id}`, "plan.entries"));
  }
  for (const entry of worldbook.entries) if (!planIds.has(entry.id)) issues.push(issue("info", "plan.entry.extra_in_draft", `draft/worldbook 中的 entry 未列入 plan.md entries: ${entry.id}`, "worldbook.entries"));
  return issues;
}

async function validateCard(project: Project, card: CardDraft | undefined, assets: AssetsDraft | undefined): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  if (project.kind.output === "worldbook") return issues;
  if (!card) return [issue("error", "card.missing", "输出包含 character_card，但缺少 draft/card.yaml")];
  if (card.description !== "") issues.push(issue("error", "card.description.non_empty", "description 只能为空字符串", "description"));

  const cardDraftPath = draftPath(project, "card");
  await assertSourceReference(project, cardDraftPath, card.first_mes, "card.first_mes", true, issues);
  for (const field of ["personality", "scenario", "mes_example", "creator_notes", "system_prompt", "post_history_instructions"] as const) {
    await assertOptionalCardFieldReference(project, cardDraftPath, card[field], `card.${field}`, issues);
  }
  for (const [index, greeting] of card.alternate_greetings.entries()) {
    await assertSourceReference(project, cardDraftPath, greeting, `card.alternate_greetings.${index}`, true, issues);
  }

  const firstMes = await readMaybeReference(project, cardDraftPath, card.first_mes);
  const statusbarEnabled = Boolean(assets?.html.statusbar.enabled || assets?.mvu.enabled);
  if (statusbarEnabled && firstMes !== undefined && !firstMes.includes("<StatusPlaceHolderImpl/>")) {
    issues.push(issue("error", "card.first_mes.status_placeholder_missing", "启用 MVU/HTML 状态栏时 first_mes 必须包含 <StatusPlaceHolderImpl/>", "first_mes"));
  }
  return issues;
}

async function validateWorldbook(project: Project, worldbook: WorldbookDraft | undefined): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  if (!worldbook) return [issue("error", "worldbook.missing", "缺少 draft/worldbook.yaml")];
  const seen = new Set<string>();
  for (const [index, entry] of worldbook.entries.entries()) {
    const field = `worldbook.entries.${index}`;
    if (seen.has(entry.id)) issues.push(issue("error", "worldbook.entry.duplicate_id", `重复 entry id: ${entry.id}`, field));
    seen.add(entry.id);
    await assertSourceFileReference(project, draftPath(project, "worldbook"), entry.content, `${field}.content`, "entries", issues);
    if (!entry.constant && entry.keys.length === 0) issues.push(issue("error", "worldbook.entry.green_missing_keys", `绿灯条目 ${entry.id} 必须有 keys`, `${field}.keys`));
    if (entry.preventRecursion !== true || entry.excludeRecursion !== true) issues.push(issue("error", "worldbook.entry.double_recursion", `条目 ${entry.id} 必须开启 preventRecursion/excludeRecursion`, field));
    if (entry.position === "at_depth" && entry.depth === null) issues.push(issue("warning", "worldbook.entry.depth_missing", `at_depth 条目 ${entry.id} 建议设置 depth`, `${field}.depth`));
    if (!entry.abstract) issues.push(issue("info", "worldbook.entry.abstract_missing", `条目 ${entry.id} 建议填写 abstract，便于断点续写`, `${field}.abstract`));
    if ((project.kind.source === "derivative" || project.kind.source === "composite") && (!entry.sourceRefs || entry.sourceRefs.length === 0)) issues.push(issue("warning", "worldbook.entry.source_refs_missing", `二创/复合项目条目 ${entry.id} 建议记录 sourceRefs`, `${field}.sourceRefs`));
    for (const [sourceIndex, sourceRef] of (entry.sourceRefs ?? []).entries()) await assertSourceFileReference(project, draftPath(project, "worldbook"), `../source/${sourceRef.replace(/^source[\\/]/, "")}`, `${field}.sourceRefs.${sourceIndex}`, sourceRef.includes("extraction") ? "extraction" : "references", issues);
  }
  if ((project.kind.output === "worldbook" || project.kind.output === "both") && worldbook.entries.length === 0) issues.push(issue("error", "worldbook.entries.empty", "世界书输出不能为空"));
  return issues;
}

async function validateAssets(project: Project, assets: AssetsDraft | undefined, card: CardDraft | undefined): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  if (!assets) return [issue("error", "assets.missing", "缺少 draft/assets.yaml")];
  const assetsFile = draftPath(project, "assets");
  if (assets.ejs.enabled && !assets.mvu.enabled) issues.push(issue("error", "assets.ejs_requires_mvu", "EJS 依赖 MVU"));
  if (assets.mvu.enabled) {
    for (const [field, ref] of Object.entries({ schema: assets.mvu.schema, initvar: assets.mvu.initvar, updateRules: assets.mvu.updateRules, variableList: assets.mvu.variableList, outputFormat: assets.mvu.outputFormat })) {
      if (!ref) issues.push(issue("error", `mvu.${field}.missing`, `启用 MVU 时必须配置 ${field}`));
      else await assertSourceFileReference(project, assetsFile, ref, `mvu.${field}`, "mvu", issues);
    }
    if (assets.mvu.initvar) {
      const initvar = await readMaybeReference(project, assetsFile, assets.mvu.initvar);
      if (initvar && /^\s*stat_data\s*:/m.test(initvar)) issues.push(issue("warning", "mvu.initvar.stat_data_root", "initvar 可能多包了一层 stat_data 根键，请确认 schema 是否需要"));
    }
  }
  if (assets.html.statusbar.enabled) {
    if (!assets.html.statusbar.html) issues.push(issue("error", "html.statusbar.html_missing", "启用状态栏时必须配置 html 文件"));
    else {
      await assertSourceFileReference(project, assetsFile, assets.html.statusbar.html, "html.statusbar.html", "html", issues);
      const html = await readMaybeReference(project, assetsFile, assets.html.statusbar.html);
      if (html) {
        const mode = assets.html.statusbar.mode ?? "safe_macro";
        if (mode === "safe_macro" && /<script\b/i.test(html)) issues.push(issue("error", "html.script_forbidden", "状态栏 HTML 禁止内嵌 <script>"));
        if (/https?:\/\//i.test(html)) issues.push(issue("error", "html.external_url", "状态栏 HTML 禁止引用外部 URL"));
        if (mode === "safe_macro" && /{{\s*stat_data\./.test(html)) issues.push(issue("error", "html.naked_stat_data_macro", "状态栏展示 MVU 变量必须使用 format_message_variable 宏"));
        if (mode === "dynamic_js") {
          if (/<script\b/i.test(html) && !/errorCatched|try\s*\{/.test(html)) issues.push(issue("warning", "html.dynamic_js.error_guard_missing", "dynamic_js 状态栏建议使用 errorCatched 或 try/catch 包裹脚本"));
          if (/stat_data|Mvu|getAllVariables/.test(html) && !/getAllVariables|Mvu/.test(html)) issues.push(issue("warning", "html.dynamic_js.mvu_access_unclear", "dynamic_js 使用 MVU 数据时建议显式使用 getAllVariables 或 Mvu API"));
          if (/document\.body|\*\s*\{|\.mes_text/.test(html)) issues.push(issue("warning", "html.dynamic_js.global_pollution", "dynamic_js 状态栏可能污染全局 DOM/CSS，请确认作用域隔离"));
        }
      }
    }
  }
  if (assets.html.statusbar.css) await assertSourceFileReference(project, assetsFile, assets.html.statusbar.css, "html.statusbar.css", "html", issues);
  if (assets.regex.scripts) {
    await assertSourceFileReference(project, assetsFile, assets.regex.scripts, "regex.scripts", "regex", issues);
    await validateRegexScripts(project, assetsFile, assets.regex.scripts, issues);
  }
  let preprocessContent = "";
  if (assets.ejs.preprocess) {
    await assertSourceFileReference(project, assetsFile, assets.ejs.preprocess.file, "ejs.preprocess.file", "ejs", issues);
    preprocessContent = await readMaybeReference(project, assetsFile, assets.ejs.preprocess.file) ?? "";
    await lintEjsFile(project, assetsFile, assets.ejs.preprocess.file, "ejs.preprocess", [], issues);
  }
  for (const [index, entry] of assets.ejs.entries.entries()) {
    await assertSourceFileReference(project, assetsFile, entry.file, `ejs.entries.${index}.file`, "ejs", issues);
    if (entry.role === "stage" && entry.enabled) issues.push(issue("warning", "ejs.stage.enabled", `阶段条目 ${entry.id} 通常应禁用，由 controller 动态加载`, `ejs.entries.${index}.enabled`));
    await lintEjsFile(project, assetsFile, entry.file, `ejs.entries.${index}`, entry.conditionVariables, issues);
    validateEjsPreprocessCoverage(preprocessContent, entry.conditionVariables, `ejs.entries.${index}`, issues);
  }
  if (project.kind.output !== "worldbook" && !card) issues.push(issue("error", "assets.card_missing", "角色卡输出缺少 card draft"));
  return issues;
}

async function validateRegexScripts(project: Project, assetsFile: string, scriptsRef: string, issues: ValidationIssue[]): Promise<void> {
  try {
    const scriptsPath = resolveDraftReference(projectDir(project.slug), assetsFile, scriptsRef);
    const text = await readTextFile(scriptsPath);
    const rawScripts = (await import("../utils/yaml.js")).parseYaml<unknown>(text) ?? [];
    const parsedScripts = RegexScriptDraftSchema.array().safeParse(rawScripts);
    if (!parsedScripts.success) {
      issues.push(issue("error", "regex.scripts.schema_invalid", `regex scripts schema 无效: ${parsedScripts.error.issues.map((item) => item.message).join("; ")}`, "regex.scripts"));
      return;
    }
    const scripts = rawScripts as Array<Record<string, unknown>>;
    for (const [index, script] of scripts.entries()) {
      const replaceFile = typeof script.replaceFile === "string" ? script.replaceFile : undefined;
      if (!replaceFile) continue;
      const resolved = resolveDraftReference(projectDir(project.slug), scriptsPath, replaceFile);
      const sourceRoot = path.resolve(projectDir(project.slug), project.paths.sourceRoot);
      const allowed = ["html", "regex", "fields"].some((dir) => {
        const relative = path.relative(path.resolve(sourceRoot, dir), resolved);
        return !relative.startsWith("..") && !path.isAbsolute(relative);
      });
      if (!allowed) issues.push(issue("error", "regex.replace_file.wrong_directory", `regex scripts.${index}.replaceFile 必须指向 source/html、source/regex 或 source/fields`, `regex.scripts.${index}.replaceFile`));
      else if (!await exists(resolved)) issues.push(issue("error", "regex.replace_file.missing", `replaceFile 不存在: ${replaceFile}`, `regex.scripts.${index}.replaceFile`));
      if (replaceFile && typeof script.replaceString === "string" && script.replaceString.trim()) issues.push(issue("warning", "regex.replace_file_overrides_string", `regex scripts.${index} 同时包含 replaceFile 和 replaceString，生成时 replaceFile 优先`, `regex.scripts.${index}.replaceFile`));
    }
  } catch (error) {
    issues.push(issue("error", "regex.scripts.read_failed", `读取 regex scripts 失败: ${messageOf(error)}`, "regex.scripts"));
  }
}

async function lintEjsFile(project: Project, assetsFile: string, reference: string, field: string, conditionVariables: string[], issues: ValidationIssue[]): Promise<void> {
  const content = await readMaybeReference(project, assetsFile, reference);
  if (!content) return;
  validateEjsTags(content, field, issues);
  validateEjsDecorators(content, field, issues);
  if (/\bgetwi\s*\(/.test(content) && !/await\s+getwi\s*\(/.test(content)) issues.push(issue("warning", "ejs.getwi_without_await", `${field} 使用 getwi() 时建议 await getwi()`, field));
  if (/\bactivewi\s*\(/.test(content) && !/await\s+activewi\s*\(/.test(content)) issues.push(issue("warning", "ejs.activewi_without_await", `${field} 使用 activewi() 时建议 await activewi()`, field));
  if (/\b(?:let|const)\s+/.test(content)) issues.push(issue("warning", "ejs.let_const", `${field} 建议使用 var 与 typeof 防重复声明`, field));
  const firstMeaningfulLine = content.split(/\r?\n/).find((line) => line.trim());
  if (/^\s*@@/m.test(content) && firstMeaningfulLine && !firstMeaningfulLine.trimStart().startsWith("@@")) issues.push(issue("warning", "ejs.decorator_not_at_start", `${field} 的 @@ 装饰器应位于文件首个非空行`, field));
  for (const match of content.matchAll(/\bgetvar\s*\(\s*(['"])(.*?)\1/g)) {
    const variablePath = match[2];
    if (looksLikeMvuPath(variablePath) && !variablePath.startsWith("stat_data.")) issues.push(issue("warning", "ejs.getvar_missing_stat_data", `${field} 读取 MVU 变量 ${variablePath} 时建议使用 stat_data.${variablePath}`, field));
  }
  const variables = Array.from(content.matchAll(/stat_data\.([\p{L}\p{N}_.$-]+)/gu)).map((match) => `stat_data.${match[1]}`);
  for (const variable of variables) {
    if (!conditionVariables.includes(variable)) issues.push(issue("warning", "ejs.condition_variable_missing", `${field} 使用 ${variable}，建议登记到 conditionVariables`, field));
  }
}

function validateEjsTags(content: string, field: string, issues: ValidationIssue[]): void {
  const openCount = (content.match(/<%[-_=#]?/g) ?? []).length;
  const closeCount = (content.match(/[-_]?%>/g) ?? []).length;
  if (openCount !== closeCount) issues.push(issue("warning", "ejs.tag_unbalanced", `${field} 的 EJS 标签数量不配对: <% ${openCount} / %> ${closeCount}`, field));
}

function validateEjsDecorators(content: string, field: string, issues: ValidationIssue[]): void {
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line.startsWith("@@if")) continue;
    const nextLine = lines[index + 1]?.trim() ?? "";
    if (!line.replace(/^@@if\s*/, "").trim()) issues.push(issue("warning", "ejs.if_condition_empty", `${field} 的 @@if 缺少同一行条件`, field));
    if (nextLine && !nextLine.startsWith("@@") && !nextLine.startsWith("<%") && /(?:&&|\|\||[=!<>]=?|\(|\))/.test(nextLine)) issues.push(issue("warning", "ejs.if_multiline", `${field} 的 @@if 条件应保持单行`, field));
  }
}

function validateEjsPreprocessCoverage(preprocessContent: string, conditionVariables: string[], field: string, issues: ValidationIssue[]): void {
  if (!conditionVariables.length) return;
  if (!preprocessContent.trim()) {
    issues.push(issue("warning", "ejs.preprocess_missing", `${field} 声明了 conditionVariables，但未配置 EJS 预处理条目`, field));
    return;
  }
  const definedVariables = collectEjsDefinedVariables(preprocessContent);
  for (const variable of conditionVariables) {
    if (!preprocessContent.includes(variable) && !definedVariables.has(variable) && !definedVariables.has(lastPathSegment(variable))) issues.push(issue("warning", "ejs.preprocess_variable_missing", `${field} 的条件变量 ${variable} 未在 EJS 预处理中注册`, field));
  }
}

function collectEjsDefinedVariables(content: string): Set<string> {
  const result = new Set<string>();
  for (const match of content.matchAll(/\bdefine\s*\(\s*(['"])(.*?)\1/g)) result.add(match[2]);
  return result;
}

function lastPathSegment(value: string): string {
  return value.split(".").at(-1) ?? value;
}

function looksLikeMvuPath(value: string): boolean {
  return Boolean(value && !value.startsWith("stat_data.") && !["global", "local", "message", "cache", "initial"].includes(value));
}

async function assertSourceFileReference(project: Project, draftFile: string, reference: string, field: string, expectedDir: string, issues: ValidationIssue[]): Promise<void> {
  if (!looksLikePath(reference)) {
    issues.push(issue("error", "source_reference.literal", `${field} 必须引用 source/${expectedDir}/ 下文件`, field));
    return;
  }
  const resolved = resolveDraftReference(projectDir(project.slug), draftFile, reference);
  const sourceRoot = path.resolve(projectDir(project.slug), project.paths.sourceRoot);
  const expectedRoot = path.resolve(sourceRoot, expectedDir);
  const relativeToSource = path.relative(sourceRoot, resolved);
  if (relativeToSource.startsWith("..") || path.isAbsolute(relativeToSource)) {
    issues.push(issue("error", "source_reference.outside_source", `${field} 必须引用 source/ 内文件: ${reference}`, field));
    return;
  }
  const relativeToExpected = path.relative(expectedRoot, resolved);
  if (relativeToExpected.startsWith("..") || path.isAbsolute(relativeToExpected)) {
    issues.push(issue("error", "source_reference.wrong_directory", `${field} 必须引用 source/${expectedDir}/ 下文件: ${reference}`, field));
    return;
  }
  if (!await exists(resolved)) issues.push(issue("error", "path.missing", `引用文件不存在: ${reference}`, field));
}

async function assertSourceReference(project: Project, draftFile: string, reference: string, field: string, required: boolean, issues: ValidationIssue[]): Promise<void> {
  if (!reference) {
    if (required) issues.push(issue("error", "source_reference.missing", `${field} 必须引用 source 文件`, field));
    return;
  }
  await assertSourceFileReference(project, draftFile, reference, field, "fields", issues);
}

async function assertOptionalCardFieldReference(project: Project, draftFile: string, value: string, field: string, issues: ValidationIssue[]): Promise<void> {
  if (!value) return;
  if (looksLikePath(value)) {
    await assertSourceFileReference(project, draftFile, value, field, "fields", issues);
  } else {
    issues.push(issue("warning", "card.field.inline_content", `${field} 是内联内容；v5 建议长内容进入 source 或世界书条目`, field));
  }
  if (field === "card.personality" || field === "card.scenario" || field === "card.creator_notes") {
    issues.push(issue("warning", "card.field.should_be_worldbook", `${field} 属于人设/背景类内容，建议迁移到世界书条目`, field));
  }
}

export async function readMaybeReference(project: Project, draftFile: string, value: string): Promise<string | undefined> {
  if (!looksLikePath(value)) return value;
  const resolved = resolveDraftReference(projectDir(project.slug), draftFile, value);
  try { return await readTextFile(resolved); } catch { return undefined; }
}

export async function writeValidationMarkdownReport(project: Project, report: ValidationReport): Promise<string> {
  const reportPath = path.resolve(projectPath(project, "reports"), "validation-report.md");
  const lines = [
    `# Validation Report: ${project.name}`,
    "",
    `- Project: ${project.id}`,
    `- Generated at: ${report.generated_at}`,
    `- OK: ${report.ok ? "yes" : "no"}`,
    `- Errors: ${report.summary.errors}`,
    `- Warnings: ${report.summary.warnings}`,
    `- Infos: ${report.summary.infos}`,
    "",
    "## Issues",
    "",
  ];
  if (report.issues.length === 0) lines.push("No issues.");
  for (const issue of report.issues) {
    lines.push(`- [${issue.severity}] ${issue.code}${issue.field ? ` (${issue.field})` : ""}: ${issue.message}`);
  }
  await writeTextFile(reportPath, `${lines.join("\n")}\n`);
  return reportPath;
}

export function looksLikePath(value: string): boolean {
  return /[\\/]/.test(value) || /\.(md|txt|ya?ml|xyaml|html|css|js|ejs)$/i.test(value);
}

async function exists(filePath: string): Promise<boolean> {
  try { await fs.access(filePath); return true; } catch { return false; }
}

function issue(severity: IssueSeverity, code: string, message: string, field?: string): ValidationIssue {
  return { severity, code, message, field };
}

function normalizeSource(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\.\/source\//, "source/").replace(/^source\//, "");
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
