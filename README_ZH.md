# world-book-mcp

`world-book-mcp` 是一个使用 Node.js + TypeScript 编写的 MCP 服务器，用于管理 `.worldbook/` 草稿工作区，并辅助 AI 校验、patch 和导出符合 SillyTavern 格式的世界书 JSON、基础 `chara_card_v3` 角色卡 JSON，以及可选 MVU/ZOD、HTML 美化和 EJS 动态内容资产。原文阅读、网页搜索和事实提取由宿主 AI 在对话中完成；本服务器只保存结构化 project 状态、draft 条目、配置和导出 JSON。

## 安装

### JSON 格式

```json
{
  "type": "stdio",
  "command": "npx",
  "args": [
    "-y",
    "@qihuang02/world-book-mcp"
  ]
}
```

### Claude Code 格式

```json
"mcpServers": {
  "world-book-mcp": {
    "type": "stdio",
    "command": "cmd",
    "args": [
      "/c",
      "npx",
      "-y",
      "@qihuang02/world-book-mcp"
    ]
  }
}
```

### Codex 格式

```toml
[mcp_servers.world-book-mcp]
type = "stdio"
command = "npx"
args = ["-y", "@qihuang02/world-book-mcp"]
# startup_timeout_sec = 60000.0
```

## 当前能力

当前版本支持：

- 显式初始化 project，适合空白目录首次使用。
- 创建信息提取 outline。
- 提交由宿主 AI 整理好的结构化提取结果。
- 根据调用方显式提供的卡型、角色、世界分区、物品、场景和事件创建世界书条目规划。
- 扫描禁词与常见写作问题。
- 先创建 `.worldbook/draft/*.json` 切片模板，再逐字段更新、确认完整并合并导出，避免 AI 一次提交完整条目对象。
- 导出独立 SillyTavern 世界书 JSON。
- 导入已有世界书 JSON，先切片为 `.worldbook/draft/*.json`，再进行安全 patch / 合并导出。
- 基础角色卡 JSON 生成，可嵌入项目世界书 draft；导出角色卡时同一角色的基础设定和性格设定会聚合为同一个内嵌世界书条目。
- MVU/ZOD 配置模板、校验、资产构建，并可自动合并进角色卡 JSON。
- HTML 美化配置模板、校验、资产构建，并可自动合并进角色卡 JSON。
- EJS 动态内容配置模板、校验、entries 构建，并可自动合并进角色卡内嵌世界书。
- 查询导出的世界书 JSON 和角色卡 JSON。
- 导入已有角色卡 JSON，将内嵌世界书切片为 draft，并通过 patch 修改角色卡字段或内嵌世界书条目。

暂不支持：
- 内置网页搜索。

## `.worldbook/` 工作目录

`init_project` 的主作用是在当前项目目录创建/复用单一 MCP 工作区 project。project 元信息只保存在 `.worldbook/project.json`，草稿分片保存在 `.worldbook/draft/`；旧的 `output/projects` 路径不再创建也不再读取：

```text
.
├─ .worldbook/
│  ├─ project.json          # project 元信息，不保存 draft 正文
│  └─ draft/
│     ├─ 新墟城.json
│     ├─ 角色B_基础设定.json
│     └─ 角色B_性格.json
└─ <导出的世界书或角色卡>.json
```

`create_worldbook_draft_entry` / `create_worldbook_draft_entries` 会先把每个切片模板写为 `.worldbook/draft/<safe-comment>.json`；随后使用 `update_worldbook_draft_field` / `update_worldbook_draft_fields` 逐字段填充。分片文件保存的是 MCP draft entry，而不是最终 SillyTavern entry：

```json
{
  "comment": "新墟城",
  "entryType": "world_summary",
  "keys": ["新墟", "废墟都市", "避难城"],
  "secondaryKeys": [],
  "content": "...",
  "constant": true,
  "position": "before_char",
  "order": 1,
  "enabled": true,
  "preventRecursion": true,
  "excludeRecursion": true
}
```

校验、审查、lint、世界书导出和角色卡导出会合并读取 `.worldbook/draft/*.json`；分片 draft 文件是草稿的唯一事实来源。`.worldbook/draft/` 是长期工作区：`generate_worldbook_json` / `generate_character_card_json` 导出后不会清空草稿，`apply_worldbook_patch` / `apply_character_card_patch` 合并导出后也会保留更新后的分片草稿，供下次继续修改。默认导出路径是当前工作目录的 `<名称>.json`，相对路径和绝对路径都必须位于当前工作目录内，越界写入会失败。

