import { describe, expect, it } from "vitest";
import { getToolUsageGuide } from "../src/core/tool-usage-guide.js";

describe("getToolUsageGuide", () => {
  it("returns guide for known tools", () => {
    const guide = getToolUsageGuide("submit_extraction_result");
    expect("tool" in guide && guide.tool).toBe("submit_extraction_result");
  });

  it("returns fallback for unknown tools", () => {
    const guide = getToolUsageGuide("missing_tool");
    expect("available_tools" in guide).toBe(true);
  });
});
