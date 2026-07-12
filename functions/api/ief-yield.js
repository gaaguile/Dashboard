export async function onRequest(context) {
  const { request } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const response = await fetch(
      "https://www.ishares.com/us/products/239456/ishares-7-10-year-treasury-bond-etf",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; DashboardBot/1.0; +https://dashboard-bc6.pages.dev)",
        },
      },
    );

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch IEF yield" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const html = await response.text();
    const yieldMatch = html.match(
      /twelveMonTrlYld&quot;:\{[\s\S]*?formattedValue&quot;:&quot;([^&]+)&quot;/i,
    );
    const dividendYield = yieldMatch ? yieldMatch[1] : null;

    if (!dividendYield) {
      return new Response(
        JSON.stringify({ error: "Failed to parse IEF yield" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ dividendYield, label: "12m trailing yield" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error fetching IEF yield:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch IEF yield" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}