此外，`init_project` 会扫描当前工作目录根目录的一层 `*.json`：如果没有发现酒馆格式世界书或 `chara_card_v3` 角色卡 JSON，会自动创建一个根目录模板 JSON；如果已经存在酒馆格式 JSON，则不会额外创建模板，也不会覆盖已有 JSON。返回值中的 `root_template` 会说明模板是否创建、路径或已有文件列表。`kind=worldbook` 会创建独立世界书模板；`kind=character_card` 和 `kind=mixed` 会创建 `chara_card_v3` 模板，其中 `mixed` 明确表示角色卡 + 内嵌空世界书的一体化模板。

## Patch、revision 与并发

同一 `project_id` 的写入会在 MCP 进程内串行化，并在返回值中递增 `revision`。支持 `expected_revision` 的写入工具可用它做并发冲突检测：如果调用方基于旧 revision 写入，会返回 `project revision conflict`。

`apply_worldbook_patch` / `apply_character_card_patch` 会以当前 project draft 为输入，同时写导出的 JSON 文件并更新 project 状态；成功后保留更新后的 `.worldbook/draft/*.json`。实现会先写临时文件并替换目标文件，再更新 project；如果 project 更新失败，会尽力恢复旧导出文件或删除新写入文件。返回 `ok=false` 或抛出冲突错误时，调用方应重新读取 project 后再重试。

patch 的 `match.uid` 优先匹配从已导入世界书保留的 `sourceUid`，用于定位原始 SillyTavern 条目 uid。对没有 `sourceUid` 的新建草稿，建议使用 `index` 或唯一 `comment` 定位，避免把 uid 误当作导出后的连续下标。

## Tools 一览

任务分类、工作流选择和澄清策略由随包 `skill/world-book-mcp-skill/` 文档指导，不再作为 MCP tools 暴露。

