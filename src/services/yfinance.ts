// Determine API base URL candidates based on environment.
const getApiBaseCandidates = (): string[] => {
  const envBase = (import.meta as any)?.env?.VITE_API_BASE;
  if (typeof envBase === "string" && envBase.trim()) {
    return [envBase.trim().replace(/\/$/, "")];
  }

  // In localhost contexts, try Vite proxy/same-origin first, then direct local API.
  if (typeof window !== "undefined") {
    const isLocalHost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (isLocalHost) {
      return ["/api", "http://localhost:3002/api"];
    }
  }

  // Default for production and same-origin deployments.
  return ["/api"];
};

const API_BASE_CANDIDATES = getApiBaseCandidates();

async function fetchFromApi(pathAndQuery: string): Promise<Response> {
  const errors: string[] = [];

  for (const base of API_BASE_CANDIDATES) {
    const url = `${base}${pathAndQuery}`;
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }
      errors.push(`${url} -> HTTP ${response.status}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${url} -> ${message}`);
    }
  }

  throw new Error(`API request failed: ${errors.join(" | ")}`);
}

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
  weekToDateChangePercent: number;
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
    const response = await fetchFromApi(
      `/stock?symbol=${encodeURIComponent(symbol)}`,
    );

    const data = await response.json();
    return {
      symbol: data.symbol,
      currentPrice: data.currentPrice || 0,
      change: data.change || 0,
      changePercent: (data.changePercent || 0).toFixed(2) as any,
      weekToDateChangePercent: Number(data.weekToDateChangePercent || 0),
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

export async function getForexData(symbol: string): Promise<{
  change: number;
  changePercent: number;
  weekToDateChangePercent: number;
  lastPrice: number;
}> {
  try {
    const response = await fetchFromApi(
      `/forex?symbol=${encodeURIComponent(symbol)}`,
    );

    const data = await response.json();
    return {
      change: (data.change || 0).toFixed(4) as any,
      changePercent: (data.changePercent || 0).toFixed(2) as any,
      weekToDateChangePercent: Number(data.weekToDateChangePercent || 0),
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
    const response = await fetchFromApi(`/fed-meeting`);

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
    const response = await fetchFromApi(`/fed-rate`);

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
    const response = await fetchFromApi(`/ief-yield`);

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
    const response = await fetchFromApi(
      `/ivv-weekly-net-return?symbol=${encodeURIComponent(symbol)}`,
    );

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
