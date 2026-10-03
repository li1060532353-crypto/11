# 知识库体验优化共用任务表与接口冻结协议

**基线时间**：2026-10-02  
**工作区**：`personal-blog-source` (分支：`codex/draft-image-fixes`)  
**原则**：一次冻结方案 → 多子代理按文件分工 → 主代理统一集成 → 最后一次验收。中间不设置阶段审批，不反复启动审查代理。保留当前工作区未提交修改。

---

## 1. 冻结的共享契约与接口约定

各实施代理必须严格遵守以下共享协议，不得自行变更定义：

### 1.1 导航来源与返回协议 (`NavigationSourceState`)
沿用 `apps/web/src/components/navigation/navigationSource.ts` 现有协议：
```typescript
export interface NavigationSourceItem {
  kind: 'admin_notes' | 'editor_preview' | 'post_list' | 'search' | 'taxonomy' | 'archive' | 'direct';
  fromPath: string; // 包含完整的 pathname 与 search 查询参数，例如 "/knowledge/notes?tab=draft&q=架构&page=3"
  fromLabel: string; // 例如 "← 返回文章列表"
  scrollY?: number; // 离开时的 window.scrollY
}

export interface NavigationSourceState extends NavigationSourceItem {
  rootSource?: NavigationSourceItem;
  hopCount?: number;
}
```

- **列表跳转**（子代理 A 负责）：
  - 点击列表行标题、编辑按钮、阅读按钮、“新建文档”按钮时，均通过 `<Link state={navSourceState}>` 携带当前完整参数与滚动高度。
- **返回解析与消费**（子代理 B 负责）：
  - 由路由层 `KnowledgeEditorRoute` 通过 `getSafeReturnTarget(location.state, '/knowledge/notes', '← 返回文章列表')` 解析得到 `returnTarget`。
  - 通过 props 传递给展示层 `EditorPage`：
    ```typescript
    returnTarget?: {
      path: string;
      label: string;
      state?: unknown;
    };
    ```
  - 面包屑与返回按钮渲染 `<Link to={returnTarget.path} state={returnTarget.state}>`。
  - 路由守卫 `EditorNavigationGuard` 允许安全保存并放行跳转至 `returnTarget.path`。

### 1.2 编辑器发布与检查协议
- **发布操作 awaitable 契约**：
  - `onPublish?: () => Promise<boolean> | boolean | void`
  - 成功返回 `true`，失败返回 `false`。
  - 发布失败必须保留发布抽屉（`isPublishDrawerOpen = true`），不得静默关闭，允许用户原地重试。
- **发布检查使用实际状态**：
  - 草稿保存状态：`state === 'saved' || state === 'unchanged'` 为通过；`state === 'saving' || state === 'unsaved'` 为同步中/待保存；`state === 'failed'` 为错误阻断。
  - 附件状态：检查 `model.assets` 中是否有正在上传 (`uploading`) 或上传失败 (`failed`) 的文件。
  - 内容校验：标题非空 (`model.title.trim().length > 0`)。若标题为空或关键校验未通过，发布按钮处于禁用状态。

### 1.3 列表排序、搜索与批量选择生命周期
- **服务端分页前排序与筛选**：
  - 排序 (`updated_desc`、`published_desc`、`title_asc`)、状态筛选、搜索词、置顶 (`pinned`)、精选 (`featured`) 统一由服务端 SQL 处理，禁止前端拉取一页后再做本地截断排序。
  - `/api/search` 支持 `sort`、`pinned`、`featured`，实现“搜索叠加置顶与精选”。
- **批量选择生命周期**：
  - 批量选择限定当前页数据。
  - 当页码改变 (`page`) 或任何筛选/搜索条件改变 (`tab`, `category`, `q`, `sort`, `pinned`, `featured`) 时，必须清空 `selectedIds`。
- **批量重试**：
  - `BatchOperationResult` 记录 `targetCategory`，重试分类修改时能正确按原目标分类重试。

### 1.4 公共组件规范
- 公共输入弹窗 `apps/web/src/components/ui/InputDialog.tsx`：
  ```typescript
  export interface InputDialogProps {
    isOpen: boolean;
    title: string;
    description?: string;
    label?: string;
    placeholder?: string;
    defaultValue?: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: (value: string) => void | Promise<void>;
    onCancel: () => void;
  }
  ```

---

## 2. 子代理分工责任矩阵与文件边界

| 子代理 | 唯一职责 | 允许修改的文件边界 | 依赖与对接接口 |
|---|---|---|---|
| **A：导航与列表入口** | 列表编辑、阅读、新建来源传递；返回协议与滚动恢复（含慢请求异步恢复） | `apps/web/src/knowledge-ui/NotesPage.tsx`<br>`apps/web/src/hooks/useScrollToTop.ts`<br>`apps/web/src/components/navigation/navigationSource.ts` | 提供：`navSourceState` 给编辑页与阅读页。<br>优化：`useScrollToTop` 在慢请求下轮询等待内容高度增长。 |
| **B：编辑与发布** | 新建保存、自动保存、离开保护、预览返回、真实发布检查、发布失败恢复、编辑设置分组 | `apps/web/src/knowledge/KnowledgeEditorRoute.tsx`<br>`apps/web/src/knowledge-ui/EditorPage.tsx`<br>`apps/web/src/knowledge/useNoteAutosave.ts`<br>`apps/web/src/knowledge/EditorNavigationGuard.tsx` | 消费：A 提供的 `location.state` 解析 `returnTarget`。<br>提供：awaitable `onPublish`、真实检查项、设置项分组折叠。 |
| **C：列表数据与批量操作** | 服务端排序、发布时间映射、统一组合筛选、防抖请求、批量分类重试及选择清理 | `apps/web/src/knowledge/KnowledgeNotesRoute.tsx`<br>`apps/web/src/knowledge/knowledge-api.ts`<br>`functions/lib/notes.ts`<br>`functions/lib/search.ts`<br>`packages/shared/src/knowledge.ts` | 消费：D 的 `InputDialog`（如有批量输入需求）。<br>保证：换页/换筛选清空已选；服务端分页前完成排序与过滤。 |
| **D：公共组件与视觉** | 公共输入弹窗、基础组件、设计变量、按钮状态、响应式及统一文案规范 | `apps/web/src/components/ui/InputDialog.tsx`<br>`apps/web/src/styles/tokens.css`<br>`apps/web/src/knowledge-ui/knowledge.css` | 提供：`InputDialog` 组件与统一设计变量。<br>保证：移动端 390px 与桌面端 1440px 样式一致性与无横向溢出。 |
| **主代理** | 冻结方案、派发任务、单向依赖接线、全量构建/测试检查、验收子代理调度 | 共享集成胶水文件、根配置、验收报告 | 负责集成各子代理产物，统一运行测试与构建。 |

---

## 3. 最终验收场景覆盖

1. **场景 1**：“草稿＋关键词＋第 3 页”进入编辑，保存返回后保留筛选、页码和位置。
2. **场景 2**：慢请求下滚动恢复；预览关闭回到当前编辑状态。
3. **场景 3**：保存期间继续输入、重复保存、保存失败及离开保护。
4. **场景 4**：发布与附件失败不误报成功；发布失败保留抽屉并可重试。
5. **场景 5**：跨页排序、搜索叠加置顶与精选、批量部分失败重试。
6. **场景 6**：桌面 1440px、手机 390px 尺寸、键盘操作、浏览器后退与直接打开。
