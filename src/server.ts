import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import packageJson from "../package.json" with { type: "json" };
import { registerTools } from "./tools/register.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "world-book-mcp",
    version: packageJson.version,
  });

  registerTools(server);

  return server;
}
