import { CSSProperties, useState, useEffect } from "react";
import {
  getStockData,
  getForexData,
  getFEDMeetingDate,
  getETFWeeklyNetTotalReturn,
  type WeeklyNetReturnPoint,
} from "./services/yfinance";
// Add alerts to work only at Regular Market Hours: 9:30 - 16:00 ET (New York time) and not on weekends or holidays.

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
    label: "USDCLP Current Rate",
    value: "Loading...",
    trendLabel: "Today",
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
    label: "S&P 500 Index in CLP All Time High",
    value: "10%",
    trendLabel: "0%",
    trendDirection: "down",
    trendSentiment: "positive",
  },
  {
    label: "Pending to Target S&P500",
    value: "5%",
    trendLabel: "stable",
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
    padding: "0.65rem 1.25rem",
    background:
      "linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)",
    color: "white",
    border: "none",
    borderRadius: "var(--radius)",
    fontSize: 14,
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
    padding: "0.65rem 1.25rem",
    background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    color: "white",
    border: "none",
    borderRadius: "var(--radius)",
    fontSize: 14,
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
}: {
  usdPoints: IVVChartPoint[];
  clpPoints: IVVChartPoint[];
}): React.JSX.Element {
  if (usdPoints.length < 2 && clpPoints.length < 2) {
    return <p style={S.chartEmpty}>Not enough data to render chart.</p>;
  }

  const width = 960;
  const height = 300;
  const padX = 42;
  const padY = 24;

  const allPoints = [...usdPoints, ...clpPoints];
  const minY = Math.min(...allPoints.map((p) => p.cumulativeReturnPct));
  const maxY = Math.max(...allPoints.map((p) => p.cumulativeReturnPct));
  const spanY = maxY - minY || 1;

  const mapToXY = (points: IVVChartPoint[]) =>
    points.map((p, i) => {
      const x =
        padX + (i / Math.max(points.length - 1, 1)) * (width - padX * 2);
      const y =
        height -
        padY -
        ((p.cumulativeReturnPct - minY) / spanY) * (height - padY * 2);
      return { ...p, x, y };
    });

  const usdXY = mapToXY(usdPoints);
  const clpXY = mapToXY(clpPoints);

  const buildPath = (points: Array<IVVChartPoint & { x: number; y: number }>) =>
    points
      .map(
        (p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`,
      )
      .join(" ");

  const usdPath = buildPath(usdXY);
  const clpPath = buildPath(clpXY);

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

  const axisPoints =
    usdPoints.length >= clpPoints.length ? usdPoints : clpPoints;
  const yearlyJanuaryTicks = axisPoints
    .map((p, i) => ({ point: p, index: i }))
    .filter(({ point }) => {
      const d = new Date(`${point.date}T00:00:00`);
      return Number.isFinite(d.getTime()) && d.getMonth() === 0;
    })
    .map(({ point, index }) => {
      const x =
        padX +
        (index / Math.max(axisPoints.length - 1, 1)) * (width - padX * 2);
      const year = point.date.slice(0, 4);
      return { x, year };
    })
    // Keep a small minimum spacing to avoid label overlap on short ranges.
    .filter((tick, i, arr) => i === 0 || tick.x - arr[i - 1].x >= 28);

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
  title = "Dashboard for Trading Strategies",
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
  const [loading, setLoading] = useState(true);

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
    try {
      // Fetch IVV (S&P 500 ETF) data
      const ivvData = await getStockData("IVV");
      const ivvTodayReturn = ivvData.changePercent;
      const ivv52wGain = ivvData.fiftyTwoWeekChangePercent;

      // Fetch USDCLP forex data
      const usdclpData = await getForexData("USDCLP=X");
      const usdclpTodayReturn = usdclpData.changePercent;

      // Update metrics with real data
      const updatedMetrics = [...metrics]; // Use current metrics to preserve lastValue history
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
        trendDirection: parseFloat(ivvTodayReturn as any) >= 0 ? "up" : "down",
        trendSentiment:
          parseFloat(ivvTodayReturn as any) >= 0 ? "positive" : "negative",
        hideTrend: true,
      };

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

      updatedMetrics[4] = {
        ...updatedMetrics[4],
        value: `$${usdclpData.lastPrice.toFixed(2)}`,
        trendLabel: "Today",
      };

      // Fetch next FED meeting date
      try {
        const fedMeetingData = await getFEDMeetingDate();
        updatedMetrics[5] = {
          ...updatedMetrics[5],
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
        // Keep the default "TBD" value
      }

      updatedMetrics[6] = {
        ...updatedMetrics[6],
        value: `${(((1 + ivvData.changePercent / 100) * (1 + usdclpTodayReturn / 100) - 1) * 100).toFixed(4)}%`,
        trendLabel: "TEST",
      };

      // Fetch stocks from tickers array; do not fail all cards if one ticker fails
      const baseMetricsCount = 10; // Indices 0-9 are base metrics
      const tickerDataArray = await Promise.allSettled(
        tickers.map((ticker) => getStockData(ticker.symbol)),
      );

      // Update metrics for stock tickers (starting from index 10)
      tickerDataArray.forEach((stockResult, index) => {
        if (stockResult.status !== "fulfilled") {
          return;
        }

        const stockData = stockResult.value;
        const metricIndex = baseMetricsCount + index;
        const baseMetric: Metric = updatedMetrics[metricIndex] ?? {
          label: tickers[index]?.label ?? tickers[index]?.symbol ?? "Ticker",
          value: "N/A",
          trendLabel: "N/A",
          trendDirection: "flat",
          trendSentiment: "neutral",
        };
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
      setMetrics((prev) =>
        prev.map((metric) =>
          metric.value === "Loading..."
            ? {
                ...metric,
                value: "N/A",
                trendLabel: "Unavailable",
                trendDirection: "flat",
                trendSentiment: "neutral",
              }
            : metric,
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchEtfWeeklyNetReturn = async (
    symbol: string,
    setUsd: React.Dispatch<React.SetStateAction<IVVChartPoint[]>>,
    setClp: React.Dispatch<React.SetStateAction<IVVChartPoint[]>>,
  ) => {
    try {
      const { pointsUsd, pointsClp } = await getETFWeeklyNetTotalReturn(symbol);
      setUsd(
        pointsUsd.map((p: WeeklyNetReturnPoint) => ({
          date: p.date,
          cumulativeReturnPct: p.cumulativeReturnPct,
        })),
      );
      setClp(
        pointsClp.map((p: WeeklyNetReturnPoint) => ({
          date: p.date,
          cumulativeReturnPct: p.cumulativeReturnPct,
        })),
      );
    } catch (error) {
      console.error(`Error fetching ${symbol} weekly net return chart:`, error);
      setUsd([]);
      setClp([]);
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
    if (onRefreshProp) onRefreshProp();
  };

  const START_2023 = "2023-01-01";
  const normalizeFromZero = (points: IVVChartPoint[]): IVVChartPoint[] => {
    if (points.length === 0) return [];
    const base = points[0].cumulativeReturnPct;
    return points.map((p) => ({
      ...p,
      cumulativeReturnPct: p.cumulativeReturnPct - base,
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

  const computePeriodReturn = (
    points: IVVChartPoint[],
    periodStartDate: string,
  ): number | null => {
    if (points.length === 0) return null;
    const periodStartPoint = points.find((p) => p.date >= periodStartDate);
    if (!periodStartPoint) return null;

    const latest = points[points.length - 1].cumulativeReturnPct;
    const start = periodStartPoint.cumulativeReturnPct;
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
  const ivvWtd = computePeriodReturn(ivvWeeklyNetReturn, wtdStart);
  const iywYtd = computePeriodReturn(iywWeeklyNetReturn, ytdStart);
  const iywMtd = computePeriodReturn(iywWeeklyNetReturn, mtdStart);
  const iywWtd = computePeriodReturn(iywWeeklyNetReturn, wtdStart);

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
              style={{ fontSize: 16 }}
              aria-hidden="true"
            />
            Refresh
          </button>
          {onLogoutProp && (
            <button onClick={onLogoutProp} style={S.logoutBtn}>
              <i
                className="ti ti-logout"
                style={{ fontSize: 16 }}
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
          <span style={S.chartKpiBadge}>WTD: {formatReturn(ivvWtd)}</span>
          <span style={S.chartKpiBadge}>YTD: {formatReturn(ivvYtd)}</span>
          <span style={S.chartKpiBadge}>MTD: {formatReturn(ivvMtd)}</span>
        </div>
        <NetReturnLineChart
          usdPoints={ivvWeeklyNetReturn}
          clpPoints={ivvWeeklyNetReturnClp}
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
        />
      </div>

      <div style={S.chartWrap}>
        <p style={S.chartTitle}>IYW Weekly Net Total Return (Since 2010)</p>
        <p style={S.chartSubtitle}>
          USD and CLP series shown together. Dividends are reinvested net of 15%
          non-resident alien withholding tax (for Chile investors).
        </p>
        <div style={S.chartKpiRow}>
          <span style={S.chartKpiBadge}>WTD: {formatReturn(iywWtd)}</span>
          <span style={S.chartKpiBadge}>YTD: {formatReturn(iywYtd)}</span>
          <span style={S.chartKpiBadge}>MTD: {formatReturn(iywMtd)}</span>
        </div>
        <NetReturnLineChart
          usdPoints={iywWeeklyNetReturn}
          clpPoints={iywWeeklyNetReturnClp}
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
        />
      </div>
    </div>
  );
}

// ── Type exports — for consumers building their own metrics array ───────────

export type { Metric, TrendDirection };
