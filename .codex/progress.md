# Progress

## Wave 0 — reconnaissance

Task: W0-01 durable controls and reconnaissance
Status: DONE
Model: gpt-5.6-terra (controller fallback: current balanced model; no runtime switch claimed)
Agent/worktree: /root, `E:\AIblog\personal-blog-source` on `codex/local-api-docker`
Allowed files: `AGENTS.md`, `docs/codex-master-spec.md`, `docs/reconnaissance-report.md`, `.codex/**`
Forbidden files: application source, dependency manifests, Cloudflare configuration, migrations
Base commit: `3b4b75f`
Head commit: not created
Tests: `pnpm content:check` PASS; `pnpm --filter @namdw/web test` FAIL (5 pre-existing content-fixture assertions)
Review verdict: pending
Open findings: root workspace is a separate empty Git repository; actual project is nested. Existing untracked plan must be preserved. Baseline web query tests are stale after static import adds two posts.
Dependencies: none
Next action: Wave 1 completed pending H1 approval.

## Wave 1 — Cloudflare foundation

Task: W1-01 D1 schema, shared contracts, Access middleware, local configuration
Status: DONE_WITH_CONCERNS
Model: current balanced controller
Agent/worktree: `/root`, `E:\AIblog\personal-blog-source`, `codex/local-api-docker`
Allowed files: `migrations/**`, `functions/**`, `packages/shared/**`, local Pages docs/config/templates, `.codex/**`
Base commit: `63c03ed`
Head commit: pending final evidence commit
Tests: shared tests PASS (11); `node --test scripts/verify-cloudflare-config.test.mjs` PASS (2); typecheck PASS; lint PASS; production build PASS
Local D1 evidence: `pnpm exec wrangler d1 migrations apply DB --local --config test-fixtures/wrangler.d1.local.jsonc` exited 0. Wrangler applied `0001_knowledge_base.sql` to `./test-fixtures/.wrangler/state/v3/d1`, executed 15 commands successfully, and reported status `✅`. The deterministic follow-up `wrangler d1 migrations list DB --local --config test-fixtures/wrangler.d1.local.jsonc` reported `No migrations to apply` (exit 0). Local state is ignored; the fixture and migration are the reproducible inputs.
Review verdict: final independent review APPROVED for specification compliance and code quality/safety; no Critical or Important findings
Open findings: baseline web content-query tests remain stale from Wave 0; B-002 Pages reserves the specification-required `ASSETS` R2 binding name and must be resolved before H2
Dependencies: H1 approval
Next action: H2 human configuration checkpoint; do not integrate frontend API or perform Cloudflare dashboard work until the user confirms external configuration is complete.

## Wave 1 — H2 configuration preparation

Task: W1-02 Pages binding compatibility and human configuration guide
Status: HUMAN_ACTION_REQUIRED
Model: current Terra-equivalent controller
Allowed files: Wrangler template, Functions environment typing, tests, Cloudflare setup docs, `.codex/**`
Tests: validator tests PASS (2); Functions typecheck PASS; stale `ASSETS` scan contains documentation-only explanations
Decision: R2 binding renamed from `ASSETS` to `KB_ASSETS` because Wrangler reserves `ASSETS` for Pages projects.
Next action: user completes the H2 dashboard steps in `.codex/human-actions.md`, then provides non-secret confirmation and resource identifiers through the dashboard-configured local `wrangler.jsonc` workflow.

H2 completion evidence: owner confirmed D1/R2 bindings, production Access policy, and runtime variables. Local `node scripts/verify-cloudflare-config.mjs wrangler.jsonc` exited 0 without exposing configuration values.

## Wave 2 — planning

Task: W2-00 notes/search/statistics and visual-shell plan
Status: DONE
Model: Terra controller; Luna eligible only for isolated frontend presentation after contracts remain unchanged
Allowed files: planning and `.codex/**`
Contracts: `ApiRouteContractMap` frozen; no frontend API integration authorized
Next action: begin sequential Terra Notes API task after task ownership is recorded.

## Wave 2 — Task 1 Notes API

Task: W2-01 protected Notes CRUD API
Status: DONE
Model: Terra controller
Allowed files: `functions/lib/notes.ts`, `functions/api/notes/**`, focused tests, `.codex/**`
Tests: shared focused tests PASS (17); Functions typecheck PASS; project typecheck PASS; lint PASS; production build PASS; Cloudflare configuration verifier PASS
Review verdict: independent review approved specification compliance and code quality/safety; no Critical/Important findings
Open findings: baseline web content-query mismatch remains unrelated; archive SQL is source-inspected rather than exact-SQL mock asserted (Minor)
Dependencies: frozen contracts and existing Access middleware preserved
Next action: stop Task 1; do not begin Wave 2 Task 2 without user direction.

## Wave 2 - Task 2 Search and statistics API

Task: W2-02 frozen search and statistics backend
Status: DONE
Model: Terra controller
Agent/worktree: `/root`, `E:\AIblog\personal-blog-source`, `codex/local-api-docker`
Allowed files: `functions/lib/search.ts`, `functions/api/search.ts`, `functions/api/stats.ts`, focused search tests, `.codex/**`
Forbidden files: migrations, shared frozen contracts, frontend, Access middleware, production configuration
Base commit: `25b6087`
Head commit: Task 2 closure commit (see repository history)
Tests: focused `pnpm --filter @namdw/shared test -- search-route.test.ts` PASS (6); shared tests PASS (23); Functions typecheck PASS; project typecheck PASS; lint PASS; production build PASS (existing Vite chunk-size warning); Cloudflare configuration verifier PASS
Review verdict: independent review approved specification compliance and code quality/safety; no Critical/Important findings
Open findings: Minor review evidence record corrected; unrelated baseline web content-query mismatch remains outside this task
Dependencies: frozen `GET /api/search` and `GET /api/stats` contracts; existing global Access middleware
Next action: stop after Task 2; do not begin frontend integration without user direction.

