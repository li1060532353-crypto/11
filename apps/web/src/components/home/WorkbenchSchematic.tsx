import { useId, useState } from 'react';

/** A vector drawing with a reversible, keyboard-accessible layer transition. */
export function WorkbenchSchematic() {
  const [exploded, setExploded] = useState(true);
  const patternId = useId().replace(/:/g, '');
  return (
    <figure className="editorial-hero__visual workbench-drawing" data-exploded={exploded}>
      <div className="workbench-drawing__canvas">
        <svg className="workbench-drawing__svg" viewBox="0 0 900 690" fill="none" role="img" aria-label="芯片分层结构图">
          <desc>计算芯片、互连层与封装基板的轴测结构。使用分层展开按钮切换展开与合拢视图。</desc>
          <defs>
            <pattern id={patternId} width="14" height="14" patternUnits="userSpaceOnUse">
              <circle cx="7" cy="7" r="1.4" fill="var(--drawing-ink)" opacity=".55" />
            </pattern>
          </defs>
          <g className="workbench-drawing__guides" stroke="var(--drawing-rule)" strokeWidth=".8">
            <ellipse cx="452" cy="426" rx="330" ry="161" />
            <path d="M70 415H865M450 45V642M158 520 786 188M192 590 833 265" strokeDasharray="3 8" />
            <path d="M145 90h18m-9-9v18M803 564h18m-9-9v18" />
          </g>
          <g stroke="var(--drawing-ink)" strokeWidth="1.2">
            <path d="M166 419 495 246 817 420 488 594Z" fill="var(--drawing-plane)" />
            <path d="M166 419V437L488 612 817 438V420L488 594Z" fill="var(--drawing-edge)" />
            <path d="M488 594V612" />
            <path d="M190 420 495 261 792 420 488 578Z" fill={`url(#${patternId})`} />
          </g>
          <g className="workbench-drawing__routes" stroke="var(--home-blue)" strokeWidth="1.5">
            <path className="workbench-drawing__trace" pathLength="1" d="M52 457H153L336 553 484 475 620 547" />
            <path className="workbench-drawing__trace" pathLength="1" d="M52 441H153L336 538 484 459 650 548" />
            <path className="workbench-drawing__trace" pathLength="1" d="M278 395 445 307 657 423 737 464H856" />
            <path className="workbench-drawing__trace" pathLength="1" d="M278 412 445 324 656 439 736 480H856" />
            <path d="M354 515V538M394 492V515M435 471V493M476 449V472" opacity=".55" />
          </g>
          <g className="workbench-drawing__layer workbench-drawing__layer--middle">
            <g stroke="var(--drawing-ink)" strokeWidth="1.2">
              <path d="M220 337 500 189 750 324 470 474Z" fill="var(--drawing-plane)" />
              <path d="M220 337V351L470 487 750 338V324L470 474Z" fill="var(--drawing-edge)" />
              <path d="M470 474V487" />
              <path d="M245 335 502 201 726 324 469 460Z" fill={`url(#${patternId})`} />
            </g>
            <g stroke="var(--home-blue)" strokeWidth="1.3">
              <path className="workbench-drawing__trace" pathLength="1" d="M272 337 393 273 547 356 461 402 362 349M298 352 394 302 521 371" />
              <path className="workbench-drawing__trace" pathLength="1" d="M542 255 652 315 569 360M526 269 624 322 554 361" />
            </g>
          </g>
          <g className="workbench-drawing__connectors" stroke="var(--drawing-ink)" strokeWidth=".8" strokeDasharray="3 6" opacity=".6">
            <path d="M300 234V380M488 137V290M665 234V377M477 335V477" />
          </g>
          <g className="workbench-drawing__layer workbench-drawing__layer--top" stroke="var(--home-blue)" strokeWidth="1.5">
            <path d="M300 213 488 115 665 213 477 315Z" fill="var(--drawing-plane)" />
            <path d="M300 213V234L477 335 665 234V213L477 315Z" fill="var(--drawing-edge)" />
            <path d="M477 315V335M321 214 488 128 643 213 477 302Z" />
            <path d="M349 211 488 140 619 213 479 287Z" strokeWidth=".7" />
            {Array.from({ length: 13 }, (_, i) => (
              <path key={i} d={`M${319 + i * 12} ${225 + i * 6.5}v7M${498 + i * 12} ${304 - i * 6.5}v7`} strokeWidth="1" />
            ))}
            <g stroke="none" textAnchor="middle" fontFamily="var(--font-mono, monospace)">
              <text x="482" y="211" fontSize="29" fill="var(--home-blue)">CPU</text>
              <text x="482" y="236" fontSize="10" letterSpacing="1" fill="var(--drawing-ink)">COMPUTE LOGIC</text>
            </g>
          </g>
          <g className="workbench-drawing__callouts" stroke="var(--drawing-ink)" strokeWidth=".8">
            <path d="M584 151 723 88H848M716 332 774 293H848M672 514 748 575H848" />
            <g fill="var(--home-blue)" stroke="none"><circle cx="584" cy="151" r="3" /><circle cx="716" cy="332" r="3" /><circle cx="672" cy="514" r="3" /></g>
            <g stroke="none" fill="var(--drawing-ink)" fontFamily="var(--font-mono, monospace)" fontSize="11" letterSpacing=".7">
              <text x="725" y="77">01 / COMPUTE</text><text x="764" y="282">02 / ROUTING</text><text x="750" y="564">03 / PACKAGE</text>
              <text x="52" y="427" fontSize="9">SIGNAL IN</text><text x="749" y="501" fontSize="9">SYSTEM OUT</text>
            </g>
          </g>
          <g stroke="var(--drawing-ink)" strokeWidth=".8"><path d="M137 606v-27m0 27 25 12m-25-12-24 13" /></g>
          <g fill="var(--drawing-ink)" fontFamily="var(--font-mono, monospace)" fontSize="9"><text x="133" y="572">Z</text><text x="166" y="626">X</text><text x="100" y="628">Y</text></g>
        </svg>
      </div>
      <figcaption className="workbench-drawing__caption">
        <span>芯片 · 互连 · 封装<span className="workbench-drawing__caption-en" aria-hidden="true"> / EXPLODED VIEW</span></span>
        <button type="button" className="workbench-drawing__toggle" aria-pressed={exploded} onClick={() => setExploded((value) => !value)}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true"><path d="m2 7 8-4 8 4-8 4Z M2 11l8 4 8-4M2 15l8 4 8-4" /></svg>
          分层展开
        </button>
      </figcaption>
    </figure>
  );
}
