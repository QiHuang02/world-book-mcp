# MVU / HTML / regex / EJS 一致性

## 存放位置

| 组件 | 位置 |
|---|---|
| MVU runtime（schemaScript/variableListPath/hideRegex/beautifyRegex） | `mvu` slice |
| MVU 系统提示词（initvar/变量列表/updateRules/outputFormat） | 真实 `entry` slices：`mvu-initvar`、`mvu-variable-list`、`mvu-update-rules`、`mvu-output-format` |
| HTML 状态栏 | `html` slice |
| 通用 regex / 第三方 regex | `regex` slice |
| MVU/HTML 生成 regex | build artifact：`assets/regex.yaml`，不写回 regex slice |
| EJS 动态内容 | `ejs` slices |

## MVU 模块顺序映射

MVU 组件流程可映射到 MCP：

1. **变量结构设计（Zod 脚本）** → `mvu.schemaScript`
2. **变量初始化** → `mvu-initvar` entry
3. **变量更新规则** → `mvu-update-rules` entry
4. **变量列表** → `mvu-variable-list` entry
5. **变量输出格式** → `mvu-output-format` entry
6. **分阶段角色设定 / 动态世界内容** → `ejs` slices
7. **HTML 状态栏** → `html` slice + build 生成 regex

MCP 事实源是 YAML project/slices；不要依赖 loose source files。

## MVU

- 玩家/作者需要安装酒馆助手与提示词模板；角色卡内需要 `MVU` 酒馆助手脚本导入 `MagVarUpdate/artifact/bundle.js`。
- `schemaScript` 是变量结构脚本，必须包含 `export const Schema = z.object(...)`，并在 `$(() => { registerMvuSchema(Schema); })` 中注册。
- `initvar` 保存在真实 entry `mvu-initvar` 中；正文用 `update_entry_content` 编辑，工具会包裹为 `<initvar>...</initvar>`。
- `updateRules` 保存在真实 entry `mvu-update-rules` 中；正文顶层为 `变量更新规则:`，工具会包裹为 `<variable_update_rules>...</variable_update_rules>`。
- `outputFormat` 保存在真实 entry `mvu-output-format` 中，必须指导 AI 在回复末尾输出 `<UpdateVariable><Analysis>...</Analysis><JSONPatch>[...]</JSONPatch></UpdateVariable>`，工具会包裹为 `<variable_output_format>...</variable_output_format>`。
- 变量列表保存在真实 entry `mvu-variable-list` 中，使用 `<status_current_variable>{{format_message_variable::stat_data}}</status_current_variable>`。
- JSONPatch 路径用 `/角色/变量`；HTML/EJS/UI 路径用 `stat_data.角色.变量`。
- MVU 工具 path 相对 `variableListPath`，例如 `["角色A", "好感度"]`。
- `_` 前缀 readonly，不应被 updateRules 更新。
- `$` 前缀 hidden，不得进入 outputFormat / HTML / EJS。

### Zod Schema 设计要点

- `z` 与 `_` 在 MVU 运行环境中可用；生成脚本时不要重复导入 lodash/zod。
- 优先用 `z.coerce.number()` 处理数值，避免字符串数字导致比较错误。
- 对象优于数组：经常按名称访问的数据用 `z.record()` 或 `z.object()`，少用数组索引。
- 可被 JSONPatch 清空/删除后恢复的对象用 `.prefault({})`，内部字段也要有 `.prefault(...)`。
- 范围边界放 schema：`z.coerce.number().transform(v => _.clamp(v, 0, 100)).prefault(0)`。
- 谨慎使用 `z.transform`，保持幂等：`Schema.parse(Schema.parse(input))` 应仍可通过。
- 不使用 `.passthrough()`、`.optional()`、`.nullable()`、`.nullish()`、`.catch()` 等会破坏 MVU 增量更新稳定性的写法，除非 plan 记录了明确兼容原因。
- 仅在用户明确要求时施加强验证；默认优先容错修正而不是拒绝更新。

### MVU 系统条目与 `initvar` 内容

- 创建 `mvu` slice 时，MCP 同步创建四个真实 MVU 系统 entry，order 依次为 `14720` `[initvar]变量初始化`、`14721` `变量列表`、`14722` `[mvu_update]变量更新规则`、`14723` `[mvu_update]变量输出格式`。
- 四个系统条目的 comment/order/position/enabled/depth 通过 `update_entry_config` 直接调整；不要再创建普通 entry slice 复制它们，否则会在导出中重复。
- 默认 `[initvar]变量初始化` 为 `enabled=true`、`position=at_depth`、`depth=0`。
- 启用 MVU 且 schema 有变量时，`initvar` 必须根据世界观、角色卡与开场白时点写出初始变量；不要留空、只写 `{}`、`null`、空字符串或无意义占位。
- 初始值应来自当前场景：地点、时间、局势、角色关系、目标对象、好感/信任/敌意、任务进度、资源、已知物品/配方、心理/身体状态等。
- 无法从设定推导时使用保守中性默认值，并保证后续可被 updateRules 更新；MCP 只校验结构，不会主观生成剧情初始状态。
- 初始 YAML 不添加 schema 外字段；数字直接写数字，布尔写 `true/false`，空对象写 `{}`。