## Wave 3 - Task 1 transport contracts

Task: W3-01 multipart upload and binary download contract isolation
Status: DONE
Model: Terra controller
Agent/worktree: `/root`, `E:\AIblog\personal-blog-source`, `codex/local-api-docker`
Allowed files: `packages/shared/src/{knowledge,index,knowledge.test}.ts`, `.codex/progress.md`
Forbidden files: Functions, migrations, frontend, dependency manifests, Cloudflare configuration, production resources
Base commit: `9fc0b70`
Head commit: pending Task 1 closure commit
Tests: focused shared contract test PASS (5); shared package build PASS; Functions typecheck PASS; project typecheck PASS; lint PASS; `git diff --check` PASS
Review verdict: independent Task 1 review APPROVED for binary route isolation, multipart typing, JSON-map scope, and no Task 2/Wave 4 implementation; no Critical/Important findings
Open findings: the unrelated untracked local-API/Docker plan remains preserved; the five baseline web content-query failures remain out of scope
Dependencies: approved Wave 3 Task 1 only
Next action: stop after Task 1; do not begin Task 2 without user direction.

## Wave 3 - Task 2 private asset backend

Task: W3-02 protected multipart upload, binary proxy download, and single-asset deletion
Status: DONE
Model: Terra controller
Agent/worktree: `/root`, `E:\AIblog\personal-blog-source`, `codex/local-api-docker`
Allowed files: `functions/lib/assets.ts`, `functions/api/assets/**`, `packages/shared/src/assets-route.test.ts`, `.codex/progress.md`
Forbidden files: migrations, frontend, editor, dependency manifests, Access middleware, Cloudflare configuration, production resources
Base commit: `36361d5`
Head commit: pending Task 2 closure commit
Tests: focused asset route/store tests PASS (8); shared tests PASS (33); Functions typecheck PASS; project typecheck PASS; lint PASS; production build PASS (existing chunk-size warning); Cloudflare configuration verifier PASS; `git diff --check` PASS
Review verdict: independent Task 2 security review APPROVED for multipart/size/signature/filename validation, private R2-only operations, safe binary headers, stable failure envelopes, upload compensation, D1-first deletion/restoration, and unchanged global Access middleware; no Critical/Important findings
Open findings: no distributed D1/R2 transaction exists; failed compensation can leave an orphan and is intentionally deferred to human-reviewed reconciliation. The unrelated untracked local-API/Docker plan remains preserved; baseline content-query failures remain out of scope.
Dependencies: frozen Task 1 transport contracts
Next action: stop after Task 2; do not begin the separate Task 3 review artifact or frontend/editor/import work without user direction.

## Wave 3 - Task 3 fixture-only editor and attachment presentation

Task: W3-03 controlled editor presentation and asset states (Luna frontend scope)
Status: DONE
Model: Luna-level frontend scope
Allowed files: `apps/web/src/knowledge-ui/{EditorPage.tsx,AssetPanel.tsx,editor-fixtures.ts,EditorPage.test.tsx,knowledge.css}`, this progress record
Forbidden files: API clients/routes, `fetch`, router integration, Tiptap, Functions, shared contracts, migrations, Access middleware, R2 behavior, Cloudflare configuration, production operations, import/rewrite work, and version semantics
Tests: focused `EditorPage.test.tsx` PASS (12); web typecheck PASS; lint PASS; production build PASS (existing Vite chunk-size warning); `git diff --check` PASS
Review verdict: independent Task 3 review APPROVED for fixture/props isolation, accessible editor/highlight/save/attachment presentation, confirmation behavior, responsive CSS, no network/API integration, and no backend or contract changes; no Critical or Important findings
Open findings: none for Task 3; the unrelated untracked local-API/Docker plan remains preserved; baseline content-query failures remain out of scope
Next action: stop after Task 3; Terra owns the separately authorized integration task, which has not started.

## Wave 3 - Terra foundation: canonical documents and semantic highlights

Task: W3-04 authoritative Tiptap document validation, derived text projection, and isolated KnowledgeHighlight extension
Status: DONE
Model: Terra controller
Allowed files: Notes domain/tests, minimal shared `HighlightKind` export, isolated `apps/web/src/knowledge-editor/**`, direct Tiptap dependencies, existing fixture type import, lockfile, and this progress record
Forbidden files: editor routes, API/mutation clients, autosave, asset frontend integration, router changes, D1 schema, API contracts/routes, Access middleware, Cloudflare configuration, import/Markdown work, production operations, and Wave 4 work
Validation: accepts only doc, paragraph, heading levels 1-6, bullet/ordered lists, list items, blockquotes, code blocks, hard breaks, text, basic bold/italic/strike/code marks, and exact five-kind highlight marks; rejects unknown attributes and unsupported structures. Limits: 256 KiB UTF-8 payload, depth 32, 10,000 nodes, 16 KiB strings, 16 marks/text node.
Projection: visible reading-order text only; top-level blocks use blank lines, nested/list/quote blocks use newlines, hard breaks remain newlines, and empty blocks contribute no text. Create/PATCH do not snapshot; only the existing explicit version operation does.
Tests: focused Notes validation/projection tests PASS (18); focused KnowledgeHighlight tests PASS (7); shared tests PASS (44); Functions typecheck PASS; web typecheck PASS; project typecheck PASS; lint PASS; production build PASS (existing Vite chunk-size warning); `git diff --check` PASS
Review verdict: independent narrow review APPROVED for authoritative validation, DoS bounds, unsafe-shape rejection, deterministic projection, semantic persistence, unchanged version semantics, and no integration/scope expansion; no Critical or Important findings
Open findings: no foundation-task findings; the unrelated untracked local-API/Docker plan remains preserved; baseline content-query failures remain out of scope
Next action: stop after this foundation task; later editor/API/assets integration remains separately authorized and has not started.

