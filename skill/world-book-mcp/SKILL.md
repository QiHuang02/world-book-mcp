---
name: world-book-mcp
description: Use the world-book-mcp MCP server to author SillyTavern world books, chara_card_v3 character cards, MVU/ZOD variable systems, HTML status-bar beautification, and EJS dynamic content. Invoke this skill whenever the user wants to build, modify, validate, query, import, or export SillyTavern world books or character cards (single, multi, worldbook-only, derivative novel extraction, item/equipment, style profile, chapter outline, content lint), or whenever the user mentions tools like init_project, upsert_worldbook_entry, upsert_worldbook_entries, upsert_character_profile, ingest_text_source, plan_worldbook_entries, generate_worldbook_json, generate_character_card_json, request_user_decision.
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

## 角色边界

主 AI 负责：

- 理解用户需求与歧义。
- 阅读用户提供的文本，或在外部搜索网页。
- 按提取模板抽取结构化事实。
- 编写世界书条目正文与角色卡开场白。

`world-book-mcp` 负责：

- 提供可查询的参考工作流、能力矩阵与字段校验，但不通过固定 next-tool 字段接管流程编排。
- 持久化原始材料、结构化事实、世界书 draft、角色卡 config、MVU/HTML/EJS config。
- 接收简化条目/角色卡输入，自动补全完整 draft entry 与角色卡默认字段。
- 校验配置合法性、内容禁词与文风问题。
- 导出符合 SillyTavern 规范的最终 JSON。
- 安全地查询、导入、patch 已有 JSON。

`world-book-mcp` **不**负责：

- 联网搜索（不内置任何 fetcher，必须由主 AI 在外部完成后用 `ingest_web_research` 提交摘要）。
- 自动理解长文本（主 AI 必须自己读原文）。
- 自动设计复杂 MVU 逻辑、EJS 控制器或 HTML UI。

## 首选起手式

拿到任意需求请按下面顺序起手，不要直接跳到具体工具：

1. **`classify_worldbook_task`** — 把用户的自然语言请求归类为 15 种 task_type 之一，并返回 `suggested_decisions`。如果对用户意图存在多重歧义，调用时设 `prefer_user_decision: true`，强制走决策回路。
2. 参考本 skill 的 `references/workflows.md` 编排流程；MCP 不再提供固定 workflow tool，流程由 skill 文档和主 AI 判断负责。
3. **`get_tool_usage_guide`** — 任何工具的字段不确定时调它，返回用途、必填字段、示例输入和下一步推荐。
4. **`get_worldbook_capability_matrix`** — 想确认某 task_type 下有哪些能力可用时调用，每条能力会标 `decision_hint`（`auto` / `prefer_clarification`）。

详细 7 类工作流见 [`references/workflows.md`](references/workflows.md)。

## 完整工具清单

下列分组覆盖当前对 agent 公开推荐的 MCP 工具。底层全量 draft/config 提交逻辑已降级为内部/兼容层，默认不要引导 agent 手写完整 JSON。

### 元能力 / 路由

- `classify_worldbook_task` — 把自然语言请求分类为 task_type。
- `propose_clarification_questions` — 主动列出歧义点。
- `get_worldbook_capability_matrix` — 按 task_type 列出可用能力。
- `get_tool_usage_guide` — 单个工具的使用文档。
- `get_entry_template` — 按 entryType 取条目模板。
- `explain_worldbook_config` — 解释 position / constant / order / keys / scanDepth / recursion。
- `classify_worldbook_card_type` — 根据角色数推断 single / multi / worldbook_only。
- `classify_worldbuilding_type` — 根据题材推断 A 现实背景 / B 小世界 / C 大世界。

### 项目与素材

