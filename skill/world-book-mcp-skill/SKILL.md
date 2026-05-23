---
name: world-book-mcp-skill
description: Use the world-book-mcp MCP server to author SillyTavern world books, chara_card_v3 character cards, MVU/ZOD variable systems, HTML status-bar beautification, and EJS dynamic content. Invoke this skill whenever the user wants to build, modify, validate, query, import, or export SillyTavern world books or character cards (single, multi, worldbook-only, derivative novel extraction, item/equipment, style profile, chapter outline, content lint), or whenever the user mentions tools like init_project, create_worldbook_draft_entry, update_worldbook_draft_field, confirm_worldbook_draft_complete, upsert_character_profile, ingest_text_source, plan_worldbook_entries, generate_worldbook_json, generate_character_card_json, request_user_decision.
---

# world-book-mcp 使用指南

`world-book-mcp` 是一个 MCP 服务器，用于辅助 AI 生成、校验、查询和 patch SillyTavern 世界书 JSON、`chara_card_v3` 角色卡 JSON，以及 MVU/ZOD 变量系统、HTML 状态栏美化和 EJS 动态内容资产。

本 skill 教 AI 如何正确编排这些 MCP 工具完成端到端任务。

## 何时触发

满足以下任一条件时使用本 skill：

- 用户提到"世界书"、"world book"、"SillyTavern"、"角色卡"、"chara card"、"chara_card_v3"。
- 用户希望抽取一段文本或一部小说的设定，输出可导入 SillyTavern 的 JSON。
- 用户希望生成、修改、校验、合并、查询世界书或角色卡 JSON。
- 用户希望加 MVU/ZOD 变量系统、HTML 状态栏、EJS 阶段化人设。
- 用户提到本 skill 工具清单中的任何工具名（`ingest_text_source`、`plan_worldbook_entries`、`generate_worldbook_json`、`generate_character_card_json`、`request_user_decision` 等）。

## 使用思路

完成一个世界书或角色卡任务时，按“判断目标 → 整理材料 → 写入草稿 → 校验导出”的顺序推进。

1. **先判断目标**
   - 判断用户要做的是原创、二创提取、修改已有 JSON、查询、自查，还是 MVU/HTML/EJS 扩展。
   - 卡型、世界观类型、是否启用 MVU/HTML/EJS 不明确时，先向用户确认。

2. **再整理材料**
   - 用户给出长文本时，先阅读并整理出结构化事实，再提交给项目。
   - 网页资料先在对话中搜索和整理成摘要、facts、来源 URL，再用 `ingest_web_research` 保存。

3. **最后写入与导出**
   - 世界书条目先用 `create_worldbook_draft_entry(s)` 创建分片模板，再用 `update_worldbook_draft_field(s)` 逐字段填充。
   - 角色卡字段用 `upsert_character_profile` 保存。
   - 导出前先校验；需要严格交付时使用 `create_delivery_checklist` 或 `strict_review`。

## 首选起手式

拿到任意需求请按下面顺序起手，不要直接跳到具体工具：

1. 按 [`references/task-routing.md`](references/task-routing.md) 判断任务类型。
2. 如果用户目标、卡型、世界观类型、是否启用 MVU/HTML/EJS 不明确，先列出需要确认的问题。
3. 按 [`references/workflows.md`](references/workflows.md) 选择合适流程，并根据用户目标裁剪步骤。
4. 字段不确定时先查本工具清单与 [`references/config-rules.md`](references/config-rules.md)；需要模板或配置说明时调用 `get_entry_template` / `explain_worldbook_config`。
5. 需要记录用户选择时，使用 `request_user_decision` / `record_user_decision`。

详细工作流见 [`references/workflows.md`](references/workflows.md)。

## 完整工具清单

下列分组覆盖常用工具。日常写入必须先创建 draft 切片模板，再逐字段更新；完整 config 提交仅用于高级场景。

### 参考模板 / 配置说明

- `get_entry_template` — 按 entryType 取条目模板。
- `explain_worldbook_config` — 解释 position / constant / order / keys / scanDepth / recursion。

任务类型、卡型、世界观类型和能力选择规则见 [`references/task-routing.md`](references/task-routing.md)。

