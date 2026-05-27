import type { EjsEntryConfig } from "../schemas/ejs.js";
export function createEjsControllerTemplate(name = "阶段控制器"): EjsEntryConfig { return { name, role: "controller", content: "", keys: [], constant: true, position: "before_char", order: 100, enabled: true, variablePaths: [], templateType: "custom", stages: [] }; }
export function createEjsStageTemplate(name = "阶段条目"): EjsEntryConfig { return { name, role: "stage", content: "", keys: [], constant: true, position: "before_char", order: 100, enabled: false, variablePaths: [], templateType: "custom" }; }
