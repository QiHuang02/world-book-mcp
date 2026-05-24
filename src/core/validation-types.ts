export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  code: string;
  field: string;
  severity: ValidationSeverity;
  message: string;
  suggestion?: string;
  related_tools?: string[];
  entry?: string;
}

export interface ValidationSection<TSummary = unknown> {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  infos: ValidationIssue[];
  summary: TSummary;
}

export interface ProjectValidationReport {
  ok: boolean;
  ready_to_export: boolean;
  scope_used: ProjectValidationScope;
  sections: Record<string, ValidationSection>;
  recommendations: string[];
}

export type ProjectValidationScope = "all" | "plan" | "worldbook" | "character_card" | "mvu" | "ejs" | "html" | "assets" | "content" | "delivery" | "style" | "chapter";

/**
 * 每个 scope 实际产出的 section keys。供调用方查阅。
 *
 * - `plan` 同时写入 `plan` 与 `pending_decisions`：plan 只检查项目元数据，pending_decisions
 *   作为未解决决策的唯一来源（warning），交付期由 delivery checklist 升级为 blocking。
 * - `content` 写入 `content_lint` 与 `writing_optimization`，没有同名 `content` section。
 * - `delivery` 包含 plan/worldbook/character_card/mvu/ejs/html/content 全部相关 section，
 *   并参与 ready_to_export 真值判断。
 */
export const SCOPE_SECTIONS: Record<ProjectValidationScope, readonly string[]> = {
  all: ["plan", "pending_decisions", "worldbook", "character_card", "mvu", "ejs", "html", "content_lint", "writing_optimization", "assets", "style", "chapter"],
  plan: ["plan", "pending_decisions"],
  worldbook: ["worldbook"],
  character_card: ["character_card"],
  mvu: ["mvu"],
  ejs: ["ejs"],
  html: ["html"],
  assets: ["assets"],
  content: ["content_lint", "writing_optimization"],
  delivery: ["plan", "pending_decisions", "worldbook", "character_card", "mvu", "ejs", "html", "content_lint", "writing_optimization"],
  style: ["style"],
  chapter: ["chapter"],
};

export function issue(input: Omit<ValidationIssue, "code"> & { code?: string }): ValidationIssue {
  return { code: input.code ?? defaultCode(input.severity, input.field), ...input };
}

export function section<TSummary>(input: {
  errors?: ValidationIssue[];
  warnings?: ValidationIssue[];
  infos?: ValidationIssue[];
  summary: TSummary;
  ok?: boolean;
}): ValidationSection<TSummary> {
  const errors = input.errors ?? [];
  const warnings = input.warnings ?? [];
  const infos = input.infos ?? [];
  return { ok: input.ok ?? errors.length === 0, errors, warnings, infos, summary: input.summary };
}

export function emptySection<TSummary>(summary: TSummary): ValidationSection<TSummary> {
  return section({ summary });
}

export function normalizeIssue(input: {
  field?: string;
  entry?: string;
  severity: "error" | "warning" | "info";
  message: string;
  suggestion?: string;
  related_tools?: string[];
  code?: string;
}): ValidationIssue {
  return issue({
    code: input.code,
    field: input.field ?? input.entry ?? "unknown",
    entry: input.entry,
    severity: input.severity,
    message: input.message,
    suggestion: input.suggestion,
    related_tools: input.related_tools,
  });
}

export function splitIssues(issues: ValidationIssue[]): Pick<ValidationSection, "errors" | "warnings" | "infos"> {
  return {
    errors: issues.filter((item) => item.severity === "error"),
    warnings: issues.filter((item) => item.severity === "warning"),
    infos: issues.filter((item) => item.severity === "info"),
  };
}

export function sectionFromIssues<TSummary>(issues: ValidationIssue[], summary: TSummary): ValidationSection<TSummary> {
  return section({ ...splitIssues(issues), summary });
}

/** 把一个 section 包装成兼容旧 `valid` 字段的对象，给仍然以 `valid` 为契约的 validator 出口使用。 */
export function withValid<T extends ValidationSection>(value: T): T & { valid: boolean } {
  return { ...value, valid: value.ok };
}

export function sectionStatus(section: ValidationSection | undefined, fallback: "ok" | "warning" | "blocking" = "warning"): "ok" | "warning" | "blocking" {
  if (!section) return fallback;
  if (section.errors.length > 0) return "blocking";
  if (section.warnings.length > 0) return "warning";
  return "ok";
}

function defaultCode(severity: ValidationSeverity, field: string): string {
  return `${severity}.${field.replace(/[^a-zA-Z0-9_$.-]+/g, "_")}`;
}
