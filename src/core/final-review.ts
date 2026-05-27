import type { Project } from "../schemas/project.js";
import { validateProject } from "./project-validator.js";
import type { ProjectValidationReport } from "./validation-types.js";

export function createFinalReviewReport(project: Project & { draft?: import("../schemas/worldbook-draft.js").WorldbookDraftEntry[]; characterCardConfig?: import("../schemas/character-card.js").CharacterCardConfig; mvuConfig?: import("../schemas/mvu.js").MvuConfig; htmlBeautifyConfig?: import("../schemas/html-beautify.js").HtmlBeautifyConfig; ejsConfig?: import("../schemas/ejs.js").EjsConfig }): ProjectValidationReport {
  return validateProject(project, { scope: "all" });
}
