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
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=price`,
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
    const price = data.quoteSummary?.result?.[0]?.price;

    if (!price) {
      return new Response(
        JSON.stringify({ error: `No data found for ${symbol}` }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const result = {
      symbol: price.symbol,
      currentPrice: price.regularMarketPrice?.raw || 0,
      change: price.regularMarketChange?.raw || 0,
      changePercent: price.regularMarketChangePercent?.raw || 0,
      fiftyTwoWeekHigh: price.fiftyTwoWeekHigh?.raw || 0,
      fiftyTwoWeekLow: price.fiftyTwoWeekLow?.raw || 0,
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
