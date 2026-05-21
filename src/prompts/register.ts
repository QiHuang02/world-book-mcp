import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPrompts(server: McpServer): void {
  server.prompt(
    "extract_facts_for_worldbook",
    { topic: z.string().optional() },
    ({ topic }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `请根据 create_extraction_outline 的 schema，从素材中提取世界书事实。主题：${topic ?? "未指定"}。只提取来源中明确出现的信息，未知内容留空，不要补完。`,
          },
        },
      ],
    }),
  );

  server.prompt(
    "draft_entries_from_plan",
    { project_id: z.string().optional() },
    ({ project_id }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `请根据 plan_worldbook_entries 的规划表和 get_entry_template 的模板起草世界书条目。项目：${project_id ?? "未指定"}。条目内容优先使用 XML 包裹 YAML。`,
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
            text: "请根据 validate_worldbook_draft 返回的 errors 和 warnings 修复草稿。必须先修复 error，再处理 warning。不要改变已经正确的设定事实。",
          },
        },
      ],
    }),
  );
}
