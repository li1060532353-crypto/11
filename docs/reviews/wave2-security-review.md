# Wave 2 独立安全与代码质量审查报告 (Security & Quality Review Report)

- **审查代理**：独立安全与质量审查代理 (Role R)
- **审查基线**：分支 `codex/content-admin-refactor`，提交基线 `6a882a3`
- **审查日期**：2026-10-01
- **参考规范**：
  - [`contracts.md`](file:///E:/AIblog/personal-blog-source/docs/specs/contracts.md) (冻结技术契约)
  - [`data-api-spec.md`](file:///E:/AIblog/personal-blog-source/docs/specs/data-api-spec.md) (数据模型、API 契约与状态流转设计规范)
  - [`ux-spec.md`](file:///E:/AIblog/personal-blog-source/docs/specs/ux-spec.md) (UX 交互设计与体验一致性规范)
  - [`acceptance-spec.md`](file:///E:/AIblog/personal-blog-source/docs/specs/acceptance-spec.md) (独立验收规格与测试矩阵规范)

---

## 1. 审查概览与执行摘要 (Executive Summary)

本审查报告由独立安全与质量审查代理 (Role R) 依据多代理重构宪法与验收红线独立推导完成。重点对 Wave 2 已集成的阅读导航 (`Role N`)、后端 D1 与 API (`Role B`)、管理后台壳层与列表 (`Role M`) 以及部分关联编辑器逻辑进行了端到端白盒审查、威胁建模与状态机完备性审计。

### 1.1 总体审查结论
- **代码实现基础扎实**：Role N 的阅读导航协议与返回栈设计严谨，有效解决了连续翻页死循环与无来源兜底问题；Role B 的 D1 存量数据回填与两阶段版本恢复在后端层面实现了坚固的原子性与事务安全；Role M 的管理列表交互与 URL 参数双向绑定符合现代 SPA 最佳实践。
- **发现 2 项 Block-Stopper 级严重缺陷与 2 项 Major 级架构断层**：
  1. **[SEC-01 / Block-Stopper] 全文搜索接口 `/api/search` 缺少发布状态与快照隔离**：导致未发布的草稿正文及已归档文章可通过前台搜索泄漏，直接违反验收用例 `PUB-01` 与 `PUB-03`。
  2. **[SEC-02 / Block-Stopper] 前端版本恢复绕过两阶段熔断安全链**：`KnowledgeEditorRoute.tsx` 自行在客户端执行保存与版本创建，并在 `catch` 中直接忽略错误（`// continue`）用历史版本覆盖正文，直接击穿验收用例 `VER-01` 的数据防丢安全屏障。
  3. **[ARCH-01 / Major] 编辑工作台发布动作降级为下拉框导致快照丢失**：编辑器 UI 缺少显式【发布】按钮，仅通过 `PATCH` 接口修改 `status`，导致 `published_*` 快照未被写入，前台阅读端无法查询到文章。
  4. **[ARCH-02 / Major] 管理端搜索丢失状态分组与多维度筛选**：输入搜索词时，`loadKnowledgeNotes` 仅透传 `q`，完全丢弃了当前选中的 `tab`、`category` 等筛选条件。
- **门禁出口判定**：**Gate G2 条件性保留，Gate G3 阻断 (BLOCKED)**。上述 Block-Stopper 缺陷必须在全栈串行集成 (Wave 3) 开启前完成代码修复与回归验证。

---

## 2. 分类深度代码审计 (Detailed Code Audits)

### 模块一：阅读导航与来源返回 (Role N)

#### 1. 路径白名单与跨站重定向防御 (SSRF / Open Redirect)
- **审查文件**：[`apps/web/src/components/navigation/navigationSource.ts`](file:///E:/AIblog/personal-blog-source/apps/web/src/components/navigation/navigationSource.ts)
- **实现逻辑分析**：
  ```ts
  export function isSafeReturnPath(path: unknown): path is string {
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
      return false;
    }
    const [pathname] = path.split(/[?#]/);
    if (!pathname || pathname.includes(':') || pathname.includes('\\') || pathname.includes('..')) {
      return false;
    }
    return ALLOWED_RETURN_PATH_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
  }
  ```
- **安全性评估**：
  - **协议注入防御**：校验强制要求 `path.startsWith('/')` 且排除 `//`、`:\`，彻底阻断了 `javascript:`, `data:`, `vbscript:`, `http://`, `https://` 等外部协议。
  - **路径穿越防御**：通过 `pathname.includes('..')` 与 `pathname.includes('\\')` 严禁路径向上回溯或 Windows 路径反斜杠转义。
  - **Open Redirect 防御**：由于所有返回跳转均通过 `react-router-dom` 的 `<Link to={target.path}>` 在前端 SPA 路由内完成，且 `isSafeReturnPath` 严格校验必须属于前缀白名单（`/posts`, `/search`, `/categories`, `/tags`, `/archives`, `/knowledge/notes`, `/knowledge`），杜绝了站外开放重定向漏洞。
  - **SSRF 风险排查**：来源状态 (`NavigationSourceState`) 纯粹存留于前端客户端 `history.state` 与 `location.state` 中，完全不参与服务端任何出站 HTTP 请求或代理，**无 SSRF 攻击面**。
- **审查结论**：**合格 (PASS)**。

#### 2. 智能滚动恢复与生命周期管理
- **审查文件**：[`apps/web/src/hooks/useScrollToTop.ts`](file:///E:/AIblog/personal-blog-source/apps/web/src/hooks/useScrollToTop.ts)
- **实现逻辑分析**：
  - 使用防抖（100ms）监听 `scroll` 事件，将滚动位置记录到 `sessionStorage` 对应 key 中。
  - 在路由跳转时，若为 `POP` 或携带 `restoreScroll: true`，从 `state.scrollY` 或 `sessionStorage` 读取目标滚动高度；在内容未就绪时通过 `requestAnimationFrame` 递归重试（上限 15 次，`attempts < maxAttempts`）。
- **死循环检查**：
  - 递归调用在 `attempts >= 15` 时强制终止，严格限制在约 250ms 内退出，**不存在死循环风险**。
- **内存泄露与并发竞态缺陷 [PERF-01 / Minor]**：
  - **缺陷定位**：`useScrollToTop.ts` 第 79~149 行的第二个 `useEffect` 未返回清理函数（Cleanup Function）。
  - **风险场景**：当读者从列表进入文章后，快速点击浏览器后退并在 250ms 内再次点击其他链接时，旧页面的 `attemptRestore` 宏任务仍未结束，会继续向新页面触发 `safeScrollTo(targetY)`，导致新页面出现非预期的滚动跳动。
  - **整改建议**：增加 `let isCancelled = false` 并在 `useEffect` 的 cleanup 中设置 `isCancelled = true`，同时保存 `rafId` 并在 cleanup 时调用 `cancelAnimationFrame(rafId)`。

#### 3. 相邻文章连续翻页与根来源透传
- **审查文件**：
  - [`apps/web/src/components/navigation/navigationSource.ts`](file:///E:/AIblog/personal-blog-source/apps/web/src/components/navigation/navigationSource.ts)
  - [`apps/web/src/pages/posts/PostDetailPage.tsx`](file:///E:/AIblog/personal-blog-source/apps/web/src/pages/posts/PostDetailPage.tsx)
  - [`apps/web/src/components/navigation/ReturnButton.tsx`](file:///E:/AIblog/personal-blog-source/apps/web/src/components/navigation/ReturnButton.tsx)
- **实现逻辑分析**：
  - `buildAdjacentPostState(currentTarget)` 持续保留 `rootSource = currentTarget.rootSource ?? currentTarget`，并将 `hopCount = currentTarget.hopCount + 1` 透传给下一篇文章。
  - 无论连续翻页多少次（Post 1 $\to$ Post 2 $\to$ Post 3），`getSafeReturnTarget` 优先取 `rawRoot`。
  - 底部返回栏提示：“已在文章间连续阅读 N 篇 · 直接返回最初来源: ...”，点击直接回退至 `rootSource.fromPath`（如 `/search?q=react&page=2`）。
- **审查结论**：**优秀 (PASS)**。完全符合 `acceptance-spec.md` 中的 `NAV-02` 验收标准，彻底斩断了文章相邻翻页造成的历史栈死循环陷阱。

---

### 模块二：后端 D1 与 API 状态流转安全 (Role B)

#### 1. D1 迁移脚本存量数据回填安全性
- **审查文件**：[`migrations/0003_add_published_snapshots.sql`](file:///E:/AIblog/personal-blog-source/migrations/0003_add_published_snapshots.sql)
- **SQL 执行逻辑**：
  ```sql
  ALTER TABLE notes ADD COLUMN published_title TEXT;
  ALTER TABLE notes ADD COLUMN published_summary TEXT;
  ALTER TABLE notes ADD COLUMN published_content_json TEXT;
  ALTER TABLE notes ADD COLUMN published_content_text TEXT;

  CREATE INDEX IF NOT EXISTS idx_notes_published_lookup 
  ON notes (status, published_at DESC) 
  WHERE status = 'published';

  UPDATE notes
  SET published_title = title,
      published_summary = summary,
      published_content_json = content_json,
      published_content_text = content_text
  WHERE status = 'published' AND published_content_json IS NULL;
  ```
- **安全性评估**：
  - `ALTER TABLE ADD COLUMN` 在 SQLite/D1 中无需锁表重构，操作轻量安全。
  - 部分索引 (`WHERE status = 'published'`) 为 Cloudflare D1 (SQLite 3.8+) 原生支持，显著加快线上读者查询。
  - 回填带有 `AND published_content_json IS NULL` 条件，具备完全幂等性，重复执行不会破坏已有快照。
- **数据一致性隐患 [DATA-01 / Minor]**：
  - `0002_add_featured_and_published_at.sql` 在添加 `published_at TEXT` 时并未对其赋初值。若存量已发布文章在 `0003` 执行时 `published_at IS NULL`，SQLite 倒序排序 (`ORDER BY published_at DESC`) 默认会将 `NULL` 视作最大值排在最前面，可能导致这些存量文章在列表头部呈现乱序。
  - **整改建议**：在 `0003` 回填语句中增加：
    ```sql
    UPDATE notes SET published_at = COALESCE(published_at, updated_at, created_at)
    WHERE status = 'published' AND published_at IS NULL;
    ```

#### 2. `/publish` 发布接口状态机与必填校验
- **审查文件**：[`functions/lib/notes.ts`](file:///E:/AIblog/personal-blog-source/functions/lib/notes.ts) (L424-469)
- **原子性审查**：
  - 提取当前工作草稿 `title`, `summary`, `content_json`, `content_text`，全量复制到 `published_*` 列，同时更新 `status = 'published'`, `published_at = timestamp`, `updated_at = timestamp`。
  - 底层调用 `store.save(publishedNote)`，执行单条 `INSERT INTO notes (...) ON CONFLICT(id) DO UPDATE ...`。在 SQLite 引擎中，单语句更新具备天然事务原子性，**绝无“状态更新但快照未变”的半同步中间态**。
- **校验边界审查**：
  - 严格校验 `title.trim()`、`slug.trim()`、`validDocumentJson(contentJson)`，非空且格式合法。
  - 检查 `SLUG_CONFLICT`（除自身 ID 外是否被其他文章占用）。
  - 支持 `expectedUpdatedAt` 并发修订检测，冲突时抛出 `STALE_REVISION_REJECTED` (HTTP 409)。
- **状态流转漏洞 [SEC-03 / Medium]**：
  - **漏洞定位**：`publish()` 未校验文章的当前状态 `existing.status`。
  - **安全隐患**：若调用者对处于 `archived`（已归档）状态的文章直接调用 `POST /api/notes/:id/publish`，系统将直接将其提升为 `published` 并在前台上线，绕过了“归档文章必须先恢复为草稿”的严格防错规则（`contracts.md` Table 3.1 & `data-api-spec.md` 3.4）。
  - **整改建议**：在 `publish` 开头增加校验：
    ```ts
    if (existing.status === 'archived') {
      throw new NoteDomainError('VALIDATION_ERROR', 'Archived note cannot be published directly. Restore to draft first.');
    }
    ```

#### 3. `/unpublish` 撤回发布接口
- **审查文件**：[`functions/lib/notes.ts`](file:///E:/AIblog/personal-blog-source/functions/lib/notes.ts) (L470-479)
- **逻辑审查**：
  - 将 `status` 更新为 `'draft'`，保留当前草稿字段不变。
  - 前台读者查询通过 `WHERE status = 'published'` 强过滤，文章立即在读者端下架（返回 404 或从动态列表中移除）。
- **审查结论**：**合格 (PASS)**。

#### 4. `/restore` 恢复归档接口
- **审查文件**：[`functions/lib/notes.ts`](file:///E:/AIblog/personal-blog-source/functions/lib/notes.ts) (L484-487)
- **逻辑审查**：
  - 强制设置 `status: 'draft'`：
    ```ts
    async restore(noteId: string) {
      const existing = await store.find(noteId);
      return existing ? store.save({ ...existing, status: 'draft', updatedAt: now() }) : null;
    }
    ```
  - 无论归档前原本是 `published` 还是 `draft`，恢复后一律重置为 `draft`，坚决禁止直接恢复为已发布状态。
- **审查结论**：**完全符合契约规范 (PASS)**。

#### 5. `/restore-version` 历史版本恢复与两阶段安全熔断
- **审查文件**：[`functions/lib/notes.ts`](file:///E:/AIblog/personal-blog-source/functions/lib/notes.ts) (L488-577) 与 [`functions/api/notes/[[path]].ts`](file:///E:/AIblog/personal-blog-source/functions/api/notes/[[path]].ts)
- **两阶段执行与熔断设计**：
  1. **阶段 1a**：校验 `currentDraft`，持久化当前正在编辑的草稿。若保存失败，抛出 `PRE_RESTORE_BACKUP_FAILED`。
  2. **阶段 1b**：自动生成保护性快照，调用 `store.createVersion` 插入 `note_versions` 表。若写入异常，立即抛出 `PRE_RESTORE_BACKUP_FAILED`。
  3. **阶段 2**：仅当阶段 1 两个步骤全部成功后，才将目标版本的内容更新至工作草稿 `content_json` 和 `content_text`。绝不触碰 `published_*` 发布快照。
  4. **HTTP 状态码映射**：`functions/api/notes/[[path]].ts` 准确将 `PRE_RESTORE_BACKUP_FAILED` 映射为 HTTP 500。
- **后端审查结论**：**后端接口逻辑完全合规 (PASS)**。

#### 6. 阅读端接口投影与隔离 (`WHERE status = 'published'`)
- **审查文件**：[`functions/lib/notes.ts`](file:///E:/AIblog/personal-blog-source/functions/lib/notes.ts) (L671-773)
- **SQL 投影与过滤分析**：
  - 当查询入参 `query.status === 'published'` 时：
    - 强制过滤：`WHERE notes.status = 'published' AND notes.published_content_json IS NOT NULL`。
    - 字段投影：
      ```sql
      SELECT 
        notes.id,
        COALESCE(notes.published_title, notes.title) AS title,
        notes.slug,
        COALESCE(notes.published_summary, notes.summary) AS summary,
        notes.published_content_json AS content_json,
        notes.published_content_text AS content_text, ...
      ```
    - 草稿列 `notes.content_json` 和 `notes.content_text` **完全不包含在 `SELECT` 列表中**，彻底切断了草稿物理传输通道。
- **排序 NULL 处理瑕疵 [DATA-02 / Minor]**：
  - 检查代码行 706 与 712：
    `query.sort === 'published_desc'` 指定了 `notes.published_at DESC NULLS LAST`；但默认读者排序（第 712 行）写成了 `notes.is_pinned DESC, notes.published_at DESC`，漏掉了 `NULLS LAST`。
  - **建议**：补充 `NULLS LAST` 保证 SQLite 边界排序一致性。

#### 7. 全文搜索接口隔离缺失重大隐患 [SEC-01 / Block-Stopper]
- **审查文件**：[`functions/lib/search.ts`](file:///E:/AIblog/personal-blog-source/functions/lib/search.ts) (L12-22, L67-83)
- **缺陷代码定位**：
  ```sql
  SELECT n.id, n.title, n.summary, n.slug, n.category, n.updated_at,
    substr(n.content_text, 1, 240) AS excerpt, ...
  FROM notes n
  WHERE (
    n.title LIKE ? ESCAPE '\'
    OR n.summary LIKE ? ESCAPE '\'
    OR n.category LIKE ? ESCAPE '\'
    OR n.content_text LIKE ? ESCAPE '\' ...
  )
  ```
- **漏洞严重性分析**：
  - **缺少状态过滤**：SQL 查询语句中**完全没有 `status = 'published'` 限制**！
  - **检索泄露草稿**：检索匹配的字段是 `n.content_text`（正在编辑的草稿正文），而不是 `published_content_text`。
  - **直接违背验收契约**：
    - `acceptance-spec.md` PUB-01 明确断言：“3. 前台搜索接口 `GET /api/search?q=机密段落` 返回 0 条结果，搜索索引未被未发布草稿污染。”
    - `acceptance-spec.md` PUB-03 明确断言：“3. 撤回发布后前台搜索列表及文章归档列表中彻底消失，不可见。”
  - **当前现状**：若作者在后台草稿中键入敏感信息，前台调用 `GET /api/search` 会直接搜索并返回该草稿片段及已归档文章，导致严重的草稿内容泄漏！
- **整改建议**：
  - 针对读者端搜索，必须强制追加过滤条件 `AND n.status = 'published' AND n.published_content_json IS NOT NULL`；
  - 搜索匹配字段改用 `COALESCE(n.published_title, n.title)`、`COALESCE(n.published_summary, n.summary)` 和 `n.published_content_text`。

---

### 模块三：管理后台与 URL 参数同步 (Role M & E)

#### 1. URL Search Params 双向同步稳定性与历史记录防爆栈
- **审查文件**：
  - [`apps/web/src/knowledge/KnowledgeNotesRoute.tsx`](file:///E:/AIblog/personal-blog-source/apps/web/src/knowledge/KnowledgeNotesRoute.tsx)
  - [`apps/web/src/knowledge-ui/NotesPage.tsx`](file:///E:/AIblog/personal-blog-source/apps/web/src/knowledge-ui/NotesPage.tsx)
- **同步机制审查**：
  - `updateParams` 函数在更新 `tab`、`q`、`category`、`sort`、`pinned`、`featured` 时默认采用 `{ replace: true }`，避免了筛选操作产生大量垃圾历史记录堆栈。
  - 仅在点击分页切换页码时使用 `{ replace: false }`，满足用户通过浏览器前进/后退在分页间穿梭的合理预期。
  - 搜索框采用 300ms 防抖同步，并在卸载时清理定时器。
  - **防死循环审查**：在防抖定时器触发时比对 `trimmed !== urlQ`，仅在真正不同时才调用 `setSearchParams`；当 URL 参数回推触发外部 `urlQ` 变化时，若值相同则 React 内部 bail out，**不存在死循环或爆栈风险**。
- **输入截断缺陷 [UX-01 / Minor]**：
  - 在输入包含空格的关键词（如 `"react hooks"`）时，当键入 `"react "` 停顿 300ms，防抖对字符串进行了 `trim()` 并推入 URL `?q=react`；随后 `urlQ` 变动通过 `useEffect` 强制执行 `setSearchInput(urlQ)`，将输入框的空格删去，干扰了连续输入体验。
  - **整改建议**：仅在组件初次挂载或导航前进后退 (`POP`) 时将 `urlQ` 同步至 `searchInput`，在用户主动键入期间避免用 `urlQ` 反向覆盖 `searchInput`。
- **URL 参数类型契约偏差 [CONTRACT-01 / Minor]**：
  - `contracts.md` Table 2.1 规定 `pinned` 与 `featured` 的值为 `'1' | '0'`。
  - `KnowledgeNotesRoute.tsx` 写入时使用了 `next.set('pinned', 'true')`。虽然读取端做了兼容兼容，仍建议规范统一为 `'1'`。

#### 2. 列表末项归档自适应与自动回退
- **审查文件**：[`apps/web/src/knowledge/KnowledgeNotesRoute.tsx`](file:///E:/AIblog/personal-blog-source/apps/web/src/knowledge/KnowledgeNotesRoute.tsx) (L289-291, L368-372)
- **逻辑审查**：
  ```ts
  // 单篇归档
  if (model.notes.length <= 1 && page > 1) {
    updateParams({ page: page - 1 }, { replace: true });
  } else {
    setRefresh((r) => r + 1);
  }

  // 批量归档
  if (model.notes.length <= succeeded.length && page > 1) {
    updateParams({ page: page - 1 }, { replace: true });
  } else {
    setRefresh((r) => r + 1);
  }
  ```
- **验证结论**：**合格 (PASS)**。已在 `NotesPage.test.tsx` 中通过集成测试断言（用例 `LIST-03`），当处于第二页且最后一篇文章被归档时，URL 与界面能够自动安全回退至第一页，避免呈现空页。

#### 3. 批量操作反馈与重试机制
- **审查文件**：
  - [`apps/web/src/knowledge-ui/NotesPage.tsx`](file:///E:/AIblog/personal-blog-source/apps/web/src/knowledge-ui/NotesPage.tsx) (L368-497)
  - [`apps/web/src/knowledge/KnowledgeNotesRoute.tsx`](file:///E:/AIblog/personal-blog-source/apps/web/src/knowledge/KnowledgeNotesRoute.tsx) (L326-492)
- **契约对齐审查**：
  - 返回结果包含 `total`、`succeeded`、`failed: { id, title, error }[]`。
  - 界面呈现横幅：“批量归档完成：X 篇成功，Y 篇失败”，保留失败项勾选。
  - 支持“重试失败项”与单项重试。
  - 完全满足 `contracts.md` 2.3 与 `acceptance-spec.md` `LIST-04`。
- **审查结论**：**合格 (PASS)**。

---

### 模块四：跨模块集成断点与数据破坏隐患 (Cross-Module Critical Gaps)

#### 1. 前端版本恢复绕过熔断保护链 [SEC-02 / Block-Stopper]
- **审查文件**：[`apps/web/src/knowledge/KnowledgeEditorRoute.tsx`](file:///E:/AIblog/personal-blog-source/apps/web/src/knowledge/KnowledgeEditorRoute.tsx) (L283-303)
- **严重问题定位**：
  ```ts
  const restoreVersion = useCallback(
    async (version: NoteVersionRecord) => {
      if (!noteId || !editor) return;
      setError(null);
      try {
        await autosave.saveCurrent();
        await createKnowledgeNoteVersion(noteId);
      } catch {
        // continue  <=== 致命隐患：忽略备份失败，继续执行！
      }
      try {
        const doc = JSON.parse(version.contentJson);
        editor.commands.setContent(doc, { emitUpdate: true });
        setDraft((prev) => ({ ...prev, contentJson: version.contentJson }));
        await loadVersions();
      } catch {
        setError('恢复历史版本失败：文档格式不兼容。');
      }
    },
    [autosave, editor, loadVersions, noteId],
  );
  ```
- **破坏性后果**：
  - `contracts.md` 3.2 与 `acceptance-spec.md` `VER-01` 规定了硬性红线：“恢复指定版本前必须执行保护性保存与备份，若备份失败（如网络中断或 500 故障），**必须强行熔断中止恢复流程，坚决禁止用历史版本覆盖正文**”。
  - 然而在 `KnowledgeEditorRoute.tsx` 中，作者用 `catch { // continue }` 吞噬了异常，即使备份失败，仍然无条件执行 `editor.commands.setContent(doc)` 冲掉当前正文！
  - **严重脱节**：Role B 在后端已经实现了具备两阶段强熔断保护的接口 `POST /api/notes/:id/restore-version`，并在 `knowledge-api.ts` 中封装好了 `restoreVersionKnowledgeNote`，但前端完全没有调用该接口，形成了虚假的安全熔断。
- **整改要求**：
  前端必须废弃这种客户端吞异常的逻辑，统一调用 `restoreVersionKnowledgeNote(noteId, { versionId: version.id, currentDraft: { contentJson: draft.contentJson } })`。如果接口返回错误，立即报警并终止，严禁更新编辑器 DOM。

#### 2. 编辑工作台生命周期操作与发布快照断层 [ARCH-01 / Major]
- **审查文件**：
  - [`apps/web/src/knowledge-ui/EditorPage.tsx`](file:///E:/AIblog/personal-blog-source/apps/web/src/knowledge-ui/EditorPage.tsx) (L260-278)
  - [`apps/web/src/knowledge/KnowledgeEditorRoute.tsx`](file:///E:/AIblog/personal-blog-source/apps/web/src/knowledge/KnowledgeEditorRoute.tsx) (L176-187)
- **问题分析**：
  - 在 `EditorPage.tsx` 中，文章发布状态被降级为一个简单的下拉选择框 `<select id="knowledge-editor-status">`。
  - 当用户选择“已发布”时，触发 `onStatusChange` 并由 `autosave` 发起 `PATCH /api/notes/:id`。
  - **快照断层**：根据规范，`PATCH` 接口只更新工作草稿，**绝不触碰 `published_*` 快照字段**！
  - 结果：通过此下拉框切换为 `published` 的文章，其 `published_content_json` 依然为 `NULL`。前台读者端查询带有 `WHERE published_content_json IS NOT NULL` 条件，**导致读者在公开发布文章列表中永远看不到这篇文章**！
  - 同时，用户在编辑已发布文章时，修改会自动触发 `autosave`，无法实现 `PUB-01`（已发布文章二次编辑仅保存在草稿，显式点击【更新发布】才推向前台）的核心契约。
- **整改要求**：
  必须在工作台顶部操作栏设立显式的【发布】/【更新发布】/【撤回发布】按钮，点击时调用 `POST /api/notes/:id/publish` 和 `POST /api/notes/:id/unpublish`。

#### 3. 管理端全文搜索与状态/分类筛选脱节 [ARCH-02 / Major]
- **审查文件**：[`apps/web/src/knowledge/knowledge-api.ts`](file:///E:/AIblog/personal-blog-source/apps/web/src/knowledge/knowledge-api.ts) (L221-235)
- **代码定位**：
  ```ts
  export async function loadKnowledgeNotes(input: KnowledgeNotesQuery) {
    const q = input.q?.trim();
    const data = q
      ? await jsonRequest(
          `/api/search?${toQuery({ q, page: input.page, pageSize: input.pageSize })}`,
          'GET',
          (value): value is ApiResponseFor<'GET /api/search'> => isPage(value, isSearchResult),
        )
      : await jsonRequest(...);
    return data;
  }
  ```
- **问题分析**：
  当带有搜索词 `q` 时，`loadKnowledgeNotes` 将请求转给 `/api/search`，但入参只保留了 `q`、`page`、`pageSize`，将用户当前选中的 `status`（Tab 页签）、`category`（分类）、`pinned` 等筛选全部丢弃。这导致作者在“草稿”页签中输入搜索词时，返回的结果会包含其他所有页签的文章。
- **整改要求**：
  `/api/search` 接口需要支持 `status`、`category` 等可选过滤参数，并在 `knowledge-api.ts` 中完整透传。

---

## 3. 问题跟踪清单与严重度评级 (Issue Tracking Matrix)

| 问题编号 | 严重级别 | 所属模块 | 责任角色 | 涉及文件与代码行 | 缺陷与风险描述 | 对应违背契约 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **Block-Stopper** | 全文搜索后端 | Role B | `functions/lib/search.ts` (L12-22, 67-83) | 搜索未加 `status = 'published'` 且在草稿正文检索，导致未发布草稿与归档文章泄漏 | `acceptance-spec.md` PUB-01, PUB-03 |
| **SEC-02** | **Block-Stopper** | 编辑器恢复 | Role E | `apps/web/src/knowledge/KnowledgeEditorRoute.tsx` (L283-303) | 客户端版本恢复吞异常 (`// continue`)，跳过保护备份直接覆盖正文，击穿熔断机制 | `contracts.md` 3.2, `acceptance-spec.md` VER-01 |
| **ARCH-01** | **Major** | 编辑器发布 | Role E / Role C | `apps/web/src/knowledge-ui/EditorPage.tsx` (L260-278)<br>`KnowledgeEditorRoute.tsx` (L176-187) | 发布功能被降级为下拉框走 PATCH，未能调用 `/publish` 生成快照，前台永远无法显示 | `contracts.md` 3.1, `data-api-spec.md` 3.3 |
| **ARCH-02** | **Major** | 接口适配 | Role C / Role M | `apps/web/src/knowledge/knowledge-api.ts` (L221-235) | 搜索模式下丢失 `status`、`category` 等参数，页签筛选在搜索时失效 | `contracts.md` 2.1 |
| **SEC-03** | **Medium** | 后端 API | Role B | `functions/lib/notes.ts` (L424-469) | `/publish` 未限制 `existing.status !== 'archived'`，允许已归档文章直接越权发布 | `data-api-spec.md` 3.4 |
| **PERF-01** | **Minor** | 导航滚动 | Role N | `apps/web/src/hooks/useScrollToTop.ts` (L78-150) | `useEffect` 缺少取消标记和 `cancelAnimationFrame`，快速连续跳转产生滚动跳动 | `contracts.md` 1.3 |
| **DATA-01** | **Minor** | D1 迁移 | Role B | `migrations/0003_add_published_snapshots.sql` (L14-19) | 存量文章回填未补充 `published_at`，可能导致 SQLite 倒序排序中存量文章置顶乱序 | `data-api-spec.md` 2.2 |
| **CONTRACT-01** | **Minor** | 状态同步 | Role M | `apps/web/src/knowledge/KnowledgeNotesRoute.tsx` (L151, L160) | URL 参数 `pinned` 和 `featured` 写入为 `'true'` 而非契约规定的 `'1'` | `contracts.md` 2.1 |
| **UX-01** | **Minor** | 搜索输入 | Role M | `apps/web/src/knowledge/KnowledgeNotesRoute.tsx` (L38-66) | URL 防抖 `trim()` 同步后反向修改 `searchInput`，导致用户键入空格被自动清除 | `ux-spec.md` |

---

## 4. 建议整改补丁方案 (Remediation Guidance)

### 4.1 修复 SEC-01：增强 `/api/search` 隔离
在 `functions/lib/search.ts` 中修正 `searchWhere`，对前台搜索增加发布限制：
```ts
const searchWhere = `(
  n.status = 'published' AND n.published_content_json IS NOT NULL AND (
    COALESCE(n.published_title, n.title) LIKE ? ESCAPE '\\'
    OR COALESCE(n.published_summary, n.summary) LIKE ? ESCAPE '\\'
    OR n.category LIKE ? ESCAPE '\\'
    OR n.published_content_text LIKE ? ESCAPE '\\'
    OR EXISTS (
      SELECT 1 FROM note_tags nt_search
      JOIN tags t_search ON t_search.id = nt_search.tag_id
      WHERE nt_search.note_id = n.id AND t_search.name LIKE ? ESCAPE '\\'
    )
  )
)`;
```

### 4.2 修复 SEC-02：接通前端版本恢复真实熔断
在 `apps/web/src/knowledge/KnowledgeEditorRoute.tsx` 中使用 `restoreVersionKnowledgeNote`：
```ts
const restoreVersion = useCallback(
  async (version: NoteVersionRecord) => {
    if (!noteId || !editor) return;
    setError(null);
    try {
      // 调用后端具备两阶段强熔断保护的接口
      const updatedNote = await restoreVersionKnowledgeNote(noteId, {
        versionId: version.id,
        currentDraft: {
          contentJson: draft.contentJson,
        },
      });
      // 阶段 1 成功并由服务端确认后，才覆盖本地编辑器
      const doc = JSON.parse(updatedNote.contentJson);
      editor.commands.setContent(doc, { emitUpdate: false });
      setDraft(toDraft(updatedNote));
      setPersistedKey(keyOf(toDraft(updatedNote)));
      await loadVersions();
    } catch (reason) {
      // 熔断中止！保留当前编辑器内容，严禁覆盖！
      setError('备份当前内容失败，已终止恢复操作以防丢失数据。');
    }
  },
  [draft.contentJson, editor, loadVersions, noteId],
);
```

### 4.3 修复 ARCH-01：恢复显式发布生命周期操作
在 `apps/web/src/knowledge-ui/EditorPage.tsx` 顶部操作栏中，根据 `model.status` 显示明确的发布按钮：
- 若为 `draft`：显示【发布文章】按钮，点击调用 `POST /api/notes/:id/publish`；
- 若为 `published`：显示【更新发布】按钮（调用 publish）与【撤回发布】按钮（调用 unpublish）；
- 去除直接修改 `status` 的下拉框，防止绕过快照生成。

---

## 5. 验收门禁签署 (Gate Decision & Sign-off)

- **门禁阶段**：Wave 2 集成完成度复核 / Wave 3 进入准入审核
- **审查结论**：**条件性不通过 (BLOCKED FOR GATE G3)**
- **签署意见**：
  鉴于系统中存在 `SEC-01`（搜索泄露草稿）与 `SEC-02`（版本恢复破坏性覆盖）两项 Block-Stopper 级别的严重漏洞，若强行进入 Wave 3/4 全栈与端到端测试，将导致 `PUB-01`、`PUB-03`、`VER-01` 三项关键验收测试全部失败并引发数据误毁风险。
  建议主控代理 (Role C) 立即分派缺陷至 Role B 与 Role E 进行针对性修补，并在回归核验通过后再行进入本地 Wrangler Functions 真实全栈集成。

**审查责任人**：独立安全与质量审查代理 (Role R)  
**签署时间**：2026-10-01
