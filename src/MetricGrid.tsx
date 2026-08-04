import { CSSProperties, useState, useEffect } from "react";
import {
  getStockData,
  getForexData,
  getFEDMeetingDate,
  getCurrentFedRate,
  getIefDividendYield,
  getETFWeeklyNetTotalReturn,
  type WeeklyNetReturnPoint,
} from "./services/yfinance";

// ── Types ────────────────────────────────────────────────────────────────────

type TrendDirection = "up" | "down" | "flat";

interface Metric {
  label: string;
  value: string;
  trendLabel: string;
  trendDirection: TrendDirection;
  /** Override automatic color (e.g. "down" trend that is actually good, like latency) */
  trendSentiment?: "positive" | "negative" | "neutral";
  /** Previous/last value to display in red (for comparison) */
  lastValue?: string;
  /** Hide trend label and icon */
  hideTrend?: boolean;
  /** Current price for price-tracking metrics */
  currentPrice?: string;
  /** Last price for price-tracking metrics */
  lastPriceValue?: string;
}

interface Ticker {
  symbol: string;
  label: string;
}

interface IVVChartPoint {
  date: string;
  cumulativeReturnPct: number;
}

// ── Sample data — replace with your real metrics ─────────────────────────────

const SAMPLE_METRICS: Metric[] = [
  {
    label: "IVV Today Return",
    value: "Loading...",
    trendLabel: "Today",
    trendDirection: "flat",
    trendSentiment: "neutral",
    hideTrend: true,
  },
  {
    label: "USDCLP Today Return",
    value: "Loading...",
    trendLabel: "Today",
    trendDirection: "flat",
    trendSentiment: "neutral",
    hideTrend: true,
  },
  {
    label: "IVV 52W High",
    value: "Loading...",
    trendLabel: "All Time",
    trendDirection: "flat",
    trendSentiment: "neutral",
  },
  {
    label: "IVV 52W Gain",
    value: "Loading...",
    trendLabel: "From Low",
    trendDirection: "flat",
    trendSentiment: "neutral",
  },
  {
    label: "Next FED Meeting",
    value: "July 29th 2026 ",
    trendLabel: "Pending",
    trendDirection: "flat",
    trendSentiment: "neutral",
  },
  {
    label: "Portfolio Performance Today",
    value: "0.0%",
    trendLabel: "0%",
    trendDirection: "up",
    trendSentiment: "negative",
  },
  {
    label: "S&P 500 Index All Time High",
    value: "10.0%",
    trendLabel: "SLA met",
    trendDirection: "flat",
    trendSentiment: "positive",
  },
  {
    label: "FED Rate",
    value: "Loading...",
    trendLabel: "Target range",
    trendDirection: "flat",
    trendSentiment: "neutral",
  },
  {
    label: "IEF ETF Dividend Yield",
    value: "Loading...",
    trendLabel: "12m trailing yield",
    trendDirection: "flat",
    trendSentiment: "neutral",
  },
  // Stock ticker cards will be added dynamically from tickers.json
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveSentimentColor(metric: Metric): string {
  // Explicit override takes priority over the default up=green/down=red mapping
  const sentiment =
    metric.trendSentiment ??
    (metric.trendDirection === "up"
      ? "positive"
      : metric.trendDirection === "down"
        ? "negative"
        : "neutral");

  switch (sentiment) {
    case "positive":
      return "var(--text-success)";
    case "negative":
      return "var(--text-danger)";
    default:
      return "var(--text-muted)";
  }
}

function trendIconClass(direction: TrendDirection): string {
  switch (direction) {
    case "up":
      return "ti-arrow-up-right";
    case "down":
      return "ti-arrow-down-right";
    default:
      return "ti-minus";
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "2rem",
    paddingBottom: "1.5rem",
    borderBottom: "2px solid rgba(255, 255, 255, 0.1)",
  } satisfies CSSProperties,

  title: {
    fontSize: 32,
    fontWeight: 700,
    margin: 0,
    background: "linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  } satisfies CSSProperties,

  subtitle: {
    fontSize: 14,
    color: "var(--text-secondary)",
    margin: "6px 0 0",
    fontWeight: 500,
  } satisfies CSSProperties,

  refreshBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0.85rem 1.6rem",
    background:
      "linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)",
    color: "white",
    border: "none",
    borderRadius: "var(--radius)",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    boxShadow: "0 4px 15px rgba(99, 102, 241, 0.3)",
  } satisfies CSSProperties,

  buttonGroup: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  } satisfies CSSProperties,

  logoutBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0.85rem 1.6rem",
    background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    color: "white",
    border: "none",
    borderRadius: "var(--radius)",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    boxShadow: "0 4px 15px rgba(239, 68, 68, 0.3)",
  } satisfies CSSProperties,

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
  } satisfies CSSProperties,

  card: {
    background: "#87CEFA",
    borderRadius: "var(--radius)",
    padding: "1rem 1.5rem",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.6)",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    cursor: "pointer",
    position: "relative" as const,
    overflow: "hidden" as const,
  } satisfies CSSProperties,

  cardLabel: {
    fontSize: 14,
    background:
      "linear-gradient(135deg, var(--primary) 0%, var(--accent-cyan) 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    margin: "0 0 12px",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  } satisfies CSSProperties,

  cardValue: {
    fontSize: 38,
    fontWeight: 700,
    margin: 0,
    color: "#0f172a",
  } satisfies CSSProperties,

  cardLastValue: {
    fontSize: 17,
    fontWeight: 600,
    margin: "6px 0 0",
    color: "#ef4444",
  } satisfies CSSProperties,

  cardPriceContainer: {
    fontSize: 14,
    margin: "10px 0 0",
    display: "flex",
    gap: "14px",
    flexWrap: "wrap" as const,
  } satisfies CSSProperties,

  cardPrice: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: 500,
  } satisfies CSSProperties,

  cardTrend: {
    fontSize: 15,
    margin: "12px 0 0",
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontWeight: 600,
  } satisfies CSSProperties,

  chartWrap: {
    marginTop: "2rem",
    background: "rgba(135, 206, 250, 0.2)",
    borderRadius: "var(--radius)",
    padding: "1rem 1.25rem",
    border: "1px solid rgba(255, 255, 255, 0.2)",
  } satisfies CSSProperties,

  chartTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: "#e2e8f0",
  } satisfies CSSProperties,

  chartSubtitle: {
    margin: "4px 0 12px",
    fontSize: 13,
    color: "#cbd5e1",
  } satisfies CSSProperties,

  chartEmpty: {
    margin: 0,
    fontSize: 14,
    color: "#cbd5e1",
  } satisfies CSSProperties,

  chartKpiRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap" as const,
    marginBottom: 10,
  } satisfies CSSProperties,

  chartKpiBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "#e2e8f0",
    background: "rgba(15, 23, 42, 0.35)",
    border: "1px solid rgba(148, 163, 184, 0.35)",
    borderRadius: 999,
    padding: "4px 10px",
    fontWeight: 600,
  } satisfies CSSProperties,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({ metric }: { metric: Metric }): React.JSX.Element {
  const trendColor = resolveSentimentColor(metric);
  const iconClass = trendIconClass(metric.trendDirection);

  return (
    <div style={S.card} data-metric-card>
      <p style={S.cardLabel}>{metric.label}</p>
      <p style={S.cardValue}>{metric.value}</p>
      {metric.lastValue && <p style={S.cardLastValue}>{metric.lastValue}</p>}
      {(metric.currentPrice || metric.lastPriceValue) && (
        <div style={S.cardPriceContainer}>
          {metric.currentPrice && (
            <span style={S.cardPrice}>Now: {metric.currentPrice}</span>
          )}
          {metric.lastPriceValue && (
            <span style={S.cardPrice}>Was: {metric.lastPriceValue}</span>
          )}
        </div>
      )}
      {!metric.hideTrend && (
        <p style={{ ...S.cardTrend, color: trendColor }}>
          <i
            className={`ti ${iconClass}`}
            style={{ fontSize: 14 }}
            aria-hidden="true"
          />
          {metric.trendLabel}
        </p>
      )}
    </div>
  );
}

