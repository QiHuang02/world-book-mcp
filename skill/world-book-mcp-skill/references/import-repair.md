# 导入与修复

`import_existing_json` 将旧 Tavern JSON 转为 v5 project：

- card fields → `draft/card.yaml` + `source/fields/*`
- 非空 description → 世界书条目
- personality / scenario / creator_notes → 世界书条目
- character_book entries → `source/entries/*` + `draft/worldbook.yaml`
- regex scripts → `source/regex/scripts.yaml`
- 状态栏 regex → `source/html/statusbar.html/css`
- MVU 系统条目 → `source/mvu/*`
- TavernHelper schema → `source/mvu/schema.js`

`import_nova_config` 将 nova-creator-cli 风格 YAML config 转为 v5 project：

- `fields.first_mes` → `source/fields/first_mes.md`
- `fields.description/personality/scenario/creator_notes` → 世界书条目
- `character_book.entries` → `source/entries/*` + `draft/worldbook.yaml`
- `extensions.status_bar` → `source/html/statusbar.html` + `draft/assets.yaml`
- `scripts` 中的变量结构脚本 → `source/mvu/schema.js` + MVU assets

`generate_tavern_sync_config` 可生成 nova `tavern_sync.yaml` 风格桥接配置到 `reports/tavern-sync.yaml`，便于外部同步工具使用；MCP 本身不执行 pull/push/watch。

导入后运行 `validate_project`。常见问题可用 `repair_project` 修复：

- 非空 description
- 缺双递归
- 绿灯无 keys
- CDATA 状态栏
- 裸 `{{stat_data.xxx}}`
- MVU initvar 多包 `stat_data:`
