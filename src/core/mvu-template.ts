import type { MvuConfig } from "../schemas/mvu.js";

export function createDefaultMvuConfig(): MvuConfig {
  return { schemaScript: "", initvar: "", updateRules: "", variableListPath: "stat_data", hideRegex: true, beautifyRegex: true };
}
