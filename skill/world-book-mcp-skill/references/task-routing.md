# 任务路由

按三维判断：阶段、来源、范围。

## 阶段

- 创建：`init_project → update_plan → update_character_profile/greetings（角色卡）→ create_draft_slice → update_draft_field(s)`。
- 修改：`init_project(scan_existing=true) → list_draft_slices/get_project → update_plan → targeted update`。
- 评估：`validate_draft(scope) → skill 内容自查 → review_project → check_delivery`。
- 查询：`query_json` 或 `get_project/list_draft_slices/get_draft_slice`。
- 共享复用：`share_slice / list_shared / use_shared`。

## 来源

- 原创：先确认世界观边界、角色关系、卡型和输出目标；信息不足时主题式逐轮提问。
- 材料转化：宿主 AI 先按 `derivative-extraction.md` 做提取；来源没有的不补。
- 混合：标明原创补写边界，避免混淆来源事实。
- 修改已有：必须先导入切片，不直接 patch 最终 JSON。

## 范围

- 完整项目：必须走完整主线和 delivery gate。
- 局部任务：只改对应 project metadata 或 slice，但仍跑对应 scope 校验。

## 常见任务

| 任务 | 路由 |
|---|---|
| 原创角色卡 | `update_character_profile` + `entry` 角色条目 + `update_character_greetings` + `validate_draft(character_card/worldbook)` + skill 内容自查 |
| 纯世界书 | `entry` slices + `validate_draft(worldbook)` + skill 内容自查 |
| 二创转化 | 按 `derivative-extraction.md` 提取 → `update_plan` → `entry` slices |
| 修改已有 JSON | import slices → targeted update → `check_delivery` → `generate_json(overwrite=true)` |
| MVU | `mvu` slice / MVU variable tools → `validate_draft(mvu)` → `build_assets(mvu)` |
| EJS | 确认 MVU → `ejs` slices → `validate_draft(ejs)` → `build_assets(ejs)` |
| HTML | `html` slice → `validate_draft(html)` → `build_assets(html)` |
| 开场白 | `update_character_greetings` → `validate_draft(character_card)` + skill 内容自查 |
| 文风 | 按 `style-extraction-guide.md` 分析 → `entry` slices 或 plan |
| 章节 | 按 `derivative-extraction.md`/用户材料整理 → `entry` slices 或 plan |
| 交付导出 | `review_project` → `check_delivery` → `generate_json` |

## 旧名迁移提醒

旧 skill 名称不可直接作为当前 `draft_type` 使用：

- `worldbook_entry` 改为 `entry`。
- `character_profile` 改为 `update_character_profile`。
- `character_greetings` 改为 `update_character_greetings`。
- `mvu_schema/mvu_update_rules` 合并为 `mvu`。
- `html_statusbar/html_regex` 合并为 `html`。
- `ejs_entry` 改为 `ejs`。
- `style_profile/chapter_outline` 是 skill 层分析概念，不再对应 MCP 专用工具。
- `lint_worldbook_content/lint_project_content/create_writing_optimization_report` 已迁移为 skill 内容自查。
