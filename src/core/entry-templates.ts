import type { EntryType } from "../schemas/worldbook-draft.js";

export interface EntryTemplateResult {
  entry_type: EntryType;
  template: string;
  rules: string[];
}

const TEMPLATES: Record<EntryType, EntryTemplateResult> = {
  world_summary: {
    entry_type: "world_summary",
    template: "世界类型: \n时代背景: \n核心规则: \n势力格局: \n使用边界: ",
    rules: ["总纲放宏观设定，不写角色细节", "推荐 before_char、order=1、constant=true", "压缩为 300-500 字左右"],
  },
  background: {
    entry_type: "background",
    template: "背景设定:\n  地点: \n  历史: \n  社会结构: \n  当前矛盾: ",
    rules: ["背景服务于角色和剧情", "推荐 before_char、order=2-3、constant=true"],
  },
  character_overview: {
    entry_type: "character_overview",
    template: "角色速览:\n  - 姓名: \n    身份: \n    一句话特征: ",
    rules: ["多角色卡使用", "每个角色不超过两行", "推荐 before_char、order=4、constant=true"],
  },
  character_basic: {
    entry_type: "character_basic",
    template: `<character>\nname: \nage: \ngender: \nnicknames: \nappearance:\n  hair: \n  eyes: \n  skin: \n  build: \n  clothing: \n  distinguishing: \nbackground: |\n  \nabilities:\n  - name: \n    effects: []\nrelationships:\n  - name: \n    detail: \n</character>`,
    rules: ["不要把性格标签写入基础设定条目", "外貌只写差异特征", "未提及的信息不要补完"],
  },
  character_personality: {
    entry_type: "character_personality",
    template: `<personality>\nname: \ncore_drive: \ntraits:\n  - \nlikes: \ndislikes: \nhabits: \nhidden_self:\n  - \n</personality>`,
    rules: ["性格必须独立成条", "每条 trait 尽量有行为依据", "避免只贴温柔、善良等标签"],
  },
  item: {
    entry_type: "item",
    template: `<item>\nname: \ntype: \ndescription: \nusage: \nrelated_characters: []\n</item>`,
    rules: ["服装写外观材质，不写优缺点", "特殊道具不写精确尺寸", "推荐绿灯 keys 触发"],
  },
  ability: {
    entry_type: "ability",
    template: `<ability>\nname: \nowner: \neffects:\n  - \nlimits:\n  - \nsource: \n</ability>`,
    rules: ["写具体能做到什么", "不要只写强大、无敌", "限制和代价要可操作"],
  },
  scene: {
    entry_type: "scene",
    template: `<scene>\nname: \nlocation: \ndescription: \nrelated_characters: []\n</scene>`,
    rules: ["写场景特征和互动用途", "推荐 after_char、order=80-98、绿灯"],
  },
  event: {
    entry_type: "event",
    template: `<event>\nname: \ntime: \nparticipants: []\nsummary: \nimpact: \n</event>`,
    rules: ["只写改变角色或世界局势的事件", "避免流水账"],
  },
  faction: {
    entry_type: "faction",
    template: `<faction>\nname: \nrole: \nterritory: \nrules: []\nrelationships: []\n</faction>`,
    rules: ["写势力功能、规则、关系", "关键词包含全名、简称、所在地名"],
  },
  npc: {
    entry_type: "npc",
    template: `<npc>\nname: \nidentity: \nrelationship_to_main_cast: \nbehavior: \n</npc>`,
    rules: ["NPC 推荐绿灯", "keys 包含姓名、昵称、职务"],
  },
  other: {
    entry_type: "other",
    template: `<entry>\nname: \ncontent: \n</entry>`,
    rules: ["保持 XML 包裹 YAML", "明确 keys 和触发策略"],
  },
};

export function getEntryTemplate(entryType: EntryType): EntryTemplateResult {
  return TEMPLATES[entryType];
}
