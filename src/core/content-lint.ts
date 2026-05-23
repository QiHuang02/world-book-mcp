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
  "——",
  "—",
  "–",
];

const QUANTUM_TERMS = ["一丝", "一缕", "一抹", "些许", "微微", "隐约"];
const PERCEPTION_TERMS = ["看起来", "听起来", "显得", "似乎", "仿佛", "好像"];
const CONTRAST_TERMS = ["鲜明对比", "形成对比", "截然不同", "反差"];
const MICRO_EXPRESSION_TERMS = ["弧度", "弯起嘴角", "翘起嘴角", "嘴角上扬", "勾唇", "眸光", "眼底", "喉结", "指节发白", "咬住嘴唇"];
const VOICE_TONE_TERMS = ["温柔的语气", "冰冷的声音", "沙哑地说", "低沉地说", "柔声说"];
const EXTREME_EMOTION_TERMS = ["极度", "万分", "无比", "崩溃", "撕心裂肺"];
const METAPHOR_TERMS = ["石子", "湖面", "涟漪", "拉满的弓", "琴弦", "闪电", "晨光", "星辰", "落叶"];
const BAGGY_TERMS = ["几乎", "如同", "宛如", "深深的", "某种", "难以言说", "说不清"];

export function lintContent(content: string): ContentLintResult {
  const issues: ContentLintIssue[] = [];

  for (const term of FORBIDDEN_TERMS) {
    pushTermIssues(issues, content, term, "forbidden_word", "error", "删除禁词，改为具体动作或可观察信息", "forbidden");
  }
  for (const term of QUANTUM_TERMS) pushTermIssues(issues, content, term, "quantum_word", "error", "删除量子词，改为可观察事实", "quantum_word");
  for (const term of PERCEPTION_TERMS) pushTermIssues(issues, content, term, "perception_word", "warning", "减少作者视角判断，改为直接动作/环境", "perception_word");
  for (const term of CONTRAST_TERMS) pushTermIssues(issues, content, term, "contrast_word", "warning", "避免总结式对比，直接写差异事实", "contrast_word");
  for (const term of MICRO_EXPRESSION_TERMS) pushTermIssues(issues, content, term, "micro_expression", "error", "删除八股微表情，改为具体动作", "micro_expression");
  for (const term of VOICE_TONE_TERMS) pushTermIssues(issues, content, term, "voice_tone_label", "warning", "少写语气声线标签，用对白内容和动作体现", "voice_tone_label");
  for (const term of EXTREME_EMOTION_TERMS) pushTermIssues(issues, content, term, "extreme_emotion", "warning", "减少极端情绪词，写行为后果", "extreme_emotion");

  for (const term of METAPHOR_TERMS) {
    pushTermIssues(issues, content, term, "metaphor_term", "warning", "检查是否为比喻；如是比喻，应改为白描", "metaphor");
  }

  for (const term of BAGGY_TERMS) {
    pushTermIssues(issues, content, term, "style_cliche", "warning", "减少模糊修饰，改为具体事实", "baggy_modifier");
  }

  if (/不是[\s\S]{0,20}是/.test(content)) {
    issues.push({
      type: "negative_turning_pattern",
      category: "negative_turning",
      severity: "warning",
      message: "发现疑似“不是……是……”句式，建议直接写肯定句",
      suggestion: "删除先否定再肯定的解释结构",
    });
  }

  if (/没有[\s\S]{0,20}而是/.test(content)) {
    issues.push({
      type: "negative_turning_pattern",
      category: "negative_turning",
      severity: "warning",
      message: "发现疑似“没有……而是……”句式，建议直接写肯定句",
      suggestion: "删除先否定再肯定的解释结构",
    });
  }

  if (/“[^”]*\d{2,}[^”]*”|"[^"]*\d{2,}[^"]*"/.test(content)) {
    issues.push({ type: "dialogue_exact_number", category: "dialogue_exact_number", severity: "warning", message: "对白中疑似出现精确数字，确认是否必要", suggestion: "对白尽量使用自然表达，非必要不写精确数值" });
  }

  if (/内心|心中|仿佛在|像是在|看起来像/.test(content)) {
    issues.push({ type: "authorial_explanation", category: "authorial_explanation", severity: "warning", message: "疑似作者视角解释心理或动作意义", suggestion: "保留可观察动作，删除解释" });
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