### 项目与素材

- `init_project` — 初始化当前目录的 `.worldbook/project.json` 与 `.worldbook/draft/`；若根目录没有酒馆格式 JSON，会安全创建模板 JSON；若已有世界书/角色卡 JSON，则不创建模板也不覆盖。
- `list_projects` — 列出本地保存的 MCP project。
- `get_project` — 查看 project 状态摘要或全量。
- `ingest_text_source` — 保存用户文本素材。
- `ingest_web_research` — 保存已整理好的网页摘要。

### 提取

- `create_extraction_outline` — 创建结构化提取模板（角色 / 世界 / 物品 / 事件）。
- `submit_extraction_result` — 提交从素材中抽取的结构化事实。
- `plan_worldbook_entries` — 把 extraction 转成条目计划。
- `create_derivative_extraction_template` — 二创长文 outline（章节索引 + 角色 8 维 + 世界 5 维）。
- `submit_derivative_extraction_outline` — 提交二创 outline，可同步成 extraction。
- `validate_derivative_extraction_outline` — 单独校验二创 outline。

### 世界观设计

- `create_worldbuilding_outline` — 简单世界观提取模板。
- `submit_worldbuilding_summary` — 保存世界观摘要。
- `validate_worldbuilding_summary` — 校验摘要。
- `create_worldbuilding_design_template` — 按 A/B/C 类型生成设计模板。
- `validate_worldbuilding_design` — 校验设计填写。

### 世界书条目模板与校验

- `create_character_basic_entry_template` — 角色基础设定 XML+YAML 模板。
- `create_character_personality_entry_template` — 角色性格条目模板。
- `validate_character_entry_structure` — 校验角色条目结构。
- `validate_character_appearance_distinctiveness` — 检查外貌描写是否过于通用。
- `validate_item_entry` — 校验物品 / 装备 / 能力条目。

### 世界书规划 / 起草 / 导入导出

- `create_worldbook_entry_plan` — 综合 extraction + 卡型生成完整条目表。
- `validate_worldbook_entry_plan` — 校验条目表 position / order / keys。
- `create_worldbook_draft_entry` — 创建单个 `.worldbook/draft/*.json` 切片模板。
- `create_worldbook_draft_entries` — 批量创建切片模板。
- `update_worldbook_draft_field` — 按 comment 定位并逐字段更新 draft。
- `update_worldbook_draft_fields` — 一次更新少量 draft 字段。
- `confirm_worldbook_draft_complete` — 确认所有 draft 完整且可合并导出。
- `list_worldbook_draft_entries` — 列出 `.worldbook/draft/*.json` 分片草稿。
- `get_worldbook_draft_entry` — 按 comment 读取单个分片草稿。
- `delete_worldbook_draft_entry` — 按 comment 删除单个分片草稿。
- `validate_worldbook_draft` — 校验 draft 配置和内容。
- `generate_worldbook_json` — 导出独立 SillyTavern 世界书 JSON，导出后保留 `.worldbook/draft/*.json`。
- `import_worldbook_json` — 把当前工作目录内已有 JSON 切片导入为 project draft。
- `create_worldbook_patch` — 创建修改计划（不写文件）。
- `preview_worldbook_patch` — 预览 patch diff 与校验。
- `apply_worldbook_patch` — 应用 patch、自动校验、可备份覆盖，并保留更新后的 draft。
- `query_worldbook` — `brief` / `uid` / `search` / `stats` 查询。

### 角色卡

- `import_character_card_json` — 导入当前目录内已有 `chara_card_v3` 角色卡 JSON，提取 profile 并将内嵌世界书切片为 draft。
- `upsert_character_profile` — 用简化字段创建/更新角色卡人设配置，MCP 自动补齐 `chara_card_v3` 默认字段。
- `validate_character_card_config` — 校验角色卡 config 与嵌入世界书。
- `confirm_character_card_draft_complete` — 确认角色卡 profile、内嵌世界书 draft 与资产可合并导出。
- `validate_greetings` — 单独校验 first_mes 与 alternate_greetings。
- `generate_character_card_json` — 导出 chara_card_v3 角色卡 JSON（自动合并 MVU / HTML / EJS），导出后保留 draft。
- `create_character_card_patch` — 创建角色卡 profile / worldbook config / 内嵌世界书修改计划。
- `preview_character_card_patch` — 预览角色卡 patch diff 与校验。
- `apply_character_card_patch` — 应用角色卡 patch，安全导出 JSON、更新 project，并保留更新后的 draft。
- `query_character_card` — 查询导出的角色卡 JSON。

