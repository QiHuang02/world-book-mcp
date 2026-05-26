import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPrompts(server: McpServer): void {
  server.prompt(
    "draft_entries_from_material",
    { project_id: z.string().optional() },
    ({ project_id }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `请根据用户材料、skill 配置规则和现有 draft 需求规划并起草世界书条目。项目：${project_id ?? "未指定"}。先创建 draft 切片模板，再逐字段写入 entryType / keys / content；条目内容优先使用 XML 包裹 YAML。`,
          },
        },
      ],
    }),
  );

  server.prompt(
    "repair_draft_from_validation",
    {},
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "请根据 validate_draft 返回的结构、协议和资产 errors/warnings 修复草稿。必须先修复 error，再处理 warning。内容审美、禁词和写作质量判断由 skill 层单独执行，不属于 MCP validation。",
          },
        },
      ],
    }),
  );
}
