# 条目创作执行

`plan.md` 是事实来源；其中 `entries:` fenced YAML block 用来记录条目规划。

## 推荐顺序

世界观：

1. `world_summary`：A/B/C 判定、最小设定集、零度总纲。
2. 核心规则 / 势力 / 地理 / 时间线：只展开会影响角色行动和剧情冲突的维度。
3. 角色相关场景、物品、能力、事件：从总纲和核心维度派生，不先写百科细节。

角色：

1. `character_basic`：基础信息、外貌特征、声线、能力、关键背景。
2. `character_palette`：底色、主色调、点缀、具体衍生。
3. `tri_faceted`：三面性/多面性（按需）。
4. `character_relationships`：与 `{{user}}`、核心角色、势力的关系画面。
5. `character_rephrase`：容易误读的性格、行为、关系的二次解释。
6. EJS stage：好感度、剧情阶段、身份暴露等多阶段人设（按需）。

## 单条目循环

对每个条目：

1. 阅读对应 reference。
2. 创作或修订 source 内容。
3. 检查禁词、白描、具体性、user 边界和一致性。
4. `write_source_file` 写入内容。
5. `configure_draft` 或 `write_draft` 注册条目。
6. `update_entry_status` 更新 status / abstract / sourceRefs。
7. 继续下一个条目。

不要积攒多个条目后再注册；断点续写依赖 status/abstract/sourceRefs。

## DoubleCheck

生成前检查：

- plan.md entries 是否都已注册。
- 每个 entry 是否有 source 文件。
- status 是否合理。
- 角色外貌、性格、关系是否跨条目一致。
- 世界观条目之间是否矛盾。
- first_mes 是否给 {{user}} 行动空间。
