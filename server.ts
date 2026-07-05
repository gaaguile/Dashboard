import express from "express";
import cors from "cors";
import yahooFinance from "yahoo-finance2";
import {
  fetchFOMCDates,
  getNextFOMCDate as getNextFOMCFromService,
} from "./src/services/fedMeetingFetch";

const app = express();
const yf = new yahooFinance();

app.use(cors());
app.use(express.json());

// Store FOMC dates (will be populated on startup)
let fomcDates: Date[] = [];

// API route for stock data
app.get("/api/stock/:symbol", async (req, res) => {
  const { symbol } = req.params;
  try {
    const quote = await yf.quote(symbol);
    res.json({
      symbol: quote.symbol,
      currentPrice: quote.regularMarketPrice,
      change: quote.regularMarketChange,
      changePercent: quote.regularMarketChangePercent,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
    });
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error);
    res.status(500).json({ error: `Failed to fetch data for ${symbol}` });
  }
});

// API route for forex data
app.get("/api/forex/:symbol", async (req, res) => {
  const { symbol } = req.params;
  try {
    const quote = await yf.quote(symbol);
    res.json({
      symbol: quote.symbol,
      change: quote.regularMarketChange,
      changePercent: quote.regularMarketChangePercent,
      lastPrice: quote.regularMarketPrice,
    });
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error);
    res.status(500).json({ error: `Failed to fetch data for ${symbol}` });
  }
});

// FOMC meeting dates are fetched from Federal Reserve website
// See fedMeetingFetch.ts for details

// API route for next FED meeting date
app.get("/api/fed-meeting", (req, res) => {
  try {
    if (fomcDates.length === 0) {
      // Fallback if dates haven't been fetched yet
      return res.status(500).json({ error: "FOMC dates not yet loaded" });
    }

    const nextFOMCDate = getNextFOMCFromService(fomcDates);
    const today = new Date();
    const daysUntil = Math.ceil(
      (nextFOMCDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    res.json({
      date: nextFOMCDate.toISOString(),
      daysUntil: Math.max(0, daysUntil),
      formattedDate: nextFOMCDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    });
  } catch (error) {
    console.error("Error fetching FED meeting date:", error);
    res.status(500).json({ error: "Failed to fetch FED meeting date" });
  }
});

const PORT = 3001;

// Initialize FOMC dates on server startup
async function startServer() {
  console.log("Fetching FOMC dates from Federal Reserve website...");
  fomcDates = await fetchFOMCDates();
  console.log(`Loaded ${fomcDates.length} FOMC dates`);

  app.listen(PORT, () => {
    console.log(`Market data server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
