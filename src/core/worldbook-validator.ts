import type { WorldbookDraftEntry } from "../schemas/worldbook-draft.js";
import { normalizeIssue, section, splitIssues, withValid, type ValidationIssue, type ValidationSection } from "./validation-types.js";

export type WorldbookValidationResult = ValidationSection<{ entry_count: number; constant_count: number; triggered_count: number }> & { valid: boolean };
const BAD_KEY_SEPARATORS = /[，、；;]/;
const COMMA_IN_KEY = /,/;

export function validateWorldbookDraft(entries: WorldbookDraftEntry[]): WorldbookValidationResult {
  const issues: ValidationIssue[] = [];
  const orderSeen = new Map<string, string>();
  const commentSeen = new Set<string>();
  const keySeen = new Map<string, string>();
  if (entries.length === 0) issues.push(normalizeIssue({ field: "entries", severity: "error", message: "entries 不能为空" }));
  for (const entry of entries) {
    if (!entry.comment.trim()) issues.push(normalizeIssue({ entry: entry.comment, field: "comment", severity: "error", message: "comment 不能为空" }));
    else if (commentSeen.has(entry.comment)) issues.push(normalizeIssue({ entry: entry.comment, field: "comment", severity: "warning", message: "comment 重复，后续按 comment 更新时可能定位不明确" })); else commentSeen.add(entry.comment);
    if (!entry.content.trim()) issues.push(normalizeIssue({ entry: entry.comment, field: "content", severity: "error", message: "content 不能为空" }));
    if (!entry.preventRecursion) issues.push(normalizeIssue({ entry: entry.comment, field: "preventRecursion", severity: "error", message: "preventRecursion 必须为 true" }));
    if (!entry.excludeRecursion) issues.push(normalizeIssue({ entry: entry.comment, field: "excludeRecursion", severity: "error", message: "excludeRecursion 必须为 true" }));
    if (!entry.constant && entry.keys.length === 0) issues.push(normalizeIssue({ entry: entry.comment, field: "keys", severity: "error", message: "绿灯条目 constant=false 时必须提供 keys" }));
    if (entry.constant && entry.scanDepth !== undefined) issues.push(normalizeIssue({ entry: entry.comment, field: "scanDepth", severity: "warning", message: "蓝灯条目通常不需要 scanDepth" }));
    if (!entry.constant && entry.scanDepth === undefined) issues.push(normalizeIssue({ entry: entry.comment, field: "scanDepth", severity: "warning", message: "绿灯条目建议设置 scanDepth=2" }));
    for (const key of entry.keys) {
      const normalizedKey = key.trim();
      if (!normalizedKey) { issues.push(normalizeIssue({ entry: entry.comment, field: "keys", severity: "error", message: "关键词不能为空白字符串" })); continue; }
      if (BAD_KEY_SEPARATORS.test(key)) issues.push(normalizeIssue({ entry: entry.comment, field: "keys", severity: "error", message: `关键词包含中文或错误分隔符: ${key}`, suggestion: "使用数组中的独立字符串" }));
      if (COMMA_IN_KEY.test(key)) issues.push(normalizeIssue({ entry: entry.comment, field: "keys", severity: "warning", message: `关键词疑似把多个触发词写在同一字符串中: ${key}`, suggestion: "请拆成数组中的多个独立字符串" }));
      const previousEntry = keySeen.get(normalizedKey);
      if (previousEntry && previousEntry !== entry.comment) issues.push(normalizeIssue({ entry: entry.comment, field: "keys", severity: "warning", message: `关键词 ${normalizedKey} 已在 ${previousEntry} 中出现，可能导致多条目同时触发` })); else keySeen.set(normalizedKey, entry.comment);
    }
    if (!Number.isInteger(entry.order)) issues.push(normalizeIssue({ entry: entry.comment, field: "order", severity: "warning", message: "order 建议使用整数" }));
    if (entry.position === "at_depth" && entry.depth === undefined) issues.push(normalizeIssue({ entry: entry.comment, field: "depth", severity: "warning", message: "at_depth 应显式设置 depth=0" }));
    if (entry.position === "at_depth" && entry.depth !== undefined && entry.depth !== 0) issues.push(normalizeIssue({ entry: entry.comment, field: "depth", severity: "warning", message: "at_depth 推荐只使用 depth=0" }));
    if (entry.position === "outlet") issues.push(normalizeIssue({ entry: entry.comment, field: "position", severity: "error", message: "position=outlet 导出后通常无效，请改用 before_char/after_char/at_depth 等位置" }));
    if (looksLikeJson(entry.content)) issues.push(normalizeIssue({ entry: entry.comment, field: "content", severity: "warning", message: "content 疑似纯 JSON，建议使用 XML 包裹 YAML" }));
    if (containsYamlDocSeparator(entry.content)) issues.push(normalizeIssue({ entry: entry.comment, field: "content", severity: "error", message: "content 不能包含 YAML 文档分隔符 `---`，请改用 XML 标签包裹 YAML 内容" }));
    if (needsXml(entry.entryType) && !hasXmlWrapper(entry.content)) issues.push(normalizeIssue({ entry: entry.comment, field: "content", severity: "warning", message: `${entry.entryType} 建议使用 XML 包裹 YAML` }));
    const orderKey = `${entry.position}:${entry.order}`;
    const previous = orderSeen.get(orderKey);
    if (previous) issues.push(normalizeIssue({ entry: entry.comment, field: "order", severity: "warning", message: `order 与 ${previous} 在同一 position 中重复` })); else orderSeen.set(orderKey, entry.comment);
  }
  return withValid(section({ ...splitIssues(issues), summary: { entry_count: entries.length, constant_count: entries.filter((entry) => entry.constant).length, triggered_count: entries.filter((entry) => !entry.constant).length } }));
}
function looksLikeJson(content: string): boolean { const trimmed = content.trim(); return (trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]")); }
function containsYamlDocSeparator(content: string): boolean { return /(^|\r?\n)[ \t]*---[ \t]*(?:\r?\n|$)/.test(content); }
function hasXmlWrapper(content: string): boolean { return /^\s*<([a-zA-Z_][\w-]*)>[\s\S]*<\/\1>\s*$/.test(content); }
function needsXml(entryType: string): boolean { return !["world_summary", "background"].includes(entryType); }
