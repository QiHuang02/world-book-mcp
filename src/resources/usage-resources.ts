import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const RESOURCES: Record<string, string> = {
  "usage-guide": `# world-book-mcp 使用指南\n\n首次使用空白目录时先调用 init_project。推荐 agent 使用 upsert_worldbook_entry / upsert_worldbook_entries 写条目：只提交 comment、keys、content 等核心字段，MCP 自动补全完整世界书 entry 结构并校验。旧的全量 draft 提交逻辑已降级为内部/兼容层，不作为默认公开接口。\n\n同一 project 的写入会在 MCP 进程内串行化，并返回 revision；高并发 agent 可传 expected_revision 做冲突检测。`,
  "workflow/from-text": `# 从文本生成世界书\n\n1. init_project（已有 project 可跳过）\n2. ingest_text_source\n3. create_extraction_outline\n4. 由 AI 填写提取结果\n5. submit_extraction_result\n6. plan_worldbook_entries\n7. upsert_worldbook_entry 或 upsert_worldbook_entries\n8. validate_worldbook_draft\n9. generate_worldbook_json\n10. query_worldbook`,
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
