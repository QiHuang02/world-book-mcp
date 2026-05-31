import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerProjectTools } from "./project-tools.js";

// 工具注册入口；目前只有 project 一组工具，后续可按域拆分为多个 register*Tools 在此组装
export function registerTools(server: McpServer): void {
  registerProjectTools(server);
}
