import fs from "node:fs/promises";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createProject, draftPath, findProject, listProjects, projectDir, projectPath, readDraft, readPlan, writeDraft, writePlan } from "../storage/workspace.js";
import { resolveSourceFilePath } from "../storage/path-policy.js";
import { stringifyYaml, writeTextFile } from "../utils/yaml.js";
import { generateJson } from "../core/builder.js";
import { configureDraft } from "../core/configure-draft.js";
import { repairProject } from "../core/repair.js";
import { validateMvuProject } from "../core/mvu-validation.js";
import { applyMvuPreset, listMvuVariables, removeMvuVariable, rewriteMvuVariables, upsertMvuVariable } from "../core/mvu-variables.js";
import { validateProject, writeValidationMarkdownReport } from "../core/validation.js";
import { importNovaConfig } from "../core/nova-importer.js";
import { createEjsStageTemplate } from "../core/creative-tools.js";
import { entrySummary, generateTavernSyncConfig, queryEntries, updateEntryStatus } from "../core/entry-manifest.js";
import { checkDelivery, readSourceFile, resumeProject } from "../core/project-status.js";
import { InitProjectInputSchema, UpdatePlanInputSchema, WriteDraftInputSchema, WriteSourceFileInputSchema, ValidateProjectInputSchema, GenerateJsonInputSchema, QueryProjectInputSchema, ReadSourceFileInputSchema, ResumeProjectInputSchema, CheckDeliveryInputSchema, ImportExistingJsonInputSchema, ImportNovaConfigInputSchema, RepairProjectInputSchema, ValidateMvuInputSchema, ConfigureDraftInputSchema, ListMvuVariablesInputSchema, UpsertMvuVariableInputSchema, RemoveMvuVariableInputSchema, RewriteMvuVariablesInputSchema, ApplyMvuPresetInputSchema, UpdateEntryStatusInputSchema, QueryEntriesInputSchema, GenerateTavernSyncConfigInputSchema, CreateEjsStageTemplateInputSchema } from "./schemas.js";
import { toolText } from "./helpers.js";

