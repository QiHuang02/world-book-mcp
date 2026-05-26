import type { CharacterCardConfig } from "../schemas/character-card.js";
import { issue, section, splitIssues, withValid, type ValidationIssue, type ValidationSection } from "./validation-types.js";

export type FirstMessageValidationResult = ValidationSection<{
  first_mes_present: boolean;
  alternate_greeting_count: number;
  total_greeting_count: number;
  mvu_placeholder_required: boolean;
  initvar_override_count: number;
}> & { valid: boolean };

const USER_PRESET_PATTERNS = [
  { pattern: /你(?:穿着|长着|有着|拥有|露出|坐在自己的房间|躺在床上|刚刚醒来)/, message: "开场白疑似预设 user 外貌、服装、动作或所在房间" },
  { pattern: /<user>(?:是|已经|正在|穿着|长着|拥有)/i, message: "开场白疑似预设 <user> 的状态或行动" },
  { pattern: /你(?:是个|是一个|作为)(?:男|女|少年|少女|学生|老师|贵族|平民)/, message: "开场白疑似预设 user 身份或性别" },
  { pattern: /你(?:回答|走上前|伸手|点头|摇头|跟着|只能|只好|不得不|必须)/, message: "开场白疑似预设 user 后续行动或选择" },
];

export function validateFirstMessages(input: { config: CharacterCardConfig; mvu_enabled?: boolean; html_statusbar_enabled?: boolean }): FirstMessageValidationResult {
  const issues: ValidationIssue[] = [];
  const { config, mvu_enabled = false, html_statusbar_enabled = false } = input;
  const placeholderRequired = mvu_enabled || html_statusbar_enabled;
  const greetings = [config.card.first_mes, ...config.card.alternate_greetings];
  let initvarOverrideCount = 0;

  if (!config.card.first_mes.trim()) issues.push(issue({ code: "first_mes.empty", field: "card.first_mes", severity: "error", message: "first_mes 必填" }));
  if (config.card.alternate_greetings.length < 2) issues.push(issue({ code: "first_mes.alternates.too_few", field: "card.alternate_greetings", severity: "warning", message: "建议提供 2-4 个 alternate_greetings" }));
  if (config.card.alternate_greetings.length > 4) issues.push(issue({ code: "first_mes.alternates.too_many", field: "card.alternate_greetings", severity: "warning", message: "alternate_greetings 建议控制在 2-4 个，避免维护成本过高" }));

  greetings.forEach((greeting, index) => {
    const field = index === 0 ? "card.first_mes" : `card.alternate_greetings.${index - 1}`;
    if (!greeting.trim()) {
      if (index > 0) issues.push(issue({ code: "first_mes.alternate.empty", field, severity: "warning", message: "alternate greeting 为空，可删除或补全" }));
      return;
    }
    checkGreetingStructure(greeting, field, issues);
    checkUserPreset(greeting, field, issues);
    checkOpenEnding(greeting, field, issues);
    if (placeholderRequired && !greeting.includes("<StatusPlaceHolderImpl/>")) issues.push(issue({ code: "first_mes.missing_status_placeholder", field, severity: "error", message: "启用 MVU 或 HTML 状态栏时开场白必须包含 <StatusPlaceHolderImpl/>" }));

    const initvarBlocks = [...greeting.matchAll(/<UpdateVariable>\s*<initvar>([\s\S]*?)<\/initvar>\s*<\/UpdateVariable>/gi)];
    initvarOverrideCount += initvarBlocks.length;
    for (const block of initvarBlocks) {
      issues.push(issue({ code: "first_mes.initvar_override", field, severity: "info", message: "alternate greeting 内含 UpdateVariable/initvar，会覆盖默认 initvar，请确认这是有意的分支初始状态" }));
      if (!looksLikeYaml(block[1])) issues.push(issue({ code: "first_mes.initvar_unparseable", field, severity: "warning", message: "UpdateVariable/initvar 内容不像可解析 YAML，请复核缩进与 key: value 结构" }));
    }
  });

  return withValid(section({ ...splitIssues(issues), summary: { first_mes_present: Boolean(config.card.first_mes.trim()), alternate_greeting_count: config.card.alternate_greetings.length, total_greeting_count: greetings.length, mvu_placeholder_required: placeholderRequired, initvar_override_count: initvarOverrideCount } }));
}

function checkGreetingStructure(greeting: string, field: string, issues: ValidationIssue[]): void {
  if (!/(清晨|上午|中午|午后|下午|傍晚|夜|深夜|凌晨|黄昏|雨|雪|风|阳光|灯光|房间|街|城|店|庭院|走廊|门口|窗边|桌前)/.test(greeting)) issues.push(issue({ code: "first_mes.structure.no_time_place", field, severity: "warning", message: "开场白建议交代可感知的时间或地点" }));
  if (!/(站|坐|停|看|拿|放|推|走|靠|抬|低|开口|沉默|等待|整理|握|递)/.test(greeting)) issues.push(issue({ code: "first_mes.structure.no_action", field, severity: "warning", message: "开场白建议包含角色当前状态或动作" }));
  if (!/(你|<user>|用户|来客|对方)/i.test(greeting)) issues.push(issue({ code: "first_mes.structure.no_user_hook", field, severity: "warning", message: "开场白建议给 user 留出明确互动位置" }));
}

function checkUserPreset(greeting: string, field: string, issues: ValidationIssue[]): void {
  for (const item of USER_PRESET_PATTERNS) if (item.pattern.test(greeting)) issues.push(issue({ code: "first_mes.user_preset", field, severity: "warning", message: item.message, suggestion: "只描写角色可观察到的环境和互动契机，不替 user 决定身份、外貌、行动或房间" }));
}

function checkOpenEnding(greeting: string, field: string, issues: ValidationIssue[]): void {
  const trimmed = greeting.trim();
  if (!/[？?。…]$/.test(trimmed)) issues.push(issue({ code: "first_mes.ending.abrupt", field, severity: "warning", message: "开场白建议以可接续的句子收束，避免戛然而止" }));
  if (/(然后你|于是你|你只好|你必须|你不得不|你回答|你走上前|你伸手)/.test(greeting)) issues.push(issue({ code: "first_mes.ending.user_action", field, severity: "warning", message: "开场白结尾疑似预设 user 后续行动，应改为开放式互动契机" }));
}

function looksLikeYaml(value: string): boolean {
  return /^\s*[^:\n]+:\s*/m.test(value);
}
