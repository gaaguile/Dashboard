export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

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
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`,
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
    const closes = (quote?.close || []).filter((v) => typeof v === "number");

    if (!meta || closes.length === 0) {
      return new Response(
        JSON.stringify({ error: `No data found for ${symbol}` }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const currentPrice = closes[closes.length - 1];
    const previousClose =
      closes.length > 1 ? closes[closes.length - 2] : currentPrice;

    const change = currentPrice - previousClose;
    const changePercent = previousClose ? (change / previousClose) * 100 : 0;

    const result = {
      symbol: meta.symbol || symbol,
      currentPrice,
      change,
      changePercent,
      fiftyTwoWeekHigh: Math.max(...closes),
      fiftyTwoWeekLow: Math.min(...closes),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(`Error fetching stock data for ${symbol}:`, error);
    return new Response(
      JSON.stringify({ error: `Error fetching data for ${symbol}` }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}
