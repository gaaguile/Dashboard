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
    const url = new URL(request.url);
    const requestedSymbol = (url.searchParams.get("symbol") || "IVV").trim();
    const symbol = requestedSymbol.toUpperCase();
    if (!/^[A-Z]{1,10}$/.test(symbol)) {
      return new Response(
        JSON.stringify({ error: "Invalid symbol parameter" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const period1 = Math.floor(
      new Date("2010-01-01T00:00:00Z").getTime() / 1000,
    );
    const period2 = Math.floor(Date.now() / 1000);
    const ivvUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1wk&events=div`;
    const fxUrl = `https://query1.finance.yahoo.com/v8/finance/chart/USDCLP=X?period1=${period1}&period2=${period2}&interval=1wk`;

    const [response, fxResponse] = await Promise.all([
      fetch(ivvUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; DashboardBot/1.0; +https://dashboard-bc6.pages.dev)",
        },
      }),
      fetch(fxUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; DashboardBot/1.0; +https://dashboard-bc6.pages.dev)",
        },
      }),
    ]);

    if (!response.ok || !fxResponse.ok) {
      return new Response(
        JSON.stringify({
          error: "Failed to fetch IVV or USDCLP weekly return history",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
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
    const isFiniteFxRate = (value) =>
      typeof value === "number" && Number.isFinite(value) && value > 0;
    const rawFxPoints = fxTimestamps
      .map((ts, i) => ({ ts, close: fxCloses[i] }))
      .filter((p) => isFiniteFxRate(p.close))
      .sort((a, b) => a.ts - b.ts);
    const inRangeFxPoints = rawFxPoints.filter(
      (p) => p.close >= 100 && p.close <= 2000,
    );
    const fxPoints = inRangeFxPoints.reduce((acc, point) => {
      if (acc.length === 0) {
        acc.push(point);
        return acc;
      }
      const prev = acc[acc.length - 1].close;
      const ratio = point.close / prev;
      // Ignore suspicious one-week spikes/drops that can appear in Yahoo FX data.
      if (ratio >= 0.67 && ratio <= 1.5) {
        acc.push(point);
      }
      return acc;
    }, []);

    const getFxRateAtTs = (ts) => {
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
    };

    const points = timestamps
      .map((ts, i) => ({ ts, close: closes[i] }))
      .filter((p) => typeof p.close === "number")
      .map((p) => ({ ...p, date: new Date(p.ts * 1000) }))
      .filter((p) => p.date >= new Date("2010-01-01T00:00:00Z"));

    if (points.length < 2) {
      return new Response(JSON.stringify({ pointsUsd: [], pointsClp: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dividends = Object.values(dividendsRaw)
      .map((d) => ({
        ts: Number(d.date),
        amount: Number(d.amount) || 0,
      }))
      .filter((d) => Number.isFinite(d.ts) && Number.isFinite(d.amount))
      .sort((a, b) => a.ts - b.ts);

    let indexValue = 100;
    const fxStart = getFxRateAtTs(points[0].ts);
    let indexValueClp = 100;
    const series = [
      {
        date: points[0].date.toISOString().slice(0, 10),
        indexValue,
        cumulativeReturnPct: 0,
        close: points[0].close,
        netDividend: 0,
      },
    ];
    const seriesClp = [
      {
        date: points[0].date.toISOString().slice(0, 10),
        indexValue: indexValueClp,
        cumulativeReturnPct: 0,
        close: points[0].close * fxStart,
        netDividend: 0,
        fxRate: fxStart,
      },
    ];

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const grossDividend = dividends
        .filter((d) => d.ts > prev.ts && d.ts <= curr.ts)
        .reduce((sum, d) => sum + d.amount, 0);
      const netDividend = grossDividend * 0.85;

      const weeklyReturn =
        prev.close > 0 ? (curr.close + netDividend) / prev.close - 1 : 0;
      indexValue *= 1 + weeklyReturn;
      const fxRate = getFxRateAtTs(curr.ts);
      const fxRelative = fxStart > 0 ? fxRate / fxStart : 1;
      indexValueClp = indexValue * fxRelative;

      series.push({
        date: curr.date.toISOString().slice(0, 10),
        indexValue,
        cumulativeReturnPct: (indexValue / 100 - 1) * 100,
        close: curr.close,
        netDividend,
      });
      seriesClp.push({
        date: curr.date.toISOString().slice(0, 10),
        indexValue: indexValueClp,
        cumulativeReturnPct: (indexValueClp / 100 - 1) * 100,
        close: curr.close * fxRate,
        netDividend: netDividend * fxRate,
        fxRate,
      });
    }

    return new Response(
      JSON.stringify({
        symbol,
        startDate: series[0].date,
        endDate: series[series.length - 1].date,
        taxWithholdingRate: 0.15,
        pointsUsd: series,
        pointsClp: seriesClp,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error fetching IVV weekly net return:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch IVV weekly net return" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}
