import { describe, expect, it } from "vitest";
import { getWorkflow } from "../src/core/workflow.js";

describe("getWorkflow", () => {
  it("appends character card tools when requested", () => {
    const result = getWorkflow({ task_type: "from_text", wants_character_card: true });
    expect(result.workflow).toContain("create_character_card_template");
    expect(result.workflow).toContain("generate_character_card_json");
  });

  it("appends mvu tools when requested", () => {
    const result = getWorkflow({ task_type: "from_text", wants_character_card: true, wants_mvu: true });
    expect(result.workflow).toContain("create_mvu_schema_template");
    expect(result.workflow).toContain("build_mvu_assets");
  });

  it("appends html tools when requested", () => {
    const result = getWorkflow({ task_type: "from_text", wants_character_card: true, wants_html: true });
    expect(result.workflow).toContain("create_html_beautify_template");
    expect(result.workflow).toContain("build_html_beautify_assets");
  });

  it("appends ejs tools when requested", () => {
    const result = getWorkflow({ task_type: "from_text", wants_character_card: true, wants_mvu: true, wants_ejs: true });
    expect(result.workflow).toContain("create_ejs_template");
    expect(result.workflow).toContain("build_ejs_entries");
  });

  it("supports worldbuilding workflow", () => {
    const result = getWorkflow({ task_type: "worldbuilding_only" });
    expect(result.workflow).toContain("create_worldbuilding_outline");
    expect(result.workflow).toContain("create_final_review_report");
  });
});
