import type { StyleProfile } from "../schemas/style-profile.js";
import type { WorldbookDraftEntry } from "../schemas/worldbook-draft.js";

export function createStyleExtractionTemplate(): { profile: StyleProfile; rules: string[] } {
  return {
    profile: {
      narrative_perspective: "third_person_limited",
      tense: "present",
      sentence_length: "varied",
      dialogue_ratio: "medium",
      description_focus: [],
      rhythm: "",
      signature_techniques: [],
      forbidden_terms: [],
      forbidden_patterns: [],
      positive_rules: [],
      negative_rules: [],
      notes: [],
    },
    rules: [
      "提取文风时只写写作规则与负面约束，不要复制大段原文",
      "比喻禁词、量子词、感官标签由 writing-optimization 体系统一禁用",
      "positive_rules 描述应做的事，negative_rules 描述禁止的事",
      "rhythm 用一句话描述节奏感，例如 短句多/对话穿插/动作密集",
    ],
  };
}

export function buildStyleWorldbookEntries(profile: StyleProfile, options: { include_forbidden_entry?: boolean; comment_prefix?: string } = {}): { worldbookEntries: WorldbookDraftEntry[] } {
  const prefix = options.comment_prefix ?? "文风";
  const entries: WorldbookDraftEntry[] = [];

  entries.push({
    comment: `${prefix}_主规则`,
    entryType: "other",
    keys: [],
    secondaryKeys: [],
    content: renderMainRules(profile),
    constant: true,
    position: "before_an",
    order: 1,
    enabled: true,
    preventRecursion: true,
    excludeRecursion: true,
  });

  if (profile.signature_techniques.length > 0) {
    entries.push({
      comment: `${prefix}_技法`,
      entryType: "other",
      keys: [],
      secondaryKeys: [],
      content: renderTechniques(profile),
      constant: true,
      position: "before_an",
      order: 2,
      enabled: true,
      preventRecursion: true,
      excludeRecursion: true,
    });
  }

  if ((options.include_forbidden_entry ?? true) && (profile.forbidden_terms.length > 0 || profile.forbidden_patterns.length > 0 || profile.negative_rules.length > 0)) {
    entries.push({
      comment: `${prefix}_禁律`,
      entryType: "other",
      keys: [],
      secondaryKeys: [],
      content: renderForbidden(profile),
      constant: true,
      position: "before_an",
      order: 3,
      enabled: true,
      preventRecursion: true,
      excludeRecursion: true,
    });
  }

  return { worldbookEntries: entries };
}

function renderMainRules(profile: StyleProfile): string {
  return `<style_rules>\nperspective: ${profile.narrative_perspective}\ntense: ${profile.tense}\nsentence_length: ${profile.sentence_length}\ndialogue_ratio: ${profile.dialogue_ratio}\nrhythm: ${profile.rhythm || "未指定"}\ndescription_focus:\n${list(profile.description_focus)}positive_rules:\n${list(profile.positive_rules)}</style_rules>`;
}

function renderTechniques(profile: StyleProfile): string {
  return `<style_techniques>\nsignature_techniques:\n${list(profile.signature_techniques)}notes:\n${list(profile.notes)}</style_techniques>`;
}

function renderForbidden(profile: StyleProfile): string {
  return `<style_forbidden>\nforbidden_terms:\n${list(profile.forbidden_terms)}forbidden_patterns:\n${list(profile.forbidden_patterns)}negative_rules:\n${list(profile.negative_rules)}</style_forbidden>`;
}

function list(items: string[]): string {
  if (items.length === 0) return "  - 待补充\n";
  return items.map((item) => `  - ${item}`).join("\n") + "\n";
}
