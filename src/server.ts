import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools/register.js";
import { registerPrompts } from "./prompts/register.js";
import packageJson from "../package.json" with { type: "json" };

export function createServer(): McpServer {
  const server = new McpServer({
    name: "world-book-mcp",
    version: packageJson.version,
  });

  registerTools(server);
  registerPrompts(server);

  return server;
}
