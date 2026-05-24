import type { Project } from "../schemas/project.js";
import { validateProject } from "./project-validator.js";
import { sectionStatus, type ProjectValidationReport, type ValidationSection } from "./validation-types.js";

export type FinalReviewReport = ProjectValidationReport;
export type DeliveryStatus = "ok" | "warning" | "blocking";

export function sectionDeliveryStatus(section: ValidationSection | undefined, fallback: DeliveryStatus = "warning"): DeliveryStatus {
  return sectionStatus(section, fallback);
}

export function createFinalReviewReport(project: Project): FinalReviewReport {
  return validateProject(project, { scope: "all" });
}
