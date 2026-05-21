import type { ValidationIssue } from "./worldbook-validator.js";

const UNIVERSAL_BEAUTY_TERMS = ["精致", "白皙", "好看", "美丽", "漂亮", "优雅", "温婉", "亭亭玉立"];
const DEFAULT_APPEARANCE_PATTERNS = [/中国人.*黑发黑眼/, /日本人.*黑发/, /18岁.*年轻/, /精灵.*尖耳/];

export function createCharacterBasicEntryTemplate(input: { character_name?: string } = {}): { template: string; rules: string[] } {
  const name = input.character_name ?? "角色名";
  return {
    template: `<character>\nname: ${name}\nname_en: \nage: \ngender: \nnicknames: []\nappearance:\n  height: \n  hair: \n  eyes: \n  skin: \n  build: \n  clothing:\n    daily: \n  distinguishing: \nbackground: |\n  \nabilities:\n  - name: \n    acquisition: \n    effects:\n      - \nrelationships:\n  - name: "{{user}}"\n    detail: \n</character>`,
    rules: ["不要写 personality 字段", "外貌只写差异特征", "背景只写改变角色的关键事件", "关系写具体互动方式，不写抽象形容"],
  };
}

export function createCharacterPersonalityEntryTemplate(input: { character_name?: string } = {}): { template: string; rules: string[] } {
  const name = input.character_name ?? "角色名";
  return {
    template: `<personality>\nname: ${name}\ncore_drive: \ntraits:\n  - 特征——行为依据\nlikes: \ndislikes: \nhabits: \nhidden_self:\n  - \n</personality>`,
    rules: ["性格必须独立成条", "traits 每条都要有行为依据", "不要只写温柔/善良/冷酷等标签"],
  };
}

export function validateCharacterEntryStructure(input: { content: string; kind: "basic" | "personality" }): { valid: boolean; errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const content = input.content;

  if (input.kind === "basic") {
    if (!/^\s*<character>[\s\S]*<\/character>\s*$/.test(content)) errors.push({ field: "content", severity: "error", message: "基础人设条目必须使用 <character> 包裹" });
    if (/personality|性格特征|core_drive|核心驱动力/i.test(content)) errors.push({ field: "content", severity: "error", message: "基础人设条目不应混入性格内容，应拆到独立 personality 条目" });
    if (!/relationships:|关系/.test(content)) warnings.push({ field: "relationships", severity: "warning", message: "建议包含关系设定，并用具体画面描述" });
    warnings.push(...appearanceWarnings(content));
    if (/感情深厚|好朋友|关系很好|羁绊很深/.test(content)) warnings.push({ field: "relationships", severity: "warning", message: "关系描写疑似抽象形容，建议改为具体事件和互动方式" });
  } else {
    if (!/^\s*<personality>[\s\S]*<\/personality>\s*$/.test(content)) errors.push({ field: "content", severity: "error", message: "性格条目必须使用 <personality> 包裹" });
    if (!/core_drive|核心驱动力/.test(content)) warnings.push({ field: "core_drive", severity: "warning", message: "性格条目建议包含核心驱动力" });
    if (/温柔\s*$|善良\s*$|冷酷\s*$|强大\s*$/m.test(content)) warnings.push({ field: "traits", severity: "warning", message: "性格特征需要行为依据，不应只有标签" });
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateCharacterAppearanceDistinctiveness(content: string): { valid: boolean; errors: ValidationIssue[]; warnings: ValidationIssue[]; summary: { issue_count: number } } {
  const warnings = appearanceWarnings(content);
  return { valid: true, errors: [], warnings, summary: { issue_count: warnings.length } };
}

function appearanceWarnings(content: string): ValidationIssue[] {
  const warnings: ValidationIssue[] = [];
  for (const term of UNIVERSAL_BEAUTY_TERMS) {
    if (content.includes(term)) warnings.push({ field: "appearance", severity: "warning", message: `外貌含万能修饰词：${term}`, suggestion: "改为可识别的差异特征" });
  }
  for (const pattern of DEFAULT_APPEARANCE_PATTERNS) {
    if (pattern.test(content)) warnings.push({ field: "appearance", severity: "warning", message: "外貌疑似写入 AI 默认认知特征", suggestion: "默认特征不写，只写差异点" });
  }
  if (/如|像|仿佛|宛如/.test(content) && /眼|眸|肤|发|声音|声线/.test(content)) warnings.push({ field: "appearance", severity: "warning", message: "外貌疑似使用意象比喻，建议改为白描特征" });
  return warnings;
}
