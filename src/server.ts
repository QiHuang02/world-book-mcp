import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools/register.js";
import { registerResources } from "./resources/usage-resources.js";
import { registerPrompts } from "./prompts/register.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "world-book-mcp",
    version: "0.1.0",
  });

  registerTools(server);
  registerResources(server);
  registerPrompts(server);

  return server;
}
