/** Decorative signal paths stay inside the outer page gutters. */
export function PageSignalFrame({ reading = false }: { reading?: boolean }) {
  return (
    <div className={`page-signal-frame${reading ? ' page-signal-frame--reading' : ''}`} aria-hidden="true">
      {['left', 'right'].map((side) => (
        <div className={`page-signal-frame__side page-signal-frame__side--${side}`} key={side}>
          <svg viewBox="0 0 160 760" preserveAspectRatio="none" fill="none">
            <g className="page-signal-frame__guide" strokeWidth="1">
              <path d="M18 22h18M18 22v18M142 714h-18M142 714v-18" />
              <path d="M26 94v134l32 32v184l-24 24v176" strokeDasharray="3 7" />
            </g>
            <g className="page-signal-frame__trace" strokeWidth="1.25">
              <path d="M0 142h54l28 28v108l28 28h50" />
              <path d="M0 536h34l24-24h42l26 26v70l22 22h12" strokeDasharray="5 7" />
              <circle cx="82" cy="170" r="3" />
              <circle cx="110" cy="306" r="3" />
              <circle cx="100" cy="512" r="3" />
            </g>
            <g className="page-signal-frame__node">
              <circle cx="54" cy="142" r="3" />
              <circle cx="126" cy="608" r="3" />
            </g>
          </svg>
        </div>
      ))}
    </div>
  );
}
