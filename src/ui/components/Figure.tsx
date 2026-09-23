import type { FigureSpec, NumberLineSpec, PlaneSpec, AnglesSpec, SectorSpec, SolidSpec, ProjectionSpec, ChartSpec } from '@/math/figure';

/**
 * 問題の図を SVG で描く(要件 F48)。
 * 色は CSS 変数(currentColor / --gold-2 / --ember)に任せ、テンプレートは形と数値だけを渡す。
 */
export function Figure({ spec }: { spec: FigureSpec }) {
  switch (spec.kind) {
    case 'numberline':
      return <NumberLine spec={spec} />;
    case 'plane':
      return <Plane spec={spec} />;
    case 'angles':
      return <Angles spec={spec} />;
    case 'sector':
      return <Sector spec={spec} />;
    case 'solid':
      return <Solid spec={spec} />;
    case 'projection':
      return <Projection spec={spec} />;
    case 'chart':
      return <Chart spec={spec} />;
  }
}

const ARROW = (
  <marker id="fig-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
    <path d="M0,0 L8,4 L0,8 z" fill="currentColor" />
  </marker>
);

// ---------------------------------------------------------------- 数直線

function NumberLine({ spec }: { spec: NumberLineSpec }) {
  const step = spec.step ?? 1;
  const W = 600;
  const H = 110;
  const padX = 30;
  const y = 58;
  const toX = (v: number) => padX + ((v - spec.min) / (spec.max - spec.min)) * (W - padX * 2);
  const ticks: number[] = [];
  for (let v = spec.min; v <= spec.max + 1e-9; v += step) ticks.push(Number(v.toFixed(6)));
  const labels = new Set(spec.labels ?? ticks.filter((v) => v === spec.min || v === spec.max || v === 0 || v % 5 === 0));

  return (
    <svg class="figure" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`数直線 ${spec.min} から ${spec.max}`}>
      <defs>{ARROW}</defs>
      <line x1={padX - 16} y1={y} x2={W - padX + 16} y2={y} stroke="currentColor" stroke-width="2" marker-end="url(#fig-arrow)" />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={toX(v)} y1={y - (v === 0 ? 10 : 6)} x2={toX(v)} y2={y + (v === 0 ? 10 : 6)} stroke="currentColor" stroke-width={v === 0 ? 2 : 1.2} />
          {labels.has(v) && (
            <text x={toX(v)} y={y + 26} text-anchor="middle" font-size="14" fill="currentColor">
              {v < 0 ? `−${-v}` : v}
            </text>
          )}
        </g>
      ))}
      {spec.arrows?.map((a, i) => {
        const x1 = toX(a.from);
        const x2 = toX(a.to);
        const ay = y - 26 - i * 14;
        return (
          <g key={`a${i}`}>
            <path d={`M${x1},${y - 12} V${ay} H${x2} V${y - 14}`} fill="none" stroke="var(--gold-2)" stroke-width="2" marker-end="url(#fig-arrow)" />
            {a.label && (
              <text x={(x1 + x2) / 2} y={ay - 4} text-anchor="middle" font-size="13" fill="var(--gold-2)">
                {a.label}
              </text>
            )}
          </g>
        );
      })}
      {spec.points.map((p) => (
        <g key={p.label}>
          <circle cx={toX(p.value)} cy={y} r="6" fill="var(--ember)" stroke="#fff" stroke-width="1.5" />
          <text x={toX(p.value)} y={y - 14} text-anchor="middle" font-size="16" font-weight="bold" fill="var(--ember)">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------- 座標平面

function Plane({ spec }: { spec: PlaneSpec }) {
  const R = spec.range ?? 6;
  const S = 360; // 1辺の長さ
  const c = S / 2;
  const unit = c / (R + 0.6);
  const px = (x: number) => c + x * unit;
  const py = (y: number) => c - y * unit;
  const ticks = Array.from({ length: 2 * R + 1 }, (_, i) => i - R).filter((v) => v !== 0);

  /** グラフの折れ線。反比例は x>0 と x<0 に分けて描く */
  function path(type: 'prop' | 'invprop', a: number): string[] {
    if (type === 'prop') {
      const x1 = -R;
      const x2 = R;
      return [`M${px(x1)},${py(a * x1)} L${px(x2)},${py(a * x2)}`];
    }
    const make = (sign: 1 | -1) => {
      const pts: string[] = [];
      for (let i = 0; i <= 60; i++) {
        const x = sign * (0.18 + (i / 60) * (R - 0.18));
        const y = a / x;
        if (Math.abs(y) > R + 0.5) continue;
        pts.push(`${pts.length === 0 ? 'M' : 'L'}${px(x)},${py(y)}`);
      }
      return pts.join(' ');
    };
    return [make(1), make(-1)].filter(Boolean);
  }

  return (
    <svg class="figure figure-square" viewBox={`0 0 ${S} ${S}`} role="img" aria-label="座標平面">
      <defs>{ARROW}</defs>
      {/* 格子 */}
      {ticks.map((v) => (
        <g key={`g${v}`} opacity="0.25">
          <line x1={px(v)} y1={py(-R)} x2={px(v)} y2={py(R)} stroke="currentColor" stroke-width="0.5" />
          <line x1={px(-R)} y1={py(v)} x2={px(R)} y2={py(v)} stroke="currentColor" stroke-width="0.5" />
        </g>
      ))}
      {/* 軸 */}
      <line x1={px(-R) - 8} y1={c} x2={px(R) + 10} y2={c} stroke="currentColor" stroke-width="1.6" marker-end="url(#fig-arrow)" />
      <line x1={c} y1={py(-R) + 8} x2={c} y2={py(R) - 10} stroke="currentColor" stroke-width="1.6" marker-end="url(#fig-arrow)" />
      <text x={px(R) + 6} y={c + 16} font-size="13" fill="currentColor">
        x
      </text>
      <text x={c + 8} y={py(R) - 6} font-size="13" fill="currentColor">
        y
      </text>
      <text x={c - 10} y={c + 14} font-size="12" fill="currentColor">
        O
      </text>
      {/* 目盛りの数字(5 の倍数と ±1 だけ、混み合わないように) */}
      {ticks
        .filter((v) => Math.abs(v) % 5 === 0 || Math.abs(v) === 1 || Math.abs(v) === R)
        .map((v) => (
          <g key={`t${v}`}>
            <text x={px(v)} y={c + 15} text-anchor="middle" font-size="11" fill="currentColor" opacity="0.8">
              {v < 0 ? `−${-v}` : v}
            </text>
            <text x={c - 6} y={py(v) + 4} text-anchor="end" font-size="11" fill="currentColor" opacity="0.8">
              {v < 0 ? `−${-v}` : v}
            </text>
          </g>
        ))}
      {/* グラフ */}
      {spec.graphs?.map((g, i) =>
        path(g.type, g.a).map((d, k) => <path key={`p${i}-${k}`} d={d} fill="none" stroke="var(--gold-2)" stroke-width="2.4" />),
      )}
      {/* 補助線 */}
      {spec.guides?.map((p, i) => (
        <g key={`gd${i}`} opacity="0.7">
          <line x1={px(p.x)} y1={c} x2={px(p.x)} y2={py(p.y)} stroke="var(--sky)" stroke-width="1.2" stroke-dasharray="4 3" />
          <line x1={c} y1={py(p.y)} x2={px(p.x)} y2={py(p.y)} stroke="var(--sky)" stroke-width="1.2" stroke-dasharray="4 3" />
        </g>
      ))}
      {/* 点 */}
      {spec.points?.map((p) => (
        <g key={p.label}>
          <circle cx={px(p.x)} cy={py(p.y)} r="5" fill="var(--ember)" stroke="#fff" stroke-width="1.4" />
          <text x={px(p.x) + 8} y={py(p.y) - 8} font-size="15" font-weight="bold" fill="var(--ember)">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------- 角

function Angles({ spec }: { spec: AnglesSpec }) {
  const S = 300;
  const c = S / 2;
  const L = 120;
  const pt = (deg: number, r = L) => [c + r * Math.cos((-deg * Math.PI) / 180), c + r * Math.sin((-deg * Math.PI) / 180)] as const;

  return (
    <svg class="figure figure-square" viewBox={`0 0 ${S} ${S}`} role="img" aria-label="角の図">
      {spec.rays.map((deg, i) => {
        const [x1, y1] = pt(deg);
        const [x2, y2] = spec.throughLines ? pt(deg + 180) : ([c, c] as const);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" stroke-width="2" />;
      })}
      {spec.marks.map((m, i) => {
        const a1 = spec.rays[m.from];
        const a2 = spec.rays[m.to];
        const r = 34 + i * 12;
        const [sx, sy] = pt(a1, r);
        const [ex, ey] = pt(a2, r);
        const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
        const mid = (a1 + a2) / 2;
        const [lx, ly] = pt(mid, r + 22);
        return (
          <g key={i}>
            <path d={`M${sx},${sy} A${r},${r} 0 ${large} 0 ${ex},${ey}`} fill="none" stroke="var(--gold-2)" stroke-width="2" />
            <text x={lx} y={ly + 5} text-anchor="middle" font-size="16" font-weight="bold" fill="var(--gold-2)">
              {m.label}
            </text>
          </g>
        );
      })}
      <circle cx={c} cy={c} r="3" fill="currentColor" />
    </svg>
  );
}

// ---------------------------------------------------------------- おうぎ形

function Sector({ spec }: { spec: SectorSpec }) {
  const S = 300;
  const c = S / 2;
  const r = 110;
  const angle = spec.angle ?? 120;
  const rad = (d: number) => (-d * Math.PI) / 180;
  const x2 = c + r * Math.cos(rad(angle));
  const y2 = c + r * Math.sin(rad(angle));
  const large = angle > 180 ? 1 : 0;
  const mid = angle / 2;

  return (
    <svg class="figure figure-square" viewBox={`0 0 ${S} ${S}`} role="img" aria-label="おうぎ形">
      <path d={`M${c},${c} L${c + r},${c} A${r},${r} 0 ${large} 0 ${x2},${y2} Z`} fill="rgba(230,194,92,0.15)" stroke="var(--gold-2)" stroke-width="2.4" />
      {/* 半径のラベル */}
      <text x={c + r / 2} y={c + 18} text-anchor="middle" font-size="15" fill="currentColor">
        {spec.radiusLabel ?? `${spec.radius}`}
      </text>
      {/* 中心角 */}
      <path
        d={`M${c + 34},${c} A34,34 0 ${large} 0 ${c + 34 * Math.cos(rad(angle))},${c + 34 * Math.sin(rad(angle))}`}
        fill="none"
        stroke="var(--ember)"
        stroke-width="2"
      />
      <text x={c + 54 * Math.cos(rad(mid))} y={c + 54 * Math.sin(rad(mid)) + 5} text-anchor="middle" font-size="15" font-weight="bold" fill="var(--ember)">
        {spec.angleLabel ?? (spec.angle === null ? 'x°' : `${spec.angle}°`)}
      </text>
      <circle cx={c} cy={c} r="3" fill="currentColor" />
      {spec.note && (
        <text x={c} y={S - 8} text-anchor="middle" font-size="14" fill="currentColor">
          {spec.note}
        </text>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------- 立体

function Solid({ spec }: { spec: SolidSpec }) {
  const W = 300;
  const H = 260;
  const l = spec.labels;
  const stroke = { stroke: 'currentColor', 'stroke-width': 2, fill: 'rgba(230,194,92,0.10)' } as const;
  const dash = { stroke: 'currentColor', 'stroke-width': 1.4, fill: 'none', 'stroke-dasharray': '5 4', opacity: 0.7 } as const;
  const label = (x: number, y: number, t?: string) =>
    t ? (
      <text x={x} y={y} text-anchor="middle" font-size="15" fill="var(--gold-2)">
        {t}
      </text>
    ) : null;

  const body = () => {
    switch (spec.shape) {
      case 'prism4': // 直方体・四角柱
        return (
          <>
            <path d="M70,90 L190,90 L190,200 L70,200 Z" {...stroke} />
            <path d="M70,90 L110,60 L230,60 L190,90" {...stroke} />
            <path d="M190,90 L230,60 L230,170 L190,200" {...stroke} />
            <path d="M70,200 L110,170 L230,170" {...dash} />
            <path d="M110,170 L110,60" {...dash} />
            {label(130, 218, l.base)}
            {label(215, 200, l.base2)}
            {label(56, 150, l.height)}
          </>
        );
      case 'prism3': // 三角柱
        return (
          <>
            <path d="M80,200 L140,80 L200,200 Z" {...stroke} />
            <path d="M80,200 L120,225 L240,225 L200,200" {...stroke} />
            <path d="M140,80 L180,105 L240,225" {...stroke} />
            <path d="M180,105 L120,225" {...dash} />
            {label(140, 218, l.base)}
            {label(255, 175, l.height)}
          </>
        );
      case 'cylinder':
        return (
          <>
            <ellipse cx="150" cy="70" rx="80" ry="24" {...stroke} />
            <path d="M70,70 L70,190" {...stroke} fill="none" />
            <path d="M230,70 L230,190" {...stroke} fill="none" />
            <path d="M70,190 A80,24 0 0 0 230,190" {...stroke} fill="none" />
            <path d="M70,190 A80,24 0 0 1 230,190" {...dash} />
            <line x1="150" y1="70" x2="230" y2="70" stroke="var(--gold-2)" stroke-width="1.6" />
            {label(190, 62, l.radius)}
            {label(252, 135, l.height)}
          </>
        );
      case 'pyramid4':
        return (
          <>
            <path d="M150,50 L70,180 L190,180 Z" {...stroke} />
            <path d="M150,50 L230,150 L190,180" {...stroke} />
            <path d="M70,180 L110,205 L230,150" {...dash} />
            <path d="M150,50 L110,205" {...dash} />
            <line x1="150" y1="50" x2="150" y2="180" stroke="var(--gold-2)" stroke-width="1.6" stroke-dasharray="4 3" />
            {label(140, 205, l.base)}
            {label(166, 120, l.height)}
          </>
        );
      case 'cone':
        return (
          <>
            <path d="M150,45 L70,175 A80,24 0 0 0 230,175 Z" {...stroke} />
            <path d="M70,175 A80,24 0 0 1 230,175" {...dash} />
            <line x1="150" y1="45" x2="150" y2="175" stroke="var(--gold-2)" stroke-width="1.6" stroke-dasharray="4 3" />
            <line x1="150" y1="175" x2="230" y2="175" stroke="var(--gold-2)" stroke-width="1.6" />
            {label(190, 196, l.radius)}
            {label(166, 115, l.height)}
            {l.slant && label(100, 110, l.slant)}
          </>
        );
      case 'sphere':
        return (
          <>
            <circle cx="150" cy="130" r="85" {...stroke} />
            <ellipse cx="150" cy="130" rx="85" ry="26" {...dash} />
            <line x1="150" y1="130" x2="235" y2="130" stroke="var(--gold-2)" stroke-width="1.8" />
            {label(192, 122, l.radius)}
            <circle cx="150" cy="130" r="3" fill="currentColor" />
          </>
        );
    }
  };

  return (
    <svg class="figure" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="立体の見取図">
      {body()}
    </svg>
  );
}

// ---------------------------------------------------------------- 投影図

function Projection({ spec }: { spec: ProjectionSpec }) {
  const W = 300;
  const H = 260;
  const shape = (kind: string, cx: number, cy: number) => {
    switch (kind) {
      case 'circle':
        return <circle cx={cx} cy={cy} r="42" fill="rgba(230,194,92,0.10)" stroke="currentColor" stroke-width="2" />;
      case 'square':
        return <rect x={cx - 42} y={cy - 42} width="84" height="84" fill="rgba(230,194,92,0.10)" stroke="currentColor" stroke-width="2" />;
      case 'triangle':
        return <path d={`M${cx},${cy - 44} L${cx - 46},${cy + 40} L${cx + 46},${cy + 40} Z`} fill="rgba(230,194,92,0.10)" stroke="currentColor" stroke-width="2" />;
      case 'rect':
        return <rect x={cx - 38} y={cy - 46} width="76" height="92" fill="rgba(230,194,92,0.10)" stroke="currentColor" stroke-width="2" />;
      default:
        return null;
    }
  };
  return (
    <svg class="figure" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="投影図">
      <text x="150" y="20" text-anchor="middle" font-size="13" fill="currentColor">
        真上から見た図
      </text>
      {shape(spec.top, 150, 72)}
      <line x1="40" y1="128" x2="260" y2="128" stroke="currentColor" stroke-width="1" opacity="0.4" stroke-dasharray="4 4" />
      <text x="150" y="150" text-anchor="middle" font-size="13" fill="currentColor">
        正面から見た図
      </text>
      {shape(spec.front, 150, 202)}
    </svg>
  );
}

// ---------------------------------------------------------------- グラフ(第7章)

function Chart({ spec }: { spec: ChartSpec }) {
  const W = 560;
  const H = 260;
  const padL = 46;
  const padB = 52;
  const padT = 16;
  const max = Math.max(...spec.values, 1);
  const n = spec.values.length;
  const bw = (W - padL - 20) / n;
  const yOf = (v: number) => H - padB - (v / max) * (H - padB - padT);

  return (
    <svg class="figure" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={spec.type === 'histogram' ? 'ヒストグラム' : 'ドットプロット'}>
      {/* 軸 */}
      <line x1={padL} y1={H - padB} x2={W - 8} y2={H - padB} stroke="currentColor" stroke-width="1.6" />
      <line x1={padL} y1={H - padB} x2={padL} y2={padT - 4} stroke="currentColor" stroke-width="1.6" />
      {/* 目盛り */}
      {Array.from({ length: max + 1 }, (_, i) => i).filter((v) => max <= 8 || v % Math.ceil(max / 6) === 0).map((v) => (
        <g key={v}>
          <line x1={padL - 4} y1={yOf(v)} x2={W - 8} y2={yOf(v)} stroke="currentColor" stroke-width="0.5" opacity="0.25" />
          <text x={padL - 8} y={yOf(v) + 4} text-anchor="end" font-size="11" fill="currentColor" opacity="0.8">
            {v}
          </text>
        </g>
      ))}
      {spec.values.map((v, i) =>
        spec.type === 'histogram' ? (
          <rect
            key={i}
            x={padL + i * bw + 1}
            y={yOf(v)}
            width={bw - 2}
            height={H - padB - yOf(v)}
            fill={spec.highlight === i ? 'var(--ember)' : 'rgba(230,194,92,0.55)'}
            stroke="var(--gold-2)"
            stroke-width="1.2"
          />
        ) : (
          <g key={i}>
            {Array.from({ length: v }, (_, k) => (
              <circle key={k} cx={padL + i * bw + bw / 2} cy={H - padB - 10 - k * 13} r="5" fill="var(--ember)" opacity="0.9" />
            ))}
          </g>
        ),
      )}
      {spec.labels.map((t, i) => (
        <text key={i} x={padL + i * bw + bw / 2} y={H - padB + 18} text-anchor="middle" font-size="11" fill="currentColor">
          {t}
        </text>
      ))}
      {spec.xTitle && (
        <text x={W / 2} y={H - 8} text-anchor="middle" font-size="12" fill="currentColor" opacity="0.85">
          {spec.xTitle}
        </text>
      )}
      {spec.yTitle && (
        <text x={14} y={padT + 6} font-size="12" fill="currentColor" opacity="0.85">
          {spec.yTitle}
        </text>
      )}
    </svg>
  );
}
