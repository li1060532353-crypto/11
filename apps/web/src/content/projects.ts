import type { Project } from './types';

export const projects = [
  {
    slug: 'smart-cold-chain',
    name: '智能冷链仓储系统',
    summary: '从传感器、RFID 到云端物联网平台，把嵌入式系统连接成可观察的完整链路。',
    body: `# 智能冷链仓储系统

系统采集仓储环境数据，并将货物识别、设备状态和告警策略汇聚到同一条可追溯链路。

\`\`\`text
传感器 → STM32 → IoTDA → 告警面板
\`\`\`
`,
    technologies: ['STM32', 'IoTDA', 'RFID'],
    selected: true,
  },
  {
    slug: 'embedded-observability',
    name: '嵌入式可观测性工具箱',
    summary: '为资源受限设备统一采样日志、指标和串口诊断，让现场问题可复现。',
    body: `# 嵌入式可观测性工具箱

工具箱以有限的 RAM 预算保存关键事件，并将调试数据编码为可传输的诊断帧。

\`\`\`c
emit_metric("heap_free", heap_free());
\`\`\`
`,
    technologies: ['C', 'FreeRTOS', 'UART'],
    selected: false,
    sourceUrl: 'https://github.com/',
  },
  {
    slug: 'personal-blog',
    name: '个人技术博客',
    summary: '面向工程学习笔记的静态内容站，强调检索、阅读体验与可维护的内容模型。',
    body: `# 个人技术博客

站点把静态文章放在严格类型边界之后，页面只消费稳定的查询结果。

\`\`\`text
内容记录 → 查询边界 → 阅读页面
\`\`\`
`,
    technologies: ['React', 'TypeScript', 'Vite'],
    selected: false,
  },
] as const satisfies readonly Project[];
