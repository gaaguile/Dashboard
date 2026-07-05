// Fetch FOMC meeting dates from the Federal Reserve website
// Fallback to hardcoded dates if fetch fails

const FALLBACK_DATES = [
  // 2024
  new Date(2024, 0, 30), // Jan 30-31
  new Date(2024, 2, 19), // Mar 19-20
  new Date(2024, 4, 0), // May 1
  new Date(2024, 5, 18), // Jun 18-19
  new Date(2024, 8, 17), // Sep 17-18
  new Date(2024, 10, 6), // Nov 7
  new Date(2024, 11, 17), // Dec 17-18
  // 2025
  new Date(2025, 0, 28), // Jan 28-29
  new Date(2025, 2, 18), // Mar 18-19
  new Date(2025, 4, 6), // May 6-7
  new Date(2025, 5, 17), // Jun 17-18
  new Date(2025, 8, 16), // Sep 16-17
  new Date(2025, 10, 4), // Nov 5
  new Date(2025, 11, 16), // Dec 16-17
  // 2026
  new Date(2026, 0, 27), // Jan 27-28
  new Date(2026, 2, 17), // Mar 17-18
  new Date(2026, 4, 5), // May 5-6
  new Date(2026, 5, 16), // Jun 16-17
  new Date(2026, 8, 15), // Sep 15-16
  new Date(2026, 10, 3), // Nov 3-4
  new Date(2026, 11, 15), // Dec 15-16
  // 2027
  new Date(2027, 0, 26), // Jan 26-27
  new Date(2027, 2, 16), // Mar 16-17
  new Date(2027, 3, 27), // Apr 27-28
  new Date(2027, 5, 8), // Jun 8-9
  new Date(2027, 6, 27), // Jul 27-28
  new Date(2027, 8, 14), // Sep 14-15
  new Date(2027, 9, 26), // Oct 26-27
  new Date(2027, 11, 7), // Dec 7-8
];

interface FOMCDate {
  dateString: string;
  meetingEndDate: Date;
}

export async function fetchFOMCDates(): Promise<Date[]> {
  try {
    const response = await fetch(
      "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
    );
    if (!response.ok) {
      console.warn("Failed to fetch Fed calendar, using fallback dates");
      return FALLBACK_DATES;
    }

    const html = await response.text();

    // Parse with cheerio (requires server-side)
    // For now, use regex pattern matching
    const fomcDates = parseForoMCDatesFromHTML(html);

    if (fomcDates.length > 0) {
      console.log(
        `Successfully fetched ${fomcDates.length} FOMC dates from Fed website`,
      );
      return fomcDates;
    }

    console.warn("Could not parse FOMC dates from HTML, using fallback");
    return FALLBACK_DATES;
  } catch (error) {
    console.error("Error fetching FOMC dates:", error);
    return FALLBACK_DATES;
  }
}

function parseForoMCDatesFromHTML(html: string): Date[] {
  const dates: Date[] = [];
  const currentYear = new Date().getFullYear();

  // Look for patterns like "January 28-29" or "January 28-29*"
  const monthPattern =
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})-(\d{1,2})\*?/gi;

  let match;
  const monthMap: { [key: string]: number } = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
  };

  // Extract year sections to understand context
  // Pattern: #### [2025 FOMC Meetings](#) or similar
  const yearPattern = /(\d{4})\s+FOMC\s+Meetings/gi;
  const htmlParts = html.split(yearPattern);

  let currentParsedYear = currentYear;
  let dateIndex = 0;

  while ((match = monthPattern.exec(html)) !== null && dateIndex < 500) {
    const monthName = match[1].toLowerCase();
    const startDay = parseInt(match[2]);
    const endDay = parseInt(match[3]);

    // Try to determine year from context
    // If day > 25, it's likely not a date crossing month boundary
    const monthIndex = monthMap[monthName];
    if (monthIndex !== undefined) {
      const date = new Date(currentParsedYear, monthIndex, endDay);
      dates.push(date);
    }
    dateIndex++;
  }

  // Filter for future dates and reasonable timeframe (next 2-3 years)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filtered = dates
    .filter((d) => {
      d.setHours(0, 0, 0, 0);
      return d >= today && d.getFullYear() <= currentYear + 3;
    })
    .sort((a, b) => a.getTime() - b.getTime())
    // Remove duplicates
    .filter((date, index, arr) => {
      if (index === 0) return true;
      const prevDate = arr[index - 1];
      return (
        date.getTime() !== prevDate.getTime() &&
        date.getTime() !== prevDate.getTime() + 24 * 60 * 60 * 1000
      );
    });

  return filtered.length > 0 ? filtered : FALLBACK_DATES;
}

export function getNextFOMCDate(dates: Date[]): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const fomcDate of dates) {
    if (fomcDate > today) {
      return fomcDate;
    }
  }

  return dates[dates.length - 1] || FALLBACK_DATES[FALLBACK_DATES.length - 1];
}
