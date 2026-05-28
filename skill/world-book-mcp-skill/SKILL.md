---
name: world-book-mcp-skill
description: Use the world-book-mcp MCP server to create, modify, validate, build, import, and export SillyTavern world book JSON and chara_card_v3 character card JSON. Trigger for SillyTavern, 世界书, 酒馆, 角色卡, chara_card_v3, Tavern JSON, .worldbook, plan.md, DraftSlice, MVU/ZOD, HTML状态栏/HTML美化, regex资产, EJS动态条目, init_project, import_existing_json, create_draft_slice, semantic editor tools, validate_project, build_assets, generate_json, or any request to repair or convert existing Tavern world book / character card files.
---

# world-book-mcp v3 操作规范

`world-book-mcp` 用于编排 SillyTavern 世界书与 `chara_card_v3` 角色卡项目。MCP 负责项目元数据、plan、DraftSlice、MVU/HTML/regex/EJS 资产、结构/协议/安全校验、build artifact 与最终导出；内容审美、文风、角色辨识度、世界观方法论和二创提取规则由本技能的 `references/` 承担，不能假定 MCP 会做主观质量 blocking。

## 快速决策

- 完整创建或重构项目时，从 `init_project` 开始。
- 修改已有 JSON 时，也先 `init_project(source="modify_existing")`，再 `import_existing_json`，禁止直接改最终 JSON。
- 只改局部资产时，只编辑对应 DraftSlice，但仍运行对应 scope 校验、构建和交付前校验。
- 不确定关键设定时，用 `update_plan(mode="request_decision"|"record_decision"|"append_decision")` 留痕；不要编造核心事实。
- 完整项目、修改既有 JSON、或涉及 MVU/HTML/regex/EJS 时，先按 `references/writing-plans.md` 写结构化 plan item、验收标准与验证步骤。
- 工具调用日志保持静默，最终回复只给用户需要的结论、文件和验证结果；除非用户要求，不贴 raw tool JSON。

## 初始化前确认

调用 `init_project` 前明确：

```text
output: worldbook | character_card | both
source: original | derivative | modify_existing | composite
assets: mvu / html / regex / ejs 是否 planned
opening: output 包含 character_card 时提供开场白剧情设计
```

`opening` 至少包含：

```text
mode: first_meeting | established_relationship | event_hook | crisis_or_mission | daily_interaction | custom
user_role: unspecified | observer | invited | collaborator | opponent | event_trigger
premise: 开场白剧情前提
user_constraints: 不预设 user 的边界
```

## 标准主线

完整项目默认走：

```text
init_project
→ update_plan
→ create_draft_slice
→ 语义化编辑工具
→ validate_project(scope="all")
→ build_assets(target="all")
→ validate_project(scope="delivery", build_id=...)
→ generate_json(build_id=...)
```

修改已有 JSON 默认走：

```text
init_project(source="modify_existing")
→ import_existing_json（多候选时选择 path）
→ list_draft_slices / get_draft_slice
→ 语义化编辑工具
→ validate_project(scope="all")
→ build_assets(target="all")
→ validate_project(scope="delivery", build_id=...)
→ generate_json(build_id=..., overwrite=true)
```

旧版 `requirements / request_user_decision / update_draft_field / validate_draft / review_project / check_delivery` 不是 v3 主线；除非当前 MCP 明确只暴露旧工具，否则优先使用本文件列出的 v3 工具。

## Project.kind

```text
Project.kind.output = worldbook | character_card | both
Project.kind.source = original | derivative | modify_existing | composite
Project.kind.assets = mvu | html | regex | ejs
```

- `source` 在初始化时明确记录。
- `assets` 在 init 阶段表示 planned，不自动创建空 slice。
- slice 存在且 `active=true` 才表示实际参与 build。
- `mvu`、`html` 单例；`entry`、`regex`、`ejs` 多实例。

## DraftSlice

统一结构：

```text
schemaVersion
id
type: entry | mvu | html | regex | ejs
title
active
source: manual | imported | generated | shared
origin
tags
notes
revision
createdAt / updatedAt
data
```

