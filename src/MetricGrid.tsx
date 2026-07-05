import { CSSProperties } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type TrendDirection = "up" | "down" | "flat";

interface Metric {
  label: string;
  value: string;
  trendLabel: string;
  trendDirection: TrendDirection;
  /** Override automatic color (e.g. "down" trend that is actually good, like latency) */
  trendSentiment?: "positive" | "negative" | "neutral";
}

// ── Sample data — replace with your real metrics ─────────────────────────────

const SAMPLE_METRICS: Metric[] = [
  {
    label: "Revenue",
    value: "$482,300",
    trendLabel: "4.2%",
    trendDirection: "up",
    trendSentiment: "positive",
  },
  {
    label: "Active users",
    value: "12,847",
    trendLabel: "1.8%",
    trendDirection: "up",
    trendSentiment: "positive",
  },
  {
    label: "Churn rate",
    value: "2.4%",
    trendLabel: "0.3%",
    trendDirection: "down",
    trendSentiment: "negative",
  },
  {
    label: "Avg order value",
    value: "$96.40",
    trendLabel: "2.1%",
    trendDirection: "up",
    trendSentiment: "positive",
  },
  {
    label: "Conversion rate",
    value: "3.7%",
    trendLabel: "0.0%",
    trendDirection: "flat",
    trendSentiment: "neutral",
  },
  {
    label: "New signups",
    value: "1,204",
    trendLabel: "6.5%",
    trendDirection: "up",
    trendSentiment: "positive",
  },
  {
    label: "Support tickets",
    value: "86",
    trendLabel: "11%",
    trendDirection: "up",
    trendSentiment: "negative",
  },
  {
    label: "Uptime",
    value: "99.98%",
    trendLabel: "SLA met",
    trendDirection: "flat",
    trendSentiment: "positive",
  },
  {
    label: "API latency",
    value: "142ms",
    trendLabel: "8ms",
    trendDirection: "down",
    trendSentiment: "positive",
  },
  {
    label: "Error rate",
    value: "0.12%",
    trendLabel: "stable",
    trendDirection: "flat",
    trendSentiment: "neutral",
  },
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

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
  } satisfies CSSProperties,

  card: {
    //background: "var(--surface-1)",
    background: "#87CEFA",
    borderRadius: "var(--radius)",
    padding: "1.5rem",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.6)",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    cursor: "pointer",
    position: "relative" as const,
    overflow: "hidden" as const,
  } satisfies CSSProperties,

  cardLabel: {
    fontSize: 12,
    background:
      "linear-gradient(135deg, var(--primary) 0%, var(--accent-cyan) 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    margin: "0 0 10px",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  } satisfies CSSProperties,

  cardValue: {
    fontSize: 28,
    fontWeight: 700,
    margin: 0,
    color: "#0f172a",
  } satisfies CSSProperties,

  cardTrend: {
    fontSize: 13,
    margin: "10px 0 0",
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
      <p style={{ ...S.cardTrend, color: trendColor }}>
        <i
          className={`ti ${iconClass}`}
          style={{ fontSize: 14 }}
          aria-hidden="true"
        />
        {metric.trendLabel}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface MetricGridProps {
  metrics?: Metric[];
  title?: string;
  subtitle?: string;
  onRefresh?: () => void;
}

export default function MetricGrid({
  metrics = SAMPLE_METRICS,
  title = "Dashboard for Trading Strategies",
  subtitle = "Last updated 5 minutes ago",
  onRefresh,
}: MetricGridProps): React.JSX.Element {
  return (
    <div>
      <div style={S.header}>
        <div>
          <p style={S.title}>{title}</p>
          <p style={S.subtitle}>{subtitle}</p>
        </div>
        {onRefresh && (
          <button onClick={onRefresh} style={S.refreshBtn} data-refresh-btn>
            <i
              className="ti ti-refresh"
              style={{ fontSize: 16 }}
              aria-hidden="true"
            />
            Refresh
          </button>
        )}
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
