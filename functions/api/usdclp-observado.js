function extractUsdClpObservado(html) {
  const linkMatch = html.match(
    /id="hypLnk([0-9_]+)"[^>]*href="[^"]*gcode=PRE_TCO[^"]*"/i,
  );
  const suffix = linkMatch && linkMatch[1];

  if (!suffix) {
    return null;
  }

  const escapedSuffix = suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const valueMatch = html.match(
    new RegExp(
      `<label[^>]*id="lblValor${escapedSuffix}"[^>]*>\\s*([0-9\\.,]+)\\s*<\\/label>`,
      "i",
    ),
  );

  if (!valueMatch || !valueMatch[1]) {
    return null;
  }

  const normalized = valueMatch[1].replace(/\./g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getChileNowParts(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = formatter.formatToParts(now);
  const getPart = (type) =>
    Number.parseInt(
      (parts.find((p) => p.type === type) || {}).value || "0",
      10,
    );
  const weekdayToken = (
    (parts.find((p) => p.type === "weekday") || {}).value || ""
  ).toLowerCase();
  const weekdayMap = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };

  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour: getPart("hour"),
    weekday: weekdayMap[weekdayToken] ?? 0,
  };
}

function isWeekendUtc(date) {
  const weekday = date.getUTCDay();
  return weekday === 0 || weekday === 6;
}

function subtractBusinessDaysUtc(date, businessDays) {
  const cursor = new Date(date.getTime());
  let remaining = businessDays;

  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (!isWeekendUtc(cursor)) {
      remaining -= 1;
    }
  }

  return cursor;
}

function getObservedEffectiveDate(now = new Date()) {
  const chileNow = getChileNowParts(now);
  const chileDateUtc = new Date(
    Date.UTC(chileNow.year, chileNow.month - 1, chileNow.day),
  );

  const isWeekend = chileNow.weekday === 0 || chileNow.weekday === 6;
  const beforeCutoff =
    chileNow.weekday >= 1 && chileNow.weekday <= 5 && chileNow.hour < 16;
  const needsPreviousBusinessDay = isWeekend || beforeCutoff;
  const effectiveDate = needsPreviousBusinessDay
    ? subtractBusinessDaysUtc(chileDateUtc, 1)
    : chileDateUtc;

  return effectiveDate.toISOString().slice(0, 10);
}

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
      "https://si3.bcentral.cl/indicadoressiete/secure/IndicadoresDiarios.aspx",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; DashboardBot/1.0; +https://dashboard-bc6.pages.dev)",
        },
      },
    );

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch USDCLP observado source" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const html = await response.text();
    const value = extractUsdClpObservado(html);

    if (value === null) {
      return new Response(
        JSON.stringify({ error: "Failed to parse USDCLP observado value" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        value,
        label: "Mon-Fri 16:00 CLT",
        effectiveDate: getObservedEffectiveDate(),
        source:
          "https://si3.bcentral.cl/indicadoressiete/secure/IndicadoresDiarios.aspx",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error fetching USDCLP observado:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch USDCLP observado" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}
