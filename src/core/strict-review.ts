import type { Project } from "../schemas/project.js";
import type { ProjectValidationReport, ValidationIssue, ValidationSection } from "./validation-types.js";

export type StrictReviewMode = "off" | "standard" | "strict";

export interface StrictReviewResult {
  mode: StrictReviewMode;
  upgraded_count: number;
  upgraded: Array<{ section: string; code: string; field: string; message: string }>;
}

const STANDARD_BLOCKING_CODES = [
  /^pending_decisions\./,
  /^character_card\.description\.not_empty$/,
  /^first_mes\./,
  /^ejs\.stage\.enabled$/,
  /^ejs\.getwi\.stage_enabled$/,
];

export function resolveStrictReviewMode(input: { strict?: boolean | StrictReviewMode; strict_review?: boolean | StrictReviewMode; project?: Project }): StrictReviewMode {
  const raw = input.strict_review ?? input.strict ?? input.project?.plan.strict_review;
  if (raw === true) return "standard";
  if (raw === false || raw === undefined) return "off";
  return raw;
}

export function applyStrictReview(report: ProjectValidationReport, mode: StrictReviewMode): ProjectValidationReport {
  const strict = collectStrictUpgrades(report, mode);
  const ready_to_export = report.ready_to_export && strict.upgraded_count === 0;
  return { ...report, ready_to_export, strict };
}

export function collectStrictUpgrades(report: ProjectValidationReport, mode: StrictReviewMode): StrictReviewResult {
  if (mode === "off") return { mode, upgraded_count: 0, upgraded: [] };
  const upgraded: StrictReviewResult["upgraded"] = [];
  for (const [sectionName, section] of Object.entries(report.sections)) {
    for (const warning of section.warnings) {
      if (shouldUpgrade(sectionName, warning, mode)) {
        upgraded.push({ section: sectionName, code: warning.code, field: warning.field, message: warning.message });
      }
    }
  }
  return { mode, upgraded_count: upgraded.length, upgraded };
}

export function strictSectionStatus(sectionName: string, section: ValidationSection | undefined, mode: StrictReviewMode): "ok" | "warning" | "blocking" {
  if (!section) return "warning";
  if (section.errors.length > 0) return "blocking";
  if (mode !== "off" && section.warnings.some((warning) => shouldUpgrade(sectionName, warning, mode))) return "blocking";
  if (section.warnings.length > 0) return "warning";
  return "ok";
}

function shouldUpgrade(_sectionName: string, issue: ValidationIssue, mode: StrictReviewMode): boolean {
  if (mode === "strict") return true;
  if (mode === "standard") return STANDARD_BLOCKING_CODES.some((pattern) => pattern.test(issue.code));
  return false;
}

declare module "./validation-types.js" {
  interface ProjectValidationReport {
    strict?: StrictReviewResult;
  }
}
