export type ExtractionFocus = "characters" | "world" | "items" | "events";

export interface ExtractionCharacterOutlineItem {
  name: string;
  aliases: string[];
  firstAppearance: string;
  appearance: string[];
  identity: string;
  personalityEvidence: string[];
  keyEvents: string[];
  relationships: string[];
  abilities: string[];
  sourceRefs: unknown[];
}

export interface ExtractionWorldOutlineItem {
  name: string;
  type: string;
  facts: string[];
  sourceRefs: unknown[];
}

export interface ExtractionGenericOutlineItem {
  name: string;
  type?: string;
  summary?: string;
  facts?: string[];
  participants?: string[];
  sourceRefs: unknown[];
}

export interface ExtractionOutline {
  outline_schema: {
    characters: ExtractionCharacterOutlineItem[];
    world: ExtractionWorldOutlineItem[];
    items: ExtractionGenericOutlineItem[];
    events: ExtractionGenericOutlineItem[];
  };
  instructions_for_ai: string[];
}

export function createExtractionOutline(focus: ExtractionFocus[] = ["characters", "world", "items", "events"]): ExtractionOutline {
  return {
    outline_schema: {
      characters: focus.includes("characters")
        ? [
            {
              name: "",
              aliases: [],
              firstAppearance: "章节/行号/网页来源，如未知留空",
              appearance: ["只写能识别角色的差异特征"],
              identity: "",
              personalityEvidence: ["性格必须有行为依据，不只写标签"],
              keyEvents: ["只写改变角色的关键事件"],
              relationships: ["写具体互动和关系来源"],
              abilities: ["写具体能做到什么"],
              sourceRefs: [],
            },
          ]
        : [],
      world: focus.includes("world")
        ? [
            {
              name: "",
              type: "geography | history | faction | rule | society | other",
              facts: ["只写来源中明确出现的设定"],
              sourceRefs: [],
            },
          ]
        : [],
      items: focus.includes("items")
        ? [{ name: "", type: "item | ability | equipment", facts: [], sourceRefs: [] }]
        : [],
      events: focus.includes("events")
        ? [{ name: "", summary: "", participants: [], sourceRefs: [] }]
        : [],
    },
    instructions_for_ai: [
      "只提取源材料或搜索摘要中出现的信息",
      "无法确认的信息标记为 unknown 或留空，不要自行补完",
      "性格用行为依据支撑",
      "外貌只提取差异化特征",
      "保留 sourceRefs 以便回溯来源",
    ],
  };
}
