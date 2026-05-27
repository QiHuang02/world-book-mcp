# 开场白规则

first_mes 必须提供场景钩子、角色当前状态、user 可介入方向。

## 写法要点

- 保持 user 的说话和行动开放。
- user 外貌、性别、房间、职业、性格由用户决定。
- 结尾给开放式选择或可回应动作。
- 开场白以场景推进为主，设定信息只保留当前场景需要的部分。
- 先给时间/地点/可感知环境。
- 展示角色正在做什么。

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
