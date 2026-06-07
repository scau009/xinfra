// Terminal brutalist logo — renders the favicon SVG inline
// The "> █" prompt + cursor block, scalable via size prop

export default function Logo({ size = 24, animate = false }) {
  const w = 32;
  const h = 32;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${w} ${h}`}
      width={size}
      height={size}
      style={{ display:'block', flexShrink:0 }}
      aria-label="Plat"
    >
      <rect width={w} height={h} fill="var(--bg,#050505)" rx="0" />
      <g stroke="rgba(255,255,255,0.04)" strokeWidth="0.5">
        <line x1="8"  y1="0"  x2="8"  y2={h} />
        <line x1="16" y1="0"  x2="16" y2={h} />
        <line x1="24" y1="0"  x2="24" y2={h} />
        <line x1="0"  y1="8"  x2={w} y2="8"  />
        <line x1="0"  y1="16" x2={w} y2="16" />
        <line x1="0"  y1="24" x2={w} y2="24" />
      </g>
      <polyline
        points="8,10 20,16 8,22"
        fill="none"
        stroke="var(--text,#ffffff)"
        strokeWidth="4"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <rect
        x="24" y="9" width="3.5" height="14"
        fill="var(--text,#ffffff)"
        style={{ animation: animate ? 'blink 1s step-end infinite' : 'none' }}
      />
    </svg>
  );
}