| 分类 | Tool | 说明 |
| --- | --- | --- |
| 工作流、项目与规范 | `init_project` | 初始化 `.worldbook/project.json` 与 `.worldbook/draft/`；若根目录没有酒馆格式 JSON，会安全创建模板 JSON；已有项目可用 `if_exists` 控制复用或覆盖。 |
| 工作流、项目与规范 | `list_projects` | 返回当前 `.worldbook/project.json` 工作区项目；未初始化时返回空列表。 |
| 工作流、项目与规范 | `get_project` | 查看项目详情或摘要。 |
| 工作流、项目与规范 | `lint_worldbook_content` | 扫描禁词和常见写作问题。 |
| 提取 | `create_extraction_outline` | 创建角色、世界观、物品、事件的提取模板。 |
| 提取 | `submit_extraction_result` | 提交主 AI 提取好的结构化事实。 |
| 世界书构建 | `create_worldbook_entry_plan` | 根据调用方显式提供的卡型、角色、世界分区、物品、场景和事件创建条目规划。 |
| 世界书构建 | `validate_worldbook_entry_plan` | 校验显式条目规划的 position、order 和关键词触发规则。 |
| 世界书构建 | `create_worldbook_draft_entry` | 创建单个 `.worldbook/draft/*.json` 切片模板。 |
| 世界书构建 | `create_worldbook_draft_entries` | 批量创建切片模板。 |
| 世界书构建 | `update_worldbook_draft_field` | 按 comment 定位并逐字段更新 draft。 |
| 世界书构建 | `update_worldbook_draft_fields` | 一次更新少量 draft 字段。 |
| 世界书构建 | `confirm_worldbook_draft_complete` | 确认所有 draft 完整且可合并导出。 |
| 世界书构建 | `list_worldbook_draft_entries` | 列出 `.worldbook/draft/*.json` 分片草稿。 |
| 世界书构建 | `get_worldbook_draft_entry` | 按 comment 读取单个分片草稿。 |
| 世界书构建 | `delete_worldbook_draft_entry` | 按 comment 删除单个分片草稿。 |
| 世界书构建 | `validate_worldbook_draft` | 校验草稿配置和内容问题。 |
| 世界书构建 | `generate_worldbook_json` | 导出 SillyTavern 世界书 JSON。 |
| 角色卡 | `import_character_card_json` | 导入当前目录内已有 `chara_card_v3` 角色卡 JSON，提取 profile 与内嵌世界书 draft。 |
| 角色卡 | `upsert_character_profile` | 用简化字段创建/更新角色卡人设配置，MCP 自动补齐 `chara_card_v3` 默认字段。 |
| 角色卡 | `validate_character_card_config` | 校验角色卡配置和嵌入世界书。 |
| 角色卡 | `confirm_character_card_draft_complete` | 确认角色卡 profile、内嵌世界书 draft 与资产可合并导出。 |
| 角色卡 | `generate_character_card_json` | 导出 `chara_card_v3` 角色卡 JSON；同一角色的 `character_basic` 与 `character_personality` 会合并为同一个内嵌世界书条目。 |
| 角色卡 | `create_character_card_patch` | 为已有角色卡 project 创建 profile / worldbook config / 内嵌世界书修改计划。 |
| 角色卡 | `preview_character_card_patch` | 预览角色卡 patch diff 与校验结果。 |
| 角色卡 | `apply_character_card_patch` | 应用角色卡 patch，安全导出 JSON 并更新 project。 |
| 角色卡 | `query_character_card` | 查询角色卡概要、开场白或内嵌世界书条目。 |
| MVU / ZOD | `create_mvu_schema_template` | 创建 MVU/ZOD 变量系统配置模板。 |
| MVU / ZOD | `upsert_mvu_schema` | 局部更新 MVU schema 与变量路径。 |
| MVU / ZOD | `upsert_mvu_update_rules` | 局部更新 MVU initvar 与 update_rules。 |
| MVU / ZOD | `submit_mvu_config` | 高级入口：保存完整 MVU 配置。 |
| MVU / ZOD | `validate_mvu_config` | 校验 ZOD schema、initvar、update_rules 与开场白占位符。 |
| MVU / ZOD | `build_mvu_assets` | 预览将合并进角色卡的世界书条目、正则脚本和 Tavern Helper 脚本。 |
| HTML 美化 | `create_html_beautify_template` | 创建状态栏或全局 HTML 美化配置模板。 |
| HTML 美化 | `upsert_html_statusbar` | 局部更新状态栏 HTML、主题和开关。 |
| HTML 美化 | `submit_html_beautify_config` | 高级入口：保存完整 HTML 美化配置。 |
| HTML 美化 | `validate_html_beautify_config` | 校验 HTML、CSS 作用域、regex 配置和开场白占位符。 |
| HTML 美化 | `build_html_beautify_assets` | 预览将合并进角色卡的 regex scripts。 |
| EJS 动态内容 | `create_ejs_template` | 创建阶段人设、调色盘或自定义 EJS 模板。 |
| EJS 动态内容 | `upsert_ejs_entry` | 按 name 局部新增/更新单个 EJS entry。 |
| EJS 动态内容 | `submit_ejs_config` | 高级入口：保存完整 EJS 配置。 |
| EJS 动态内容 | `validate_ejs_config` | 校验 MVU 依赖、变量路径、EJS 标签、getwi 引用和条目状态。 |
| EJS 动态内容 | `build_ejs_entries` | 预览将合并进角色卡内嵌世界书的 EJS entries。 |
| 查询与 Patch | `query_worldbook` | 查询已有世界书 JSON，支持 `brief`、`uid`、`search`、`stats`。 |
| 查询与 Patch | `import_worldbook_json` | 把当前工作目录内已有世界书 JSON 导入为 MCP project draft。 |
| 查询与 Patch | `create_worldbook_patch` | 创建修改计划，不直接写文件。 |
| 查询与 Patch | `preview_worldbook_patch` | 预览 patch diff 和校验结果。 |
| 查询与 Patch | `apply_worldbook_patch` | 应用 patch，自动校验，可备份并导出新 JSON。 |

## Skill

仓库自带一个名为 `world-book-mcp-skill` 的标准 Claude Code Skill，位于 [`skill/world-book-mcp-skill/`](skill/world-book-mcp-skill/)。它是一个 `SKILL.md` + `references/` 的目录包，用于指导 AI 在用户提出世界书 / 角色卡相关需求时，正确编排本 MCP 服务器的全部工具。skill 名称刻意区别于 MCP server 名称 `world-book-mcp`，避免在 Agent 工具中混淆。

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
