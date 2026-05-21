# world-book-mcp

`world-book-mcp` 是一个使用 Node.js + TypeScript 编写的 MCP 服务器，用于辅助 AI 从文本或网页搜索摘要中整理信息，并导出符合 SillyTavern 格式的世界书 JSON、基础 `chara_card_v3` 角色卡 JSON，以及可选 MVU/ZOD、HTML 美化和 EJS 动态内容资产。

本项目的核心定位是：

- MCP 负责结构化、校验、导出、查询和安全 patch。
- 主 AI 负责理解文本、搜索网页、提取事实、编写条目正文和开场白。
- 不复用现有 Python 脚本，核心生成逻辑由 TypeScript 实现。
- 不内置网页搜索，只接收宿主 AI 或用户整理后的网页摘要。

## 当前能力

当前版本支持：

- 接收文本素材。
- 接收网页搜索摘要。
- 创建信息提取 outline。
- 提交结构化提取结果。
- 自动规划世界书条目。
- 返回世界书条目模板。
- 查询单个 tool 的使用指南。
- 解释 SillyTavern 世界书配置字段。
- 扫描禁词与常见写作问题。
- 保存、更新、校验世界书草稿。
- 导出独立 SillyTavern 世界书 JSON。
- 导入已有世界书 JSON 并进行安全 patch。
- 基础角色卡 JSON 生成，可嵌入项目世界书 draft。
- MVU/ZOD 配置模板、校验、资产构建，并可自动合并进角色卡 JSON。
- HTML 美化配置模板、校验、资产构建，并可自动合并进角色卡 JSON。
- EJS 动态内容配置模板、校验、entries 构建，并可自动合并进角色卡内嵌世界书。
- 查询导出的世界书 JSON 和角色卡 JSON。

暂不支持：
- 内置网页搜索。

## 安装

```bash
npm install
```

## 开发命令

```bash
npm run dev          # 开发模式启动 MCP server
npm run build        # 编译到 dist/
npm start            # 运行 dist/index.js
npm run typecheck    # TypeScript 类型检查
npm test             # 运行单元测试
```

## 推荐总流程

完整 7 类工作流（从文本 / 从网页 / 角色卡 / MVU / HTML / EJS / 修改已有）请见 [`skill/world-book-mcp/references/workflows.md`](skill/world-book-mcp/references/workflows.md)。

## 关键概念

### 原始材料、结构化事实、draft JSON、最终 JSON

- `ingest_text_source` / `ingest_web_research`：保存原始文本或网页摘要。
- `submit_extraction_result`：保存主 AI 从原始材料中提取出的结构化事实。
- `create_worldbook_draft_template`：返回可填写的 MCP draft JSON 模板。
- `draft_worldbook_entries`：保存主 AI 填写后的 draft。
- `generate_worldbook_json` / `generate_character_card_json`：导出最终可导入 SillyTavern 的 JSON 文件。

### MCP 不做什么

MCP 不直接理解长文本、不替主 AI 搜索网页、不自动脑补设定。它负责让主 AI 的输出符合稳定 schema，并在导出前执行校验。

## Tools 一览

### 工作流、项目与规范

- `get_worldbook_workflow`：根据任务类型返回推荐 tool 流程。`wants_character_card=true` 时会自动追加角色卡流程。
- `get_tool_usage_guide`：查询某个 tool 的用途、调用时机、必填字段、示例输入、常见错误和下一步。
- `list_projects`：列出本地保存的 MCP 项目。
- `get_project`：查看项目详情或摘要。
- `get_entry_template`：返回世界书条目模板。
- `explain_worldbook_config`：解释 position、constant、order、keys、递归等配置。
- `lint_worldbook_content`：扫描禁词和常见写作问题。

### 素材输入

- `ingest_text_source`：接收小说片段、设定、用户笔记等文本。
- `ingest_web_research`：接收 AI 整理后的网页搜索摘要。

### 提取

- `create_extraction_outline`：创建角色、世界观、物品、事件的提取模板。
- `submit_extraction_result`：提交主 AI 提取好的结构化事实。

### 世界书构建

- `plan_worldbook_entries`：根据提取结果规划条目表。
- `create_worldbook_draft_template`：根据规划表生成可填充草稿模板。
- `draft_worldbook_entries`：保存世界书草稿。
- `update_worldbook_draft_entries`：按 index 或 comment 局部更新草稿条目。
- `validate_worldbook_draft`：校验草稿配置和内容问题。
- `generate_worldbook_json`：导出 SillyTavern 世界书 JSON。

### 角色卡

- `create_character_card_template`：创建基础角色卡配置模板。
- `submit_character_card_config`：保存角色卡配置。
- `validate_character_card_config`：校验角色卡配置和嵌入世界书。
- `generate_character_card_json`：导出 `chara_card_v3` 角色卡 JSON。
- `query_character_card`：查询角色卡概要、开场白或内嵌世界书条目。

