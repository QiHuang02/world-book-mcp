# 角色人物设定方法论

本文指导如何创建完善的角色人物设定并转化为世界书条目。涵盖角色结构、性格方法论、开场白创作。角色外貌辨识度、抽象性格标签、关系证据属于 skill 主观审稿范围，不由 MCP server 判断。

## 一、角色条目完整结构

角色条目使用 XML 包裹 YAML 格式。XML 标签独占一行，内部为缩进的 YAML 键值对。

```yaml
<character>
name: 中文名
age: 年龄 + 身份定位
gender: 性别
nicknames: 昵称1、昵称2
appearance:
  height: 数值+单位
  hair: 发型/发色/长度，30字以内，只写特征
  eyes: 瞳色/眼型，30字以内，写特征不写比喻
  skin: 肤色，20字以内，只写偏离默认的特征
  build: 体型，20字以内
  clothing:
    日常: xxx
    正式: xxx
  distinguishing: 标志性特征、异于常人的地方
  voice: 说话习惯与语料特征，不写声线标签
personality:
  core_drive: 最想要什么、最怕什么，一句话概括
  traits:
    - 性格特征（附带行为依据）
    - ...（10-15条）
  likes: 具体事物，句号分隔
  dislikes: 具体事物，句号分隔
  habits: 习惯性动作/行为模式
  hidden_self:
    - 不轻易示人的一面
background: |
  只写“改变了这个人”的关键事件。不写流水账。
abilities:
  - name: 能力名称
    acquisition: 如何获得
    effects:
      - 具体做了什么（含限制和代价）
relationships:
  - name: 角色名或{{user}}
    detail: 具体画面而非抽象形容
NSFW:
  sexual_characteristics:
    sexual_experience: 
    sexual_orientation: 
    sexual_role: 
    sexual_habits:
  fetishes:
  boundaries:
</character>
```

## 二、各字段写法规格

### 外貌：只写特征

AI 有数据库默认认知。只写偏离默认的部分。

| 不用写 | 要写 |
|--------|------|
| 中国人的黑发黑眼 | 异色瞳、疤痕、纹身、义肢 |
| 18岁女生的年轻皮肤 | 特殊发色、标志性服装 |
| “精致、白皙、好看” | 体型偏差、习惯性饰品 |

**判断标准：遮住名字，能否只靠外貌特征认出是谁？**

### 性格：有行为依据

- 每条 trait 附带行为依据
- 不写“她温柔”→写“空鱼受伤时不说教，沉默地坐在旁边递绷带”
- `hidden_self` 写表里矛盾

### 背景：只写关键事件

- 测试：删掉这条，角色会不会变？不会→删
- 不写“她小时候很可爱”“学习成绩不错”

### 能力：数据化

- 写具体做了什么，不写“威力强大”
- 格式：“触碰X可以做到Y”而非“拥有强大的X能力”
- 限制和代价写在 effects 中

### 关系：具体画面

- 不写“深厚的感情”“好朋友”
- 写具体事件和互动方式

## 三、性格独立原则

性格**不写在基本信息里**，放在独立的性格世界书条目中。

- “她17岁，高二，吉他手”是基本信息
- “她表面冷漠实则护短、讨厌虚伪”是性格

混在一起会导致 AI 读到基本信息就调用性格标签，后面的性格条目全在打架。

性格条目格式：

```yaml
<{{角色拼音}}_personality>
核心驱动力: 一句话概括
性格特征:
  - 特征——行为依据
  - ...
深层心理:
  - 不轻易示人的一面
喜欢: 具体事物
讨厌: 具体事物
习惯动作: 具体行为
</{{角色拼音}}_personality>
```

## 四、性格调色盘方法

用于深度角色设计。结构：

- **底色**：最深层的性格基调，始终存在但不一定最明显
- **主色调**：日常最突出的性格，别人的第一印象（1-2个）
- **点缀**：特定条件下才出现的隐藏性格（0+个）
- **衍生**：每个性格色彩在具体场景中的表现（核心）

规则：

- 衍生写具体场景和行为，不写抽象定义
- 每个性格至少 2-3 个衍生
- 可以写看似矛盾的内容——人就是复杂的
- 可以跨性格关联衍生

