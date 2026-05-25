# MVU / EJS / HTML 一致性

## MVU 组件存放位置

| 组件 | 正确存放位置 | 错误做法 |
|------|------------|---------|
| Zod Schema 脚本 | 酒馆助手脚本库 → 角色脚本（`tavern_helper.scripts`） | 塞进世界书条目 |
| `[initvar]` 初始变量 | 世界书条目（禁用状态，蓝灯） | — |
| 变量列表 | 世界书条目（蓝灯，D0） | — |
| `[mvu_update]` 更新规则 | 世界书条目（蓝灯，D0） | — |
| `[mvu_update]` 输出格式 | 世界书条目（蓝灯，D0） | — |
| HTML 状态栏 | 正则脚本 `replaceString`（`regex_scripts`） | 塞进世界书条目 |
| 正则隐藏规则 | `regex_scripts` 数组 | 塞进世界书条目 |
| EJS 预处理 | 世界书条目（`@@preprocessing` 装饰器） | — |
| EJS 条件显隐 | 世界书条目 contents 首片段 `@@if` | — |

## MVU 格式规范

| 组件 | 格式要求 |
|------|---------|
| initvar / update_rules / output_format | 存储纯 YAML，builder 自动包裹 XML 标签 |
| Zod Schema | 必须包含 `import { registerMvuSchema }` + `export const Schema = z.object(...)` + `$(() => { registerMvuSchema(Schema); })` |
| HTML 状态栏 | 完整 `<!DOCTYPE html>` 文档，内联所有 CSS/JS，禁止外部引用 |

## tavern_helper 序列化格式

`extensions.tavern_helper` 使用二维数组格式：`[["scripts", [...]], ["variables", {}]]`。导入和导出均使用此结构。

## 正则脚本必备项

MVU 系统至少需要以下正则：

1. `[不发送]去除变量更新` — promptOnly，隐藏 `<UpdateVariable>` 块（minDepth: 4）
2. `[不发送]界面占位符` — promptOnly，隐藏 `<StatusPlaceHolderImpl/>`
3. `[美化]完整变量更新`（可选） — markdownOnly，折叠 `<UpdateVariable>`
4. `[美化]变量更新中`（可选） — markdownOnly，处理未闭合标签

## MVU

- schema 必须有 `export const Schema = z.object(...)`。
- 必须调用 `registerMvuSchema(Schema)`。
- initvar 每个路径必须存在于 schema。
- update_rules 每个路径必须存在于 schema。
- `_` 前缀只读，不得被 AI 更新。
- `$` 前缀 hidden，不得输出或被 EJS 读取。
- 默认值建议 `.prefault()`。

## EJS

- EJS 必须依赖 MVU。
- 变量路径必须完整：`stat_data.角色A.好感度`。
- 不写 `stat_data角色A`、`角色A.好感度` 或过宽的 `stat_data`。
- `variable_paths` 与 `getvar(...)` / `_.get(stat_data, ...)` 对齐。
- `getwi(...)` 引用条目必须存在；stage 默认 `enabled=false`。
- controller 建议 `constant=true`、`enabled=true`。

### 多阶段 EJS 人设

- 变量声明必须用 `var` + `typeof` 防重复声明，不可用 `const` / `let`。
- 条件边界无重叠无遗漏，最后一个分支用 `else` 兜底。
- 底色和通用衍生放在所有条件外，始终发送。
- 阶段专属衍生是该阶段新出现的行为，不是上一阶段衍生的升级版。
- 二次解释：通用的放条件外，阶段专属的用条件包裹。
- 方案 A（controller + getwi）：controller `constant=true`、`enabled=true`；stage `enabled=false`。
- 方案 B（单条目 if/else）：条目 `constant=true`、`enabled=true`。
- `stages` 字段可选，用于记录阶段名称和条件表达式，辅助校验。
- 详见 `references/multi-stage-ejs.md`。

## HTML

- 状态栏必须有 `.wbm-statusbar` 作用域。
- 禁止 `body/html/*` 全局选择器。
- 禁止外部 URL、字体、图片。
- 使用 `{{format_message_variable::stat_data}}` 时必须启用 MVU。
- 角色卡开场白必须含 `<StatusPlaceHolderImpl/>`。

## 固定验证

```text
validate_draft(scope="mvu")
validate_draft(scope="ejs")
validate_draft(scope="html")
build_assets(target="all")
review_project
check_delivery
```