- `init_project` — 初始化当前目录的 `.worldbook/project.json` 与 `.worldbook/draft/`；若根目录没有酒馆格式 JSON，会安全创建模板 JSON；若已有世界书/角色卡 JSON，则不创建模板也不覆盖。
- `list_projects` — 列出本地保存的 MCP project。
- `get_project` — 查看 project 状态摘要或全量。
- `ingest_text_source` — 保存用户文本素材。
- `ingest_web_research` — 保存主 AI 整理后的网页摘要。

### 提取

- `create_extraction_outline` — 创建结构化提取模板（角色 / 世界 / 物品 / 事件）。
- `submit_extraction_result` — 提交主 AI 抽取的结构化事实。
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
- `upsert_worldbook_entry` — 用简化输入新增/更新单个世界书条目，MCP 自动补全完整配置并写入 `.worldbook/draft/*.json`；默认按 `comment` 更新，必要时可设 `match_by_keys=true`。
- `upsert_worldbook_entries` — 用简化输入批量新增/更新世界书条目，同样默认按 `comment` 匹配。
- `list_worldbook_draft_entries` — 列出 `.worldbook/draft/*.json` 分片草稿。
- `get_worldbook_draft_entry` — 按 comment 读取单个分片草稿。
- `delete_worldbook_draft_entry` — 按 comment 删除单个分片草稿。
- `validate_worldbook_draft` — 校验 draft 配置和内容。
- `generate_worldbook_json` — 导出独立 SillyTavern 世界书 JSON。
- `import_worldbook_json` — 把当前工作目录内已有 JSON 导入为 project draft。
- `create_worldbook_patch` — 创建修改计划（不写文件）。
- `preview_worldbook_patch` — 预览 patch diff 与校验。
- `apply_worldbook_patch` — 应用 patch、自动校验、可备份覆盖。
- `query_worldbook` — `brief` / `uid` / `search` / `stats` 查询。

### 角色卡

- `import_character_card_json` — 导入当前目录内已有 `chara_card_v3` 角色卡 JSON，提取 profile 与内嵌世界书 draft。
- `upsert_character_profile` — 用简化字段创建/更新角色卡人设配置，MCP 自动补齐 `chara_card_v3` 默认字段。
- `validate_character_card_config` — 校验角色卡 config 与嵌入世界书。
- `validate_greetings` — 单独校验 first_mes 与 alternate_greetings。
- `generate_character_card_json` — 导出 chara_card_v3 角色卡 JSON（自动合并 MVU / HTML / EJS）。
- `create_character_card_patch` — 创建角色卡 profile / worldbook config / 内嵌世界书修改计划。
- `preview_character_card_patch` — 预览角色卡 patch diff 与校验。
- `apply_character_card_patch` — 应用角色卡 patch，安全导出 JSON 并更新 project。
- `query_character_card` — 查询导出的角色卡 JSON。

### MVU / HTML / EJS

- `create_mvu_schema_template` — 创建 MVU/ZOD config 模板。
- `submit_mvu_config` — 保存 MVU config。
- `validate_mvu_config` — 校验 ZOD schema、initvar、update_rules、占位符。
- `build_mvu_assets` — 预览将合并的世界书条目 / 正则 / Tavern Helper 脚本。
- `create_html_beautify_template` — 创建状态栏 / 全局 HTML 美化模板。
- `submit_html_beautify_config` — 保存 HTML 美化 config。
- `validate_html_beautify_config` — 校验 HTML、CSS 作用域、正则配置。
- `build_html_beautify_assets` — 预览将合并的 regex scripts。
- `create_html_regex_pair_template` — 单独生成显示 / 隐藏正则对模板。
- `validate_regex_scripts` — 单独校验一组 regex scripts。
- `create_ejs_phase_plan` — 阶段化人设规划模板。
- `create_ejs_template` — `phase_profile` / `palette` / `custom` EJS 模板。
- `submit_ejs_config` — 保存 EJS config。
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

- `request_user_decision` — 把歧义写入 `pendingDecisions`，返回 `prompt_text` 让 AI 复述给用户。
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
              → upsert_worldbook_entry / upsert_worldbook_entries
              → validate_worldbook_draft
   │
   ▼