export function registerProjectTools(server: McpServer): void {
  server.tool("init_project", InitProjectInputSchema.shape, async (input) => {
    const parsed = InitProjectInputSchema.parse(input);
    const result = await createProject({ name: parsed.name, output: parsed.output, source: parsed.source, assets: parsed.assets, ifExists: parsed.if_exists });
    const sourceRoot = path.resolve(projectDir(result.project.slug), result.project.paths.sourceRoot);
    return toolText({
      ok: true,
      project_id: result.project.id,
      slug: result.project.slug,
      project_path: result.projectPath,
      plan_path: projectPath(result.project, "plan"),
      draft_paths: { card: draftPath(result.project, "card"), worldbook: draftPath(result.project, "worldbook"), assets: draftPath(result.project, "assets") },
      source_paths: {
        root: sourceRoot,
        fields: path.resolve(sourceRoot, "fields"),
        entries: path.resolve(sourceRoot, "entries"),
        mvu: path.resolve(sourceRoot, "mvu"),
        html: path.resolve(sourceRoot, "html"),
        regex: path.resolve(sourceRoot, "regex"),
        ejs: path.resolve(sourceRoot, "ejs"),
        references: path.resolve(sourceRoot, "references"),
        extraction: path.resolve(sourceRoot, "extraction"),
      },
      created: result.created,
      next_actions: ["update_plan 记录需求", "write_source_file 写内容", "write_draft 写配置", "validate_project 校验", "generate_json 导出"],
    });
  });

  server.tool("update_plan", UpdatePlanInputSchema.shape, async (input) => {
    const parsed = UpdatePlanInputSchema.parse(input);
    const project = await findProject(parsed.project_id);
    const current = await readPlan(project).catch(() => "");
    const next = updatePlanText(current, parsed);
    await writePlan(project, next);
    return toolText({ ok: true, project_id: project.id, plan_path: projectPath(project, "plan"), preview: next.slice(0, 1600) });
  });

  server.tool("write_draft", WriteDraftInputSchema.shape, async (input) => {
    const parsed = WriteDraftInputSchema.parse(input);
    const project = await findProject(parsed.project_id);
    const current = await readDraft(project);
    const existing = current[parsed.target] ?? {};
    let next: unknown;
    if (parsed.mode === "rewrite") {
      if (parsed.data === undefined) throw new Error("rewrite 模式需要 data");
      next = parsed.data;
    } else if (parsed.mode === "patch") {
      if (!parsed.path) throw new Error("patch 模式需要 path");
      if (parsed.value === undefined) throw new Error("patch 模式需要 value");
      next = patchValue(structuredClone(existing), parsed.path, parsed.value);
    } else if (parsed.mode === "append_entry") {
      if (parsed.target !== "worldbook") throw new Error("append_entry 只能用于 worldbook draft");
      if (parsed.data === undefined) throw new Error("append_entry 模式需要 data");
      next = { ...(existing as Record<string, unknown>), entries: [...(((existing as { entries?: unknown[] }).entries) ?? []), parsed.data] };
    } else {
      if (parsed.target !== "worldbook" || !parsed.entry_id) throw new Error("remove_entry 需要 target=worldbook 和 entry_id");
      next = { ...(existing as Record<string, unknown>), entries: (((existing as { entries?: Array<{ id?: string }> }).entries) ?? []).filter((entry) => entry.id !== parsed.entry_id) };
    }
    const filePath = await writeDraft(project, parsed.target, next);
    return toolText({ ok: true, project_id: project.id, target: parsed.target, path: filePath });
  });

  server.tool("write_source_file", WriteSourceFileInputSchema.shape, async (input) => {
    const parsed = WriteSourceFileInputSchema.parse(input);
    const project = await findProject(parsed.project_id);
    const filePath = resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, parsed.path);
    if (!parsed.overwrite) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, parsed.content, { encoding: "utf8", flag: "wx" });
    } else await writeTextFile(filePath, parsed.content);
    return toolText({ ok: true, project_id: project.id, path: filePath, bytes: Buffer.byteLength(parsed.content, "utf8") });
  });

  server.tool("read_source_file", ReadSourceFileInputSchema.shape, async (input) => {
    const parsed = ReadSourceFileInputSchema.parse(input);
    const project = await findProject(parsed.project_id);
    return toolText(await readSourceFile(project, parsed.path, parsed.max_length));
  });

  server.tool("validate_project", ValidateProjectInputSchema.shape, async (input) => {
    const parsed = ValidateProjectInputSchema.parse(input);
    const project = await findProject(parsed.project_id);
    const report = await validateProject(project);
    const reportPath = await writeValidationMarkdownReport(project, report);
    return toolText({ ...report, report_path: reportPath });
  });

  server.tool("generate_json", GenerateJsonInputSchema.shape, async (input) => {
    const parsed = GenerateJsonInputSchema.parse(input);
    const project = await findProject(parsed.project_id);
    return toolText(await generateJson(project, parsed));
  });

  server.tool("query_project", QueryProjectInputSchema.shape, async (input) => {
    const parsed = QueryProjectInputSchema.parse(input);
    const project = await findProject(parsed.project_id);
    const fullDraft = await readDraft(project);
    const draft = parsed.include_draft ? fullDraft : undefined;
    const plan = parsed.include_plan ? await readPlan(project) : undefined;
    const exportsDir = projectPath(project, "exports");
    const reportsDir = projectPath(project, "reports");
    const sourceRoot = path.resolve(projectDir(project.slug), project.paths.sourceRoot);
    const exports = await fs.readdir(exportsDir).catch(() => [] as string[]);
    const sourceFiles = await listRelativeFiles(sourceRoot).catch(() => [] as string[]);
    return toolText({
      ok: true,
      project,
      plan,
      draft,
      paths: {
        project: projectDir(project.slug),
        plan: projectPath(project, "plan"),
        drafts: { card: draftPath(project, "card"), worldbook: draftPath(project, "worldbook"), assets: draftPath(project, "assets") },
        source_root: sourceRoot,
        reports: reportsDir,
        exports: exports.map((file) => path.resolve(exportsDir, file)),
      },
      source_files: sourceFiles,
      entry_summary: await entrySummary(project, fullDraft.worldbook?.entries ?? []),
      next_actions: ["按 references 审查文本", "write_source_file 写 entry 内容", "update_entry_status 标记 drafted/reviewed/done", "validate_project 校验配置"],
    });
  });

  server.tool("resume_project", ResumeProjectInputSchema.shape, async (input) => {
    const parsed = ResumeProjectInputSchema.parse(input);
    const project = await findProject(parsed.project_id);
    return toolText(await resumeProject(project, { include_plan: parsed.include_plan, include_entries: parsed.include_entries }));
  });

  server.tool("check_delivery", CheckDeliveryInputSchema.shape, async (input) => {
    const parsed = CheckDeliveryInputSchema.parse(input);
    const project = await findProject(parsed.project_id);
    return toolText(await checkDelivery(project, { require_done_entries: parsed.require_done_entries }));
  });

  server.tool("import_existing_json", ImportExistingJsonInputSchema.shape, async (input) => {
    const parsed = ImportExistingJsonInputSchema.parse(input);
    const result = await importExistingJson(parsed.path, parsed.name, parsed.if_exists);
    return toolText(result);
  });

  server.tool("import_nova_config", ImportNovaConfigInputSchema.shape, async (input) => {
    const parsed = ImportNovaConfigInputSchema.parse(input);
    return toolText(await importNovaConfig(parsed.path, parsed.name, parsed.if_exists));
  });

  server.tool("repair_project", RepairProjectInputSchema.shape, async (input) => {
    const parsed = RepairProjectInputSchema.parse(input);
    const project = await findProject(parsed.project_id);
    return toolText(await repairProject(project, { dry_run: parsed.dry_run }));
  });

  server.tool("configure_draft", ConfigureDraftInputSchema.shape, async (input) => {
    const parsed = ConfigureDraftInputSchema.parse(input);
    const project = await findProject(parsed.project_id);
    return toolText(await configureDraft(project, { mode: parsed.mode, profile: parsed.profile, strategy: parsed.strategy, typeLists: parsed.typeLists, strategyThresholds: parsed.strategyThresholds, partOrder: parsed.partOrder, requiredParts: parsed.requiredParts, entries: parsed.entries }));
  });

  server.tool("validate_mvu", ValidateMvuInputSchema.shape, async (input) => {
    const parsed = ValidateMvuInputSchema.parse(input);
    const project = await findProject(parsed.project_id);
    return toolText(await validateMvuProject(project));
  });

  server.tool("apply_mvu_preset", ApplyMvuPresetInputSchema.shape, async (input) => {
    const parsed = ApplyMvuPresetInputSchema.parse(input);
    const project = await findProject(parsed.project_id);
    return toolText(await applyMvuPreset(project, { preset: parsed.preset, overwrite: parsed.overwrite }));
  });

  server.tool("list_mvu_variables", ListMvuVariablesInputSchema.shape, async (input) => {
    const parsed = ListMvuVariablesInputSchema.parse(input);
    const project = await findProject(parsed.project_id);
    return toolText(await listMvuVariables(project));
  });

  server.tool("upsert_mvu_variable", UpsertMvuVariableInputSchema.shape, async (input) => {
    const parsed = UpsertMvuVariableInputSchema.parse(input);
    const project = await findProject(parsed.project_id);
    return toolText(await upsertMvuVariable(project, parsed.variable, { rewrite: parsed.rewrite }));
  });

  server.tool("remove_mvu_variable", RemoveMvuVariableInputSchema.shape, async (input) => {
    const parsed = RemoveMvuVariableInputSchema.parse(input);
    const project = await findProject(parsed.project_id);
    return toolText(await removeMvuVariable(project, parsed.path, { rewrite: parsed.rewrite }));
  });

  server.tool("rewrite_mvu_variables", RewriteMvuVariablesInputSchema.shape, async (input) => {
    const parsed = RewriteMvuVariablesInputSchema.parse(input);
    const project = await findProject(parsed.project_id);
    return toolText(await rewriteMvuVariables(project, parsed.variables, { rewrite: parsed.rewrite }));
  });

  server.tool("update_entry_status", UpdateEntryStatusInputSchema.shape, async (input) => {
    const parsed = UpdateEntryStatusInputSchema.parse(input);
    const project = await findProject(parsed.project_id);
    return toolText(await updateEntryStatus(project, parsed.entry_id, { status: parsed.status, abstract: parsed.abstract, sourceRefs: parsed.sourceRefs, part: parsed.part, scope: parsed.scope }));
  });

  server.tool("query_entries", QueryEntriesInputSchema.shape, async (input) => {
    const parsed = QueryEntriesInputSchema.parse(input);
    const project = await findProject(parsed.project_id);
    return toolText(await queryEntries(project, { status: parsed.status, part: parsed.part, scope: parsed.scope, include_content: parsed.include_content }));
  });

  server.tool("generate_tavern_sync_config", GenerateTavernSyncConfigInputSchema.shape, async (input) => {
    const parsed = GenerateTavernSyncConfigInputSchema.parse(input);
    const project = await findProject(parsed.project_id);
    return toolText(await generateTavernSyncConfig(project, { name: parsed.name, type: parsed.type, tavern_name: parsed.tavern_name, local_path: parsed.local_path, export_path: parsed.export_path, user_name: parsed.user_name, output_path: parsed.output_path, overwrite: parsed.overwrite }));
  });

  server.tool("create_ejs_stage_template", CreateEjsStageTemplateInputSchema.shape, async (input) => {
    const parsed = CreateEjsStageTemplateInputSchema.parse(input);
    const project = await findProject(parsed.project_id);
    return toolText(await createEjsStageTemplate(project, { controller_id: parsed.controller_id, variable: parsed.variable, base_profile: parsed.base_profile, common_derivations: parsed.common_derivations, stages: parsed.stages, overwrite: parsed.overwrite }));
  });

  server.tool("list_projects", {}, async () => toolText({ projects: await listProjects() }));
}

