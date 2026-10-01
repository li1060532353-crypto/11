/**
 * Hero Decorative Blueprint Overlays
 *
 * Dedicated to Hero-specific engineering assets:
 * - Orthogonal circuit trace bus lines extending from the 3D IC package
 * - Swiss typographic calibration marks and CAD reference watermarks
 * - Section transition ruler ticks
 *
 * (The continuous 40px drafting grid itself is managed by DraftingGridBackdrop at page level)
 */
export function EngineeringGridBackdrop() {
  return (
    <div className="editorial-hero__backdrop" aria-hidden="true">
      <svg
        className="editorial-hero__backdrop-svg"
        viewBox="0 0 1440 600"
        preserveAspectRatio="xMidYMin slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Orthogonal Circuit Bus Traces (Interconnect Routing from 3D IC) */}
        <g
          className="editorial-hero__traces"
          stroke="var(--color-accent, #0071e3)"
          fill="none"
        >
          {/* Upper bus line emerging from the 3D IC package to the left */}
          <path
            d="M 1340,90 L 980,90 L 950,130 L 520,130 L 490,160 L 80,160"
            strokeWidth="1"
            strokeDasharray="4 6"
            strokeOpacity="0.18"
          />
          <circle cx="950" cy="130" r="2.5" fill="var(--color-accent, #0071e3)" fillOpacity="0.3" />
          <circle cx="490" cy="160" r="2.5" fill="var(--color-accent, #0071e3)" fillOpacity="0.3" />

          {/* Lower interconnect bus line */}
          <path
            d="M 1380,380 L 1020,380 L 980,420 L 640,420 L 610,460 L 120,460"
            strokeWidth="1"
            strokeDasharray="8 6"
            strokeOpacity="0.14"
          />
          <circle cx="980" cy="420" r="2.5" fill="var(--color-accent, #0071e3)" fillOpacity="0.25" />
          <circle cx="610" cy="460" r="2.5" fill="var(--color-accent, #0071e3)" fillOpacity="0.25" />

          {/* Vertical architectural layout guide lines */}
          <line
            x1="120"
            y1="40"
            x2="120"
            y2="520"
            stroke="currentColor"
            strokeWidth="0.5"
            strokeDasharray="2 4"
            strokeOpacity="0.08"
          />
          <line
            x1="760"
            y1="40"
            x2="760"
            y2="520"
            stroke="currentColor"
            strokeWidth="0.5"
            strokeDasharray="2 4"
            strokeOpacity="0.06"
          />
        </g>

        {/* Engineering Drafting Fiducials and Annotations */}
        <g
          className="editorial-hero__fiducials"
          fill="currentColor"
          fontFamily="var(--font-mono, monospace)"
          fontSize="9"
          letterSpacing="0.08em"
          opacity="0.38"
        >
          {/* Top-left registration bracket */}
          <path
            d="M 40,24 L 40,32 L 32,32 M 40,32 L 52,32 M 40,32 L 40,44"
            stroke="currentColor"
            strokeWidth="1"
            fill="none"
          />
          <text x="58" y="32" dominantBaseline="middle">
            CAD_REF: 0x00 // SYSTEM_ARCHITECTURE
          </text>

          {/* Top-right micro-spec tag */}
          <text x="1400" y="32" textAnchor="end" dominantBaseline="middle">
            SCALE 1:1 · TSV_PITCH 10µm
          </text>

          {/* Bottom baseline tick ruler along section divider */}
          <line
            x1="40"
            y1="599"
            x2="1400"
            y2="599"
            stroke="currentColor"
            strokeWidth="0.75"
            strokeOpacity="0.15"
          />
          <path
            d="M 80,593 L 80,599 M 160,595 L 160,599 M 240,593 L 240,599 M 320,595 L 320,599 M 400,593 L 400,599 M 480,595 L 480,599 M 560,593 L 560,599 M 640,595 L 640,599 M 720,593 L 720,599 M 800,595 L 800,599 M 880,593 L 880,599 M 960,595 L 960,599 M 1040,593 L 1040,599 M 1120,595 L 1120,599 M 1200,593 L 1200,599 M 1280,595 L 1280,599 M 1360,593 L 1360,599"
            stroke="currentColor"
            strokeWidth="0.75"
            strokeOpacity="0.2"
          />
          <text x="80" y="586" dominantBaseline="auto">
            00
          </text>
          <text x="400" y="586" dominantBaseline="auto">
            100mm
          </text>
          <text x="800" y="586" dominantBaseline="auto">
            200mm
          </text>
          <text x="1200" y="586" dominantBaseline="auto">
            300mm
          </text>
        </g>
      </svg>
    </div>
  );
}
