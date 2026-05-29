# 开场白

开场白写入 `source/fields/first_mes.md`，由 `draft/card.yaml` 的 `first_mes` 引用。

要求：

- 使用字面 `{{user}}`。
- 不预设 `{{user}}` 的性别、外貌、行动、心理或无法确认身份。
- 以可互动场景收尾，给用户行动空间。
- 若启用 MVU 或 HTML 状态栏，必须包含 `<StatusPlaceHolderImpl/>`。

备用开场写入 `source/fields/greeting-XX.md`，并加入 `alternate_greetings`。

五步锚点：

1. 时间/地点锚点。
2. 角色当前状态。
3. 明确出现 `{{user}}`。
4. 互动契机。
5. 开放式结尾。

建议准备 2-4 个备用开场，并在时间、氛围、互动方式、空间关系上拉开差异。

避免：

- 对白中过度精确数字。
- 预设 `{{user}}` 行动或心理。
- 封闭式结尾。