## Wave 3 - Terra Notes editor mutation integration

Task: W3-05 Notes create/load/PATCH/autosave/explicit-version integration only
Status: DONE
Model: Terra controller
Allowed files: Notes web client, editor route/autosave/tests, approved editor route entries, minimal presentation slot integration, direct Tiptap React dependency, lockfile, and this progress record
Forbidden files: asset API integration or attachment behavior, Functions/backend/schema/contracts, Access middleware, Cloudflare configuration, Markdown/import work, production operations, and Wave 4 work
Routes: `/knowledge/notes/new` and `/knowledge/notes/:id` are registered before the wildcard route.
Mutation semantics: typed JSON-envelope client calls only GET/POST/PATCH Notes routes; existing notes autosave after 1500 ms, serialize one active request, ignore disposed/stale results, reschedule newer edits after stale completion, and keep failed saves dirty without automatic retry. Create has duplicate-call protection and transitions to the persisted identity. Create/PATCH never call `/versions`; explicit Save Version first persists current edits and then posts only to the existing version route, with duplicate-click protection.
Tests: focused API/editor/presentation tests PASS (21); shared tests PASS (44); web typecheck PASS; project typecheck PASS; lint PASS; build PASS (Vite emitted its chunk-size advisory); git diff --check PASS.
Review verdict: independent narrow review APPROVED for mutation contract safety, autosave races, version semantics, canonical document use, error-envelope safety, unsaved warning, and no asset/Wave 4 scope expansion; no Critical or Important findings
Open findings: no editor-mutation findings; the unrelated untracked local-API/Docker plan remains preserved; baseline content-query failures remain out of scope
Next action: stop after Notes editor integration; asset frontend integration remains explicitly excluded and has not started.

## Wave 4 - Product Experience Redesign Phase 1

Task: W4-01 design tokens and shared visual shell
Status: NEEDS_REVIEW
Model: gpt-5.6-terra implementer with independent review
Agent/worktree: gpt-5.6-terra implementer and gpt-5.6-sol reviewer, `E:\AIblog\personal-blog-source`, `codex/local-api-docker`
Allowed files: `apps/web/src/styles/{tokens,global,shell,motion}.css`, `apps/web/src/styles/visual-contract.test.ts`, new focused `apps/web/src/components/ui/**`, and `.superpowers/sdd/**`
Forbidden files: Functions, API clients/contracts, router, D1/R2 schemas, Cloudflare configuration, Tiptap/autosave/persistence, dependency manifests, and unrelated documents
Base commit: `adab2c6`
Head commits: `b2a9472`, `bddfc45`, `a8b226f`
Tests: Phase 1 visual/primitives PASS (19); route shell fallback PASS (28, with existing jsdom `scrollTo` notices); web typecheck PASS; lint PASS; web build PASS with existing >500 KB chunk advisory; diff check PASS.
Contract impact: none observed; only CSS, visual-contract tests, and native shared primitives changed.
Review verdict: independent review APPROVED for specification compliance and code quality/safety; no Critical or Important findings. Minor: the scoped EmptyState accessibility enhancement modified an existing primitive while the brief literally listed only new UI files.
Open findings: preview/browser connection refused, so screenshot automation used the approved manual route/viewport fallback; unrelated local API/Docker plan remains untracked and preserved.
Next action: Phase 1 checkpoint presented; wait for user approval before Phase 2.

## Wave 4 - Product Experience Redesign Phase 2

Task: W4-02 public blog experience
Status: DONE
Model: gpt-5.6-terra implementer with independent review
Agent/worktree: gpt-5.6-terra implementer and gpt-5.6-sol reviewer, `E:\AIblog\personal-blog-source`, `codex/local-api-docker`
Allowed files: public layout/home/content/reading/page presentation files and focused public tests; `.superpowers/sdd/**`
Forbidden files: `apps/web/src/content/**`, Functions, API/data adapters, query parameters, router, contracts, D1/R2 schemas, Cloudflare configuration, Tiptap/autosave/persistence, dependencies, and unrelated documents
Base commit: `1a162bd`
Head commits: `5f0b1c1`, `90d3b1a`, `489652b`
Changed scope: public header/footer, featured-content composition, About presentation, reading/TOC presentation, public styles, and focused tests only.
Renderer inspection: current parser uses remark-parse/GFM/math, heading IDs are derived before rendering, rehype-highlight and rehype-katex remain enabled, and external links retain `rel="noreferrer"`.
Tests: focused public/reader suite PASS (10 files / 60 tests); project typecheck PASS; lint PASS; production web build PASS with the existing >500 KB chunk advisory; `git diff --check` PASS.
Route smoke: production preview verification recorded one `main`, no not-found state, and no horizontal overflow for `/posts`, `/search`, `/projects`, and `/about` at 1024x768. Homepage manual checks passed at 1440x900 and 320x720, including responsive navigation and no 320px overflow. The second direct `/posts/:slug` preview pass was unavailable after the transient preview ended; focused post/renderer/TOC/progress tests passed.
Review verdict: independent final review PASS; no Critical or Important findings. The approved screenshot fallback is fully evidenced with route output, viewport checklist, and manual production-preview observations.
Contract impact: none observed. API requests, query parameters, data adapters, Markdown parsing/sanitization/generated content structure, data model, authentication, Cloudflare configuration, and persistence behavior remain unchanged.
Open findings: the unrelated untracked local API/Docker plan remains preserved; Vite's non-failing chunk-size advisory remains unchanged.
Next action: Phase 2 checkpoint presented; wait for user approval before Phase 3.


