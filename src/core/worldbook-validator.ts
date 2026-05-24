import type { WorldbookDraftEntry } from "../schemas/worldbook-draft.js";
import { lintContent } from "./content-lint.js";

export interface ValidationIssue {
  entry?: string;
  field?: string;
  severity: "error" | "warning";
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: {
    entry_count: number;
    constant_count: number;
    triggered_count: number;
  };
}

// 拆分关键词字符串时不应混用以下分隔符：
// - 中文逗号 ，(U+FF0C)
// - 中文顿号 、(U+3001)
// - 中文分号 ；(U+FF1B)
// - 英文分号 ;
// 英文逗号 , 单独由 COMMA_IN_KEY 检测并以 warning 形式提示，因为它是最常见的"把多个触发词写在同一字符串"误用。
const BAD_KEY_SEPARATORS = /[，、；;]/;
const COMMA_IN_KEY = /,/;

export function validateWorldbookDraft(entries: WorldbookDraftEntry[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  const orderSeen = new Map<string, string>();
  const commentSeen = new Set<string>();
  const keySeen = new Map<string, string>();

  if (entries.length === 0) {
    issues.push({ field: "entries", severity: "error", message: "entries 不能为空" });
  }

  for (const entry of entries) {
    if (!entry.comment.trim()) {
      issues.push({ entry: entry.comment, field: "comment", severity: "error", message: "comment 不能为空" });
    } else if (commentSeen.has(entry.comment)) {
      issues.push({ entry: entry.comment, field: "comment", severity: "warning", message: "comment 重复，后续按 comment 更新时可能定位不明确" });
    } else {
      commentSeen.add(entry.comment);
    }
    if (!entry.content.trim()) {
      issues.push({ entry: entry.comment, field: "content", severity: "error", message: "content 不能为空" });
    }
    if (!entry.preventRecursion) {
      issues.push({ entry: entry.comment, field: "preventRecursion", severity: "error", message: "preventRecursion 必须为 true" });
    }
    if (!entry.excludeRecursion) {
      issues.push({ entry: entry.comment, field: "excludeRecursion", severity: "error", message: "excludeRecursion 必须为 true" });
    }
    if (!entry.constant && entry.keys.length === 0) {
      issues.push({ entry: entry.comment, field: "keys", severity: "error", message: "绿灯条目 constant=false 时必须提供 keys" });
    }
    if (entry.constant && entry.scanDepth !== undefined) {
      issues.push({ entry: entry.comment, field: "scanDepth", severity: "warning", message: "蓝灯条目通常不需要 scanDepth" });
    }
    if (!entry.constant && entry.scanDepth === undefined) {
      issues.push({ entry: entry.comment, field: "scanDepth", severity: "warning", message: "绿灯条目建议设置 scanDepth=2" });
    }
    for (const key of entry.keys) {
      const normalizedKey = key.trim();
      if (!normalizedKey) {
        issues.push({ entry: entry.comment, field: "keys", severity: "error", message: "关键词不能为空白字符串" });
        continue;
      }
      if (BAD_KEY_SEPARATORS.test(key)) {
        issues.push({ entry: entry.comment, field: "keys", severity: "error", message: `关键词包含中文或错误分隔符: ${key}`, suggestion: "使用数组或英文逗号分隔后的独立字符串" });
      }
      if (COMMA_IN_KEY.test(key)) {
        issues.push({ entry: entry.comment, field: "keys", severity: "warning", message: `关键词疑似把多个触发词写在同一字符串中: ${key}`, suggestion: "请拆成数组中的多个独立字符串，例如 [\"A\", \"B\"]" });
      }
      const previousEntry = keySeen.get(normalizedKey);
      if (previousEntry && previousEntry !== entry.comment) {
        issues.push({ entry: entry.comment, field: "keys", severity: "warning", message: `关键词 ${normalizedKey} 已在 ${previousEntry} 中出现，可能导致多条目同时触发` });
      } else {
        keySeen.set(normalizedKey, entry.comment);
      }
    }
    if (!Number.isInteger(entry.order)) {
      issues.push({ entry: entry.comment, field: "order", severity: "warning", message: "order 建议使用整数" });
    }
    if (entry.position === "at_depth" && entry.depth === undefined) {
      issues.push({ entry: entry.comment, field: "depth", severity: "warning", message: "at_depth 应显式设置 depth=0" });
    }
    if (entry.position === "at_depth" && entry.depth !== 0) {
      issues.push({ entry: entry.comment, field: "depth", severity: "warning", message: "at_depth 推荐只使用 depth=0", suggestion: "普通世界观不要使用 D1 及以上深度" });
    }
    if (entry.position === "outlet") {
      // outlet 位置在导出后大概率失效（SillyTavern 内部用法不公开稳定），但 schema 仍接受 outlet 是
      // 为了让 character-card-importer 能无损读回真实酒馆 JSON。
      // 因此这里升级为 error：导入后请改成 before_char/after_char/at_depth 等明确位置。
      issues.push({ entry: entry.comment, field: "position", severity: "error", message: "position=outlet 导出后通常无效，请改用 before_char/after_char/at_depth 等位置；保留 outlet 仅用于无损读回原始酒馆 JSON" });
    }
    if (looksLikeJson(entry.content)) {
      issues.push({ entry: entry.comment, field: "content", severity: "warning", message: "content 疑似纯 JSON，世界书条目建议使用 XML 包裹 YAML 或自然语言 YAML" });
    }
    if (containsYamlDocSeparator(entry.content)) {
      issues.push({
        entry: entry.comment,
        field: "content",
        severity: "error",
        message: "content 不能包含 YAML 文档分隔符 `---`，请改用 XML 标签包裹 YAML 内容",
        suggestion: "把 `---\\nfoo: bar` 改写成 `<your_tag>\\nfoo: bar\\n</your_tag>`",
      });
    }
    if (needsXml(entry.entryType) && !hasXmlWrapper(entry.content)) {
      issues.push({ entry: entry.comment, field: "content", severity: "warning", message: `${entry.entryType} 建议使用 XML 包裹 YAML` });
    }

    const orderKey = `${entry.position}:${entry.order}`;
    const previous = orderSeen.get(orderKey);
    if (previous) {
      issues.push({ entry: entry.comment, field: "order", severity: "warning", message: `order 与 ${previous} 在同一 position 中重复` });
    } else {
      orderSeen.set(orderKey, entry.comment);
    }

    const lint = lintContent(entry.content);
    for (const lintIssue of lint.issues) {
      issues.push({
        entry: entry.comment,
        field: "content",
        severity: lintIssue.severity,
        message: lintIssue.term ? `文本问题：${lintIssue.term}` : lintIssue.message,
        suggestion: lintIssue.suggestion,
      });
    }
  }

  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      entry_count: entries.length,
      constant_count: entries.filter((entry) => entry.constant).length,
      triggered_count: entries.filter((entry) => !entry.constant).length,
    },
  };
}

function looksLikeJson(content: string): boolean {
  const trimmed = content.trim();
  return (trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"));
}

/**
 * 检测 content 是否包含 YAML 文档分隔符 `---`（独占一行）。
 * 世界书条目按 skill 规范必须用 XML 包裹 YAML，禁止裸出现 `---` 分隔符。
 */
function containsYamlDocSeparator(content: string): boolean {
  if (!content) return false;
  return /(^|\r?\n)[ \t]*---[ \t]*(?:\r?\n|$)/.test(content);
}

function hasXmlWrapper(content: string): boolean {
  return /^\s*<([a-zA-Z_][\w-]*)>[\s\S]*<\/\1>\s*$/.test(content);
}

function needsXml(entryType: string): boolean {
  return !["world_summary", "background"].includes(entryType);
}
