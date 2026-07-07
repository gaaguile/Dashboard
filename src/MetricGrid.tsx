import { CSSProperties, useState, useEffect } from "react";
import {
  getStockData,
  getForexData,
  getFEDMeetingDate,
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
        updatedMetrics[metricIndex] = {
          ...updatedMetrics[metricIndex],
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
      // Keep the loading state but show error
    } finally {
      setLoading(false);
    }
  };

  // Fetch market data when tickers are loaded
  useEffect(() => {
    fetchMarketData();
  }, [tickers]);

  const handleRefresh = () => {
    fetchMarketData();
    if (onRefreshProp) onRefreshProp();
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
    </div>
  );
}

// ── Type exports — for consumers building their own metrics array ───────────

export type { Metric, TrendDirection };
