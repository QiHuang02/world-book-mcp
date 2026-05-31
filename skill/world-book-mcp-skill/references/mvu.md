# MVU

MVU 采用 schema-first 工作流：先确定 `schema.js` 变量结构，再写 `initvar.yaml` 初始值和 `update-rules.yaml` 更新规则；`variable-list.md` 与 `output-format.md` 由工具同步维护。

## 核心文件

```text
source/mvu/schema.js
source/mvu/initvar.yaml
source/mvu/update-rules.yaml
source/mvu/variable-list.md
source/mvu/output-format.md
```

`draft/assets.yaml` 中启用：

```yaml
mvu:
  enabled: true
  schema: ../source/mvu/schema.js
  initvar: ../source/mvu/initvar.yaml
  updateRules: ../source/mvu/update-rules.yaml
  variableList: ../source/mvu/variable-list.md
  outputFormat: ../source/mvu/output-format.md
  variableListPath: stat_data
  hideRegex: true
  beautifyRegex: true
```

`initvar.yaml` 不应额外包一层 `stat_data:`，除非 plan.md 记录原因。

## 路径格式

| 场景 | 格式 | 示例 |
|---|---|---|
| EJS `getvar` | `stat_data.角色.好感度` | `getvar('stat_data.角色.好感度')` |
| AI JSON Patch | `/角色/好感度` | 不带 `stat_data` |
| YAML initvar | 嵌套结构 | `角色: { 好感度: 0 }` |
| 状态栏 safe macro | `{{format_message_variable::stat_data.角色.好感度}}` | 不使用裸 `{{stat_data.xxx}}` |

## 特殊变量前缀

- 无前缀：AI 可见、可更新。
- `_` 前缀：AI 可见但不应由 AI 更新，适合派生/只读状态。
- `$` 前缀：AI 不可见、不应由 AI 更新，适合隐藏运行时状态。

`update-rules.yaml` 不应为 `_` / `$` 变量写更新规则。

## Zod 4 写法规则

- `schema.js` 导出 `export const Schema = z.object({ ... })`，不要导入 zod/lodash；运行时已提供 `z` 和 `_`。
- 数字变量使用 `z.coerce.number()`，范围用 `transform(v => _.clamp(v, min, max))` 修正。
- 保持幂等：`Schema.parse(Schema.parse(x))` 应等于 `Schema.parse(x)`。
- 不使用 `.strict()` / `.passthrough()`。
- 根字段不要滥用 `.optional()`。
- 谨慎使用 `z.enum()`：只有用户明确限定取值或 EJS 条件需要精确匹配时使用。
- 优先用对象/record 表示集合，少用数组下标。
- 对象 key 不使用 `{{user}}` 宏，改用固定标识如 `主角` / `玩家`。

## 变量结构设计流程

先问并记录到 plan.md：

1. 这是什么类型的卡：角色扮演、模拟经营、冒险、恋爱、多角色群像等。
2. 需要追踪哪些主体：世界、核心角色、NPC、物品、任务、地点。
3. 每个主体需要哪些变量：好感、信任、位置、状态、阶段、记忆、背包等。
4. 哪些变量需要取值范围或枚举。
5. 哪些变量只读或隐藏。

结构大纲示例：

```yaml
MVU变量结构:
  世界:
    日期: 当前日期
    时间段: 清晨/上午/下午/夜晚
    地点: 当前主要场景
  角色A:
    好感度: 0-100
    关系阶段: 初识/熟悉/信任/恋人
    当前状态: 可更新文本
  主角:
    物品栏: 对象或 record
```

## variable-list.md 标准格式

工具生成的变量列表采用当前变量块 + 说明区：

```md
---
<status_current_variables>
{{format_message_variable::stat_data}}
</status_current_variables>

# 变量说明
- stat_data.角色A.好感度：角色A对{{user}}的好感度
```

## output-format.md 标准格式

输出格式使用 `<UpdateVariable>` + `<Analysis>` + `<JSONPatch>`。JSON Patch 路径不带 `stat_data`。

```yaml
---
变量输出格式:
  rule:
    - 在下一次回复末尾同时输出更新分析和实际更新命令。
    - 更新命令必须是 JSON Patch 风格的 JSON 数组；路径不带 stat_data 根键。
    - 支持 replace、delta、insert、remove、move；不要更新字段名以 _ 或 $ 开头的变量。
  format: |-
    <UpdateVariable>
    <Analysis>$(IN ENGLISH, no more than 80 words; analyze only the current reply.)</Analysis>
    <JSONPatch>
    [
      { "op": "delta", "path": "/角色A/好感度", "value": 3 },
      { "op": "replace", "path": "/世界/地点", "value": "走廊" }
    ]
    </JSONPatch>
    </UpdateVariable>
```

## update-rules.yaml 写法

规则应说明什么时候更新，而不是每轮机械改值。

```yaml
变量更新规则:
  角色A:
    好感度:
      type: number
      range: 0~100
      check:
        - only update by small deltas when 角色A directly perceives {{user}}'s current reply or action
        - do not update from previous plot summary alone
    关系阶段:
      check:
        - update only when explicit relationship milestone happens in current reply
```

规则：

- 同类变量可以合并说明，减少 token。
- `_` / `$` 变量不写更新规则。
- 不要让 AI 根据“上一轮剧情回忆”重复更新；只依据当前回复。

## 工具优先

MVU 变量优先使用变量级工具维护，不要手工大段覆盖五件套：

- `apply_mvu_preset`：写入 `schema.js`、`initvar.yaml`、`update-rules.yaml`、`variable-list.md`、`output-format.md` 并启用 assets.mvu；`tavern_cards` preset 额外生成 `source/html/变量更新中美化.html` 与 `source/html/变量更新美化.html`。
- `convert_mvu_path`：在 EJS `stat_data.角色.好感度`、AI JSON Patch `/角色/好感度`、YAML 点路径 `角色.好感度` 间互转。
- `list_mvu_variables`：列出变量路径、默认值和覆盖情况。
- `upsert_mvu_variable`：新增/更新单变量并同步五件套。
- `remove_mvu_variable`：删除单变量并同步五件套。
- `rewrite_mvu_variables`：按完整变量清单重写五件套。

## 校验

`validate_mvu` 会先做静态一致性检查，再在受限沙箱中执行 `schema.js`：运行时仅提供 `z` 与 `_ .clamp`，不开放文件/进程能力。

增强检查包括：

- `schema.js` 是否包含 `export const Schema = z.object(...)`。
- schema 必填字段缺失、initvar 类型不匹配会报 error。
- initvar 多余变量、variable-list/output-format 未覆盖变量会给 warning。
- schema 反模式会给 warning：导入 zod/lodash、`.strict()`、`.passthrough()`、直接 `z.number()`、transform 使用 context、key 使用 `{{user}}`。
- schema 沙箱执行失败、`Schema.parse(initvar)` 失败会报 error；非幂等 transform 会给 warning。
- update-rules 包含 `_` / `$` 特殊变量会给 warning。

## 人工语义审查

以下属于创作语义审查，不由 MCP 自动判定：

- `z.enum()` 的阶段值、地点值、关系值是否已有世界书条目或规则解释。
- `initvar.yaml` 的初始地点、阶段、好感度是否与 `first_mes` 开场叙事冲突。
- 状态栏展示变量是否符合开场的初始状态。
- 多阶段调色盘的阶段条件是否和 MVU 变量一致。
