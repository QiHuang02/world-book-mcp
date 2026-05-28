# 任务路由

## 阶段

- 创建：`init_project → update_plan → create_draft_slice → 语义化编辑工具`。
- 修改已有：`init_project(source="modify_existing") → import_existing_json → targeted semantic update`。
- 校验：`validate_project(scope)`。
- 构建：`build_assets(target)`。
- 交付检查：`validate_project(scope="delivery", build_id=...)`。
- 导出：`generate_json(build_id=...)`。
- 查询：`query_json` 或 `get_project/list_draft_slices/get_draft_slice`。
- 共享复用：`share_slice / list_shared / use_shared`。

## 来源

- `original`：原创，从零创建。
- `derivative`：材料转化，来源没有的不补。
- `modify_existing`：修改已有 Tavern JSON，先 import。
- `composite`：组合来源，在 plan 标明原创补写边界。

## 常见任务

| 任务 | 路由 |
|---|---|
| 原创角色卡 | profile/greetings + entry slices + `validate_project(character_card/worldbook)` |
| 纯世界书 | entry slices + `validate_project(worldbook)` |
| 二创转化 | 提取事实 → update_plan → entry slices |
| 修改已有 JSON | import slices → targeted update → build → generate overwrite |
| MVU | mvu runtime slice + `mvu-*` 系统 entry / MVU variable tools → `validate_project(mvu)` → `build_assets(mvu)` |
| HTML | html slice → `validate_project(html)` → `build_assets(html)` |
| regex | regex slice → regex tools → `validate_project(regex)` → `build_assets(regex)` |
| EJS | 确认 MVU → ejs slices → `validate_project(ejs)` → `build_assets(ejs)` |
| 开场白 | `update_character_greetings` → `validate_project(opening)` |
| 交付导出 | `build_assets(all)` → `validate_project(delivery)` → `generate_json` |

## 命名速查

- 输出目标：`worldbook | character_card | both`。
- 项目来源：`original | derivative | modify_existing | composite`。
- Draft 类型：`entry | mvu | html | regex | ejs`。
- 编辑方式：条目正文用 `update_entry_content`，条目配置用 `update_entry_config`，资产使用各自语义化工具。