export async function importExistingJson(inputPath: string, nameOverride: string | undefined, ifExists: "error" | "overwrite") {
  const absolutePath = path.resolve(inputPath);
  const rawText = await fs.readFile(absolutePath, "utf8");
  const raw = JSON.parse(rawText) as Record<string, unknown>;
  const isCard = raw.spec === "chara_card_v3";
  const data = (isCard ? raw.data : raw) as Record<string, unknown>;
  const name = nameOverride || String(data.name ?? raw.name ?? path.basename(absolutePath, path.extname(absolutePath)));
  const created = await createProject({ name, output: isCard ? "character_card" : "worldbook", source: "modify_existing", ifExists });
  const project = created.project;

  if (isCard) {
    const fieldsDir = "fields";
    const entriesDir = "entries";
    const firstMes = String(data.first_mes ?? "");
    await writeTextFile(resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, `${fieldsDir}/first_mes.md`), firstMes);
    const alternateGreetings = Array.isArray(data.alternate_greetings) ? data.alternate_greetings.map(String) : [];
    const greetingRefs: string[] = [];
    for (const [index, greeting] of alternateGreetings.entries()) {
      const rel = `${fieldsDir}/greeting-${String(index + 1).padStart(2, "0")}.md`;
      await writeTextFile(resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, rel), greeting);
      greetingRefs.push(`../source/${rel}`);
    }
    const entries: unknown[] = [];
    const importedAssets = createDefaultAssetsDraft();
    let assetsChanged = false;
    assetsChanged = await importCardProfileWorldbookEntries(project, data, entries, importedAssets) || assetsChanged;
    const characterBook = (data.character_book as Record<string, unknown> | undefined) ?? {};
    const cardEntries = Array.isArray(characterBook.entries) ? characterBook.entries as Array<Record<string, unknown>> : [];
    for (const [index, entry] of cardEntries.entries()) {
      if (await importMvuEntry(project, entry, importedAssets)) {
        assetsChanged = true;
        continue;
      }
      const id = `imported-entry-${index + 1}`;
      const rel = `${entriesDir}/${String(index + 1).padStart(3, "0")}-${safeName(String(entry.comment ?? id))}.xyaml`;
      await writeTextFile(resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, rel), String(entry.content ?? ""));
      const ext = (entry.extensions as Record<string, unknown> | undefined) ?? {};
      entries.push({ id, comment: String(entry.comment ?? id), type: "other", content: `../source/${rel}`, enabled: entry.enabled !== false, constant: Boolean(entry.constant ?? true), keys: stringArray(entry.keys), secondary_keys: stringArray(entry.secondary_keys), position: positionName(Number(ext.position ?? 1)), order: Number(entry.insertion_order ?? entry.order ?? index + 1), depth: typeof ext.depth === "number" ? ext.depth : 4, scanDepth: typeof ext.scan_depth === "number" ? ext.scan_depth : null, preventRecursion: true, excludeRecursion: true });
    }
    const fieldRefs = await writeImportedCardFields(project, data, { first_mes: firstMes });
    await writeDraft(project, "card", { name, description: "", ...fieldRefs, first_mes: "../source/fields/first_mes.md", alternate_greetings: greetingRefs, creator: String(data.creator ?? ""), character_version: String(data.character_version ?? "1.0"), talkativeness: String(((data.extensions as Record<string, unknown> | undefined)?.talkativeness) ?? "0.5"), fav: Boolean((data.extensions as Record<string, unknown> | undefined)?.fav ?? false), tags: stringArray(data.tags), worldbook: { include: true, name: String(characterBook.name ?? name) } });
    await writeDraft(project, "worldbook", { name: String(characterBook.name ?? name), entries });
    const cardAssetsChanged = await importCardAssets(project, data, importedAssets);
    assetsChanged = cardAssetsChanged || assetsChanged;
    if (assetsChanged) await writeDraft(project, "assets", importedAssets);
  } else {
    const entriesObject = raw.entries && typeof raw.entries === "object" ? raw.entries as Record<string, Record<string, unknown>> : {};
    const entries: unknown[] = [];
    const importedAssets = createDefaultAssetsDraft();
    let assetsChanged = false;
    let index = 0;
    for (const entry of Object.values(entriesObject)) {
      if (await importMvuEntry(project, entry, importedAssets)) {
        assetsChanged = true;
        continue;
      }
      const id = `imported-entry-${index + 1}`;
      const rel = `entries/${String(index + 1).padStart(3, "0")}-${safeName(String(entry.comment ?? id))}.xyaml`;
      await writeTextFile(resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, rel), String(entry.content ?? ""));
      entries.push({ id, comment: String(entry.comment ?? id), type: "other", content: `../source/${rel}`, enabled: entry.disable !== true, constant: Boolean(entry.constant ?? true), keys: stringArray(entry.key), secondary_keys: stringArray(entry.keysecondary), position: positionName(Number(entry.position ?? 1)), order: Number(entry.order ?? index + 1), depth: typeof entry.depth === "number" ? entry.depth : 4, scanDepth: typeof entry.scanDepth === "number" ? entry.scanDepth : null, preventRecursion: true, excludeRecursion: true });
      index += 1;
    }
    await writeDraft(project, "worldbook", { name, entries });
    if (assetsChanged) await writeDraft(project, "assets", importedAssets);
  }
  return { ok: true, project_id: project.id, project_path: projectDir(project.slug), imported_from: absolutePath, note: isCard ? "角色卡已导入；原 description 如非空已转为世界书条目，card.description 保持为空" : "世界书已导入" };
}

