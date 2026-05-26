import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCharacterCardTools } from "./character-card-tools.js";
import { registerDraftTools } from "./draft-tools.js";
import { registerExportTools } from "./export-tools.js";
import { registerLintReviewTools } from "./lint-review-tools.js";
import { registerMvuVariableTools } from "./mvu-variable-tools.js";
import { registerPlanTools } from "./plan-tools.js";
import { registerProjectTools } from "./project-tools.js";
import { registerSharedTools } from "./shared-tools.js";

export function registerTools(server: McpServer): void {
  registerProjectTools(server);
  registerPlanTools(server);
  registerCharacterCardTools(server);
  registerDraftTools(server);
  registerMvuVariableTools(server);
  registerExportTools(server);
  registerSharedTools(server);
  registerLintReviewTools(server);
}
