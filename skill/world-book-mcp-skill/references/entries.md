# 世界书条目

推荐条目类型：

- `world_summary`：世界观总纲
- `background`：背景设定
- `character_basic`：角色基础信息
- `character_personality`：角色性格
- `player`：`{{user}}` 边界
- `npc`、`item`、`ability`、`scene`、`event`、`faction`
- `style`、`dialogue`

蓝灯条目：`constant: true`，通常 `keys: []`。

绿灯条目：`constant: false`，必须提供 `keys`。

所有条目必须开启：

```yaml
preventRecursion: true
excludeRecursion: true
```

内容推荐 XML-wrapped YAML，但由创作需要决定，不强制。

使用 `configure_draft` 时：

- preview 不写入 draft。
- apply 会追加到 `draft/worldbook.yaml`。
- 重复 id 会被拒绝。
- `content` 必须引用 `source/entries/*`。
- `strategy: auto` 可按 profile 推导蓝/绿灯：`single_character`、`multi_character`、`worldbook`。
- `typeLists` 可覆盖 type 到 before_char / after_char / depth 的映射。
- `strategyThresholds` 可按 type 控制蓝/绿灯阈值。
- `partOrder` 可控制 tens-group order 分组。
- `scope: catalog` 永远蓝灯；`rephrase: true` 强制 at_depth / depth 0。

断点续写字段：

- `status`: `planned | drafted | reviewed | done`
- `abstract`: 条目摘要，供 query/续写时快速判断内容
- `sourceRefs`: 二创/复合项目的来源文件，建议指向 `source/references/*` 或 `source/extraction/*`
- `part`: 条目分组
- `scope`: `catalog | specific`

使用 `update_entry_status` 更新这些字段；使用 `query_entries` 查看统计、缺失摘要、缺失来源和下一步待写条目。
