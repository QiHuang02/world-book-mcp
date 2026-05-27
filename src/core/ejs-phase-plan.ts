import type { EjsEntryConfig } from "../schemas/ejs.js";
export function createEjsPhasePlan(name = "阶段控制器"): EjsEntryConfig[] { return [{ name, role: "controller", content: "", keys: [], constant: true, position: "before_char", order: 100, enabled: true, variablePaths: [], templateType: "custom", stages: [] }]; }
