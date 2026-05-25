export type LintSeverity = "error" | "warning";

export interface ContentLintIssue {
  type: string;
  category?: string;
  severity: LintSeverity;
  term?: string;
  message: string;
  index?: number;
  suggestion?: string;
}

export interface ContentLintResult {
  ok: boolean;
  issues: ContentLintIssue[];
}

const FORBIDDEN_TERMS = [
  "一丝",
  "一缕",
  "一抹",
  "不易察觉",
  "不易觉察",
  "难以察觉",
  "鲜明对比",
  "形成对比",
  "弧度",
  "弯起嘴角",
  "翘起嘴角",
  "喉结",
  "纽扣",
  "指节发白",
  "嘴角上扬",
  "勾唇",
  "眸光",
  "眼底",
];

/**
 * 破折号禁词列表。
 * @readonly 禁止修改 — 所有条目均为 error 级别。
 */
const PUNCTUATION_TERMS = [
  "\u2014\u2014",
  "\u2014",
  "\u2013",
];

/**
 * 量子词列表 — 模糊程度修饰词。
 * @readonly 禁止修改 — 所有条目均为 error 级别。
 */
const QUANTUM_TERMS = ["一丝", "一缕", "一抹", "些许", "微微", "隐约"];

/**
 * 感知词列表 — 作者视角判断词。
 * @readonly 禁止修改 — 所有条目均为 error 级别。
 */
const PERCEPTION_TERMS = ["看起来", "听起来", "显得", "似乎", "仿佛", "好像"];

/**
 * 对比词列表 — 总结式对比表达。
 * @readonly 禁止修改 — 所有条目均为 error 级别。
 */
const CONTRAST_TERMS = ["鲜明对比", "形成对比", "截然不同", "反差"];

/**
 * 八股微表情列表。
 * @readonly 禁止修改 — 所有条目均为 error 级别。
 */
const MICRO_EXPRESSION_TERMS = [
  "弧度", "弯起嘴角", "翘起嘴角", "嘴角上扬", "勾唇", "眸光", "眼底", "喉结", "指节发白", "咬住嘴唇",
  "嘴角微微上扬", "眼中闪过一丝", "指尖微微泛白",
];

/**
 * 语气声线标签列表。
 * @readonly 禁止修改 — 所有条目均为 error 级别。
 */
const VOICE_TONE_TERMS = [
  "温柔的语气", "冰冷的声音", "沙哑地说", "低沉地说", "柔声说",
];

/**
 * 极端情绪词列表。
 * @readonly 禁止修改 — 所有条目均为 error 级别。
 */
const EXTREME_EMOTION_TERMS = [
  "极度", "万分", "无比", "崩溃", "撕心裂肺",
  "万念俱灰",
];

/**
 * 比喻禁词列表。
 * @readonly 禁止修改 — 所有条目均为 error 级别。
 */
const METAPHOR_TERMS = [
  "石子", "湖面", "涟漪", "拉满的弓", "琴弦", "闪电", "晨光", "星辰", "落叶",
  "像一道",
];

/**
 * 模糊修饰词列表。
 * @readonly 禁止修改 — 所有条目均为 error 级别。
 */
const BAGGY_TERMS = [
  "几乎", "如同", "宛如", "深深的", "某种", "难以言说", "说不清",
];

/**
 * 语气声线模式正则 — 匹配"带着...的口吻""用...的语气""充满...的味道"等八股模式。
 * @readonly 禁止修改。
 */
const VOICE_TONE_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  { regex: /带着.{1,6}的口吻/, label: "带着XX的口吻" },
  { regex: /用.{1,6}的语气/, label: "用XX的语气" },
  { regex: /充满.{1,6}的味道/, label: "充满XX的味道" },
];

/**
 * 极端情绪模式正则 — 匹配"陷入极大的..."等八股模式。
 * @readonly 禁止修改。
 */
const EXTREME_EMOTION_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  { regex: /陷入极大的/, label: "陷入极大的" },
];

