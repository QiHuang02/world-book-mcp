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
