/**
 * Inline SVG line chart for engagement over time. No external chart library.
 * Renders axes, a polyline, area fill, and a hover tooltip per point. Flat
 * series fall back to a friendly empty state.
 */
import { useMemo, useState } from "react";
import type { EngagementTimeSeriesPoint } from "../../types/metrics";

type EngagementOverTimeChartProps = {
  points: readonly EngagementTimeSeriesPoint[];
};

const WIDTH = 720;
const HEIGHT = 240;
const PADDING = { top: 16, right: 24, bottom: 36, left: 56 };

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function niceMax(maxValue: number): number {
  if (maxValue <= 0) return 10;
  const exponent = Math.floor(Math.log10(maxValue));
  const fraction = maxValue / Math.pow(10, exponent);
  let nice: number;
  if (fraction <= 1) nice = 1;
  else if (fraction <= 2) nice = 2;
  else if (fraction <= 5) nice = 5;
  else nice = 10;
  return nice * Math.pow(10, exponent);
}

export default function EngagementOverTimeChart({
  points,
}: EngagementOverTimeChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const chart = useMemo(() => {
    if (points.length === 0) return null;
    const minTs = points[0].timestamp;
    const maxTs = points[points.length - 1].timestamp;
    const tsRange = Math.max(1, maxTs - minTs);
    const maxValue = points.reduce((acc, p) => Math.max(acc, p.engagement), 0);
    const yMax = niceMax(maxValue);
    const innerWidth = WIDTH - PADDING.left - PADDING.right;
    const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;

    const xs = points.map(
      (p) => PADDING.left + ((p.timestamp - minTs) / tsRange) * innerWidth
    );
    const ys = points.map(
      (p) => PADDING.top + (1 - p.engagement / yMax) * innerHeight
    );
    const linePath = points
      .map((_, i) => `${i === 0 ? "M" : "L"} ${xs[i]} ${ys[i]}`)
      .join(" ");
    const areaPath = `${linePath} L ${xs[xs.length - 1]} ${PADDING.top + innerHeight} L ${xs[0]} ${PADDING.top + innerHeight} Z`;
    return { xs, ys, linePath, areaPath, yMax, minTs, maxTs };
  }, [points]);

  if (!chart || points.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-buzz-lineMid bg-buzz-cream p-8 text-center text-sm font-medium text-buzz-inkMuted">
        No engagement data yet — once posts are linked, you'll see the trend
        here.
      </div>
    );
  }

  const yTicks = [0, chart.yMax / 2, chart.yMax];

  return (
    <div className="rounded-2xl border border-buzz-lineMid bg-buzz-paper p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-buzz-ink">Engagement over time</h3>
        <span className="text-xs font-medium text-buzz-inkMuted">
          {formatDate(chart.minTs)} → {formatDate(chart.maxTs)}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-64 w-full"
        role="img"
        aria-label="Engagement over time line chart"
        onMouseLeave={() => setHoverIdx(null)}
      >
        {yTicks.map((tick, i) => {
          const y =
            PADDING.top +
            (1 - tick / chart.yMax) * (HEIGHT - PADDING.top - PADDING.bottom);
          return (
            <g key={i}>
              <line
                x1={PADDING.left}
                x2={WIDTH - PADDING.right}
                y1={y}
                y2={y}
                stroke="#E5DCC8"
                strokeDasharray="4 4"
              />
              <text
                x={PADDING.left - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-buzz-inkMuted text-[10px] font-bold"
              >
                {Math.round(tick).toLocaleString()}
              </text>
            </g>
          );
        })}

        <path d={chart.areaPath} fill="rgba(241, 90, 60, 0.18)" />
        <path
          d={chart.linePath}
          fill="none"
          stroke="#F15A3C"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={chart.xs[i]}
              cy={chart.ys[i]}
              r={hoverIdx === i ? 5 : 3}
              fill="#F15A3C"
              stroke="white"
              strokeWidth={2}
            />
            <rect
              x={chart.xs[i] - 18}
              y={PADDING.top}
              width={36}
              height={HEIGHT - PADDING.top - PADDING.bottom}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
            />
          </g>
        ))}

        {hoverIdx != null ? (
          <g>
            <line
              x1={chart.xs[hoverIdx]}
              x2={chart.xs[hoverIdx]}
              y1={PADDING.top}
              y2={HEIGHT - PADDING.bottom}
              stroke="#F15A3C"
              strokeOpacity={0.4}
              strokeDasharray="3 3"
            />
            <g
              transform={`translate(${Math.min(
                Math.max(chart.xs[hoverIdx] - 60, PADDING.left),
                WIDTH - PADDING.right - 120
              )}, ${Math.max(chart.ys[hoverIdx] - 56, PADDING.top)})`}
            >
              <rect
                width={120}
                height={48}
                rx={8}
                fill="#1B1B1B"
                opacity={0.92}
              />
              <text
                x={12}
                y={20}
                className="fill-white text-[10px] font-bold"
              >
                {formatDate(points[hoverIdx].timestamp)}
              </text>
              <text
                x={12}
                y={36}
                className="fill-white text-xs font-black tabular-nums"
              >
                {points[hoverIdx].engagement.toLocaleString()} engagement
              </text>
            </g>
          </g>
        ) : null}
      </svg>
    </div>
  );
}
