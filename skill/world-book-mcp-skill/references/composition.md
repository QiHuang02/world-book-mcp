# 条目编排

## 条目规划表

每个 `entry` 切片写入前先规划：id、comment、entryType、activation、keys、position、order、scanDepth、内容摘要、sourceRefs。规划写入 `plan.md`，作为断点续作事实源。

## 单角色卡

- profile 只保存角色卡字段，`description` 留空。
- 角色基础、外貌、关系、性格调色盘、三面性、二次解释进入 `entry`。
- 单角色核心条目通常蓝灯 `constant=true`。
- 物品、能力、地点、事件建议绿灯 `constant=false + keys + scanDepth=2`。

## 多角色卡

- 角色速览可蓝灯，个体详情、性格、关系条目建议绿灯。
- keys 覆盖角色名、别称、称谓。
- 同一角色的基础/性格/rephrase 要能通过 `characterName` 或 comment 前缀聚合。

## 内容形态

- 世界观总纲：边界、规则、冲突，不写百科废话。
- 角色基础：身份、外貌特征、行动方式、关系入口；不混入性格标签。
- 性格：写行为证据，不写抽象标签。
- 物品/能力：用途、限制、代价、触发场景。
- 场景/NPC：只写可被互动使用的信息。
- 扮演准则/阶段指导：只有用户需要特定呈现或阶段化玩法时写；阶段指导通常配合 EJS。

## 条目创作循环

对 plan 中每个 planned entry：

1. 检查该条目规划是否完整；缺字段则先补 plan 或发起 user decision。
2. 按条目类型读取对应规则文档。
3. 写数据库式 XML+YAML 内容，保持简体中文、具体名词、无占位符。
4. 宿主 AI 按 `content-rules.md` 进行禁词、八股、具体性和审美自查；MCP 不返回这些主观问题。
5. `create_draft_slice(draft_type="entry", id=...)` 后立刻 `update_draft_fields` 写入字段。
6. 运行 `validate_draft(scope="worldbook")` 检查结构与协议问题。
7. 继续下一条；不要积攒到最后才校验。

## DoubleCheck

全部条目完成后、进入导出前执行：

- 规划覆盖：plan 中 planned entries 是否全部有对应 enabled slice。
- 一致性：角色外貌、性格、关系是否跨条目矛盾；世界观规则是否互相冲突。
- 关系双向：A 条目写与 B 的关系，B 条目也应有对应视角或 plan 中说明省略原因。
- 全局禁词：宿主 AI 按 `content-rules.md` 检查量子词、破折号、微表情、声线标签、廉价比喻等。
- 格式：XML 包裹 YAML、无裸 `---`、无繁体/日文汉字、无 TODO/某城市/某组织。
- 配置：绿灯有 keys；物品/能力/场景/事件有合适 `scanDepth`；双递归开启。
- 资产：MVU/EJS/HTML 一致性已过对应 scope。

## 常见调整

用户要求修改已写条目时：定位 slice → 按规则修正 → 重跑 worldbook 或相关 scope 校验 → 按 `content-rules.md` 自查 → 检查是否影响其他条目。

中途增加角色、修改 MVU 结构、调整条目规划时：先更新 plan，评估影响范围，再同步修改相关 slices。涉及 MVU 的结构变更必须同步 schema/initvar/update_rules。

每批条目后运行：

```text
validate_draft(scope="worldbook")
```

然后由宿主 AI 按 `content-rules.md` 做内容自查。
