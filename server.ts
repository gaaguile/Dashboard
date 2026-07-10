import express from "express";
import cors from "cors";
import YahooFinance from "yahoo-finance2";

const app = express();
const port = 3002;
const yahooFinance = new YahooFinance();

app.use(cors());
app.use(express.json());

function parseSymbol(req: express.Request): string | undefined {
  return (
    (req.query.symbol as string | undefined) ??
    (req.params.symbol as string | undefined)
  );
}

async function stockHandler(req: express.Request, res: express.Response) {
  try {
    const symbol = parseSymbol(req);
    if (!symbol) {
      return res.status(400).json({ error: "Missing symbol parameter" });
    }

    const quote = await yahooFinance.quote(symbol);

    res.json({
      symbol,
      currentPrice: quote.regularMarketPrice ?? 0,
      change: quote.regularMarketChange ?? 0,
      changePercent: quote.regularMarketChangePercent ?? 0,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? 0,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? 0,
    });
  } catch (error) {
    console.error("Error fetching stock data:", error);
    res.status(500).json({ error: "Failed to fetch stock data" });
  }
}

app.get("/api/stock", stockHandler);
app.get("/api/stock/:symbol", stockHandler);

async function forexHandler(req: express.Request, res: express.Response) {
  try {
    const symbol = parseSymbol(req);
    if (!symbol) {
      return res.status(400).json({ error: "Missing symbol parameter" });
    }

    const quote = await yahooFinance.quote(symbol);

    res.json({
      symbol,
      change: quote.regularMarketChange ?? 0,
      changePercent: quote.regularMarketChangePercent ?? 0,
      lastPrice: quote.regularMarketPrice ?? 0,
    });
  } catch (error) {
    console.error("Error fetching forex data:", error);
    res.status(500).json({ error: "Failed to fetch forex data" });
  }
}

app.get("/api/forex", forexHandler);
app.get("/api/forex/:symbol", forexHandler);

const FOMC_DATES = [
  new Date(2025, 0, 29),
  new Date(2025, 2, 19),
  new Date(2025, 4, 7),
  new Date(2025, 5, 18),
  new Date(2025, 8, 17),
  new Date(2025, 10, 5),
  new Date(2025, 11, 17),
  new Date(2026, 0, 28),
  new Date(2026, 2, 18),
  new Date(2026, 4, 6),
  new Date(2026, 5, 17),
  new Date(2026, 8, 16),
  new Date(2026, 10, 4),
  new Date(2026, 11, 16),
];

