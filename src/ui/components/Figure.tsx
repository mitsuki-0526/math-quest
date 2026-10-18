import type { FigureSpec, NumberLineSpec, PlaneSpec, AnglesSpec, SectorSpec, SolidSpec, ProjectionSpec, ChartSpec, TableSpec, GridSpec } from '@/math/figure';

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
    case 'table':
      return <DataTable spec={spec} />;
    case 'grid':
      return <Grid spec={spec} />;
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
  // 数は 5 きざみ(…, −10, −5, 0, 5, 10)だけに書く。両はしに −8・8 のような数を書くと、
  // 読み取りの問題の答えが 書いてある目盛りに なりやすかった(先生の試遊 2026-09-28)
  const labels = new Set(spec.labels ?? ticks.filter((v) => Number.isInteger(v) && v % 5 === 0));
  // 0 の目盛りには 必ず数を書く(授業の数直線と そろえる。先生の印 2026-09-27)
  if (spec.min <= 0 && spec.max >= 0) labels.add(0);

  return (
    <svg class="figure" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`数直線 ${spec.min} から ${spec.max}`}>
      <defs>{ARROW}</defs>
      <line x1={padX - 16} y1={y} x2={W - padX + 16} y2={y} stroke="currentColor" stroke-width="2" marker-end="url(#fig-arrow)" />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={toX(v)} y1={y - (v === 0 ? 10 : 6)} x2={toX(v)} y2={y + (v === 0 ? 10 : 6)} stroke="currentColor" stroke-width={v === 0 ? 2 : 1.2} />
          {labels.has(v) && (
            <text x={toX(v)} y={y + 28} text-anchor="middle" font-size="18" fill="currentColor">
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
          <text x={toX(p.value)} y={y - 14} text-anchor="middle" font-size="20" font-weight="bold" fill="var(--ember)">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------- 座標平面

/**
 * 座標平面の グラフの 線・点(と その名前)の 色。軸・格子・目盛りは 黒で、答えに かかわる ものだけ 赤
 * (全部 黒だと 線と 格子の 見分けが つきにくい。先生の指摘 2026-10-16)
 */
const PLANE_MARK = '#d32f2f';

/** 角の 図で 求める 角(x)。座標平面と 同じ 赤(先生の指摘 2026-10-18: 求める 部分だけ 赤く) */
const ASK_MARK = PLANE_MARK;

/** 図の 中の 文字(x)の 書体。styles.css の .mt-var と 同じ */
const MATH_FONT = "'MQ Math', KaTeX_Math, 'Times New Roman', serif";

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

  // 文字が グラフ・補助線に かからない 場所を えらぶ(先生の指摘 2026-10-16「線と 文字が 被る」)
  const lines: [number, number][][] = [];
  for (const g of spec.graphs ?? []) {
    if (g.type === 'prop') lines.push([[px(-R), py(g.a * -R)], [px(R), py(g.a * R)]]);
    else
      for (const sign of [1, -1]) {
        const pts: [number, number][] = [];
        for (let i = 0; i <= 120; i++) {
          const x = sign * (0.18 + (i / 120) * (R - 0.18));
          if (Math.abs(g.a / x) <= R + 0.5) pts.push([px(x), py(g.a / x)]);
        }
        lines.push(pts);
      }
  }
  for (const q of spec.guides ?? [])
    lines.push(
      [
        [px(q.x), c],
        [px(q.x), py(q.y)],
      ],
      [
        [c, py(q.y)],
        [px(q.x), py(q.y)],
      ],
    );
  const hit = (cx: number, cy: number, w: number, h: number) =>
    lines.some((pl) =>
      pl.some((p0, k) => {
        if (k + 1 >= pl.length) return false;
        const p1 = pl[k + 1];
        // 2 px ごとに 調べる(長い 直線を 50 等分では 文字を 素通りした)
        const steps = Math.max(1, Math.ceil(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 2));
        for (let j = 0; j <= steps; j++) {
          const x = p0[0] + ((p1[0] - p0[0]) * j) / steps;
          const y = p0[1] + ((p1[1] - p0[1]) * j) / steps;
          if (Math.abs(x - cx) < w / 2 + 2 && Math.abs(y - cy) < h / 2 + 2) return true;
        }
        return false;
      }),
    );
  const firstFree = (cands: [number, number][], w: number, h: number): [number, number] | null => cands.find(([x, y]) => !hit(x, y, w, h)) ?? null;
  // 原点の O は、軸と 原点を 通る グラフの あいだの いちばん 広い すきまに 置く(3 本の 直線が 4 つの 象限を ふさぐ ことが ある)
  const oPos = (() => {
    const dirs = [0, 90, 180, 270];
    for (const g of spec.graphs ?? []) if (g.type === 'prop') dirs.push(...[0, 180].map((d) => (((Math.atan(g.a) * 180) / Math.PI + d) % 360 + 360) % 360));
    dirs.sort((p, q) => p - q);
    let best = 0;
    let mid = 225;
    dirs.forEach((d, k) => {
      const next = k + 1 < dirs.length ? dirs[k + 1] : dirs[0] + 360;
      if (next - d > best) [best, mid] = [next - d, (d + next) / 2];
    });
    const r = Math.max(12, 12 / Math.sin(((Math.min(best, 180) / 2) * Math.PI) / 180));
    return [c + r * Math.cos((mid * Math.PI) / 180), c - r * Math.sin((mid * Math.PI) / 180)] as [number, number];
  })();
  const tickLabel = (v: number) => (v < 0 ? `−${-v}` : String(v));

  return (
    // 教科書と 同じ 白い 紙に 黒い 線・文字(先生の指摘 2026-10-16: 暗い 背景では 読みにくい)
    <svg class="figure figure-square figure-paper" viewBox={`0 0 ${S} ${S}`} role="img" aria-label="座標平面">
      <defs>{ARROW}</defs>
      <rect x="0" y="0" width={S} height={S} rx="6" fill="#fff" />
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
      <text x={oPos[0]} y={oPos[1] + 4} text-anchor="middle" font-size="12" fill="currentColor">
        O
      </text>
      {/* 目盛りの数字は 5 の倍数だけ(±1・±6 まで 書くと 中途半端。先生の指摘 2026-10-16。間は 格子で 数える) */}
      {ticks
        .filter((v) => Math.abs(v) % 5 === 0)
        .map((v) => {
          // 目盛りの 数は ふつう 軸の 下・左。グラフが 通るなら 上・右へ、どちらも だめなら 書かない(格子で 読める)
          const w = tickLabel(v).length * 6.5;
          const xp = firstFree(
            [
              [px(v), c + 11],
              [px(v), c - 11],
            ],
            w,
            11,
          );
          const yp = firstFree(
            [
              [c - 6 - w / 2, py(v)],
              [c + 6 + w / 2, py(v)],
            ],
            w,
            11,
          );
          return (
            <g key={`t${v}`}>
              {xp && (
                <text x={xp[0]} y={xp[1] + 4} text-anchor="middle" font-size="12" fill="currentColor">
                  {tickLabel(v)}
                </text>
              )}
              {yp && (
                <text x={yp[0]} y={yp[1] + 4} text-anchor="middle" font-size="12" fill="currentColor">
                  {tickLabel(v)}
                </text>
              )}
            </g>
          );
        })}
      {/* グラフ */}
      {spec.graphs?.map((g, i) =>
        path(g.type, g.a).map((d, k) => <path key={`p${i}-${k}`} d={d} fill="none" stroke={PLANE_MARK} stroke-width="2.4" />),
      )}
      {/* グラフの 名前(ア・イ・ウ)。比例の 直線は 右の はし(図の 枠に かかる 手前)に 置く */}
      {spec.graphs?.map((g, i) => {
        if (!g.label || g.type !== 'prop') return null;
        const x = Math.min(R, (R - 0.4) / Math.abs(g.a)) * 0.92;
        const [lx, ly] = [px(x), py(g.a * x)];
        const pos =
          firstFree(
            [
              [lx + 14, ly + (g.a > 0 ? 6 : -6)],
              [lx - 14, ly + (g.a > 0 ? -8 : 8)],
              [lx + 14, ly - (g.a > 0 ? 10 : -10)],
              [lx - 16, ly],
              [lx + 16, ly],
              [lx, ly + 16],
              [lx, ly - 16],
            ],
            14,
            16,
          ) ?? [lx + 14, ly];
        return (
          <text key={`l${i}`} x={pos[0]} y={pos[1] + 6} text-anchor="middle" font-size="16" font-weight="bold" fill={PLANE_MARK}>
            {g.label}
          </text>
        );
      })}
      {/* 補助線 */}
      {spec.guides?.map((p, i) => (
        <g key={`gd${i}`} opacity="0.7">
          <line x1={px(p.x)} y1={c} x2={px(p.x)} y2={py(p.y)} stroke="currentColor" stroke-width="1.2" stroke-dasharray="4 3" />
          <line x1={c} y1={py(p.y)} x2={px(p.x)} y2={py(p.y)} stroke="currentColor" stroke-width="1.2" stroke-dasharray="4 3" />
        </g>
      ))}
      {/* 点 */}
      {spec.points?.map((p) => (
        <g key={p.label}>
          <circle cx={px(p.x)} cy={py(p.y)} r="5" fill={PLANE_MARK} stroke="#fff" stroke-width="1.4" />
          <text x={px(p.x) + 8} y={py(p.y) - 8} font-size="15" font-weight="bold" fill={PLANE_MARK}>
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
  // 図に ある 線の 向き(直線なら 反対向きも)。文字を 置く すきまを さがすのに 使う
  const allRays = [...spec.rays, ...(spec.throughLines ? spec.rays.map((d) => d + 180) : [])].map((d) => ((d % 360) + 360) % 360).sort((a, b) => a - b);
  /** 中心の 名前(O)は、線と 線の いちばん 広い すきまに 置く */
  const centerDir = (() => {
    let best = 0;
    let dir = 270;
    allRays.forEach((d, k) => {
      const next = k + 1 < allRays.length ? allRays[k + 1] : allRays[0] + 360;
      if (next - d > best) [best, dir] = [next - d, (d + next) / 2];
    });
    // すきまが せまいほど 中心から はなす(文字の 四すみが 両側の 線に かからないように)
    const r = Math.max(17, 14 / Math.sin(Math.min(best / 2, 90) * (Math.PI / 180)));
    return { dir, r };
  })();

  // 紙は 図の ある ところだけに 切る(正方形の ままだと 半直線が 片側だけの 図で 白い 余白が 大きく、戦闘の 窓では 図が 小さく なる)
  const used: (readonly [number, number])[] = [[c, c]];
  const marks = spec.marks.map((m, i) => {
    // 文字(x など)の 印が 求める 角。数(130°)は わかっている 角なので 黒
    const ask = !m.label.includes('°');
    const color = ask ? ASK_MARK : 'currentColor';
    // 小さい 角度から 大きい 角度へ 描く(半直線の 順に よらず、内側の 弧に なる)
    const a1 = Math.min(spec.rays[m.from], spec.rays[m.to]);
    const a2 = Math.max(spec.rays[m.from], spec.rays[m.to]);
    // 角の 印が 重ならないように、2 つめ以降は 外へ 大きく ずらす(小さい 角の 二等分線で 40° と x が 重なった)
    const r = 30 + i * 30;
    const [sx, sy] = pt(a1, r);
    const [ex, ey] = pt(a2, r);
    const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
    // 文字は、角の 中を 通る 半直線(二等分線など)を よけて、いちばん 広い すきまの 真ん中に 置く。
    // すきまが せまいほど 外へ 出し、文字の 四すみが 両側の 半直線に かからないように する(先生の指摘 2026-10-16「線と 文字が 被る」)
    const inner = allRays.filter((d) => d > a1 + 0.01 && d < a2 - 0.01);
    const cuts = [a1, ...inner, a2];
    let g1 = a1;
    let g2 = a2;
    // ほかの 印の 弧が ない すきまを 先に えらぶ(二等分線の 図で、x の 弧の 上に 40° が 乗った)
    const others = spec.marks.filter((_, j) => j !== i).map((o) => [Math.min(spec.rays[o.from], spec.rays[o.to]), Math.max(spec.rays[o.from], spec.rays[o.to])]);
    const covered = (deg: number) => others.some(([lo, hi]) => deg > lo && deg < hi);
    let best = -1;
    for (let k = 0; k + 1 < cuts.length; k++) {
      const score = cuts[k + 1] - cuts[k] - (covered((cuts[k] + cuts[k + 1]) / 2) ? 1000 : 0);
      if (score > best) [best, g1, g2] = [score, cuts[k], cuts[k + 1]];
    }
    const half = Math.min(((g2 - g1) / 2) * (Math.PI / 180), Math.PI / 2);
    const reach = Math.hypot((m.label.length * 9.5) / 2, 9) + 5;
    let lr = Math.min(108, Math.max(r + 18, reach / Math.sin(half)));
    // それでも ほかの 弧の 上に くるときは、弧より 外へ ずらす
    const la = (g1 + g2) / 2;
    spec.marks.forEach((o, j) => {
      const lo = Math.min(spec.rays[o.from], spec.rays[o.to]);
      const hi = Math.max(spec.rays[o.from], spec.rays[o.to]);
      const rj = 30 + j * 30;
      if (j !== i && la > lo && la < hi && Math.abs(lr - rj) < 14) lr = rj + 15;
    });
    const [lx, ly] = pt(la, lr);
    for (let a = a1; a <= a2; a += 5) used.push(pt(a, r));
    used.push([lx - 12, ly - 12], [lx + 12, ly + 12]);
    return (
      <g key={i}>
        {/* 求める 角は 中を うすく 塗って、どこの 角かを 一目で 分かるように */}
        {ask && <path d={`M${c},${c} L${sx},${sy} A${r},${r} 0 ${large} 0 ${ex},${ey} Z`} fill={ASK_MARK} fill-opacity="0.15" stroke="none" />}
        <path d={`M${sx},${sy} A${r},${r} 0 ${large} 0 ${ex},${ey}`} fill="none" stroke={color} stroke-width={ask ? 2.6 : 1.6} />
        {/* x は 教科書と 同じ 数式の 斜体(入力欄・会話の 文字式と 同じ 書体。先生の指摘 2026-10-18) */}
        <text
          x={lx}
          y={ly + 5}
          text-anchor="middle"
          font-size={ask ? 21 : 16}
          font-weight={ask ? 'normal' : 'bold'}
          font-family={ask ? MATH_FONT : undefined}
          fill={color}
        >
          {m.label}
        </text>
      </g>
    );
  });
  for (const deg of spec.rays) {
    used.push(pt(deg), pt(deg, L + 28));
    if (spec.throughLines) used.push(pt(deg + 180), pt(deg + 180, L + 28));
  }
  const [cx, cy] = pt(centerDir.dir, centerDir.r);
  if (spec.center) used.push([cx - 12, cy - 12], [cx + 12, cy + 12]);
  const pad = 6;
  const x0 = Math.max(0, Math.min(...used.map((q) => q[0])) - pad);
  const y0 = Math.max(0, Math.min(...used.map((q) => q[1])) - pad);
  const x1 = Math.min(S, Math.max(...used.map((q) => q[0])) + pad);
  const y1 = Math.min(S, Math.max(...used.map((q) => q[1])) + pad);
  // 切った ぶん 幅も 縮める(細い 図だけ 大きく 描かれないように。320px が 正方形の ときの 幅)

  return (
    // 座標平面と 同じく 白い 紙に 黒い 線(先生の指摘 2026-10-18)
    <svg class="figure figure-square figure-paper" viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`} style={{ maxWidth: `${((x1 - x0) / S) * 320}px` }} role="img" aria-label="角の図">
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} rx="6" fill="#fff" />
      {spec.rays.map((deg, i) => {
        const [xa, ya] = pt(deg);
        const [xb, yb] = spec.throughLines ? pt(deg + 180) : ([c, c] as const);
        return <line key={i} x1={xa} y1={ya} x2={xb} y2={yb} stroke="currentColor" stroke-width="2" />;
      })}
      {spec.outline && (
        <path
          d={spec.rays.map((deg, i) => `${i === 0 ? 'M' : 'L'}${pt(deg)[0]},${pt(deg)[1]}`).join(' ') + ' Z'}
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        />
      )}
      {marks}
      {spec.rayLabels?.map((t, i) => {
        if (!t) return null;
        const [x, y] = pt(spec.rays[i], L + 16);
        return (
          <text key={`r${i}`} x={x} y={y + 6} text-anchor="middle" font-size="17" font-style="italic" fill="currentColor">
            {t}
          </text>
        );
      })}
      {spec.center && (
        <text x={cx} y={cy + 6} text-anchor="middle" font-size="17" font-style="italic" fill="currentColor">
          {spec.center}
        </text>
      )}
      <circle cx={c} cy={c} r="3" fill="currentColor" />
    </svg>
  );
}

// ---------------------------------------------------------------- 方眼の図形(図形の移動)

function Grid({ spec }: { spec: GridSpec }) {
  const cell = 28;
  const pad = 22;
  const W = spec.w * cell + pad * 2;
  const H = spec.h * cell + pad * 2;
  const px = (x: number) => pad + x * cell;
  const py = (y: number) => pad + (spec.h - y) * cell;
  const fill = { from: 'rgba(230,194,92,0.45)', to: 'rgba(120,180,230,0.40)', other: 'rgba(200,200,200,0.18)' } as const;
  const stroke = { from: 'var(--gold-2)', to: 'var(--sky)', other: 'currentColor' } as const;
  // 文字を 置く 場所を、三角形の 辺に かからない 所から えらぶ(先生の指摘 2026-10-16「線と 文字が 被る」)
  const segs = spec.shapes.flatMap((sh) => sh.points.map((q, k) => [px(q[0]), py(q[1]), px(sh.points[(k + 1) % sh.points.length][0]), py(sh.points[(k + 1) % sh.points.length][1])]));
  const hits = (cx: number, cy: number, w: number, h: number) =>
    segs.some(([x1, y1, x2, y2]) => {
      const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 2));
      for (let j = 0; j <= steps; j++) {
        const x = x1 + ((x2 - x1) * j) / steps;
        const y = y1 + ((y2 - y1) * j) / steps;
        if (Math.abs(x - cx) < w / 2 + 2 && Math.abs(y - cy) < h / 2 + 2) return true;
      }
      return false;
    });
  // 置いた 文字の 箱(文字どうしも 重ねない。B と B′、頂点と O が 近い ことが ある)
  const placed: [number, number, number, number][] = [];
  const overlapsPlaced = (cx: number, cy: number, w: number, h: number) => placed.some(([x, y, pw, ph]) => Math.abs(x - cx) < (w + pw) / 2 + 1 && Math.abs(y - cy) < (h + ph) / 2 + 1);
  /** (x0, y0) から 好きな 向き(dx, dy)に 近い 順に ためして、辺にも ほかの 文字にも かからない 文字の 中心を 返す */
  const place = (x0: number, y0: number, dx: number, dy: number, R: number, w: number, h: number): [number, number] => {
    const base = Math.atan2(dy, dx);
    for (const r of [R, R + 6, R + 12, R + 18])
      for (const off of [0, 30, -30, 60, -60, 90, -90, 135, -135, 180]) {
        const a = base + (off * Math.PI) / 180;
        const cx = x0 + Math.cos(a) * r;
        const cy = y0 + Math.sin(a) * r;
        if (!hits(cx, cy, w, h) && !overlapsPlaced(cx, cy, w, h)) {
          placed.push([cx, cy, w, h]);
          return [cx, cy];
        }
      }
    placed.push([x0 + dx * R, y0 + dy * R, w, h]);
    return [x0 + dx * R, y0 + dy * R];
  };
  // 三角形の 名前(㋐・㋑)は 内心に 固定。先に 箱を 登録して おく
  for (const sh of spec.shapes) {
    const m = sh.points.length;
    const sd = (k: number) => Math.hypot(sh.points[(k + 1) % m][0] - sh.points[(k + 2) % m][0], sh.points[(k + 1) % m][1] - sh.points[(k + 2) % m][1]);
    const pr = sh.points.reduce((a, _, k) => a + sd(k), 0);
    const ix = m === 3 ? sh.points.reduce((a, [x], k) => a + x * sd(k), 0) / pr : sh.points.reduce((a, [x]) => a + x, 0) / m;
    const iy = m === 3 ? sh.points.reduce((a, [, y], k) => a + y * sd(k), 0) / pr : sh.points.reduce((a, [, y]) => a + y, 0) / m;
    placed.push([px(ix), py(iy), 18, 18]);
  }
  return (
    <svg class="figure" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="方眼の図">
      <defs>{ARROW}</defs>
      {Array.from({ length: spec.w + 1 }, (_, i) => (
        <line key={`v${i}`} x1={px(i)} y1={py(0)} x2={px(i)} y2={py(spec.h)} stroke="currentColor" stroke-width="0.6" opacity="0.25" />
      ))}
      {Array.from({ length: spec.h + 1 }, (_, i) => (
        <line key={`h${i}`} x1={px(0)} y1={py(i)} x2={px(spec.w)} y2={py(i)} stroke="currentColor" stroke-width="0.6" opacity="0.25" />
      ))}
      {spec.shapes.map((sh, i) => {
        const d = sh.points.map(([x, y], k) => `${k === 0 ? 'M' : 'L'}${px(x)},${py(y)}`).join(' ') + ' Z';
        // 名前(㋐)は 内心(3 辺から いちばん 遠い 点)に 置く。重心だと 細い 三角形で 辺に かかった
        const n = sh.points.length;
        const side = (k: number) => Math.hypot(sh.points[(k + 1) % n][0] - sh.points[(k + 2) % n][0], sh.points[(k + 1) % n][1] - sh.points[(k + 2) % n][1]);
        const per = sh.points.reduce((a, _, k) => a + side(k), 0);
        const cx = n === 3 ? sh.points.reduce((a, [x], k) => a + x * side(k), 0) / per : sh.points.reduce((a, [x]) => a + x, 0) / n;
        const cy = n === 3 ? sh.points.reduce((a, [, y], k) => a + y * side(k), 0) / per : sh.points.reduce((a, [, y]) => a + y, 0) / n;
        return (
          <g key={`s${i}`}>
            <path d={d} fill={fill[sh.tone]} stroke={stroke[sh.tone]} stroke-width="2.2" stroke-linejoin="round" />
            <text x={px(cx)} y={py(cy) + 6} text-anchor="middle" font-size="17" font-weight="bold" fill="currentColor">
              {sh.label}
            </text>
            {sh.vertexLabels?.map((t, k) => {
              const [x, y] = sh.points[k];
              // 頂点の 名前は、その 頂点の 2 辺の 外角の 二等分線の 向きに 置く(辺に かからない)
              const unit = ([ax, ay]: [number, number]) => {
                const l = Math.hypot(ax - x, ay - y) || 1;
                return [(ax - x) / l, (ay - y) / l];
              };
              const [ux, uy] = unit(sh.points[(k + 1) % n]);
              const [vx, vy] = unit(sh.points[(k + n - 1) % n]);
              let dx = -(ux + vx);
              let dy = -(uy + vy);
              const len = Math.hypot(dx, dy);
              if (len < 1e-6) [dx, dy] = [-uy, ux];
              else [dx, dy] = [dx / len, dy / len];
              // 文字の 幅(A′ は 広い)の ぶん 横に 長く はなす
              const R = 12 + Math.abs(dx) * (t.length > 1 ? 6 : 2);
              const [tx, ty] = place(px(x), py(y), dx, -dy, R, t.length > 1 ? 15 : 10, 13);
              return (
                <text key={k} x={tx} y={ty + 5} text-anchor="middle" font-size="14" font-style="italic" fill="currentColor">
                  {t}
                </text>
              );
            })}
          </g>
        );
      })}
      {spec.lines?.map((l, i) => (
        <g key={`l${i}`}>
          <line
            x1={px(l.x1)}
            y1={py(l.y1)}
            x2={px(l.x2)}
            y2={py(l.y2)}
            stroke="var(--ember)"
            stroke-width="2"
            stroke-dasharray={l.arrow ? undefined : '6 4'}
            marker-end={l.arrow ? 'url(#fig-arrow)' : undefined}
          />
          {l.label && (
            <text x={px(l.x2) + 6} y={py(l.y2) + (l.y2 > l.y1 ? -4 : 14)} font-size="16" font-style="italic" fill="var(--ember)">
              {l.label}
            </text>
          )}
        </g>
      ))}
      {spec.points?.map((p) => {
        // 点の 名前(O)は、まわりの 三角形から いちばん 離れる 向きに 置く
        const dirs = [
          [1, 1],
          [-1, 1],
          [1, -1],
          [-1, -1],
        ];
        const near = (ax: number, ay: number) =>
          Math.min(...spec.shapes.flatMap((s) => s.points.map(([x, y]) => Math.hypot(x - ax, y - ay))), ...spec.shapes.map((s) => Math.hypot(s.points.reduce((a, q) => a + q[0], 0) / s.points.length - ax, s.points.reduce((a, q) => a + q[1], 0) / s.points.length - ay)));
        const [dx, dy] = dirs.reduce((b, d) => (near(p.x + d[0] * 0.6, p.y + d[1] * 0.6) > near(p.x + b[0] * 0.6, p.y + b[1] * 0.6) ? d : b), dirs[0]);
        const [tx, ty] = place(px(p.x), py(p.y), dx, -dy, 18, 12, 15);
        return (
          <g key={p.label}>
            <circle cx={px(p.x)} cy={py(p.y)} r="4.5" fill="var(--ember)" stroke="#fff" stroke-width="1.2" />
            <text x={tx} y={ty + 6} text-anchor="middle" font-size="16" font-style="italic" font-weight="bold" fill="var(--ember)">
              {p.label}
            </text>
          </g>
        );
      })}
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
  const angleText = spec.angleLabel ?? (spec.angle === null ? 'x°' : `${spec.angle}°`);
  const angleR = Math.min(95, Math.max(54, (Math.hypot((angleText.length * 9) / 2, 8) + 5) / Math.sin(Math.min(mid, 90) * (Math.PI / 180))));

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
      {/* 中心角の 文字: 小さい 角(20°)では 半径に かからないよう 外へ */}
      <text
        x={c + angleR * Math.cos(rad(mid))}
        y={c + angleR * Math.sin(rad(mid)) + 5}
        text-anchor="middle"
        font-size="15"
        font-weight="bold"
        fill="var(--ember)"
      >
        {angleText}
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

  /** 頂点の 名前(教科書の 書き方: 直方体は 上の 面 ABCD・下の 面 EFGH、三角柱は ABC と DEF) */
  const vname = (x: number, y: number, t: string) => (
    <text x={x} y={y} text-anchor="middle" font-size="15" font-style="italic" fill="currentColor">
      {t}
    </text>
  );
  // 文字は 辺から はなして 置く(先生の指摘 2026-10-16「線と 文字が 被る」)。三つの 面が 集まる 頂点(直方体の C)は 面の 中に 置く
  const vertexNames = () => {
    if (!spec.vertices) return null;
    if (spec.shape === 'prism4')
      return (
        <>
          {vname(110, 50, 'A')}
          {vname(58, 95, 'B')}
          {vname(178, 109, 'C')}
          {vname(241, 55, 'D')}
          {vname(122, 163, 'E')}
          {vname(58, 213, 'F')}
          {vname(198, 219, 'G')}
          {vname(243, 175, 'H')}
        </>
      );
    if (spec.shape === 'prism3')
      return (
        <>
          {vname(90, 96, 'A')}
          {vname(50, 220, 'B')}
          {vname(174, 229, 'C')}
          {vname(196, 52, 'D')}
          {vname(169, 190, 'E')}
          {vname(271, 176, 'F')}
        </>
      );
    return null;
  };

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
            {label(130, 222, l.base)}
            {label(227, 205, l.base2)}
            {label(52, 150, l.height)}
          </>
        );
      case 'prism3': // 三角柱(手前の 面 ABC、奥の 面 DEF)
        return (
          <>
            <path d="M60,210 L100,100 L170,210 Z" {...stroke} />
            <path d="M100,100 L190,60 L260,170 L170,210" {...stroke} />
            <path d="M60,210 L150,170 L260,170" {...dash} />
            <path d="M150,170 L190,60" {...dash} />
            {label(115, 232, l.base)}
            {label(228, 209, l.height)}
          </>
        );
      case 'cylinder':
        return (
          <>
            <ellipse cx="150" cy="70" rx="80" ry="28" {...stroke} />
            <path d="M70,70 L70,190" {...stroke} fill="none" />
            <path d="M230,70 L230,190" {...stroke} fill="none" />
            <path d="M70,190 A80,28 0 0 0 230,190" {...stroke} fill="none" />
            <path d="M70,190 A80,28 0 0 1 230,190" {...dash} />
            <line x1="150" y1="70" x2="230" y2="70" stroke="var(--gold-2)" stroke-width="1.6" />
            {label(190, 65, l.radius)}
            {label(252, 135, l.height)}
          </>
        );
      case 'pyramid4':
        return (
          <>
            <path d="M150,40 L60,190 L180,190 Z" {...stroke} />
            <path d="M150,40 L240,150 L180,190" {...stroke} />
            <path d="M60,190 L120,150 L240,150" {...dash} />
            <path d="M150,40 L120,150" {...dash} />
            <line x1="150" y1="40" x2="150" y2="170" stroke="var(--gold-2)" stroke-width="1.6" stroke-dasharray="4 3" />
            {label(120, 212, l.base)}
            {label(139, 134, l.height)}
          </>
        );
      case 'cone':
        return (
          <>
            <path d="M150,45 L70,175 A80,24 0 0 0 230,175 Z" {...stroke} />
            <path d="M70,175 A80,24 0 0 1 230,175" {...dash} />
            <line x1="150" y1="45" x2="150" y2="175" stroke="var(--gold-2)" stroke-width="1.6" stroke-dasharray="4 3" />
            <line x1="150" y1="175" x2="230" y2="175" stroke="var(--gold-2)" stroke-width="1.6" />
            {label(190, 170, l.radius)}
            {label(166, 115, l.height)}
            {l.slant && label(95, 104, l.slant)}
          </>
        );
      case 'sphere':
        return (
          <>
            <circle cx="150" cy="130" r="85" {...stroke} />
            <ellipse cx="150" cy="130" rx="85" ry="32" {...dash} />
            <line x1="150" y1="130" x2="235" y2="130" stroke="var(--gold-2)" stroke-width="1.8" />
            {label(192, 124, l.radius)}
            <circle cx="150" cy="130" r="3" fill="currentColor" />
          </>
        );
    }
  };

  return (
    <svg class="figure" viewBox={`0 0 ${W} ${spec.vertices ? H + 10 : H}`} role="img" aria-label="立体の見取図">
      {body()}
      {vertexNames()}
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
  // 上に 縦の 見出し(度数(人))を 置く すきまを とる(目盛りの 線と 重なった)
  const padT = 32;
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
        <text x={padL - 30} y={16} font-size="12" fill="currentColor" opacity="0.85">
          {spec.yTitle}
        </text>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------- 表(第1章)

/** 表は文字が主役なので SVG ではなく HTML の表で描く(読み上げ・拡大にも強い) */
function DataTable({ spec }: { spec: TableSpec }) {
  return (
    <div class="figure-table-wrap">
      <table class="figure-table">
        <thead>
          <tr>
            {spec.head.map((h, i) => (
              <th key={i} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.rows.map((row, r) => (
            <tr key={r}>
              {row.map((c, i) =>
                i === 0 ? (
                  <th key={i} scope="row">
                    {c}
                  </th>
                ) : (
                  <td key={i} class={c === '?' ? 'unknown' : ''}>
                    {c}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {spec.caption && <p class="figure-table-caption">{spec.caption}</p>}
    </div>
  );
}
