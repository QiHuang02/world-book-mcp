# draft YAML

Draft 是生成 JSON 的直接配置源。

## card.yaml

- `description` 必须是 `""`。
- `first_mes` 必须引用 `source/fields/first_mes.md`。
- `alternate_greetings` 必须引用 `source/fields/*`。
- `personality/scenario/creator_notes` 等人设内容应进入世界书条目，而不是 card 字段。

## worldbook.yaml

- entry 必须有稳定 `id`。
- `content` 必须引用 `source/entries/*`。
- `position/order/depth/scanDepth` 决定插入位置。
- `preventRecursion` 与 `excludeRecursion` 必须为 true。
- `constant: false` 时必须有 keys。

## assets.yaml

- MVU 文件放 `source/mvu/*`。
- HTML 状态栏放 `source/html/*`。
- regex scripts 放 `source/regex/scripts.yaml`。
- EJS 文件放 `source/ejs/*`，且 EJS 依赖 MVU。
