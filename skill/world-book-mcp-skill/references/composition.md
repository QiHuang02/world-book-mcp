# 条目编排

## 条目规划表

每个 `entry` 切片写入前先规划：id、comment、entryType、activation、keys、position、order、scanDepth、内容摘要、sourceRefs。规划写入 `plan.md`。

## 单角色卡

- profile 只保存角色卡字段，`description` 留空。
- 角色基础、外貌、关系、性格调色盘、三面性、二次解释进入 `entry`。
- 核心条目通常蓝灯 `constant=true`。
- 物品、能力、地点、事件建议绿灯 `constant=false + keys + scanDepth=2`。

## 多角色卡

- 角色速览可蓝灯，个体详情、性格、关系条目建议绿灯。
- keys 覆盖角色名、别称、称谓。
- 同一角色的基础/性格/rephrase 用 `characterName` 或 comment 前缀聚合。

## 条目创作循环

对 plan 中每个 planned entry：

1. 检查规划是否完整。
2. `create_draft_slice(draft_type="entry", id=...)`。
3. `update_entry_content` 写 XML-wrapped YAML 正文。
4. `update_entry_config` 写 keys/order/position/enabled 等配置。
5. `validate_project(scope="worldbook")`。
6. 按 `content-rules.md` 做内容自查。

不要积攒到最后才校验。

## DoubleCheck

导出前检查：

- plan 中 planned entries 是否全部有 active slice。
- 角色外貌、性格、关系是否跨条目矛盾。
- 世界观规则是否互相冲突。
- 关系是否双向或有省略说明。
- XML 包裹 YAML、无裸 `---`、无 TODO。
- 绿灯有 keys；物品/能力/场景/事件有合适 `scanDepth`。
- MVU/HTML/regex/EJS 对应 scope 已通过。

每批条目后运行：

```text
validate_project(scope="worldbook")
```
