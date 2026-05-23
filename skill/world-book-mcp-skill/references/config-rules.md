# 配置规则速查

## 世界书条目字段

| 字段 | 说明 |
|---|---|
| `content` | 条目正文，导出前不能为空。 |
| `entryType` | `world_summary` / `background` / `character_basic` / `character_personality` / `item` / `ability` / `scene` / `event` / `faction` / `npc` / `other`。 |
| `constant` | `true` 蓝灯常驻；`false` 绿灯关键词触发。 |
| `keys` | 绿灯必填，字符串数组。 |
| `position` | `before_char` / `after_char` / `before_an` / `after_an` / `at_depth` / `before_em` / `after_em` / `outlet`。 |
| `order` | 同位置内从小到大排序。 |
| `scanDepth` | 绿灯推荐 `2`；蓝灯通常不填。 |

## draft_type 与常用字段

| draft_type | 用途 | 常用 field_path |
|---|---|---|
| `worldbook_entry` | 世界书条目 | `content`, `entryType`, `keys`, `constant`, `position`, `order`, `scanDepth` |
| `character_profile` | 角色卡 profile | `name`, `description`, `personality`, `scenario`, `system_prompt`, `post_history_instructions`, `include_worldbook`, `worldbook_name` |
| `character_greetings` | 开场白 | `first_mes`, `alternate_greetings` |
| `mvu_schema` | MVU/ZOD schema | `schema_script`, `variable_list_path`, `output_format`, `enabled` |
| `mvu_update_rules` | MVU 初始化与更新规则 | `initvar`, `update_rules`, `hide_regex`, `beautify_regex`, `enabled` |
| `html_statusbar` | HTML 状态栏 | `html`, `theme`, `target`, `hide_regex`, `enabled` |
| `html_regex` | regex script | `name`, `findRegex`, `replaceString`, `markdownOnly`, `promptOnly`, `placement`, `runOnEdit`, `source` |
| `ejs_entry` | EJS 动态条目 | `name`, `role`, `content`, `keys`, `constant`, `position`, `order`, `enabled`, `variable_paths`, `template_type` |

当前 `field_path` 使用顶层字段名，例如 `content`，不要写 `worldbook_entry.content`。

## MVU 规则

- `schema_script` 必须包含 `registerMvuSchema`。
- `initvar` 填纯 YAML；builder 会自动包装 `<initvar>`。
- `update_rules` 使用 ZOD + JSON Patch 风格，不混用 beta 命令。
- 启用 MVU 时，开场白建议包含 `<StatusPlaceHolderImpl/>`。

## HTML 规则

- 状态栏 HTML 建议使用 `.wbm-statusbar` 作用域 class。
- 不要使用 `body`、`html`、`*` 这类全局 CSS 选择器污染界面。
- 不依赖外部 URL、字体或图片。
- 第三方导入的 regex 会切成 `html_regex`，`source` 可为 `html` / `mvu` / `third_party` / `unknown`。

## EJS 规则

- EJS 依赖 MVU。
- `variable_paths` 应以 `stat_data` 开头。
- `getwi(...)` 建议使用 `await getwi(...)`。
- 读取变量建议使用 `var` + `typeof` 防重复声明。
- 被 `getwi` 加载的 stage 条目通常 `enabled=false`。

## 第三方资产识别

`init_project` 会尝试识别：

- `extensions.regex_scripts` 中的状态栏、MVU、第三方 regex。
- `extensions.tavern_helper` 中的 MVU bundle 和变量结构脚本。
- 内嵌世界书里的 `[initvar]`、`[mvu_update]`、变量列表。
- 世界书条目内容里的 `<% %>`、`getwi`、`getvar`、EJS 阶段逻辑。

识别到的资产会 draft 化，不再作为普通世界书条目重复导出。
