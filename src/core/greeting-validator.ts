import type { CharacterCardConfig } from "../schemas/character-card.js";
import { lintContent } from "./content-lint.js";
import type { ValidationIssue } from "./worldbook-validator.js";

export interface GreetingValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: {
    first_mes_present: boolean;
    alternate_greeting_count: number;
    total_greeting_count: number;
    mvu_placeholder_required: boolean;
  };
}

const USER_PRESET_PATTERNS = [
  { pattern: /你(?:穿着|长着|有着|拥有|露出|坐在自己的房间|躺在床上|刚刚醒来)/, message: "开场白疑似预设 user 外貌、服装、动作或所在房间" },
  { pattern: /<user>(?:是|已经|正在|穿着|长着|拥有)/i, message: "开场白疑似预设 <user> 的状态或行动" },
  { pattern: /你(?:是个|是一个|作为)(?:男|女|少年|少女|学生|老师|贵族|平民)/, message: "开场白疑似预设 user 身份或性别" },
  { pattern: /你(?:回答|走上前|伸手|点头|摇头|跟着|只能|只好|不得不|必须)/, message: "开场白疑似预设 user 后续行动或选择" },
];

export function validateGreetings(input: { config: CharacterCardConfig; mvu_enabled?: boolean }): GreetingValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const { config, mvu_enabled = false } = input;
  const greetings = [config.card.first_mes, ...config.card.alternate_greetings];

  if (!config.card.first_mes.trim()) {
    errors.push({ field: "card.first_mes", severity: "error", message: "first_mes 必填" });
  }

  if (config.card.alternate_greetings.length < 2) {
    warnings.push({ field: "card.alternate_greetings", severity: "warning", message: "建议提供 2-4 个 alternate_greetings" });
  }
  if (config.card.alternate_greetings.length > 4) {
    warnings.push({ field: "card.alternate_greetings", severity: "warning", message: "alternate_greetings 建议控制在 2-4 个，避免维护成本过高" });
  }

  greetings.forEach((greeting, index) => {
    const field = index === 0 ? "card.first_mes" : `card.alternate_greetings.${index - 1}`;
    if (!greeting.trim()) {
      if (index > 0) warnings.push({ field, severity: "warning", message: "alternate greeting 为空，可删除或补全" });
      return;
    }

    checkGreetingStructure(greeting, field, warnings);
    checkUserPreset(greeting, field, errors);
    checkOpenEnding(greeting, field, warnings);

    if (mvu_enabled && !greeting.includes("<StatusPlaceHolderImpl/>")) {
      warnings.push({ field, severity: "warning", message: "启用 MVU 时开场白建议包含 <StatusPlaceHolderImpl/>" });
    }

    const lint = lintContent(greeting);
    for (const issue of lint.issues) {
      const target = issue.severity === "error" ? errors : warnings;
      target.push({ field, severity: issue.severity, message: issue.term ? `开场白文本问题：${issue.term}` : issue.message, suggestion: issue.suggestion });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      first_mes_present: Boolean(config.card.first_mes.trim()),
      alternate_greeting_count: config.card.alternate_greetings.length,
      total_greeting_count: greetings.length,
      mvu_placeholder_required: mvu_enabled,
    },
  };
}

function checkGreetingStructure(greeting: string, field: string, warnings: ValidationIssue[]): void {
  if (!/(清晨|上午|中午|午后|下午|傍晚|夜|深夜|凌晨|黄昏|雨|雪|风|阳光|灯光|房间|街|城|店|庭院|走廊|门口|窗边|桌前)/.test(greeting)) {
    warnings.push({ field, severity: "warning", message: "开场白建议交代可感知的时间或地点" });
  }
  if (!/(站|坐|停|看|拿|放|推|走|靠|抬|低|开口|沉默|等待|整理|握|递)/.test(greeting)) {
    warnings.push({ field, severity: "warning", message: "开场白建议包含角色当前状态或动作" });
  }
  if (!/(你|<user>|用户|来客|对方)/i.test(greeting)) {
    warnings.push({ field, severity: "warning", message: "开场白建议给 user 留出明确互动位置" });
  }
}

function checkUserPreset(greeting: string, field: string, errors: ValidationIssue[]): void {
  for (const item of USER_PRESET_PATTERNS) {
    if (item.pattern.test(greeting)) {
      errors.push({ field, severity: "error", message: item.message, suggestion: "只描写角色可观察到的环境和互动契机，不替 user 决定身份、外貌、行动或房间" });
    }
  }
}

function checkOpenEnding(greeting: string, field: string, warnings: ValidationIssue[]): void {
  const trimmed = greeting.trim();
  if (!/[？?。…]$/.test(trimmed)) {
    warnings.push({ field, severity: "warning", message: "开场白建议以可接续的句子收束，避免戛然而止" });
  }
  if (/(然后你|于是你|你只好|你必须|你不得不|你回答|你走上前|你伸手)/.test(greeting)) {
    warnings.push({ field, severity: "warning", message: "开场白结尾疑似预设 user 后续行动，应改为开放式互动契机" });
  }
}
