# Gemini 多代理执行方案：博客与知识库操作逻辑重构

日期：2026-10-01
项目：E:/AIblog/personal-blog-source
状态：执行方案草案；本文件未启动 Gemini、未创建执行工作区、未修改业务代码。
范围：阅读返回、文章管理、新建与编辑、草稿与发布、版本恢复、导入与附件反馈。
目标：以完整用户流程组织后台，保留现有 React/Vite、Tiptap、Cloudflare Pages Functions、D1、私有 R2 和 Cloudflare Access。
本方案中的角色、并发上限、任务状态和关卡均为项目约定，不是 Gemini 内置配置项。

## 1. 执行方式

推荐混合模式：
- 主控 Gemini 会话调度设计、契约分析和独立审查子代理。
- 写代码的代理各自运行在独立 Git worktree 和独立 Gemini 会话中。
- 主控只在集成工作区串行接收提交、处理共享文件、执行整合验证。
- 每波最多 3 个工作代理同时运行；主控作为第 4 个活动会话。角色可多于并发槽位。
- 设计、接口分析、验收用例设计可以同时开始；同一接口的定义和消费实现不能未经冻结就同时修改。
- 不把“独立上下文”当成文件系统隔离，也不假定原生子代理自动获得独立 worktree。

Gemini 官方能力：
- 自定义代理使用 .gemini/agents/*.md，YAML frontmatter 定义名称、描述及工具等字段。
- GEMINI.md 用于项目上下文；先检查已有文件，合并补充，不覆盖。
- 安装版本必须先用 gemini --version、gemini --help 和代理清单核验；本方案未检查本机 Gemini。
- 原生代理不可用时，使用独立终端中的 Gemini 会话和任务卡，仍可执行相同流程。
- 模型使用账号当前可用选项，不写死未经验证的模型 ID；主控记录实际模型，不能声称使用不可用模型。

## 2. 必须读取的上下文与基线

所有代理读取：
1. AGENTS.md。
2. docs/codex-master-spec.md。
3. .codex/progress.md（已有进度记录，不重复已完成任务）。
4. 本轮经确认的产品规格、接口契约、自己的任务卡。
5. 明确分配的源码及测试；不盲目继承其他代理全部聊天。

主控建立 BASE_SHA 前必须：
- 确认实际仓库是嵌套项目，不在 E:/AIblog 外层仓库误操作。
- 记录 git status、当前分支、最近提交、已跟踪和未跟踪业务文件清单。
- 当前仓库存在大量未提交修改。先保留原始差异和必要未跟踪文件，排除秘密、依赖目录、缓存和本地数据库。
- 在任务分支准备经核对的完整基线提交；禁止 git add . 不加审查地提交全部文件。
- 不直接用当前 HEAD 创建工作区后声称包含用户现有改动；普通 worktree 不会复制未提交内容。
- 不自动清理、重置或覆盖用户修改；已有本地环境数据留在原处。
- 记录基线测试的失败，区分本次回归和既有失败；与改动相关的既有失败必须解决或明确阻塞。
- 分支统一 codex/ 前缀。记录每个工作区绝对路径、分支、基线 SHA、服务端口与数据库位置。

例：nav、admin、editor 三个实现工作区；它们都从同一份经过确认的契约基线派生。
工作区端口可分配 8791、8792、8793，集成为 8788；启动前检查占用。
Wrangler 本地 D1/R2 状态必须隔离；不得把多个工作区连到同一份可变测试数据库。
含中文的新文档和源码使用 UTF-8 BOM。Gemini 代理定义若使用英文可用普通 UTF-8，使 frontmatter 从 --- 开始。

## 3. 角色与独立性

| 角色 | 主要职责 | 交付物 | 禁止事项 |
| --- | --- | --- | --- |
| C 主控/集成 | 保存基线、分派任务、冻结契约、接收提交、维护进度 | tasks.md、contracts.md、integration.md | 不以代理口头结论代替证据，不自动部署 |
| D 交互设计 | 阅读导航、后台信息结构、编辑工作台、响应式及失败状态 | ux-spec.md、逐页状态表、操作流 | 不改产品代码，不自行增加大型模块 |
| A 数据与接口设计 | 草稿/发布快照、API、缓存、版本和迁移约束 | data-api-spec.md、契约候选及兼容策略 | 不在冻结前改共享类型或数据库 |
| Q 验收设计/规格审查 | 独立从用户目标推导验收场景，评审 D/A 方案 | acceptance.md、需求到证据映射 | 不照抄实现逻辑编验收，不批准自己实现的功能 |
| B 后端实现 | 数据迁移、状态流转、校验、并发保护和 API 测试 | 后端提交、迁移验证、接口证据 | 不改 UI，不改 Access 边界 |
| N 阅读导航实现 | 来源返回、滚动恢复、阅读页动作 | 导航组件/页面提交、导航测试 | 不改编辑保存逻辑 |
| M 管理界面实现 | 后台壳层、列表筛选、状态页签和管理操作 | 管理 UI 提交、列表测试 | 不改编辑器、后端或全局设计 token |
| E 编辑器实现 | 编辑工作台、工具栏、保存/发布交互、离开保护 | 编辑器提交、状态及竞态测试 | 不自行更改已冻结 API |
| R 代码质量/数据安全审查 | 独立审查差异、并发、迁移、鉴权、数据完整性 | code-review.md，含严重度与证据 | 不边修边批准；问题交还文件负责人 |
| V 浏览器验收 | 在集成版本验证完整流程、视觉和可访问性 | browser-report.md、截图、复现记录 | 不用截图替代交互验证，不把未运行写成通过 |

D/A/Q 是设计阶段 3 个并行代理。实现阶段按波次复用槽位，不同时启动全部角色。
Q、R、V 验收自身未实现的内容。修复后必须复核最终提交。
审查给出两个独立结论：规格符合性，以及代码质量/安全性。

## 4. 设计规范与冻结交付

D 必须描述：
- 阅读区与后台的入口、导航、返回目标、列表状态恢复。
- 后台：概览、文章管理、导入；未实现的模块不展示可点击假入口。
- 编辑：固定操作栏、标题与正文主区、右侧设置、移动设置抽屉。
- 保存中、保存失败、加载失败、无权限、不存在、空列表、无搜索结果各自行为。
- 中文术语一致；现有私有访问语义下不写“公开文章”。
- 桌面与移动的按钮优先级、键盘操作、焦点返回和可见状态。

A 必须明确：
- 编辑内容仍以 content_json 为唯一可编辑正文来源。
- 独立发布快照；普通自动保存不改变发布快照。
- 首次发布、更新发布、撤回、归档、恢复为草稿的状态转换。
- 发布请求针对确定的草稿修订；请求期间的新编辑不能被发布响应覆盖。
- 旧客户端、已有 published 内容、既有 slug 和静态文章的兼容方式。
- 发布快照与状态变更的原子性；异常中断不能出现发布一半的状态。
- 显式版本快照与发布快照是不同用途，普通自动保存不创建手动版本。
- 恢复历史前保存当前内容及保护快照；任一步失败必须中止恢复。
- 读 API 只从已发布内容投影；撤回与归档后的详情缓存清理。
- 保留原 API 成功/错误 envelope 和后端权限验证。
- 迁移本地验证、数据回填、回滚/前滚策略；不在生产执行迁移。

C 合并后的 contracts.md 必须冻结：
- 需求 ID、路由、URL 查询参数、来源返回数据格式。
- returnTo 仅允许明确支持的站内路径，直接访问无来源时使用稳定兜底。
- 列表筛选、分页、排序参数及服务端语义。
- 编辑器组件 props、回调、保存状态及发布状态。
- API 请求/响应、错误码、并发修订字段、发布事务边界。
- 缓存失效触发点及静态文章/动态文章的管理边界。
- 每个文件唯一负责人、合并顺序、验收负责人。
- 契约版本号及基线 SHA。

产品规格确定后再冻结技术契约。涉及用户尚未确认的产品语义由主控集中提出，不允许各代理分别反复询问用户。
接口冻结后如需变更，提交 CR 变更单，列明原因、消费者、兼容方案、测试影响；只暂停受影响任务，其他独立任务继续。

## 5. 波次和并行顺序

Wave 0：主控串行建立基线
- 只检查和保存当前状态、测试基线、建立任务账本。
- 出口 G0：BASE_SHA 能重现用户当前业务代码；所有未保存差异有归属。

Wave 1：D + A + Q 并行
- D 设计界面和操作流。
- A 设计持久化、发布和迁移。
- Q 同时从需求准备验收，收到 D/A 产物后交叉评审。
- C 消解矛盾，形成产品规格和技术契约。
- 出口 G1：产品设计经用户确认；契约经过独立评审且无阻塞问题。
- 设计规格审阅和实施计划选择遵守已生效的仓库工作流；不得把本执行方案当成所有产品细节已获批准。

Wave 2：B + N + M 并行
- B 实现 schema → shared types → API；这条链内部串行。
- N 实现阅读返回和滚动策略，按冻结接口开发。
- M 实现列表和后台壳层，依赖冻结适配接口，用边界 fixture 验证呈现。
- 本波 M 不擅改后端、共享客户端；fixture 通过只能算组件通过。
- 出口 G2：各任务独立审查通过；C 按 B → 客户端适配 → N → M 接收提交。
- 共享客户端由 C 串行实现/调整并验证真实接口，再接通 M。

Wave 3：E + Q/R + 独立后续任务并行
- E 在 G2 基线上实现编辑工作台、发布交互和离开保护。
- Q/R 审查已合并的导航、管理、后端；不把审查旧 SHA 当作最终验收。
- 独立后续任务可处理导入读取失败/重试，仅在文件和接口无交叉时分派。
- 版本恢复逻辑由 E 唯一负责；附件编辑整合也由 E 负责，不另开代理竞争该文件。
- 出口 G3：全部目标流程接通真实本地 Functions，失败与竞态场景验证。

Wave 4：C 串行集成 → Q + R + V 并行验收
- C 固定 CANDIDATE_SHA，准备独立的审查工作区和测试数据。
- Q 验规格与验收映射；R 审代码与数据安全；V 跑浏览器操作。
- 各验收代理面向同一 SHA；各自拥有独立数据库/浏览器状态。
- 有修复则生成新候选，重跑受影响场景及最终集成检查；记录未受影响证据可复用的理由。
- 出口 G4：规格 PASS、代码安全 PASS、浏览器 PASS，且集成检查通过。
- 生产部署仍是单独授权动作，不由子代理自行执行。

## 6. 文件归属

工作区隔离不能替代文件归属。以下范围在发任务时落实到精确文件列表：

- N：PostDetailPage.tsx、KnowledgeNoteReadRoute.tsx、useScrollToTop.ts，以及新增 reading-navigation 模块和专属测试/CSS。
- M：KnowledgeShell.tsx、NotesPage.tsx、KnowledgeNotesRoute.tsx、DashboardPage.tsx、KnowledgeDashboardRoute.tsx 和专属测试/CSS。
- E：EditorPage.tsx、KnowledgeEditorRoute.tsx、useNoteAutosave.ts、AssetPanel.tsx、editor-fixtures.ts 和编辑专属测试/CSS。
- B：指定 migrations 新文件、functions/lib/notes.ts、functions/api/notes/ 下的实现、指定 shared 类型和后端测试。
- 导入代理（可选后续任务）：KnowledgeImportRoute.tsx 及专属测试；如需 shared Markdown 解析器改动，先提出变更。
- C 独占：router.tsx、App.tsx、共享 knowledge-api.ts/knowledge-adapter.ts、content gateway/cache 集成、全局 CSS 导入、knowledge.css 冲突整合、package.json、pnpm-lock.yaml、共享 barrel exports。

CSS 约定：
- 尽量新增模块限定 CSS，避免所有代理同时改 knowledge.css。
- 全局 tokens 保持稳定；如必须修改，交 C 统一处理。
- 每位代理只提交本任务允许文件，不格式化全仓、不回退他人代码。

## 7. 验收矩阵

| ID | 场景 | 必须观察到的结果 |
| --- | --- | --- |
| NAV-01 | 搜索第 2 页打开文章再返回 | 搜索词、页码、筛选与原滚动位置恢复 |
| NAV-02 | 连续读上一篇/下一篇后返回 | 回到最初来源列表，避免文章间循环 |
| NAV-03 | 新标签直接打开详情 | 返回稳定列表，不跳到站外 |
| NAV-04 | 编辑进入预览再返回 | 当前编辑草稿、光标/滚动按规格保留 |
| LIST-01 | 改筛选、刷新、浏览器前进后退 | URL 与界面、请求一致 |
| LIST-02 | 搜索无结果 | 显示搜索空状态，可清除筛选 |
| LIST-03 | 当前页最后一项归档 | 页码自动回退或按契约重载，不留假空页 |
| LIST-04 | 批量操作部分失败 | 每项结果准确，失败项可重试，无假全成功 |
| EDIT-01 | 新建输入后站内离开/关闭页面 | 未保存保护生效；选择留下后内容完整 |
| EDIT-02 | 保存期间继续输入 | 旧响应不覆盖新文本，保存状态与最新修订一致 |
| EDIT-03 | 断网后保存失败 | 编辑内容保留，可重试，不假报已保存 |
| EDIT-04 | 连点保存新文章/发布 | 不重复创建，不产生乱序发布 |
| PUB-01 | 修改已发布文章，等待自动保存 | 阅读区仍显示旧发布版本 |
| PUB-02 | 明确更新发布 | 阅读区、列表、搜索、首页读取一致的新版本 |
| PUB-03 | 撤回/归档后访问旧链接 | 按私有站内规格不可再读取已撤回发布内容，旧缓存不泄露 |
| PUB-04 | 恢复归档文章 | 恢复为草稿，不自动重新发布 |
| VER-01 | 保护保存/快照失败后恢复版本 | 恢复停止，当前编辑内容不被覆盖 |
| VER-02 | 成功恢复旧版本 | 可追溯恢复前内容，自动保存不额外制造手动快照 |
| IMP-01 | 文件读取失败、导入部分失败 | 单项错误明确，其他项继续，重试不重复成功项 |
| ASSET-01 | 附件加载/上传/下载失败 | 显示对应错误和重试，正文继续可编辑 |
| DATA-01 | 旧 published 数据迁移 | 内容、slug 与原访问行为按兼容规格保留 |
| AUTH-01 | 非授权请求与生产配置 | Access 边界未放宽；不把本地 bypass 当生产验证 |
| UI-01 | 1440、1024、390、320 宽度 | 主操作可用，无页面级横向溢出；表格/代码允许局部滚动 |
| UI-02 | 键盘操作、抽屉和对话框 | 焦点可见、可关闭且返回触发点，状态可被辅助技术感知 |

证据要求：
- 每条记录 requirement_id、candidate_sha、环境、前置数据、实际操作、预期、实际、结果和证据路径。
- 用例是用户行为或 API 契约，不得只断言某个内部函数被调用。
- 浏览器必须验证真实本地 Functions；纯 mock 测试不能证明数据库或上传集成正确。
- 需要截图的关键状态：管理列表、桌面编辑器、移动设置抽屉、保存失败、发布完成。
- 未执行写 NOT_RUN；环境阻塞写 BLOCKED。不得写 PASS 或 DONE。
- 独立浏览器验收不可用时报告缺口，不把 build 通过等同于交互验收。

最终项目检查（依仓库当时实际脚本运行并记录退出码）：
- pnpm cloudflare:verify-config
- pnpm typecheck
- pnpm lint
- pnpm test
- pnpm build
- pnpm exec tsc -p functions/tsconfig.json --noEmit
- git diff --check
- 本地 D1 migration、Functions 启动、真实接口 smoke
每项由 C 在最终集成基线上执行；无需让每位代理重复跑完整套件。
代码分支局部检查由文件负责人执行。生产 Access、部署和生产数据迁移不在本轮自动执行范围。

## 8. 任务卡与交接格式

每个任务卡必须完整填写，不能只给“优化 UI”一句话：

task_id:
role:
objective:
requirement_ids:
base_sha:
contract_version:
workspace_absolute_path:
branch:
allowed_files:
forbidden_files:
input_documents:
dependencies:
acceptance_ids:
required_checks:
artifact_directory:
stop_conditions:
handoff_to:

统一约束：
“你不是唯一在项目中工作的代理。仅修改 allowed_files；不要回退、覆盖或整理其他人的改动。需要越界修改时提交变更请求。不要自行安装依赖、修改锁文件、修改鉴权、连接生产库或部署。问题必须附证据，完成必须附实际测试结果。”

交接报告：
- task_id / role / actual_model
- base_sha / head_sha / contract_version
- changed_files
- requirements_implemented
- commands / exit_codes / evidence_paths
- known_failures / limitations
- required_consumer_changes
- proposed_status
- next_owner

任务账本使用明确状态：
READY → RUNNING → NEEDS_REVIEW → VERIFIED → INTEGRATED。
BLOCKED 必须给阻塞原因和可解除条件。
这是任务调度状态；映射到 .codex/progress.md 时保留该文件既有状态词，由 C 唯一更新。

## 9. 可交给 Gemini 主控的启动提示词

你是此项目的多代理主控。按本文件推进，不要求用户逐个指挥子代理。
先读取 AGENTS.md、docs/codex-master-spec.md、.codex/progress.md，并检查当前 Git 状态。
保留所有现有业务改动，建立可复现基线，不从遗漏未提交内容的 HEAD 开始实现。
本次目标是规范并重构文章返回、后台文章管理、编辑器与草稿发布流程。

先并行调用 3 个设计角色：
D：交互设计，输出逐页流程、状态和响应式规格。
A：数据/API 设计，输出发布快照、并发、迁移与兼容契约。
Q：独立验收设计，输出需求编号、行为用例和证据要求。

由你合并成一致规格，集中解决分歧并完成设计评审；未经确认不要开始产品实现。
设计与契约冻结后，按本文件波次并行实现。每个写代码的代理使用独立 worktree 和精确文件白名单。
只允许你处理共享文件、依赖锁文件、契约版本和集成。
不得让实现代理自验自批。规格审查、代码安全审查和浏览器验收使用独立角色。
验收同一候选 SHA；修复后更新候选和证据。没有运行的检查必须标记 NOT_RUN。
持续更新任务状态，优先继续不受阻塞的工作；重要产品歧义集中提问。
不要部署、不推默认分支、不运行生产数据迁移、不改变 Cloudflare Access 私有权限。
最终交付变更摘要、提交、验证证据、遗留问题、回滚位置和待用户操作。

## 10. Gemini 自定义只读审查代理示例

下面是配置示例，不是已安装代理。按安装版本验证工具名。
保存为 .gemini/agents/spec-reviewer.md 时，可保留以下全英文内容：

---
name: spec-reviewer
description: Independently review product specifications and acceptance coverage.
kind: local
tools:
  - read_file
  - grep_search
max_turns: 24
timeout_mins: 12
---

Review only the supplied candidate specification and source paths.
Map every user requirement to behavior, failure handling and acceptance evidence.
Report contradictions, missing states and unverifiable claims.
Do not edit product files, execute shell commands, or approve your own implementation.
Return separate Specification Compliance and Code Quality/Safety verdicts.
If source or runtime evidence is insufficient, state NOT_VERIFIED rather than PASS.
For each finding provide severity, requirement ID, file reference and acceptance impact.

D/A 可使用类似只读代理定义，职责分别替换为交互和数据契约。
实现代理不应直接继承无限工具权限来弥补工作区隔离；用独立会话、最小工具和实际策略限制。
提示词白名单属于协作规范，不是操作系统级安全边界。

## 11. 官方资料

以下资料于 2026-10-01 检索；安装版能力仍需本机核验：
- Subagents: https://geminicli.com/docs/core/subagents/
- Parallel subagents: https://developers.googleblog.com/en/subagents-have-arrived-in-gemini-cli/
- Git worktrees: https://geminicli.com/docs/cli/git-worktrees/
- GEMINI.md: https://geminicli.com/docs/cli/gemini-md/
- Headless mode: https://geminicli.com/docs/cli/headless/
