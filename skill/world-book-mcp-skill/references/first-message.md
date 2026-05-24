# 开场白规则

first_mes 必须提供场景钩子、角色当前状态、user 可介入方向。

## 禁止

- 替 user 说话或行动。
- 预设 user 外貌、性别、房间、职业、性格。
- 用“然后你必须/你只好/你回答”收束。
- 让开场白变成设定说明书。

## 推荐

- 先给时间/地点/可感知环境。
- 展示角色正在做什么。
- 给 user 一个开放式选择或可回应的动作。

## MVU/HTML

启用 MVU 或 HTML 状态栏时必须包含：

```text
<StatusPlaceHolderImpl/>
```

alternate greeting 若包含：

```xml
<UpdateVariable><initvar>...</initvar></UpdateVariable>
```

必须确认 YAML 可解析，并说明它会覆盖默认 initvar。
