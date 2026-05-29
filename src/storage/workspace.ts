import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { ProjectSchema, WorkspaceSchema, assetState, type OutputKind, type Project, type SourceKind, type Workspace } from "../schemas/project.js";
import { CardDraftSchema, WorldbookDraftSchema, AssetsDraftSchema, type AssetsDraft, type CardDraft, type WorldbookDraft } from "../schemas/draft.js";
import { createId, nowIso, slugifyName } from "../utils/ids.js";
import { readTextFile, readYamlFile, writeTextFile, writeYamlFile } from "../utils/yaml.js";
import { WORKSPACE_DIR, assertInside, resolveProjectPath } from "./path-policy.js";

export const WORKSPACE_PATH = path.resolve(WORKSPACE_DIR, "workspace.yaml");
export const PROJECTS_DIR = path.resolve(WORKSPACE_DIR, "projects");

export function projectDir(slug: string): string {
  return assertInside(PROJECTS_DIR, path.resolve(PROJECTS_DIR, slug));
}

export function projectPath(project: Project, key: keyof Project["paths"]): string {
  const projectRoot = projectDir(project.slug);
  const value = project.paths[key];
  if (typeof value !== "string") throw new Error(`path key ${String(key)} 不是字符串路径`);
  return resolveProjectPath(projectRoot, value);
}

export function draftPath(project: Project, target: "card" | "worldbook" | "assets"): string {
  return resolveProjectPath(projectDir(project.slug), project.paths.draft[target]);
}

export function resolveSourcePath(project: Project, relativePath: string): string {
  return resolveProjectPath(projectDir(project.slug), `${project.paths.sourceRoot}/${relativePath}`);
}

export async function ensureWorkspace(): Promise<Workspace> {
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
  try {
    return await readYamlFile(WORKSPACE_PATH, WorkspaceSchema);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const workspace = WorkspaceSchema.parse({ schemaVersion: 5, projects: [] });
    await writeYamlFile(WORKSPACE_PATH, workspace);
    return workspace;
  }
}

export async function saveWorkspace(workspace: Workspace): Promise<void> {
  await writeYamlFile(WORKSPACE_PATH, WorkspaceSchema.parse(workspace));
}

