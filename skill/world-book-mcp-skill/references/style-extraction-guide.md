# 文风提取与风格条目

本文指导如何从源材料中提取写作风格特征，并转化为可指导 AI 输出的世界书条目或 style_profile draft。

## 一、文风提取维度

从源材料中分析以下维度：

| 维度 | 提取内容 | 示例 |
|------|---------|------|
| 叙事视角 | 第一/第二/第三人称，限知/全知 | 第三人称限知 |
| 时态 | 过去时/现在时/混合 | 现在时 |
| 句长节奏 | 短句为主/长句为主/交替变化 | 短句为主，动作段落极短 |
| 对白比例 | 低/中/高 | 高（60%以上是对话） |
| 描写重心 | 动作/环境/心理/对话/感官 | 动作和对话为主，极少心理描写 |
| 标志性技法 | 作者独特的写作手法 | 自由间接引语、环境烘托情绪 |
| 正面规则 | 应该做什么 | 用环境暗示心理，不直接写内心 |
| 负面规则 | 不应该做什么 | 不用破折号解释，不写"似乎" |
| 禁用词/模式 | 作者明确回避的表达 | 不用"一丝""仿佛"，不写八股微表情 |

## 二、提取方法

### 步骤 1：采样

从源材料中选取 3-5 段代表性片段（各 200-500 字），覆盖：
- 日常对话场景
- 动作/冲突场景
- 情绪高潮场景
- 环境描写段落

### 步骤 2：逐维度分析

对每个维度，从采样中提取证据：

```text
### 句长节奏
- 证据："她站起来。椅子倒了。没人看她。"（连续短句，无连接词）
- 证据："走廊尽头的灯灭了，她停下脚步，手指摸到墙壁上的裂缝。"（中等长度，感官细节）
- 结论：动作段落用极短句（3-8字），过渡段落用中等句（15-25字），无长句
```

### 步骤 3：提炼规则

把分析结论转化为可执行的正面/负面规则：

```text
正面规则：
- 动作段落用 3-8 字短句，不加连接词
- 用环境细节（光线、声音、温度）暗示角色情绪
- 对话不加语气修饰，只写说了什么

负面规则：
- 不用破折号做因果解释
- 不写"似乎""仿佛""好像"
- 不在对话后附加心理描写
```

## 三、转化为世界书条目

文风规则转化为世界书条目时，有两种形态：

### 形态 A：呈现方式条目（rephrase=false）

整体叙事基调、互动要求、文风参考。放在 before_char 或 at_depth 位置。

```yaml
<style_guide>
叙事视角: 第三人称限知，只写角色可感知的信息
句长节奏: 动作段落极短句（3-8字），过渡段落中等句（15-25字）
对白规则: 不加语气修饰，不在对话后解释心理
描写重心: 动作和对话为主，环境烘托情绪，极少直接心理描写
禁止:
  - 破折号因果解释
  - "似乎""仿佛""好像"等模糊词
  - 八股微表情（嘴角上扬、眼中闪过）
  - 语气声线标签（带着XX的口吻）
</style_guide>
```

### 形态 B：用户特殊要求条目（rephrase=true）

强调用户的特殊要求、消除 AI 刻板印象。两三句即可：

```yaml
<style_override>
- 克苏鲁世界观但不希望出现血腥描写
- 第三人称叙事，不泄露角色未知的信息
- 对话占比高，减少环境描写篇幅
</style_override>
```

### 条目配置

```text
position: before_char 或 at_depth(depth=0)
order: 1-3（在世界观总纲之前或之后）
constant: true
preventRecursion: true
excludeRecursion: true
```

## 四、MCP 工作流

### 使用 style_profile draft

```text
create_draft_slice(draft_type="style_profile", id="main-style")
→ update_draft_field(field_path="narrative_perspective", value="third_person_limited")
→ update_draft_field(field_path="sentence_length", value="short")
→ update_draft_field(field_path="dialogue_ratio", value="high")
→ update_draft_field(field_path="positive_rules", value=[...])
→ update_draft_field(field_path="negative_rules", value=[...])
→ update_draft_field(field_path="forbidden_terms", value=[...])
→ submit_style_profile / build_style_worldbook_entries
```

### 使用 MCP 工具链

```text
create_style_extraction_template(project_id)
→ 宿主 AI 分析源材料，填写 style profile
→ submit_style_profile(project_id, profile)
→ build_style_worldbook_entries(project_id)：自动生成风格条目和禁词条目
```

## 五、禁词条目

文风提取后应生成禁词条目，防止 AI 使用不符合目标风格的表达。`build_style_worldbook_entries` 会自动生成，也可手动创建：

```yaml
<forbidden_patterns>
禁止使用:
  - 一丝、一缕、一抹
  - 似乎、仿佛、宛如、好像
  - 嘴角微微上扬、眼中闪过
  - 带着XX的口吻、用XX的语气
  - 不是……是……（否定转折句式）
  - ——（解释性破折号）
</forbidden_patterns>
```

## 六、常见错误

| 错误 | 正确 |
|------|------|
| 文风分析写成文学评论 | 写成可执行的正面/负面规则 |
| 规则太抽象（"文笔优美"） | 写具体（"动作段落用 3-8 字短句"） |
| 只写禁止不写应该 | 正面指导比负面约束更有效 |
| 把文风条目写成 500 字长文 | 控制在 200 字以内，简洁可执行 |
| 忘记生成禁词条目 | 文风提取必须配套禁词条目 |

## 七、自查清单

- 是否从源材料中采样了 3-5 段代表性片段？
- 每个维度是否有原文证据支撑？
- 规则是否可执行（AI 读了知道怎么做）？
- 正面规则和负面规则是否都有？
- 禁词条目是否已生成？
- 条目是否控制在 200 字以内？
