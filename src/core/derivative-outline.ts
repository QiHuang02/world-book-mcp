import type { DerivativeExtractionOutline, DerivativeFocus, DerivativeSourceKind } from "../schemas/derivative-outline.js";
import type { ExtractionResult } from "../schemas/extraction.js";
import type { ValidationIssue } from "./worldbook-validator.js";

const CHARACTER_DIMENSIONS = ["basic_first_appearance", "appearance", "identity", "personality_evidence", "key_events", "relationships", "abilities_items", "chapter_appearances"] as const;
const WORLD_DIMENSIONS = ["geography", "history", "factions", "rules", "society"] as const;

export function createDerivativeExtractionTemplate(input: { title?: string; source_kind?: DerivativeSourceKind; focus?: DerivativeFocus[] } = {}): DerivativeExtractionOutline {
  const focus = input.focus ?? ["characters", "world", "items", "events"];
  return {
    title: input.title ?? "二创提取大纲",
    source_kind: input.source_kind ?? "mixed",
    focus,
    chapter_index: [{ chapter: "第1章", startLine: 1, endLine: 1, summary: "" }],
    character_overview: ["角色名：一句话形象。出场章节：第X章"],
    characters: focus.includes("characters") ? [{
      name: "角色名",
      aliases: [],
      one_line_profile: "",
      appearance_chapters: [],
      dimensions: CHARACTER_DIMENSIONS.map((dimension) => ({ dimension, technique_summary: "", source_quotes: [], forbidden_terms_notes: [], extracted_result: "", sourceRefs: [] })),
    }] : [],
    world_type: focus.includes("world") ? "B" : undefined,
    world_dimensions: focus.includes("world") ? WORLD_DIMENSIONS.map((dimension) => ({ dimension, technique_summary: "", source_quotes: [], extracted_result: "", sourceRefs: [] })) : [],
    important_chapters: [],
    planned_entries: [],
    notes: ["原文未提及的信息请标记 // 原文未提及，不要脑补", "条目编写前应按 dependency_chapters 复核对应素材"],
  };
}

export function validateDerivativeExtractionOutline(outline: DerivativeExtractionOutline): { valid: boolean; errors: ValidationIssue[]; warnings: ValidationIssue[]; summary: { character_count: number; planned_entry_count: number; chapter_count: number } } {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (outline.chapter_index.length === 0 && outline.source_kind !== "web_research") {
    warnings.push({ field: "chapter_index", severity: "warning", message: "非纯网页研究素材建议提供章节行号索引" });
  }
  for (const chapter of outline.chapter_index) {
    if (chapter.endLine < chapter.startLine) errors.push({ field: `chapter_index.${chapter.chapter}`, severity: "error", message: "章节 endLine 不能小于 startLine" });
  }

  if (outline.focus.includes("characters") && outline.characters.length === 0) {
    warnings.push({ field: "characters", severity: "warning", message: "focus 包含 characters，但未提供角色提取" });
  }
  outline.characters.forEach((character, index) => {
    const dimensions = new Set(character.dimensions.map((item) => item.dimension));
    for (const dimension of CHARACTER_DIMENSIONS) {
      if (!dimensions.has(dimension)) warnings.push({ field: `characters.${index}.dimensions`, severity: "warning", message: `${character.name} 缺少 ${dimension} 维度` });
    }
    character.dimensions.forEach((dimension, dimensionIndex) => {
      if (!dimension.extracted_result.trim()) warnings.push({ field: `characters.${index}.dimensions.${dimensionIndex}.extracted_result`, severity: "warning", message: `${character.name}/${dimension.dimension} 提取结果为空` });
      if (dimension.source_quotes.length === 0 && outline.source_kind !== "web_research") warnings.push({ field: `characters.${index}.dimensions.${dimensionIndex}.source_quotes`, severity: "warning", message: `${character.name}/${dimension.dimension} 建议保留原始例句或行号` });
    });
  });

  if (outline.focus.includes("world")) {
    if (!outline.world_type) warnings.push({ field: "world_type", severity: "warning", message: "世界观提取建议判定 A/B/C 类型" });
    const dimensions = new Set(outline.world_dimensions.map((item) => item.dimension));
    for (const dimension of WORLD_DIMENSIONS) {
      if (!dimensions.has(dimension)) warnings.push({ field: "world_dimensions", severity: "warning", message: `缺少世界观维度 ${dimension}` });
    }
  }

  if (outline.planned_entries.length === 0) {
    warnings.push({ field: "planned_entries", severity: "warning", message: "建议提供条目规划表，包含依赖章节" });
  }
  outline.planned_entries.forEach((entry, index) => {
    if (entry.activation === "keyword" && entry.dependency_chapters.length === 0) warnings.push({ field: `planned_entries.${index}.dependency_chapters`, severity: "warning", message: `${entry.comment} 建议标明依赖章节，便于编写前复核` });
  });

  return { valid: errors.length === 0, errors, warnings, summary: { character_count: outline.characters.length, planned_entry_count: outline.planned_entries.length, chapter_count: outline.chapter_index.length } };
}

export function derivativeOutlineToExtraction(projectId: string, outline: DerivativeExtractionOutline): ExtractionResult {
  return {
    projectId,
    title: outline.title,
    characters: outline.characters.map((character) => ({
      name: character.name,
      aliases: character.aliases,
      firstAppearance: character.dimensions.find((item) => item.dimension === "basic_first_appearance")?.extracted_result,
      appearance: splitLines(character.dimensions.find((item) => item.dimension === "appearance")?.extracted_result),
      identity: character.dimensions.find((item) => item.dimension === "identity")?.extracted_result,
      personalityEvidence: splitLines(character.dimensions.find((item) => item.dimension === "personality_evidence")?.extracted_result),
      keyEvents: splitLines(character.dimensions.find((item) => item.dimension === "key_events")?.extracted_result),
      relationships: splitLines(character.dimensions.find((item) => item.dimension === "relationships")?.extracted_result),
      abilities: splitLines(character.dimensions.find((item) => item.dimension === "abilities_items")?.extracted_result),
      sourceRefs: character.dimensions.flatMap((item) => item.sourceRefs),
    })),
    world: outline.world_dimensions.map((dimension) => ({ name: dimension.dimension, type: worldTypeMap(dimension.dimension), facts: splitLines(dimension.extracted_result), sourceRefs: dimension.sourceRefs })),
    items: [],
    events: outline.important_chapters.map((chapter) => ({ name: chapter.chapter, summary: chapter.reason, participants: [], sourceRefs: [] })),
    sourceRefs: [],
  };
}

function splitLines(value: string | undefined): string[] {
  return (value ?? "").split(/\n|；|;/).map((item) => item.trim()).filter(Boolean);
}

function worldTypeMap(dimension: string): ExtractionResult["world"][number]["type"] {
  if (dimension === "geography") return "geography";
  if (dimension === "history") return "history";
  if (dimension === "factions") return "faction";
  if (dimension === "rules") return "rule";
  if (dimension === "society") return "society";
  return "other";
}
