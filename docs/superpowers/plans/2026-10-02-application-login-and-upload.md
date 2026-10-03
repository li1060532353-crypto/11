# 站内登录与文章上传修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 替代 Access，并让已登录管理员能够在云端新建、导入与上传；公开已发布文章。

**Architecture:** Pages Functions 校验 D1 不透明会话；独立公开只读发布快照接口与私有知识库接口。前端登录守卫仅负责导航，后端负责权限。保留原文章数据及自动保存行为。

**Tech Stack:** React、TypeScript、Cloudflare Pages Functions/D1/R2、Web Crypto、现有 Vitest。

**Spec:** `docs/superpowers/specs/2026-10-02-application-login-design.md`

## Global Constraints

- 已发布文章公开；知识库及所有写入操作需要登录。
- 单管理员，不开放注册；生产失败关闭，禁止通过关闭权限恢复上传。
- 初始用户名 admin；随机密码只交付到本机，不进入聊天、Git、日志或前端。
- 密码 PBKDF2-SHA256；会话摘要存 D1，生产 Cookie Secure/HttpOnly/SameSite=Lax，12 小时过期。
- 所有写入检查同源 Origin；认证响应和私有响应 no-store。
- 保留 8 篇现有笔记和 5 个版本。中文源文件 UTF-8 BOM。
- 沿用现有源码工作目录和全部未提交变更，不清理或覆盖他人修改。

## Review Focus

- 会话过期发生在选完文件后：显示重新登录入口并保留本次文件队列，不悄悄丢弃内容。
- 未发布修改：公开文章只能读取发布快照，不暴露草稿正文或历史版本。
- 隐藏文件框点击冒泡：一次用户动作只打开一次选择器；同一文件可重选。
- 批量混合文件：错误、超限、不支持格式有逐文件提示，成功文件无需重复上传。
- 云端绑定与 Cookie：生产保存刷新真实持久化，匿名直接调用接口被拒绝。

### Task 1: 服务端认证

**Files:** 新增 `migrations/0004_application_auth.sql`、`functions/lib/session-auth.ts`、`functions/api/auth/[[path]].ts`、`scripts/configure-owner-login.mjs`、认证测试；修改 `functions/env.ts`、`functions/_middleware.ts`。

**Interfaces:** `getSession(request, env)` 返回会话或 null；`handleAuthRequest(request, env, action)` 处理 login/session/logout；`isSameOriginMutation(request)` 拒绝跨站写入。Cloudflare Secret `OWNER_LOGIN_CONFIG` 存账号/盐/算法参数/校验值及凭据版本。

- [x] 添加并先运行失败测试：错误密码、未知用户、会话过期/伪造/撤销、配置缺失、跨站写入、数据库限流。
- [x] 实现会话与短期失败计数表及准备语句；随机令牌只把摘要存库，密码变更撤销旧版本会话。
- [x] 实现认证路由，限制 JSON 大小与密码长度；PBKDF2 参数采用 Workers Web Crypto 支持值并在本地/生产核验。所有错误不输出密码、Cookie 或令牌。
- [x] 替换 Access 中间件，保留仅本机显式 bypass；未认证私有 API 返回明确 AUTH_REQUIRED。
- [x] 本地配置工具生成初始随机密码并通过 stdin 写入 Wrangler Secret，本机凭据文件放在 Git 忽略目录；绝不把密码插入 shell 命令。
- [x] 运行认证测试与 Functions 类型检查，核验迁移可复现。

### Task 2: 登录页与知识库守卫

**Files:** 新增 `apps/web/src/auth/auth-api.ts`、`LoginPage.tsx`、`RequireOwner.tsx` 及测试；修改 `apps/web/src/router.tsx`、知识库布局退出入口与登录样式。

**Interfaces:** login(username,password)、loadSession()、logout() 使用同源 Cookie；RequireOwner 包装知识库路由，安全 returnTo 仅接受站内知识库地址。

- [x] 先测试匿名跳转、登录返回原页、错误反馈、退出、外站 returnTo 被拒绝。
- [x] 实现中文登录表单与提交状态；复用现有风格，不引入设计系统。
- [x] 将知识库全部页面置于守卫内，增加退出入口；避免全局错误处理造成编辑内容丢失。
- [x] 测试登录刷新持续有效；登录失效提供恢复入口，不自动重放写入。

### Task 3: 公开文章读取

**Files:** 新增 `functions/api/public/posts.ts` 与服务测试；修改 `apps/web/src/content/dynamicContentSync.ts`、`contentGateway.ts`、`apiClient.ts` 及对应测试。

**Interfaces:** GET /api/public/posts 只读分页、slug、搜索；只返回公开 Post 投影，使用 published_* 快照和 status=published。

- [x] 先测试不能用查询参数读取草稿/归档/未发布正文/版本；公开结果不含私有管理字段。
- [x] 实现准备语句和公开字段白名单；限分页大小，不开放写方法。
- [x] 将前台数据库文章读取切换到公开接口；静态文章仍保留并合并；Pages 默认不再调用不存在的 /api/v1。
- [x] 运行列表、详情、搜索、分类与归档相关回归测试。

### Task 4: 导入与附件上传

**Files:** 修改 `apps/web/src/knowledge/KnowledgeImportRoute.tsx`、`knowledge-api.ts` 及导入/附件测试；只在复现证明必要时修改 `functions/api/import/markdown.ts`、`functions/lib/assets.ts`。

**Evidence:** 2026-10-02 生产空 POST `/api/import/markdown` 与 `/api/assets` 均返回 ACCESS_DENIED；旧权限拦截为已确认主因，尚未验证权限通过后的文件处理。

- [x] 测试文件框事件：点击和 Enter/Space 各触发一次，避免隐藏 input 冒泡；拒绝文件有提示而非静默无动作。
- [x] 添加会话失效测试：保留文件队列，明确提示重新登录，不显示泛化导入失败。
- [x] 实现 UTF-8/BOM Markdown 文件选择、预览、逐项导入、失败重试回归；保留批次并发 3。
- [x] 用登录会话验证图片/PDF上传、私有下载、文件大小/类型错误与笔记关联；修复实际复现问题。
- [x] 检查真实 R2 绑定、数据库记录、刷新后内容及附件可读取。

### Task 5: 发布与验收

**Files:** 更新 `docs/cloudflare-setup.md`、`.codex/progress.md` 和部署证据；本机 release 目录保存备份，不将凭据打包进源码。

- [x] 运行相关单元/集成、前端与 Functions 类型检查、lint、生产构建。
- [x] 备份 D1，应用认证迁移与 Secrets，发布到现有 Pages Production；保持 KB_ASSETS 私有。
- [x] 匿名浏览器验证公开文章、私有接口拒绝；管理员浏览器验证登录、创建、导入实际 Markdown、附件上传下载、保存、刷新与退出。
- [x] 仅用新增验收笔记测试，不修改已有文章；测试记录明确标记并归档，附件清理只处理新建验收对象。
- [x] 记录当前部署与数据库回滚点、截图和仍存在的限制；实际保存/上传未验证不得宣称完整完成。

## Execution

建议由当前会话顺序执行，认证到前端到上传存在直接依赖，无需并行实现。计划审阅通过后执行；原生产导入与部署确认持续有效。
