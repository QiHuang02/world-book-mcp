---
name: world-book-mcp-skill
description: Use the world-book-mcp MCP server to create, modify, validate, and export SillyTavern world book JSON and chara_card_v3 character card JSON through the new .worldbook/plan.md + .worldbook/draft/ workflow, including existing JSON slicing, MVU/ZOD, HTML status bars, EJS dynamic entries, and silent MCP tool logs. Invoke whenever the user mentions SillyTavern, 世界书, 酒馆, 角色卡, chara_card_v3, MVU, HTML美化, EJS, draft, plan.md, init_project, create_draft_slice, update_draft_field, validate_draft, generate_json, or modifying existing Tavern JSON.
---

# world-book-mcp 新主线流程

`world-book-mcp` 用于把用户创作需求转成 SillyTavern 可导入 JSON。当前主线不再围绕一组分散 upsert/import/patch 工具，而是固定使用：

```text
用户提出需求
→ init_project
→ AI 追问并写 .worldbook/plan.md
→ 创建 .worldbook/draft/ 切片
→ 统一逐字段填写 draft
→ 校验 draft
→ generate_json 导出
```

MCP 会在 `.worldbook/logs/` 静默记录工具调用摘要，包括 AI 提交了什么、MCP 返回了什么、错误是什么。日志默认只记录长文本 preview、长度和 hash。

## 绝对起手式

任何完整创作、修改、导出任务都必须这样开始：

1. 用户提出需求。
2. **立即调用 `init_project`。这是固定第二步。**
3. 根据 `init_project` 返回的扫描/切片结果，再向用户提问。
4. 用 `update_plan` 把用户需求、回答、导出目标写入 `.worldbook/plan.md`。
5. 用 `create_draft_slice` 创建需要的 draft。
6. 用 `update_draft_field` / `update_draft_fields` 逐字段填写。
7. 用 `validate_draft` 校验。
8. 用 `generate_json` 导出。

不要先长篇规划再初始化；如果用户要修改已有角色卡/世界书，只有 `init_project` 扫描后才知道目录里有什么。

## init_project 的职责

`init_project` 是项目入口，负责：

- 创建 `.worldbook/`。
- 创建 `.worldbook/project.json`。
- 创建 `.worldbook/plan.md`。
- 创建 `.worldbook/draft/` 子目录。
- 创建 `.worldbook/logs/`。
- 扫描当前目录已有 SillyTavern JSON。
- 自动切片已有：
  - 独立世界书条目 → `draft/worldbook/`
  - 角色卡 profile → `draft/character-card/`
  - greetings → `draft/character-card/`
  - 内嵌世界书 → `draft/worldbook/`
- 返回导入摘要和下一步建议。

修改第三方角色卡/世界书时，不需要单独 import/patch 流程；统一走 `init_project → draft → validate → generate_json`。

## plan.md 的定位

`.worldbook/plan.md` 是创作蓝图，记录“为什么这样做”。draft 是合并导出的真实数据源。

必须记录：

- 用户原始需求。
- 任务类型：原创 / 文本提取 / 混合 / 修改已有 JSON。
- 输出目标：世界书 / 角色卡 / both。
- 是否启用 MVU / HTML / EJS。
- 用户关键回答。
- 世界观、角色、事件、物品、能力、文风要求。
- draft 切片计划。
- 校验计划。
- 导出文件名和 strict review 选择。

导出目标必须通过 `update_plan(mode="set_export_target")` 写入 plan，或在 `generate_json.target` 中显式指定。

## draft 工作区

`.worldbook/draft/` 是唯一工作区。不要直接修改最终 JSON。

常用 draft 类型：

- `worldbook_entry`：世界书条目。
- `character_profile`：角色卡 profile。
- `character_greetings`：first_mes 和 alternate greetings。
- `mvu_schema`：MVU/ZOD schema。
- `mvu_update_rules`：initvar 和 update_rules。
- `html_statusbar`：HTML 状态栏。
- `html_regex`：HTML/regex 脚本。
- `ejs_entry`：EJS 动态条目。
- `style_profile`：文风需求。
- `chapter_outline`：章节概要。

创建 draft：

```text
create_draft_slice(project_id, draft_type, id, title?)
```

填写字段：

