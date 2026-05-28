import type { Project } from "../schemas/project.js";
import { validateProject } from "./project-validator.js";
import type { ProjectValidationReport } from "./validation-types.js";

type DeliveryStatus = "ok" | "warning" | "blocking";
export interface DeliveryChecklistItem { section: string; title: string; status: DeliveryStatus; blocking: boolean; tools: string[]; issues: Array<{ code: string; message: string; severity: string }> }
export interface DeliveryChecklist { ready_to_export: boolean; export_target: "worldbook" | "character_card" | "both"; items: DeliveryChecklistItem[]; blocking_count: number; warning_count: number }

export function createDeliveryChecklist(input: { project: Project; review?: ProjectValidationReport; export_target: "worldbook" | "character_card" | "both"; strict_review?: boolean | "off" | "standard" | "strict" }): DeliveryChecklist {
  const review = input.review ?? validateProject(input.project, { scope: "delivery", export_target: input.export_target });
  const items = Object.entries(review.sections).filter(([key]) => key !== "content_policy_delegated").map(([key, section]) => ({ section: key === "worldbook" ? "worldbook_draft" : key, title: key, status: section.status === "skipped" ? "ok" : section.status as DeliveryStatus, blocking: section.status === "blocking", tools: toolsForSection(key), issues: [...section.errors, ...section.warnings].map((i) => ({ code: i.code, message: i.message, severity: i.severity })) }));
  if ((input.project.plan.plan_items?.length ?? 0) > 0) {
    const summary = input.project.plan.plan_items!.reduce((acc, item) => { acc[item.status] += 1; return acc; }, { pending: 0, in_progress: 0, blocked: 0, done: 0, skipped: 0 });
    items.push({ section: "plan_items", title: "plan_items", status: summary.blocked > 0 || summary.pending + summary.in_progress > 0 ? "blocking" : "ok", blocking: summary.blocked > 0 || summary.pending + summary.in_progress > 0, tools: ["update_plan"], issues: input.project.plan.plan_items!.filter((item) => !["done", "skipped"].includes(item.status)).map((item) => ({ code: `plan.item.${item.status}`, message: `${item.id}: ${item.title}`, severity: item.status === "blocked" ? "error" : "warning" })) });
  }
  const blocking_count = items.filter((i) => i.blocking).length;
  const warning_count = items.filter((i) => i.status === "warning").length;
  return { ready_to_export: blocking_count === 0, export_target: input.export_target, items, blocking_count, warning_count };
}
function toolsForSection(section: string): string[] { if (section === "worldbook") return ["update_entry_content", "update_entry_config", "validate_project"]; if (section === "mvu") return ["upsert_mvu_variable", "update_mvu_source", "build_assets"]; if (section === "html") return ["update_html_statusbar", "update_html_config", "build_assets"]; if (section === "regex") return ["upsert_regex_script", "update_regex_script", "build_assets"]; if (section === "ejs") return ["update_ejs_content", "update_ejs_config", "build_assets"]; return ["validate_project"]; }
