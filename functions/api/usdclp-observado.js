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

const SII_MONTH_IDS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function parseLocaleNumber(raw) {
  if (typeof raw !== "string") return null;
  const cleaned = raw
    .replace(/\u00a0/g, " ")
    .trim()
    .replace(/[^0-9,.-]/g, "");

  if (!cleaned) return null;

  let normalized = cleaned;
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (hasComma && hasDot) {
    // Handles values like 1.234,56.
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    // Handles values like 924,78.
    normalized = cleaned.replace(/,/g, ".");
  } else {
    // Handles values like 924.78.
    normalized = cleaned;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractUsdClpObservadoFromSii(html, effectiveDate) {
  const [yearToken, monthToken, dayToken] = String(effectiveDate || "").split(
    "-",
  );
  const month = Number.parseInt(monthToken, 10);
  const day = Number.parseInt(dayToken, 10);
  const monthId = SII_MONTH_IDS[month - 1];
  if (!yearToken || !monthId || !Number.isFinite(day)) {
    return null;
  }

  const targetUtc = Date.UTC(
    Number.parseInt(yearToken, 10),
    month - 1,
    day,
    23,
    59,
    59,
    999,
  );
  const monthSectionRegex =
    /<div class=['"]meses['"][^>]*id=['"]mes_([a-z]+)['"][\s\S]*?(?=<div class=['"]meses['"]|$)/gi;
  const pairRegex =
    /<th[^>]*>\s*(?:<strong>)?\s*(\d{1,2})\s*(?:<\/strong>)?\s*<\/th>\s*<td[^>]*>\s*([^<]*)\s*<\/td>/gi;

  let bestValue = null;
  let bestDateUtc = -1;
  let sectionMatch;
  while ((sectionMatch = monthSectionRegex.exec(html)) !== null) {
    const sectionMonthId = (sectionMatch[1] || "").toLowerCase();
    const sectionMonthIndex = SII_MONTH_IDS.indexOf(sectionMonthId);
    if (sectionMonthIndex < 0) {
      continue;
    }

    const sectionHtml = sectionMatch[0];
    let dayMatch;
    while ((dayMatch = pairRegex.exec(sectionHtml)) !== null) {
      const parsedDay = Number.parseInt(dayMatch[1], 10);
      const parsedValue = parseLocaleNumber(dayMatch[2]);
      if (!Number.isFinite(parsedDay) || parsedValue === null) {
        continue;
      }

      const candidateDateUtc = Date.UTC(
        Number.parseInt(yearToken, 10),
        sectionMonthIndex,
        parsedDay,
      );
      if (candidateDateUtc <= targetUtc && candidateDateUtc > bestDateUtc) {
        bestDateUtc = candidateDateUtc;
        bestValue = parsedValue;
      }
    }
  }

  return bestValue;
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
    const effectiveDate = getObservedEffectiveDate();
    const primarySource =
      "https://si3.bcentral.cl/indicadoressiete/secure/IndicadoresDiarios.aspx";
    const effectiveYear = Number.parseInt(effectiveDate.slice(0, 4), 10);
    const fallbackSource = `https://www.sii.cl/valores_y_fechas/dolar/dolar${effectiveYear}.htm`;
    let value = null;
    let source = "";

    try {
      const response = await fetch(primarySource, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; DashboardBot/1.0; +https://dashboard-bc6.pages.dev)",
        },
      });

      if (response.ok) {
        const html = await response.text();
        value = extractUsdClpObservado(html);
        if (value !== null) {
          source = primarySource;
        }
      }
    } catch (primaryError) {
      console.warn("Primary USDCLP observado source failed:", primaryError);
    }

    if (value === null) {
      const fallbackResponse = await fetch(fallbackSource, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; DashboardBot/1.0; +https://dashboard-bc6.pages.dev)",
        },
      });
      if (!fallbackResponse.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch USDCLP observado source" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const fallbackHtml = await fallbackResponse.text();
      value = extractUsdClpObservadoFromSii(fallbackHtml, effectiveDate);
      source = fallbackSource;

      if (value === null) {
        const previousYearSource = `https://www.sii.cl/valores_y_fechas/dolar/dolar${effectiveYear - 1}.htm`;
        const previousYearResponse = await fetch(previousYearSource, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; DashboardBot/1.0; +https://dashboard-bc6.pages.dev)",
          },
        });

        if (previousYearResponse.ok) {
          const previousYearHtml = await previousYearResponse.text();
          value = extractUsdClpObservadoFromSii(
            previousYearHtml,
            `${effectiveYear - 1}-12-31`,
          );
          if (value !== null) {
            source = previousYearSource;
          }
        }
      }
    }

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
        effectiveDate,
        source,
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