最终 JSON  ─►  generate_worldbook_json
              generate_character_card_json
```

`submit_extraction_result` 只接收**结构化事实**，不要把整篇原文塞进去。MCP draft 也不是 SillyTavern 最终 JSON，必须经过 `generate_*_json` 才能导入 SillyTavern。

## 调用习惯

1. 每个新任务先 `classify_worldbook_task` 并参考本 skill 工作流；空白目录/新项目先 `init_project`，确保 `.worldbook/draft/` 存在，并让它按需创建根目录模板 JSON。
2. 任何字段拿不准就 `get_tool_usage_guide`，不要靠猜。
3. 原始材料用 `ingest_*`，结构化事实用 `submit_extraction_result`，**两者绝不混用**。
4. 写世界书条目优先用 `upsert_worldbook_entry` / `upsert_worldbook_entries`，不要手写完整 SillyTavern entry JSON。
5. 世界书 draft 必须先 `validate_worldbook_draft`，再 `generate_worldbook_json`。
6. 角色卡生成前应先完成世界书 draft，并用 `upsert_character_profile` 写角色卡字段；当前规范推荐 `description` 为空，角色信息全部进内嵌世界书。
7. 修改已有世界书：`import_worldbook_json` → `create_worldbook_patch` → `preview_worldbook_patch` → `apply_worldbook_patch`，**先 preview 再 apply**。
8. 启用 MVU 时开场白末尾必须含 `<StatusPlaceHolderImpl/>`。
9. 启用 HTML 状态栏一般要同时启用 MVU。EJS 必须依赖 MVU，变量路径必须以 `stat_data` 开头。
10. 想强制硬闸门：`generate_*_json` 设 `strict_review: true`，未通过 `create_delivery_checklist` 就拒绝导出。

## 常见错误与红线

- ❌ 把整篇原文塞进 `submit_extraction_result.characters/world` —— 应该先 `ingest_text_source` 保存原文，再提交结构化事实。
- ❌ 让 AI 手写完整 SillyTavern entry JSON —— 应使用 `upsert_worldbook_entry` / `upsert_worldbook_entries` 提交简化字段，由 MCP 补全结构。
- ❌ `constant=false`（绿灯）的条目没填 `keys` —— 绿灯条目必须有触发关键字。
- ❌ 角色卡 `description` 写大量人设 —— 当前规范要求 `description` 为空，所有人设进内嵌世界书；角色卡字段用 `upsert_character_profile` 更新。
- ❌ EJS 用 `const` / `let` 读阶段变量 —— 应该用 `var` + `typeof`，避免重复声明报错；并且 `getwi('条目名')` 必须 `await`。
- ❌ 状态栏 HTML 用全局选择器 `body` / `html` / `*` —— 必须用作用域 class（如 `.wbm-statusbar`），否则会污染整个 SillyTavern 界面。
- ❌ 跳过决策直接走默认值 —— 用户描述模糊时先 `classify_worldbook_task` 拿 `suggested_decisions`，再 `request_user_decision` + `record_user_decision`。

## 进阶参考

按需懒加载，不必一次性读完。

- [`references/workflows.md`](references/workflows.md) — 7 类标准工作流的完整调用顺序。
- [`references/config-rules.md`](references/config-rules.md) — position / constant / keys / scanDepth / recursion / order / content 格式 / 角色卡 / MVU / HTML / EJS 字段规则。
- [`references/decision-loop.md`](references/decision-loop.md) — 用户决策回路设计、`prefer_user_decision`、checklist 闸门。
- [`references/example-original-character-card.md`](references/example-original-character-card.md) — 端到端示例：原创单角色卡 + MVU + HTML。
- [`references/example-derivative-extraction.md`](references/example-derivative-extraction.md) — 端到端示例：二创小说提取 → 世界书。
