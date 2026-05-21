import type { ValidationIssue } from "./worldbook-validator.js";

export type WorldbuildingType = "A_realistic_background" | "B_small_world" | "C_large_world";

export interface WorldbuildingSummary {
  world_type: WorldbuildingType;
  title: string;
  summary: string;
  geography?: string;
  history?: string;
  factions?: string;
  rules?: string;
  society?: string;
  technology?: string;
  boundaries?: string;
}

export interface WorldbuildingValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: {
    world_type: WorldbuildingType;
    summary_length: number;
    filled_dimension_count: number;
  };
}

export function createWorldbuildingOutline(input: { title?: string; world_type?: WorldbuildingType } = {}): { world_type_options: Record<WorldbuildingType, string>; template: WorldbuildingSummary; rules: string[] } {
  return {
    world_type_options: {
      A_realistic_background: "A 类真实背景：现实/近现实舞台，只补必要地点、行业、关系网和生活规则",
      B_small_world: "B 类小世界：封闭学校、宅邸、组织、小镇等，强调空间边界和日常循环",
      C_large_world: "C 类大世界：架空大陆、奇幻/科幻文明，需定义地理、历史、势力、规则与技术层级",
    },
    template: {
      world_type: input.world_type ?? "B_small_world",
      title: input.title ?? "",
      summary: "",
      geography: "",
      history: "",
      factions: "",
      rules: "",
      society: "",
      technology: "",
      boundaries: "",
    },
    rules: [
      "先写 100-200 字总纲，再决定哪些维度需要展开",
      "A 类少写宏大历史，优先写现实约束和关系边界",
      "B 类优先写封闭空间、日常规则、关键地点和互动机制",
      "C 类必须写清核心规则、势力格局和技术/魔法边界",
      "总纲使用说明性语言，避免大段文学化描写",
    ],
  };
}

export function validateWorldbuildingSummary(summary: WorldbuildingSummary): WorldbuildingValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  if (!summary.title.trim()) errors.push({ field: "title", severity: "error", message: "世界观标题必填" });
  if (!summary.summary.trim()) errors.push({ field: "summary", severity: "error", message: "世界观总纲必填" });

  const length = [...summary.summary.trim()].length;
  if (length > 0 && length < 80) warnings.push({ field: "summary", severity: "warning", message: "世界观总纲建议至少 100 字左右" });
  if (length > 220) warnings.push({ field: "summary", severity: "warning", message: "世界观总纲建议控制在 100-200 字，过长内容拆入维度字段" });
  if (/[。！？][“”]?\s*[“”]?[我他她你][^。！？]{30,}[。！？]/.test(summary.summary)) {
    warnings.push({ field: "summary", severity: "warning", message: "总纲疑似偏文学叙事，建议改为设定说明" });
  }

  const dimensions = [summary.geography, summary.history, summary.factions, summary.rules, summary.society, summary.technology, summary.boundaries].filter((item) => item?.trim()).length;
  if (summary.world_type === "C_large_world" && dimensions < 4) warnings.push({ field: "dimensions", severity: "warning", message: "C 类大世界建议至少填写 4 个维度：地理、历史、势力、规则、社会或技术" });
  if (summary.world_type === "B_small_world" && !summary.boundaries?.trim()) warnings.push({ field: "boundaries", severity: "warning", message: "B 类小世界建议写清空间/组织边界" });
  if (summary.world_type === "A_realistic_background" && summary.rules && summary.rules.length > 300) warnings.push({ field: "rules", severity: "warning", message: "A 类真实背景不宜过度规则化，保留必要现实约束即可" });

  return { ok: errors.length === 0, errors, warnings, summary: { world_type: summary.world_type, summary_length: length, filled_dimension_count: dimensions } };
}

export interface WorldbuildingTypeClassification {
  world_type: WorldbuildingType;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  recommended_dimensions: string[];
}

export function classifyWorldbuildingType(input: { title?: string; brief?: string; tags?: string[] }): WorldbuildingTypeClassification {
  const text = `${input.title ?? ""} ${input.brief ?? ""} ${(input.tags ?? []).join(" ")}`.toLowerCase();
  const reasons: string[] = [];

  if (/(架空|奇幻|玄幻|修仙|魔法|星际|科幻|异界|大陆|王国|帝国|多神)/.test(text)) {
    reasons.push("出现架空/奇幻/科幻关键词，倾向 C 类大世界");
    return { world_type: "C_large_world", confidence: "high", reasons, recommended_dimensions: ["geography", "history", "factions", "rules", "society", "technology"] };
  }
  if (/(学院|学园|学校|宅邸|公司|小镇|村庄|岛屿|船舱|地下城|末日避难)/.test(text)) {
    reasons.push("出现封闭舞台关键词，倾向 B 类小世界");
    return { world_type: "B_small_world", confidence: "high", reasons, recommended_dimensions: ["geography", "society", "rules", "boundaries"] };
  }
  if (/(现代|都市|当代|高中|大学|公司|职场|日常|城市|国内|海外)/.test(text)) {
    reasons.push("出现现代/日常关键词，倾向 A 类真实背景");
    return { world_type: "A_realistic_background", confidence: "high", reasons, recommended_dimensions: ["geography", "society", "boundaries"] };
  }
  reasons.push("未命中明显关键词，默认按 B 类小世界处理");
  return { world_type: "B_small_world", confidence: "low", reasons, recommended_dimensions: ["geography", "society", "rules", "boundaries"] };
}

