import { describe, expect, it } from "vitest";
import { classifyWorldbookTask } from "../src/core/task-classifier.js";

describe("classifyWorldbookTask", () => {
  it("detects html beautify tasks", () => {
    const result = classifyWorldbookTask({ request: "给角色卡加 HTML 状态栏美化" });
    expect(result.task_type).toBe("html_beautify");
  });

  it("detects derivative extraction tasks", () => {
    const result = classifyWorldbookTask({ request: "根据这段原作文本提取二创世界书" });
    expect(result.task_type).toBe("derivative_extraction");
    expect(result.original_or_derivative).toBe("derivative");
  });
});
