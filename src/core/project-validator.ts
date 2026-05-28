import type { Project } from "../schemas/project.js";
import type { BuildManifest } from "../schemas/build-artifact.js";
import { defaultProjectKind } from "../schemas/project.js";
import { analyzeMvuPaths } from "./mvu-path-analyzer.js";
import { validateMvuConfig } from "./mvu-validator.js";
import { validateHtmlBeautifyConfig } from "./html-beautify-validator.js";
import { validateEjsConfig } from "./ejs-validator.js";
import { validateWorldbookDraft } from "./worldbook-validator.js";
import { validateCharacterCardConfig } from "./character-card-validator.js";
import { validateRegexScripts } from "./regex-validator.js";
import type { RegexSliceData } from "../schemas/regex.js";
import { normalizeIssue, section, sectionFromIssues, skipped, type ProjectValidationReport, type ProjectValidationScope, type ValidationIssue, type ValidationSection } from "./validation-types.js";

const SCOPE_SECTIONS: Record<ProjectValidationScope, string[]> = {
  all: ["project", "plan", "pending_decisions", "worldbook", "character_card", "opening", "mvu", "html", "regex", "ejs", "assets", "build", "delivery", "content_policy_delegated"],
  project: ["project"],
  plan: ["plan", "pending_decisions"],
  worldbook: ["worldbook"],
  character_card: ["character_card"],
  opening: ["opening"],
  mvu: ["mvu"],
  html: ["html"],
  regex: ["regex"],
  ejs: ["ejs"],
  assets: ["assets"],
  build: ["build"],
  delivery: ["project", "plan", "pending_decisions", "worldbook", "character_card", "opening", "mvu", "html", "regex", "ejs", "assets", "build", "delivery"],
  content: ["content_policy_delegated"],
};

export function sectionsForScope(scope: ProjectValidationScope): string[] {
  return SCOPE_SECTIONS[scope] ?? SCOPE_SECTIONS.all;
}

