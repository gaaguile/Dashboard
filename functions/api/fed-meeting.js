export async function onRequest(context) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // FOMC meeting dates for 2024-2025
  const FOMC_DATES = [
    new Date(2024, 0, 31), // Jan 31, 2024
    new Date(2024, 2, 20), // Mar 20, 2024
    new Date(2024, 4, 1), // May 1, 2024
    new Date(2024, 5, 19), // Jun 19, 2024
    new Date(2024, 8, 18), // Sep 18, 2024
    new Date(2024, 10, 7), // Nov 7, 2024
    new Date(2024, 11, 18), // Dec 18, 2024
    new Date(2025, 0, 29), // Jan 29, 2025
    new Date(2025, 2, 19), // Mar 19, 2025
    new Date(2025, 4, 7), // May 7, 2025
    new Date(2025, 5, 18), // Jun 18, 2025
    new Date(2025, 8, 17), // Sep 17, 2025
    new Date(2025, 10, 5), // Nov 5, 2025
    new Date(2025, 11, 17), // Dec 17, 2025
  ];

  function getNextFOMCDate() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const fomcDate of FOMC_DATES) {
      if (fomcDate > today) {
        return fomcDate;
      }
    }

    return FOMC_DATES[FOMC_DATES.length - 1];
  }

  try {
    const nextFOMCDate = getNextFOMCDate();
    const today = new Date();
    const daysUntil = Math.ceil(
      (nextFOMCDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    const result = {
      date: nextFOMCDate.toISOString(),
      daysUntil: Math.max(0, daysUntil),
      formattedDate: nextFOMCDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching FED meeting date:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch FED meeting date" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}
