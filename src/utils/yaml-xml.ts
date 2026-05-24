/**
 * 工具函数集：处理"世界书条目内容必须用 XML 包裹 YAML、不能裸出现 YAML 文档分隔符 `---`"这条 skill 硬约束。
 *
 * 设计要点：
 * - 这里所有函数都是幂等的：重复调用不会重复包裹或反复剥离。
 * - 仅识别 YAML 文档分隔符意义上的 `---`，即"独占一行的 `---`"。条目正文中嵌在普通文本里的 `---` 不被视为分隔符。
 * - 不处理 YAML 的 `...` end marker，避免误删自然语言中独占一行的省略号。
 * - XML 标签匹配大小写不敏感，与 SillyTavern 一贯的处理方式保持一致。
 */

/**
 * 去除 content 首尾出现的 YAML 文档分隔符 `---`（独占一行，可含前导空白行）。
 *
 * 仅去除最外层的分隔符，例如：
 *   `---\nfoo: bar\n` -> `foo: bar`
 *   `\n---\nfoo: bar\n` -> `foo: bar`
 *   `foo: bar\n---\nbaz: qux` -> 保持不变（中间的 `---` 表示真正的多文档边界，留给上层决定）。
 */
function stripYamlDocSeparators(content: string): string {
  if (!content) return content;
  let working = content;

  // 反复剥离开头的 `---` 行，直到没有为止。
  // 允许 `---` 前存在空白行，容忍 AI 从 Markdown 代码块复制时多带一个换行。
  while (true) {
    const next = working.replace(/^(?:[ \t]*\r?\n)*[ \t]*---[ \t]*(?:\r?\n|$)/, "");
    if (next === working) break;
    working = next;
  }

  // 同理处理结尾的 `---` 行与其后的空白行。
  while (true) {
    const next = working.replace(/\r?\n[ \t]*---[ \t]*(?:\r?\n[ \t]*)*$/, "");
    if (next === working) break;
    working = next;
  }

  // 如果整个字符串就是一个 `---`（可带空白行），也清掉。
  if (/^\s*---\s*$/.test(working)) return "";

  return working;
}

/**
 * 检查整段 content 是否被指定 XML 标签整体包裹（首尾位置）。
 * 标签名匹配大小写不敏感。
 */
function hasXmlWrapper(content: string, tag: string): boolean {
  const escaped = escapeRegExp(tag);
  return new RegExp(`^\\s*<${escaped}\\b[^>]*>[\\s\\S]*<\\/${escaped}>\\s*$`, "i").test(content);
}

/**
 * 幂等地剥离 `<tag>...</tag>` 包裹。如果没有这个包裹，原样返回。
 * 仅在最外层匹配；内部内容不被改动。
 */
function unwrapXmlTag(content: string, tag: string): string {
  const escaped = escapeRegExp(tag);
  const match = content.match(new RegExp(`^\\s*<${escaped}\\b[^>]*>([\\s\\S]*)<\\/${escaped}>\\s*$`, "i"));
  if (!match) return content;
  return match[1].replace(/^\r?\n/, "").replace(/\r?\n\s*$/, "");
}

/**
 * 幂等地用 `<tag>\n...\n</tag>` 包裹 content。
 * - 先剥离首尾 `---`，确保最终成品中没有 YAML 文档分隔符。
 * - 如果 content 已经被同名 tag 包裹，仅返回剥过 `---` 的版本，不再二次包裹。
 * - content 为空时返回空字符串，避免产出 `<tag></tag>` 这种空壳。
 */
export function wrapWithXmlTag(content: string, tag: string): string {
  const stripped = stripYamlDocSeparators(content).trim();
  if (!stripped) return "";
  if (hasXmlWrapper(stripped, tag)) {
    const inner = stripYamlDocSeparators(unwrapXmlTag(stripped, tag)).trim();
    return inner ? `<${tag}>\n${inner}\n</${tag}>` : "";
  }
  return `<${tag}>\n${stripped}\n</${tag}>`;
}

/**
 * 世界书条目 `content` 的输入侧规范化：
 * - 剥离首尾 `---` YAML 文档分隔符。
 * - 不强制添加 XML 包裹（因为不知道用什么标签名；如果需要包裹由生成端负责）。
 * - 保留正文内的换行与缩进。
 */
export function normalizeWorldbookEntryContent(content: string): string {
  if (typeof content !== "string") return content;
  return stripYamlDocSeparators(content);
}

/**
 * MVU 字段（initvar / update_rules / output_format）的输入侧规范化：
 * - 剥离首尾 `---`。
 * - 如果用户/AI 误把已经带 XML 包裹的内容贴进字段，自动解包成纯 YAML。
 *
 * `MvuConfig` 约定这三个字段存原始 YAML，由 builder 在合成世界书条目时再统一加 XML 包裹，
 * 因此这里要主动剥包裹，避免出现 `<variable_update_rules><variable_update_rules>...` 这种重复包裹。
 */
export function normalizeMvuYamlField(content: string, candidateTags: string[]): string {
  if (typeof content !== "string") return content;
  let working = stripYamlDocSeparators(content);
  for (const tag of candidateTags) {
    working = unwrapXmlTag(working, tag);
  }
  return stripYamlDocSeparators(working);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
