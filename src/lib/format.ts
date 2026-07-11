import type { TimeOfDay } from "@/types/itinerary";

export function formatTripDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDayHeader(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

export function formatTime12h(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time24;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

/** Morning 06:00–11:59, Afternoon 12:00–17:59, Evening 18:00–22:00 */
export function getTimeOfDay(time24: string): TimeOfDay {
  const hour = parseInt(time24.split(":")[0] ?? "12", 10);
  if (hour >= 6 && hour <= 11) return "morning";
  if (hour >= 12 && hour <= 17) return "afternoon";
  if (hour >= 18 && hour <= 22) return "evening";
  if (hour < 6) return "morning";
  return "evening";
}

export function formatTimeOfDayLabel(period: TimeOfDay): string {
  return period.charAt(0).toUpperCase() + period.slice(1);
}

/** Remove time-of-day words from titles that conflict with scheduled time */
export function alignTitleWithTimeOfDay(title: string, period: TimeOfDay): string {
  let t = title;
  const strip = (words: string[]) => {
    for (const w of words) {
      t = t.replace(new RegExp(`\\b${w}\\b`, "gi"), "").replace(/\s+/g, " ").trim();
    }
  };

  if (period === "afternoon") {
    strip(["morning", "breakfast", "sunrise", "early"]);
  } else if (period === "evening") {
    strip(["morning", "afternoon", "midday", "lunch"]);
  } else {
    strip(["afternoon", "evening", "dinner", "sunset"]);
  }

  if (!t) return title;
  const prefix =
    period === "morning" ? "Morning:" : period === "afternoon" ? "Afternoon:" : "Evening:";
  if (/^(morning|afternoon|evening):/i.test(t)) return t;
  return `${prefix} ${t}`;
}

export function displayLocation(name: string): string {
  return name.toUpperCase();
}

export function formatMoney(amount: number, currency: string, symbol: string): string {
  if (currency === "JPY") return `${symbol}${Math.round(amount).toLocaleString()}`;
  return `${symbol}${amount.toFixed(2)}`;
}
