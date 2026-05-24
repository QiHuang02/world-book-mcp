# 配置规则速查

## validate scopes

`all | plan | worldbook | character_card | mvu | ejs | html | assets | content | delivery | style | chapter`

## Review / delivery

- `review_project`：全量 section 化审查报告。
- `check_delivery`：导出前阻塞项清单。
- `generate_json`：默认执行 delivery gate；blocking 时拒绝导出。
- `force=true` 仅在用户明确要求强制导出时使用。

## 世界书

- 绿灯：`constant=false` 必须有 keys，建议 `scanDepth=2`。
- 蓝灯：`constant=true`，通常不需要 scanDepth。
- 默认 `preventRecursion=true`、`excludeRecursion=true`。

## 角色卡

- `description` 默认空。
- first_mes 必填。
- 启用 MVU/HTML 状态栏时必须有 `<StatusPlaceHolderImpl/>`。

## MVU/EJS/HTML

- MVU schema/initvar/update_rules 路径一致。
- EJS 路径必须 `stat_data.xxx` 且存在于 schema。
- HTML 必须作用域化 `.wbm-statusbar`，禁止全局 CSS 和外链。
