import fs from "node:fs/promises";
import path from "node:path";
import type { Project } from "../schemas/project.js";
import { CardDraftSchema, type WorldbookEntryDraft } from "../schemas/draft.js";
import { draftPath, projectDir, projectPath, readDraft, readPlan } from "../storage/workspace.js";
import { resolveDraftReference, resolveSourceFilePath } from "../storage/path-policy.js";
import { parseYaml, readTextFile, readYamlFile } from "../utils/yaml.js";
import { validateProject } from "./validation.js";
import { listMvuVariables } from "./mvu-variables.js";
import { entrySummary } from "./entry-manifest.js";

export interface PlanEntry { id?: string; source?: string; status?: string; [key: string]: unknown }

export async function readSourceFile(project: Project, relativePath: string, maxLength = 20000): Promise<{ ok: boolean; project_id: string; path: string; content: string; truncated: boolean }> {
  const filePath = resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, relativePath);
  const content = await readTextFile(filePath);
  const truncated = content.length > maxLength;
  return { ok: true, project_id: project.id, path: filePath, content: truncated ? content.slice(0, maxLength) : content, truncated };
}

export async function parsePlanEntries(project: Project): Promise<PlanEntry[]> {
  const plan = await readPlan(project).catch(() => "");
  for (const match of plan.matchAll(/```ya?ml\s*\n([\s\S]*?)```/g)) {
    const block = match[1];
    if (!/^\s*entries\s*:/m.test(block)) continue;
    try {
      const parsed = parseYaml<{ entries?: PlanEntry[] }>(block);
      return Array.isArray(parsed?.entries) ? parsed.entries : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function comparePlanEntries(project: Project, entries: WorldbookEntryDraft[]): Promise<{ missing_in_draft: PlanEntry[]; extra_in_draft: string[]; source_mismatch: Array<{ id: string; plan_source?: string; draft_content: string }> }> {
  const planEntries = await parsePlanEntries(project);
  const draftById = new Map(entries.map((entry) => [entry.id, entry]));
  const planIds = new Set(planEntries.map((entry) => entry.id).filter(Boolean) as string[]);
  const missing = planEntries.filter((entry) => entry.id && !draftById.has(entry.id));
  const extra = entries.filter((entry) => !planIds.has(entry.id)).map((entry) => entry.id);
  const sourceMismatch = planEntries.flatMap((entry) => {
    if (!entry.id || !entry.source) return [];
    const draftEntry = draftById.get(entry.id);
    if (!draftEntry) return [];
    const normalizedPlan = normalizeSource(String(entry.source));
    const normalizedDraft = normalizeSource(draftEntry.content);
    return normalizedPlan === normalizedDraft ? [] : [{ id: entry.id, plan_source: String(entry.source), draft_content: draftEntry.content }];
  });
  return { missing_in_draft: missing, extra_in_draft: extra, source_mismatch: sourceMismatch };
}

export async function resumeProject(project: Project, options: { include_plan?: boolean; include_entries?: boolean } = {}): Promise<Record<string, unknown>> {
  const draft = await readDraft(project);
  const entries = draft.worldbook?.entries ?? [];
  const planEntries = await parsePlanEntries(project);
  const planCompare = await comparePlanEntries(project, entries);
  const firstMesPath = draft.card ? resolveDraftReference(projectDir(project.slug), draftPath(project, "card"), draft.card.first_mes) : undefined;
  const mvuMissing = await mvuMissingFiles(project);
  const ejsEntries = draft.assets?.ejs.entries ?? [];
  const exportsDir = projectPath(project, "exports");
  const cardExport = path.resolve(exportsDir, `${project.slug}.card.json`);
  const worldbookExport = path.resolve(exportsDir, `${project.slug}.worldbook.json`);
  const result: Record<string, unknown> = {
    ok: true,
    project: { id: project.id, slug: project.slug, name: project.name, output: project.kind.output, source: project.kind.source },
    progress: {
      entries: { ...await entrySummary(project, entries), planned_in_plan: planEntries.length, plan_compare: planCompare },
      card: {
        first_mes_exists: firstMesPath ? await exists(firstMesPath) : false,
        greetings_count: draft.card?.alternate_greetings.length ?? 0,
        description_empty: draft.card ? CardDraftSchema.safeParse(draft.card).success && draft.card.description === "" : null,
      },
      mvu: {
        enabled: Boolean(draft.assets?.mvu.enabled),
        missing_files: mvuMissing,
        variable_count: draft.assets?.mvu.enabled ? (await listMvuVariables(project).catch(() => ({ variables: [] }))).variables.length : 0,
      },
      ejs: {
        enabled: Boolean(draft.assets?.ejs.enabled),
        controller_count: ejsEntries.filter((entry) => entry.role === "controller").length,
        stage_count: ejsEntries.filter((entry) => entry.role === "stage").length,
        enabled_stage_count: ejsEntries.filter((entry) => entry.role === "stage" && entry.enabled).length,
      },
      html: {
        statusbar_enabled: Boolean(draft.assets?.html.statusbar.enabled),
        statusbar_mode: draft.assets?.html.statusbar.mode ?? "safe_macro",
        statusbar_variables: draft.assets?.html.statusbar.variablePaths.length ?? 0,
      },
      regex: {
        enabled: Boolean(draft.assets?.regex.scripts),
        script_count: await regexScriptCount(project),
      },
      tavernHelper: {
        planned: project.kind.assets.tavernHelper !== "disabled",
        enabled: Boolean(draft.assets?.tavernHelper?.scripts),
        script_count: await tavernHelperScriptCount(project),
        missing_files: await tavernHelperMissingFiles(project),
      },
      exports: {
        card_exists: await exists(cardExport),
        worldbook_exists: await exists(worldbookExport),
        build_report_exists: await exists(path.resolve(projectPath(project, "reports"), "build-report.yaml")),
        validation_report_exists: await exists(path.resolve(projectPath(project, "reports"), "validation-report.md")),
      },
    },
    next_actions: nextActions(entries, planCompare, mvuMissing, draft.card ? await exists(firstMesPath!) : false),
  };
  if (options.include_plan) result.plan = await readPlan(project).catch(() => "");
  if (options.include_entries) result.entries = entries;
  return result;
}

export async function checkDelivery(project: Project, options: { require_done_entries?: boolean } = {}): Promise<Record<string, unknown>> {
  const draft = await readDraft(project);
  const validation = await validateProject(project);
  const entries = draft.worldbook?.entries ?? [];
  const reportsDir = projectPath(project, "reports");
  const buildReportPath = path.resolve(reportsDir, "build-report.yaml");
  const validationReportPath = path.resolve(reportsDir, "validation-report.md");
  const blocking: string[] = [];
  const warnings: string[] = [];
  const buildReport = await readBuildReport(buildReportPath);
  if (validation.summary.errors > 0) blocking.push("validate_project has errors");
  if (!buildReport) {
    blocking.push("missing build-report.yaml");
  } else {
    for (const target of requiredTargets(project)) {
      const output = buildReport.outputs.find((item) => item.target === target);
      if (!output) {
        blocking.push(`missing ${target} export`);
        continue;
      }
      if (!await exists(output.path)) blocking.push(`missing ${target} export file: ${output.path}`);
    }
    if (await isBuildStale(project, buildReportPath)) blocking.push("build is stale; run generate_json again");
  }
  if (!await exists(validationReportPath)) warnings.push("missing validation-report.md");
  if (options.require_done_entries) {
    const unfinished = entries.filter((entry) => (entry.status ?? "planned") !== "done").map((entry) => entry.id);
    if (unfinished.length > 0) blocking.push(`unfinished entries: ${unfinished.join(", ")}`);
  }
  return {
    ok: blocking.length === 0,
    blocking,
    warnings,
    validation_summary: validation.summary,
    paths: {
      validation_report: validationReportPath,
      build_report: buildReportPath,
      exports: buildReport?.outputs ?? [],
    },
  };
}

async function regexScriptCount(project: Project): Promise<number> {
  const draft = await readDraft(project);
  const scriptsRef = draft.assets?.regex.scripts;
  if (!scriptsRef) return 0;
  const scriptsPath = resolveDraftReference(projectDir(project.slug), draftPath(project, "assets"), scriptsRef);
  const parsed = parseYaml<unknown>(await readTextFile(scriptsPath).catch(() => "[]")) ?? [];
  return Array.isArray(parsed) ? parsed.length : 0;
}

async function tavernHelperScriptCount(project: Project): Promise<number> {
  const draft = await readDraft(project);
  const scriptsRef = draft.assets?.tavernHelper?.scripts;
  if (!scriptsRef) return 0;
  const scriptsPath = resolveDraftReference(projectDir(project.slug), draftPath(project, "assets"), scriptsRef);
  const parsed = parseYaml<unknown>(await readTextFile(scriptsPath).catch(() => "[]")) ?? [];
  return Array.isArray(parsed) ? parsed.length : 0;
}

async function tavernHelperMissingFiles(project: Project): Promise<string[]> {
  const draft = await readDraft(project);
  const scriptsRef = draft.assets?.tavernHelper?.scripts;
  if (!scriptsRef) return [];
  const missing: string[] = [];
  const scriptsPath = resolveDraftReference(projectDir(project.slug), draftPath(project, "assets"), scriptsRef);
  if (!await exists(scriptsPath)) return ["scripts"];
  const scripts = parseYaml<Array<{ id?: string; contentFile?: string }>>(await readTextFile(scriptsPath).catch(() => "[]")) ?? [];
  if (!Array.isArray(scripts)) return ["scripts_schema"];
  for (const script of scripts) {
    if (!script.contentFile) continue;
    const filePath = resolveDraftReference(projectDir(project.slug), scriptsPath, script.contentFile);
    if (!await exists(filePath)) missing.push(script.id ?? script.contentFile);
  }
  return missing;
}

async function mvuMissingFiles(project: Project): Promise<string[]> {
  const draft = await readDraft(project);
  const mvu = draft.assets?.mvu;
  if (!mvu?.enabled) return [];
  const refs = { schema: mvu.schema, initvar: mvu.initvar, updateRules: mvu.updateRules, variableList: mvu.variableList, outputFormat: mvu.outputFormat };
  const missing: string[] = [];
  for (const [key, ref] of Object.entries(refs)) {
    if (!ref) { missing.push(key); continue; }
    const filePath = resolveDraftReference(projectDir(project.slug), draftPath(project, "assets"), ref);
    if (!await exists(filePath)) missing.push(key);
  }
  return missing;
}

function nextActions(entries: WorldbookEntryDraft[], compare: Awaited<ReturnType<typeof comparePlanEntries>>, mvuMissing: string[], firstMesExists: boolean): string[] {
  const actions: string[] = [];
  if (!firstMesExists) actions.push("write_source_file 写 first_mes");
  if (compare.missing_in_draft.length > 0) actions.push("configure_draft 注册 plan.md 中缺失的 entries");
  const nextPlanned = entries.find((entry) => (entry.status ?? "planned") === "planned");
  if (nextPlanned) actions.push(`继续编写 entry: ${nextPlanned.id}`);
  if (mvuMissing.length > 0) actions.push(`补齐 MVU 文件: ${mvuMissing.join(", ")}`);
  actions.push("按 references 审查文本");
  actions.push("validate_project 后 generate_json");
  return actions;
}

interface BuildReportOutput { target: "worldbook" | "character_card"; path: string }
interface BuildReport { outputs: BuildReportOutput[] }

async function readBuildReport(filePath: string): Promise<BuildReport | undefined> {
  try {
    const report = await readYamlFile<BuildReport>(filePath);
    return { outputs: Array.isArray(report.outputs) ? report.outputs.filter((item) => item && typeof item.path === "string" && (item.target === "worldbook" || item.target === "character_card")) : [] };
  } catch {
    return undefined;
  }
}

function requiredTargets(project: Project): Array<"worldbook" | "character_card"> {
  if (project.kind.output === "both") return ["worldbook", "character_card"];
  return [project.kind.output];
}

async function isBuildStale(project: Project, buildReportPath: string): Promise<boolean> {
  const buildStat = await fs.stat(buildReportPath).catch(() => undefined);
  if (!buildStat) return true;
  const inputs = [path.resolve(projectDir(project.slug), "project.yaml"), projectPath(project, "plan"), draftPath(project, "card"), draftPath(project, "worldbook"), draftPath(project, "assets")];
  inputs.push(...await listFiles(path.resolve(projectDir(project.slug), project.paths.sourceRoot)).catch(() => []));
  for (const input of inputs) {
    const stat = await fs.stat(input).catch(() => undefined);
    if (stat && stat.mtimeMs > buildStat.mtimeMs + 1000) return true;
  }
  return false;
}

async function listFiles(root: string): Promise<string[]> {
  const results: string[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.resolve(dir, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      else if (entry.isFile()) results.push(fullPath);
    }
  }
  await walk(root);
  return results;
}

function normalizeSource(value: string): string { return value.replace(/\\/g, "/").replace(/^\.\.\/source\//, "source/").replace(/^source\//, ""); }
async function exists(filePath: string): Promise<boolean> { try { await fs.access(filePath); return true; } catch { return false; } }
