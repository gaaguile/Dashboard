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
      "https://www.federalreserve.gov/monetarypolicy/openmarket.htm",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; DashboardBot/1.0; +https://dashboard-bc6.pages.dev)",
        },
      },
    );

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch Fed rate" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const html = await response.text();
    const rowMatch = html.match(
      /<h4>2025<\/h4>[\s\S]*?<tbody>\s*<tr>\s*<td class="bold stub" nowrap="nowrap" scope="row">[^<]+<\/td>\s*<td class="stub" nowrap="nowrap">\d+<\/td>\s*<td class="stub" nowrap="nowrap">\d+<\/td>\s*<td class="stub" nowrap="nowrap">([^<]+)<\/td>/i,
    );
    const fallbackRange = html.match(/\b\d+(?:\.\d+)?-\d+(?:\.\d+)?\b/);
    const currentRange = rowMatch
      ? `${rowMatch[1]}%`
      : fallbackRange
        ? `${fallbackRange[0]}%`
        : null;

    if (!currentRange) {
      return new Response(
        JSON.stringify({ error: "Failed to parse Fed rate" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ currentRange, label: "Target range" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error fetching Fed rate:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch Fed rate" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
