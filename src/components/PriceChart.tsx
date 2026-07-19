import { useMemo, useRef, useState } from "react";
import type { PricePoint } from "../lib/priceHistory";

/**
 * Single-series price line. Follows the house dataviz rules:
 * 2px round-join line, ~10% area wash, hairline solid gridlines, ≥8px
 * end-dot with a 2px surface ring, one selective direct label (last price),
 * crosshair snapping to the nearest point with a tooltip, and a table view
 * so nothing is gated behind hover. Single series → no legend; the panel
 * title names it. Text wears text tokens, never the series color.
 */

const W = 640;
const H = 220;
const PAD = { top: 14, right: 74, bottom: 26, left: 10 };

const SERIES = "#9a6bff"; // validated vs #14121b surface (dataviz checks)
const SURFACE = "#14121b";
const GRID = "#211d2c"; // one step off the surface
const TEXT_DIM = "#8b8499";
const TEXT_BRIGHT = "#f4f2f8";

function fmtPriceShort(p: number): string {
  if (p === 0) return "0";
  return p.toPrecision(3).replace(/e-?\d+$/, (m) => `e${m.slice(1)}`);
}

function fmtTime(t: number, spanSec: number): string {
  const d = new Date(t * 1000);
  return spanSec > 36 * 3600
    ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export default function PriceChart({
  points,
  symbol,
}: {
  points: PricePoint[];
  symbol: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const model = useMemo(() => {
    if (points.length < 2) return null;
    const t0 = points[0].t;
    const t1 = points[points.length - 1].t;
    const spanT = Math.max(1, t1 - t0);
    const prices = points.map((p) => p.price);
    const pMin = Math.min(...prices);
    const pMax = Math.max(...prices);
    const spanP = pMax - pMin || pMax || 1;
    const lo = pMin - spanP * 0.12;
    const hi = pMax + spanP * 0.12;

    const x = (t: number) =>
      PAD.left + ((t - t0) / spanT) * (W - PAD.left - PAD.right);
    const y = (p: number) =>
      PAD.top + (1 - (p - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);

    const xy = points.map((p) => ({ ...p, X: x(p.t), Y: y(p.price) }));
    const path = xy
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.X.toFixed(1)},${p.Y.toFixed(1)}`)
      .join("");
    const area = `${path}L${xy[xy.length - 1].X.toFixed(1)},${H - PAD.bottom}L${xy[0].X.toFixed(1)},${H - PAD.bottom}Z`;

    // three clean-ish horizontal gridlines; suppress a gridline's value
    // where the last-price direct label would collide with it
    const lastY = xy[xy.length - 1].Y;
    const gridYs = [0.25, 0.5, 0.75].map((f) => {
      const Y = PAD.top + f * (H - PAD.top - PAD.bottom);
      return {
        p: lo + (hi - lo) * (1 - f),
        Y,
        showValue: Math.abs(Y - lastY) > 12,
      };
    });

    // sparse x ticks: first and last always; middle only when it has room
    const first = { t: points[0].t, X: x(points[0].t) };
    const lastTick = { t: t1, X: x(t1) };
    const mid = points[Math.floor(points.length / 2)];
    const midTick = { t: mid.t, X: x(mid.t) };
    const ticksX = [first];
    if (midTick.X - first.X > 90 && lastTick.X - midTick.X > 90)
      ticksX.push(midTick);
    if (lastTick.X > first.X + 40) ticksX.push(lastTick);

    return { xy, path, area, gridYs, ticksX, spanT };
  }, [points]);

  if (!model) {
    return <div className="muted small">Not enough trades to chart yet.</div>;
  }

  const { xy, path, area, gridYs, ticksX, spanT } = model;
  const last = xy[xy.length - 1];
  const hovered = hover !== null ? xy[hover] : null;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestD = Infinity;
    xy.forEach((p, i) => {
      const d = Math.abs(p.X - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHover(best);
  }

  return (
    <div className="chart-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${symbol} price history in HBAR per token`}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight")
            setHover((h) => Math.min((h ?? -1) + 1, xy.length - 1));
          if (e.key === "ArrowLeft") setHover((h) => Math.max((h ?? xy.length) - 1, 0));
          if (e.key === "Escape") setHover(null);
        }}
      >
        {/* recessive gridlines */}
        {gridYs.map((g, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={g.Y} y2={g.Y} stroke={GRID} strokeWidth="1" />
            {g.showValue && (
              <text x={W - PAD.right + 6} y={g.Y + 3.5} fontSize="10" fill={TEXT_DIM}>
                {fmtPriceShort(g.p)}
              </text>
            )}
          </g>
        ))}

        {/* area wash + line */}
        <path d={area} fill={SERIES} opacity="0.1" />
        <path d={path} fill="none" stroke={SERIES} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* end-dot with surface ring + direct label for the last price */}
        <circle cx={last.X} cy={last.Y} r="6" fill={SURFACE} />
        <circle cx={last.X} cy={last.Y} r="4" fill={SERIES} />
        <text x={last.X + 10} y={last.Y + 4} fontSize="11" fontWeight="600" fill={TEXT_BRIGHT}>
          {fmtPriceShort(last.price)} ℏ
        </text>

        {/* x ticks */}
        {ticksX.map((t, i) => (
          <text
            key={i}
            x={t.X}
            y={H - 8}
            fontSize="10"
            fill={TEXT_DIM}
            textAnchor={i === 0 ? "start" : i === ticksX.length - 1 ? "end" : "middle"}
          >
            {fmtTime(t.t, spanT)}
          </text>
        ))}

        {/* crosshair + hovered point */}
        {hovered && (
          <g pointerEvents="none">
            <line x1={hovered.X} x2={hovered.X} y1={PAD.top} y2={H - PAD.bottom} stroke={TEXT_DIM} strokeWidth="1" opacity="0.55" />
            <circle cx={hovered.X} cy={hovered.Y} r="6" fill={SURFACE} />
            <circle cx={hovered.X} cy={hovered.Y} r="4" fill={SERIES} />
          </g>
        )}
      </svg>

      {/* tooltip (HTML, value leads, line-key carries series identity) */}
      {hovered && (
        <div
          className="chart-tooltip"
          style={{ left: `${(hovered.X / W) * 100}%` }}
        >
          <span className="chart-key" />
          <strong>{fmtPriceShort(hovered.price)} ℏ</strong>
          <span className="muted small">
            {fmtTime(hovered.t, spanT)} · {hovered.kind}
          </span>
        </div>
      )}

      {/* table view — the no-hover path to every value */}
      <details className="chart-table">
        <summary className="muted small">View as table</summary>
        <table className="table small">
          <thead>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th>Price (ℏ)</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={i}>
                <td>{new Date(p.t * 1000).toLocaleString()}</td>
                <td>{p.kind}</td>
                <td>{fmtPriceShort(p.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
