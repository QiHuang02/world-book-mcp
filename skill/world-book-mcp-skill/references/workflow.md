# v5 总流程

```text
用户需求
→ 主题式询问
→ init_project
→ update_plan 写 plan.md
→ write_source_file 写 source
→ write_draft / configure_draft 维护 draft YAML
→ 按 references 检查并修订文本
→ validate_project
→ repair_project / validate_mvu
→ update_entry_status / query_entries 跟踪条目进度
→ check_delivery
→ generate_json
→ 返回 exports 路径
```

原则：先完成需求澄清、创作和计划记录，再维护 workspace、draft/source，最后校验、修复并生成 JSON。
