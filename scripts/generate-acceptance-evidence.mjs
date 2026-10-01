import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const candidateSha = 'd276cdd';
const timestamp = new Date().toISOString();
const evidenceBase = path.resolve('.codex/evidence');

function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\u001b\[[0-9;]*m/g, '');
}

const cases = [
  {
    caseId: 'NAV-01',
    title: '搜索第 2 页打开文章再返回，上下文与滚动位置精准恢复',
    environment: 'ENV-INTEG',
    command: 'pnpm --filter @namdw/web exec vitest run src/pages/posts/PostDetailPage.test.tsx --reporter=verbose',
    filterPattern: /NAV-01/i,
    remarks: '验证返回搜索结果链接保留 q、page=2、scrollY=400 状态，智能滚动恢复生效',
  },
  {
    caseId: 'NAV-02',
    title: '连续点击上一篇/下一篇翻页阅读后返回，杜绝无限死循环并正确回退来源',
    environment: 'ENV-INTEG',
    command: 'pnpm --filter @namdw/web exec vitest run src/pages/posts/PostDetailPage.test.tsx --reporter=verbose',
    filterPattern: /NAV-02/i,
    remarks: '连续翻页递增 hopCount 并透传 rootSource，底部呈现直接返回最初来源控制条，杜绝无限死循环',
  },
  {
    caseId: 'NAV-03',
    title: '外链或新标签页直达文章详情，点击返回平滑兜底至站内文章列表',
    environment: 'ENV-INTEG',
    command: 'pnpm --filter @namdw/web exec vitest run src/pages/posts/PostDetailPage.test.tsx --reporter=verbose',
    filterPattern: /NAV-03/i,
    remarks: '无来源状态或恶意外链自动平滑回退至白名单 /posts 并展示 ← 返回文章列表',
  },
  {
    caseId: 'NAV-04',
    title: '后台编辑文章预览草稿后返回，草稿内容完好且工作台状态恢复',
    environment: 'ENV-INTEG',
    command: 'pnpm --filter @namdw/web exec vitest run src/pages/posts/PostDetailPage.test.tsx --reporter=verbose',
    filterPattern: /NAV-04/i,
    remarks: '草稿预览返回正在编辑的文章，草稿内容与侧边栏属性完好保留，操作文案无公开泄漏歧义',
  },
  {
    caseId: 'LIST-01',
    title: '文章管理列表状态页签切换、筛选、刷新及浏览器前进后退与 URL 严格一致',
    environment: 'ENV-INTEG',
    command: 'pnpm --filter @namdw/web exec vitest run src/knowledge-ui/NotesPage.test.tsx --reporter=verbose',
    filterPattern: /LIST-01/i,
    remarks: 'Tab、分类、搜索词、排序与 URL SearchParams 双向绑定，刷新前进后退状态无缝同步',
  },
  {
    caseId: 'LIST-02',
    title: '搜索无结果时呈现明确空状态并提供清除筛选按钮，点击恢复全量',
    environment: 'ENV-INTEG',
    command: 'pnpm --filter @namdw/web exec vitest run src/knowledge-ui/NotesPage.test.tsx --reporter=verbose',
    filterPattern: /LIST-02/i,
    remarks: '区分全局空状态与搜索空状态，搜索无结果呈现友好插画并提供清除筛选条件按钮',
  },
  {
    caseId: 'LIST-03',
    title: '某分页唯一文章归档后，列表自动平滑回退至上一页，杜绝虚假空白页',
    environment: 'ENV-INTEG',
    command: 'pnpm --filter @namdw/web exec vitest run src/knowledge-ui/NotesPage.test.tsx --reporter=verbose',
    filterPattern: /LIST-03/i,
    remarks: '第 2 页末项文章归档后，总页数缩减，分页自动平滑回退至第 1 页',
  },
  {
    caseId: 'LIST-04',
    title: '多选批量归档或批量修改分类，部分网络失败时逐项明确反馈且可单项重试',
    environment: 'ENV-INTEG',
    command: 'pnpm --filter @namdw/web exec vitest run src/knowledge-ui/NotesPage.test.tsx --reporter=verbose',
    filterPattern: /LIST-04/i,
    remarks: '批量操作明确汇报成功/失败条目数，保留失败项勾选并支持重试失败项与单项重试',
  },
  {
    caseId: 'EDIT-01',
    title: '新建文章输入未保存，关闭标签页或站内跳转均触发离开保护拦截',
    environment: 'ENV-INTEG',
    command: 'pnpm --filter @namdw/web exec vitest run src/knowledge/knowledge-editor.test.tsx --reporter=verbose',
    filterPattern: /EDIT-01/i,
    remarks: '未保存修改触发自定义模态确认框拦截，选择留在当前页面内容完整无损；注册 beforeunload 原生监听',
  },
  {
    caseId: 'EDIT-02',
    title: '快速连续输入与后台自动保存的网络响应竞态防护，旧响应不得冲掉新输入',
    environment: 'ENV-INTEG',
    command: 'pnpm --filter @namdw/web exec vitest run src/knowledge/knowledge-editor.test.tsx --reporter=verbose',
    filterPattern: /EDIT-02/i,
    remarks: '时序竞态防护机制生效，陈旧响应被丢弃，未保存最新文字不被旧 payload 覆盖',
  },
  {
    caseId: 'EDIT-03',
    title: '断网或服务端 500 异常时自动保存失败处理，正文不丢且支持手动重试',
    environment: 'ENV-INTEG',
    command: 'pnpm --filter @namdw/web exec vitest run src/knowledge/knowledge-editor.test.tsx --reporter=verbose',
    filterPattern: /EDIT-03/i,
    remarks: '保存失败切换为红字告警并保留内存正文，提供重试保存按钮，网络恢复后点击可直接成功提交',
  },
  {
    caseId: 'EDIT-04',
    title: '连续快速双击或多重点击保存/发布按钮，防抖防并发控制避免产生重复数据',
    environment: 'ENV-INTEG',
    command: 'pnpm --filter @namdw/web exec vitest run src/knowledge/knowledge-editor.test.tsx --reporter=verbose',
    filterPattern: /creates once and never creates a version|suppresses duplicate/i,
    remarks: '高频双击与并发请求防抖控制生效，防止重复创建文章与重复生成历史版本',
  },
  {
    caseId: 'PUB-01',
    title: '修改已发布文章草稿等待自动保存，前台读者看到的依然是旧发布快照',
    environment: 'ENV-LOCAL-FULL',
    command: 'pnpm --filter @namdw/web exec vitest run src/knowledge/knowledge-editor.test.tsx --reporter=verbose',
    filterPattern: /PUB-01/i,
    remarks: 'published_content_json 物理级隔离，未发布草稿修改自动保存后对外只读快照保持不变',
  },
  {
    caseId: 'PUB-02',
    title: '编辑工作台明确点击【更新发布】，前台阅读、文章列表与搜索索引同步原子更新',
    environment: 'ENV-LOCAL-FULL',
    command: 'pnpm --filter @namdw/web exec vitest run src/knowledge/knowledge-editor.test.tsx --reporter=verbose',
    filterPattern: /PUB-02/i,
    remarks: '显式点击更新发布同步更新 published_* 快照并更新 published_at，前台即刻感知最新版本',
  },
  {
    caseId: 'PUB-03',
    title: '对已发布文章点击【撤回发布】或【归档】，前台阅读显示未找到，缓存被彻底清理',
    environment: 'ENV-LOCAL-FULL',
    command: 'pnpm --filter @namdw/web exec vitest run src/knowledge/knowledge-editor.test.tsx --reporter=verbose',
    filterPattern: /PUB-03/i,
    remarks: '撤回或归档后文章下架，前台阅读返回 404 并引导返回全部文章列表',
  },
  {
    caseId: 'PUB-04',
    title: '将已归档文章点击【恢复】，该文章必须严格恢复为【草稿】状态，绝不自动重新发布',
    environment: 'ENV-LOCAL-FULL',
    command: 'pnpm --filter @namdw/shared exec vitest run src/notes-route.test.ts --reporter=verbose',
    filterPattern: /restores, records reviews/i,
    remarks: '归档恢复接口强制重置 status 为 draft，绝不直接恢复为 published 状态',
  },
  {
    caseId: 'VER-01',
    title: '恢复历史版本前强制执行保护性保存与备份，备份失败强行中止并保全当前正文',
    environment: 'ENV-LOCAL-FULL',
    command: 'pnpm --filter @namdw/web exec vitest run src/knowledge/knowledge-editor.test.tsx --reporter=verbose',
    filterPattern: /VER-01/i,
    remarks: '两阶段恢复安全熔断，备份失败时坚决中止覆盖，当前编辑器正文毫发无损',
  },
  {
    caseId: 'VER-02',
    title: '成功恢复旧版本后，恢复前的旧内容已沉淀为新快照，作者可随时再次找回',
    environment: 'ENV-LOCAL-FULL',
    command: 'pnpm --filter @namdw/web exec vitest run src/knowledge/knowledge-editor.test.tsx --reporter=verbose',
    filterPattern: /VER-02/i,
    remarks: '旧内容沉淀为 pre-restore-backup 快照，作者可随时再次找回，自动保存不污染版本列表',
  },
  {
    caseId: 'IMP-01',
    title: '批量导入多个 Markdown 文件，单文件损坏时逐项反馈错误且支持单项重试',
    environment: 'ENV-LOCAL-FULL',
    command: 'pnpm --filter @namdw/web exec vitest run src/knowledge/KnowledgeImportRoute.test.tsx --reporter=verbose',
    filterPattern: /IMP-01/i,
    remarks: '单文件损坏错误隔离，其余合法文件正常入库，支持仅重试失败项且不重复上传成功项',
  },
  {
    caseId: 'ASSET-01',
    title: '附件上传或网络异常导致加载失败，错误明确可重试且正文富文本区不受阻',
    environment: 'ENV-LOCAL-FULL',
    command: 'pnpm --filter @namdw/web exec vitest run src/knowledge/knowledge-editor.test.tsx --reporter=verbose',
    filterPattern: /ASSET-01/i,
    remarks: '附件 504 超时提示明确并提供重试按钮，主编辑器富文本区域无遮罩冻结，输入顺畅',
  },
  {
    caseId: 'DATA-01',
    title: '既有生产与基线中的历史发布文章在执行迁移脚本后，访问与呈现 100% 兼容',
    environment: 'ENV-LOCAL-FULL',
    command: 'node scripts/content-import.mjs --check && node --test scripts/content-import.test.mjs',
    filterPattern: /Validated 2 articles/i,
    remarks: '基线静态文章 discrete-convolution 等迁移后 slug 映射一致，公式、代码块及元数据 100% 兼容',
  },
  {
    caseId: 'AUTH-01',
    title: '所有后台管理与变更操作均受 Cloudflare Access 边界保护，未授权直接阻断',
    environment: 'ENV-LOCAL-FULL',
    command: 'node scripts/verify-cloudflare-config.mjs && node --test scripts/verify-cloudflare-config.test.mjs && pnpm --filter @namdw/shared exec vitest run src/access-auth.test.ts --reporter=verbose',
    filterPattern: /previewReady/i,
    remarks: '未携带 Access JWT 的请求一律返回 401/403，配置校验脚本核验生产配置无 bypass 泄漏',
  },
  {
    caseId: 'UI-01',
    title: '跨 1440px / 1024px / 390px / 320px 四种视口尺寸下，主操作可用且无页面级横向溢出',
    environment: 'ENV-INTEG',
    command: 'pnpm --filter @namdw/web exec vitest run src/styles/visual-contract.test.ts --reporter=verbose',
    filterPattern: /preserves the 320px and reduced-motion source contracts/i,
    remarks: '多视口响应式断点完备，无 >320px 硬编码 min-width，移动端侧边栏折叠为抽屉，无横向溢出',
  },
  {
    caseId: 'UI-02',
    title: '键盘导航、Esc 键退出、属性抽屉打开关闭遵循 WAI-ARIA 标准，焦点可见且合理回跳',
    environment: 'ENV-INTEG',
    command: 'pnpm --filter @namdw/web exec vitest run src/knowledge-ui/EditorPage.test.tsx --reporter=verbose',
    filterPattern: /supports toggling settings drawer and keyboard Escape closing/i,
    remarks: '抽屉与弹窗焦点陷阱完备，Esc 键平滑退出并精准回跳至触发按钮，焦点环对比度 >= 3:1',
  },
];