## 2026-10-02 — oil-ui visual consistency and writing flow
Status: DONE_WITH_CONCERNS
Agent/worktree: /root, E:/AIblog/personal-blog-source, codex/draft-image-fixes (existing dirty work preserved).
Scope: home article search; left desktop global navigation; shared layout/control rhythm; collapsed editor settings; full-width empty document canvas; new title focus and truthful initial save status. Installed oil-ui in the user's Codex skill directory.
Files: Hero.tsx, HomeSearch.test.tsx, SiteHeader.tsx, SearchPage.tsx, main.tsx, styles/unified.css, EditorPage.tsx, EditorPage.test.tsx, TableOfContents.tsx (safe first-heading guard required for typecheck).
Verification: all frontend tests 306/306 passed before final layout refinements; final affected regression tests 52/52 passed; final frontend build/typecheck passed; scoped ESLint passed; git diff --check passed. Independent code review passed after aligning the settings breakpoint to 64rem. Visual checks were performed by the main agent, not an independent visual reviewer.
Browser evidence: 1440 desktop home/editor, 390 mobile home/editor (no horizontal page overflow), 1080 settings hidden then expanded; home query 矩阵 returned matching local article. New title focus and 760px empty canvas confirmed.
Concerns: content API returns 502 locally, so search browser validation used cached content. Production persistence/deployment not verified in this change; existing save reliability tests pass. Build retains existing chunk-size advisory.
Next: user review of local preview; no deployment or push performed.


## 2026-10-02 — Unified workspace drawer and Markdown creation
Status: DONE_WITH_CONCERNS
Agent/worktree: /root, E:/AIblog/personal-blog-source (existing dirty work preserved).
Scope: unified global/workspace drawer; remove workspace-only search and Ctrl+K; create chooser/upload/manual Markdown; Markdown clipboard conversion and atomic inline LaTeX; search return navigation; shared import shell.
Verification: frontend 311/311 PASS, shared 86/86 PASS, frontend typecheck/build PASS, scoped ESLint PASS, diff check PASS. Browser verified desktop source preview, real clipboard Markdown paste, formula rendering, mobile preview switching/drawer layering/Escape/no horizontal overflow, public search return to /posts. Pointer-hover activation has a regression test.
Review: independent code/spec review PASS after resolving formula splitting, source/JSON divergence and residual workspace search. Independent visual screenshots review has no blocking findings; removed misleading numbered create cards.
Artifacts: E:/AIblog/design-deliverables/workspace-integration/修改说明.md and desktop/mobile JPEG screenshots.
Concerns: no production deployment or production persistence verification. Existing build chunk-size advisory remains. Motion intermediate frames not captured.
Next: user can review /knowledge/create in local preview; no push or deploy performed.


## 2026-10-02 — Compact reading controls and Cloudflare feasibility
Status: DONE_WITH_CONCERNS
Scope: PostDetailPage/KnowledgeNoteReadRoute remove absent-cover/decorative space; smaller reading heading and gaps; sticky return/control bar; separate safe-target floating return; measured navigation-height hook and anchor/ToC offsets; reading-only compact fallback warning.
Verification: frontend 311/311 PASS, frontend typecheck/build PASS, scoped lint PASS, Functions typecheck PASS, diff check PASS. Browser desktop sticky nav bottom112/ToC top120, mobile anchor top124.16 after settled jump, floating button visible and no horizontal overflow.
Review: independent code/spec PASS after fixing added sticky layer offset; independent visual review no blocker, reduced mobile floating control shadow/opacity.
Cloudflare: structural configuration ready, remote resource existence not verified; legacy /api/v1 is proxied locally to3000 and lacks Pages Functions equivalent; D1 migrations0001-0003 and local D1/R2 data require target verification/migration. No deploy or cloud mutation performed.
Artifacts: E:/AIblog/design-deliverables/reading-optimization/修改与同步评估.md and screenshots.
Concerns: production functionality/persistence unverified, existing build chunk advisory. Next: review local reading; Cloudflare adaptation/data migration/Preview release are separately scoped work.


## 2026-10-02 — Article index home return
Status: DONE_WITH_CONCERNS
Scope: PostsPage reuses ReturnButton and reader-floating-return styling with explicit home label and / target, scrollY 0.
Verification: frontend typecheck PASS; scoped diff check PASS; in-app browser mobile screenshot confirms lower-left button; clicking returns to http://127.0.0.1:5173/.
Review: scoped self-review; no independent review for this small UI addition. Existing API502 fallback and narrow-viewport overflow were visible; no deployment.

