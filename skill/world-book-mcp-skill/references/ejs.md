# EJS

EJS 文件写入：

可用 `create_ejs_stage_template` 生成 controller + disabled stage entries，用于分阶段人设。

## 复杂度分级

- 条目显隐：使用 `@@if 条件` 控制整个条目是否进入上下文。
- 段落控制：在内容文件内使用 `<%_ if (...) { _%>` / `<%_ } _%>` 裁切段落。
- 动态文本：使用 `<%- ... %>`、`getwi()`、`activewi()`、`injectPrompt()` 等高级能力。

多阶段调色盘原则：

- `base_profile` / 底色不随阶段变化。
- `common_derivations` 跨阶段始终存在。
- `exclusive_derivations` 是该阶段新出现的行为，不是上一阶段的升级版。
- `rephrase_notes` 用于阶段专属二次解释。

```text
source/ejs/*.ejs
```

`draft/assets.yaml` 示例：

```yaml
ejs:
  enabled: true
  preprocess:
    file: ../source/ejs/preprocess.ejs
    position: before_char
    order: 14500
    depth: 0
  entries:
    - id: controller
      file: ../source/ejs/controller.ejs
      role: controller
      enabled: true
      position: at_depth
      order: 16000
      depth: 0
      conditionVariables:
        - stat_data.phase
      complexity: dynamic_text
```

规则：

- EJS 依赖 MVU。未启用 MVU 时，`validate_project` 会报错。
- `preprocess` 会生成 `[EJS]预处理` 世界书条目，可用于 `@@generate_before`、`define()` 等变量注册逻辑。
- 共享条件变量集中在预处理条目中注册：

```ejs
@@generate_before
<%_
define('phase', getvar('stat_data.世界.阶段', { defaults: '序章' }));
define('affection', getvar('stat_data.角色.好感度', { defaults: 0 }));
_%>
```

- 后续条目直接使用 `phase` / `affection`，不要每个条目重复读取。
- `getvar()` 读取 MVU 变量时必须使用 `stat_data.` 前缀。
- `@@` 装饰器应放在文件首个非空行；`@@if` 条件必须是一行。
- `role: stage` 的阶段条目通常应禁用，由 controller 动态加载；启用时会 warning。
- EJS 标签 `<%` / `%>` 应配对；不配对会 warning。
- EJS 中使用 `getwi(` / `activewi(` 时建议分别 `await getwi(` / `await activewi(`。
- 建议使用 `var` 和 `typeof` 防重复声明；`let` / `const` 会 warning。
- `@@if` 条件必须保持单行；跨行条件会 warning。
- 使用 `stat_data.xxx` 时应在 `conditionVariables` 中登记，便于校验变量依赖；登记后预处理文件应包含对应路径，或在 `@@generate_before` 中通过 `define('xxx', getvar('stat_data.xxx'))` 注册同名短变量。