async function importCardProfileWorldbookEntries(project: import("../schemas/project.js").Project, data: Record<string, unknown>, entries: unknown[], assets: Record<string, unknown>): Promise<boolean> {
  const mapping = [
    ["description", "导入原 description", "character_basic", 0],
    ["personality", "导入原 personality", "character_personality", 1],
    ["scenario", "导入原 scenario", "background", 2],
    ["creator_notes", "导入原 creator_notes", "other", 3],
  ] as const;
  let changed = false;
  for (const [field, comment, type, order] of mapping) {
    const content = String(data[field] ?? "");
    if (!content.trim()) continue;
    const rel = `entries/${String(order).padStart(3, "0")}-imported-${field}.xyaml`;
    await writeTextFile(resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, rel), content);
    entries.push({ id: `imported-${field}`, comment, type, content: `../source/${rel}`, enabled: true, constant: true, keys: [], secondary_keys: [], position: "after_char", order, depth: 4, scanDepth: null, preventRecursion: true, excludeRecursion: true });
    changed = true;
  }
  return changed;
}

function createDefaultAssetsDraft(): Record<string, unknown> {
  return { mvu: { enabled: false }, html: { statusbar: { enabled: false } }, regex: {}, ejs: { enabled: false, entries: [] } };
}

async function importMvuEntry(project: import("../schemas/project.js").Project, entry: Record<string, unknown>, assets: Record<string, unknown>): Promise<boolean> {
  const comment = String(entry.comment ?? "");
  const content = String(entry.content ?? "");
  const target = mvuTargetFromComment(comment);
  if (!target) return false;
  await writeTextFile(resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, target.path), content);
  assets.mvu = { ...(assets.mvu as Record<string, unknown>), enabled: true, schema: "../source/mvu/schema.js", initvar: "../source/mvu/initvar.yaml", updateRules: "../source/mvu/update-rules.yaml", variableList: "../source/mvu/variable-list.md", outputFormat: "../source/mvu/output-format.md", hideRegex: true, beautifyRegex: true };
  return true;
}

