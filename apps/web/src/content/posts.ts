import type { Post } from './types';

export const posts = [
  {
    slug: 'stm32-esp01s',
    title: 'STM32 与 ESP-01S 的可靠联网实践',
    summary: '从串口初始化、AT 指令状态机到重连策略，为低成本嵌入式节点建立稳定的 Wi-Fi 通道。',
    body: `# STM32 与 ESP-01S 的可靠联网实践

ESP-01S 适合把传感器节点快速接入局域网，但前提是把串口通信视为会超时、会丢包的异步协议。

## 把 AT 通信建模为状态机

发送指令后，主控需要区分回显、阶段性应答和最终结果，避免把任意一行串口文本误判为成功。

\`\`\`c
static const char connectCommand[] = "AT+CWJAP=\\"ssid\\",\\"password\\"\\r\\n";
send_at_command(connectCommand, "WIFI CONNECTED", 10'000);
\`\`\`

### 用超时和重试完成恢复

将波特率 baudrate、应答关键字和重试次数集中管理，才能让故障恢复有迹可循。`,
    category: '嵌入式系统',
    tags: ['STM32', 'ESP8266', '物联网'],
    publishedAt: '2026-02-18T09:30:00.000Z',
    readingTime: 7,
    selected: false,
    cover: { alt: 'STM32 开发板与无线网络信号', tone: 'blue' },
  },
  {
    slug: 'smart-cold-chain-iotda',
    title: '智能冷链：从传感器到 IoTDA 的数据闭环',
    summary: '把温湿度、RFID 和告警规则串成可观测链路，让冷链仓储的每一次异常都有数据依据。',
    body: `# 智能冷链：从传感器到 IoTDA 的数据闭环

冷链系统的重点不是上传一次温度，而是让设备状态、货物身份和云端告警能够关联起来。

## 先统一设备与货物身份

每条遥测记录都携带设备编号和 RFID，使温湿度变化能够对应到具体仓位与货物批次。

\`\`\`json
{ "deviceId": "warehouse-01", "temperature": 3.8, "rfid": "E200001" }
\`\`\`

### 把告警放回业务链路

RFID 事件与温度曲线结合后，运维人员能够定位异常发生时的货物流转阶段。`,
    category: '嵌入式系统',
    tags: ['IoTDA', 'RFID', '冷链'],
    publishedAt: '2026-02-06T10:00:00.000Z',
    readingTime: 9,
    selected: false,
    cover: { alt: '冷链仓储数据仪表盘', tone: 'teal' },
    seoDescription: '智能冷链系统中传感器、RFID 与 IoTDA 的数据闭环设计。',
  },
  {
    slug: 'rsa-in-practice',
    title: 'RSA 在工程中的正确打开方式',
    summary: '从模幂运算到填充模式，理解为什么密码学实现必须把数学正确性延伸到协议边界。',
    body: `# RSA 在工程中的正确打开方式

RSA 的难点不只在大数计算，更在于密钥生命周期、随机填充和错误信息不能泄漏实现细节。

## 从数学公式走向协议边界

模幂关系说明了加解密的数学基础，但不能单独提供消息完整性、随机性或抗选择密文攻击能力。

\`\`\`text
c = m^e mod n
m = c^d mod n
\`\`\`

### 让审计过的库承担实现细节

工程实现应选择经过审计的库与 OAEP 等现代填充方案，而不是直接对明文做模幂。`,
    category: '密码学',
    tags: ['RSA', '信息安全', '密码学'],
    publishedAt: '2026-01-12T08:20:00.000Z',
    readingTime: 8,
    selected: false,
    cover: { alt: '密钥与加密数据流', tone: 'violet' },
  },
  {
    slug: 'matrix-rank',
    title: '从秩理解矩阵的结构',
    summary: '把满秩从结论还原成列向量独立、线性映射与解空间之间的联系。',
    body: `# 从秩理解矩阵的结构

矩阵的秩描述了线性变换真正保留下来的独立方向，因此也是判断方程组自由度的关键。

## 秩表示保留下来的维度

把列向量看作变换后的基方向，秩就是这些方向中能够独立张成空间的数量。

\`\`\`text
rank(A) = dim(column space of A)
\`\`\`

### 用解空间检查结论

当列向量线性无关时，秩达到列数；这让我们能从几何角度理解唯一解与无穷多解。`,
    category: '线性代数',
    tags: ['线性代数', '矩阵', '数学基础'],
    publishedAt: '2025-12-22T11:00:00.000Z',
    readingTime: 6,
    selected: true,
    cover: { alt: '矩阵变换的网格', tone: 'orange' },
  },
  {
    slug: 'discrete-convolution',
    title: '从卷积公式理解离散系统的响应',
    summary: '从单位冲激分解出发，理解每一个输入样本如何共同构成当前输出。',
    body: `# 从卷积公式理解离散系统的响应

离散卷积把输入的每一个历史样本按系统冲激响应加权叠加，因此能直接解释 LTI 系统的响应。

## 从冲激响应出发

把输入分解成移位单位冲激后，每个样本都会产生一份缩放、移位后的系统响应。

\`\`\`text
y[n] = Σ x[k]h[n-k]
\`\`\`

### 用索引表检查求和

把索引移动画成表格后，响应的来源会比死记公式更清晰。`,
    category: '信号与系统',
    tags: ['信号与系统', '离散时间', '卷积'],
    publishedAt: '2025-12-08T07:45:00.000Z',
    readingTime: 8,
    selected: true,
    cover: { alt: '离散信号的卷积曲线', tone: 'blue' },
    seoTitle: '离散卷积与系统响应',
  },
  {
    slug: 'signal-period-analysis',
    title: '周期信号分析的三个检查点',
    summary: '用频率比、有理数条件和最小公倍数，避免在连续与离散周期判断中混淆概念。',
    body: `# 周期信号分析的三个检查点

分析信号周期时，先区分连续时间与离散时间，再检查频率比是否满足可重复条件。

## 先区分连续与离散时间

连续信号要求存在实数周期，而离散序列的平移量必须是正整数，两者不能直接套用同一判断。

\`\`\`text
x[n] = cos(ω₀n) 在 ω₀ / 2π 为有理数时才是周期序列
\`\`\`

### 再求各分量的共同周期

对多个分量求共同周期，本质上是在寻找它们周期长度的最小公倍数。`,
    category: '信号与系统',
    tags: ['信号与系统', '周期信号', '傅里叶分析'],
    publishedAt: '2025-11-18T12:15:00.000Z',
    readingTime: 5,
    selected: false,
    cover: { alt: '周期信号波形', tone: 'teal' },
  },
] as const satisfies readonly Post[];
