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

- 必须包含 `export const Schema = z.object(...)`。
- 必须调用 `registerMvuSchema(Schema)`。
- MVU 工具 path 相对 `variableListPath`，例如 `["角色A", "好感度"]`。
- `_` 前缀 readonly，不应被 updateRules 更新。
- `$` 前缀 hidden，不得进入 outputFormat / HTML / EJS。

## HTML

- HTML 不保存通用 regex scripts。
- 状态栏必须有 `.wbm-statusbar` 作用域。
- 使用内联安全 HTML/CSS，样式限定在 `.wbm-statusbar` 范围内。
- 使用 MVU 变量时必须写完整路径：`stat_data.角色A.好感度`。
- output 包含角色卡且启用状态栏时，开场白需要 `<StatusPlaceHolderImpl/>`。

## regex

- regex 是一级资产，使用 `draft_type="regex"`。
- 一个 regex slice 是一组 scripts。
- script 用稳定 `id` 操作，不用数组下标。
- MVU/HTML 生成的 regex 进入 `assets/regex.json` artifact。

## EJS

- active EJS 必须依赖 MVU。
- `variablePaths` 用完整路径。
- 不引用 hidden 变量。
- controller.stages 必须指向 role=stage 的 EJS slice。
- stage 默认 `enabled=false`。

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
