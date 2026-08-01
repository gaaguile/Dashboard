export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  const toNyDateString = (value) =>
    new Date(value).toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    });

  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const symbol = url.searchParams.get("symbol");

  if (!symbol) {
    return new Response(JSON.stringify({ error: "Missing symbol parameter" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; DashboardBot/1.0; +https://dashboard-bc6.pages.dev)",
        },
      },
    );

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch data for ${symbol}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const data = await response.json();
    const resultNode = data.chart?.result?.[0];
    const meta = resultNode?.meta;
    const quote = resultNode?.indicators?.quote?.[0];
    const timestamps = resultNode?.timestamp || [];
    const rawCloses = quote?.close || [];
    const points = timestamps
      .map((ts, i) => ({ ts, close: rawCloses[i] }))
      .filter((p) => Number.isFinite(p.ts) && typeof p.close === "number");

    if (!meta || points.length === 0) {
      return new Response(
        JSON.stringify({ error: `No data found for ${symbol}` }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const latestPoint = points[points.length - 1];
    const previousPoint =
      points.length > 1 ? points[points.length - 2] : latestPoint;
    const lastPrice = latestPoint.close;
    const previousClose = previousPoint.close;

    const nowNy = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
    );
    const weekStartNy = new Date(nowNy);
    const daysSinceMonday = (weekStartNy.getDay() + 6) % 7;
    weekStartNy.setDate(weekStartNy.getDate() - daysSinceMonday);
    const weekStartNyDate = toNyDateString(weekStartNy);

    const baselinePoint = [...points]
      .reverse()
      .find((p) => toNyDateString(p.ts * 1000) < weekStartNyDate);
    const weekToDateChangePercent =
      baselinePoint && baselinePoint.close > 0
        ? (lastPrice / baselinePoint.close - 1) * 100
        : 0;

    const change = lastPrice - previousClose;
    const changePercent = previousClose ? (change / previousClose) * 100 : 0;

    const result = {
      symbol: meta.symbol || symbol,
      change,
      changePercent,
      weekToDateChangePercent,
      lastPrice,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(`Error fetching forex data for ${symbol}:`, error);
    return new Response(
      JSON.stringify({ error: `Error fetching data for ${symbol}` }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}
