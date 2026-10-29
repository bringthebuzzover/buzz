/**
 * Inline SVG line chart for engagement over time. No external chart library.
 * Pen panel: date range as the support line, paper-09 grid, a yellow line over
 * a yellow-faded area, and a hover tooltip per point. An empty series falls
 * back to a state panel.
 */
import { useMemo, useState } from "react";
import type { EngagementTimeSeriesPoint } from "../../types/metrics";
import { pulse } from "../../theme/palette";
import { Card, CardHeader } from "../ui/Card";
import { StatePanel } from "../ui/StatePanel";

type EngagementOverTimeChartProps = {
  points: readonly EngagementTimeSeriesPoint[];
};

const WIDTH = 720;
const HEIGHT = 240;
const PADDING = { top: 16, right: 16, bottom: 16, left: 56 };

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
      (p) => PADDING.left + ((p.timestamp - minTs) / tsRange) * innerWidth,
    );
    const ys = points.map((p) => PADDING.top + (1 - p.engagement / yMax) * innerHeight);
    const linePath = points
      .map((_, i) => `${i === 0 ? "M" : "L"} ${xs[i]} ${ys[i]}`)
      .join(" ");
    const areaPath = `${linePath} L ${xs[xs.length - 1]} ${PADDING.top + innerHeight} L ${xs[0]} ${PADDING.top + innerHeight} Z`;
    return { xs, ys, linePath, areaPath, yMax, minTs, maxTs };
  }, [points]);

  if (!chart || points.length === 0) {
    return (
      <StatePanel>
        No engagement data yet — once posts are linked, you'll see the trend here.
      </StatePanel>
    );
  }

  const yTicks = [0, chart.yMax / 2, chart.yMax];

  return (
    <Card kind="panel" pad="card">
      <CardHeader
        title="Engagement over time"
        description={`${formatDate(chart.minTs)} → ${formatDate(chart.maxTs)}`}
        className="mb-5"
      />
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-60 w-full"
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
                stroke={tick === 0 ? pulse.paper52 : pulse.paper09}
              />
              <text
                x={PADDING.left - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-quiet text-xs"
              >
                {Math.round(tick).toLocaleString()}
              </text>
            </g>
          );
        })}

        <path d={chart.areaPath} fill={pulse.yellowFaded} />
        <path
          d={chart.linePath}
          fill="none"
          stroke={pulse.yellow}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={chart.xs[i]}
              cy={chart.ys[i]}
              r={hoverIdx === i ? 5 : 3}
              fill={pulse.yellow}
              stroke={pulse.inkRaised}
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
              stroke={pulse.paper30}
              strokeDasharray="3 3"
            />
            <g
              transform={`translate(${Math.min(
                Math.max(chart.xs[hoverIdx] - 60, PADDING.left),
                WIDTH - PADDING.right - 120,
              )}, ${Math.max(chart.ys[hoverIdx] - 56, PADDING.top)})`}
            >
              <rect
                width={120}
                height={48}
                rx={8}
                fill={pulse.inkPop}
                stroke={pulse.paper09}
              />
              <text x={12} y={20} className="fill-quiet text-xs">
                {formatDate(points[hoverIdx].timestamp)}
              </text>
              <text x={12} y={36} className="fill-primary text-xs tabular-nums">
                {points[hoverIdx].engagement.toLocaleString()} engagement
              </text>
            </g>
          </g>
        ) : null}
      </svg>
    </Card>
  );
}
