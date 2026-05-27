import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPrompts(server: McpServer): void {
  server.prompt("draft_entries_from_material", { project_id: z.string().optional() }, ({ project_id }) => ({ messages: [{ role: "user", content: { type: "text", text: `请根据用户材料和 skill 规则规划世界书条目。项目：${project_id ?? "未指定"}。先 create_draft_slice，再使用 update_entry_content 写 XML/YAML 正文，使用 update_entry_config 写 keys/order/position。` } }] }));
  server.prompt("repair_draft_from_validation", {}, () => ({ messages: [{ role: "user", content: { type: "text", text: "请根据 validate_project 返回的结构、协议和资产 errors/warnings 修复草稿。必须先修复 error，再处理 warning。内容审美、禁词和写作质量判断由 skill 规则执行，不属于 MCP blocking validation。" } }] }));
}