export async function createProject(input: { name: string; output: OutputKind; source: SourceKind; assets?: Partial<Record<"mvu" | "html" | "regex" | "ejs", boolean>>; ifExists?: "error" | "overwrite" }): Promise<{ project: Project; created: boolean; projectPath: string }> {
  const workspace = await ensureWorkspace();
  const slug = slugifyName(input.name);
  const existing = workspace.projects.find((project) => project.slug === slug);
  const ifExists = input.ifExists ?? "error";
  if (existing && ifExists === "error") throw new Error(`项目 ${slug} 已存在；如需覆盖请设置 if_exists=overwrite`);
  if (existing && ifExists === "overwrite") await fs.rm(projectDir(slug), { recursive: true, force: true });

  const timestamp = nowIso();
  const project = ProjectSchema.parse({
    schemaVersion: 5,
    id: existing?.id ?? createId("project"),
    slug,
    name: input.name,
    kind: {
      output: input.output,
      source: input.source,
      assets: {
        mvu: assetState(input.assets?.mvu),
        html: assetState(input.assets?.html),
        regex: assetState(input.assets?.regex),
        ejs: assetState(input.assets?.ejs),
      },
    },
    paths: {
      plan: "plan.md",
      draft: { card: "draft/card.yaml", worldbook: "draft/worldbook.yaml", assets: "draft/assets.yaml" },
      sourceRoot: "source",
      reports: "reports",
      exports: "exports",
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await ensureProjectDirs(project);
  await writeProject(project);
  await ensureDefaultPlan(project);
  await ensureDefaultDrafts(project);

  const entry = { id: project.id, slug, name: project.name, output: project.kind.output, source: project.kind.source, projectPath: path.relative(WORKSPACE_DIR, projectDir(slug)).replace(/\\/g, "/") };
  workspace.projects = existing ? workspace.projects.map((item) => item.slug === slug ? entry : item) : [...workspace.projects, entry];
  workspace.activeProject = slug;
  await saveWorkspace(workspace);
  return { project, created: !existing, projectPath: projectDir(slug) };
}

export async function ensureProjectDirs(project: Project): Promise<void> {
  const root = projectDir(project.slug);
  await fs.mkdir(root, { recursive: true });
  await Promise.all([
    fs.mkdir(path.dirname(draftPath(project, "card")), { recursive: true }),
    fs.mkdir(resolveProjectPath(root, project.paths.sourceRoot), { recursive: true }),
    fs.mkdir(projectPath(project, "reports"), { recursive: true }),
    fs.mkdir(projectPath(project, "exports"), { recursive: true }),
    fs.mkdir(resolveProjectPath(root, `${project.paths.sourceRoot}/fields`), { recursive: true }),
    fs.mkdir(resolveProjectPath(root, `${project.paths.sourceRoot}/entries`), { recursive: true }),
    fs.mkdir(resolveProjectPath(root, `${project.paths.sourceRoot}/mvu`), { recursive: true }),
    fs.mkdir(resolveProjectPath(root, `${project.paths.sourceRoot}/html`), { recursive: true }),
    fs.mkdir(resolveProjectPath(root, `${project.paths.sourceRoot}/regex`), { recursive: true }),
    fs.mkdir(resolveProjectPath(root, `${project.paths.sourceRoot}/ejs`), { recursive: true }),
    fs.mkdir(resolveProjectPath(root, `${project.paths.sourceRoot}/references`), { recursive: true }),
    fs.mkdir(resolveProjectPath(root, `${project.paths.sourceRoot}/extraction`), { recursive: true }),
  ]);
}

export async function writeProject(project: Project): Promise<void> {
  await writeYamlFile(path.resolve(projectDir(project.slug), "project.yaml"), ProjectSchema.parse({ ...project, updatedAt: nowIso() }));
}

export async function readProjectBySlug(slug: string): Promise<Project> {
  return readYamlFile(path.resolve(projectDir(slug), "project.yaml"), ProjectSchema);
}

export async function findProject(slugOrId: string): Promise<Project> {
  const workspace = await ensureWorkspace();
  const entry = workspace.projects.find((project) => project.slug === slugOrId || project.id === slugOrId) ?? (workspace.activeProject && slugOrId === "active" ? workspace.projects.find((project) => project.slug === workspace.activeProject) : undefined);
  if (!entry) throw new Error(`未找到项目: ${slugOrId}`);
  return readProjectBySlug(entry.slug);
}

export async function listProjects(): Promise<Project[]> {
  const workspace = await ensureWorkspace();
  const projects: Project[] = [];
  for (const entry of workspace.projects) {
    try { projects.push(await readProjectBySlug(entry.slug)); } catch { /* ignore broken project */ }
  }
  return projects;
}

export async function readPlan(project: Project): Promise<string> {
  return readTextFile(projectPath(project, "plan"));
}

export async function writePlan(project: Project, content: string): Promise<void> {
  await writeTextFile(projectPath(project, "plan"), content);
}

export async function readDraft(project: Project): Promise<{ card?: CardDraft; worldbook?: WorldbookDraft; assets?: AssetsDraft }> {
  const readOptional = async <T extends z.ZodTypeAny>(filePath: string, schema: T): Promise<z.infer<T> | undefined> => {
    try { return await readYamlFile(filePath, schema); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
  };
  return {
    card: await readOptional(draftPath(project, "card"), CardDraftSchema),
    worldbook: await readOptional(draftPath(project, "worldbook"), WorldbookDraftSchema),
    assets: await readOptional(draftPath(project, "assets"), AssetsDraftSchema),
  };
}

export async function writeDraft(project: Project, target: "card" | "worldbook" | "assets", value: unknown): Promise<string> {
  const schemas = { card: CardDraftSchema, worldbook: WorldbookDraftSchema, assets: AssetsDraftSchema } as const;
  const parsed = schemas[target].parse(value);
  const filePath = draftPath(project, target);
  await writeYamlFile(filePath, parsed);
  return filePath;
}

async function ensureDefaultPlan(project: Project): Promise<void> {
  const filePath = projectPath(project, "plan");
  try { await fs.access(filePath); return; } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  await writeTextFile(filePath, defaultPlan(project));
}

async function ensureDefaultDrafts(project: Project): Promise<void> {
  await ensureDefaultSourceFields(project);
  const card = CardDraftSchema.parse({
    name: project.name,
    description: "",
    personality: "",
    scenario: "",
    first_mes: "../source/fields/first_mes.md",
    alternate_greetings: [],
    mes_example: "",
    creator_notes: "",
    system_prompt: "",
    post_history_instructions: "",
    worldbook: { include: project.kind.output !== "worldbook", name: project.name },
  });
  const worldbook = WorldbookDraftSchema.parse({ name: project.name, entries: [] });
  const assets = AssetsDraftSchema.parse({
    mvu: { enabled: project.kind.assets.mvu === "enabled" },
    html: { statusbar: { enabled: project.kind.assets.html === "enabled" } },
    regex: {},
    ejs: { enabled: project.kind.assets.ejs === "enabled", entries: [] },
  });
  for (const [target, value] of [["card", card], ["worldbook", worldbook], ["assets", assets]] as const) {
    const filePath = draftPath(project, target);
    try { await fs.access(filePath); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; await writeYamlFile(filePath, value); }
  }
}

async function ensureDefaultSourceFields(project: Project): Promise<void> {
  const fields = {
    "personality.md": "",
    "scenario.md": "",
    "first_mes.md": project.kind.assets.mvu !== "disabled" || project.kind.assets.html !== "disabled" ? "<StatusPlaceHolderImpl/>\n" : "",
    "mes_example.md": "",
    "creator_notes.md": "",
    "system_prompt.md": "",
    "post_history_instructions.md": "",
  };
  for (const [filename, content] of Object.entries(fields)) {
    const filePath = resolveProjectPath(projectDir(project.slug), `${project.paths.sourceRoot}/fields/${filename}`);
    try { await fs.access(filePath); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; await writeTextFile(filePath, content); }
  }
}

function defaultPlan(project: Project): string {
  return `# 创作计划：${project.name}\n\n## 1. 用户原始需求\n\n## 2. 项目属性\n\n- 输出目标：${project.kind.output}\n- 来源类型：${project.kind.source}\n- 是否使用 MVU：${project.kind.assets.mvu !== "disabled" ? "是" : "否"}\n- 是否使用 HTML 状态栏：${project.kind.assets.html !== "disabled" ? "是" : "否"}\n- 是否使用 regex：${project.kind.assets.regex !== "disabled" ? "是" : "否"}\n- 是否使用 EJS：${project.kind.assets.ejs !== "disabled" ? "是" : "否"}\n\n## 3. 用户决策记录\n\n| 问题 | 回答 | 说明 |\n|---|---|---|\n\n## 4. 世界观规划\n\n\`\`\`yaml\nworldbuilding:\n  class: A_real_background # A_real_background | B_small_world | C_large_world\n  core_differences: []\n  minimum_setting_set:\n    must_have: []\n    can_omit: []\n  concept_anchors:\n    - name:\n      what:\n      who_uses_it:\n      why_it_matters:\n  entry_plan:\n    - id: world-summary\n      type: world_summary\n      source: source/entries/001-world-summary.xyaml\n\`\`\`\n\n## 5. 角色规划\n\n\`\`\`yaml\ncharacters:\n  - id:\n    name:\n    role:\n    appearance_features: []\n    personality_palette:\n      base_color:\n      dominant_color:\n      accent_color:\n      contradiction:\n      behavioral_evidence: []\n    tri_faceted:\n      public_self:\n      private_self:\n      stress_response:\n    relationships:\n      - target:\n        visible_behavior:\n        hidden_motive:\n        boundary:\n    stage_design:\n      variable: stat_data.phase\n      stages: []\n\`\`\`\n\n## 6. 开场白规划
\n\n- first_mes：\n- alternate greetings 差异维度：时间 / 氛围 / 互动方式 / 空间关系\n\n## 7. 世界书条目规划\n\n| id | 标题 | 类型 | part | scope | 位置 | 蓝/绿灯 | 内容文件 | 依赖来源 | 状态 |\n|---|---|---|---|---|---|---|---|---|---|\n\n\`\`\`yaml\nentries: []\n# - id: character-basic-heroine\n#   type: character_basic\n#   part: basic\n#   scope: catalog\n#   source: source/entries/010-character-basic-heroine.xyaml\n#   dependsOn:\n#     - source/references/chapter-01.md\n#   status: planned\n\`\`\`\n\n## 8. MVU / HTML / regex / EJS 规划\n\n\`\`\`yaml\nmvu:\n  variables: []\nejs:\n  generate_before: []\n  entries: []\nhtml:\n  statusbar: disabled\nregex:\n  scripts: []\n\`\`\`\n\n## 9. 待办清单\n\n- [ ] 初始化项目\n- [ ] 编写世界观条目\n- [ ] 编写角色基础条目\n- [ ] 编写角色性格条目\n- [ ] 编写开场白\n- [ ] 生成 draft YAML\n- [ ] 校验项目\n- [ ] 生成 JSON\n\n## 10. 验收标准\n\n- description 为空字符串\n- first_mes 不预设 {{user}} 的性别、外貌、行为\n- 世界书条目均启用 preventRecursion / excludeRecursion\n- 生成 JSON 可导入 SillyTavern\n\n## 11. 验证记录\n\n## 12. 风险与未决问题\n\n## 13. 二创提取索引\n\n| 标记 | 文件 | 行号 | 类型 | 用途 |\n|---|---|---|---|---|\n`;
}
