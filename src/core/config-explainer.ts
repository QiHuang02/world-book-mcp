export type ConfigTopic = "position" | "constant" | "order" | "recursion" | "keys" | "scan_depth" | "all";

export function explainConfig(topic: ConfigTopic): unknown {
  const explanations = {
    position: {
      values: [
        { name: "before_char", value: 0, use_case: "世界观总纲、背景设定、社会规则" },
        { name: "after_char", value: 1, use_case: "角色详情、NPC、物品、场景、事件" },
        { name: "before_an", value: 2, use_case: "作者注之前，适合文风或格式规则" },
        { name: "after_an", value: 3, use_case: "作者注之后，较少使用" },
        { name: "at_depth", value: 4, use_case: "D0 行为纠正或直接指导；不要用于普通世界观" },
        { name: "before_em", value: 5, use_case: "示例消息之前，第一版不推荐" },
        { name: "after_em", value: 6, use_case: "示例消息之后，第一版不推荐" },
        { name: "outlet", value: 7, use_case: "输出到 Outlet，第一版不推荐" },
      ],
    },
    constant: {
      blue: "constant=true，蓝灯常驻，每轮都发给 AI，适合必须始终存在的信息",
      green: "constant=false，绿灯触发，只有命中 keys 时激活，适合角色详情、物品、场景等按需信息",
    },
    order: {
      rules: [
        { range: "1", use_case: "世界观总纲" },
        { range: "2-3", use_case: "背景、区域、社会规则" },
        { range: "4", use_case: "多角色速览" },
        { range: "10-45", use_case: "核心角色基础与性格条目" },
        { range: "50-98", use_case: "物品、能力、场景、事件" },
        { range: "99-100", use_case: "补充信息、NPC、其他" },
      ],
    },
    recursion: {
      rule: "所有条目必须 preventRecursion=true 且 excludeRecursion=true。第一版不提供关闭选项。",
    },
    keys: {
      rules: ["绿灯条目必须有 keys", "使用英文逗号或数组，不要使用中文逗号、顿号", "角色 keys 包含全名、昵称、外号"],
    },
    scan_depth: {
      rule: "绿灯条目推荐 scanDepth=2。蓝灯条目通常不设置 scanDepth。",
    },
  };

  if (topic === "all") {
    return explanations;
  }
  return { topic, ...explanations[topic] };
}