### MVU / ZOD

- `create_mvu_schema_template`：创建 MVU/ZOD 变量系统配置模板。
- `submit_mvu_config`：保存 MVU 配置。
- `validate_mvu_config`：校验 ZOD schema、initvar、update_rules 与开场白占位符。
- `build_mvu_assets`：预览将合并进角色卡的世界书条目、正则脚本和 Tavern Helper 脚本。

### HTML 美化

- `create_html_beautify_template`：创建状态栏或全局 HTML 美化配置模板。
- `submit_html_beautify_config`：保存 HTML 美化配置。
- `validate_html_beautify_config`：校验 HTML、CSS 作用域、regex 配置和开场白占位符。
- `build_html_beautify_assets`：预览将合并进角色卡的 regex scripts。

### EJS 动态内容

- `create_ejs_template`：创建阶段人设、调色盘或自定义 EJS 模板。
- `submit_ejs_config`：保存 EJS 配置。
- `validate_ejs_config`：校验 MVU 依赖、变量路径、EJS 标签、getwi 引用和条目状态。
- `build_ejs_entries`：预览将合并进角色卡内嵌世界书的 EJS entries。

### 查询与 Patch

- `query_worldbook`：查询已有世界书 JSON，支持 `brief`、`uid`、`search`、`stats`。
- `import_worldbook_json`：把 `output/exports/` 中已有世界书导入为 MCP project draft。
- `create_worldbook_patch`：创建修改计划，不直接写文件。
- `preview_worldbook_patch`：预览 patch diff 和校验结果。
- `apply_worldbook_patch`：应用 patch，自动校验，可备份并导出新 JSON。

## 输出目录

- `output/projects/`：保存 MCP 项目状态。
- `output/exports/`：保存导出的 SillyTavern 世界书 JSON。
- `output/exports/backups/`：保存 patch 前的备份。
- `output/exports/cards/`：保存导出的 SillyTavern 角色卡 JSON。

这些运行时文件默认被 `.gitignore` 忽略。

## Claude Code Skill

仓库自带一个标准 Claude Code Skill，位于 [`skill/world-book-mcp/`](skill/world-book-mcp/)。它是一个 `SKILL.md` + `references/` 的目录包，用于指导 AI 在用户提出世界书 / 角色卡相关需求时，正确编排本 MCP 服务器的全部工具。

把整个目录复制到 `~/.claude/skills/` 或项目下的 `.claude/skills/` 即可启用：

```bash
cp -r skill/world-book-mcp ~/.claude/skills/
```

入口为 [`skill/world-book-mcp/SKILL.md`](skill/world-book-mcp/SKILL.md)。

## 进阶文档

- [`skill/world-book-mcp/references/workflows.md`](skill/world-book-mcp/references/workflows.md)：7 类标准工作流的完整调用顺序
- [`skill/world-book-mcp/references/config-rules.md`](skill/world-book-mcp/references/config-rules.md)：position / constant / keys / MVU / HTML / EJS 字段规则
- [`skill/world-book-mcp/references/decision-loop.md`](skill/world-book-mcp/references/decision-loop.md)：用户决策回路设计与使用
- [`skill/world-book-mcp/references/example-original-character-card.md`](skill/world-book-mcp/references/example-original-character-card.md)：原创单角色卡端到端示例
- [`skill/world-book-mcp/references/example-derivative-extraction.md`](skill/world-book-mcp/references/example-derivative-extraction.md)：二创小说提取端到端示例

## 未来能力扩展

以下能力暂未实现，仅作为后续路线参考：

- 跨项目模板复用：从一个项目派生世界书 / 角色卡模板，应用到新项目。
- 世界书条目互引图：分析 keys 与 secondaryKeys，输出条目触发依赖图。
- 多语言 lint 词库：可插拔禁词表，支持英文 / 日文等。
- 角色关系图导出：从 character_basic 关系字段生成关系图 JSON。
- 内嵌世界书冲突检测：在角色卡 + 项目世界书合并时检测重复 keys / order。
- Decision 模板库：常见歧义模板（卡型 / 世界观 / 风格）可被工具引用。
- Worldbook diff 工具：对比两个 SillyTavern JSON。
- ChatLog 抽取：从一段对话历史抽取角色行为依据。
- 自动条目重排：按 position+order 规则自动调整冲突。
- 状态栏 HTML AST 校验：基于轻量 HTML 解析做更严格的安全检查。
- 多 character_card 协作：在同一 project 维护多张角色卡 config 并按需切换导出。
- Worldbook 资产签名：导出 JSON 时附带版本与签名，便于追踪。

## 许可

MIT