外层 `active` 表示是否参与 build；内层 `enabled/disabled` 表示最终 SillyTavern 对象自身启用状态。

## 语义化编辑工具速查

| 目标 | 工具 |
|---|---|
| 创建 slice | `create_draft_slice` |
| 改 slice 标题/active/tags/notes | `update_slice_metadata` |
| 写世界书正文 | `update_entry_content` |
| 改世界书 keys/order/position | `update_entry_config` |
| 改角色卡 profile | `update_character_profile` |
| 改 first_mes / alternate_greetings | `update_character_greetings` |
| 查/改 MVU 变量 | `list_mvu_variables` / `upsert_mvu_variable` / `remove_mvu_variable` / `rewrite_mvu_variables` |
| 集中改 MVU 源 | `update_mvu_source` |
| 改 HTML 状态栏正文 | `update_html_statusbar` |
| 改 HTML 配置 | `update_html_config` |
| 查/改 regex | `list_regex_scripts` / `upsert_regex_script` / `update_regex_script` / `remove_regex_script` / `reorder_regex_scripts` / `move_regex_script` |
| 写 EJS 正文 | `update_ejs_content` |
| 改 EJS 配置 | `update_ejs_config` |
| 校验 | `validate_project` |
| 构建 artifact | `build_assets` |
| 导出最终 JSON | `generate_json` |

凭工具名或参数猜不准时，先读 `references/tool-reference.md`，再调用工具。

## 内容与资产规则

世界书条目：

- `update_entry_content` 固定写 XML-wrapped YAML；正文只通过 `update_entry_content` 修改。
- keys/order/position/enabled 等配置只通过 `update_entry_config` 修改。
- 条目应短句、具体、可触发、可维护；绿灯条目必须有 keys。
- 内容层规则：条目中只要提及 user、安排 user 出场或描述可互动对象，必须使用字面占位符 `{{user}}`；不要用 `<user>`、`你`、`用户`、`对方`、`来客` 代替。
- 物品/能力/场景/事件建议 `scanDepth=2`。
- 默认双递归：`preventRecursion=true` 与 `excludeRecursion=true`。

regex：

- regex 是一级资产，`draft_type="regex"`。
- 一个 regex slice 包含一组相关 scripts。
- script 用稳定 `id` 操作，不用数组下标。
- `upsert_regex_script` 是创建/完整替换主入口；`update_regex_script` 只做局部修改。
- 删除最后一个 script 默认 `slice.active=false`。
- MVU/HTML 生成 regex 只进入 regex artifact，不写回 regex slice。

MVU：

- MVU 变量工具会同步影响 `schemaScript / initvar / updateRules`，默认不改 `outputFormat`。
- MVU 变量 path 传相对 `variableListPath` 的路径，例如 `["角色A", "好感度"]`。
- HTML/EJS 引用 MVU 变量时使用完整路径，例如 `stat_data.角色A.好感度`。
- hidden 变量不进入 outputFormat / HTML / EJS。
- readonly 变量可读取，但不应被 updateRules 更新。
- MVU 包含 `export const Schema = z.object(...)` 与 `$(() => registerMvuSchema(Schema))`。
- `initvar/updateRules/outputFormat` 在 slice 内保存纯 YAML/模板文本，由 build 统一包裹成 `<initvar>`、`<variable_update_rules>`、`<variable_output_format>` 条目。
- `schemaScript/initvar/updateRules` 必须相对同一个 `variableListPath`；`variableListPath="stat_data"` 时，`initvar` 不再额外包一层 `stat_data:`。
- 对象节点如 `target` 必须在 `initvar` 同层存在默认结构，或在 schema 对象与子字段上使用 `.prefault(...)`；`expected object, received undefined at target` 优先检查根层级错位。
- updateRules 顶层必须是教程式 `变量更新规则:` YAML；边界约束进 schema `.transform(...).prefault(...)`，不要写 `target.affection = _.clamp(...)` 这类 JS 赋值语句。
- 变量输出格式遵循教程式 `<UpdateVariable><Analysis>...</Analysis><JSONPatch>[...]</JSONPatch></UpdateVariable>`，JSONPatch 路径使用 `/角色/变量`。

