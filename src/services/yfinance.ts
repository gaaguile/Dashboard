// Determine API base URL based on environment
const getApiBase = () => {
  // Use relative URL so Vite dev proxy can forward /api requests locally,
  // and production keeps same-origin /api behavior.
  return "/api";
};

const API_BASE = getApiBase();

interface WeeklyNetReturnPoint {
  date: string;
  indexValue: number;
  cumulativeReturnPct: number;
  close: number;
  netDividend: number;
  fxRate?: number;
}

interface WeeklyNetReturnSeriesResponse {
  pointsUsd: WeeklyNetReturnPoint[];
  pointsClp: WeeklyNetReturnPoint[];
}

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

interface FedRateData {
  currentRange: string;
  label?: string;
}

interface IefYieldData {
  dividendYield: string;
  label?: string;
}

export async function getStockData(symbol: string): Promise<StockData> {
  try {
    const response = await fetch(
      `${API_BASE}/stock?symbol=${encodeURIComponent(symbol)}`,
    );
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
    const response = await fetch(
      `${API_BASE}/forex?symbol=${encodeURIComponent(symbol)}`,
    );
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

export async function getCurrentFedRate(): Promise<FedRateData> {
  try {
    const response = await fetch(`${API_BASE}/fed-rate`);
    if (!response.ok) throw new Error("Failed to fetch Fed rate");

    const data = await response.json();
    return {
      currentRange: data.currentRange || "N/A",
      label: data.label || "Target range",
    };
  } catch (error) {
    console.error("Error fetching Fed rate:", error);
    throw error;
  }
}

export async function getIefDividendYield(): Promise<IefYieldData> {
  try {
    const response = await fetch(`${API_BASE}/ief-yield`);
    if (!response.ok) throw new Error("Failed to fetch IEF dividend yield");

    const data = await response.json();
    return {
      dividendYield: data.dividendYield || "N/A",
      label: data.label || "12m trailing yield",
    };
  } catch (error) {
    console.error("Error fetching IEF dividend yield:", error);
    throw error;
  }
}

export async function getIVVWeeklyNetTotalReturn(): Promise<WeeklyNetReturnSeriesResponse> {
  return getETFWeeklyNetTotalReturn("IVV");
}

export async function getETFWeeklyNetTotalReturn(
  symbol: string,
): Promise<WeeklyNetReturnSeriesResponse> {
  try {
    const response = await fetch(
      `${API_BASE}/ivv-weekly-net-return?symbol=${encodeURIComponent(symbol)}`,
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch ${symbol} weekly net total return data`);
    }

    const data = await response.json();
    return {
      pointsUsd: Array.isArray(data.pointsUsd) ? data.pointsUsd : [],
      pointsClp: Array.isArray(data.pointsClp) ? data.pointsClp : [],
    };
  } catch (error) {
    console.error(`Error fetching ${symbol} weekly net total return:`, error);
    throw error;
  }
}

export type { WeeklyNetReturnPoint };
