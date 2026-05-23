import { describe, expect, it } from "vitest";
import { getCapabilityMatrix } from "../src/core/capability-matrix.js";
import { getToolUsageGuide } from "../src/core/tool-usage-guide.js";

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
  it("does not expose removed workflow and full-draft guides", () => {
    for (const tool of ["get_worldbook_workflow", "create_worldbook_draft_template", "update_worldbook_draft_entries"]) {
      const guide = getToolUsageGuide(tool);
      expect(guide).toHaveProperty("available_tools");
      expect("available_tools" in guide && guide.available_tools).not.toContain(tool);
    }
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