HTML/EJS：

- HTML slice 保存状态栏展示配置与 regexPolicy；build 生成 `[不发送]界面占位符` 与 `[界面]状态栏` regex。
- 状态栏使用 `.wbm-statusbar` 作用域；HTML/CSS 使用内联安全结构，不引用外部 URL、不内嵌 `<script>`。
- 状态栏 HTML 展示 MVU 变量时必须使用 `{{format_message_variable::stat_data.角色A.好感度}}`，禁止裸 `{{stat_data...}}` / `{{current_zone}}` 宏。
- `[界面]状态栏` regex 的 `replaceString` 是普通 HTML/CSS 字符串，禁止 `<![CDATA[`、`]]>` 或空 CDATA 壳。
- 内容层规则：`first_mes` 至少 400 个非标点字符；开场白中只要让 user 出场、被称呼、被等待、被邀请或可介入，必须使用 `{{user}}`。
- 启用状态栏时，开场白包含 `<StatusPlaceHolderImpl/>`。
- active EJS 依赖 MVU 与提示词模板插件；stage 默认 `enabled=false`。
- EJS 变量读取用 `getvar('stat_data...')`，跨条目变量声明用 `if (typeof gw === 'undefined') var gw = ...`。
- controller.stages 指向 role=stage 的 EJS slice；通过 `<%- await getwi('stage') %>` 加载，`getwi()` 前必须有 `await`。
- EJS `variablePaths` 只引用可公开变量；绿灯预处理用 `@@preprocessing`。

## validate / build / delivery

`validate_project` 是统一校验入口。

```text
all | project | plan | worldbook | character_card | opening | mvu | html | regex | ejs | assets | build | delivery | content
```

`content` 返回 delegated info，不参与 blocking。交付前需要 fresh build：

```text
build_assets(target="all")
  → build/runs/<build_id>/manifest.json
  → assets/*.json
  → exports/*.preview.json

validate_project(scope="delivery", build_id=...)
  → 检查 fresh build、artifact hash、交付 gate

generate_json(build_id=...)
  → 从 build preview 写最终 JSON
  → export-records/<export_id>.json
```

没有 fresh build 时 delivery 不通过。`force=true` 只用于用户明确要求的强制交付，且不能绕过路径安全、artifact 缺失或 hash mismatch。

## 修改已有 JSON

- `import_existing_json` 将已有 Tavern JSON 转为 slices，并记录 `origin`。
- third-party regex 作为 regex slice 保留。
- 覆盖原导入路径时显式 `overwrite=true`，并自动 backup。
- source of truth 是 v3 project + slices，不是导出的最终 JSON。

## 禁止事项

- 不绕过 `init_project` 开完整项目。
- 不直接修改最终 JSON。
- 不跳过 plan 记录用户决策。
- 不把长篇原文塞进 MCP；只保存结构化提取结果和 draft。
- 不把大段人设塞进 character card `description`。
- 不让 EJS 脱离 MVU。
- 不让 HTML 污染全局 CSS 或依赖外链。
- 不在成品条目里写“这是角色卡/世界书/AI/模型/玩家正在使用”。

## 按需读取 references

| 任务 | 优先读取 |
|---|---|
| 工具参数、field path、scope section | `references/tool-reference.md` |
| 可执行计划、plan item、验收与验证 | `references/writing-plans.md` |
| 任务分流与端到端流程 | `references/task-routing.md`、`references/workflows.md` |
| 需求记录与条目组织 | `references/requirements.md`、`references/composition.md` |
| 内容质量审查 | `references/content-rules.md` |
| 开场白 | `references/first-message.md` |
| MVU/HTML/regex/EJS 一致性 | `references/assets-consistency.md`、`references/multi-stage-ejs.md` |
| 原创角色 | `references/character-creation.md` |
| 世界观 | `references/worldbuilding-methodology.md` |
| 二创提取 | `references/derivative-extraction.md`、示例文件 |
| 文风提取和二次解释 | `references/style-extraction-guide.md`、`references/rephrase-guide.md` |
