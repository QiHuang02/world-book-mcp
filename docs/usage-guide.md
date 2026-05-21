# world-book-mcp 使用指南

`world-book-mcp` 是用于生成、校验、查询和 patch SillyTavern 世界书 JSON 的 MCP 服务器，也支持基础 `chara_card_v3` 角色卡 JSON 生成、MVU/ZOD 变量系统资产、HTML 美化资产和 EJS 动态内容合并。

## 职责边界

主 AI 负责：

- 理解用户需求。
- 搜索网页或阅读用户提供的文本。
- 根据提取模板抽取结构化事实。
- 编写世界书条目正文。
- 编写角色卡开场白。

MCP 负责：

- 给出稳定工作流。
- 保存原始材料和结构化结果。
- 生成 draft JSON 模板。
- 校验配置和内容问题。
- 导出最终 SillyTavern JSON。
- 安全查询和 patch 已有 JSON。

MCP 不负责：

- 内置联网搜索。
- 自动理解长文本并创作内容。
- 自动设计复杂 MVU 逻辑、EJS 或复杂 HTML UI。

## 推荐流程

### 1. 从文本生成世界书

```text
get_worldbook_workflow
→ ingest_text_source
→ create_extraction_outline
→ 主 AI 阅读文本并提取结构化事实
→ submit_extraction_result
→ plan_worldbook_entries
→ create_worldbook_draft_template
→ 主 AI 填写 draft.content
→ draft_worldbook_entries
→ validate_worldbook_draft
→ 如需修复：update_worldbook_draft_entries
→ generate_worldbook_json
→ query_worldbook
```

### 2. 从网页摘要生成世界书

```text
get_worldbook_workflow
→ 主 AI 搜索网页
→ 主 AI 整理网页摘要和 facts
→ ingest_web_research
→ create_extraction_outline
→ 主 AI 提取结构化事实
→ submit_extraction_result
→ plan_worldbook_entries
→ create_worldbook_draft_template
→ 主 AI 填写 draft.content
→ draft_worldbook_entries
→ validate_worldbook_draft
→ generate_worldbook_json
→ query_worldbook
```

### 3. 从世界书 draft 生成角色卡

```text
validate_worldbook_draft
→ create_character_card_template
→ 主 AI 填写 first_mes 和 alternate_greetings
→ submit_character_card_config
→ validate_character_card_config
→ generate_character_card_json
→ query_character_card
```

角色卡生成前建议先完成世界书 draft，因为当前规范推荐 `description` 为空，角色信息放入世界书。

### 4. 生成带 MVU/ZOD 的角色卡

```text
validate_worldbook_draft
→ create_character_card_template
→ create_mvu_schema_template
→ 主 AI 调整 schema_script / initvar / update_rules
→ submit_mvu_config
→ validate_mvu_config
→ build_mvu_assets（可选预览）
→ 主 AI 填写带 <StatusPlaceHolderImpl/> 的开场白
→ submit_character_card_config
→ validate_character_card_config
→ generate_character_card_json
→ query_character_card
```

`generate_character_card_json` 会在 project 启用 MVU 时自动合并 MVU 世界书条目、正则脚本和 Tavern Helper 脚本。

### 5. 生成带 HTML 美化的角色卡

```text
validate_worldbook_draft
→ create_character_card_template
→ create_html_beautify_template
→ 主 AI 调整 statusbar.html 或 global.regex_scripts
→ submit_html_beautify_config
→ validate_html_beautify_config
→ build_html_beautify_assets（可选预览）
→ 主 AI 填写带 <StatusPlaceHolderImpl/> 的开场白
→ submit_character_card_config
→ validate_character_card_config
→ generate_character_card_json
→ query_character_card
```

HTML 状态栏通常配合 MVU 使用，但 MCP 允许单独生成 HTML regex assets。`generate_character_card_json` 会在 project 启用 HTML 美化时自动合并 regex scripts。

### 6. 生成带 EJS 动态内容的角色卡

```text
validate_worldbook_draft
→ create_character_card_template
→ create_mvu_schema_template
→ submit_mvu_config
→ validate_mvu_config
→ create_ejs_template
→ 主 AI 调整 EJS 控制器和阶段条目内容
→ submit_ejs_config
→ validate_ejs_config
→ build_ejs_entries（可选预览）
→ submit_character_card_config
→ validate_character_card_config
→ generate_character_card_json
→ query_character_card
```

EJS 必须依赖 MVU。变量路径必须以 `stat_data` 开头。控制器可用 `await getwi('条目名')` 动态加载禁用阶段条目。

### 7. 修改已有世界书

```text
将目标 JSON 放入 output/exports/
→ import_worldbook_json
→ create_worldbook_patch
→ preview_worldbook_patch
→ apply_worldbook_patch
→ query_worldbook
```

`preview_worldbook_patch` 只返回 diff，不写文件。`apply_worldbook_patch` 会先校验 patch 后的 draft，校验失败则不导出。

## 数据流解释

### 原始材料

通过以下 tools 传入：

- `ingest_text_source`
- `ingest_web_research`

用于保存用户文本或网页搜索摘要。

### 结构化事实

通过 `submit_extraction_result` 传入。

这是主 AI 从原始材料中提取出的事实，不是原文全文。

### MCP draft JSON

通过 `create_worldbook_draft_template` 生成，通过 `draft_worldbook_entries` 保存。

这是 MCP 内部的中间结构，不是 SillyTavern 最终 JSON。

### 最终 JSON

通过以下 tools 导出：

- `generate_worldbook_json`
- `generate_character_card_json`

这些文件才是可导入 SillyTavern 的最终产物。

## 推荐给主 AI 的调用习惯

1. 每个任务开始先调用 `get_worldbook_workflow`。
2. 不确定某个 tool 怎么填时调用 `get_tool_usage_guide`。
3. 原始材料和结构化事实分开提交。
4. 世界书 draft 必须先校验再导出。
5. 角色卡生成前应先完成世界书 draft。
6. patch 已有世界书时，先 preview，再 apply。

## 常见错误

### 把原文塞进 `submit_extraction_result`

错误：把整篇小说原文放入 `characters` 或 `world` 字段。

正确：原文先用 `ingest_text_source` 保存，`submit_extraction_result` 只提交结构化事实。

### 把 draft JSON 当作最终 JSON

错误：把 `create_worldbook_draft_template` 返回的 entries 直接导入 SillyTavern。

正确：填写并校验 draft 后，调用 `generate_worldbook_json` 导出最终 JSON。

### 绿灯条目没有 keys

`constant=false` 的条目必须有 `keys`，否则无法触发。

### 角色卡 description 写了大量人设

当前规范建议 `description` 为空，角色设定放入内嵌世界书。

## 输出位置

- 世界书：`output/exports/`
- 角色卡：`output/exports/cards/`
- patch 备份：`output/exports/backups/`
- 项目状态：`output/projects/`
