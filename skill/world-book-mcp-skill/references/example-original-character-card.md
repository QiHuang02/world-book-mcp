# 示例：原创角色卡新流程

```text
init_project
→ update_plan(mode="replace_section", section="1. 用户原始需求", content="...")
→ update_plan(mode="set_export_target", export_target={ type: "character_card", filename: "角色卡.json" })
→ create_draft_slice(draft_type="character_profile", id="main-profile")
→ update_draft_fields(draft_type="character_profile", id="main-profile", changes={ name, description, scenario, system_prompt })
→ create_draft_slice(draft_type="character_greetings", id="main-greetings")
→ update_draft_fields(draft_type="character_greetings", id="main-greetings", changes={ first_mes, alternate_greetings })
→ create_draft_slice(draft_type="worldbook_entry", id="character-basic")
→ update_draft_fields(draft_type="worldbook_entry", id="character-basic", changes={ content, entryType, constant, position, order })
→ 可选：create_draft_slice(mvu_schema / mvu_update_rules / html_statusbar / ejs_entry)
→ validate_draft(scope="all")
→ build_assets(target="all")
→ generate_json(target="character_card")
```

原则：角色复杂设定进入 `worldbook_entry`；角色卡 profile 只保存酒馆卡字段；MVU/HTML/EJS 全部 draft 化。
