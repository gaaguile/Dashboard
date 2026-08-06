var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/etf-watchlist.js
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Refresh-Token"
};
var JSON_HEADERS = {
  ...CORS_HEADERS,
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=300, s-maxage=300"
};
function jsonResponse(body, status = 200, headers = JSON_HEADERS) {
  return new Response(JSON.stringify(body), { status, headers });
}
__name(jsonResponse, "jsonResponse");
async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }
  const kvBinding = env.ETF_DATA_KV;
  const kvKey = env.ETF_WATCHLIST_KV_KEY || "drawdown-weekly.json";
  const staticPath = env.ETF_WATCHLIST_SOURCE_PATH || "/etf-watchlist/drawdown-weekly.json";
  try {
    if (kvBinding) {
      const raw = await kvBinding.get(kvKey);
      if (raw) {
        const payload = JSON.parse(raw);
        return jsonResponse(payload);
      }
    }
    const fallbackUrl = new URL(staticPath, request.url);
    const fallbackResponse = await fetch(fallbackUrl.toString());
    if (!fallbackResponse.ok) {
      throw new Error(
        `Fallback fetch failed with HTTP ${fallbackResponse.status}`
      );
    }
    const fallbackPayload = await fallbackResponse.json();
    return jsonResponse(fallbackPayload);
  } catch (error) {
    return jsonResponse(
      {
        error: "ETF watchlist payload unavailable",
        detail: error instanceof Error ? error.message : "Unknown error"
      },
      500,
      { ...JSON_HEADERS, "Cache-Control": "no-store" }
    );
  }
}
__name(onRequest, "onRequest");