app.get("/api/fed-meeting", (_req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextMeeting =
    FOMC_DATES.find((d) => d > today) ?? FOMC_DATES[FOMC_DATES.length - 1];
  const daysUntil = Math.max(
    0,
    Math.ceil(
      (nextMeeting.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    ),
  );

  res.json({
    formattedDate: nextMeeting.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    daysUntil,
  });
});

app.get("/api/ivv-weekly-net-return", async (_req, res) => {
  try {
    const requestedSymbol =
      (typeof _req.query.symbol === "string" ? _req.query.symbol : "IVV") ||
      "IVV";
    const symbol = requestedSymbol.trim().toUpperCase();
    if (!/^[A-Z]{1,10}$/.test(symbol)) {
      return res.status(400).json({ error: "Invalid symbol parameter" });
    }

    const period1 = Math.floor(
      new Date("2010-01-01T00:00:00Z").getTime() / 1000,
    );
    const period2 = Math.floor(Date.now() / 1000);
    const ivvUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1wk&events=div`;
    const fxUrl = `https://query1.finance.yahoo.com/v8/finance/chart/USDCLP=X?period1=${period1}&period2=${period2}&interval=1wk`;

    const [ivvResponse, fxResponse] = await Promise.all([
      fetch(ivvUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; DashboardBot/1.0; +http://localhost:3002)",
        },
      }),
      fetch(fxUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; DashboardBot/1.0; +http://localhost:3002)",
        },
      }),
    ]);

    if (!ivvResponse.ok || !fxResponse.ok) {
      return res
        .status(500)
        .json({ error: "Failed to fetch IVV or USDCLP weekly return history" });
    }

    const response = ivvResponse;
    const fxPayload = await fxResponse.json();

    const fxNode = fxPayload.chart?.result?.[0];
    const fxTimestamps: number[] = fxNode?.timestamp || [];
    const fxCloses: Array<number | null> =
      fxNode?.indicators?.quote?.[0]?.close || [];
    const isFiniteFxRate = (value: unknown): value is number =>
      typeof value === "number" && Number.isFinite(value) && value > 0;
    const rawFxPoints = fxTimestamps
      .map((ts, i) => ({ ts, close: fxCloses[i] }))
      .filter((p): p is { ts: number; close: number } =>
        isFiniteFxRate(p.close),
      )
      .sort((a, b) => a.ts - b.ts);
    const inRangeFxPoints = rawFxPoints.filter(
      (p) => p.close >= 100 && p.close <= 2000,
    );
    const fxPoints = inRangeFxPoints.reduce<
      Array<{ ts: number; close: number }>
    >((acc, point) => {
      if (acc.length === 0) {
        acc.push(point);
        return acc;
      }
      const prev = acc[acc.length - 1].close;
      const ratio = point.close / prev;
      // Ignore suspicious one-week spikes/drops that can appear in Yahoo FX data.
      if (ratio >= 0.67 && ratio <= 1.5) {
        acc.push(point);
      }
      return acc;
    }, []);

    const getFxRateAtTs = (ts: number): number => {
      if (fxPoints.length === 0) return 1;
      let rate = fxPoints[0].close;
      for (const p of fxPoints) {
        if (p.ts <= ts) {
          rate = p.close;
        } else {
          break;
        }
      }
      return rate;
    };

    const payload = await response.json();
    const node = payload.chart?.result?.[0];
    const timestamps: number[] = node?.timestamp || [];
    const closes: Array<number | null> =
      node?.indicators?.quote?.[0]?.close || [];
    const dividendsRaw = node?.events?.dividends || {};

    const points = timestamps
      .map((ts, i) => ({ ts, close: closes[i] }))
      .filter(
        (p): p is { ts: number; close: number } => typeof p.close === "number",
      )
      .map((p) => ({ ...p, date: new Date(p.ts * 1000) }))
      .filter((p) => p.date >= new Date("2010-01-01T00:00:00Z"));

    if (points.length < 2) {
      return res.status(200).json({ pointsUsd: [], pointsClp: [] });
    }

    const dividends = Object.values(dividendsRaw)
      .map((d: any) => ({
        ts: Number(d.date),
        amount: Number(d.amount) || 0,
      }))
      .filter((d) => Number.isFinite(d.ts) && Number.isFinite(d.amount))
      .sort((a, b) => a.ts - b.ts);

    let indexValue = 100;
    const fxStart = getFxRateAtTs(points[0].ts);
    let indexValueClp = 100;
    const series = [
      {
        date: points[0].date.toISOString().slice(0, 10),
        indexValue,
        cumulativeReturnPct: 0,
        close: points[0].close,
        netDividend: 0,
      },
    ];
    const seriesClp = [
      {
        date: points[0].date.toISOString().slice(0, 10),
        indexValue: indexValueClp,
        cumulativeReturnPct: 0,
        close: points[0].close * fxStart,
        netDividend: 0,
        fxRate: fxStart,
      },
    ];

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const grossDividend = dividends
        .filter((d) => d.ts > prev.ts && d.ts <= curr.ts)
        .reduce((sum, d) => sum + d.amount, 0);
      const netDividend = grossDividend * 0.85;

      const weeklyReturn =
        prev.close > 0 ? (curr.close + netDividend) / prev.close - 1 : 0;
      indexValue *= 1 + weeklyReturn;
      const fxRate = getFxRateAtTs(curr.ts);
      const fxRelative = fxStart > 0 ? fxRate / fxStart : 1;
      indexValueClp = indexValue * fxRelative;

      series.push({
        date: curr.date.toISOString().slice(0, 10),
        indexValue,
        cumulativeReturnPct: (indexValue / 100 - 1) * 100,
        close: curr.close,
        netDividend,
      });
      seriesClp.push({
        date: curr.date.toISOString().slice(0, 10),
        indexValue: indexValueClp,
        cumulativeReturnPct: (indexValueClp / 100 - 1) * 100,
        close: curr.close * fxRate,
        netDividend: netDividend * fxRate,
        fxRate,
      });
    }

    res.json({
      symbol,
      startDate: series[0].date,
      endDate: series[series.length - 1].date,
      taxWithholdingRate: 0.15,
      pointsUsd: series,
      pointsClp: seriesClp,
    });
  } catch (error) {
    console.error("Error fetching IVV weekly net return:", error);
    res.status(500).json({ error: "Failed to fetch IVV weekly net return" });
  }
});

app.listen(port, () => {
  console.log(`API server running at http://localhost:${port}`);
});