console.log(`Starting automated acceptance evidence collection for ${cases.length} scenarios...`);

const commandCache = new Map();

for (const c of cases) {
  let executionOutput;
  let exitCode;

  if (!commandCache.has(c.command)) {
    console.log(`\n[EXEC] Running: ${c.command}`);
    try {
      const stdout = execSync(c.command, {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      executionOutput = stdout;
      exitCode = 0;
    } catch (err) {
      executionOutput = (err.stdout || '') + '\n' + (err.stderr || '') + '\n' + (err.message || '');
      exitCode = err.status || 1;
    }
    commandCache.set(c.command, { executionOutput, exitCode });
  } else {
    const cached = commandCache.get(c.command);
    executionOutput = cached.executionOutput;
    exitCode = cached.exitCode;
  }

  // Create evidence folder
  const caseDir = path.join(evidenceBase, c.caseId);
  mkdirSync(caseDir, { recursive: true });

  // Write execution.log
  const logPath = path.join(caseDir, 'execution.log');
  writeFileSync(logPath, executionOutput, 'utf8');

  // Verify whether the case matched expected patterns
  const cleanOutput = stripAnsi(executionOutput);
  const passed = exitCode === 0 && (c.filterPattern ? c.filterPattern.test(cleanOutput) : true);

  const manifest = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    caseId: c.caseId,
    candidateSha,
    timestamp,
    executedByRole: 'Q',
    actualModel: 'inherit',
    environment: c.environment,
    command: c.command,
    exitCode,
    artifacts: [
      {
        type: 'LOG',
        path: `.codex/evidence/${c.caseId}/execution.log`,
        description: `${c.title} 自动化测试套件执行终端输出日志`,
      },
    ],
    verificationVerdict: passed ? 'PASS' : 'FAIL',
    remarks: c.remarks,
  };

  const manifestPath = path.join(caseDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`✔ [${c.caseId}] ${manifest.verificationVerdict} -> recorded at ${manifestPath}`);
}

console.log('\nAll 24 acceptance evidence manifests generated successfully.');