export function createWorldbuildingDesignTemplate(input: { world_type?: WorldbuildingType; title?: string }): { world_type: WorldbuildingType; title: string; sections: Array<{ name: string; required: boolean; guidance: string; placeholder: string }>; rules: string[] } {
  const worldType = input.world_type ?? "B_small_world";
  const baseRules = [
    "概念设计阶段不写条目，只写设定说明",
    "避免文学化叙述，使用列表/键值对结构",
    "命名固定术语后再展开下层细节",
  ];
  const allSections: Array<{ name: string; required: boolean; guidance: string; placeholder: string; types: WorldbuildingType[] }> = [
    { name: "geography", required: true, guidance: "地理范围、关键地点、空间结构", placeholder: "区域: \n关键地点: \n空间结构: ", types: ["A_realistic_background", "B_small_world", "C_large_world"] },
    { name: "history", required: false, guidance: "影响当前世界的关键历史事件", placeholder: "关键节点: \n时代背景: ", types: ["A_realistic_background", "C_large_world"] },
    { name: "factions", required: false, guidance: "势力名称、定位、互相关系", placeholder: "- 名称: \n  定位: \n  关系: ", types: ["B_small_world", "C_large_world"] },
    { name: "rules", required: true, guidance: "核心运行规则与限制", placeholder: "核心规则: \n限制条件: ", types: ["A_realistic_background", "B_small_world", "C_large_world"] },
    { name: "society", required: false, guidance: "社会结构、阶层、文化习俗", placeholder: "阶层: \n文化习俗: ", types: ["A_realistic_background", "B_small_world", "C_large_world"] },
    { name: "technology", required: worldType === "C_large_world", guidance: "技术/魔法/修炼体系，等级与边界", placeholder: "体系: \n等级划分: \n边界: ", types: ["C_large_world"] },
    { name: "boundaries", required: worldType === "B_small_world", guidance: "空间/组织/认知边界，决定 user 能感知到的范围", placeholder: "可感知边界: \n禁区: ", types: ["A_realistic_background", "B_small_world"] },
  ];
  return {
    world_type: worldType,
    title: input.title ?? "",
    sections: allSections.filter((section) => section.types.includes(worldType)).map(({ types, ...rest }) => rest),
    rules: baseRules,
  };
}

export interface WorldbuildingDesignInput {
  world_type: WorldbuildingType;
  title: string;
  geography?: string;
  history?: string;
  factions?: string;
  rules?: string;
  society?: string;
  technology?: string;
  boundaries?: string;
}

export interface WorldbuildingDesignValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: {
    world_type: WorldbuildingType;
    filled_required_count: number;
    missing_required: string[];
  };
}

export function validateWorldbuildingDesign(design: WorldbuildingDesignInput): WorldbuildingDesignValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const required: string[] = ["geography", "rules"];
  if (design.world_type === "C_large_world") required.push("history", "factions", "technology");
  if (design.world_type === "B_small_world") required.push("boundaries");

  const missing_required: string[] = [];
  for (const field of required) {
    const value = (design as unknown as Record<string, string | undefined>)[field];

    if (!value || !value.trim()) {
      missing_required.push(field);
      errors.push({ field, severity: "error", message: `${design.world_type} 缺少必填维度：${field}` });
    }
  }

  for (const field of ["geography", "history", "factions", "rules", "society", "technology", "boundaries"] as const) {
    const value = design[field];
    if (!value) continue;
    if (/“[^”]{40,}”/.test(value) || /[。！？]{2,}/.test(value)) {
      warnings.push({ field, severity: "warning", message: `${field} 疑似文学叙述，建议改为设定列表` });
    }
    if (value.length > 600) warnings.push({ field, severity: "warning", message: `${field} 内容过长，建议拆分到具体世界书条目` });
  }

  if (design.world_type === "A_realistic_background" && design.technology) {
    warnings.push({ field: "technology", severity: "warning", message: "A 类真实背景一般不需要 technology 体系，确认是否必要" });
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      world_type: design.world_type,
      filled_required_count: required.length - missing_required.length,
      missing_required,
    },
  };
}
