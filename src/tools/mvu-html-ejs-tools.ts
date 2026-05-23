import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildEjsEntries } from "../core/ejs-entries.js";
import { createEjsPhasePlan } from "../core/ejs-phase-plan.js";
import { createEjsTemplate } from "../core/ejs-template.js";
import { validateEjsConfig } from "../core/ejs-validator.js";
import { buildHtmlBeautifyAssets } from "../core/html-beautify-assets.js";
import { createHtmlBeautifyTemplate } from "../core/html-beautify-template.js";
import { validateHtmlBeautifyConfig } from "../core/html-beautify-validator.js";
import { createHtmlRegexPairTemplate } from "../core/html-regex-pair.js";
import { buildMvuAssets } from "../core/mvu-assets.js";
import { createMvuTemplate } from "../core/mvu-template.js";
import { validateMvuConfig } from "../core/mvu-validator.js";
import { validateRegexScripts } from "../core/regex-validator.js";
import { BuildEjsEntriesInputSchema, CreateEjsTemplateInputSchema, SubmitEjsConfigInputSchema, UpsertEjsEntryInputSchema, ValidateEjsConfigInputSchema } from "../schemas/ejs.js";
import { BuildHtmlBeautifyAssetsInputSchema, CreateHtmlBeautifyTemplateInputSchema, SubmitHtmlBeautifyConfigInputSchema, UpsertHtmlStatusbarInputSchema, ValidateHtmlBeautifyConfigInputSchema } from "../schemas/html-beautify.js";
import { BuildMvuAssetsInputSchema, CreateMvuSchemaTemplateInputSchema, SubmitMvuConfigInputSchema, UpsertMvuSchemaInputSchema, UpsertMvuUpdateRulesInputSchema, ValidateMvuConfigInputSchema } from "../schemas/mvu.js";
import { loadProject, updateProject } from "../storage/project-store.js";
import { toolText } from "./helpers.js";