function mvuTargetFromComment(comment: string): { path: string } | undefined {
  if (/initvar|变量初始化/i.test(comment)) return { path: "mvu/initvar.yaml" };
  if (/变量列表|variable[-_ ]?list/i.test(comment)) return { path: "mvu/variable-list.md" };
  if (/输出格式|output[-_ ]?format/i.test(comment)) return { path: "mvu/output-format.md" };
  if (/更新规则|update[-_ ]?rules|mvu_update/i.test(comment)) return { path: "mvu/update-rules.yaml" };
  return undefined;
}

async function importCardAssets(project: import("../schemas/project.js").Project, data: Record<string, unknown>, assets: Record<string, unknown>): Promise<boolean> {
  let changed = false;
  const extensions = (data.extensions as Record<string, unknown> | undefined) ?? {};
  const regexScripts = extensions.regex_scripts;
  if (Array.isArray(regexScripts) && regexScripts.length) {
    const normalizedScripts = regexScripts.map(normalizeRegexScript);
    const htmlScript = normalizedScripts.find((script) => {
      const replaceString = String(script.replaceString ?? "");
      return /StatusPlaceHolderImpl|状态栏|界面/.test(`${String(script.findRegex ?? "")}\n${replaceString}\n${String(script.name ?? "")}`) && /<[^>]+>|CDATA|format_message_variable|stat_data/.test(replaceString);
    });
    const remaining = normalizedScripts.filter((script) => script !== htmlScript);
    if (htmlScript) {
      const replaceString = String(htmlScript.replaceString ?? "");
      const html = unwrapCdata(replaceString.replace(/<style>[\s\S]*?<\/style>/i, "")).trim();
      const cssMatch = replaceString.match(/<style>([\s\S]*?)<\/style>/i);
      await writeTextFile(resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, "html/statusbar.html"), html);
      const statusbar: Record<string, unknown> = { enabled: true, html: "../source/html/statusbar.html" };
      if (cssMatch?.[1]) {
        await writeTextFile(resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, "html/statusbar.css"), cssMatch[1].trim());
        statusbar.css = "../source/html/statusbar.css";
      }
      assets.html = { statusbar };
      changed = true;
    }
    if (remaining.length) {
      await writeTextFile(resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, "regex/scripts.yaml"), stringifyYaml(remaining));
      assets.regex = { scripts: "../source/regex/scripts.yaml" };
      changed = true;
    }
  }
  const tavernHelperScripts = extensions.TavernHelper_scripts;
  if (Array.isArray(tavernHelperScripts)) {
    const schema = tavernHelperScripts.find((script) => String(((script as Record<string, unknown>).value as Record<string, unknown> | undefined)?.name ?? "").includes("变量结构"));
    const content = String(((schema as Record<string, unknown> | undefined)?.value as Record<string, unknown> | undefined)?.content ?? "");
    if (content.trim()) {
      await writeTextFile(resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, "mvu/schema.js"), content);
      assets.mvu = { enabled: true, schema: "../source/mvu/schema.js", initvar: "../source/mvu/initvar.yaml", updateRules: "../source/mvu/update-rules.yaml", variableList: "../source/mvu/variable-list.md", outputFormat: "../source/mvu/output-format.md", hideRegex: true, beautifyRegex: true };
      await writeTextFile(resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, "mvu/initvar.yaml"), "{}\n");
      await writeTextFile(resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, "mvu/update-rules.yaml"), "{}\n");
      await writeTextFile(resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, "mvu/variable-list.md"), "");
      await writeTextFile(resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, "mvu/output-format.md"), "");
      changed = true;
    }
  }
  return changed;
}

