export type ValidationSeverity = "error" | "warning" | "info";
export type ValidationStatus = "ok" | "warning" | "blocking" | "skipped";

export interface ValidationIssue {
  code: string;
  field: string;
  severity: ValidationSeverity;
  message: string;
  suggestion?: string;
  related_tools?: string[];
  entry?: string;
  related_slice?: { type: string; id: string };
  related_artifact?: { build_id?: string; target?: string; path?: string };
}

export interface ValidationSection<TSummary = unknown> {
  status: ValidationStatus;
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  infos: ValidationIssue[];
  summary: TSummary;
}

export interface ProjectValidationReport {
  ok: boolean;
  ready_to_build: boolean;
  ready_to_export: boolean;
  project_id: string;
  scope_used: ProjectValidationScope;
  generated_at: string;
  build?: { build_id?: string; manifest_path?: string; stale?: boolean; stale_reasons?: string[] };
  summary: { blocking_count: number; warning_count: number; info_count: number; skipped_count: number };
  sections: Record<string, ValidationSection>;
  recommendations: string[];
  next_actions: Array<{ tool: string; reason: string }>;
  strict?: { mode: string; upgraded_count: number; upgraded: Array<{ section: string; code: string; field: string; message: string }> };
}

export type ProjectValidationScope = "all" | "project" | "plan" | "worldbook" | "character_card" | "opening" | "mvu" | "html" | "regex" | "ejs" | "assets" | "build" | "delivery" | "content";

export const ALL_SECTION_KEYS = ["project", "plan", "pending_decisions", "worldbook", "character_card", "opening", "mvu", "html", "regex", "ejs", "assets", "build", "delivery", "content_policy_delegated"] as const;

export function issue(input: Omit<ValidationIssue, "code"> & { code?: string }): ValidationIssue {
  return { ...input, code: input.code ?? defaultCode(input.severity, input.field) };
}

export function normalizeIssue(input: {
  field?: string;
  entry?: string;
  severity: ValidationSeverity;
  message: string;
  suggestion?: string;
  related_tools?: string[];
  code?: string;
  related_slice?: { type: string; id: string };
  related_artifact?: { build_id?: string; target?: string; path?: string };
}): ValidationIssue {
  return issue({
    code: input.code,
    field: input.field ?? input.entry ?? "unknown",
    entry: input.entry,
    severity: input.severity,
    message: input.message,
    suggestion: input.suggestion,
    related_tools: input.related_tools,
    related_slice: input.related_slice,
    related_artifact: input.related_artifact,
  });
}

export function section<TSummary>(input: {
  errors?: ValidationIssue[];
  warnings?: ValidationIssue[];
  infos?: ValidationIssue[];
  summary: TSummary;
  ok?: boolean;
  status?: ValidationStatus;
}): ValidationSection<TSummary> {
  const errors = input.errors ?? [];
  const warnings = input.warnings ?? [];
  const infos = input.infos ?? [];
  const status = input.status ?? (errors.length > 0 ? "blocking" : warnings.length > 0 ? "warning" : "ok");
  return { status, ok: input.ok ?? status !== "blocking", errors, warnings, infos, summary: input.summary };
}

export function skipped<TSummary>(summary: TSummary, message?: string): ValidationSection<TSummary> {
  return section({ status: "skipped", ok: true, summary, infos: message ? [normalizeIssue({ code: "section.skipped", field: "scope", severity: "info", message })] : [] });
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

export function sectionStatus(value: ValidationSection | undefined, fallback: ValidationStatus = "warning"): ValidationStatus {
  if (!value) return fallback;
  return value.status;
}

export function withValid<T extends ValidationSection>(value: T): T & { valid: boolean } {
  return { ...value, valid: value.ok };
}

function defaultCode(severity: ValidationSeverity, field: string): string {
  return `${severity}.${field.replace(/[^a-zA-Z0-9_$.-]+/g, "_")}`;
}