### MVU / HTML / EJS

- `create_mvu_schema_template` — 创建 MVU/ZOD config 模板。
- `upsert_mvu_schema` — 局部更新 MVU schema 与变量路径。
- `upsert_mvu_update_rules` — 局部更新 MVU initvar 与 update_rules。
- `submit_mvu_config` — 高级入口：保存完整 MVU config。
- `validate_mvu_config` — 校验 ZOD schema、initvar、update_rules、占位符。
- `build_mvu_assets` — 预览将合并的世界书条目 / 正则 / Tavern Helper 脚本。
- `create_html_beautify_template` — 创建状态栏 / 全局 HTML 美化模板。
- `upsert_html_statusbar` — 局部更新状态栏 HTML、主题和开关。
- `submit_html_beautify_config` — 高级入口：保存完整 HTML 美化 config。
- `validate_html_beautify_config` — 校验 HTML、CSS 作用域、正则配置。
- `build_html_beautify_assets` — 预览将合并的 regex scripts。
- `create_html_regex_pair_template` — 单独生成显示 / 隐藏正则对模板。
- `validate_regex_scripts` — 单独校验一组 regex scripts。
- `create_ejs_phase_plan` — 阶段化人设规划模板。
- `create_ejs_template` — `phase_profile` / `palette` / `custom` EJS 模板。
- `upsert_ejs_entry` — 按 name 局部新增/更新单个 EJS entry。
- `submit_ejs_config` — 高级入口：保存完整 EJS config。
- `validate_ejs_config` — 校验 MVU 依赖、变量路径、EJS 标签、`getwi` 引用。
- `build_ejs_entries` — 预览将合并进角色卡内嵌世界书的 EJS entries。

### 文风 / 章节

- `create_style_extraction_template` — 文风提取模板。
- `submit_style_profile` — 保存文风 profile。
- `build_style_worldbook_entries` — 生成文风 / 技法 / 禁律世界书条目。
- `create_chapter_extraction_template` — 章节提取模板。
- `build_chapter_worldbook_entries` — 生成章节世界书条目。

### 自查 / 审查 / 交付

- `lint_worldbook_content` — 单段文本禁词与写作问题扫描。
- `lint_project_content` — 整个 project 内容自查。
- `create_writing_optimization_report` — 生成写作优化建议。
- `create_final_review_report` — 综合审查报告。
- `create_delivery_checklist` — 导出前 checklist；pending decisions 会进 blocking。

### 用户决策回路

- `request_user_decision` — 登记一个待用户确认的问题，并生成可直接展示给用户的选项文本。
- `record_user_decision` — 记录用户答复，从 pending 移到 recorded。
- `list_user_decisions` — 列出 pending / recorded。
- `clear_user_decision` — 清掉指定 id 的 pending 与 recorded。

详见 [`references/decision-loop.md`](references/decision-loop.md)。

## 核心数据流

任务从原文走向最终 JSON 通过 4 个阶段，对应不同工具：

```
原始材料   ─►  ingest_text_source / ingest_web_research
   │
   ▼
结构化事实 ─►  submit_extraction_result
              （或 submit_derivative_extraction_outline + sync_extraction=true）
   │
   ▼
MCP draft  ─►  plan_worldbook_entries
              → create_worldbook_draft_entry(s)
              → update_worldbook_draft_field(s)
              → confirm_worldbook_draft_complete
   │
   ▼
最终 JSON  ─►  generate_worldbook_json
              generate_character_card_json
```

