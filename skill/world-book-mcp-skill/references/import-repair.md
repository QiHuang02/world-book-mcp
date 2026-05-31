# 导入与修复

`import_existing_json` 将旧 Tavern JSON 转为 v5 project：

- card fields → `draft/card.yaml` + `source/fields/*`
- 非空 description → 世界书条目
- personality / scenario / creator_notes → 世界书条目
- character_book entries → `source/entries/*` + `draft/worldbook.yaml`
- regex scripts → `source/regex/scripts.yaml`
- 状态栏 regex → `source/html/statusbar.html/css`
- MVU 系统条目 → `source/mvu/*`
- TavernHelper schema / 变量结构脚本 → `source/mvu/schema.js`
- 其他 Tavern Helper scripts → `source/tavern-helper/*` + `source/tavern-helper/scripts.yaml`，默认禁用或要求校验来源

`import_nova_config` 将 nova-creator-cli 风格 YAML config 转为 v5 project：

- `fields.first_mes` → `source/fields/first_mes.md`
- `fields.description/personality/scenario/creator_notes` → 世界书条目
- `character_book.entries` → `source/entries/*` + `draft/worldbook.yaml`
- `extensions.status_bar` → `source/html/statusbar.html` + `draft/assets.yaml`
- `scripts` 中的变量结构脚本 → `source/mvu/schema.js` + MVU assets
- `scripts` 中的其他脚本 → `source/tavern-helper/*` + `draft/assets.yaml`

## Tavern Helper 导入策略

旧卡可能有两种结构：

```yaml
extensions:
  TavernHelper_scripts: []
```

或：

```yaml
extensions:
  tavern_helper:
    scripts: []
```

导入规则：

- 名称包含“变量结构”或 `schema` 的脚本优先识别为 MVU schema。
- 其他脚本保存到 `source/tavern-helper/`。
- 默认不信任第三方外链；脚本包含 URL 且未 `allowExternal: true` 时 `validate_project` 报错。
- 若确需保留外链，必须在 plan.md 记录来源、用途和风险。
- 提示词、破限文本、强制思维链说明不应作为 Tavern Helper 脚本启用。

## generate_tavern_sync_config

`generate_tavern_sync_config` 可生成 nova `tavern_sync.yaml` 风格桥接配置到 `reports/tavern-sync.yaml`，便于外部同步工具使用；MCP 本身不执行 pull/push/watch。

## 常见修复

导入后运行 `validate_project`。常见问题可用 `repair_project` 修复：

- 非空 description。
- 缺双递归。
- 绿灯无 keys。
- CDATA 状态栏。
- 裸 `{{stat_data.xxx}}`。
- MVU initvar 多包 `stat_data:`。

需要人工确认的问题：

- 导入的 regex 是否误吞正文。
- 状态栏是否需要从 dynamic_js 降级为 safe_macro。
- Tavern Helper 外链是否可信。
- 原卡中破限/思维链/成人越界模块是否应删除或改写。
- description/personality/scenario 转入世界书后是否需要按新模板拆分成基础、调色盘、关系、二次解释。
