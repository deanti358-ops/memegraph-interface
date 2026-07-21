import { useMemo, useRef, useState } from "react";
import type { Candle } from "../lib/tokenDetail";

/**
 * Candlestick chart, TradingView-style: green up / red down bodies with
 * wicks, a right-edge price axis, a last-price tag, and a crosshair tooltip.
 * Pure SVG, no charting library. Colors come from the design tokens.
 */

const W = 760;
const H = 340;
const PAD = { top: 12, right: 78, bottom: 22, left: 8 };
const UP = "#22c55e";
const DOWN = "#ef4444";
const GRID = "var(--chart-grid)";
const DIM = "var(--color-ink-dim)";

function fmtPrice(p: number): string {
  if (p === 0) return "0";
  if (p >= 1) return p.toLocaleString(undefined, { maximumSignificantDigits: 5 });
  return p.toPrecision(4).replace(/e-?\d+$/, (m) => `e${m.slice(1)}`);
}
function fmtTime(t: number): string {
  const d = new Date(t * 1000);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Candles({ candles }: { candles: Candle[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const model = useMemo(() => {
    if (candles.length < 1) return null;
    const lo = Math.min(...candles.map((c) => c.l));
    const hi = Math.max(...candles.map((c) => c.h));
    const span = hi - lo || hi || 1;
    const yLo = lo - span * 0.08;
    const yHi = hi + span * 0.08;

    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const slot = plotW / candles.length;
    const bodyW = Math.max(1.2, Math.min(slot * 0.66, 12));

    const x = (i: number) => PAD.left + i * slot + slot / 2;
    const y = (p: number) =>
      PAD.top + (1 - (p - yLo) / (yHi - yLo)) * plotH;

    const gridYs = [0.2, 0.4, 0.6, 0.8].map((f) => ({
      p: yLo + (yHi - yLo) * (1 - f),
      Y: PAD.top + f * plotH,
    }));

    return { x, y, slot, bodyW, gridYs, plotH };
  }, [candles]);

  if (!model) {
    return (
      <div className="py-10 text-center text-sm text-ink-dim">
        Not enough trades to chart yet.
      </div>
    );
  }

  const { x, y, slot, bodyW, gridYs } = model;
  const last = candles[candles.length - 1];
  const lastUp = last.c >= last.o;
  const hc = hover !== null ? candles[hover] : null;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.floor((px - PAD.left) / slot);
    setHover(i >= 0 && i < candles.length ? i : null);
  }

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Price candlestick chart"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {/* gridlines + right axis labels */}
        {gridYs.map((g, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={g.Y}
              y2={g.Y}
              stroke={GRID}
              strokeWidth="1"
              strokeDasharray="2 4"
            />
            <text x={W - PAD.right + 6} y={g.Y + 3.5} fontSize="10" fill={DIM}>
              {fmtPrice(g.p)}
            </text>
          </g>
        ))}

        {/* candles */}
        {candles.map((c, i) => {
          const up = c.c >= c.o;
          const col = up ? UP : DOWN;
          const cx = x(i);
          const yO = y(c.o);
          const yC = y(c.c);
          const top = Math.min(yO, yC);
          const bh = Math.max(1, Math.abs(yC - yO));
          return (
            <g key={i}>
              <line x1={cx} x2={cx} y1={y(c.h)} y2={y(c.l)} stroke={col} strokeWidth="1" />
              <rect
                x={cx - bodyW / 2}
                y={top}
                width={bodyW}
                height={bh}
                fill={col}
                rx="0.5"
              />
            </g>
          );
        })}

        {/* last-price line + tag */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(last.c)}
          y2={y(last.c)}
          stroke={lastUp ? UP : DOWN}
          strokeWidth="1"
          strokeDasharray="3 3"
          opacity="0.7"
        />
        <g>
          <rect
            x={W - PAD.right + 1}
            y={y(last.c) - 8}
            width={PAD.right - 2}
            height={16}
            fill={lastUp ? UP : DOWN}
            rx="2"
          />
          <text
            x={W - PAD.right + 5}
            y={y(last.c) + 3.5}
            fontSize="10"
            fontWeight="700"
            fill="#0b0b0f"
          >
            {fmtPrice(last.c)}
          </text>
        </g>

        {/* crosshair */}
        {hc && (
          <line
            x1={x(hover!)}
            x2={x(hover!)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            stroke={DIM}
            strokeWidth="1"
            opacity="0.5"
            pointerEvents="none"
          />
        )}

        {/* time axis: first / mid / last */}
        {[0, Math.floor(candles.length / 2), candles.length - 1].map((i, k, arr) =>
          arr.indexOf(i) === k ? (
            <text
              key={i}
              x={x(i)}
              y={H - 6}
              fontSize="9"
              fill={DIM}
              textAnchor={k === 0 ? "start" : k === arr.length - 1 ? "end" : "middle"}
            >
              {new Date(candles[i].t * 1000).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </text>
          ) : null
        )}
      </svg>

      {/* OHLC tooltip */}
      {hc && (
        <div
          className="pointer-events-none absolute left-2 top-2 rounded-lg border border-hairline bg-panel/95 px-3 py-2 font-mono text-[11px] backdrop-blur-md"
        >
          <div className="mb-1 text-ink-dim">{fmtTime(hc.t)}</div>
          <div className="flex gap-3">
            <span className="text-ink-dim">O <span className="text-ink-bright">{fmtPrice(hc.o)}</span></span>
            <span className="text-ink-dim">H <span className="text-neon-green">{fmtPrice(hc.h)}</span></span>
            <span className="text-ink-dim">L <span className="text-neon-red">{fmtPrice(hc.l)}</span></span>
            <span className="text-ink-dim">C <span style={{ color: hc.c >= hc.o ? UP : DOWN }}>{fmtPrice(hc.c)}</span></span>
          </div>
        </div>
      )}
    </div>
  );
}
