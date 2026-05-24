# MVU / EJS / HTML 一致性

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