## 五、三面性方法

同一个人在不同压力环境下启动不同的生存策略。不是所有角色都需要——如果找不出两个以上“压力性质截然不同”的场景，就不需要。

每张面需要五个部件：

1. **触发条件**：什么情况下启动
2. **能量状态**：消耗多少精力
3. **语料**：5-10 句具体台词（纯对话，不混入动作/表情/心理）
4. **身体行为模式**：身体怎么动
5. **功能**：这张面在保护什么/解决什么问题

还需要：

- **过渡**：面与面之间的切换过程（至少两组）
- **渗透**：一张面运行中其他面的元素泄漏

## 六、开场白创作

### 核心要求

1. **开头 3 行制造吸引力**——悬念、反常细节或情绪拉力
2. **剧情动力完整**——玩家身份明确、到场动机清晰、结尾有行为方向
3. **不替 user 做决定**——不预设外貌、性别、行动、房间

### 叙事式开场白要点

- 从场景描写开始，逐步聚焦到角色
- 角色通过行为和对话自然出场，不做人物介绍式罗列
- 结尾留出互动点——让 user 有明确的事可回应

### MVU 项目

- 开场白状态必须与 initvar 一致
- 启用 MVU/HTML 状态栏时必须包含 `<StatusPlaceHolderImpl/>`
- 额外开场白如需不同初始变量，在末尾嵌入 `<UpdateVariable><initvar>...</initvar></UpdateVariable>`

## 七、MCP 工作流

```text
init_project(output="character_card"|"both", source="original", opening=...)
→ update_plan：记录角色列表、关系、卡型、条目规划
→ update_character_profile(changes={ name, description:"", include_worldbook:true, worldbook_name, ... })
→ create_draft_slice(draft_type="entry", id="char-basic")：角色基本信息条目
→ update_entry_content(id="char-basic", content=角色基本信息)
→ update_entry_config(id="char-basic", changes={ entryType:"character_basic", characterName, constant, position, order, keys })
→ create_draft_slice(draft_type="entry", id="char-personality")：性格独立条目
→ update_entry_content(id="char-personality", content=性格内容)
→ update_entry_config(id="char-personality", changes={ entryType:"character_personality", characterName, constant, position, order, keys })
→ 可选：物品/能力/场景/NPC entry 条目
→ update_character_greetings(changes={ first_mes, alternate_greetings })
→ validate_project(scope="character_card")
→ validate_project(scope="worldbook")
→ 按 content-rules.md 做角色辨识度、抽象标签、八股禁词自查
```

### 条目配置速查

| 条目 | position | constant | keys |
|------|----------|----------|------|
| 角色基本信息（单卡） | after_char | true | — |
| 角色基本信息（多卡） | after_char | false | 全名,昵称,外号 |
| 性格条目 | after_char | 同上 | 同上 |
| 物品/能力 | after_char | false | 物品名,简称 |
| 场景 | after_char | false | 场景名,地点 |

## 八、压缩规则

| 错误 | 正确 |
|------|------|
| 精致的脸蛋，白皙的皮肤，桃花眼 | 猫眼，笑起来弯成月牙 |
| 身材匀称，亭亭玉立 | 168cm，手臂有吉他练出的肌肉线条 |
| 温婉优雅 | （不写，这是性格条目的事） |
| 拥有强大的演奏能力 | 即兴solo，任何曲子听一遍能复刻 |
| 从小一起长大感情深厚 | 有记忆起就在一起。交换拨片是她说“你很重要”的方式 |
| 她很温柔很善良 | 遇到受伤的小动物会带回家照顾 |

## 九、自查清单

- 角色条目是否使用 XML 包裹 YAML 格式？
- 外貌是否只写了偏离默认的特征？遮住名字能认出是谁？
- 性格是否从基本信息中独立成单独条目？
- 每条 trait 是否附带行为依据？
- 背景是否只写了改变角色的关键事件？
- 能力是否写了具体效果和限制？
- 关系是否写了具体画面而非抽象标签？
- 开场白是否在前 3 行制造了吸引力？
- 开场白是否给 user 留了互动点？
- 开场白是否没有替 user 做决定？
- MVU 项目开场白是否与 initvar 一致？