export function validateProject(projectInput: Project & { draft?: import("../schemas/worldbook-draft.js").WorldbookDraftEntry[]; characterCardConfig?: import("../schemas/character-card.js").CharacterCardConfig; mvuConfig?: import("../schemas/mvu.js").MvuConfig; htmlBeautifyConfig?: import("../schemas/html-beautify.js").HtmlBeautifyConfig; ejsConfig?: import("../schemas/ejs.js").EjsConfig; regexSlices?: Array<{ id: string; data: RegexSliceData }> }, options: { scope?: ProjectValidationScope; build?: { manifest?: BuildManifest; stale?: boolean; stale_reasons?: string[] }; export_target?: "worldbook" | "character_card" | "both" } = {}): ProjectValidationReport {
  const scope = options.scope ?? "all";
  const project = normalizeProject(projectInput);
  const sectionSet = new Set(sectionsForScope(scope));
  const sections: Record<string, ValidationSection> = {};
  if (sectionSet.has("project")) sections.project = validateProjectSection(project);
  if (sectionSet.has("plan")) sections.plan = validatePlanSection(project, scope === "delivery");
  if (sectionSet.has("pending_decisions")) sections.pending_decisions = validatePendingDecisions(project, scope === "delivery");
  if (sectionSet.has("worldbook")) sections.worldbook = validateWorldbookSection(project, options.export_target);
  if (sectionSet.has("character_card")) sections.character_card = project.kind.output === "worldbook" ? skipped({ required: false }, "纯世界书项目不需要角色卡") : project.characterCardConfig ? validateCharacterCardConfig({ config: project.characterCardConfig, draft: project.draft, mvuEnabled: Boolean(project.mvuConfig), htmlStatusbarEnabled: Boolean(project.htmlBeautifyConfig && (project.htmlBeautifyConfig.target === "statusbar" || project.htmlBeautifyConfig.target === "both")) }) : sectionFromIssues([normalizeIssue({ code: "character_card.missing", field: "profile", severity: "error", message: "输出包含 character_card，但缺少 profile/greetings" })], { has_profile: false, has_first_mes: false });
  if (sectionSet.has("opening")) sections.opening = validateOpeningSection(project);
  const analysis = project.mvuConfig ? analyzeMvuPaths(project.mvuConfig) : undefined;
  if (sectionSet.has("mvu")) sections.mvu = project.kind.assets.mvu.enabled || Boolean(project.mvuConfig) ? project.mvuConfig ? validateMvuConfig({ mvu: project.mvuConfig, characterCardConfig: project.characterCardConfig, analysis }) : sectionFromIssues([normalizeIssue({ code: "mvu.slice.missing", field: "mvu", severity: "error", message: "kind 启用 MVU 但缺少 mvu slice" })], { enabled: true }) : skipped({ enabled: false }, "MVU 未启用");
  if (sectionSet.has("html")) sections.html = project.kind.assets.html.enabled || Boolean(project.htmlBeautifyConfig) ? project.htmlBeautifyConfig ? validateHtmlBeautifyConfig({ html: project.htmlBeautifyConfig, mvu: project.mvuConfig, characterCardConfig: project.characterCardConfig }) : sectionFromIssues([normalizeIssue({ code: "html.slice.missing", field: "html", severity: "error", message: "kind 启用 HTML 但缺少 html slice" })], { enabled: true }) : skipped({ enabled: false }, "HTML 未启用");
  if (sectionSet.has("ejs")) sections.ejs = project.kind.assets.ejs.enabled || Boolean(project.ejsConfig) ? project.ejsConfig ? validateEjsConfig({ ejs: project.ejsConfig, mvu: project.mvuConfig }) : sectionFromIssues([normalizeIssue({ code: "ejs.slice.missing", field: "ejs", severity: "error", message: "kind 启用 EJS 但缺少 ejs slices" })], { enabled: true }) : skipped({ enabled: false }, "EJS 未启用");
  if (sectionSet.has("regex")) sections.regex = validateRegexSection(project);
  if (sectionSet.has("assets")) sections.assets = validateAssetsSection(project);
  if (sectionSet.has("build")) sections.build = validateBuildSection(options.build);
  if (sectionSet.has("delivery")) sections.delivery = validateDeliverySection(project, sections, options.build, options.export_target);
  if (sectionSet.has("content_policy_delegated")) sections.content_policy_delegated = section({ status: "skipped", ok: true, infos: [normalizeIssue({ code: "content.scope.delegated", field: "content", severity: "info", message: "内容审美、禁词、文风和创作质量由 skill 规则执行，MCP 只校验结构、协议、安全和资产一致性" })], summary: { delegated: true, delegated_to: "world-book-mcp-skill", mcp_policy: "structure_protocol_safety_only" } });
  const counts = summarize(sections);
  const ok = counts.blocking_count === 0;
  const ready_to_export = Boolean(sections.delivery?.ok ?? ok);
  return { ok, ready_to_build: ok, ready_to_export, project_id: project.id, scope_used: scope, generated_at: new Date().toISOString(), build: options.build ? { build_id: options.build.manifest?.build_id, manifest_path: options.build.manifest ? `build/runs/${options.build.manifest.build_id}/manifest.json` : undefined, stale: options.build.stale, stale_reasons: options.build.stale_reasons } : undefined, summary: counts, sections, recommendations: recommendations(project, sections), next_actions: nextActions(sections) };
}

function normalizeProject<T extends Project>(project: T): T {
  if (project.kind) return project;
  return { ...project, schemaVersion: project.schemaVersion ?? 3, slug: project.slug ?? project.id, kind: defaultProjectKind({ output: (project as any).characterCardConfig || (project as any).profile ? "character_card" : "worldbook", source: "original" }) } as T;
}

