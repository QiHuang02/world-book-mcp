# 端到端示例：二创小说提取 → 世界书

本文档示范当用户提出"根据这本小说做二创世界书"时的完整 MCP 工作流。重点展示：

- 二创 outline 的章节索引、角色 8 维、世界观 5 维结构
- 文风提取与章节提取
- 自动同步到 extraction，进入世界书流程

---

## 1. 任务分类

```json
{
  "request": "我想根据这本小说做一份二创世界书"
}
```

返回 `task_type=derivative_extraction`，`suggested_decisions` 含 `extraction_focus`、`source_kind`。

走 `request_user_decision` / `record_user_decision` 收集：

- `source_kind = novel`
- `extraction_focus = ["characters", "world", "items", "events", "style", "chapters"]`

## 2. 素材入库

### `ingest_text_source`

```json
{
  "title": "原作第 1 卷",
  "content": "<原文文本>",
  "source_type": "novel",
  "tags": ["原作"]
}
```

返回的 `project_id` 在后续步骤中重复使用。

## 3. 二创 outline

### `create_derivative_extraction_template`

```json
{
  "project_id": "project_xxx",
  "title": "原作大纲",
  "source_kind": "novel",
  "focus": ["characters", "world", "items", "events", "style", "chapters"]
}
```

返回的 outline 包含：

- `chapter_index`: 章节行号索引
- `characters`: 每个角色 8 维度
- `world_dimensions`: 5 个世界观维度

AI 根据原文填好后调用：

### `submit_derivative_extraction_outline`

```json
{
  "project_id": "project_xxx",
  "sync_extraction": true,
  "outline": {
    "title": "原作大纲",
    "source_kind": "novel",
    "focus": ["characters", "world", "items", "events"],
    "chapter_index": [
      { "chapter": "第1章", "startLine": 1, "endLine": 350, "summary": "女主登场" },
      { "chapter": "第2章", "startLine": 351, "endLine": 720, "summary": "里世界初探" }
    ],
    "characters": [
      {
        "name": "纸越空鱼",
        "aliases": ["空鱼"],
        "appearance_chapters": ["第1章", "第2章"],
        "dimensions": [
          { "dimension": "basic_first_appearance", "extracted_result": "20岁女大学生，第1章登场" },
          { "dimension": "appearance", "extracted_result": "右眼有特殊能力" },
          ...
        ]
      }
    ],
    "world_type": "B",
    "world_dimensions": [
      { "dimension": "geography", "extracted_result": "里世界与表世界并存" },
      ...
    ],
    "important_chapters": [],
    "planned_entries": [],
    "notes": []
  }
}
```

`sync_extraction=true` 会自动把 outline 转为 extraction 结果保存到 project，跳过单独的 `submit_extraction_result`。

### `validate_derivative_extraction_outline`

可独立调用复查 outline 是否完整。

## 4. 章节条目

### `create_chapter_extraction_template`

```json
{ "project_id": "project_xxx", "title": "原作章节", "chapter_count": 5 }
```

AI 填充每章的 key_events / character_state_changes 等。

### `build_chapter_worldbook_entries`

```json
{ "project_id": "project_xxx" }
```

返回一组绿灯 `after_char` order=100+ scanDepth=2 的章节条目。

## 5. 文风条目

### `create_style_extraction_template`

```json
{ "project_id": "project_xxx" }
```

### `submit_style_profile`

```json
{
  "project_id": "project_xxx",
  "profile": {
    "narrative_perspective": "third_person_limited",
    "tense": "present",
    "sentence_length": "varied",
    "dialogue_ratio": "medium",
    "description_focus": ["人物动作", "环境氛围"],
    "rhythm": "短句穿插对话",
    "signature_techniques": ["大量短句", "感官描写"],
    "forbidden_terms": ["一丝", "一抹"],
    "forbidden_patterns": ["不是A是B"],
    "positive_rules": ["白描优先"],
    "negative_rules": ["不替 user 行动"],
    "notes": []
  }
}
```

### `build_style_worldbook_entries`

```json
{ "project_id": "project_xxx" }
```

返回蓝灯 `before_an` 文风/技法/禁律条目。

## 6. 卡型规划与起草

### `classify_worldbook_card_type`

```json
{ "core_character_count": 1, "has_character_card": false, "is_system_driven": true }
```

返回 `card_type=worldbook_only`。

### `create_worldbook_entry_plan`

```json
{
  "project_id": "project_xxx",
  "card_type": "worldbook_only",
  "characters": [{ "name": "纸越空鱼" }],
  "world_sections": ["世界观总纲"],
  "include_chapter_entries": true,
  "include_style_entries": true,
  "save": true
}
```

### `draft_worldbook_entries`

把章节条目、文风条目、规划生成的世界观与角色条目合并提交：

```json
{
  "project_id": "project_xxx",
  "entries": [<规划生成 + 章节 + 文风 全部条目>]
}
```

### `validate_worldbook_draft`

## 7. 自查与导出

### `lint_project_content`
### `create_writing_optimization_report`
### `create_final_review_report`

### `generate_worldbook_json`

```json
{
  "project_id": "project_xxx",
  "worldbook_name": "原作世界书",
  "overwrite": false,
  "strict_review": true
}
```

### `query_worldbook`

```json
{ "path": "原作世界书.json", "mode": "brief" }
```

---

## 关键点

- 二创任务依赖 outline 的 `chapter_index` 与各维度提取结果。
- `sync_extraction=true` 让 outline 直接成为后续 plan/draft 的输入。
- 章节条目应保持绿灯，scanDepth=2。
- 文风条目保持蓝灯并放置于 `before_an`。
- 整个流程完全是 AI 编排，MCP 只做结构与校验。
