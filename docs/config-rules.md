# 世界书与角色卡配置规则

本文记录 `world-book-mcp` 内部使用的关键配置约定。

## 世界书 position

`position` 决定世界书条目插入到提示词的哪个位置。

| 名称 | 数值 | 用途 |
|---|---:|---|
| `before_char` | 0 | 角色定义之前。适合世界观总纲、背景、社会规则。 |
| `after_char` | 1 | 角色定义之后。适合角色详情、NPC、物品、场景、事件。 |
| `before_an` | 2 | 作者注之前。适合文风或格式规则。 |
| `after_an` | 3 | 作者注之后，较少使用。 |
| `at_depth` | 4 | 指定聊天深度。当前建议只使用 `depth=0`。 |
| `before_em` | 5 | 示例消息之前。 |
| `after_em` | 6 | 示例消息之后。 |
| `outlet` | 7 | Outlet，当前不推荐。 |

## constant

- `constant=true`：蓝灯，常驻，每轮都发送给 AI。
- `constant=false`：绿灯，关键词触发，必须提供 `keys`。

推荐：

- 世界观总纲：蓝灯。
- 单角色卡核心角色条目：通常蓝灯。
- 多角色卡角色详情、物品、场景、事件：通常绿灯。

## keys

绿灯条目必须有 `keys`。

要求：

- 使用字符串数组。
- 不要使用中文逗号、顿号、中文分号。
- 不要使用空白字符串。
- 角色条目建议包含：全名、昵称、外号。
- 场景条目建议包含：场景名、地点名、别称。

## scanDepth

- 绿灯条目推荐 `scanDepth=2`。
- 蓝灯条目通常不需要 `scanDepth`。

## recursion

所有条目必须显式开启双递归保护：

```json
{
  "preventRecursion": true,
  "excludeRecursion": true
}
```

在 MCP draft 中字段名为：

```json
{
  "preventRecursion": true,
  "excludeRecursion": true
}
```

在角色卡内嵌世界书 extensions 中会转换为：

```json
{
  "prevent_recursion": true,
  "exclude_recursion": true
}
```

## order

同一 position 内按 `order` 从小到大排列。

推荐区间：

| 类型 | order |
|---|---:|
| 世界观总纲 | 1 |
| 背景 / 区域 / 社会规则 | 2-3 |
| 多角色速览 | 4 |
| 角色基础 / 性格 | 10-45 |
| 物品 / 能力 / 场景 / 事件 | 50-98 |
| NPC / 其他 | 99-100 |

## content 格式

除世界观总纲和背景外，世界书条目建议使用 XML 包裹 YAML：

```yaml
<character>
name: 角色名
identity: 身份
</character>
```

不要把纯 JSON 直接写进 `content`。

## 角色卡配置规则

当前角色卡生成器输出基础 `chara_card_v3`。

推荐：

- `description` 为空。
- 角色信息写入内嵌世界书 `character_book.entries`。
- `first_mes` 必填。
- `alternate_greetings` 是字符串数组。
- `character_version` 默认 `1.0`。
- `talkativeness` 默认 `0.5`。

当前角色卡暂不自动生成：

- EJS。
- HTML 美化。

## MVU / ZOD 配置规则

MVU 配置由 `create_mvu_schema_template` 生成模板，由 `submit_mvu_config` 保存。

关键字段：

- `enabled`：是否启用 MVU。
- `style`：当前仅支持 `zod`。
- `schema_script`：ZOD 变量结构脚本，必须包含 `registerMvuSchema`。
- `initvar`：初始变量 YAML。填写纯 YAML，builder 会自动包裹 `<initvar>`。
- `update_rules`：变量更新规则。
- `output_format`：可选。为空时使用默认 JSON Patch 输出格式。
- `variable_list_path`：默认 `stat_data`，也可设为 `false` 禁用变量列表条目。
- `hide_regex`：是否生成隐藏 `<UpdateVariable>` 的正则。
- `beautify_regex`：是否生成变量更新美化正则。

生成的 MVU 资产包括：

- `[initvar]变量初始化勿开` 世界书条目，默认禁用。
- `变量列表` 世界书条目，`at_depth` 且 `depth=0`。
- `[mvu_update]变量更新规则` 世界书条目。
- `[mvu_update]变量输出格式` 世界书条目。
- `[不发送]去除变量更新` 正则脚本。
- `[美化]完整变量更新` 正则脚本。
- `[美化]变量更新中` 正则脚本。
- `MVU` Tavern Helper 核心脚本。
- `变量结构` Tavern Helper 脚本。

启用 MVU 后，角色卡开场白建议包含：

```text
<StatusPlaceHolderImpl/>
```

## HTML 美化配置规则

HTML 美化配置由 `create_html_beautify_template` 生成模板，由 `submit_html_beautify_config` 保存。

关键字段：

- `enabled`：是否启用 HTML 美化。
- `target`：`statusbar`、`global` 或 `both`。
- `theme`：`minimal`、`dark`、`light` 或 `custom`。
- `statusbar.enabled`：是否启用状态栏替换。
- `statusbar.html`：替换 `<StatusPlaceHolderImpl/>` 的 HTML。
- `statusbar.hide_regex`：是否生成不发送给 AI 的占位符隐藏正则。
- `global.regex_scripts`：全局美化正则脚本列表。

状态栏规则：

- 不建议包含 `<script>`。
- CSS 应使用作用域 class，例如 `.wbm-statusbar`。
- 避免使用 `body`、`html`、`*` 等全局选择器。
- 通常配合 MVU 使用。
- 开场白建议包含 `<StatusPlaceHolderImpl/>`。

生成的 HTML assets 包括：

- `[界面]状态栏` 正则脚本。
- `[不发送]界面占位符` 正则脚本。
- 用户配置的全局美化 regex scripts。

## EJS 动态内容规则

EJS 配置由 `create_ejs_template` 生成模板，由 `submit_ejs_config` 保存。

关键字段：

- `enabled`：是否启用 EJS。
- `template_type`：`phase_profile`、`palette` 或 `custom`。
- `variable_paths`：EJS 会读取的 MVU 变量路径，必须以 `stat_data` 开头。
- `entries`：将合并进角色卡内嵌世界书的 EJS 条目。

EJS 条目角色：

- `controller`：控制器条目，通常 enabled=true、constant=true，用 `await getwi()` 加载阶段条目。
- `stage`：阶段条目，通常 enabled=false，由控制器按需加载。
- `inline`：单条目 if/else 型动态内容。
- `helper`：辅助条目。

EJS 规则：

- EJS 必须依赖 MVU。
- 读取变量路径必须使用 `stat_data` 前缀。
- 读取变量建议使用 `var` 和 `typeof` 防重复声明。
- 不建议用 `const` / `let` 读取阶段变量。
- `getwi()` 必须使用 `await getwi('条目名')`。
- 被 `getwi()` 加载的阶段条目应设为 `enabled=false`。
- EJS 标签 `<%` 必须闭合为 `%>`。

生成的 EJS assets 是世界书 draft entries，会在 `generate_character_card_json` 时合并进 `data.character_book.entries`。

## 路径限制

为了避免 MCP 读取或覆盖任意文件：

- 世界书读取/导出限制在 `output/exports/`。
- 角色卡读取/导出限制在 `output/exports/cards/`。
- patch 备份限制在 `output/exports/backups/`。
