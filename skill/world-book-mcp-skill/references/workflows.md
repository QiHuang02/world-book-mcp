# v3 工作流

## 原创角色卡

```text
init_project(output="character_card"|"both", source="original", assets?, opening)
→ update_plan
→ update_character_profile(description="", include_worldbook=true, ...)
→ create_draft_slice(draft_type="entry", id="char-basic")
→ update_entry_content / update_entry_config
→ update_character_greetings
→ validate_project(scope="all")
→ build_assets(target="all")
→ validate_project(scope="delivery", build_id=...)
→ generate_json(build_id=...)
```

## 原创世界书

```text
init_project(output="worldbook", source="original")
→ update_plan
→ create_draft_slice(draft_type="entry", id="world-summary")
→ update_entry_content / update_entry_config
→ validate_project(scope="worldbook")
→ build_assets(target="all")
→ validate_project(scope="delivery", build_id=...)
→ generate_json(build_id=...)
```

## 二创 / 材料转化

```text
init_project(output=..., source="derivative", opening?若角色卡)
→ update_plan 记录来源、边界、sourceRefs
→ 按 derivative-extraction.md 提取事实
→ 创建 entry slices 并写入内容/配置
→ 如需角色卡：update_character_profile + update_character_greetings
→ validate_project(scope="all")
→ build_assets(target="all")
→ generate_json
```

原则：来源没有的不补；不把大段原文塞进 MCP。

## 修改已有 JSON

```text
init_project(output=..., source="modify_existing", scan_existing=true, import_strategy="auto")
→ 多候选时 import_existing_json(path=...)
→ list_draft_slices / get_draft_slice 定位目标
→ 语义化工具修改 project metadata 或 slices
→ validate_project(scope="all")
→ build_assets(target="all")
→ validate_project(scope="delivery", build_id=...)
→ generate_json(build_id=..., overwrite=true)
```

不直接 patch 最终 JSON；覆盖导入源路径时由 generate_json 自动 backup。

## MVU 局部任务

```text
create_draft_slice(draft_type="mvu")
→ list_mvu_variables / upsert_mvu_variable / remove_mvu_variable / rewrite_mvu_variables
→ validate_project(scope="mvu")
→ build_assets(target="mvu") 或 build_assets(target="all")
```

需要集中调整 schemaScript/initvar/updateRules/outputFormat 时使用 `update_mvu_source`；日常变量增删改优先使用 MVU 变量工具。

## HTML 局部任务

```text
create_draft_slice(draft_type="html")
→ update_html_statusbar / update_html_config
→ validate_project(scope="html")
→ build_assets(target="html") 或 build_assets(target="all")
```

通用 regex 不写进 HTML；使用 regex slice。

## regex 局部任务

```text
create_draft_slice(draft_type="regex", id="...")
→ upsert_regex_script / update_regex_script / remove_regex_script
→ validate_project(scope="regex")
→ build_assets(target="regex")
```

## EJS 局部任务

```text
确认或创建 MVU
→ create_draft_slice(draft_type="ejs", id="...")
→ update_ejs_content / update_ejs_config
→ validate_project(scope="ejs")
→ build_assets(target="ejs") 或 build_assets(target="all")
```

stage 默认 `enabled=false`。

## 修复已有 MVU+HTML 角色卡

用于处理导入卡中状态栏 CDATA、裸 `{{stat_data...}}` 宏、MVU 根层级错位或旧式 updateRules：

```text
init_project(source="modify_existing")
→ import_existing_json
→ list_draft_slices / get_draft_slice
→ list_regex_scripts：检查 [界面]状态栏 replaceString 是否含 CDATA
→ get_draft_slice(draft_type="html")：检查裸 {{stat_data...}} 宏
→ get_draft_slice(draft_type="mvu")：检查 schemaScript/initvar 是否重复 stat_data 根层级
→ update_regex_script / update_html_statusbar / update_mvu_source 或 rewrite_mvu_variables
→ validate_project(scope="mvu")
→ validate_project(scope="html")
→ validate_project(scope="regex")
→ build_assets(target="all", force=true 如需避开旧 artifact 缓存)
→ generate_json(build_id=...)
```

验收项：

- 导出预览 JSON 不含 `<![CDATA[` 或 `]]>`。
- `[界面]状态栏.replaceString` 不含裸 `{{stat_data`，只使用 `{{format_message_variable::...}}`。
- `<initvar>` 内没有多余根键 `stat_data:`，除非 schema 明确也以 `stat_data` 为根且 plan 记录了原因；默认禁止。
- `target` 在 schema 与 initvar 中处于同一层级，避免 `expected object, received undefined at target`。
- `[mvu_update]变量更新规则` 顶层是 `变量更新规则:`，不是 JS 执行语句。

## 导出流程

```text
validate_project(scope="all")
→ build_assets(target="all")
→ validate_project(scope="delivery", build_id=...)
→ 内容自查
→ generate_json(build_id=...)
```

存在 blocking 时默认不导出；只有用户明确要求强制导出才传 `force=true`。