// api/etf-watchlist-refresh.js
var ETF_TICKERS = [
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
  "IYJ"
];
var ETF_DESCRIPTIONS = {
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
  IVV: "S&P 500"
};
var CORS_HEADERS2 = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Refresh-Token"
};
var JSON_HEADERS2 = {
  ...CORS_HEADERS2,
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};
function jsonResponse2(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS2 });
}
__name(jsonResponse2, "jsonResponse");
function getSeriesLabel(symbol) {
  const description = ETF_DESCRIPTIONS[symbol];
  return description ? `${symbol} - ${description}` : symbol;
}
__name(getSeriesLabel, "getSeriesLabel");
function getISOWeekKey(dateInput) {
  const date = new Date(
    Date.UTC(
      dateInput.getUTCFullYear(),
      dateInput.getUTCMonth(),
      dateInput.getUTCDate()
    )
  );
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 864e5 + 1) / 7
  );
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
__name(getISOWeekKey, "getISOWeekKey");
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
__name(toWeeklyFridays, "toWeeklyFridays");
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
__name(calculateDrawdown, "calculateDrawdown");
async function fetchDailyCloses(symbol, period1Epoch, userAgent) {
  const period2Epoch = Math.floor(Date.now() / 1e3);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1Epoch}&period2=${period2Epoch}&interval=1d&events=div`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": userAgent
    }
  });
  if (!response.ok) {
    throw new Error(
      `Yahoo request failed for ${symbol} with HTTP ${response.status}`
    );
  }
  const payload = await response.json();
  const node = payload.chart?.result?.[0];
  const timestamps = node?.timestamp || [];
  const closes = node?.indicators?.adjclose?.[0]?.adjclose || [];
  const rawCloses = node?.indicators?.quote?.[0]?.close || [];
  const points = timestamps.map((ts, idx) => {
    const adjClose = closes[idx];
    const close = typeof adjClose === "number" && Number.isFinite(adjClose) ? adjClose : rawCloses[idx];
    if (!Number.isFinite(close)) {
      return null;
    }
    return {
      date: new Date(ts * 1e3),
      close
    };
  }).filter(Boolean).sort((a, b) => a.date.getTime() - b.date.getTime());
  return points;
}
__name(fetchDailyCloses, "fetchDailyCloses");
async function buildWatchlistPayload(requestUrl) {
  const symbols = [.../* @__PURE__ */ new Set(["IVV", ...ETF_TICKERS])];
  const startDate = "2010-01-01T00:00:00Z";
  const period1Epoch = Math.floor(new Date(startDate).getTime() / 1e3);
  const userAgent = "Mozilla/5.0 (compatible; DashboardBot/1.0; +https://dashboard-bc6.pages.dev)";
  const dailySeries = await Promise.all(
    symbols.map((symbol) => fetchDailyCloses(symbol, period1Epoch, userAgent))
  );
  const allSeries = symbols.map((symbol, index) => {
    const weekly = toWeeklyFridays(dailySeries[index] || []);
    const drawdown = calculateDrawdown(weekly);
    return {
      name: getSeriesLabel(symbol),
      data: drawdown
    };
  });
  return {
    title: "Weekly Drawdown Sector ETFs since 2010",
    subtitle: {
      text: "Data courtesy of Yahoo Finance API"
    },
    yAxisTitle: "Drawdown (%)",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    source: new URL(requestUrl).origin,
    series: allSeries
  };
}
__name(buildWatchlistPayload, "buildWatchlistPayload");
function isAuthorized(request, env) {
  const configuredToken = env.ETF_WATCHLIST_REFRESH_TOKEN;
  if (!configuredToken) {
    return { ok: false, reason: "Missing ETF_WATCHLIST_REFRESH_TOKEN secret" };
  }
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token");
  const headerToken = request.headers.get("x-refresh-token");
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const providedToken = queryToken || headerToken || bearerToken;
  if (!providedToken || providedToken !== configuredToken) {
    return { ok: false, reason: "Unauthorized" };
  }
  return { ok: true };
}
__name(isAuthorized, "isAuthorized");
async function onRequest2(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS2 });
  }
  if (!["GET", "POST"].includes(request.method)) {
    return jsonResponse2({ error: "Method not allowed" }, 405);
  }
  const auth = isAuthorized(request, env);
  if (!auth.ok) {
    return jsonResponse2({ error: auth.reason }, 401);
  }
  if (!env.ETF_DATA_KV) {
    return jsonResponse2(
      { error: "ETF_DATA_KV binding is not configured" },
      500
    );
  }
  const kvKey = env.ETF_WATCHLIST_KV_KEY || "drawdown-weekly.json";
  try {
    const payload = await buildWatchlistPayload(request.url);
    await env.ETF_DATA_KV.put(kvKey, JSON.stringify(payload));
    return jsonResponse2({
      ok: true,
      message: "ETF watchlist data refreshed",
      key: kvKey,
      updatedAt: payload.updatedAt,
      seriesCount: payload.series.length
    });
  } catch (error) {
    return jsonResponse2(
      {
        error: "Failed to refresh ETF watchlist data",
        detail: error instanceof Error ? error.message : "Unknown error"
      },
      500
    );
  }
}
__name(onRequest2, "onRequest");

// api/fed-meeting.js
async function onRequest3(context) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const FOMC_DATES = [
    new Date(2024, 0, 31),
    // Jan 31, 2024
    new Date(2024, 2, 20),
    // Mar 20, 2024
    new Date(2024, 4, 1),
    // May 1, 2024
    new Date(2024, 5, 19),
    // Jun 19, 2024
    new Date(2024, 8, 18),
    // Sep 18, 2024
    new Date(2024, 10, 7),
    // Nov 7, 2024
    new Date(2024, 11, 18),
    // Dec 18, 2024
    new Date(2025, 0, 29),
    // Jan 29, 2025
    new Date(2025, 2, 19),
    // Mar 19, 2025
    new Date(2025, 4, 7),
    // May 7, 2025
    new Date(2025, 5, 18),
    // Jun 18, 2025
    new Date(2025, 8, 17),
    // Sep 17, 2025
    new Date(2025, 10, 5),
    // Nov 5, 2025
    new Date(2025, 11, 17),
    // Dec 17, 2025
    new Date(2026, 6, 29),
    // Jul 29, 2026
    new Date(2026, 8, 16)
    // Sep 16, 2026
  ];
  function getNextFOMCDate() {
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    for (const fomcDate of FOMC_DATES) {
      if (fomcDate > today) {
        return fomcDate;
      }
    }
    return FOMC_DATES[FOMC_DATES.length - 1];
  }
  __name(getNextFOMCDate, "getNextFOMCDate");
  try {
    const nextFOMCDate = getNextFOMCDate();
    const today = /* @__PURE__ */ new Date();
    const daysUntil = Math.ceil(
      (nextFOMCDate.getTime() - today.getTime()) / (1e3 * 60 * 60 * 24)
    );
    const result = {
      date: nextFOMCDate.toISOString(),
      daysUntil: Math.max(0, daysUntil),
      formattedDate: nextFOMCDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      })
    };
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error fetching FED meeting date:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch FED meeting date" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
}
__name(onRequest3, "onRequest");

// api/fed-rate.js
async function onRequest4(context) {
  const { request } = context;
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const response = await fetch(
      "https://www.federalreserve.gov/monetarypolicy/openmarket.htm",
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; DashboardBot/1.0; +https://dashboard-bc6.pages.dev)"
        }
      }
    );
    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch Fed rate" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    const html = await response.text();
    const rowMatch = html.match(
      /<h4>2025<\/h4>[\s\S]*?<tbody>\s*<tr>\s*<td class="bold stub" nowrap="nowrap" scope="row">[^<]+<\/td>\s*<td class="stub" nowrap="nowrap">\d+<\/td>\s*<td class="stub" nowrap="nowrap">\d+<\/td>\s*<td class="stub" nowrap="nowrap">([^<]+)<\/td>/i
    );
    const fallbackRange = html.match(/\b\d+(?:\.\d+)?-\d+(?:\.\d+)?\b/);
    const currentRange = rowMatch ? `${rowMatch[1]}%` : fallbackRange ? `${fallbackRange[0]}%` : null;
    if (!currentRange) {
      return new Response(
        JSON.stringify({ error: "Failed to parse Fed rate" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    return new Response(
      JSON.stringify({ currentRange, label: "Target range" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error fetching Fed rate:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch Fed rate" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(onRequest4, "onRequest");

// api/forex.js
async function onRequest5(context) {
  const { request } = context;
  const url = new URL(request.url);
  const toNyDateString = /* @__PURE__ */ __name((value) => new Date(value).toLocaleDateString("en-CA", {
    timeZone: "America/New_York"
  }), "toNyDateString");
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const symbol = url.searchParams.get("symbol");
  if (!symbol) {
    return new Response(JSON.stringify({ error: "Missing symbol parameter" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; DashboardBot/1.0; +https://dashboard-bc6.pages.dev)"
        }
      }
    );
    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch data for ${symbol}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    const data = await response.json();
    const resultNode = data.chart?.result?.[0];
    const meta = resultNode?.meta;
    const quote = resultNode?.indicators?.quote?.[0];
    const timestamps = resultNode?.timestamp || [];
    const rawCloses = quote?.close || [];
    const points = timestamps.map((ts, i) => ({ ts, close: rawCloses[i] })).filter((p) => Number.isFinite(p.ts) && typeof p.close === "number");
    if (!meta || points.length === 0) {
      return new Response(
        JSON.stringify({ error: `No data found for ${symbol}` }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    const latestPoint = points[points.length - 1];
    const previousPoint = points.length > 1 ? points[points.length - 2] : latestPoint;
    const lastPrice = latestPoint.close;
    const previousClose = previousPoint.close;
    const nowNy = new Date(
      (/* @__PURE__ */ new Date()).toLocaleString("en-US", { timeZone: "America/New_York" })
    );
    const weekStartNy = new Date(nowNy);
    const daysSinceMonday = (weekStartNy.getDay() + 6) % 7;
    weekStartNy.setDate(weekStartNy.getDate() - daysSinceMonday);
    const weekStartNyDate = toNyDateString(weekStartNy);
    const baselinePoint = [...points].reverse().find((p) => toNyDateString(p.ts * 1e3) < weekStartNyDate);
    const weekToDateChangePercent = baselinePoint && baselinePoint.close > 0 ? (lastPrice / baselinePoint.close - 1) * 100 : 0;
    const change = lastPrice - previousClose;
    const changePercent = previousClose ? change / previousClose * 100 : 0;
    const result = {
      symbol: meta.symbol || symbol,
      change,
      changePercent,
      weekToDateChangePercent,
      lastPrice
    };
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error(`Error fetching forex data for ${symbol}:`, error);
    return new Response(
      JSON.stringify({ error: `Error fetching data for ${symbol}` }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
}
__name(onRequest5, "onRequest");

// api/ief-yield.js
async function onRequest6(context) {
  const { request } = context;
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const response = await fetch(
      "https://www.ishares.com/us/products/239456/ishares-7-10-year-treasury-bond-etf",
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; DashboardBot/1.0; +https://dashboard-bc6.pages.dev)"
        }
      }
    );
    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch IEF yield" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    const html = await response.text();
    const yieldMatch = html.match(
      /twelveMonTrlYld&quot;:\{[\s\S]*?formattedValue&quot;:&quot;([^&]+)&quot;/i
    );
    const dividendYield = yieldMatch ? yieldMatch[1] : null;
    if (!dividendYield) {
      return new Response(
        JSON.stringify({ error: "Failed to parse IEF yield" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    return new Response(
      JSON.stringify({ dividendYield, label: "12m trailing yield" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error fetching IEF yield:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch IEF yield" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
}
__name(onRequest6, "onRequest");

// api/ivv-weekly-net-return.js
async function onRequest7(context) {
  const { request } = context;
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const url = new URL(request.url);
    const requestedSymbol = (url.searchParams.get("symbol") || "IVV").trim();
    const symbol = requestedSymbol.toUpperCase();
    if (!/^[A-Z]{1,10}$/.test(symbol)) {
      return new Response(
        JSON.stringify({ error: "Invalid symbol parameter" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    const period1 = Math.floor(
      (/* @__PURE__ */ new Date("2010-01-01T00:00:00Z")).getTime() / 1e3
    );
    const period2 = Math.floor(Date.now() / 1e3);
    const ivvUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1wk&events=div`;
    const fxUrl = `https://query1.finance.yahoo.com/v8/finance/chart/USDCLP=X?period1=${period1}&period2=${period2}&interval=1wk`;
    const [response, fxResponse] = await Promise.all([
      fetch(ivvUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; DashboardBot/1.0; +https://dashboard-bc6.pages.dev)"
        }
      }),
      fetch(fxUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; DashboardBot/1.0; +https://dashboard-bc6.pages.dev)"
        }
      })
    ]);
    if (!response.ok || !fxResponse.ok) {
      return new Response(
        JSON.stringify({
          error: "Failed to fetch IVV or USDCLP weekly return history"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    const payload = await response.json();
    const fxPayload = await fxResponse.json();
    const node = payload.chart?.result?.[0];
    const timestamps = node?.timestamp || [];
    const closes = node?.indicators?.quote?.[0]?.close || [];
    const dividendsRaw = node?.events?.dividends || {};
    const fxNode = fxPayload.chart?.result?.[0];
    const fxTimestamps = fxNode?.timestamp || [];
    const fxCloses = fxNode?.indicators?.quote?.[0]?.close || [];
    const isFiniteFxRate = /* @__PURE__ */ __name((value) => typeof value === "number" && Number.isFinite(value) && value > 0, "isFiniteFxRate");
    const rawFxPoints = fxTimestamps.map((ts, i) => ({ ts, close: fxCloses[i] })).filter((p) => isFiniteFxRate(p.close)).sort((a, b) => a.ts - b.ts);
    const inRangeFxPoints = rawFxPoints.filter(
      (p) => p.close >= 100 && p.close <= 2e3
    );
    const fxPoints = inRangeFxPoints.reduce((acc, point) => {
      if (acc.length === 0) {
        acc.push(point);
        return acc;
      }
      const prev = acc[acc.length - 1].close;
      const ratio = point.close / prev;
      if (ratio >= 0.67 && ratio <= 1.5) {
        acc.push(point);
      }
      return acc;
    }, []);
    const getFxRateAtTs = /* @__PURE__ */ __name((ts) => {
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
    }, "getFxRateAtTs");
    const points = timestamps.map((ts, i) => ({ ts, close: closes[i] })).filter((p) => typeof p.close === "number").map((p) => ({ ...p, date: new Date(p.ts * 1e3) })).filter((p) => p.date >= /* @__PURE__ */ new Date("2010-01-01T00:00:00Z"));
    if (points.length < 2) {
      return new Response(JSON.stringify({ pointsUsd: [], pointsClp: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const dividends = Object.values(dividendsRaw).map((d) => ({
      ts: Number(d.date),
      amount: Number(d.amount) || 0
    })).filter((d) => Number.isFinite(d.ts) && Number.isFinite(d.amount)).sort((a, b) => a.ts - b.ts);
    let indexValue = 100;
    const fxStart = getFxRateAtTs(points[0].ts);
    let indexValueClp = 100;
    const series = [
      {
        date: points[0].date.toISOString().slice(0, 10),
        indexValue,
        cumulativeReturnPct: 0,
        close: points[0].close,
        netDividend: 0
      }
    ];
    const seriesClp = [
      {
        date: points[0].date.toISOString().slice(0, 10),
        indexValue: indexValueClp,
        cumulativeReturnPct: 0,
        close: points[0].close * fxStart,
        netDividend: 0,
        fxRate: fxStart
      }
    ];
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const grossDividend = dividends.filter((d) => d.ts > prev.ts && d.ts <= curr.ts).reduce((sum, d) => sum + d.amount, 0);
      const netDividend = grossDividend * 0.85;
      const weeklyReturn = prev.close > 0 ? (curr.close + netDividend) / prev.close - 1 : 0;
      indexValue *= 1 + weeklyReturn;
      const fxRate = getFxRateAtTs(curr.ts);
      const fxRelative = fxStart > 0 ? fxRate / fxStart : 1;
      indexValueClp = indexValue * fxRelative;
      series.push({
        date: curr.date.toISOString().slice(0, 10),
        indexValue,
        cumulativeReturnPct: (indexValue / 100 - 1) * 100,
        close: curr.close,
        netDividend
      });
      seriesClp.push({
        date: curr.date.toISOString().slice(0, 10),
        indexValue: indexValueClp,
        cumulativeReturnPct: (indexValueClp / 100 - 1) * 100,
        close: curr.close * fxRate,
        netDividend: netDividend * fxRate,
        fxRate
      });
    }
    return new Response(
      JSON.stringify({
        symbol,
        startDate: series[0].date,
        endDate: series[series.length - 1].date,
        taxWithholdingRate: 0.15,
        pointsUsd: series,
        pointsClp: seriesClp
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error fetching IVV weekly net return:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch IVV weekly net return" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
}
__name(onRequest7, "onRequest");

// api/stock.js
async function onRequest8(context) {
  const { request } = context;
  const url = new URL(request.url);
  const toNyDateString = /* @__PURE__ */ __name((value) => new Date(value).toLocaleDateString("en-CA", {
    timeZone: "America/New_York"
  }), "toNyDateString");
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const symbol = url.searchParams.get("symbol");
  if (!symbol) {
    return new Response(JSON.stringify({ error: "Missing symbol parameter" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; DashboardBot/1.0; +https://dashboard-bc6.pages.dev)"
        }
      }
    );
    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch data for ${symbol}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    const data = await response.json();
    const resultNode = data.chart?.result?.[0];
    const meta = resultNode?.meta;
    const quote = resultNode?.indicators?.quote?.[0];
    const timestamps = resultNode?.timestamp || [];
    const rawCloses = quote?.close || [];
    const points = timestamps.map((ts, i) => ({
      ts,
      close: rawCloses[i]
    })).filter((p) => Number.isFinite(p.ts) && typeof p.close === "number");
    if (!meta || points.length === 0) {
      return new Response(
        JSON.stringify({ error: `No data found for ${symbol}` }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    const closes = points.map((p) => p.close);
    const latestPoint = points[points.length - 1];
    const previousPoint = points.length > 1 ? points[points.length - 2] : latestPoint;
    const currentPrice = latestPoint.close;
    const previousClose = previousPoint.close;
    const nowNy = new Date(
      (/* @__PURE__ */ new Date()).toLocaleString("en-US", { timeZone: "America/New_York" })
    );
    const weekStartNy = new Date(nowNy);
    const daysSinceMonday = (weekStartNy.getDay() + 6) % 7;
    weekStartNy.setDate(weekStartNy.getDate() - daysSinceMonday);
    const weekStartNyDate = toNyDateString(weekStartNy);
    const baselinePoint = [...points].reverse().find((p) => toNyDateString(p.ts * 1e3) < weekStartNyDate);
    const weekToDateChangePercent = baselinePoint && baselinePoint.close > 0 ? (currentPrice / baselinePoint.close - 1) * 100 : 0;
    const change = currentPrice - previousClose;
    const changePercent = previousClose ? change / previousClose * 100 : 0;
    const result = {
      symbol: meta.symbol || symbol,
      currentPrice,
      change,
      changePercent,
      weekToDateChangePercent,
      fiftyTwoWeekHigh: Math.max(...closes),
      fiftyTwoWeekLow: Math.min(...closes)
    };
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error(`Error fetching stock data for ${symbol}:`, error);
    return new Response(
      JSON.stringify({ error: `Error fetching data for ${symbol}` }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
}
__name(onRequest8, "onRequest");

// ../.wrangler/tmp/pages-KvI9Tq/functionsRoutes-0.5564616237697206.mjs
var routes = [
  {
    routePath: "/api/etf-watchlist",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest]
  },
  {
    routePath: "/api/etf-watchlist-refresh",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest2]
  },
  {
    routePath: "/api/fed-meeting",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest3]
  },
  {
    routePath: "/api/fed-rate",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest4]
  },
  {
    routePath: "/api/forex",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest5]
  },
  {
    routePath: "/api/ief-yield",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest6]
  },
  {
    routePath: "/api/ivv-weekly-net-return",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest7]
  },
  {
    routePath: "/api/stock",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest8]
  }
];

// ../node_modules/wrangler/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
