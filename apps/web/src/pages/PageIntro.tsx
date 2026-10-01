import type { ReactNode } from 'react';

import { Container } from '../components/ui/Container';

type PageIntroProps = {
  title: string;
  description: string;
  eyebrow?: string;
  action?: ReactNode;
};

export function PageIntro({ title, description, eyebrow, action }: PageIntroProps) {
  return (
    <section className="page-intro">
      <div className="page-intro__backdrop" aria-hidden="true">
        <svg
          className="page-intro__backdrop-svg"
          viewBox="0 0 1440 260"
          preserveAspectRatio="xMidYMin slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Subtle horizontal bus trace */}
          <g stroke="var(--color-accent, #0071e3)" fill="none">
            <path
              d="M 1400,60 L 1050,60 L 1020,95 L 420,95 L 390,130 L 40,130"
              strokeWidth="0.75"
              strokeDasharray="4 6"
              strokeOpacity="0.14"
            />
            <circle cx="1020" cy="95" r="2" fill="var(--color-accent, #0071e3)" fillOpacity="0.25" />
            <circle cx="390" cy="130" r="2" fill="var(--color-accent, #0071e3)" fillOpacity="0.25" />
          </g>
          {/* Corner Fiducials & CAD Reference */}
          <g
            fill="currentColor"
            fontFamily="var(--font-mono, monospace)"
            fontSize="9"
            letterSpacing="0.08em"
            opacity="0.35"
          >
            <path
              d="M 40,16 L 40,24 L 32,24 M 40,24 L 48,24 M 40,24 L 40,32"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
            />
            <text x="54" y="24" dominantBaseline="auto">
              CAD_REF: 0x00 // SECTION_VIEW
            </text>
            <text x="1400" y="24" textAnchor="end" dominantBaseline="auto">
              INDEX_REF · SCALE 1:1
            </text>
            <line
              x1="40"
              y1="259"
              x2="1400"
              y2="259"
              stroke="currentColor"
              strokeWidth="0.5"
              strokeOpacity="0.15"
            />
          </g>
        </svg>
      </div>
      <Container className="page-intro__inner">
        <div className="page-intro__content">
          {eyebrow ? <p className="page-intro__eyebrow">{eyebrow}</p> : null}
          <h1>{title}</h1>
          <p className="page-intro__description">{description}</p>
        </div>
        {action ? <div className="page-intro__action">{action}</div> : null}
      </Container>
    </section>
  );
}