function validateProjectSection(project: Project): ValidationSection {
  const issues: ValidationIssue[] = [];
  if (project.schemaVersion !== 3) issues.push(normalizeIssue({ code: "project.schema_version", field: "schemaVersion", severity: "error", message: "Project schemaVersion 必须为 3" }));
  if (!project.name?.trim()) issues.push(normalizeIssue({ code: "project.name.empty", field: "name", severity: "error", message: "项目名称不能为空" }));
  if (project.kind.assets.ejs.enabled && !project.kind.assets.mvu.enabled) issues.push(normalizeIssue({ code: "project.ejs_requires_mvu", field: "kind.assets.ejs", severity: "error", message: "EJS enabled 时 MVU 必须 enabled" }));
  return sectionFromIssues(issues, { name: project.name, output: project.kind.output, source: project.kind.source, assets: project.kind.assets });
}
function validatePlanSection(project: Project, delivery = false): ValidationSection {
  const issues: ValidationIssue[] = [];
  const planItems = project.plan.plan_items ?? [];
  const acceptance = project.plan.acceptance_criteria ?? [];
  const verification = project.plan.verification_steps ?? [];
  const blockedItems = planItems.filter((item) => item.status === "blocked");
  const unfinishedItems = planItems.filter((item) => !["done", "skipped"].includes(item.status));
  const severity = delivery ? "error" as const : "warning" as const;
  if (!project.name?.trim()) issues.push(normalizeIssue({ code: "plan.name.empty", field: "name", severity: "error", message: "项目名称不能为空" }));
  if ((project.kind.output === "character_card" || project.kind.output === "both") && !project.opening) issues.push(normalizeIssue({ code: "plan.opening.missing", field: "opening", severity: "error", message: "输出包含角色卡时必须记录 opening 设计" }));
  if (delivery && planItems.length === 0) issues.push(normalizeIssue({ code: "plan.items.missing", field: "plan.plan_items", severity: "error", message: "交付前应记录至少一个结构化 plan item" }));
  if (acceptance.length === 0) issues.push(normalizeIssue({ code: "plan.acceptance.missing", field: "plan.acceptance_criteria", severity, message: "计划应记录验收标准" }));
  if (verification.length === 0) issues.push(normalizeIssue({ code: "plan.verification.missing", field: "plan.verification_steps", severity, message: "计划应记录验证步骤" }));
  for (const item of blockedItems) issues.push(normalizeIssue({ code: "plan.item.blocked", field: `plan.plan_items.${item.id}`, severity, message: `plan item 阻塞：${item.title}` }));
  if (delivery) for (const item of unfinishedItems.filter((item) => item.status !== "blocked")) issues.push(normalizeIssue({ code: "plan.item.unfinished", field: `plan.plan_items.${item.id}`, severity: "error", message: `交付前 plan item 未完成：${item.title}` }));
  return sectionFromIssues(issues, { export_filename: project.plan.export_filename, strict_review: project.plan.strict_review, plan_item_count: planItems.length, blocked_item_count: blockedItems.length, unfinished_item_count: unfinishedItems.length, acceptance_criteria_count: acceptance.length, verification_steps_count: verification.length });
}
function validatePendingDecisions(project: Project, blocking = false): ValidationSection { const issues = project.pendingDecisions.map((d) => normalizeIssue({ code: "decision.pending", field: `pendingDecisions.${d.id}`, severity: blocking ? "error" as const : "warning" as const, message: `存在未解决问题：${d.question}` })); return sectionFromIssues(issues, { pending_count: project.pendingDecisions.length, recorded_count: project.recordedDecisions.length }); }
function validateWorldbookSection(project: Project & { draft?: import("../schemas/worldbook-draft.js").WorldbookDraftEntry[]; mvuConfig?: unknown; htmlBeautifyConfig?: unknown; ejsConfig?: unknown }, exportTarget?: "worldbook" | "character_card" | "both"): ValidationSection { if (project.draft?.length) return validateWorldbookDraft(project.draft); const target = exportTarget ?? project.kind.output; const hasAssetDraft = Boolean(project.mvuConfig || project.htmlBeautifyConfig || project.ejsConfig || project.kind.assets.mvu.enabled || project.kind.assets.html.enabled || project.kind.assets.ejs.enabled || project.kind.assets.regex.enabled); const severity = hasAssetDraft || target === "character_card" || project.kind.output === "character_card" ? "warning" : "error"; return sectionFromIssues([normalizeIssue({ code: "worldbook.empty", field: "draft", severity, message: "没有 active entry slices" })], { active_entry_count: 0 }); }
function validateOpeningSection(project: Project & { characterCardConfig?: import("../schemas/character-card.js").CharacterCardConfig }): ValidationSection { if (project.kind.output === "worldbook") return skipped({ required: false }, "纯世界书项目不需要 opening"); const issues: ValidationIssue[] = []; if (!project.opening) issues.push(normalizeIssue({ code: "opening.missing", field: "opening", severity: "error", message: "缺少开场白剧情设计" })); const first = project.characterCardConfig?.card.first_mes ?? project.greetings?.first_mes ?? ""; if (!first.trim()) issues.push(normalizeIssue({ code: "opening.first_mes.empty", field: "first_mes", severity: "error", message: "first_mes 不能为空" })); const requiresPlaceholder = project.kind.assets.mvu.enabled || project.kind.assets.html.enabled; if (requiresPlaceholder && !first.includes("<StatusPlaceHolderImpl/>")) issues.push(normalizeIssue({ code: "opening.status_placeholder.missing", field: "first_mes", severity: "error", message: "启用 MVU/HTML 状态栏时 first_mes 必须包含 <StatusPlaceHolderImpl/>" })); return sectionFromIssues(issues, { required: true, mode: project.opening?.mode, user_role: project.opening?.user_role, has_premise: Boolean(project.opening?.premise), has_first_mes: Boolean(first.trim()), requires_status_placeholder: requiresPlaceholder, first_mes_has_status_placeholder: first.includes("<StatusPlaceHolderImpl/>") }); }
function validateRegexSection(project: Project & { regexSlices?: Array<{ id: string; data: RegexSliceData }> }): ValidationSection {
  const scripts = (project.regexSlices ?? []).flatMap((slice) => slice.data.scripts.map((script) => ({ ...script, minDepth: script.minDepth ?? null, maxDepth: script.maxDepth ?? null })));
  const result = validateRegexScripts(scripts);
  return sectionFromIssues([...result.errors, ...result.warnings], { enabled: project.kind.assets.regex.enabled, active_slice_count: project.regexSlices?.length ?? project.kind.assets.regex.slice_count, script_count: scripts.length, sources: project.kind.assets.regex.sources });
}
function validateAssetsSection(project: Project): ValidationSection { const issues: ValidationIssue[] = []; if (project.kind.assets.ejs.enabled && !project.kind.assets.mvu.enabled) issues.push(normalizeIssue({ code: "assets.ejs_requires_mvu", field: "kind.assets", severity: "error", message: "EJS 资产依赖 MVU" })); return sectionFromIssues(issues, { mvu_enabled: project.kind.assets.mvu.enabled, html_enabled: project.kind.assets.html.enabled, regex_enabled: project.kind.assets.regex.enabled, ejs_enabled: project.kind.assets.ejs.enabled }); }
function validateBuildSection(build?: { manifest?: BuildManifest; stale?: boolean; stale_reasons?: string[] }): ValidationSection { if (!build?.manifest) return sectionFromIssues([normalizeIssue({ code: "build.missing", field: "build", severity: "warning", message: "尚未生成 build manifest" })], { has_build: false, stale: true, stale_reasons: ["missing build"] }); const issues = build.stale ? [normalizeIssue({ code: "build.stale", field: "build", severity: "error", message: "build manifest 已过期" })] : []; return sectionFromIssues(issues, { has_build: true, build_id: build.manifest.build_id, stale: Boolean(build.stale), stale_reasons: build.stale_reasons ?? [], artifact_count: build.manifest.artifacts.length }); }
function validateDeliverySection(project: Project, sections: Record<string, ValidationSection>, build?: { manifest?: BuildManifest; stale?: boolean; stale_reasons?: string[] }, exportTarget?: "worldbook" | "character_card" | "both"): ValidationSection { const blocking = Object.entries(sections).filter(([key, value]) => key !== "delivery" && value.status === "blocking").map(([key]) => key); const warnings = Object.entries(sections).filter(([key, value]) => key !== "delivery" && value.status === "warning").map(([key]) => key); const issues: ValidationIssue[] = blocking.map((key) => normalizeIssue({ code: `delivery.section.${key}`, field: key, severity: "error", message: `交付前 section=${key} 仍有 blocking` })); if (!build?.manifest) issues.push(normalizeIssue({ code: "delivery.build.missing", field: "build", severity: "error", message: "交付前必须先 build_assets(target='all')" })); if (build?.stale) issues.push(normalizeIssue({ code: "delivery.build.stale", field: "build", severity: "error", message: "交付前 build manifest 必须 fresh" })); return sectionFromIssues(issues, { export_target: exportTarget ?? project.kind.output, ready_to_export: issues.length === 0, blocking_sections: blocking, warning_sections: warnings, build_id: build?.manifest?.build_id }); }
function summarize(sections: Record<string, ValidationSection>) { let blocking_count = 0, warning_count = 0, info_count = 0, skipped_count = 0; for (const value of Object.values(sections)) { blocking_count += value.errors.length; warning_count += value.warnings.length; info_count += value.infos.length; if (value.status === "skipped") skipped_count += 1; } return { blocking_count, warning_count, info_count, skipped_count }; }
function recommendations(project: Project, sections: Record<string, ValidationSection>): string[] { const result: string[] = []; if (sections.build?.status === "warning") result.push("运行 build_assets(target='all') 生成 fresh manifest"); if (sections.pending_decisions?.status === "warning" || sections.pending_decisions?.status === "blocking") result.push("存在未解决问题，请使用 update_plan(mode='record_decision') 记录决策"); if (project.kind.assets.ejs.enabled && !project.kind.assets.mvu.enabled) result.push("启用 EJS 前先创建并启用 MVU slice"); return result; }
function nextActions(sections: Record<string, ValidationSection>): Array<{ tool: string; reason: string }> { const actions: Array<{ tool: string; reason: string }> = []; if (sections.worldbook?.status === "blocking") actions.push({ tool: "update_entry_content/update_entry_config", reason: "修复世界书条目" }); if (sections.build?.status !== "ok") actions.push({ tool: "build_assets", reason: "生成或刷新 build manifest" }); if (sections.delivery?.status === "blocking") actions.push({ tool: "validate_project(scope='delivery')", reason: "检查交付 gate" }); return actions; }
