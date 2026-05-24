# 任务路由

按三维判断：阶段、来源、范围。

## 阶段

- 创建：`init_project → update_plan → create_draft_slice → update_draft_field(s)`。
- 修改：`init_project(scan_existing=true) → list_draft_slices → update_plan → update_draft_field(s)`。
- 评估：`validate_draft(scope) → review_project → check_delivery`。
- 查询：`query_json` 或 `get_project/list_draft_slices/get_draft_slice`。

## 来源

- 原创：先确认世界观边界、角色关系、卡型和输出目标。
- 材料转化：先做 extraction outline；来源没有的不补。
- 混合：标明原创补写边界，避免混淆来源事实。
- 修改已有：必须先导入切片，不直接 patch 最终 JSON。

## 范围

- 完整项目：必须走完整主线和 delivery gate。
- 局部任务：只改对应 slice，但仍跑对应 scope 校验。

## 常见任务

- 原创角色卡：profile + greetings + worldbook entries。
- 纯世界书：worldbook entries + validate worldbook/content。
- 二创转化：conversion → planned entries → draft。
- 修改已有 JSON：import slices → targeted update → check_delivery。
- MVU：schema/update_rules → validate_draft(mvu) → build_assets(mvu)。
- EJS：ejs_entry → validate_draft(ejs) → build_assets(ejs)。
- HTML：html_statusbar/html_regex → validate_draft(html) → build_assets(html)。
- 开场白：character_greetings → validate_draft(character_card)。
- 交付导出：review_project → check_delivery → generate_json。