export function lintContent(content: string): ContentLintResult {
  const issues: ContentLintIssue[] = [];

  for (const term of FORBIDDEN_TERMS) {
    pushTermIssues(issues, content, term, "forbidden_word", "error", "删除禁词，改为具体动作或可观察信息", "forbidden");
  }
  for (const term of PUNCTUATION_TERMS) {
    pushTermIssues(issues, content, term, "punctuation_error", "error", "删除解释性破折号，改为短句或直接陈述", "punctuation");
  }
  for (const term of QUANTUM_TERMS) pushTermIssues(issues, content, term, "quantum_word", "error", "删除量子词，改为可观察事实", "quantum_word");
  for (const term of PERCEPTION_TERMS) pushTermIssues(issues, content, term, "perception_word", "error", "减少作者视角判断，改为直接动作/环境", "perception_word");
  for (const term of CONTRAST_TERMS) pushTermIssues(issues, content, term, "contrast_word", "error", "避免总结式对比，直接写差异事实", "contrast_word");
  for (const term of MICRO_EXPRESSION_TERMS) pushTermIssues(issues, content, term, "micro_expression", "error", "删除八股微表情，改为具体动作", "micro_expression");
  for (const term of VOICE_TONE_TERMS) pushTermIssues(issues, content, term, "voice_tone_label", "error", "少写语气声线标签，用对白内容和动作体现", "voice_tone_label");
  for (const term of EXTREME_EMOTION_TERMS) pushTermIssues(issues, content, term, "extreme_emotion", "error", "减少极端情绪词，写行为后果", "extreme_emotion");

  for (const term of METAPHOR_TERMS) {
    pushTermIssues(issues, content, term, "metaphor_term", "error", "检查是否为比喻；如是比喻，应改为白描", "metaphor");
  }

  for (const term of BAGGY_TERMS) {
    pushTermIssues(issues, content, term, "style_cliche", "error", "减少模糊修饰，改为具体事实", "baggy_modifier");
  }

  // 语气声线模式正则匹配
  for (const pattern of VOICE_TONE_PATTERNS) {
    const match = content.match(pattern.regex);
    if (match) {
      issues.push({
        type: "voice_tone_label",
        severity: "error",
        category: "voice_tone_label",
        term: match[0],
        index: match.index,
        message: `命中 ${pattern.label}`,
        suggestion: "少写语气声线标签，用对白内容和动作体现",
      });
    }
  }

  // 极端情绪模式正则匹配
  for (const pattern of EXTREME_EMOTION_PATTERNS) {
    const match = content.match(pattern.regex);
    if (match) {
      issues.push({
        type: "extreme_emotion",
        severity: "error",
        category: "extreme_emotion",
        term: match[0],
        index: match.index,
        message: `命中 ${pattern.label}`,
        suggestion: "减少极端情绪词，写行为后果",
      });
    }
  }

  if (/不是[\s\S]{0,20}是/.test(content)) {
    issues.push({
      type: "negative_turning_pattern",
      category: "negative_turning",
      severity: "warning",
      message: "发现疑似「不是……是……」句式，建议直接写肯定句",
      suggestion: "删除先否定再肯定的解释结构",
    });
  }

  if (/没有[\s\S]{0,20}而是/.test(content)) {
    issues.push({
      type: "negative_turning_pattern",
      category: "negative_turning",
      severity: "warning",
      message: "发现疑似「没有……而是……」句式，建议直接写肯定句",
      suggestion: "删除先否定再肯定的解释结构",
    });
  }

  if (/\u201c[^\u201d]*\d{2,}[^\u201d]*\u201d|\u201c[^\u201d]*\d{2,}[^\u201d]*\u201d/.test(content)) {
    issues.push({ type: "dialogue_exact_number", category: "dialogue_exact_number", severity: "warning", message: "对白中疑似出现精确数字，确认是否必要", suggestion: "对白尽量使用自然表达，非必要不写精确数值" });
  }

  if (/内心|心中|仿佛在|像是在|看起来像/.test(content)) {
    issues.push({ type: "authorial_explanation", category: "authorial_explanation", severity: "warning", message: "疑似作者视角解释心理或动作意义", suggestion: "保留可观察动作，删除解释" });
  }

  if (/精致|白皙|好看|漂亮|美丽|英俊|帅气|完美/.test(content)) {
    issues.push({ type: "generic_beauty", category: "appearance", severity: "warning", message: "外貌描写疑似使用万能美人词", suggestion: "只写可辨认特征，如发型、衣料磨损、姿态习惯、标志物" });
  }
  if (/温柔善良|感情深厚|关系很好|性格复杂|很有魅力|十分神秘/.test(content)) {
    issues.push({ type: "abstract_label", category: "specificity", severity: "warning", message: "发现抽象性格/关系标签", suggestion: "改写为具体事件、行为边界或互动证据" });
  }
  if (/某(?:城市|组织|学校|地点|人物|家族)|待定|TODO|TBD|占位/.test(content)) {
    issues.push({ type: "placeholder_term", category: "specificity", severity: "error", message: "发现占位词或未完成设定", suggestion: "补成具体名称；如果未知，应记录为 pending decision 而非写入成品条目" });
  }
  if (/角色卡|世界书|AI|模型|玩家正在使用|提示词|prompt/i.test(content)) {
    issues.push({ type: "fourth_wall", category: "meta", severity: "warning", message: "疑似出现第四面墙或工具层术语", suggestion: "条目应只写角色可用的世界内信息" });
  }

  return { ok: issues.every((issue) => issue.severity !== "error"), issues };
}

function pushTermIssues(
  issues: ContentLintIssue[],
  content: string,
  term: string,
  type: string,
  severity: LintSeverity,
  suggestion: string,
  category?: string,
): void {
  let index = content.indexOf(term);
  while (index !== -1) {
    issues.push({
      type,
      severity,
      category,
      term,
      index,
      message: `命中 ${term}`,
      suggestion,
    });
    index = content.indexOf(term, index + term.length);
  }
}