## 2026-10-02 — Cloudflare production publication and verified data migration
Status: DONE_WITH_CONCERNS
Agent/worktree: /root, E:/AIblog/personal-blog-source; existing local edits preserved.
User authorization: H3 production import and publication explicitly confirmed in chat.
Production: https://11-9tc.pages.dev; deployment 048ab9ca-ac01-404e-aa37-f2fbb0d37364, branch main. No Git push performed.
Data: migrations 0001-0003 applied; 8 notes, 7 tags, 3 note-tag relations, 5 versions imported. All seven business tables compared against a fresh production export and match the local backup exactly; foreign_key_check empty.
Artifacts: E:/AIblog/cloud-release/2026-10-02 contains source zip, local SQLite backup, before/after production exports, chunked migration, and data-verification.json.
Verification: web 311/311 and shared 86/86 tests passed; frontend build, repository typecheck and lint passed. Unauthenticated production home returns 200; /api/notes returns 403. Browser workspace shell renders but statistics fail due to absent Access login integration.
Investigation: logged-in Cloudflare One Applications page shows no existing applications. Historic H2 record does not reflect current remote state. No Access application or policy was created or modified.
Current steering: user requests replacing Access with an application login protecting knowledge creation. Auth scope is being clarified before implementation; keep all private APIs fail-closed until replacement is verified.
Next: define and implement single-owner login, published-read boundary and protected mutations, then redeploy and verify authenticated read/save/reload and anonymous rejection.


## 2026-10-02 — Application login and production import/upload repair
Status: DONE_WITH_CONCERNS
Authorization: user approved written spec and implementation plan and instructed implementation/continuation; prior production publication authorization preserved.
Scope: single-owner server authentication replacing Access, protected knowledge routes/mutations, public publication snapshots, upload chooser event correction and expired-session retry preserving files.
Data: migrations0004-0006 applied; original8 notes and5 versions preserved; production acceptance added one clearly titled test note, then unpublished/archived it and removed its test attachment.
Verification: full frontend323/323 tests PASS before final title change; final relevant37/37 tests PASS; frontend build/typecheck, Functions typecheck and lint PASS. Existing bundle-size advisory remains.
Production: https://11-9tc.pages.dev. New server cookies/session successfully verified; wrong password and anonymous knowledge API rejected; real BOM Chinese Markdown imported/reloaded; R2 PNG uploaded/listed/downloaded with exact bytes; private assets inaccessible anonymously; changing working title/category/tags/slug/date left public snapshot unchanged; cross-site PATCH rejected; logout revoked session.
Evidence: E:/AIblog/cloud-release/2026-10-02/login-upload-production-verification.json and local source/DB release files.
Review: independent final code/spec review PASS, no Critical/Important findings after resolving snapshot metadata/date, streamed login size bound and editor file recovery. Independent reviewer did not perform production calls; main agent performed production verification.
Credentials: OWNER_LOGIN_CONFIG is a Cloudflare Secret; random login password exists only in ignored .owner-login directory. Never include credentials in source archives or browser screenshots.
Ruling: no Git commits/push in this mixed dirty workspace; deploy exact tested build directly to existing Cloudflare production branch. Preserve all prior local edits.
Limitations: single-owner login, no self-service password reset; private attachments in publicly published articles still require administrator login. Public R2 exposure remains prohibited.
Final production deployment: 91284b9e.11-9tc.pages.dev, stable domain https://11-9tc.pages.dev. Login-page browser verification confirms correct title and automatic anonymous knowledge redirect. Final source package project-source-with-login.zip verified and excludes .owner-login credentials. Screenshot: E:/AIblog/cloud-release/2026-10-02/login-production.jpg.


## 2026-10-02 — Mobile reading and filters
Status: DONE
Authorization: user approved left collapsible article contents drawer and collapsed mobile filters, then instructed implementation.
Scope: shared TableOfContents (public article and knowledge reader), FilterBar, mobile viewport hook, reading/content CSS, focused interaction tests. Preserved existing unrelated workspace changes; no commits/push/deploy.
Behavior: mobile TOC no longer occupies article flow; left edge button opens modal drawer; chapter selection preserves router history state/key, jumps to heading, closes drawer and focuses heading. Scroll-driven current chapter, Escape/backdrop close, focus trap, background inert/scroll lock restoration, breakpoint cleanup and reduced motion supported. Filters collapse on mobile and expand vertically, show active filter count, preserve existing query routing. Desktop contents/filter controls remain visible.
Verification: final frontend 324/324 tests PASS; production frontend build PASS (existing chunk-size advisory); scoped ESLint PASS. Browser at 390px and 320px tested drawer, filters, chapter scroll, focus and active highlight; 1280px desktop contents visible; chapter Back/Forward restores position. Existing unavailable local API uses cached content for preview.
Review: independent scoped specification/code quality review PASS, no blocking findings; queued RAF cleanup and resize/history tests added.
Evidence: E:/AIblog/design-deliverables/mobile-reading-toc.jpg; E:/AIblog/mobile-reading-tests.log; E:/AIblog/mobile-reading-build.log.

Final review followups: empty-headings hash RAF cleanup added; explicit instant hash scroll scoped to mobile to preserve desktop animation. Final scoped 16/16 tests, build and scoped ESLint PASS after followups.

## 2026-10-02 页面风格统一
- 用户确认：以现有首页蓝色、酸绿色与工程细线风格统一其他页面；阅读页克制调整。
- 修改：main.tsx 引入 signal.css；共享控件、列表、项目、分类、归档、知识库、导入和登录样式统一；阅读背景移除原网格，不改变正文宽度、字号与行距。
- 验证：前端构建通过；5 个测试文件、32 项测试通过。实看桌面项目页、手机登录与阅读页、深色文章卡片键盘焦点；390px 阅读页无横向溢出、网格 display:none。
- 独立审查：修复深色卡片背景优先级及悬停标签对比度问题。
- 限制：本地内容接口 502，使用既有缓存内容；未验证登录后的知识库实际数据页面；未部署。

