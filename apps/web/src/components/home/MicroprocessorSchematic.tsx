export function MicroprocessorSchematic() {
  return (
    <svg
      className="schematic-svg"
      viewBox="0 0 540 366"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="3D IC 异构集成与系统总线架构图"
    >
      <title>3D IC 异构集成与系统总线架构图</title>
      <desc>
        展示 Compute Logic、HBM3e 内存堆叠、微引脚 TSV 与 2.5D Silicon Interposer 的精密微架构拓扑图
      </desc>

      {/* Alignment Brackets & Technical Framing */}
      <path
        d="M 10 22 L 10 10 L 22 10"
        stroke="var(--color-muted, #6e6e73)"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
      <path
        d="M 518 10 L 530 10 L 530 22"
        stroke="var(--color-muted, #6e6e73)"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
      <path
        d="M 10 344 L 10 356 L 22 356"
        stroke="var(--color-muted, #6e6e73)"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
      <path
        d="M 518 356 L 530 356 L 530 344"
        stroke="var(--color-muted, #6e6e73)"
        strokeWidth="1.5"
        strokeLinecap="square"
      />

      {/* Header Annotation Bar */}
      <text
        x="20"
        y="25"
        fontFamily="var(--font-mono, monospace)"
        fontSize="9"
        fontWeight="700"
        letterSpacing="0.08em"
        fill="var(--color-muted, #6e6e73)"
      >
        3D-IC HETEROGENEOUS PACKAGING · ARCH TOPOLOGY
      </text>
      <circle cx="452" cy="22" r="3.5" fill="var(--color-accent, #0071e3)" />
      <text
        x="462"
        y="25"
        fontFamily="var(--font-mono, monospace)"
        fontSize="9"
        fontWeight="600"
        letterSpacing="0.04em"
        fill="var(--color-accent, #0071e3)"
      >
        UCIe 32 GT/s
      </text>
      <line
        x1="20"
        y1="34"
        x2="520"
        y2="34"
        stroke="var(--color-border, rgba(0,0,0,0.1))"
        strokeWidth="1"
        strokeDasharray="2 3"
      />

      {/* ─────────────────────────────────────────────────────────────
          TOP TIER: Co-packaged Dies (Compute Logic + HBM3e)
          ───────────────────────────────────────────────────────────── */}

      {/* DIE 1: Compute Logic */}
      <rect
        x="36"
        y="50"
        width="220"
        height="128"
        rx="2"
        fill="var(--surface-raised, #ffffff)"
        stroke="var(--color-ink, #1d1d1f)"
        strokeWidth="1.5"
      />
      <rect
        x="36"
        y="50"
        width="220"
        height="22"
        rx="2"
        fill="var(--surface-sunken, #e8e8ed)"
        stroke="var(--color-ink, #1d1d1f)"
        strokeWidth="1.5"
      />
      <text
        x="46"
        y="65"
        fontFamily="var(--font-mono, monospace)"
        fontSize="9.5"
        fontWeight="700"
        letterSpacing="0.04em"
        fill="var(--color-ink, #1d1d1f)"
      >
        COMPUTE LOGIC (CORE MATRIX)
      </text>
      <text
        x="218"
        y="65"
        fontFamily="var(--font-mono, monospace)"
        fontSize="8"
        fontWeight="600"
        fill="var(--color-accent, #0071e3)"
      >
        3nm GAA
      </text>

      {/* Vector ALU Sub-block */}
      <rect
        x="46"
        y="80"
        width="95"
        height="44"
        rx="1.5"
        fill="none"
        stroke="var(--color-border-strong, #8e8e93)"
        strokeWidth="1"
      />
      <text
        x="54"
        y="96"
        fontFamily="var(--font-mono, monospace)"
        fontSize="8"
        fontWeight="700"
        fill="var(--color-ink, #1d1d1f)"
      >
        VECTOR / ALU
      </text>
      <text
        x="54"
        y="112"
        fontFamily="var(--font-mono, monospace)"
        fontSize="7"
        fill="var(--color-muted, #6e6e73)"
      >
        SIMD 512-BIT
      </text>

      {/* L2/L3 Cache Sub-block */}
      <rect
        x="151"
        y="80"
        width="95"
        height="44"
        rx="1.5"
        fill="none"
        stroke="var(--color-border-strong, #8e8e93)"
        strokeWidth="1"
      />
      <text
        x="159"
        y="96"
        fontFamily="var(--font-mono, monospace)"
        fontSize="8"
        fontWeight="700"
        fill="var(--color-ink, #1d1d1f)"
      >
        L2/L3 CACHE
      </text>
      <text
        x="159"
        y="112"
        fontFamily="var(--font-mono, monospace)"
        fontSize="7"
        fill="var(--color-muted, #6e6e73)"
      >
        32MB SRAM
      </text>

      {/* Bus Interface & PHY */}
      <rect
        x="46"
        y="132"
        width="200"
        height="36"
        rx="1.5"
        fill="none"
        stroke="var(--color-accent, #0071e3)"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <text
        x="54"
        y="148"
        fontFamily="var(--font-mono, monospace)"
        fontSize="8"
        fontWeight="700"
        fill="var(--color-accent, #0071e3)"
      >
        AXI5 D2D PHY &amp; ROUTING UNIT
      </text>
      <text
        x="54"
        y="160"
        fontFamily="var(--font-mono, monospace)"
        fontSize="7"
        fill="var(--color-muted, #6e6e73)"
      >
        LOW-LATENCY BUS CROSSBAR
      </text>

      {/* DIE 2: HBM3e Memory Stack */}
      <rect
        x="284"
        y="50"
        width="220"
        height="128"
        rx="2"
        fill="var(--surface-raised, #ffffff)"
        stroke="var(--color-ink, #1d1d1f)"
        strokeWidth="1.5"
      />
      <rect
        x="284"
        y="50"
        width="220"
        height="22"
        rx="2"
        fill="var(--surface-sunken, #e8e8ed)"
        stroke="var(--color-ink, #1d1d1f)"
        strokeWidth="1.5"
      />
      <text
        x="294"
        y="65"
        fontFamily="var(--font-mono, monospace)"
        fontSize="9.5"
        fontWeight="700"
        letterSpacing="0.04em"
        fill="var(--color-ink, #1d1d1f)"
      >
        HBM3e MEMORY (8-HI STACK)
      </text>
      <text
        x="460"
        y="65"
        fontFamily="var(--font-mono, monospace)"
        fontSize="8"
        fontWeight="600"
        fill="var(--color-accent, #0071e3)"
      >
        1.2 TB/s
      </text>

      {/* 4 DRAM Stack Layers */}
      <rect
        x="294"
        y="78"
        width="200"
        height="18"
        rx="1"
        fill="none"
        stroke="var(--color-border-strong, #8e8e93)"
        strokeWidth="1"
      />
      <text
        x="302"
        y="91"
        fontFamily="var(--font-mono, monospace)"
        fontSize="7.5"
        fill="var(--color-ink, #1d1d1f)"
      >
        DRAM DIE 3 · 24Gb HIGH-SPEED CELL
      </text>

      <rect
        x="294"
        y="100"
        width="200"
        height="18"
        rx="1"
        fill="none"
        stroke="var(--color-border-strong, #8e8e93)"
        strokeWidth="1"
      />
      <text
        x="302"
        y="113"
        fontFamily="var(--font-mono, monospace)"
        fontSize="7.5"
        fill="var(--color-ink, #1d1d1f)"
      >
        DRAM DIE 2 · 24Gb HIGH-SPEED CELL
      </text>

      <rect
        x="294"
        y="122"
        width="200"
        height="18"
        rx="1"
        fill="none"
        stroke="var(--color-border-strong, #8e8e93)"
        strokeWidth="1"
      />
      <text
        x="302"
        y="135"
        fontFamily="var(--font-mono, monospace)"
        fontSize="7.5"
        fill="var(--color-ink, #1d1d1f)"
      >
        DRAM DIE 1 · 24Gb HIGH-SPEED CELL
      </text>

      {/* HBM Base Logic Die */}
      <rect
        x="294"
        y="144"
        width="200"
        height="24"
        rx="1"
        fill="none"
        stroke="var(--color-accent, #0071e3)"
        strokeWidth="1"
      />
      <text
        x="302"
        y="159"
        fontFamily="var(--font-mono, monospace)"
        fontSize="7.5"
        fontWeight="700"
        fill="var(--color-accent, #0071e3)"
      >
        HBM CONTROLLER &amp; TEST LOGIC
      </text>

      {/* ─────────────────────────────────────────────────────────────
          MICRO-BUMPS (Die-to-Interposer micro-pins)
          ───────────────────────────────────────────────────────────── */}
      {Array.from({ length: 11 }).map((_, i) => (
        <line
          key={`ubump-c-${i}`}
          x1={46 + i * 20}
          y1="178"
          x2={46 + i * 20}
          y2="190"
          stroke="var(--color-ink, #1d1d1f)"
          strokeWidth="1.5"
        />
      ))}
      {Array.from({ length: 11 }).map((_, i) => (
        <line
          key={`ubump-h-${i}`}
          x1={294 + i * 20}
          y1="178"
          x2={294 + i * 20}
          y2="190"
          stroke="var(--color-ink, #1d1d1f)"
          strokeWidth="1.5"
        />
      ))}

      {/* ─────────────────────────────────────────────────────────────
          MIDDLE TIER: Silicon Interposer (2.5D RDL Layer)
          ───────────────────────────────────────────────────────────── */}
      <rect
        x="24"
        y="190"
        width="492"
        height="64"
        rx="2"
        fill="var(--surface-sunken, #f0f0f4)"
        stroke="var(--color-ink, #1d1d1f)"
        strokeWidth="1.5"
      />

      <text
        x="34"
        y="207"
        fontFamily="var(--font-mono, monospace)"
        fontSize="8.5"
        fontWeight="700"
        letterSpacing="0.06em"
        fill="var(--color-ink, #1d1d1f)"
      >
        SILICON INTERPOSER (CoWoS HIGH-DENSITY RDL)
      </text>

      {/* High-speed RDL interconnect bus traces between Compute & HBM */}
      <path
        d="M 180 190 L 180 220 L 360 220 L 360 190"
        stroke="var(--color-accent, #0071e3)"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M 195 190 L 195 227 L 345 227 L 345 190"
        stroke="var(--color-accent, #0071e3)"
        strokeWidth="1.5"
        strokeDasharray="3 2"
        fill="none"
      />
      <circle cx="270" cy="220" r="3" fill="var(--color-accent, #0071e3)" />
      <text
        x="270"
        y="215"
        fontFamily="var(--font-mono, monospace)"
        fontSize="8"
        fontWeight="700"
        fill="var(--color-accent, #0071e3)"
        textAnchor="middle"
      >
        UCIe / AXI5 BUS CHANNEL
      </text>

      {/* Through-Silicon Vias (TSVs) Penetrating Interposer */}
      {[55, 80, 105, 130, 410, 435, 460, 485].map((x) => (
        <g key={`tsv-${x}`}>
          <line
            x1={x}
            y1="190"
            x2={x}
            y2="254"
            stroke="var(--color-ink, #1d1d1f)"
            strokeWidth="2"
          />
          <circle cx={x} cy="254" r="1.5" fill="var(--color-ink, #1d1d1f)" />
        </g>
      ))}

      <text
        x="92"
        y="246"
        fontFamily="var(--font-mono, monospace)"
        fontSize="7.5"
        fontWeight="600"
        fill="var(--color-muted, #6e6e73)"
      >
        TSV ARRAY (25μm PITCH)
      </text>
      <text
        x="448"
        y="246"
        fontFamily="var(--font-mono, monospace)"
        fontSize="7.5"
        fontWeight="600"
        fill="var(--color-muted, #6e6e73)"
        textAnchor="middle"
      >
        POWER / GND VIAS
      </text>

      {/* C4 Bumps connecting Interposer to Package Substrate */}
      {Array.from({ length: 21 }).map((_, i) => (
        <line
          key={`c4-${i}`}
          x1={34 + i * 23.5}
          y1="254"
          x2={34 + i * 23.5}
          y2="266"
          stroke="var(--color-ink, #1d1d1f)"
          strokeWidth="1.5"
        />
      ))}

      {/* ─────────────────────────────────────────────────────────────
          BOTTOM TIER: Organic Package Substrate & BGA
          ───────────────────────────────────────────────────────────── */}
      <rect
        x="12"
        y="266"
        width="516"
        height="42"
        rx="2"
        fill="var(--surface-raised, #ffffff)"
        stroke="var(--color-ink, #1d1d1f)"
        strokeWidth="1.5"
      />
      <text
        x="24"
        y="284"
        fontFamily="var(--font-mono, monospace)"
        fontSize="8.5"
        fontWeight="700"
        letterSpacing="0.04em"
        fill="var(--color-ink, #1d1d1f)"
      >
        ORGANIC PACKAGE SUBSTRATE
      </text>
      <text
        x="24"
        y="298"
        fontFamily="var(--font-mono, monospace)"
        fontSize="7.5"
        fill="var(--color-muted, #6e6e73)"
      >
        MULTI-LAYER CORE ROUTING
      </text>

      <text
        x="516"
        y="284"
        fontFamily="var(--font-mono, monospace)"
        fontSize="8"
        fill="var(--color-muted, #6e6e73)"
        textAnchor="end"
      >
        SYSTEM I/O: PCIe 5.0 · CXL 3.0 · DDR/LPDDR
      </text>
      <text
        x="516"
        y="298"
        fontFamily="var(--font-mono, monospace)"
        fontSize="7.5"
        fontWeight="600"
        fill="var(--color-accent, #0071e3)"
        textAnchor="end"
      >
        SIGNAL INTEGRITY: &gt; 99.8%
      </text>

      {/* Ball Grid Array (BGA) */}
      {Array.from({ length: 16 }).map((_, i) => (
        <circle
          key={`bga-${i}`}
          cx={28 + i * 32.2}
          cy="320"
          r="6"
          stroke="var(--color-ink, #1d1d1f)"
          strokeWidth="1"
          fill="none"
        />
      ))}

      {/* Bottom Technical Spec Label */}
      <text
        x="270"
        y="342"
        fontFamily="var(--font-mono, monospace)"
        fontSize="8"
        fontWeight="600"
        letterSpacing="0.08em"
        fill="var(--color-muted, #6e6e73)"
        textAnchor="middle"
      >
        BALL GRID ARRAY (BGA) · 1.0mm PITCH SYSTEM CONTACTS
      </text>
    </svg>
  );
}
