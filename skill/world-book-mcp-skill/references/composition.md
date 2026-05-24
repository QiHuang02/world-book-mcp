# 条目编排

## 条目规划表

每个条目前先规划：comment、entryType、activation、keys、position、order、scanDepth、内容摘要。

## 单角色卡

- 角色基础/性格/关系核心可用蓝灯 constant=true。
- 物品、能力、地点、事件建议绿灯 constant=false + keys + scanDepth=2。
- description 默认留空，信息进入世界书。

## 多角色卡

- 角色详情、性格、关系条目建议绿灯。
- keys 覆盖角色名、别称、称谓。
- 总纲可以蓝灯，个体细节用绿灯避免污染上下文。

## 内容形态

- 世界观总纲：边界、规则、冲突，不写百科废话。
- 角色速览：身份、外貌特征、行动方式、关系入口。
- 性格：写行为证据，不写抽象标签。
- 物品/能力：用途、限制、代价、触发场景。
- 场景/NPC：只写可被互动使用的信息。

每批条目后运行 `validate_draft(scope="worldbook")`。
