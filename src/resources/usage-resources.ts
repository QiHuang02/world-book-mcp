import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const RESOURCES: Record<string, string> = {
  "usage-guide": `# world-book-mcp 使用指南\n\n推荐流程：先用 get_worldbook_workflow 判断工具链，再接收文本或网页摘要，提交提取结果，规划条目，起草条目，校验草稿，最后导出 SillyTavern 世界书 JSON。\n\n第一版只生成独立世界书 JSON，不生成角色卡、MVU、EJS 或 HTML 美化。`,
  "workflow/from-text": `# 从文本生成世界书\n\n1. ingest_text_source\n2. create_extraction_outline\n3. 由 AI 填写提取结果\n4. submit_extraction_result\n5. plan_worldbook_entries\n6. create_worldbook_draft_template\n7. get_entry_template\n8. draft_worldbook_entries\n9. validate_worldbook_draft\n10. generate_worldbook_json\n11. query_worldbook`,
  "workflow/from-web-research": `# 从网页搜索摘要生成世界书\n\n网页搜索由宿主 AI 完成。MCP 只接收整理后的标题、URL、摘要、事实列表和可靠性。然后流程与文本生成相同。`,
  "rules/config": `# 配置规则\n\n- before_char=0，适合世界观总纲。\n- after_char=1，适合角色详情、NPC、物品、场景。\n- at_depth=4 只建议 depth=0。\n- constant=true 是蓝灯常驻。\n- constant=false 是绿灯关键词触发，必须有 keys。\n- 所有条目 preventRecursion 和 excludeRecursion 都必须为 true。`,
  "rules/content-lint": `# 内容扫描规则\n\n避免一丝、一缕、一抹、不易察觉、弧度、弯起嘴角、喉结、指节发白、破折号等禁词。避免星辰、晨光、湖面、涟漪等比喻。性格用行为依据，外貌只写差异特征。`,
};

export function registerResources(server: McpServer): void {
  for (const [name, text] of Object.entries(RESOURCES)) {
    server.resource(`worldbook://${name}`, `worldbook://${name}`, async (uri) => ({
      contents: [{ uri: uri.href, text, mimeType: "text/markdown" }],
    }));
  }
}
