# 工作流

## 原创角色卡

```text
init_project(kind="character_card"|"mixed")
→ request_user_decision / record_user_decision / update_plan
→ update_character_profile(changes={ name, description:"", include_worldbook, worldbook_name, ... })
→ create_draft_slice(draft_type="entry", id="...") + update_draft_fields（角色基础/性格/关系/世界观条目）
→ update_character_greetings(changes={ first_mes, alternate_greetings })
→ validate_draft(scope="character_card")
→ validate_draft(scope="worldbook")
→ 宿主 AI 按 content-rules.md 做内容/禁词/八股自查并改 draft
→ review_project
→ check_delivery(export_target="character_card")
→ generate_json(target="character_card")
```

规则：profile 只保存角色卡字段，`description` 默认空；复杂人设进入 `entry`。开场白必须最后写，确保与角色/世界/MVU 初始状态一致。

## 原创世界书

```text
init_project(kind="worldbook")
→ update_plan（世界类型、边界、条目规划、导出目标）
→ create_draft_slice(draft_type="entry", id="world-summary")
→ update_draft_fields(draft_type="entry", changes={ content, entryType:"world_summary", constant:true, position:"before_char", order:1 })
→ 按规划继续创建 entry slices
→ validate_draft(scope="worldbook")
→ 宿主 AI 按 content-rules.md 做内容/禁词/八股自查并改 draft
→ review_project
→ check_delivery(export_target="worldbook")
→ generate_json(target="worldbook")
```

## 二创 / 材料转化

```text
init_project
→ update_plan（素材来源、sourceRefs、原创补写边界）
→ 宿主 AI 按 derivative-extraction.md 阅读/搜索/整理提取表
→ 将提取表摘要写入 plan 或拆为 entry slices
→ 根据提取表创建 entry slices
→ 如需角色卡：update_character_profile + update_character_greetings
→ validate_draft(scope="all")
→ 宿主 AI 按 content-rules.md 做内容/禁词/八股自查并改 draft
→ review_project
→ check_delivery
→ generate_json
```

原则：来源没有的不补；必须保留 sourceRefs / 章节行号 / 信息来源摘要。二创提取模板、世界观方法论和章节规划属于 skill 层，不再调用 MCP extraction/worldbuilding/chapter 工具。

## 修改已有 JSON

```text
init_project(scan_existing=true, import_strategy="auto", if_exists="return_existing")
→ list_draft_slices(include_content=false)
→ get_project(include_content=true) / get_draft_slice（定位目标）
→ update_plan（记录修改原因和范围）
→ 只改目标 project metadata 或 draft slice
→ validate_draft(scope="all" 或相关 scope)
→ 宿主 AI 按 content-rules.md 做内容/禁词/八股自查并改 draft
→ review_project
→ check_delivery
→ generate_json(overwrite=true)
```

不要直接 patch 最终 JSON；导入后改 project/draft，再导出。

## 断点续作

```text
list_projects
→ get_project(include_content=false)
→ list_draft_slices(include_content=false)
→ list_user_decisions(only_pending=true)
→ 从 plan.md 的 Draft 切片计划继续
```

若 plan 中有未完成条目或 pending decisions，先补 plan / record decision，再继续写 slice。

## MVU 局部任务

```text
create_draft_slice(draft_type="mvu", id="mvu", if_exists="return_existing")
→ list_mvu_variables / upsert_mvu_variable / remove_mvu_variable / rewrite_mvu_variables
→ validate_draft(scope="mvu")
→ build_assets(target="mvu")
→ review_project
```

若必须整段编辑，可 `update_draft_fields(draft_type="mvu", id="mvu", changes={ schema_script, initvar, update_rules, output_format })`，但变量级修改优先用专用工具。

## HTML 局部任务

```text
create_draft_slice(draft_type="html", id="html", if_exists="return_existing")
→ update_draft_fields(draft_type="html", id="html", changes={ statusbar.html, statusbar.hide_regex, global.regex_scripts, target })
→ validate_draft(scope="html")
→ build_assets(target="html")
→ review_project
```

状态栏 HTML 必须作用域化；全局 regex 写入 `global.regex_scripts`。

## EJS 局部任务

```text
确认/创建 mvu slice
→ create_draft_slice(draft_type="ejs", id="...")
→ update_draft_fields(draft_type="ejs", changes={ name, role, content, variable_paths, enabled, constant, order })
→ validate_draft(scope="ejs")
→ build_assets(target="ejs")
→ review_project
```

EJS 必须依赖 MVU。多阶段 stage slice 默认 `enabled=false`，controller 负责按变量加载。

## 文风 / 章节辅助

```text
宿主 AI 按 style-extraction-guide.md / derivative-extraction.md / worldbuilding-methodology.md 分析材料
→ update_plan 记录分析结论与条目规划
→ create_draft_slice(draft_type="entry") 创建风格/章节/世界观辅助条目
→ update_draft_fields 写入 content、keys、position、order 等结构字段
→ validate_draft(scope="worldbook")
```

`style_profile` / `chapter_outline` 不再是 MCP draft_type 或专用工具；它们是 skill 层分析方法，最终产物仍写入 `entry` slices 或 plan。

## 导出流程

```text
validate_draft(scope="delivery")
→ 宿主 AI 按 content-rules.md 做最终内容自查
→ review_project
→ check_delivery(export_target)
→ generate_json(target)
```

存在 blocking 时默认不导出；只有用户明确要求强制导出才传 `force=true`。