```text
update_draft_field(project_id, draft_type, id, field_path, value)
update_draft_fields(project_id, draft_type, id, changes)
```

字段示例：

```text
worldbook_entry.content
worldbook_entry.keys
worldbook_entry.constant
worldbook_entry.position
worldbook_entry.order
character_profile.name
character_profile.system_prompt
character_profile.include_worldbook
character_greetings.first_mes
character_greetings.alternate_greetings
mvu_schema.schema_script
mvu_schema.variable_list_path
mvu_update_rules.initvar
mvu_update_rules.update_rules
html_statusbar.html
html_statusbar.theme
ejs_entry.content
ejs_entry.keys
```

当前 `field_path` 使用顶层字段名，例如 `content`、`keys`、`first_mes`，不要传 `worldbook_entry.content`。

## 校验与导出

校验：

```text
validate_draft(scope="all")
```

可选 scope：

- `worldbook`
- `character_card`
- `mvu`
- `html`
- `ejs`
- `all`

资产预览：

```text
build_assets(target="mvu" | "html" | "ejs" | "all")
```

导出：

```text
generate_json(target="worldbook" | "character_card" | "both")
```

导出前必须确保：

- 世界书 draft 没有空 content。
- 绿灯条目 `constant=false` 必须有 `keys`。
- 角色卡必须有 `character_profile` 和 `character_greetings.first_mes`。
- 启用 MVU 时开场白末尾必须有 `<StatusPlaceHolderImpl/>`。
- HTML 状态栏 CSS 不使用全局污染选择器。
- EJS 依赖 MVU，变量路径以 `stat_data` 开头。

## 主流程模板

### 原创角色卡

```text
init_project
→ 询问角色、世界观、输出目标、是否启用 MVU/HTML/EJS、文风
→ update_plan 记录需求与导出目标
→ create_draft_slice(character_profile)
→ create_draft_slice(character_greetings)
→ create_draft_slice(worldbook_entry...) 创建角色基础/性格/背景/关系条目
→ update_draft_field(s) 填写
→ validate_draft(all)
→ generate_json(character_card)
```

### 根据小说/文本生成角色卡或世界书

```text
init_project
→ 宿主 AI 阅读材料并整理结构化事实
→ update_plan 记录来源、提取结果和用户选择
→ create_draft_slice 创建角色/世界观/事件/物品条目
→ update_draft_field(s) 填写
→ validate_draft(all)
→ generate_json
```

不要把整篇原文塞进 MCP。原文由宿主 AI 在对话内阅读和摘要，MCP 只保存 plan、draft、config 和导出产物。

### 修改已有角色卡/世界书

```text
init_project(scan_existing=true, import_strategy="auto")
→ MCP 自动切片已有 JSON
→ AI 根据切片结果询问修改目标
→ update_plan 记录修改计划
→ update_draft_field(s) 修改相关切片
→ validate_draft(all)
→ generate_json(overwrite=true 或输出新文件)
```

不再使用旧的 import/patch 工具作为主流程。

## 主工具清单

- `init_project` — 固定第二步；初始化 `.worldbook/` 并自动扫描/切片已有 JSON。
- `get_project` — 查看项目状态。
- `list_projects` — 查看当前工作区项目。
- `update_plan` — 写入 `.worldbook/plan.md`。
- `create_draft_slice` — 创建统一 draft 切片。
- `update_draft_field` — 更新单个 draft 字段。
- `update_draft_fields` — 更新同一 draft 的多个字段。
- `list_draft_slices` — 列出 draft。
- `get_draft_slice` — 读取 draft。
- `delete_draft_slice` — 删除 draft。
- `validate_draft` — 统一校验。
- `build_assets` — 预览 MVU/HTML/EJS 合并资产。
- `generate_json` — 导出 SillyTavern JSON。
- `query_json` — 查询导出后的 JSON。

## 红线

- 不要绕过 `init_project` 做完整项目。
- 不要直接修改最终 JSON。
- 不要绕过 `.worldbook/draft/` 写入最终数据。
- 不要跳过 `.worldbook/plan.md` 记录用户决策和导出目标。
- 不要把长原文直接塞进 MCP。
- 不要让 EJS 在没有 MVU 的情况下启用。
- 不要让 HTML 使用 `body`、`html`、`*` 等全局选择器污染酒馆界面。
