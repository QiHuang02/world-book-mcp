import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerProjectTools } from "./project-tools.js";

export function registerTools(server: McpServer): void {
  registerProjectTools(server);
}