### MVU 根层级与 `initvar` 对齐

- `variableListPath="stat_data"` 是酒馆助手运行时变量名，不是 `schemaScript` / `initvar` 的额外根键。
- 若 schema 为 `export const Schema = z.object({ target: z.object({ ... }), current_time: z.string().prefault("") })`，则 `initvar` 必须直接写 `target:` 与 `current_time:`，不能再包一层 `stat_data:`。
- 禁止默认写成 `stat_data: { target: ... }`。这会让路径变成 `stat_data.stat_data...` 或导致 MVU 在 `target` 处读到 `undefined`，常见报错是 `expected object, received undefined at target`。
- 如果确实把 schema 设计为 `z.object({ stat_data: z.object(...) })`，必须在 plan 中说明原因；普通角色卡默认不要这样做。
- 对象节点（如 `target`、`世界`、`角色`）必须满足其一：`initvar` 中存在完整默认对象结构；或对象 schema 使用 `.prefault({})`，且内部字段也逐一 `.prefault(...)`。
- 修复 `target` 初始化错误时，先检查 `initvar` 是否误多写 `stat_data:`，再检查 `target:` 是否缺失。

结构正确但需要按具体卡内容替换的示例：

```yaml
target:
  name: ""
  affection: 0
  progress: 0
current_zone: "菌丝穹顶入口"
current_time: "初次抵达"
known_recipes: []
shop_gold: 0
```

错误示例：

```yaml
stat_data:
  target:
    name: ""
```

### `[mvu_update]变量更新规则` 格式

- updateRules 只写更新条件和类型说明，不写 JS 执行语句。
- 禁止旧式片段：`target.affection = _.clamp(target.affection, 0, 100);`。
- 数值边界放进 schema：`z.coerce.number().transform(v => _.clamp(v, 0, 100)).prefault(0)`。
- 字符串变量可省略 `type` 字段；同类变量可用 `${变量}` 占位符合并规则。
- 动态键用 `type` 的索引签名描述，不要把不存在的 key 硬写为固定路径。
- 省略自明变量，保持规则简洁。

updateRules 示例：

```yaml
变量更新规则:
  target:
    affection:
      type: number
      range: 0~100
      check:
        - 根据本轮互动中目标对苏苓行为的反应调整，变化保持克制
```

### `[mvu_update]变量输出格式`

默认使用 JSON Patch (RFC 6902) 风格，只允许：

- `replace`：替换已存在路径的值。
- `add`：向对象添加新键或向数组指定位置/末尾添加元素。
- `remove`：删除对象键或数组项。

路径规则：

- 使用 `/` 分隔：`/角色/好感度`。
- 数组索引用数字：`/记忆/0`。
- 数组末尾用 `-`：`/记忆/-`。

不要在默认模板中使用旧式 `_.set`、`_.add`，也不要使用非标准兼容操作 `delta`、`insert`、`move`，除非用户明确要求并在 plan 中记录。

## HTML

- HTML 不保存通用 regex scripts；状态栏显示通过 `<StatusPlaceHolderImpl/>` 占位符和 build 生成 regex 完成。
- 状态栏必须有 `.wbm-statusbar` 作用域。
- 使用内联安全 HTML/CSS，样式限定在 `.wbm-statusbar` 范围内。
- HTML/EJS/UI 路径使用完整路径：`stat_data.角色A.好感度`。
- HTML 状态栏展示 MVU 变量时必须把完整路径包成宏：`{{format_message_variable::stat_data.角色A.好感度}}`。
- 禁止裸变量宏：`{{stat_data.角色A.好感度}}`、`{{stat_data.target.name}}`、`{{current_zone}}`。
- 展示整棵变量树时使用 `{{format_message_variable::stat_data}}`。
- output 包含角色卡且启用状态栏时，开场白需要 `<StatusPlaceHolderImpl/>`。
- 交互式状态栏可能包含 jQuery、`getAllVariables()`、`waitGlobalInitialized('Mvu')` 和 `<script type="module">`。当前 MCP 安全默认是不在状态栏 HTML 内嵌 `<script>` 或外链；需要交互式 UI 时记录为未来增强或用户决策。

常见状态栏宏转换：

