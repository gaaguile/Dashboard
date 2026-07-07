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

app.listen(port, () => {
  console.log(`API server running at http://localhost:${port}`);
});