function normalizeRegexScript(script: unknown, index = 0): Record<string, unknown> {
  const record = script as Record<string, unknown>;
  return { id: String(record.id ?? `imported-regex-${index + 1}`), name: String(record.scriptName ?? record.name ?? `导入正则 ${index + 1}`), findRegex: String(record.findRegex ?? ""), replaceString: String(record.replaceString ?? ""), markdownOnly: Boolean(record.markdownOnly ?? true), promptOnly: Boolean(record.promptOnly ?? false), placement: Array.isArray(record.placement) ? record.placement : [2], minDepth: record.minDepth ?? null, maxDepth: record.maxDepth ?? null, runOnEdit: Boolean(record.runOnEdit ?? false), substituteRegex: Number(record.substituteRegex ?? 0), disabled: Boolean(record.disabled ?? false) };
}

function unwrapCdata(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1");
}

async function writeImportedCardFields(project: import("../schemas/project.js").Project, data: Record<string, unknown>, overrides: Record<string, string>): Promise<Record<string, string>> {
  const refs: Record<string, string> = { personality: "", scenario: "", creator_notes: "" };
  for (const field of ["mes_example", "system_prompt", "post_history_instructions"] as const) {
    const content = String(data[field] ?? "");
    if (!content.trim()) {
      refs[field] = "";
      continue;
    }
    const rel = `fields/${field}.md`;
    await writeTextFile(resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, rel), content);
    refs[field] = `../source/${rel}`;
  }
  for (const [field, content] of Object.entries(overrides)) {
    const rel = `fields/${field}.md`;
    await writeTextFile(resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, rel), content);
    refs[field] = `../source/${rel}`;
  }
  return refs;
}

