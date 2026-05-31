# 条目创作执行

`plan.md` 是事实来源；其中 `entries:` fenced YAML block 用来记录条目规划。

## 推荐顺序

### 世界观

1. `world_summary`：A/B/C 判定、最小设定集、零度总纲。
2. 核心规则 / 势力 / 地理 / 时间线：只展开会影响角色行动和剧情冲突的维度。
3. 角色相关场景、物品、能力、事件：从总纲和核心维度派生，不先写百科细节。

### 角色

1. `character_overview`：角色速览（多角色项目优先）。
2. `character_basic`：基础信息、外貌特征、声线、能力、关键背景。
3. `character_palette` / `character_personality`：底色、主色调、点缀、具体衍生。
4. `character_facets`：三面性/多面性（按需）。
5. `character_relationships`：与 `{{user}}`、核心角色、势力的关系画面。
6. `character_rephrase`：容易误读的性格、行为、关系的二次解释。
7. `character_wardrobe`：衣柜（按需）。
8. `npc`：功能性 NPC（按需，每个 NPC 独立文件）。
9. `character_stage` / EJS stage：好感度、剧情阶段、身份暴露等多阶段人设（按需）。

### 资产

1. MVU：schema → initvar → update-rules → variable-list → output-format。
2. HTML 状态栏：先确认变量和 UI，再写 safe_macro；复杂交互才 dynamic_js。
3. regex：优先内置 MVU/状态栏；自定义脚本用 `replaceFile`。
4. EJS：先有 MVU 变量，再写 preprocess/controller/stage。
5. Tavern Helper：只写本地脚本，外链必须显式记录风险。

## 单条目循环

对每个条目：

1. 阅读对应 reference。
2. 根据 plan.md 创作或修订 source 内容。
3. 使用中文 YAML 或 XML-wrapped YAML，保持结构清晰。
4. 检查禁词、白描、具体性、语料纯净度、user 边界和一致性。
5. `write_source_file` 写入内容。
6. `configure_draft` 或 `write_draft` 注册条目。
7. `update_entry_status` 更新 status / abstract / sourceRefs。
8. 继续下一个条目。

不要积攒多个条目后再注册；断点续写依赖 status/abstract/sourceRefs。

## 条目正文建议

```yaml
<角色名_idN>
模块名称:
  字段: 内容
  列表:
    - 具体事实
</角色名_idN>
```

规则：

- 同一角色的基础、调色盘、三面性、关系、二次解释、衣柜使用同一标签 ID。
- 世界观条目按层级使用 `世界观_id1`、`世界观_id2` 等。
- NPC 使用独立标签。
- 不在正文里写“这是世界书条目”。

## DoubleCheck

生成前检查：

- plan.md entries 是否都已注册。
- 每个 entry 是否有 source 文件。
- status 是否合理。
- 角色外貌、性格、关系是否跨条目一致。
- 世界观条目之间是否矛盾。
- first_mes 是否给 `{{user}}` 行动空间。
- MVU initvar 是否与开场初始状态一致。
- 状态栏展示变量是否存在并与 schema/initvar 对齐。
- EJS 条件变量是否登记，阶段条件是否覆盖完整。
- Tavern Helper 是否没有未授权外链。
