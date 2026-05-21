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
import { BuildEjsEntriesInputSchema, CreateEjsTemplateInputSchema, SubmitEjsConfigInputSchema, ValidateEjsConfigInputSchema } from "../schemas/ejs.js";
import { BuildHtmlBeautifyAssetsInputSchema, CreateHtmlBeautifyTemplateInputSchema, SubmitHtmlBeautifyConfigInputSchema, ValidateHtmlBeautifyConfigInputSchema } from "../schemas/html-beautify.js";
import { BuildMvuAssetsInputSchema, CreateMvuSchemaTemplateInputSchema, SubmitMvuConfigInputSchema, ValidateMvuConfigInputSchema } from "../schemas/mvu.js";
import { loadProject, saveProject } from "../storage/project-store.js";
import { toolText } from "./helpers.js";

export function registerMvuHtmlEjsTools(server: McpServer): void {
  server.tool("create_mvu_schema_template", CreateMvuSchemaTemplateInputSchema.shape, async (input) => {
    const parsed = CreateMvuSchemaTemplateInputSchema.parse(input);
    return toolText({ project_id: parsed.project_id, ...createMvuTemplate({ characterNames: parsed.character_names, variableListPath: parsed.variable_list_path }), recommended_next_tool: "submit_mvu_config" });
  });

  server.tool("submit_mvu_config", SubmitMvuConfigInputSchema.shape, async (input) => {
    const parsed = SubmitMvuConfigInputSchema.parse(input);
    const project = await loadProject(parsed.project_id);
    const saved = await saveProject({ ...project, mvuConfig: parsed.mvu });
    const validation = validateMvuConfig({ mvu: parsed.mvu, characterCardConfig: saved.characterCardConfig });
    return toolText({ project_id: saved.id, validation, recommended_next_tool: validation.valid ? "build_mvu_assets" : "validate_mvu_config" });
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
    return toolText({ project_id: parsed.project_id, ...createHtmlBeautifyTemplate({ target: parsed.target, theme: parsed.theme }), recommended_next_tool: "submit_html_beautify_config" });
  });

  server.tool("submit_html_beautify_config", SubmitHtmlBeautifyConfigInputSchema.shape, async (input) => {
    const parsed = SubmitHtmlBeautifyConfigInputSchema.parse(input);
    const project = await loadProject(parsed.project_id);
    const saved = await saveProject({ ...project, htmlBeautifyConfig: parsed.html });
    const validation = validateHtmlBeautifyConfig({ html: parsed.html, mvu: saved.mvuConfig, characterCardConfig: saved.characterCardConfig });
    return toolText({ project_id: saved.id, validation, recommended_next_tool: validation.valid ? "build_html_beautify_assets" : "validate_html_beautify_config" });
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
    return toolText({ project_id: parsed.project_id, ...createEjsTemplate({ templateType: parsed.template_type, characterName: parsed.character_name, affectionPath: parsed.affection_path, relationshipPath: parsed.relationship_path }), recommended_next_tool: "submit_ejs_config" });
  });

  server.tool("submit_ejs_config", SubmitEjsConfigInputSchema.shape, async (input) => {
    const parsed = SubmitEjsConfigInputSchema.parse(input);
    const project = await loadProject(parsed.project_id);
    const saved = await saveProject({ ...project, ejsConfig: parsed.ejs });
    const validation = validateEjsConfig({ ejs: parsed.ejs, mvu: saved.mvuConfig });
    return toolText({ project_id: saved.id, validation, recommended_next_tool: validation.valid ? "build_ejs_entries" : "validate_ejs_config" });
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