function NetReturnLineChart({
  usdPoints,
  clpPoints,
  benchmarkPoints = [],
  benchmarkLabel = "Benchmark Net Return",
}: {
  usdPoints: IVVChartPoint[];
  clpPoints: IVVChartPoint[];
  benchmarkPoints?: IVVChartPoint[];
  benchmarkLabel?: string;
}): React.JSX.Element {
  if (
    usdPoints.length < 2 &&
    clpPoints.length < 2 &&
    benchmarkPoints.length < 2
  ) {
    return <p style={S.chartEmpty}>Not enough data to render chart.</p>;
  }

  const width = 960;
  const height = 300;
  const padX = 42;
  const padY = 24;

  const allPoints = [...usdPoints, ...clpPoints, ...benchmarkPoints];
  const minY = Math.min(...allPoints.map((p) => p.cumulativeReturnPct));
  const maxY = Math.max(...allPoints.map((p) => p.cumulativeReturnPct));
  const spanY = maxY - minY || 1;

  const parseDateTs = (dateStr: string): number =>
    new Date(`${dateStr}T00:00:00`).getTime();
  const allTimestamps = allPoints
    .map((p) => parseDateTs(p.date))
    .filter((ts) => Number.isFinite(ts));
  const minTs = allTimestamps.length > 0 ? Math.min(...allTimestamps) : 0;
  const maxTs = allTimestamps.length > 0 ? Math.max(...allTimestamps) : 1;
  const spanTs = Math.max(maxTs - minTs, 1);

  const mapToXY = (points: IVVChartPoint[]) =>
    points.map((p) => {
      const ts = parseDateTs(p.date);
      const x = padX + ((ts - minTs) / spanTs) * (width - padX * 2);
      const y =
        height -
        padY -
        ((p.cumulativeReturnPct - minY) / spanY) * (height - padY * 2);
      return { ...p, x, y };
    });

  const usdXY = mapToXY(usdPoints);
  const clpXY = mapToXY(clpPoints);
  const benchmarkXY = mapToXY(benchmarkPoints);

  const buildPath = (points: Array<IVVChartPoint & { x: number; y: number }>) =>
    points
      .map(
        (p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`,
      )
      .join(" ");

  const usdPath = buildPath(usdXY);
  const clpPath = buildPath(clpXY);
  const usdLastPoint = usdXY[usdXY.length - 1];
  const clpLastPoint = clpXY[clpXY.length - 1];
  const lastLabelsOverlap =
    usdLastPoint && clpLastPoint
      ? Math.abs(usdLastPoint.y - clpLastPoint.y) < 16
      : false;

  const yTicks = 5;
  const tickValues = Array.from(
    { length: yTicks },
    (_, i) => minY + (spanY * i) / (yTicks - 1),
  );
  const hasZeroReference = minY <= 0 && maxY >= 0;
  const zeroY = height - padY - ((0 - minY) / spanY) * (height - padY * 2);

  const axisStartDate = usdPoints[0]?.date || clpPoints[0]?.date || "";
  const axisEndDate =
    usdPoints[usdPoints.length - 1]?.date ||
    clpPoints[clpPoints.length - 1]?.date ||
    "";
  const boundaryDateY = height - padY - 20;

  const startYear = Number(axisStartDate.slice(0, 4));
  const endYear = Number(axisEndDate.slice(0, 4));
  const yearlyJanuaryTicks: Array<{ x: number; year: string }> =
    Number.isFinite(startYear) && Number.isFinite(endYear)
      ? Array.from({ length: Math.max(endYear - startYear + 1, 0) }, (_, i) => {
          const year = startYear + i;
          const ts = new Date(`${year}-01-01T00:00:00`).getTime();
          const x = padX + ((ts - minTs) / spanTs) * (width - padX * 2);
          return { x, year: String(year) };
        }).filter(
          (tick, i, arr) =>
            tick.x >= padX &&
            tick.x <= width - padX &&
            (i === 0 || tick.x - arr[i - 1].x >= 28),
        )
      : [];

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 14,
          alignItems: "center",
          marginBottom: 8,
          color: "#cbd5e1",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 16,
              height: 2,
              background: "#22d3ee",
              display: "inline-block",
            }}
          />
          USD Net Return
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 16,
              height: 2,
              background: "#f59e0b",
              display: "inline-block",
            }}
          />
          CLP Net Return
        </span>
        {benchmarkPoints.length > 1 && (
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <span
              style={{
                width: 16,
                height: 2,
                background: "#34d399",
                display: "inline-block",
              }}
            />
            {benchmarkLabel}
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "auto" }}
      >
        <rect x="0" y="0" width={width} height={height} fill="transparent" />

        {tickValues.map((v, i) => {
          const y = height - padY - ((v - minY) / spanY) * (height - padY * 2);
          return (
            <g key={`y-tick-${i}`}>
              <line
                x1={padX}
                y1={y}
                x2={width - padX}
                y2={y}
                stroke="rgba(203, 213, 225, 0.28)"
                strokeWidth="1"
              />
              <text
                x={padX - 8}
                y={y + 4}
                textAnchor="end"
                fill="#cbd5e1"
                fontSize="11"
              >
                {v.toFixed(0)}%
              </text>
            </g>
          );
        })}

        {hasZeroReference && (
          <g>
            <line
              x1={padX}
              y1={zeroY}
              x2={width - padX}
              y2={zeroY}
              stroke="rgba(34, 211, 238, 0.9)"
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />
            <text
              x={width - padX - 6}
              y={zeroY - 6}
              textAnchor="end"
              fill="#67e8f9"
              fontSize="11"
              fontWeight="700"
            >
              0%
            </text>
          </g>
        )}

        <line
          x1={padX}
          y1={height - padY}
          x2={width - padX}
          y2={height - padY}
          stroke="rgba(203, 213, 225, 0.5)"
          strokeWidth="1"
        />

        {usdXY.length > 1 && (
          <>
            <path d={usdPath} fill="none" stroke="#22d3ee" strokeWidth="2.5" />
            <circle
              cx={usdXY[usdXY.length - 1].x}
              cy={usdXY[usdXY.length - 1].y}
              r="4"
              fill="#22d3ee"
            />
            <text
              x={usdLastPoint.x - 8}
              y={usdLastPoint.y + (lastLabelsOverlap ? -10 : -8)}
              fill="#22d3ee"
              fontSize="11"
              fontWeight="700"
              textAnchor="end"
            >
              USD {usdLastPoint.cumulativeReturnPct.toFixed(2)}%
            </text>
          </>
        )}

        {clpXY.length > 1 && (
          <>
            <path d={clpPath} fill="none" stroke="#f59e0b" strokeWidth="2.5" />
            <circle
              cx={clpXY[clpXY.length - 1].x}
              cy={clpXY[clpXY.length - 1].y}
              r="4"
              fill="#f59e0b"
            />
            <text
              x={clpLastPoint.x - 8}
              y={clpLastPoint.y + (lastLabelsOverlap ? 14 : -8)}
              fill="#f59e0b"
              fontSize="11"
              fontWeight="700"
              textAnchor="end"
            >
              CLP {clpLastPoint.cumulativeReturnPct.toFixed(2)}%
            </text>
          </>
        )}

        {benchmarkXY.length > 1 && (
          <>
            <path
              d={buildPath(benchmarkXY)}
              fill="none"
              stroke="#34d399"
              strokeWidth="2.5"
            />
            <circle
              cx={benchmarkXY[benchmarkXY.length - 1].x}
              cy={benchmarkXY[benchmarkXY.length - 1].y}
              r="4"
              fill="#34d399"
            />
            <text
              x={benchmarkXY[benchmarkXY.length - 1].x - 8}
              y={benchmarkXY[benchmarkXY.length - 1].y - 8}
              fill="#34d399"
              fontSize="11"
              fontWeight="700"
              textAnchor="end"
            >
              IEF{" "}
              {benchmarkXY[benchmarkXY.length - 1].cumulativeReturnPct.toFixed(
                2,
              )}
              %
            </text>
          </>
        )}

        <text
          x={padX}
          y={boundaryDateY}
          fill="#cbd5e1"
          fontSize="11"
          fontWeight="700"
          textAnchor="start"
        >
          {axisStartDate}
        </text>

        {yearlyJanuaryTicks.map((tick) => (
          <g key={`x-year-${tick.year}`}>
            <line
              x1={tick.x}
              y1={height - padY}
              x2={tick.x}
              y2={height - padY + 5}
              stroke="rgba(203, 213, 225, 0.55)"
              strokeWidth="1"
            />
            <text
              x={tick.x}
              y={height - 6}
              fill="#cbd5e1"
              fontSize="10"
              textAnchor="middle"
            >
              {tick.year}
            </text>
          </g>
        ))}

        <text
          x={width - padX}
          y={boundaryDateY}
          fill="#cbd5e1"
          fontSize="11"
          fontWeight="700"
          textAnchor="end"
        >
          {axisEndDate}
        </text>
      </svg>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface MetricGridProps {
  metrics?: Metric[];
  title?: string;
  subtitle?: string;
  onRefresh?: () => void;
  onLogout?: () => void;
}

export default function MetricGrid({
  metrics: metricsProps = SAMPLE_METRICS,
  title = "Dashboard for Gabriel Tekken Trading Strategies",
  subtitle = "Last updated just now",
  onRefresh: onRefreshProp,
  onLogout: onLogoutProp,
}: MetricGridProps): React.JSX.Element {
  const [metrics, setMetrics] = useState<Metric[]>(metricsProps);
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [ivvWeeklyNetReturn, setIvvWeeklyNetReturn] = useState<IVVChartPoint[]>(
    [],
  );
  const [ivvWeeklyNetReturnClp, setIvvWeeklyNetReturnClp] = useState<
    IVVChartPoint[]
  >([]);
  const [iywWeeklyNetReturn, setIywWeeklyNetReturn] = useState<IVVChartPoint[]>(
    [],
  );
  const [iywWeeklyNetReturnClp, setIywWeeklyNetReturnClp] = useState<
    IVVChartPoint[]
  >([]);
  const [iefWeeklyNetReturn, setIefWeeklyNetReturn] = useState<IVVChartPoint[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [ivvLiveWtd, setIvvLiveWtd] = useState<number | null>(null);
  const [ivvLiveClpWtd, setIvvLiveClpWtd] = useState<number | null>(null);
  const [iywLiveWtd, setIywLiveWtd] = useState<number | null>(null);
  const [iywLiveClpWtd, setIywLiveClpWtd] = useState<number | null>(null);

  // Load tickers from JSON file on component mount
  useEffect(() => {
    const loadTickers = async () => {
      try {
        const response = await fetch("/tickers.json");
        const data = await response.json();
        setTickers(data.tickers);

        // Add ticker metrics to the base metrics
        const baseMetrics = [...metricsProps];
        const tickerMetrics = data.tickers.map((ticker: Ticker) => ({
          label: ticker.label,
          value: "Loading...",
          trendLabel: "Today",
          trendDirection: "flat" as TrendDirection,
          trendSentiment: "neutral" as const,
        }));
        setMetrics([...baseMetrics, ...tickerMetrics]);
      } catch (error) {
        console.error("Error loading tickers:", error);
        // Use base metrics if loading fails
      }
    };
    loadTickers();
  }, [metricsProps]);

  const fetchMarketData = async () => {
    setLoading(true);
    const updatedMetrics = [...metrics]; // Use current metrics to preserve lastValue history

    try {
      const [ivvResult, iywResult, usdclpResult] = await Promise.allSettled([
        getStockData("IVV"),
        getStockData("IYW"),
        getForexData("USDCLP=X"),
      ]);

      const ivvData = ivvResult.status === "fulfilled" ? ivvResult.value : null;
      const iywData = iywResult.status === "fulfilled" ? iywResult.value : null;
      const usdclpData =
        usdclpResult.status === "fulfilled" ? usdclpResult.value : null;

      if (ivvData) {
        const ivvTodayReturn = ivvData.changePercent;
        const ivv52wGain = ivvData.fiftyTwoWeekChangePercent;

        updatedMetrics[0] = {
          ...updatedMetrics[0],
          lastValue:
            updatedMetrics[0].value === "Loading..."
              ? undefined
              : updatedMetrics[0].value,
          lastPriceValue: updatedMetrics[0].currentPrice,
          currentPrice: `$${ivvData.currentPrice.toFixed(2)}`,
          value: `${ivvTodayReturn}%`,
          trendLabel: `${ivvTodayReturn}%`,
          trendDirection:
            parseFloat(ivvTodayReturn as any) >= 0 ? "up" : "down",
          trendSentiment:
            parseFloat(ivvTodayReturn as any) >= 0 ? "positive" : "negative",
          hideTrend: true,
        };

        updatedMetrics[2] = {
          ...updatedMetrics[2],
          value: `$${ivvData.fiftyTwoWeekHigh.toFixed(2)}`,
          trendLabel: "52W High",
        };

        updatedMetrics[3] = {
          ...updatedMetrics[3],
          value: `${ivv52wGain}%`,
          trendLabel: `From $${ivvData.fiftyTwoWeekLow.toFixed(2)}`,
          trendDirection: parseFloat(ivv52wGain as any) >= 0 ? "up" : "down",
          trendSentiment: "positive",
        };
      } else {
        console.error("Error fetching IVV core data:", ivvResult);
        updatedMetrics[0] = {
          ...updatedMetrics[0],
          value: "N/A",
          trendLabel: "Unavailable",
          trendDirection: "flat",
          trendSentiment: "neutral",
          hideTrend: true,
        };
      }

      if (iywData) {
        setIywLiveWtd(iywData.weekToDateChangePercent);
      } else {
        console.error("Error fetching IYW core data:", iywResult);
        setIywLiveWtd(null);
      }

      if (usdclpData) {
        const usdclpTodayReturn = usdclpData.changePercent;
        updatedMetrics[1] = {
          ...updatedMetrics[1],
          lastValue:
            updatedMetrics[1].value === "Loading..."
              ? undefined
              : updatedMetrics[1].value,
          lastPriceValue: updatedMetrics[1].currentPrice,
          currentPrice: `$${usdclpData.lastPrice.toFixed(2)}`,
          value: `${usdclpTodayReturn}%`,
          trendLabel: `${usdclpTodayReturn}%`,
          trendDirection:
            parseFloat(usdclpTodayReturn as any) >= 0 ? "up" : "down",
          trendSentiment:
            parseFloat(usdclpTodayReturn as any) >= 0 ? "positive" : "negative",
          hideTrend: true,
        };
      } else {
        console.error("Error fetching USDCLP forex core data:", usdclpResult);
        updatedMetrics[1] = {
          ...updatedMetrics[1],
          value: "N/A",
          trendLabel: "Unavailable",
          trendDirection: "flat",
          trendSentiment: "neutral",
          hideTrend: true,
        };
      }

      if (ivvData && usdclpData) {
        const ivvWtdUsd = ivvData.weekToDateChangePercent;
        const usdclpWtd = usdclpData.weekToDateChangePercent;
        const ivvWtdClp =
          ((1 + ivvWtdUsd / 100) * (1 + usdclpWtd / 100) - 1) * 100;
        setIvvLiveWtd(ivvWtdUsd);
        setIvvLiveClpWtd(ivvWtdClp);
      } else {
        setIvvLiveWtd(null);
        setIvvLiveClpWtd(null);
      }

      if (iywData && usdclpData) {
        const iywWtdUsd = iywData.weekToDateChangePercent;
        const usdclpWtd = usdclpData.weekToDateChangePercent;
        const iywWtdClp =
          ((1 + iywWtdUsd / 100) * (1 + usdclpWtd / 100) - 1) * 100;
        setIywLiveWtd(iywWtdUsd);
        setIywLiveClpWtd(iywWtdClp);
      } else {
        setIywLiveClpWtd(null);
      }

      // Fetch next FED meeting date
      try {
        const fedMeetingData = await getFEDMeetingDate();
        updatedMetrics[4] = {
          ...updatedMetrics[4],
          value: fedMeetingData.formattedDate,
          trendLabel: `${fedMeetingData.daysUntil} days away`,
          trendDirection:
            fedMeetingData.daysUntil <= 7
              ? "up"
              : fedMeetingData.daysUntil <= 30
                ? "flat"
                : "down",
          trendSentiment: "neutral",
        };
      } catch (fedError) {
        console.error("Error fetching FED meeting date:", fedError);
        updatedMetrics[4] = {
          ...updatedMetrics[4],
          value: "N/A",
          trendLabel: "Unavailable",
          trendDirection: "flat",
          trendSentiment: "neutral",
        };
      }

      try {
        const fedRateData = await getCurrentFedRate();
        updatedMetrics[7] = {
          ...updatedMetrics[7],
          value: fedRateData.currentRange,
          trendLabel: fedRateData.label || "Target range",
          trendDirection: "flat",
          trendSentiment: "neutral",
        };
      } catch (fedRateError) {
        console.error("Error fetching Fed rate:", fedRateError);
        updatedMetrics[7] = {
          ...updatedMetrics[7],
          value: "N/A",
          trendLabel: "Unavailable",
          trendDirection: "flat",
          trendSentiment: "neutral",
        };
      }

      try {
        const iefYieldData = await getIefDividendYield();
        updatedMetrics[8] = {
          ...updatedMetrics[8],
          value: iefYieldData.dividendYield,
          trendLabel: iefYieldData.label || "12m trailing yield",
          trendDirection: "flat",
          trendSentiment: "neutral",
        };
      } catch (iefYieldError) {
        console.error("Error fetching IEF yield:", iefYieldError);
        updatedMetrics[8] = {
          ...updatedMetrics[8],
          value: "N/A",
          trendLabel: "Unavailable",
          trendDirection: "flat",
          trendSentiment: "neutral",
        };
      }

      if (ivvData && usdclpData) {
        updatedMetrics[5] = {
          ...updatedMetrics[5],
          value: `${(((1 + ivvData.changePercent / 100) * (1 + usdclpData.changePercent / 100) - 1) * 100).toFixed(4)}%`,
          trendLabel: "TEST",
        };
      }

      if (ivvData) {
        updatedMetrics[6] = {
          ...updatedMetrics[6],
          value: `${((ivvData.fiftyTwoWeekHigh / ivvData.currentPrice - 1) * 100).toFixed(4)}%`,
          trendLabel: "TEST",
        };
      }

      // Fetch stocks from tickers array; do not fail all cards if one ticker fails
      const baseMetricsCount = 9; // Indices 0-8 are base metrics
      const tickerDataArray = await Promise.allSettled(
        tickers.map((ticker) => getStockData(ticker.symbol)),
      );

      // Update metrics for stock tickers (starting from index 10)
      tickerDataArray.forEach((stockResult, index) => {
        const metricIndex = baseMetricsCount + index;
        const baseMetric: Metric = updatedMetrics[metricIndex] ?? {
          label: tickers[index]?.label ?? tickers[index]?.symbol ?? "Ticker",
          value: "N/A",
          trendLabel: "N/A",
          trendDirection: "flat",
          trendSentiment: "neutral",
        };

        if (stockResult.status !== "fulfilled") {
          updatedMetrics[metricIndex] = {
            ...baseMetric,
            value: "N/A",
            trendLabel: "Unavailable",
            trendDirection: "flat",
            trendSentiment: "neutral",
          };
          return;
        }

        const stockData = stockResult.value;
        updatedMetrics[metricIndex] = {
          ...baseMetric,
          value: `$${stockData.currentPrice.toFixed(2)}`,
          trendLabel: `${stockData.changePercent}%`,
          trendDirection:
            parseFloat(stockData.changePercent as any) >= 0 ? "up" : "down",
          trendSentiment:
            parseFloat(stockData.changePercent as any) >= 0
              ? "positive"
              : "negative",
        };
      });

      setMetrics(updatedMetrics);
    } catch (error) {
      console.error("Error fetching market data:", error);
      setMetrics(updatedMetrics);
    } finally {
      setLoading(false);
    }
  };

  const fetchEtfWeeklyNetReturn = async (
    symbol: string,
    setUsd: React.Dispatch<React.SetStateAction<IVVChartPoint[]>>,
    setClp?: React.Dispatch<React.SetStateAction<IVVChartPoint[]>>,
  ) => {
    try {
      const { pointsUsd, pointsClp } = await getETFWeeklyNetTotalReturn(symbol);
      setUsd(
        pointsUsd.map((p: WeeklyNetReturnPoint) => ({
          date: p.date,
          cumulativeReturnPct: p.cumulativeReturnPct,
        })),
      );
      if (setClp) {
        setClp(
          pointsClp.map((p: WeeklyNetReturnPoint) => ({
            date: p.date,
            cumulativeReturnPct: p.cumulativeReturnPct,
          })),
        );
      }
    } catch (error) {
      console.error(`Error fetching ${symbol} weekly net return chart:`, error);
      setUsd([]);
      if (setClp) {
        setClp([]);
      }
    }
  };

  // Fetch market data when tickers are loaded
  useEffect(() => {
    fetchMarketData();
    fetchEtfWeeklyNetReturn(
      "IVV",
      setIvvWeeklyNetReturn,
      setIvvWeeklyNetReturnClp,
    );
    fetchEtfWeeklyNetReturn(
      "IYW",
      setIywWeeklyNetReturn,
      setIywWeeklyNetReturnClp,
    );
    fetchEtfWeeklyNetReturn("IEF", setIefWeeklyNetReturn);
  }, [tickers]);

  const handleRefresh = () => {
    fetchMarketData();
    fetchEtfWeeklyNetReturn(
      "IVV",
      setIvvWeeklyNetReturn,
      setIvvWeeklyNetReturnClp,
    );
    fetchEtfWeeklyNetReturn(
      "IYW",
      setIywWeeklyNetReturn,
      setIywWeeklyNetReturnClp,
    );
    fetchEtfWeeklyNetReturn("IEF", setIefWeeklyNetReturn);
    if (onRefreshProp) onRefreshProp();
  };

  const START_2023 = "2023-01-01";
  const normalizeFromZero = (points: IVVChartPoint[]): IVVChartPoint[] => {
    if (points.length === 0) return [];
    const base = points[0].cumulativeReturnPct;
    return points.map((p) => ({
      ...p,
      cumulativeReturnPct:
        ((1 + p.cumulativeReturnPct / 100) / (1 + base / 100) - 1) * 100,
    }));
  };
  const ivvWeeklyNetReturnFrom2023 = normalizeFromZero(
    ivvWeeklyNetReturn.filter((p) => p.date >= START_2023),
  );
  const ivvWeeklyNetReturnClpFrom2023 = normalizeFromZero(
    ivvWeeklyNetReturnClp.filter((p) => p.date >= START_2023),
  );
  const iywWeeklyNetReturnFrom2023 = normalizeFromZero(
    iywWeeklyNetReturn.filter((p) => p.date >= START_2023),
  );
  const iywWeeklyNetReturnClpFrom2023 = normalizeFromZero(
    iywWeeklyNetReturnClp.filter((p) => p.date >= START_2023),
  );
  const iefWeeklyNetReturnFrom2023 = normalizeFromZero(
    iefWeeklyNetReturn.filter((p) => p.date >= START_2023),
  );

  const computePeriodReturn = (
    points: IVVChartPoint[],
    periodStartDate: string,
  ): number | null => {
    if (points.length === 0) return null;
    const parsedPoints = points
      .map((p) => ({
        ...p,
        ts: new Date(`${p.date}T00:00:00`).getTime(),
      }))
      .filter((p) => Number.isFinite(p.ts))
      .sort((a, b) => a.ts - b.ts);
    if (parsedPoints.length === 0) return null;

    const startTs = new Date(`${periodStartDate}T00:00:00`).getTime();
    if (!Number.isFinite(startTs)) return null;

    const latest = parsedPoints[parsedPoints.length - 1].cumulativeReturnPct;
    if (parsedPoints[parsedPoints.length - 1].ts < startTs) return null;

    let start = parsedPoints[0].cumulativeReturnPct;
    if (startTs <= parsedPoints[0].ts) {
      start = parsedPoints[0].cumulativeReturnPct;
    } else {
      for (let i = 0; i < parsedPoints.length - 1; i++) {
        const left = parsedPoints[i];
        const right = parsedPoints[i + 1];
        if (startTs === left.ts) {
          start = left.cumulativeReturnPct;
          break;
        }
        if (startTs > left.ts && startTs <= right.ts) {
          const span = right.ts - left.ts;
          const weight = span > 0 ? (startTs - left.ts) / span : 0;
          start =
            left.cumulativeReturnPct +
            (right.cumulativeReturnPct - left.cumulativeReturnPct) * weight;
          break;
        }
      }
    }

    const latestFactor = 1 + latest / 100;
    const startFactor = 1 + start / 100;
    if (startFactor <= 0) return null;
    return (latestFactor / startFactor - 1) * 100;
  };

  const nowNy = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  const formatDate = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const ytdStart = `${nowNy.getFullYear()}-01-01`;
  const mtdStart = `${nowNy.getFullYear()}-${String(nowNy.getMonth() + 1).padStart(2, "0")}-01`;
  const weekStartNy = new Date(nowNy);
  const daysSinceMonday = (weekStartNy.getDay() + 6) % 7;
  weekStartNy.setDate(weekStartNy.getDate() - daysSinceMonday);
  const wtdStart = formatDate(weekStartNy);

  const ivvYtd = computePeriodReturn(ivvWeeklyNetReturn, ytdStart);
  const ivvMtd = computePeriodReturn(ivvWeeklyNetReturn, mtdStart);
  const ivvWtdFromSeries = computePeriodReturn(ivvWeeklyNetReturn, wtdStart);
  const ivvClpYtd = computePeriodReturn(ivvWeeklyNetReturnClp, ytdStart);
  const ivvClpMtd = computePeriodReturn(ivvWeeklyNetReturnClp, mtdStart);
  const ivvClpWtdFromSeries = computePeriodReturn(
    ivvWeeklyNetReturnClp,
    wtdStart,
  );
  const iywYtd = computePeriodReturn(iywWeeklyNetReturn, ytdStart);
  const iywMtd = computePeriodReturn(iywWeeklyNetReturn, mtdStart);
  const iywWtdFromSeries = computePeriodReturn(iywWeeklyNetReturn, wtdStart);
  const iywClpYtd = computePeriodReturn(iywWeeklyNetReturnClp, ytdStart);
  const iywClpMtd = computePeriodReturn(iywWeeklyNetReturnClp, mtdStart);
  const iywClpWtdFromSeries = computePeriodReturn(
    iywWeeklyNetReturnClp,
    wtdStart,
  );

  const ivvWtd = ivvLiveWtd ?? ivvWtdFromSeries;
  const ivvClpWtd = ivvLiveClpWtd ?? ivvClpWtdFromSeries;
  const iywWtd = iywLiveWtd ?? iywWtdFromSeries;
  const iywClpWtd = iywLiveClpWtd ?? iywClpWtdFromSeries;

  const formatReturn = (value: number | null): string => {
    if (value === null || Number.isNaN(value)) return "N/A";
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  return (
    <div>
      <div style={S.header}>
        <div>
          <p style={S.title}>{title}</p>
          <p style={S.subtitle}>{subtitle}</p>
        </div>
        <div style={S.buttonGroup}>
          <button onClick={handleRefresh} style={S.refreshBtn} data-refresh-btn>
            <i
              className="ti ti-refresh"
              style={{ fontSize: 18 }}
              aria-hidden="true"
            />
            Refresh
          </button>
          {onLogoutProp && (
            <button onClick={onLogoutProp} style={S.logoutBtn}>
              <i
                className="ti ti-logout"
                style={{ fontSize: 18 }}
                aria-hidden="true"
              />
              Logout
            </button>
          )}
        </div>
      </div>

      <div style={S.grid}>
        {metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </div>

      <div style={S.chartWrap}>
        <p style={S.chartTitle}>IVV Weekly Net Total Return (Since 2010)</p>
        <p style={S.chartSubtitle}>
          USD and CLP series shown together. Dividends are reinvested net of 15%
          non-resident alien withholding tax (for Chile investors).
        </p>
        <div style={S.chartKpiRow}>
          <span style={S.chartKpiBadge}>
            WTD (Daily Live): {formatReturn(ivvWtd)}
          </span>
          <span style={S.chartKpiBadge}>MTD: {formatReturn(ivvMtd)}</span>
          <span style={S.chartKpiBadge}>YTD: {formatReturn(ivvYtd)}</span>
          <span style={S.chartKpiBadge}>
            WTD USDCLP (Daily Live): {formatReturn(ivvClpWtd)}
          </span>
          <span style={S.chartKpiBadge}>
            MTD USDCLP: {formatReturn(ivvClpMtd)}
          </span>
          <span style={S.chartKpiBadge}>
            YTD USDCLP : {formatReturn(ivvClpYtd)}
          </span>
        </div>
        <NetReturnLineChart
          usdPoints={ivvWeeklyNetReturn}
          clpPoints={ivvWeeklyNetReturnClp}
          benchmarkPoints={iefWeeklyNetReturn}
          benchmarkLabel="IEF USD Net Return"
        />
      </div>

      <div style={S.chartWrap}>
        <p style={S.chartTitle}>
          IVV Weekly Net Total Return (From Jan 1, 2023)
        </p>
        <p style={S.chartSubtitle}>
          Same USD and CLP net-return series from 2023-01-01, rebased to start
          at 0%. <br />
          Dividends are reinvested net of 15% non-resident alien withholding tax
          (for Chile investors).
        </p>
        <NetReturnLineChart
          usdPoints={ivvWeeklyNetReturnFrom2023}
          clpPoints={ivvWeeklyNetReturnClpFrom2023}
          benchmarkPoints={iefWeeklyNetReturnFrom2023}
          benchmarkLabel="IEF USD Net Return"
        />
      </div>

      <div style={S.chartWrap}>
        <p style={S.chartTitle}>IYW Weekly Net Total Return (Since 2010)</p>
        <p style={S.chartSubtitle}>
          USD and CLP series shown together. Dividends are reinvested net of 15%
          non-resident alien withholding tax (for Chile investors).
        </p>
        <div style={S.chartKpiRow}>
          <span style={S.chartKpiBadge}>
            WTD (Daily Live): {formatReturn(iywWtd)}
          </span>
          <span style={S.chartKpiBadge}>MTD: {formatReturn(iywMtd)}</span>
          <span style={S.chartKpiBadge}>YTD: {formatReturn(iywYtd)}</span>
          <span style={S.chartKpiBadge}>
            WTD USDCLP (Daily Live): {formatReturn(iywClpWtd)}
          </span>
          <span style={S.chartKpiBadge}>
            MTD USDCLP: {formatReturn(iywClpMtd)}
          </span>
          <span style={S.chartKpiBadge}>
            YTD USDCLP: {formatReturn(iywClpYtd)}
          </span>
        </div>
        <NetReturnLineChart
          usdPoints={iywWeeklyNetReturn}
          clpPoints={iywWeeklyNetReturnClp}
          benchmarkPoints={iefWeeklyNetReturn}
          benchmarkLabel="IEF USD Net Return"
        />
      </div>

      <div style={S.chartWrap}>
        <p style={S.chartTitle}>
          IYW Weekly Net Total Return (From Jan 1, 2023)
        </p>
        <p style={S.chartSubtitle}>
          Same USD and CLP net-return series from 2023-01-01, rebased to start
          at 0%. <br />
          Dividends are reinvested net of 15% non-resident alien withholding tax
          (for Chile investors).
        </p>
        <NetReturnLineChart
          usdPoints={iywWeeklyNetReturnFrom2023}
          clpPoints={iywWeeklyNetReturnClpFrom2023}
          benchmarkPoints={iefWeeklyNetReturnFrom2023}
          benchmarkLabel="IEF USD Net Return"
        />
      </div>
    </div>
  );
}

// ── Type exports — for consumers building their own metrics array ───────────

export type { Metric, TrendDirection };
