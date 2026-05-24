# 工作流

## 原创角色卡

```text
init_project
→ request_user_decision / update_plan
→ create_draft_slice(character_profile)
→ create_draft_slice(character_greetings)
→ create_draft_slice(worldbook_entry...)
→ validate_draft(character_card/worldbook/content)
→ review_project
→ check_delivery(character_card)
→ generate_json(character_card)
```

## 原创世界书

```text
init_project → update_plan → worldbook_entry drafts → validate_draft(worldbook) → review_project → check_delivery(worldbook) → generate_json(worldbook)
```

## 二创转化

```text
init_project → create_derivative_extraction_template → submit_derivative_extraction_outline → update_plan → draft entries → validate_draft(all)
```

## 修改已有 JSON

```text
init_project(scan_existing=true, import_strategy="auto") → list_draft_slices → update_plan → update_draft_field(s) → validate_draft(all) → generate_json(overwrite=true)
```

## 断点续作

```text
get_project → list_draft_slices(include_content=false) → read pending decisions → continue draft/update_plan
```

## MVU/EJS/HTML 局部任务

```text
update relevant slice → validate_draft(scope) → build_assets(target) → review_project
```

## 导出流程

```text
validate_draft(scope="delivery") → review_project → check_delivery → generate_json
```
