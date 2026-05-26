# MVU / EJS / HTML 一致性

## 当前 MCP 存放位置

| 组件 | MCP 存放位置 | 导出后位置 | 错误做法 |
|------|-------------|-----------|---------|
| Zod Schema 脚本 | `mvu` slice 的 `schema_script` | `tavern_helper.scripts` | 塞进普通 `entry` |
| `[initvar]` 初始变量 | `mvu` slice 的 `initvar` | MVU 世界书资产条目 | 手工另建普通条目 |
| 变量列表 | `mvu` slice 的 `variable_list_path` / builder 生成 | MVU 世界书资产条目 | 与 schema 路径不一致 |
| `[mvu_update]` 更新规则 | `mvu` slice 的 `update_rules` | MVU 世界书资产条目 | 用 EJS/HTML 改变量 |
| `[mvu_update]` 输出格式 | `mvu` slice 的 `output_format` | MVU 世界书资产条目 | 缺少 schema 路径 |
| HTML 状态栏 | `html.statusbar.html` | regex `replaceString` | 塞进普通 `entry` |
| 全局 HTML/regex | `html.global.regex_scripts` | `regex_scripts` | 污染全局 CSS |
| EJS 动态内容 | `ejs` slices | 世界书条目 | 脱离 MVU 路径 |

## MVU 格式规范

| 组件 | 格式要求 |
|------|---------|
| initvar / update_rules / output_format | 存储纯 YAML，builder 自动包裹 XML 标签 |
| Zod Schema | 必须包含 `export const Schema = z.object(...)` + `registerMvuSchema(Schema)` |
| 默认值 | 推荐 `.prefault()`，避免 `.default()` 造成 MVU 缺省行为异常 |
| 变量路径 | `schema_script`、`initvar`、`update_rules` 三者路径一致 |

变量级修改优先：`list_mvu_variables` → `upsert_mvu_variable` / `remove_mvu_variable` / `rewrite_mvu_variables`。整段编辑只在迁移或大重构时使用。

## tavern_helper 序列化格式

`extensions.tavern_helper` 使用二维数组格式：`[["scripts", [...]], ["variables", {}]]`。导入和导出均使用此结构。

## 正则脚本必备项

MVU 系统至少需要以下正则，builder 会按 `mvu.hide_regex` / `mvu.beautify_regex` 生成：

1. `[不发送]去除变量更新` — promptOnly，隐藏 `<UpdateVariable>` 块。
2. `[不发送]界面占位符` — promptOnly，隐藏 `<StatusPlaceHolderImpl/>`。
3. `[美化]完整变量更新`（可选）— markdownOnly，折叠 `<UpdateVariable>`。
4. `[美化]变量更新中`（可选）— markdownOnly，处理未闭合标签。

## MVU 红线

- schema 必须有 `export const Schema = z.object(...)`。
- 必须调用 `registerMvuSchema(Schema)`。
- `_` 前缀只读，不得被 AI 更新。
- `$` 前缀 hidden，不得输出或被 EJS/HTML 暴露。
- 不混用 ZOD 与 Beta 旧路径；EJS 读取 ZOD 变量用 `stat_data.角色.变量`，不加 `[0]`。

## EJS 红线

- EJS 必须依赖 MVU。
- 变量路径必须完整：`stat_data.角色A.好感度`。
- 不写 `stat_data角色A`、`角色A.好感度` 或过宽的 `stat_data`。
- `variable_paths` 与 `getvar(...)` / `_.get(stat_data, ...)` 对齐。
- `getwi(...)` 引用条目必须存在；stage 默认 `enabled=false`。
- controller 建议 `constant=true`、`enabled=true`。
- 多阶段变量声明必须用 `var` + `typeof` 防重复，不用 `const/let`。

## HTML 红线

- 状态栏必须有 `.wbm-statusbar` 作用域。
- 禁止 `body/html/*` 全局选择器；全局美化必须限定容器 class。
- 禁止外部 URL、字体、图片。
- 禁止 emoji 图标，使用内联 SVG。
- 避免 `vh`，优先 `dvh` 或容器自适应。
- 旧 WebView 中避免 `let/const/箭头函数`，使用 `var` 与 `function`。
- 使用 `{{format_message_variable::stat_data}}` 时必须启用 MVU。
- 写回 MVU 数据时必须“读取完整 MvuData → 只替换 stat_data → 写回完整对象”，不得构造只有 `stat_data` 的 payload 覆盖引擎内部字段。
- 角色卡所有开场白必须含 `<StatusPlaceHolderImpl/>`。

## 固定验证

局部资产修改后：

```text
validate_draft(scope="mvu" | "ejs" | "html")
build_assets(target="mvu" | "ejs" | "html")
```

完整交付前：

```text
validate_draft(scope="delivery")
build_assets(target="all")
review_project
check_delivery
```