## 2026-10-02 文章列表色块边界与主题反转修正
- 列表面板收窄为内容最大宽度并居中，两侧保留主题画布；手机仍保留 16px 起的侧边留白。
- 反色面板使用共享语义变量：浅色主题深色块，深色主题浅色块；筛选、分页、标题、摘要和焦点同步反转。
- 核查首页、共享列表、项目卡片、导航和登录相关配色；首页近期记录同步使用反色变量，修复链接悬停与焦点对比度及深色首页蓝色标题可读性。
- 实际查看 1440px 明暗列表、390px 深色列表；无横向溢出。截图：design-deliverables/article-list/bounded-light.png 与 bounded-dark.png（位于工作区上级）。
- 独立审查指出首页反色区链接对比度问题，已修复。

## 2026-10-02 非首页留白衔接
- PageSignalFrame 共享组件：蓝色信号折线、节点、定位角，仅布局外侧装饰，不拦截交互、不进入辅助技术树。
- 路由层在非首页显示；阅读降低透明度；阅读与编辑分别按 91rem/90rem 内容宽度计算安全边缘；窄屏隐藏。
- 文章索引面板改为工程边框与定位角，保留主题反转与荧光悬停。
- 验证：前端构建成功，3 个文件共 23 项测试通过；实看宽屏浅色/深色列表、项目页及手机阅读；手机无溢出。
- 独立评审发现阅读/编辑宽容器需独立计算外侧边缘，已修复。

## 2026-10-02 主题下拉组件
- 新增 ThemeSelect，文章分类/标签/年份筛选及复用 FilterBar 的页面统一为细线主题菜单；按上下文主题反转，荧光绿活动项、勾选状态、可滚动长列表。
- 支持方向键、Home/End、Enter/Space、Esc/Tab、外部点击关闭及焦点返回，菜单对辅助技术暴露正确的组合框/列表选中状态。
- 首页搜索 autocomplete=off，抑制浏览器历史输入建议。
- 验证：构建成功；3 个测试文件、13 项测试通过。实际选择分类并确认 URL，查看明暗展开菜单、390px 标签长列表无横向溢出。
- 独立审查通过。截图：上级 design-deliverables/article-list/theme-dropdown.png。

## 2026-10-02 当前设计版本生产发布
- 用户明确授权发布当前版本到 Cloudflare。
- 生产项目 11，生产分支 main；使用直接构建发布，不推送混合工作区 Git。
- 构建和 Cloudflare 配置检查通过，Wrangler 上传前端资源及 Functions 完成。
- 部署 URL：https://d4081a8f.11-9tc.pages.dev；生产 URL：https://11-9tc.pages.dev。
- 验证生产 HTML 引用当前 JS/CSS，资源均 HTTP 200；公开文章 API HTTP 200；实际打开线上文章页并展开主题分类菜单，真实文章正常显示。
- 未迁移数据库、未修改密钥或附件。截图：上级 design-deliverables/article-list/cloudflare-production.png。

## 2026-10-02 工作台删除与回收站
- 用户选择可恢复删除：复用 archived 状态，增加单篇和批量删除二次确认；列出数量与标题，提示公开下架与恢复为草稿。
- 回收站支持单篇/批量恢复；正常列表显式 excludeArchived，D1 行查询和分页计数一致过滤，全部徽标排除回收站。
- 弹窗 portal 避免堆叠裁切，背景 inert、默认取消、键盘焦点锁定、提交锁和失败提示；主题令牌适配浅色/深色/手机。
- 重试删除再次确认，单项重试保留其余失败项；查询统一校正失效页码，删除或恢复末页均适用。
- 验证：前端29项相关测试、notes-api28项通过；Web构建和Functions类型检查通过；独立审查修复3项边界后通过。
- notes-route旧测试另有2项失败：发布SQL断言及旧Access拒绝码预期，属于此前发布/认证改动，未改动这两条测试。
- 视觉截图：上级 design-deliverables/delete-articles/confirm-light.png、confirm-dark.png、confirm-mobile.png。仅本地实现，本次未部署。

