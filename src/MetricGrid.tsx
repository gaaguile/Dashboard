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
    marginBottom: "1.25rem",
  } satisfies CSSProperties,

  title: { fontSize: 18, fontWeight: 500, margin: 0 } satisfies CSSProperties,

  subtitle: {
    fontSize: 13,
    color: "var(--text-secondary)",
    margin: "2px 0 0",
  } satisfies CSSProperties,

  refreshBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  } satisfies CSSProperties,

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
  } satisfies CSSProperties,

  card: {
    background: "var(--surface-1)",
    borderRadius: "var(--radius)",
    padding: "1rem",
  } satisfies CSSProperties,

  cardLabel: {
    fontSize: 13,
    color: "var(--text-secondary)",
    margin: "0 0 6px",
  } satisfies CSSProperties,

  cardValue: {
    fontSize: 24,
    fontWeight: 500,
    margin: 0,
  } satisfies CSSProperties,

  cardTrend: {
    fontSize: 12,
    margin: "6px 0 0",
    display: "flex",
    alignItems: "center",
    gap: 4,
  } satisfies CSSProperties,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({ metric }: { metric: Metric }): React.JSX.Element {
  const trendColor = resolveSentimentColor(metric);
  const iconClass = trendIconClass(metric.trendDirection);

  return (
    <div style={S.card}>
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
  title = "Overview",
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
          <button onClick={onRefresh} style={S.refreshBtn}>
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
