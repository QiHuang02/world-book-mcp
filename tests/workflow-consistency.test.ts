import { describe, expect, it } from "vitest";
import { getCapabilityMatrix } from "../src/core/capability-matrix.js";
import { getToolUsageGuide } from "../src/core/tool-usage-guide.js";
import { getWorkflow } from "../src/core/workflow.js";

const IMPLEMENTED_NOT_MISSING = [
  "create_character_basic_entry_template",
  "create_character_personality_entry_template",
  "validate_character_entry_structure",
  "create_worldbook_entry_plan",
  "create_derivative_extraction_template",
  "submit_derivative_extraction_outline",
  "validate_derivative_extraction_outline",
  "create_style_extraction_template",
  "submit_style_profile",
  "build_style_worldbook_entries",
  "create_chapter_extraction_template",
  "build_chapter_worldbook_entries",
  "create_html_regex_pair_template",
  "validate_regex_scripts",
  "create_ejs_phase_plan",
];

describe("workflow and capability consistency", () => {
  it("does not reference removed workflow tool names", () => {
    const style = getWorkflow({ task_type: "style_extraction" }).workflow;
    const chapter = getWorkflow({ task_type: "chapter_extraction" }).workflow;

    expect(style).toContain("create_style_extraction_template");
    expect(style).not.toContain("create_style_extraction_outline");
    expect(chapter).toContain("create_chapter_extraction_template");
    expect(chapter).not.toContain("create_chapter_extraction_outline");
  });

  it("does not list implemented tools as missing", () => {
    const matrix = getCapabilityMatrix().entries;
    const missing = matrix.flatMap((entry) => entry.missing_or_planned);
    for (const tool of IMPLEMENTED_NOT_MISSING) {
      expect(missing).not.toContain(tool);
    }
  });

  it("has guides for new character card patch tools", () => {
    for (const tool of ["import_character_card_json", "create_character_card_patch", "preview_character_card_patch", "apply_character_card_patch"]) {
      const guide = getToolUsageGuide(tool);
      expect(guide).toHaveProperty("tool", tool);
    }
  });
});
