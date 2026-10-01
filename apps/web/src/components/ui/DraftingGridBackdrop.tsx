/**
 * Continuous Drafting Grid Backdrop
 *
 * Lightweight, 1:1 CSS pixel-accurate CAD drafting grid.
 * Guarantees exactly 40px grid pitch across all screen resolutions (no viewBox distortion).
 * Carries zero decorative illustrations, text, or IDs to allow continuous page-level rendering.
 */
export function DraftingGridBackdrop({ className = '' }: { className?: string }) {
  return (
    <div className={`drafting-grid-backdrop ${className}`} aria-hidden="true">
      <svg
        className="drafting-grid-backdrop__svg"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="cad-subgrid"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 8 0 L 0 0 0 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              strokeOpacity="0.02"
            />
          </pattern>
          <pattern
            id="cad-grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <rect width="40" height="40" fill="url(#cad-subgrid)" />
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.75"
              strokeOpacity="0.035"
            />
            <circle cx="0" cy="0" r="1" fill="currentColor" fillOpacity="0.1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cad-grid)" />
      </svg>
    </div>
  );
}