`submit_extraction_result` 只接收**结构化事实**，不要把整篇原文塞进去。MCP draft 也不是 SillyTavern 最终 JSON，必须经过 `generate_*_json` 才能导入 SillyTavern。`.worldbook/draft/` 是长期工作区：导入外部酒馆 JSON 会先切片成 draft，导出或 patch 合并后也不会清空 draft；后续修改应继续改 draft 后再合并导出。

## 调用习惯

1. 每个新任务先按 `references/task-routing.md` 判断任务类型，并参考本 skill 工作流；空白目录/新项目先 `init_project`，确保 `.worldbook/draft/` 存在，并让它按需创建根目录模板 JSON。
2. 任何字段拿不准先查本 skill 文档与 `references/config-rules.md`；需要确定性模板时调用 `get_entry_template`，需要配置解释时调用 `explain_worldbook_config`。
3. 原始材料用 `ingest_*`，结构化事实用 `submit_extraction_result`，**两者绝不混用**。
4. 写世界书条目必须先用 `create_worldbook_draft_entry(s)` 创建切片模板，再用 `update_worldbook_draft_field(s)` 逐字段填充；不要一次 tool call 提交完整条目对象。
5. 世界书 draft 必须先 `confirm_worldbook_draft_complete`，再 `generate_worldbook_json`。
6. 角色卡生成前应先完成世界书 draft，并用 `upsert_character_profile` 写角色卡字段；当前规范推荐 `description` 为空，角色信息全部进内嵌世界书。
7. 修改已有世界书：`import_worldbook_json` → `create_worldbook_patch` → `preview_worldbook_patch` → `apply_worldbook_patch`，**先 import 切片为 draft、先 preview 再 apply**；不要绕过 draft 直接改导出 JSON。
8. 启用 MVU 时开场白末尾必须含 `<StatusPlaceHolderImpl/>`。
9. 启用 HTML 状态栏一般要同时启用 MVU。EJS 必须依赖 MVU，变量路径必须以 `stat_data` 开头。
10. 想强制硬闸门：`generate_*_json` 设 `strict_review: true`，未通过 `create_delivery_checklist` 就拒绝导出。

## 常见错误与红线

- ❌ 把整篇原文塞进 `submit_extraction_result.characters/world` —— 应该先 `ingest_text_source` 保存原文，再提交结构化事实。
- ❌ 一次 tool call 塞完整世界书条目对象 —— 应先 `create_worldbook_draft_entry` 创建模板，再用 `update_worldbook_draft_field` 逐字段填充。
- ❌ `constant=false`（绿灯）的条目没填 `keys` —— 绿灯条目必须有触发关键字。
- ❌ 角色卡 `description` 写大量人设 —— 当前规范要求 `description` 为空，所有人设进内嵌世界书；角色卡字段用 `upsert_character_profile` 更新。
- ❌ EJS 用 `const` / `let` 读阶段变量 —— 应该用 `var` + `typeof`，避免重复声明报错；并且 `getwi('条目名')` 必须 `await`。
- ❌ 状态栏 HTML 用全局选择器 `body` / `html` / `*` —— 必须用作用域 class（如 `.wbm-statusbar`），否则会污染整个 SillyTavern 界面。
- ❌ 跳过决策直接走默认值 —— 用户描述模糊时按 `references/task-routing.md` 的问题清单判断需要询问什么，再用 `request_user_decision` + `record_user_decision` 持久化选择。

## 进阶参考

按需懒加载，不必一次性读完。

- [`references/task-routing.md`](references/task-routing.md) — 任务类型判断、关键词路由与澄清问题清单。
- [`references/workflows.md`](references/workflows.md) — 7 类标准工作流的完整调用顺序。
- [`references/config-rules.md`](references/config-rules.md) — position / constant / keys / scanDepth / recursion / order / content 格式 / 角色卡 / MVU / HTML / EJS 字段规则。
- [`references/decision-loop.md`](references/decision-loop.md) — 用户决策回路设计、`prefer_user_decision`、checklist 闸门。
- [`references/example-original-character-card.md`](references/example-original-character-card.md) — 端到端示例：原创单角色卡 + MVU + HTML。
- [`references/example-derivative-extraction.md`](references/example-derivative-extraction.md) — 端到端示例：二创小说提取 → 世界书。
