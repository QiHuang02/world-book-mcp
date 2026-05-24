import type { Project } from "../schemas/project.js";
import { validateProject } from "./project-validator.js";
import type { ProjectValidationReport } from "./validation-types.js";

export function createFinalReviewReport(project: Project): ProjectValidationReport {
  return validateProject(project, { scope: "all" });
}
