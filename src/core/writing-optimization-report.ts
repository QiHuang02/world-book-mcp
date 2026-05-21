import type { Project } from "../schemas/project.js";
import { lintContent, type ContentLintIssue } from "./content-lint.js";
import { lintProjectContent } from "./project-lint.js";

export interface WritingOptimizationReport {
  ok: boolean;
  summary: {
    total: number;
    errors: number;
    warnings: number;
    by_category: Record<string, number>;
  };
  issues: Array<ContentLintIssue & { path?: string }>;
  suggestions: string[];
}

export function createWritingOptimizationReport(input: { content?: string; project?: Project }): WritingOptimizationReport {
  const issues: Array<ContentLintIssue & { path?: string }> = [];
  if (input.content !== undefined) {
    issues.push(...lintContent(input.content).issues);
  }
  if (input.project) {
    issues.push(...lintProjectContent(input.project).issues);
  }
  const by_category: Record<string, number> = {};
  for (const issue of issues) {
    const category = issue.category ?? issue.type;
    by_category[category] = (by_category[category] ?? 0) + 1;
  }
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  return {
    ok: errors === 0,
    summary: { total: issues.length, errors, warnings, by_category },
    issues,
    suggestions: [...new Set(issues.map((issue) => issue.suggestion).filter((item): item is string => Boolean(item)))],
  };
}
