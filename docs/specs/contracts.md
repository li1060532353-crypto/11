# 冻结技术契约 (Frozen Contracts)

- 契约版本：`v1.0.0-draft`
- 基线代码提交 (BASE_SHA)：`c28263d373589229e347606a8676f6e6cf77e755` (`c28263d`)
- 任务分支：`codex/content-admin-refactor`
- 日期：2026-10-01
- 关联设计：
  - [UX 交互设计规范](file:///E:/AIblog/personal-blog-source/docs/specs/ux-spec.md)
  - [数据模型与 API 契约规范](file:///E:/AIblog/personal-blog-source/docs/specs/data-api-spec.md)
  - [独立验收与测试矩阵规范](file:///E:/AIblog/personal-blog-source/docs/specs/acceptance-spec.md)

---

## 1. 路由与导航契约 (Navigation & Routing Contracts)

### 1.1 站内来源与返回协议 (`NavigationSourceState`)
在任何跳入阅读详情页或编辑预览的路由动作中，必须通过 `react-router-dom` 的 `navigate(path, { state })` 或 `<Link to={path} state={state}>` 携带以下统一结构：

```ts
export type NavigationSourceKind = 
  | 'post_list'        // 全部文章列表
  | 'search'           // 搜索结果页
  | 'taxonomy'         // 分类/标签列表
  | 'archive'          // 归档时间线
  | 'admin_notes'      // 后台文章管理列表
  | 'editor_preview'   // 编辑工作台预览
  | 'direct';          // 直接访问或外链兜底

export type NavigationSourceState = {
  kind: NavigationSourceKind;
  fromPath: string;       // 明确受支持的站内白名单路径（如 "/search?q=react&page=2"）
  fromLabel: string;      // 用户友好的返回标题（如 "搜索结果 \"react\""）
  scrollY?: number;       // 进入文章前记录的原滚动高度（window.scrollY）
  rootSource?: {          // 连续翻页（上一篇/下一篇）时持续透传的最原始来源
    kind: NavigationSourceKind;
    fromPath: string;
    fromLabel: string;
    scrollY?: number;
  };
  hopCount?: number;      // 连续翻页跳转计数
};
```

### 1.2 路径安全白名单 (Return Path Whitelist)
`fromPath` 严禁包含外部协议（如 `javascript:`, `http://`, `https://`）或未受信任路径。合规路径前缀必须严格限制在：
- `/posts`
- `/search`
- `/categories`
- `/tags`
- `/archives`
- `/knowledge/notes`
- `/knowledge/notes/:id`
- `/knowledge`

**兜底策略**：若 `location.state` 为空、或 `fromPath` 不合法，阅读页返回入口统一安全回落至 `/posts`（前台公共文章列表）或 `/knowledge/notes`（知识库管理列表），文案显示为 `← 返回文章列表`。

### 1.3 智能滚动协议 (Scroll Restoration Protocol)
全局 `useScrollToTop` 废弃盲目无条件置顶，重构为智能滚动策略：
- **推进跳转 (`action === 'PUSH'`) 且无回退标记**：平滑滚动至页面顶部 `window.scrollTo({ top: 0, behavior: 'auto' })`，并将焦点移至主要内容区域 (`#article-content` 或 `#main-content`)。
- **返回或后退 (`action === 'POP'` 或带 `restoreScroll: true`)**：
  - 检查当前路由对应的历史 `scrollY`（优先从 `location.state.scrollY` 或 `sessionStorage` 对应 key 获取）。
  - 在列表数据渲染就绪（`state === 'ready'`）后，通过 `requestAnimationFrame` 精准还原滚动高度。

---

## 2. 内容管理列表契约 (Admin Notes Management Contracts)

### 2.1 URL Query 参数双向绑定
后台管理列表 `/knowledge/notes` 的所有筛选与视图状态必须与 URL Search Params 实时双向同步：

| 参数名 | 类型 | 可选值 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `tab` | string | `all` \| `draft` \| `published` \| `archived` | `all` | 状态分组页签 |
| `q` | string | 任意搜索关键词 | 空字符串 | 全文模糊检索词（300ms 防抖更新） |
| `category` | string | 分类名称 | 空（全部分类） | 按文章分类筛选 |
| `sort` | string | `updated_desc` \| `published_desc` \| `title_asc` | `updated_desc` | 列表排序方式 |
| `pinned` | string | `1` \| `0` | 空（不限） | 置顶筛选 |
| `featured` | string | `1` \| `0` | 空（不限） | 首页精选筛选 |
| `page` | number | 正整数 | `1` | 当前分页页码 |
| `pageSize` | number | 正整数 | `20` | 每页显示数量 |

### 2.2 列表末项归档自适应
当处于 `page > 1` 且当前页仅有 1 篇文章时，执行归档或删除操作成功后，前端客户端必须自动回退至 `page - 1`，避免停留在虚假空页。

### 2.3 批量操作契约 (Batch Action Result)
批量归档/批量恢复接口需返回逐项详细结果，格式如下：
```ts
export type BatchOperationResult = {
  total: number;
  succeeded: readonly string[];
  failed: readonly {
    id: string;
    title: string;
    error: string;
  }[];
};
```
前端批量悬浮栏呈现：“已成功归档 X 篇，Y 篇失败”，并保留失败项勾选以供用户重试。

---

## 3. 编辑工作台与生命周期契约 (Editor Workbench & Lifecycle)

### 3.1 状态枚举与操作语义
```ts
export type NoteStatus = 'draft' | 'published' | 'archived';
```

| 动作 | 触发入口 | 数据库变动 | 前台阅读区影响 |
| :--- | :--- | :--- | :--- |
| **自动保存** | 正文/元数据输入后防抖 1500ms | 仅更新工作草稿（`title`, `content_json`, `content_text` 等） | **无影响**（读者仍看旧发布快照） |
| **保存草稿** | 工作台顶部【保存草稿】按钮 | 显式更新工作草稿，更新 `updated_at` | **无影响** |
| **首次发布** | 状态为草稿时点击【发布】 | 校验通过后，草稿覆盖到 `published_*` 快照，`status = 'published'`, `published_at = datetime('now')` | **立即上线**，读者可见最新快照 |
| **更新发布** | 状态已是已发布，点击【更新发布】 | 草稿全量覆盖到 `published_*` 快照，更新 `published_at` | **立即刷新**，读者可见新版本 |
| **撤回发布** | 更多操作中点击【撤回为草稿】 | `status = 'draft'`，工作草稿完好保留 | **立即下架**，前台 404 或不可见 |
| **归档文章** | 点击【归档】 | `status = 'archived'`，工作草稿完好保留 | **立即下架** |
| **恢复归档** | 对归档文章点击【恢复】 | **强制置为 `status = 'draft'`**（坚决禁止直接恢复为 published） | **保持下架**，进入草稿箱待审核 |

### 3.2 历史版本恢复安全熔断协议 (Rollback Safety Protocol)
恢复指定版本记录时，必须严格执行事务性两阶段保护：
1. **阶段 1：草稿持久化与安全备份**
   - 自动保存当前编辑器中的草稿内容；
   - 自动向 `note_versions` 插入一条类型为 `pre-restore-backup` 的保护性版本快照。
2. **阶段 2：熔断与恢复**
   - **强校验**：阶段 1 的任何一步如果返回网络错误、验证错误或数据库写入失败，**立即终止恢复操作**，界面弹出错误警告：“备份当前内容失败，已终止恢复操作以防丢失数据”，坚决禁止用历史版本覆盖正文！
   - 只有在阶段 1 成功确认后，才将目标版本的 `content_json` 载入富文本编辑器，并更新工作草稿。
   - 版本恢复**仅覆盖工作草稿**，绝不触碰对外生效的 `published_*` 发布快照。

### 3.3 新建文章与离开保护 (Unsaved Exit Guard)
- 访问 `/knowledge/notes/new` 时，在检测到用户输入首字符或首次草稿创建成功后，通过 `navigate('/knowledge/notes/:id', { replace: true })` 转换为具备物理 ID 的实体，即刻接入自动保存引擎。
- 在 `dirty === true` 状态下：
  - 浏览器窗口/标签页关闭触发原生 `window.addEventListener('beforeunload', ...)` 警告；
  - 站内路由跳转通过 React Router `useBlocker`（或导航拦截器）弹出自定义对话框：“您有尚未保存的草稿修改，确定要离开吗？[离开] [留在此页]”。

---

## 4. 后端 API 与 D1 数据库契约 (Backend & Database Contracts)

### 4.1 迁移脚本定义 (`migrations/0003_add_published_snapshots.sql`)
```sql
-- Add published snapshot columns to notes table
ALTER TABLE notes ADD COLUMN published_title TEXT;
ALTER TABLE notes ADD COLUMN published_summary TEXT;
ALTER TABLE notes ADD COLUMN published_content_json TEXT;
ALTER TABLE notes ADD COLUMN published_content_text TEXT;

-- Composite index for fast published lookups
CREATE INDEX IF NOT EXISTS idx_notes_published_lookup 
ON notes (status, published_at DESC) 
WHERE status = 'published';

-- Backfill existing published articles
UPDATE notes
SET published_title = title,
    published_summary = summary,
    published_content_json = content_json,
    published_content_text = content_text
WHERE status = 'published' AND published_content_json IS NULL;
```

### 4.2 API 路由定义
所有响应遵循标准 JSON Envelope：
- 成功：`{ "success": true, "data": T }`
- 失败：`{ "success": false, "error": { "code": string, "message": string } }`

#### 关键接口清单：
1. `PATCH /api/notes/:id`：草稿自动保存与元数据更新（不触碰发布快照）
2. `POST /api/notes/:id/publish`：将当前草稿发布或更新发布至 `published_*` 快照
3. `POST /api/notes/:id/unpublish`：撤回发布，重置状态为 `draft`
4. `POST /api/notes/:id/archive`：归档文章
5. `POST /api/notes/:id/restore`：恢复文章为 `draft`
6. `POST /api/notes/:id/versions`：显式创建版本快照
7. `POST /api/notes/:id/restore-version`：安全恢复历史版本（执行双阶段保护）
8. `GET /api/notes/:id/versions`：获取版本历史列表
9. `GET /content/posts/:slug` 与动态阅读 API：**仅读取 `status = 'published'` 且优先读取 `published_*` 快照**。

### 4.3 动态缓存清理契约
在调用 `publish`, `unpublish`, `archive`, `restore` 成功后，客户端必须无条件触发：
```ts
invalidateDynamicContent();
```
重置前台 5 秒内存缓存，保证读者在文章列表、分类、标签、搜索以及首页精选能够立刻看到一致的状态。

---

## 5. 模块文件唯一归属与责任人划分

依据项目多代理隔离原则，各角色严格限定在以下文件白名单中工作：

| 代理角色 | 负责功能 | 允许修改的文件清单 (Allowed Files) | 禁止触碰的文件 (Forbidden) |
| :--- | :--- | :--- | :--- |
| **B: 后端实现代理** | D1 迁移与 API | `migrations/0003_add_published_snapshots.sql`<br>`functions/lib/notes.ts`<br>`functions/api/notes/[[path]].ts`<br>`packages/shared/src/knowledge.ts`<br>`packages/shared/src/index.ts`<br>`packages/shared/src/notes-*.test.ts` | 任何前端页面与 UI 样式文件 |
| **N: 阅读导航代理** | 来源返回与滚动恢复 | `apps/web/src/hooks/useScrollToTop.ts`<br>`apps/web/src/pages/posts/PostDetailPage.tsx`<br>`apps/web/src/knowledge/KnowledgeNoteReadRoute.tsx`<br>`apps/web/src/pages/posts/PostDetailPage.test.tsx`<br>新增 `apps/web/src/components/navigation/**` | 编辑器与后台管理页面代码 |
| **M: 管理界面代理** | 后台壳层与文章列表 | `apps/web/src/knowledge-ui/KnowledgeShell.tsx`<br>`apps/web/src/knowledge-ui/NotesPage.tsx`<br>`apps/web/src/knowledge/KnowledgeNotesRoute.tsx`<br>`apps/web/src/knowledge-ui/DashboardPage.tsx`<br>`apps/web/src/knowledge/KnowledgeDashboardRoute.tsx`<br>`apps/web/src/knowledge-ui/{NotesPage,KnowledgeShell}.test.tsx` | 后端 API、编辑器核心文件 |
| **E: 编辑器实现代理** | 编辑工作台与生命周期 | `apps/web/src/knowledge-ui/EditorPage.tsx`<br>`apps/web/src/knowledge/KnowledgeEditorRoute.tsx`<br>`apps/web/src/knowledge/useNoteAutosave.ts`<br>`apps/web/src/knowledge-ui/AssetPanel.tsx`<br>`apps/web/src/knowledge-ui/editor-fixtures.ts`<br>`apps/web/src/knowledge/knowledge-editor.test.tsx`<br>`apps/web/src/knowledge-ui/EditorPage.test.tsx` | 导航逻辑、全局路由与列表代码 |
| **C: 主控与集成 (Master)** | 全局整合与公共依赖 | `apps/web/src/router.tsx`<br>`apps/web/src/knowledge/knowledge-api.ts`<br>`apps/web/src/knowledge/knowledge-adapter.ts`<br>`apps/web/src/content/dynamicContentSync.ts`<br>`apps/web/src/styles/knowledge.css`<br>`package.json`, `pnpm-lock.yaml` | 严格在集成关卡串行合并并验证 |

---

## 6. 验收门禁标准 (Gate Standards)

- **G1 (当前阶段)**：契约与规格书冻结，由产品负责人（用户）审核确认；
- **G2 (后端与单模块完成)**：Role B 迁移与接口验证通过，Role N 与 Role M 独立组件测试通过；
- **G3 (全功能集成与真实 Functions 接通)**：主控串行合并并启动本地 Wrangler Functions 验证；
- **G4 (全量验收)**：Role Q 规格核验、Role R 代码与数据安全审计、Role V 真实浏览器 24 项用例全量验证（必须附带真实日志与多视口截图，无 NOT_RUN 或假 PASS）。