async function listRelativeFiles(root: string): Promise<string[]> {
  const results: string[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.resolve(dir, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      else if (entry.isFile()) results.push(path.relative(root, fullPath).replace(/\\/g, "/"));
    }
  }
  await walk(root);
  return results.sort();
}

function stringArray(value: unknown): string[] { return Array.isArray(value) ? value.map(String) : []; }
function safeName(value: string): string { return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").slice(0, 60) || "entry"; }
function positionName(value: number): string { return ({ 0: "before_char", 1: "after_char", 2: "before_an", 3: "after_an", 4: "at_depth", 5: "before_em", 6: "after_em", 7: "outlet" } as Record<number, string>)[value] ?? "after_char"; }

type UpdatePlanInput = ReturnType<typeof UpdatePlanInputSchema.parse>;

function updatePlanText(current: string, input: UpdatePlanInput): string {
  if (input.mode === "rewrite") {
    if (input.content === undefined) throw new Error("rewrite 需要 content");
    return input.content.endsWith("\n") ? input.content : `${input.content}\n`;
  }
  if (input.mode === "replace_section" || input.mode === "append_section") {
    if (!input.section || input.content === undefined) throw new Error(`${input.mode} 需要 section 和 content`);
    return updateSection(current, input.section, input.content, input.mode === "append_section");
  }
  if (input.mode === "append_decision") {
    if (!input.decision) throw new Error("append_decision 需要 decision");
    return updateSection(current, "3. 用户决策记录", `| ${escapeTable(input.decision.question)} | ${escapeTable(input.decision.answer)} | ${escapeTable(input.decision.note ?? "")} |`, true);
  }
  if (input.mode === "append_todo") {
    if (!input.todo) throw new Error("append_todo 需要 todo");
    return updateSection(current, "9. 待办清单", `- [${input.todo.done ? "x" : " "}] ${input.todo.text}`, true);
  }
  if (input.mode === "update_todo") {
    if (!input.todo_match) throw new Error("update_todo 需要 todo_match");
    return current.split(/\r?\n/).map((line) => line.includes(input.todo_match!) && /^- \[[ x]\]/.test(line.trim()) ? line.replace(/\[[ x]\]/, `[${input.done ? "x" : " "}]`) : line).join("\n");
  }
  const sectionMap = { append_acceptance: "10. 验收标准", append_verification: "11. 验证记录", append_risk: "12. 风险与未决问题" } as const;
  const section = sectionMap[input.mode];
  if (!input.content) throw new Error(`${input.mode} 需要 content`);
  return updateSection(current, section, `- ${input.content}`, true);
}

function updateSection(markdown: string, section: string, content: string, append: boolean): string {
  const heading = section.startsWith("## ") ? section : `## ${section}`;
  const pattern = new RegExp(`(^${escapeRegExp(heading)}\\n)([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, "m");
  if (!pattern.test(markdown)) return `${markdown.trimEnd()}\n\n${heading}\n\n${content.trim()}\n`;
  return markdown.replace(pattern, (_match, head: string, body: string) => {
    const nextBody = append ? `${body.trimEnd()}\n${content.trim()}\n\n` : `\n${content.trim()}\n\n`;
    return `${head}${nextBody}`;
  });
}

function patchValue(target: unknown, pathSegments: Array<string | number>, value: unknown): unknown {
  if (pathSegments.length === 0) return value;
  if (typeof target !== "object" || target === null) throw new Error("patch target 必须是对象");
  let cursor = target as Record<string, unknown> | unknown[];
  for (const [index, segment] of pathSegments.entries()) {
    const isLast = index === pathSegments.length - 1;
    if (isLast) {
      (cursor as Record<string, unknown>)[String(segment)] = value;
    } else {
      const key = String(segment);
      const record = cursor as Record<string, unknown>;
      if (typeof record[key] !== "object" || record[key] === null) record[key] = typeof pathSegments[index + 1] === "number" ? [] : {};
      cursor = record[key] as Record<string, unknown> | unknown[];
    }
  }
  return target;
}

function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function escapeTable(value: string): string { return value.replace(/\|/g, "\\|").replace(/\n/g, "<br>"); }
