import type { Project } from "../schemas/project.js";
import type { ProjectValidationReport } from "./validation-types.js";

type DeliveryStatus = "ok" | "warning" | "blocking";
export interface DeliveryChecklistItem { section: string; title: string; status: DeliveryStatus; blocking: boolean; tools: string[]; issues: Array<{ code: string; message: string; severity: string }> }
export interface DeliveryChecklist { ready_to_export: boolean; export_target: "worldbook" | "character_card" | "both"; items: DeliveryChecklistItem[]; blocking_count: number; warning_count: number }

export function createDeliveryChecklist(input: { project: Project; review: ProjectValidationReport; export_target: "worldbook" | "character_card" | "both"; strict_review?: boolean | "off" | "standard" | "strict" }): DeliveryChecklist {
  const items = Object.entries(input.review.sections).filter(([key]) => key !== "content_policy_delegated").map(([key, section]) => ({ section: key, title: key, status: section.status === "skipped" ? "ok" : section.status as DeliveryStatus, blocking: section.status === "blocking", tools: toolsForSection(key), issues: [...section.errors, ...section.warnings].map((i) => ({ code: i.code, message: i.message, severity: i.severity })) }));
  const blocking_count = items.filter((i) => i.blocking).length;
  const warning_count = items.filter((i) => i.status === "warning").length;
  return { ready_to_export: blocking_count === 0, export_target: input.export_target, items, blocking_count, warning_count };
}
function toolsForSection(section: string): string[] { if (section === "worldbook") return ["update_entry_content", "update_entry_config", "validate_project"]; if (section === "mvu") return ["upsert_mvu_variable", "update_mvu_source", "build_assets"]; if (section === "html") return ["update_html_statusbar", "update_html_config", "build_assets"]; if (section === "regex") return ["upsert_regex_script", "update_regex_script", "build_assets"]; if (section === "ejs") return ["update_ejs_content", "update_ejs_config", "build_assets"]; return ["validate_project"]; }
