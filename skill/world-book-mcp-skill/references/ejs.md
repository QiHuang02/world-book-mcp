# EJS

EJS 文件写入：

可用 `create_ejs_stage_template` 生成 controller + disabled stage entries，用于分阶段人设。

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
- `role: stage` 的阶段条目通常应禁用，由 controller 动态加载；启用时会 warning。
- EJS 中使用 `getwi(` 时建议 `await getwi(`。
- 建议使用 `var` 和 `typeof` 防重复声明；`let` / `const` 会 warning。
- 使用 `stat_data.xxx` 时应在 `conditionVariables` 中登记，便于校验变量依赖。