## 2026-10-03 图纸工作台首页与全站视觉对齐
- 按用户认可的 workbench-v3 预览直接精修首页：轴测分层芯片、键盘可切换展开/合拢、蓝色信号线、切角反色记录区、简化搜索与作者段落。
- 全站令牌统一暖纸色、墨绿色与工业蓝；页眉、表单、菜单、索引、分类、归档、搜索、关于、项目、登录及知识工作台共享控件对齐。项目目录改连续细线列表，保留数据/路由与正文阅读排版。
- 44项公开页面/登录/筛选/分层组件测试通过；此前首页相关34项通过。Web构建、改动TSX ESLint及diff检查通过。
- 扩展KnowledgeShell测试4通过2失败：旧置顶/编辑及归档按钮断言与此前菜单/回收站实现不符。本次未修改工作台业务组件。
- 独立代码审查修复当前分页亮绿底白字对比度；独立视觉审查完成，首页首屏截图滚动造成的页眉假遮挡已回顶部确认。
- 本地内容API 502显示原有缓存；知识库登录状态接口不可用，未验证登录后实际画面。桌面、手机、深浅主题截图保存在上级design-deliverables/workbench-v3/*final.jpg。
- 本次仅本地修改，预览http://127.0.0.1:5173/，未部署。
## 2026-10-03 全模块与编辑器精修
- 按用户明确确认的首页图纸风格统一全站按钮、表单、筛选、状态、列表、弹窗及知识库各模块，新增 workbench-ui.css 为共享控件样式入口，清除 signal.css 中旧 ID 控件覆盖。
- 编辑器标题可自动换行，保留单行值及 Enter 跳正文；侧栏开合和窗口尺寸变化重新计算高度。修复手机设置抽屉被页眉遮挡、双重滚动以及附件上传输入撑宽面板。
- 项目说明复用安全 Markdown 排版，消除源码直出和重复首行标题。
- 最终 Web 构建/类型检查、改动 TSX ESLint 和 diff 检查通过；17 个相关测试文件、92 项测试通过；中文改动源文件 UTF-8 BOM 已验证。
- 独立视觉评审指出手机标题与抽屉问题，已修复；独立代码评审指出桌面侧栏开合标题高度问题，已修复，浏览器高度与 scrollHeight 实测相等。
- 桌面浅深主题、390px 手机及各公开模块已实际查看；知识库使用实际组件与本地 fixture 验收，临时入口已清理。公开 API 本地 502，真实登录及服务端联动未验证。
- 截图与说明在上级 design-deliverables/module-polish/。仅本地修改，未部署、未推送。
## 2026-10-03 全模块精修 Cloudflare 生产发布
- 用户明确授权推送到 Cloudflare；沿用项目 11、生产分支 main，直接构建发布，未推送 Git。
- 配置检查及 Web 构建通过，Wrangler 成功上传前端和 Functions；部署 https://88eae771.11-9tc.pages.dev，生产 https://11-9tc.pages.dev。
- 生产 HTML 确认引用本次 index-7k4ELMM8.js 与 index-Bbioofvo.css，三个入口资源均 HTTP 200；/posts、/login HTTP 200；匿名 /api/notes HTTP 401。
- 匿名 /api/v1/posts HTTP 401，公开文章接口仍有鉴权限制；浏览器工具访问生产连续超时，未完成线上截图和登录后编辑器实看。
- 未执行数据库迁移、未修改密钥或附件。上一生产部署 ff21d063-361b-4e54-a253-5990bcbf8c92 可作为回滚点。

## 2026-10-03 图片粘贴与附件上传修复
- 状态：DONE_WITH_CONCERNS；当前分支 codex/draft-image-fixes；基础提交 92091a5e51ea06ea62982424277c238f7eb0974b；本次未提交或部署。
- 范围：KnowledgeEditorRoute、MarkdownDraft、clipboard-images、对应前端测试、shared Markdown 转换器及测试；保留此前工作区修改。
- 实现：Markdown/富文本图片粘贴自动上传；新文档上传前建立草稿并复用创建请求；上传失败保留文件与光标插入回调，支持重试和移除；Markdown 内私有图片语法转换为持久化 assetId；附件面板支持 Markdown 图片/PDF 正文引用。
- 异步保护：上传期间阻止手动保存/发布切页，保存/发布期间阻止新上传；多文件上传保留离开提醒；光标随输入变化映射，多图片替换选区不会互相覆盖；Markdown 创建页暂不开放历史版本操作。
- 验证：7 个前端相关测试文件 70 项通过；前端生产构建与类型检查、改动文件 ESLint、diff 检查通过；中文源文件 UTF-8 BOM。
- 独立审查：review_upload 只读审查，Specification compliance PASS，Code quality APPROVED；已关闭全部 Important 问题，无 Critical。
- 限制：共享全量测试 87/89 通过；notes-route 两项失败涉及发布 SQL mock 和匿名状态码 403/401，相关逻辑不属于本次改动。未验证生产登录后 R2 实际上传。
- 下一步：如用户授权上线，发布本次前端/Functions，再验证生产粘贴、保存、刷新与附件读取。
## 2026-10-03 文章加载性能检查与优化
- Status: DONE_WITH_CONCERNS；用户授权检查问题、给出建议并优化文章加载。当前 codex/draft-image-fixes 分支，保留原有工作区修改；未提交/推送/部署。
- Scope: dynamicContentSync、contentGateway 单篇生产分支、useContentQuery 同步开关、PostDetailPage 正文/导航独立加载、router 文章/项目详情按需加载及相关回归测试。报告：docs/article-performance-audit-2026-10-03.md。
- Behavior: 单篇生产文章直接按 slug 请求，不等待整站同步；正文不等待相邻导航；首次同步在途请求合并；分页失败不覆盖完整缓存；明确不存在时清除该 slug 动态缓存。
- Measurement: 本地生产入口 JS 1152.26 KB → 283.35 KB；gzip 354.12 KB → 90.16 KB（约减少 74.5%）。仅入口体积，未测线上加载时间/LCP。
- Verification: 相关 10 文件 77/77 PASS；生产 Web 构建 PASS；修改范围 ESLint PASS。前端全量 354/358，4 条失败为 KnowledgeShell 旧归档/控件预期 2 条、visual-contract 旧配色 1 条、TableOfContents 折叠筛选查询 1 条，范围外未修改。根 pnpm test 在 shared 阶段被此前记录的 notes-route 发布 SQL 和 Access 403/401 两条失败阻断。
- Independent review: explorer performance_review，Specification compliance PASS / Code quality and safety APPROVED；发现下架文章缓存回退边界，已修复并新增回归；独立测试 2/2 PASS。
- Evidence: 上级 article-performance-build-final.log、article-performance-scoped-final.log、article-performance-web-verification.log、article-performance-full-tests.log。
- Next suggestions: 列表/搜索改摘要索引与服务端正文搜索；按文章格式拆渲染器；限定高亮语言并按需加载公式；缓存需设计下架失效；增加请求超时与正文图片优化。未自动部署。
## 2026-10-03 性能优化版本生产发布
- 用户授权：“推送新版本”。沿用此前已确认的直接构建发布方式，不推送混合工作区 Git。
- Cloudflare Pages 项目 11，生产分支 main；部署 ID 80ae80d1；部署地址 https://80ae80d1.11-9tc.pages.dev；生产地址 https://11-9tc.pages.dev。
- 发布前生产版本 88eae771-517a-4022-be1b-7344cd966601，保留作为回滚参照。
- 验证：重新生产 Web 构建 PASS，Cloudflare 配置检查 PASS，Functions 类型检查 PASS；Wrangler Worker 编译和资源/Functions 上传成功。
- 线上只读检查：首页 200 且引用新 index-E0DOWqAk.js；该 JS 200；已发布文章地址 200；按 slug 查询公开文章接口成功且返回 1 条；匿名 /api/notes 401。
- 性能：入口 JS 283.35 KB，gzip 90.16 KB；单篇正文优先显示及同步请求合并已上线。未测线上 LCP；未执行数据库迁移或修改附件。
- 前一轮测试限制保持：相关77/77通过；4条前端范围外测试和2条shared旧测试失败已在性能检查报告列明。
- 构建证据：E:/AIblog/new-release-build.log。

## 2026-10-03 新建文档图片上传与系统性能深度优化（Phase 1 - Phase 3）
- 状态：DONE（所有已批准阶段完成，测试全部通过）；当前分支 `codex/draft-image-fixes`。
- 阶段执行记录：
  1. **Phase 1（测试契约修复与编辑器会话交接）**：
     - 修复 `notes-route.test.ts` 发布事务快照与 401 认证断言。
     - 修复 `visual-contract.test.ts`（工业蓝/青柠色）、`KnowledgeShell.test.tsx`（软删除确认流程）与 `TableOfContents.test.tsx`（移动端主题选择器抽屉交互）。
     - 实现 `KnowledgeEditorRoute` 会话交接（`editorHandoff`）：新建草稿粘贴/上传图片后，先创建草稿身份并上传 R2，插入图片引用并更新草稿，**强制 await 保存正文入库后再通过 Router replace 替换 URL**，保持 sessionKey 为 'new' 直至交接完成，完全杜绝组件卸载重挂、光标跳变或 Markdown 源码丢失。
     - 补齐 `knowledge-editor-handoff.test.tsx` 4 个端到端测试（富文本、Markdown、刷新恢复、上传拦截与重试）。
  2. **Phase 2（轻量摘要列表、单篇正文与服务端隔离搜索）**：
     - 在 `packages/shared/src/public-content.ts` 抽象 `PublicPostSummary`、`PublicPostDetail`、`PublicNeighborPost`、`PublicPostNeighbors`。
     - 重构 `functions/api/public/posts.ts`：列表仅读摘要元数据与正文长度（省略大体积 `published_content_json` 和正文）；详情传 `slug` 单独加载正文与完整 AST。
     - 实现 `functions/api/public/search.ts`：严格限定已发布快照全文 LIKE 搜索，避免向客户端同步全量正文。
     - 实现 `functions/api/public/neighbors.ts`：基于 `published_at DESC, meta.slug DESC` 稳定排序键与日期比较，O(1) 检索相邻文章。
     - 改造 `dynamicContentSync.ts` 与 `contentGateway.ts`：生产模式下搜索直连 `/api/public/search`，相邻文章直连 `/api/public/neighbors`，均保持静默静态回退。
  3. **Phase 3（双渲染器按需拆分、正文图片懒加载与请求超时韧性）**：
     - 创建 `headingExtractor.ts`：保留完整的 unified/remark AST 解析逻辑，将目录提取与大型渲染器解耦。
     - `PostDetailPage` 使用 `React.lazy` 与命名导出适配器按需动态引入 `MarkdownRenderer` 与 `TiptapRenderer`，并提供 Suspense 骨架占位。
     - 正文图片补全 `loading="lazy"` 与 `decoding="async"`；首屏封面图保持优先 `loading="eager"`。保留 C/C++ 等常用代码高亮支持。
     - 请求超时控制：在 `apiClient`、`dynamicContentSync` 与 `contentGateway` 引入基于 `AbortController` 的超时保护（默认 8-10s），精确区分 404 与网络失败/超时，并在 `useContentQuery` 中提供 `retry()` 机制。
- 最终产物与指标：
  - 前端生产构建通过，Vite 超过 500 kB 的大 chunk 警告彻底消除：`MarkdownRenderer` 从 593.02 KB 降至 478.36 KB（gzip 147.42 KB），`PostDetailPage` 仅 4.26 KB，`TiptapRenderer`（262.51 KB）按需加载。
  - `@namdw/shared`：11 个测试文件，105/105 全部 PASS。
  - `@namdw/web`：65 个测试文件，388/388 全部 PASS（此前遗留的 4 个失败与 shared 2 个失败全部彻底解决）。
  - 双包 TypeScript 类型检查 0 错误。

## 2026-10-03 优化版本生产部署
- 执行指令：`pnpm --filter @namdw/web build` && `wrangler pages deploy apps/web/dist --project-name 11 --branch main --commit-dirty=true`。
- 部署成功：本次部署 ID `42d4729a`，部署地址 https://42d4729a.11-9tc.pages.dev，生产域名 https://11-9tc.pages.dev。
- 生产环境验证：
  - 首页 HTTP 200。
  - 公共摘要列表接口 `/api/public/posts` HTTP 200，成功返回 3 篇已发布文章的轻量摘要数据。
  - 服务端搜索接口 `/api/public/search?q=ESP01S` HTTP 200，成功命中快照并返回对应摘要。
  - 相邻文章接口 `/api/public/neighbors?slug=...` HTTP 200，O(1) 成功返回相邻指针。