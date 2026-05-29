# MVU

MVU 文件：

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
```

`initvar.yaml` 不应额外包一层 `stat_data:`，除非 plan.md 记录原因。

`validate_mvu` 是静态一致性检查，不执行用户提供的 JS。

MVU 变量优先使用变量级工具维护，不要手工大段覆盖五件套：

- `apply_mvu_preset`：写入 `schema.js`、`initvar.yaml`、`update-rules.yaml`、`variable-list.md`、`output-format.md` 并启用 assets.mvu。
- `list_mvu_variables`：列出变量路径、默认值和覆盖情况。
- `upsert_mvu_variable`：新增/更新单变量并同步五件套。
- `remove_mvu_variable`：删除单变量并同步五件套。
- `rewrite_mvu_variables`：按完整变量清单重写五件套。

增强检查包括：

- `schema.js` 是否包含 `export const Schema = z.object(...)`。
- best-effort 解析简单 Zod 字段：`z.string()`、`z.number()`、`z.boolean()` 和简单 `z.object({ ... })` 嵌套。
- schema 必填字段缺失、initvar 类型不匹配会报 error。
- initvar 多余变量、variable-list/output-format 未覆盖变量会给 warning。