```text
{{stat_data.current_zone}}      → {{format_message_variable::stat_data.current_zone}}
{{stat_data.current_time}}      → {{format_message_variable::stat_data.current_time}}
{{stat_data.shop_level}}        → {{format_message_variable::stat_data.shop_level}}
{{stat_data.shop_gold}}         → {{format_message_variable::stat_data.shop_gold}}
{{stat_data.shop_reputation}}   → {{format_message_variable::stat_data.shop_reputation}}
{{stat_data.customer_type}}     → {{format_message_variable::stat_data.customer_type}}
{{stat_data.target.name}}       → {{format_message_variable::stat_data.target.name}}
{{stat_data.target.tags}}       → {{format_message_variable::stat_data.target.tags}}
{{stat_data.target.affection}}  → {{format_message_variable::stat_data.target.affection}}
{{stat_data.target.progress}}   → {{format_message_variable::stat_data.target.progress}}
{{stat_data.target.mental}}     → {{format_message_variable::stat_data.target.mental}}
{{stat_data.known_recipes}}     → {{format_message_variable::stat_data.known_recipes}}
{{stat_data.total_recipes}}     → {{format_message_variable::stat_data.total_recipes}}
{{stat_data.essence_available}} → {{format_message_variable::stat_data.essence_available}}
```

## regex

- regex 是一级资产，使用 `draft_type="regex"`。
- 一个 regex slice 是一组 scripts。
- script 用稳定 `id` 操作，不用数组下标。
- MVU/HTML 生成的 regex 进入 `assets/regex.yaml` artifact。
- 教程式状态栏至少有两类生成 regex：`[不发送]界面占位符`（promptOnly，替换为空）与 `[界面]状态栏`（markdownOnly/display，替换为 HTML）。
- MVU 更新输出通常有 `[不发送]去除变量更新` 与显示侧美化 regex，用于隐藏/折叠 `<UpdateVariable>`。
- `[界面]状态栏` 的 `replaceString` 必须是普通 HTML/CSS 字符串，禁止 CDATA 包裹。
- 禁止出现 `<![CDATA[`、`]]>`、`<![CDATA[]]>`。
- 从已有卡导入后若发现 CDATA，剥掉 CDATA 外壳；若 CDATA 为空，重写为标准状态栏 HTML 或空字符串，不保留空壳。

```text
错误：replaceString = "<![CDATA[\n<div class=\"wbm-statusbar\">...</div>\n]]>"
正确：replaceString = "<div class=\"wbm-statusbar\">...</div>"
```

## EJS

- active EJS 必须依赖 MVU 与提示词模板插件。
- `variablePaths` 用完整路径。
- 不引用 hidden 变量。
- 变量读取用 `getvar('stat_data.角色A.好感度', { defaults: 0 })`；多条目共享变量名时用 `if (typeof gw === 'undefined') var gw = ...`，不要用 `let/const` 重复声明。
- 条件模板使用 `<%_ if (...) { _%>...<%_ } _%>`；字符串比较使用 `===` / `!==`。
- 分阶段模板强调每个分支内容必须完整自洽，阶段行为不是上一阶段的简单升级。
- controller.stages 必须指向 role=stage 的 EJS slice。
- controller 通过 `<%- await getwi('阶段条目名') %>` 加载禁用 stage；`getwi()` 前必须有 `await`。
- stage 默认 `enabled=false`，通常 `constant=false`。
- 动态世界内容应使用小写英文 XML 标签包裹提示词片段，例如 `<plot_guide>`、`<event_trigger>`，增强可见性。
- 需要让 EJS 结果参与世界书绿灯激活时，在条目开头使用 `@@preprocessing`。

## 教程锚点

本规则参考 MVU 变量卡流程抽象为 MCP 协议：

1. 酒馆助手脚本提供 MVU 运行时，变量结构脚本只负责 `Schema` 与 `registerMvuSchema(Schema)`。
2. 世界书负责四类提示词条目：变量初始化、变量列表、变量更新规则、变量输出格式。
3. 变量输出格式必须让模型输出 JSONPatch；MCP 把这些系统提示词保存为真实 entry slices，build 阶段只汇总已有 entry 与脚本资产。
4. HTML 状态栏不直接发送给模型；通过 `<StatusPlaceHolderImpl/>` 和 regex 分离“隐藏提示词”和“显示界面”。
5. EJS 是提示词模板层，负责按 MVU 变量动态组织条目；需要 `getvar()`、`await getwi()` 与可选 `@@preprocessing`。

## 固定验证

局部资产修改后：

```text
validate_project(scope="mvu" | "html" | "regex" | "ejs")
build_assets(target="mvu" | "html" | "regex" | "ejs" | "all")
```

完整交付前：

```text
build_assets(target="all")
validate_project(scope="delivery", build_id=...)
generate_json(build_id=...)
```
