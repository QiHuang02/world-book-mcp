import type { Project } from "../schemas/project.js";
import { lintContent, type ContentLintIssue } from "./content-lint.js";

export interface ProjectLintTargetIssue extends ContentLintIssue {
  path: string;
}

export interface ProjectLintResult {
  ok: boolean;
  issues: ProjectLintTargetIssue[];
  summary: {
    scanned_target_count: number;
    error_count: number;
    warning_count: number;
  };
}

interface LintTarget {
  path: string;
  content: string;
}

export function lintProjectContent(project: Project): ProjectLintResult {
  const targets = collectTargets(project);
  const issues: ProjectLintTargetIssue[] = [];

  for (const target of targets) {
    const result = lintContent(target.content);
    issues.push(...result.issues.map((issue) => ({ ...issue, path: target.path })));
  }

  const error_count = issues.filter((issue) => issue.severity === "error").length;
  const warning_count = issues.filter((issue) => issue.severity === "warning").length;
  return {
    ok: error_count === 0,
    issues,
    summary: {
      scanned_target_count: targets.length,
      error_count,
      warning_count,
    },
  };
}

function collectTargets(project: Project): LintTarget[] {
  const targets: LintTarget[] = [];
  project.draft?.forEach((entry, index) => {
    targets.push({ path: `draft.${index}.${entry.comment}.content`, content: entry.content });
  });

  const card = project.characterCardConfig?.card;
  if (card) {
    targets.push({ path: "characterCardConfig.card.first_mes", content: card.first_mes });
    card.alternate_greetings.forEach((greeting, index) => {
      targets.push({ path: `characterCardConfig.card.alternate_greetings.${index}`, content: greeting });
    });
    for (const field of ["personality", "scenario", "creator_notes", "system_prompt", "post_history_instructions"] as const) {
      if (card[field]) targets.push({ path: `characterCardConfig.card.${field}`, content: card[field] });
    }
  }

  if (project.mvuConfig) {
    targets.push({ path: "mvuConfig.update_rules", content: project.mvuConfig.update_rules });
    targets.push({ path: "mvuConfig.output_format", content: project.mvuConfig.output_format ?? "" });
  }

  if (project.ejsConfig) {
    project.ejsConfig.entries.forEach((entry, index) => {
      targets.push({ path: `ejsConfig.entries.${index}.${entry.name}.content`, content: entry.content });
    });
  }

  if (project.htmlBeautifyConfig) {
    targets.push({ path: "htmlBeautifyConfig.statusbar.html", content: project.htmlBeautifyConfig.statusbar.html });
    project.htmlBeautifyConfig.global.regex_scripts.forEach((script, index) => {
      targets.push({ path: `htmlBeautifyConfig.global.regex_scripts.${index}.replaceString`, content: script.replaceString });
    });
  }

  return targets.filter((target) => target.content.trim());
}
