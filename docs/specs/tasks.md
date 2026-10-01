# 任务账本 (Task Ledger)

- 任务分支：`codex/content-admin-refactor`
- 基线提交 (BASE_SHA)：`c28263d`
- 契约版本：`v1.0.0-draft`
- 状态机：`READY` → `RUNNING` → `NEEDS_REVIEW` → `VERIFIED` → `INTEGRATED`

---

## Wave 1: 设计与契约定义（已完成）

| 任务 ID | 角色 | 目标 | 交付物 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| `TASK-W1-D` | 交互设计代理 (Role D) | 交互流程、多端适配、异常反馈与逐页规格设计 | [ux-spec.md](file:///E:/AIblog/personal-blog-source/docs/specs/ux-spec.md) | **VERIFIED** |
| `TASK-W1-A` | 数据与接口设计代理 (Role A) | 发布快照设计、状态流转、并发安全与向下兼容迁移 | [data-api-spec.md](file:///E:/AIblog/personal-blog-source/docs/specs/data-api-spec.md) | **VERIFIED** |
| `TASK-W1-Q` | 独立验收设计代理 (Role Q) | 全量 24 项用户旅程测试矩阵与证据标准设计 | [acceptance-spec.md](file:///E:/AIblog/personal-blog-source/docs/specs/acceptance-spec.md) | **VERIFIED** |
| `TASK-W1-C` | 主控 (Role C) | 整合技术契约与任务派发账本，呈报设计评审 | [contracts.md](file:///E:/AIblog/personal-blog-source/docs/specs/contracts.md), `tasks.md` | **READY_FOR_REVIEW** |

---

## Wave 2: 核心链路并行实现（待确认启动）

### 任务 1: 后端数据与 API 实现 (`TASK-W2-B`)
- **负责人**: 后端实现代理 (Role B)
- **目标**: 实现 D1 `0003_add_published_snapshots.sql` 迁移，扩充发布快照字段，实现发布、更新发布、撤回、归档、恢复及历史快照安全恢复 API，补齐共享契约与测试。
- **允许文件 (Allowed Files)**:
  - `migrations/0003_add_published_snapshots.sql`
  - `functions/lib/notes.ts`
  - `functions/api/notes/[[path]].ts`
  - `packages/shared/src/knowledge.ts`
  - `packages/shared/src/index.ts`
  - `packages/shared/src/notes-api.test.ts`
  - `packages/shared/src/notes-route.test.ts`
- **禁止触碰**: 前端 UI 与样式代码。
- **依赖验收 ID**: `PUB-01`, `PUB-02`, `PUB-03`, `PUB-04`, `VER-01`, `DATA-01`
- **状态**: `READY`

### 任务 2: 阅读导航与来源返回实现 (`TASK-W2-N`)
- **负责人**: 阅读导航实现代理 (Role N)
- **目标**: 改造 `useScrollToTop.ts` 为智能滚动恢复 Hook，实现 `NavigationSourceState` 协议，在 `PostDetailPage` 和 `KnowledgeNoteReadRoute` 顶底两端提供精准返回入口（“← 返回搜索结果 [关键词]”等），在连续翻页阅读时透传 `rootSource` 杜绝循环返回。
- **允许文件 (Allowed Files)**:
  - `apps/web/src/hooks/useScrollToTop.ts`
  - `apps/web/src/pages/posts/PostDetailPage.tsx`
  - `apps/web/src/knowledge/KnowledgeNoteReadRoute.tsx`
  - `apps/web/src/pages/posts/PostDetailPage.test.tsx`
  - 新增 `apps/web/src/components/navigation/**`
- **禁止触碰**: 编辑器、管理列表与后端 API。
- **依赖验收 ID**: `NAV-01`, `NAV-02`, `NAV-03`, `NAV-04`
- **状态**: `READY`

### 任务 3: 后台管理壳层与文章列表实现 (`TASK-W2-M`)
- **负责人**: 管理界面实现代理 (Role M)
- **目标**: 统一后台导航（概览/文章管理/导入，移除 Settings 占位符），实现状态分流 Tabs（全部/草稿/已发布/已归档）及数量徽章，实现分类/精选/置顶筛选与排序，实现全量状态与 URL Search Params 双向同步，实现桌面端紧凑表格与批量归档/恢复/调分类交互及逐项失败反馈，实现末项归档页码自动回退与搜索空状态区分。
- **允许文件 (Allowed Files)**:
  - `apps/web/src/knowledge-ui/KnowledgeShell.tsx`
  - `apps/web/src/knowledge-ui/NotesPage.tsx`
  - `apps/web/src/knowledge/KnowledgeNotesRoute.tsx`
  - `apps/web/src/knowledge-ui/DashboardPage.tsx`
  - `apps/web/src/knowledge/KnowledgeDashboardRoute.tsx`
  - `apps/web/src/knowledge-ui/NotesPage.test.tsx`
  - `apps/web/src/knowledge-ui/KnowledgeShell.test.tsx`
- **禁止触碰**: 编辑器、阅读页与后端 API。
- **依赖验收 ID**: `LIST-01`, `LIST-02`, `LIST-03`, `LIST-04`
- **状态**: `READY`

---

## Wave 3: 编辑工作台与全栈打通（待 Wave 2 完成）

### 任务 4: 编辑工作台与发布流转重构 (`TASK-W3-E`)
- **负责人**: 编辑器实现代理 (Role E)
- **目标**: 改造编辑工作台为“正文优先 + 辅助抽屉”架构；吸顶固定操作栏（状态/预览/保存草稿/发布/更新发布）；无边框标题 + 完整 Tiptap 富文本工具栏（标题级/列表/引用/代码块/表格/五色语义高亮）；右侧收纳摘要/Slug/分类/标签/精选/置顶及附件面板与版本历史；实现新建模式下的立即创建与离开防护 (`beforeunload` + 站内跳转拦截)；实现版本恢复前的前置强制备份与失败强行熔断拦截。
- **允许文件 (Allowed Files)**:
  - `apps/web/src/knowledge-ui/EditorPage.tsx`
  - `apps/web/src/knowledge/KnowledgeEditorRoute.tsx`
  - `apps/web/src/knowledge/useNoteAutosave.ts`
  - `apps/web/src/knowledge-ui/AssetPanel.tsx`
  - `apps/web/src/knowledge-ui/editor-fixtures.ts`
  - `apps/web/src/knowledge-ui/EditorPage.test.tsx`
  - `apps/web/src/knowledge/knowledge-editor.test.tsx`
- **依赖验收 ID**: `EDIT-01`, `EDIT-02`, `EDIT-03`, `EDIT-04`, `PUB-01`, `PUB-02`, `PUB-03`, `VER-01`, `VER-02`, `ASSET-01`
- **状态**: `PENDING`

---

## Wave 4: 集成验证与多维独立验收（门禁关卡 G4）

- **主控集成 (Role C)**: 串行合并代码、打通 Functions 真实接口、验证动态缓存失效、触发全局构建与冒烟测试。
- **独立验收 (Role Q, R, V)**:
  - `Role Q`: 针对固定候选版本核查全量 24 项验收场景符合性。
  - `Role R`: 独立审查代码质量、并发时序竞态、权限边界与数据迁移安全。
  - `Role V`: 启动本地真实 Cloudflare Functions，在多视口真实浏览器中执行全链路端到端验收与截图取证。
