import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDecisionTools } from "./decision-tools.js";
import { registerDraftTools } from "./draft-tools.js";
import { registerExportTools } from "./export-tools.js";
import { registerExtractionTools } from "./extraction-tools.js";
import { registerLintReviewTools } from "./lint-review-tools.js";
import { registerMvuVariableTools } from "./mvu-variable-tools.js";
import { registerPlanTools } from "./plan-tools.js";
import { registerProjectTools } from "./project-tools.js";
import { registerStyleChapterTools } from "./style-chapter-tools.js";
import { registerWorldbuildingTools } from "./worldbuilding-tools.js";

export function registerTools(server: McpServer): void {
  registerProjectTools(server);
  registerPlanTools(server);
  registerDraftTools(server);
  registerMvuVariableTools(server);
  registerExportTools(server);
  registerExtractionTools(server);
  registerWorldbuildingTools(server);
  registerStyleChapterTools(server);
  registerLintReviewTools(server);
  registerDecisionTools(server);
}