export function registerMvuHtmlEjsTools(server: McpServer): void {
  server.tool("create_mvu_schema_template", CreateMvuSchemaTemplateInputSchema.shape, async (input) => {
    const parsed = CreateMvuSchemaTemplateInputSchema.parse(input);
    return toolText({ project_id: parsed.project_id, ...createMvuTemplate({ characterNames: parsed.character_names, variableListPath: parsed.variable_list_path }) });
  });

  server.tool("submit_mvu_config", SubmitMvuConfigInputSchema.shape, async (input) => {
    const parsed = SubmitMvuConfigInputSchema.parse(input);
    const saved = await updateProject(parsed.project_id, (project) => ({ ...project, mvuConfig: parsed.mvu }));
    const validation = validateMvuConfig({ mvu: parsed.mvu, characterCardConfig: saved.characterCardConfig });
    return toolText({ project_id: saved.id, validation });
  });

  server.tool("upsert_mvu_schema", UpsertMvuSchemaInputSchema.shape, async (input) => {
    const parsed = UpsertMvuSchemaInputSchema.parse(input);
    const result = await updateProject(parsed.project_id, (project) => {
      const base = project.mvuConfig ?? createMvuTemplate({ characterNames: parsed.character_names ?? ["角色"], variableListPath: typeof parsed.variable_list_path === "string" ? parsed.variable_list_path : undefined }).mvu;
      const mvu = {
        ...base,
        ...(parsed.enabled !== undefined ? { enabled: parsed.enabled } : {}),
        ...(parsed.schema_script !== undefined ? { schema_script: parsed.schema_script } : {}),
        ...(parsed.output_format !== undefined ? { output_format: parsed.output_format } : {}),
        ...(parsed.variable_list_path !== undefined ? { variable_list_path: parsed.variable_list_path } : {}),
      };
      return { ...project, mvuConfig: mvu };
    }, { expectedRevision: parsed.expected_revision });
    const validation = validateMvuConfig({ mvu: result.mvuConfig!, characterCardConfig: result.characterCardConfig });
    return toolText({ project_id: result.id, revision: result.revision, validation });
  });

  server.tool("upsert_mvu_update_rules", UpsertMvuUpdateRulesInputSchema.shape, async (input) => {
    const parsed = UpsertMvuUpdateRulesInputSchema.parse(input);
    const result = await updateProject(parsed.project_id, (project) => {
      const base = project.mvuConfig ?? createMvuTemplate({ characterNames: ["角色"] }).mvu;
      const mvu = {
        ...base,
        ...(parsed.enabled !== undefined ? { enabled: parsed.enabled } : {}),
        ...(parsed.initvar !== undefined ? { initvar: parsed.initvar } : {}),
        ...(parsed.update_rules !== undefined ? { update_rules: parsed.update_rules } : {}),
        ...(parsed.hide_regex !== undefined ? { hide_regex: parsed.hide_regex } : {}),
        ...(parsed.beautify_regex !== undefined ? { beautify_regex: parsed.beautify_regex } : {}),
      };
      return { ...project, mvuConfig: mvu };
    }, { expectedRevision: parsed.expected_revision });
    const validation = validateMvuConfig({ mvu: result.mvuConfig!, characterCardConfig: result.characterCardConfig });
    return toolText({ project_id: result.id, revision: result.revision, validation });
  });

  server.tool("validate_mvu_config", ValidateMvuConfigInputSchema.shape, async (input) => {
    const parsed = ValidateMvuConfigInputSchema.parse(input);
    const project = await loadProject(parsed.project_id);
    const mvu = parsed.mvu ?? project.mvuConfig;
    if (!mvu) throw new Error("项目尚未保存 mvu config");
    return toolText(validateMvuConfig({ mvu, characterCardConfig: project.characterCardConfig }));
  });

  server.tool("build_mvu_assets", BuildMvuAssetsInputSchema.shape, async (input) => {
    const parsed = BuildMvuAssetsInputSchema.parse(input);
    const project = await loadProject(parsed.project_id);
    const mvu = parsed.mvu ?? project.mvuConfig;
    if (!mvu) throw new Error("项目尚未保存 mvu config");
    const validation = validateMvuConfig({ mvu, characterCardConfig: project.characterCardConfig });
    if (!validation.valid) return toolText({ ok: false, validation });
    return toolText({ ok: true, validation, assets: buildMvuAssets(mvu) });
  });

  server.tool("create_html_beautify_template", CreateHtmlBeautifyTemplateInputSchema.shape, async (input) => {
    const parsed = CreateHtmlBeautifyTemplateInputSchema.parse(input);
    return toolText({ project_id: parsed.project_id, ...createHtmlBeautifyTemplate({ target: parsed.target, theme: parsed.theme }) });
  });

  server.tool("submit_html_beautify_config", SubmitHtmlBeautifyConfigInputSchema.shape, async (input) => {
    const parsed = SubmitHtmlBeautifyConfigInputSchema.parse(input);
    const saved = await updateProject(parsed.project_id, (project) => ({ ...project, htmlBeautifyConfig: parsed.html }));
    const validation = validateHtmlBeautifyConfig({ html: parsed.html, mvu: saved.mvuConfig, characterCardConfig: saved.characterCardConfig });
    return toolText({ project_id: saved.id, validation });
  });

  server.tool("upsert_html_statusbar", UpsertHtmlStatusbarInputSchema.shape, async (input) => {
    const parsed = UpsertHtmlStatusbarInputSchema.parse(input);
    const result = await updateProject(parsed.project_id, (project) => {
      const base = project.htmlBeautifyConfig ?? createHtmlBeautifyTemplate({ target: parsed.target ?? "statusbar", theme: parsed.theme ?? "minimal" }).html;
      const html = {
        ...base,
        ...(parsed.enabled !== undefined ? { enabled: parsed.enabled } : {}),
        target: parsed.target ?? base.target,
        theme: parsed.theme ?? base.theme,
        statusbar: {
          ...base.statusbar,
          enabled: parsed.enabled ?? base.statusbar.enabled,
          ...(parsed.html !== undefined ? { html: parsed.html } : {}),
          ...(parsed.hide_regex !== undefined ? { hide_regex: parsed.hide_regex } : {}),
        },
      };
      return { ...project, htmlBeautifyConfig: html };
    }, { expectedRevision: parsed.expected_revision });
    const validation = validateHtmlBeautifyConfig({ html: result.htmlBeautifyConfig!, mvu: result.mvuConfig, characterCardConfig: result.characterCardConfig });
    return toolText({ project_id: result.id, revision: result.revision, validation });
  });

  server.tool("validate_html_beautify_config", ValidateHtmlBeautifyConfigInputSchema.shape, async (input) => {
    const parsed = ValidateHtmlBeautifyConfigInputSchema.parse(input);
    const project = await loadProject(parsed.project_id);
    const html = parsed.html ?? project.htmlBeautifyConfig;
    if (!html) throw new Error("项目尚未保存 html beautify config");
    return toolText(validateHtmlBeautifyConfig({ html, mvu: project.mvuConfig, characterCardConfig: project.characterCardConfig }));
  });

  server.tool("build_html_beautify_assets", BuildHtmlBeautifyAssetsInputSchema.shape, async (input) => {
    const parsed = BuildHtmlBeautifyAssetsInputSchema.parse(input);
    const project = await loadProject(parsed.project_id);
    const html = parsed.html ?? project.htmlBeautifyConfig;
    if (!html) throw new Error("项目尚未保存 html beautify config");
    const validation = validateHtmlBeautifyConfig({ html, mvu: project.mvuConfig, characterCardConfig: project.characterCardConfig });
    if (!validation.valid) return toolText({ ok: false, validation });
    return toolText({ ok: true, validation, assets: buildHtmlBeautifyAssets(html) });
  });

  server.tool("create_html_regex_pair_template", {
    scope: z.enum(["statusbar", "global", "start_picker"]),
    find_regex: z.string().optional(),
    display_html: z.string().min(1),
    hide_regex: z.boolean().optional(),
    display_name: z.string().optional(),
    hide_name: z.string().optional(),
    placement: z.array(z.number().int().min(1).max(2)).optional(),
    min_depth: z.number().int().nullable().optional(),
    max_depth: z.number().int().nullable().optional(),
  }, async (input) => toolText(createHtmlRegexPairTemplate({ ...input, min_depth: input.min_depth ?? null, max_depth: input.max_depth ?? null })));

  server.tool("validate_regex_scripts", {
    scripts: z.array(z.object({
      scriptName: z.string().min(1),
      findRegex: z.string().min(1),
      replaceString: z.string().default(""),
      trimStrings: z.array(z.string()).default([]),
      placement: z.array(z.number().int()).default([2]),
      disabled: z.boolean().default(false),
      markdownOnly: z.boolean().default(false),
      promptOnly: z.boolean().default(false),
      runOnEdit: z.boolean().default(false),
      substituteRegex: z.number().int().default(0),
      minDepth: z.number().int().nullable().default(null),
      maxDepth: z.number().int().nullable().default(null),
    })),
  }, async (input) => toolText(validateRegexScripts(input.scripts)));

  server.tool("create_ejs_phase_plan", {
    character_name: z.string().min(1),
    affection_path: z.string().min(1),
    relationship_path: z.string().optional(),
    phases: z.array(z.object({
      name: z.string().min(1),
      short_name: z.string().optional(),
      affection_min_inclusive: z.number().optional(),
      affection_max_exclusive: z.number().optional(),
      relationship_equals: z.string().optional(),
      relationship_not_equals: z.string().optional(),
      description: z.string().optional(),
      stage_entry_name: z.string().optional(),
    })).min(1),
  }, async (input) => toolText(createEjsPhasePlan(input)));

  server.tool("create_ejs_template", CreateEjsTemplateInputSchema.shape, async (input) => {
    const parsed = CreateEjsTemplateInputSchema.parse(input);
    return toolText({ project_id: parsed.project_id, ...createEjsTemplate({ templateType: parsed.template_type, characterName: parsed.character_name, affectionPath: parsed.affection_path, relationshipPath: parsed.relationship_path }) });
  });

  server.tool("submit_ejs_config", SubmitEjsConfigInputSchema.shape, async (input) => {
    const parsed = SubmitEjsConfigInputSchema.parse(input);
    const saved = await updateProject(parsed.project_id, (project) => ({ ...project, ejsConfig: parsed.ejs }));
    const validation = validateEjsConfig({ ejs: parsed.ejs, mvu: saved.mvuConfig });
    return toolText({ project_id: saved.id, validation });
  });

  server.tool("upsert_ejs_entry", UpsertEjsEntryInputSchema.shape, async (input) => {
    const parsed = UpsertEjsEntryInputSchema.parse(input);
    const result = await updateProject(parsed.project_id, (project) => {
      const base = project.ejsConfig ?? { enabled: true, template_type: parsed.template_type ?? "custom", variable_paths: [], entries: [] };
      const entryIndex = base.entries.findIndex((entry) => entry.name === parsed.name);
      const existing = entryIndex >= 0 ? base.entries[entryIndex] : undefined;
      const entry = {
        name: parsed.name,
        role: parsed.role ?? existing?.role ?? "inline",
        content: parsed.content ?? existing?.content ?? "",
        keys: parsed.keys ?? existing?.keys ?? [],
        constant: parsed.constant ?? existing?.constant ?? true,
        position: parsed.position ?? existing?.position ?? "after_char",
        order: parsed.order ?? existing?.order ?? 100,
        enabled: parsed.enabled ?? existing?.enabled ?? true,
        ...(parsed.depth !== undefined || existing?.depth !== undefined ? { depth: parsed.depth ?? existing?.depth } : {}),
        ...(parsed.scanDepth !== undefined || existing?.scanDepth !== undefined ? { scanDepth: parsed.scanDepth ?? existing?.scanDepth } : {}),
      };
      const entries = [...base.entries];
      if (entryIndex >= 0) entries[entryIndex] = entry;
      else entries.push(entry);
      const variablePaths = parsed.variable_paths ? Array.from(new Set([...base.variable_paths, ...parsed.variable_paths])) : base.variable_paths;
      return { ...project, ejsConfig: { ...base, template_type: parsed.template_type ?? base.template_type, variable_paths: variablePaths, entries } };
    }, { expectedRevision: parsed.expected_revision });
    const validation = validateEjsConfig({ ejs: result.ejsConfig!, mvu: result.mvuConfig });
    return toolText({ project_id: result.id, revision: result.revision, validation });
  });

  server.tool("validate_ejs_config", ValidateEjsConfigInputSchema.shape, async (input) => {
    const parsed = ValidateEjsConfigInputSchema.parse(input);
    const project = await loadProject(parsed.project_id);
    const ejs = parsed.ejs ?? project.ejsConfig;
    if (!ejs) throw new Error("项目尚未保存 ejs config");
    return toolText(validateEjsConfig({ ejs, mvu: project.mvuConfig }));
  });

  server.tool("build_ejs_entries", BuildEjsEntriesInputSchema.shape, async (input) => {
    const parsed = BuildEjsEntriesInputSchema.parse(input);
    const project = await loadProject(parsed.project_id);
    const ejs = parsed.ejs ?? project.ejsConfig;
    if (!ejs) throw new Error("项目尚未保存 ejs config");
    const validation = validateEjsConfig({ ejs, mvu: project.mvuConfig });
    if (!validation.valid) return toolText({ ok: false, validation });
    return toolText({ ok: true, validation, entries: buildEjsEntries(ejs).worldbookEntries });
  });
}
