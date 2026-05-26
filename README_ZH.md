# world-book-mcp

`world-book-mcp` 是一个 MCP server，用于创建、修改、校验和导出 SillyTavern 世界书 JSON 与 `chara_card_v3` 角色卡 JSON。

## 架构

项目由两层组成：

```text
┌─────────────────────────────────────────────────────┐
│  Skill 层（skill/world-book-mcp-skill/）             │
│  创作方法论：指导 AI 如何设计世界观、写角色、         │
│  提取文风、从小说/网络资源中抽取信息、写开场白        │
│  产出：高质量的结构化语料                            │
└──────────────────────────┬──────────────────────────┘
                           │ AI 调用 MCP 工具写入 project/draft
┌──────────────────────────▼──────────────────────────┐
│  MCP 层（src/）                                      │
│  工程编排器：管理多项目工作区、draft 切片、           │
│  校验一致性、构建 MVU/EJS/HTML 资产、导出酒馆 JSON    │
│  产出：可直接导入 SillyTavern 的 JSON 文件           │
└─────────────────────────────────────────────────────┘
```

## 主线工作流

```text
用户需求
→ init_project
→ update_plan（记录需求、决策、导出目标）
→ update_character_profile / update_character_greetings（角色卡需要时）
→ create_draft_slice / update_draft_field(s)（写入 entry/mvu/html/ejs）
→ validate_draft（校验一致性）
→ build_assets（可选，预览 MVU/EJS/HTML 资产）
→ review_project / check_delivery（交付前审查）
→ generate_json（导出）
```

## Skill 层 — 创作方法论

`skill/world-book-mcp-skill/` 包含指导 AI 创作的 reference 文档：

| 文档 | 内容 |
|------|------|
| `worldbuilding-methodology.md` | 世界观设计：A/B/C 类型判定、维度取舍、总纲零度写作 |
| `character-creation.md` | 角色设定：XML+YAML 结构、性格调色盘、三面性、开场白 |
| `derivative-extraction.md` | 二创提取：从小说/网络资源系统性提取角色、世界观、事件 |
| `style-extraction-guide.md` | 文风提取：分析源材料风格并转化为风格条目和禁词条目 |
| `rephrase-guide.md` | 二次解释：作者对角色深层逻辑的注释，防止 AI 误解 |
| `content-rules.md` | 内容规则：禁词、具体性、第四面墙 |
| `first-message.md` | 开场白规则：吸引力、剧情动力、互动点 |
| `composition.md` | 条目编排：蓝绿灯、position、order、DoubleCheck |
| `requirements.md` | 需求对齐：主题式提问与用户决策流程 |
| `tool-reference.md` | MCP 工具参数速查与旧名映射 |

## MCP 层 — 工程编排

### 工作区结构

`init_project` 创建 v2 多项目工作区：

```text
.worldbook/
  workspace.json
  projects/
    <slug>/
      project.json
      plan.md
      slices/
        entries/*.json     # draft_type="entry"
        assets/*.json      # draft_type="mvu" | "html" | "ejs"
  shared/
    entries/*.json
    assets/*.json
    registry.json
  logs/
    latest.jsonl
    <session>.jsonl
```

自动扫描当前目录下的 SillyTavern JSON 文件：

- 世界书条目 → `entry` slices。
- 角色卡 profile / greetings → project 元数据。
- MVU / HTML / EJS / regex 资产 → `mvu`、`html`、`ejs` slices。

### 核心工具

| 工具 | 用途 |
|------|------|
| `init_project` | 初始化 `.worldbook/` 多项目工作区，扫描并导入已有酒馆 JSON |
| `list_projects` / `get_project` | 查询项目和聚合后的 project 状态 |
| `update_plan` | 写入需求、决策、导出目标到 `plan.md` |
| `update_character_profile` | 更新角色卡 profile 元数据，description 默认留空 |
| `update_character_greetings` | 更新 first_mes / alternate_greetings |
| `create_draft_slice` | 创建 `entry/mvu/html/ejs` draft 切片 |
| `update_draft_field` / `update_draft_fields` | 更新 draft 字段，支持嵌套点路径 |
| `validate_draft` | 校验世界书、角色卡、MVU、EJS、HTML 等 |
| `build_assets` | 预览将合并到角色卡的 MVU/EJS/HTML 资产 |
| `review_project` / `check_delivery` | 交付前审查与阻塞检查 |
| `generate_json` | 导出世界书 JSON、角色卡 JSON 或两者 |
| `query_json` | 查询已导出的 JSON |
| `share_slice` / `use_shared` / `list_shared` | 共享与复用 entry/assets 切片 |

### Draft 类型

当前 `draft_type` 只有四类：

- `entry` — 世界书条目。
- `mvu` — 每项目唯一 MVU ZOD / initvar / update_rules / regex 开关切片，id 固定为 `mvu`。
- `html` — 每项目唯一 HTML 状态栏与全局 regex 配置切片，id 固定为 `html`。
- `ejs` — EJS 动态条目。

旧名映射见 `skill/world-book-mcp-skill/references/tool-reference.md`。

### MVU 变量工具

| 工具 | 用途 |
|------|------|
| `list_mvu_variables` | 列出 schema 中的变量 |
| `upsert_mvu_variable` | 新增/修改变量 |
| `remove_mvu_variable` | 删除变量 |
| `rewrite_mvu_variables` | 批量重写变量 |

### 审查与 lint 工具

| 工具 | 用途 |
|------|------|
| `lint_worldbook_content` | 对文本执行禁词/具体性 lint |
| `lint_project_content` | 对整个项目执行 lint |
| `create_writing_optimization_report` | 写作优化报告 |

## 修改已有 JSON

```text
init_project(scan_existing=true, import_strategy="auto", if_exists="return_existing")
→ list_draft_slices / get_project / get_draft_slice
→ update_plan
→ update_character_profile / update_character_greetings / update_draft_field(s)
→ validate_draft
→ review_project / check_delivery
→ generate_json(overwrite=true)
```

## 日志

MCP 静默记录工具调用摘要：

```text
.worldbook/logs/latest.jsonl
.worldbook/logs/<session>.jsonl
```

长文本字段以 preview + length + hash 形式记录。

## 开发

```bash
npm install
npm run typecheck
npm test
```
