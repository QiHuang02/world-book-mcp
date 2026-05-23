import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCharacterCardTools } from "./character-card-tools.js";
import { registerDecisionTools } from "./decision-tools.js";
import { registerExtractionTools } from "./extraction-tools.js";
import { registerLintReviewTools } from "./lint-review-tools.js";
import { registerMvuHtmlEjsTools } from "./mvu-html-ejs-tools.js";
import { registerProjectTools } from "./project-tools.js";
import { registerStyleChapterTools } from "./style-chapter-tools.js";
import { registerWorldbookTools } from "./worldbook-tools.js";
import { registerWorldbuildingTools } from "./worldbuilding-tools.js";

export function registerTools(server: McpServer): void {
  registerProjectTools(server);
  registerExtractionTools(server);
  registerWorldbuildingTools(server);
  registerWorldbookTools(server);
  registerCharacterCardTools(server);
  registerMvuHtmlEjsTools(server);
  registerStyleChapterTools(server);
  registerLintReviewTools(server);
  registerDecisionTools(server);
}
