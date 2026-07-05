// Determine API base URL based on environment
const getApiBase = () => {
  if (typeof window !== "undefined") {
    // Browser environment
    const isDevelopment =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (isDevelopment) {
      return "http://localhost:3001/api";
    }
    // Production: use relative URL (same domain)
    return "/api";
  }
  // Server-side (if needed)
  return "/api";
};

const API_BASE = getApiBase();

interface StockData {
  symbol: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  fiftyTwoWeekChange: number;
  fiftyTwoWeekChangePercent: number;
}

export async function getStockData(symbol: string): Promise<StockData> {
  try {
    const response = await fetch(`${API_BASE}/stock/${symbol}`);
    if (!response.ok) throw new Error("Failed to fetch stock data");

    const data = await response.json();
    return {
      symbol: data.symbol,
      currentPrice: data.currentPrice || 0,
      change: data.change || 0,
      changePercent: (data.changePercent || 0).toFixed(2) as any,
      fiftyTwoWeekHigh: data.fiftyTwoWeekHigh || 0,
      fiftyTwoWeekLow: data.fiftyTwoWeekLow || 0,
      fiftyTwoWeekChange:
        (data.fiftyTwoWeekHigh || 0) - (data.fiftyTwoWeekLow || 0) || 0,
      fiftyTwoWeekChangePercent: (
        (((data.fiftyTwoWeekHigh || 0) - (data.fiftyTwoWeekLow || 0)) /
          (data.fiftyTwoWeekLow || 1)) *
        100
      ).toFixed(2) as any,
    };
  } catch (error) {
    console.error(`Error fetching data for ${symbol}:`, error);
    throw error;
  }
}

export async function getForexData(
  symbol: string,
): Promise<{ change: number; changePercent: number; lastPrice: number }> {
  try {
    const response = await fetch(`${API_BASE}/forex/${symbol}`);
    if (!response.ok) throw new Error("Failed to fetch forex data");

    const data = await response.json();
    return {
      change: (data.change || 0).toFixed(4) as any,
      changePercent: (data.changePercent || 0).toFixed(2) as any,
      lastPrice: data.lastPrice || 0,
    };
  } catch (error) {
    console.error(`Error fetching forex data for ${symbol}:`, error);
    throw error;
  }
}

export async function getFEDMeetingDate(): Promise<{
  formattedDate: string;
  daysUntil: number;
}> {
  try {
    const response = await fetch(`${API_BASE}/fed-meeting`);
    if (!response.ok) throw new Error("Failed to fetch FED meeting date");

    const data = await response.json();
    return {
      formattedDate: data.formattedDate || "TBD",
      daysUntil: data.daysUntil || 0,
    };
  } catch (error) {
    console.error("Error fetching FED meeting date:", error);
    throw error;
  }
}
