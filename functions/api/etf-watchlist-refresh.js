const ETF_TICKERS = [
  "IDU",
  "IYE",
  "IYZ",
  "IYM",
  "IYK",
  "IYC",
  "IYH",
  "IYW",
  "IYR",
  "IYF",
  "IYJ",
];

const ETF_DESCRIPTIONS = {
  IDU: "U.S. Utilities",
  IYE: "U.S. Energy",
  IYZ: "U.S. Telecommunications",
  IYM: "U.S. Basic Materials",
  IYK: "U.S. Consumer Staples",
  IYC: "U.S. Consumer Discretionary",
  IYH: "U.S. Healthcare",
  IYW: "U.S. Technology",
  IYR: "U.S. Real Estate",
  IYF: "U.S. Financials",
  IYJ: "U.S. Industrials",
  IVV: "S&P 500",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Refresh-Token",
};

const JSON_HEADERS = {
  ...CORS_HEADERS,
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function getSeriesLabel(symbol) {
  const description = ETF_DESCRIPTIONS[symbol];
  return description ? `${symbol} - ${description}` : symbol;
}

function getISOWeekKey(dateInput) {
  const date = new Date(
    Date.UTC(
      dateInput.getUTCFullYear(),
      dateInput.getUTCMonth(),
      dateInput.getUTCDate(),
    ),
  );
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function toWeeklyFridays(prices) {
  const weekly = [];
  let currentWeek = null;
  let lastOfWeek = null;

  for (const point of prices) {
    const weekKey = getISOWeekKey(point.date);
    if (weekKey !== currentWeek) {
      if (lastOfWeek) {
        weekly.push(lastOfWeek);
      }
      currentWeek = weekKey;
    }
    lastOfWeek = point;
  }

  if (lastOfWeek) {
    weekly.push(lastOfWeek);
  }
  return weekly;
}

function calculateDrawdown(prices) {
  if (prices.length === 0) {
    return [];
  }

  let peak = prices[0].close;
  const drawdownPoints = [];

  for (const point of prices) {
    if (point.close > peak) {
      peak = point.close;
    }
    const dd = (point.close / peak - 1) * 100;
    drawdownPoints.push([point.date.getTime(), Number(dd.toFixed(4))]);
  }

  return drawdownPoints;
}

async function fetchDailyCloses(symbol, period1Epoch, userAgent) {
  const period2Epoch = Math.floor(Date.now() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1Epoch}&period2=${period2Epoch}&interval=1d&events=div`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Yahoo request failed for ${symbol} with HTTP ${response.status}`,
    );
  }

  const payload = await response.json();
  const node = payload.chart?.result?.[0];
  const timestamps = node?.timestamp || [];
  const closes = node?.indicators?.adjclose?.[0]?.adjclose || [];
  const rawCloses = node?.indicators?.quote?.[0]?.close || [];

  const points = timestamps
    .map((ts, idx) => {
      const adjClose = closes[idx];
      const close =
        typeof adjClose === "number" && Number.isFinite(adjClose)
          ? adjClose
          : rawCloses[idx];

      if (!Number.isFinite(close)) {
        return null;
      }

      return {
        date: new Date(ts * 1000),
        close,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return points;
}

async function buildWatchlistPayload(requestUrl) {
  const symbols = [...new Set(["IVV", ...ETF_TICKERS])];
  const startDate = "2010-01-01T00:00:00Z";
  const period1Epoch = Math.floor(new Date(startDate).getTime() / 1000);
  const userAgent =
    "Mozilla/5.0 (compatible; DashboardBot/1.0; +https://dashboard-bc6.pages.dev)";

  const dailySeries = await Promise.all(
    symbols.map((symbol) => fetchDailyCloses(symbol, period1Epoch, userAgent)),
  );

  const allSeries = symbols.map((symbol, index) => {
    const weekly = toWeeklyFridays(dailySeries[index] || []);
    const drawdown = calculateDrawdown(weekly);
    return {
      name: getSeriesLabel(symbol),
      data: drawdown,
    };
  });

  return {
    title: "Weekly Drawdown Sector ETFs since 2010",
    subtitle: {
      text: "Data courtesy of Yahoo Finance API",
    },
    yAxisTitle: "Drawdown (%)",
    updatedAt: new Date().toISOString(),
    source: new URL(requestUrl).origin,
    series: allSeries,
  };
}

function isAuthorized(request, env) {
  const configuredToken = env.ETF_WATCHLIST_REFRESH_TOKEN;
  if (!configuredToken) {
    return { ok: false, reason: "Missing ETF_WATCHLIST_REFRESH_TOKEN secret" };
  }

  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token");
  const headerToken = request.headers.get("x-refresh-token");
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  const providedToken = queryToken || headerToken || bearerToken;
  if (!providedToken || providedToken !== configuredToken) {
    return { ok: false, reason: "Unauthorized" };
  }

  return { ok: true };
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (!["GET", "POST"].includes(request.method)) {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const auth = isAuthorized(request, env);
  if (!auth.ok) {
    return jsonResponse({ error: auth.reason }, 401);
  }

  if (!env.ETF_DATA_KV) {
    return jsonResponse(
      { error: "ETF_DATA_KV binding is not configured" },
      500,
    );
  }

  const kvKey = env.ETF_WATCHLIST_KV_KEY || "drawdown-weekly.json";

  try {
    const payload = await buildWatchlistPayload(request.url);
    await env.ETF_DATA_KV.put(kvKey, JSON.stringify(payload));

    return jsonResponse({
      ok: true,
      message: "ETF watchlist data refreshed",
      key: kvKey,
      updatedAt: payload.updatedAt,
      seriesCount: payload.series.length,
    });
  } catch (error) {
    return jsonResponse(
      {
        error: "Failed to refresh ETF watchlist data",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}
