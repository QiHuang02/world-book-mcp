# 断点续写

当会话中断或项目久未继续时，先调用 `resume_project`。

## 流程

1. `resume_project` 查看：
   - entries status 分布
   - plan.md entries 与 draft/worldbook 的差异
   - first_mes 是否存在
   - MVU/EJS 是否缺文件
   - exports / reports 是否存在
2. 找到 `next_actions` 和 `next_entry`。
3. 如果需要阅读内容，用 `read_source_file` 安全读取 source 文件。
4. 按 references 续写或审查。
5. 用 `write_source_file` 修改 source。
6. 用 `configure_draft` / `write_draft` 注册条目。
7. 用 `update_entry_status` 标记 drafted/reviewed/done。
8. `validate_project` 校验结构与引用。

禁词、文风、角色和世界观问题按对应 reference 检查并修订 source。
