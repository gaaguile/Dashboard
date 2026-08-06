const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Refresh-Token",
};

const JSON_HEADERS = {
  ...CORS_HEADERS,
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=300, s-maxage=300",
};

function jsonResponse(body, status = 200, headers = JSON_HEADERS) {
  return new Response(JSON.stringify(body), { status, headers });
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const kvBinding = env.ETF_DATA_KV;
  const kvKey = env.ETF_WATCHLIST_KV_KEY || "drawdown-weekly.json";
  const staticPath =
    env.ETF_WATCHLIST_SOURCE_PATH || "/etf-watchlist/drawdown-weekly.json";

  try {
    if (kvBinding) {
      const raw = await kvBinding.get(kvKey);
      if (raw) {
        const payload = JSON.parse(raw);
        return jsonResponse(payload);
      }
    }

    // Fallback for first deploys: return the bundled static file.
    const fallbackUrl = new URL(staticPath, request.url);
    const fallbackResponse = await fetch(fallbackUrl.toString());
    if (!fallbackResponse.ok) {
      throw new Error(
        `Fallback fetch failed with HTTP ${fallbackResponse.status}`,
      );
    }
    const fallbackPayload = await fallbackResponse.json();
    return jsonResponse(fallbackPayload);
  } catch (error) {
    return jsonResponse(
      {
        error: "ETF watchlist payload unavailable",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      500,
      { ...JSON_HEADERS, "Cache-Control": "no-store" },
    );
  }
}
