# v3 MVU / HTML / regex / EJS 一致性

## 存放位置

| 组件 | 位置 |
|---|---|
| MVU schemaScript/initvar/updateRules/outputFormat | `mvu` slice |
| HTML 状态栏 | `html` slice |
| 通用 regex / 第三方 regex | `regex` slice |
| MVU/HTML 生成 regex | build artifact，不写回 regex slice |
| EJS 动态内容 | `ejs` slices |

## MVU

- 玩家/作者需要安装酒馆助手与提示词模板；角色卡内需要 `MVU` 酒馆助手脚本导入 `MagVarUpdate/artifact/bundle.js`。
- `schemaScript` 是变量结构脚本，必须包含 `export const Schema = z.object(...)`，并在 `$(() => { registerMvuSchema(Schema); })` 中注册。
- `initvar` 字段保存纯 YAML；build 时生成禁用世界书条目 `[initvar]变量初始化勿开`，并包裹为 `<initvar>...</initvar>`。
- `updateRules` 保存纯 YAML，顶层为 `变量更新规则:`；build 时包裹为 `<variable_update_rules>...</variable_update_rules>`。
- `outputFormat` 保存教程式 JSONPatch 输出模板，必须指导 AI 在回复末尾输出 `<UpdateVariable><Analysis>...</Analysis><JSONPatch>[...]</JSONPatch></UpdateVariable>`。
- 变量列表条目使用 `<status_current_variable>{{format_message_variable::stat_data}}</status_current_variable>`。
- JSONPatch 路径用 `/角色/变量`；HTML/EJS/UI 路径用 `stat_data.角色.变量`。
- MVU 工具 path 相对 `variableListPath`，例如 `["角色A", "好感度"]`。
- `_` 前缀 readonly，不应被 updateRules 更新。
- `$` 前缀 hidden，不得进入 outputFormat / HTML / EJS。

## HTML

- HTML 不保存通用 regex scripts；状态栏显示通过 `<StatusPlaceHolderImpl/>` 占位符和 build 生成 regex 完成。
- 状态栏必须有 `.wbm-statusbar` 作用域。
- 使用内联安全 HTML/CSS，样式限定在 `.wbm-statusbar` 范围内。
- 使用 MVU 变量时必须写完整路径：`stat_data.角色A.好感度`，常用宏为 `{{format_message_variable::stat_data.角色A.好感度}}`。
- output 包含角色卡且启用状态栏时，开场白需要 `<StatusPlaceHolderImpl/>`。
- 复杂可交互界面应通过酒馆助手界面/脚本读取与写回 MVU 数据，不在状态栏 HTML 内嵌 `<script>` 或外链。

## regex

- regex 是一级资产，使用 `draft_type="regex"`。
- 一个 regex slice 是一组 scripts。
- script 用稳定 `id` 操作，不用数组下标。
- MVU/HTML 生成的 regex 进入 `assets/regex.json` artifact。
- 教程式状态栏至少有两类生成 regex：`[不发送]界面占位符`（promptOnly，替换为空）与 `[界面]状态栏`（markdownOnly/display，替换为 HTML）。
- MVU 更新输出通常有 `[不发送]去除变量更新` 与显示侧美化 regex，用于隐藏/折叠 `<UpdateVariable>`。

## EJS

- active EJS 必须依赖 MVU 与提示词模板插件。
- `variablePaths` 用完整路径。
- 不引用 hidden 变量。
- 变量读取用 `getvar('stat_data.角色A.好感度', { defaults: 0 })`；多条目共享变量名时用 `if (typeof gw === 'undefined') var gw = ...`，不要用 `let/const` 重复声明。
- 条件模板使用 `<%_ if (...) { _%>...<%_ } _%>`；字符串比较使用 `===` / `!==`。
- controller.stages 必须指向 role=stage 的 EJS slice。
- controller 通过 `<%- await getwi('阶段条目名') %>` 加载禁用 stage；`getwi()` 前必须有 `await`。
- stage 默认 `enabled=false`，通常 `constant=false`。
- 需要让 EJS 结果参与世界书绿灯激活时，在条目开头使用 `@@preprocessing`。

## 教程锚点

本规则参考 StageDog《手写 MVU 变量卡》流程抽象为 MCP 协议：

1. 酒馆助手脚本提供 MVU 运行时，变量结构脚本只负责 `Schema` 与 `registerMvuSchema(Schema)`。
2. 世界书负责四类提示词条目：变量初始化、变量列表、变量更新规则、变量输出格式。
3. 变量输出格式必须让模型输出 JSONPatch；MCP 不要求用户手写最终 JSON，而是在 build 阶段生成条目与脚本。
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
