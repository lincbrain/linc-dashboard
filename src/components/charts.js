import { useEffect, useState } from "react";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-10" -> "Oct"
export function shortMonth(month) {
  return MONTH_NAMES[Number(month.slice(5, 7)) - 1];
}

// "2026-10" -> "October 2026"
export function longMonth(month) {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year, index - 1, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// The time charts start here, even when earlier data exists
export const TIME_CHART_START = "2023-01";

export function monthRange(first, last) {
  const months = [];
  let [year, month] = first.split("-").map(Number);
  const [lastYear, lastMonth] = last.split("-").map(Number);
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

// "2026-10-05" -> milliseconds since the epoch (UTC)
export function dayValue(date) {
  return Date.parse(`${date}T00:00:00Z`);
}

// The first day of the month after "YYYY-MM", in milliseconds.
export function monthEndValue(month) {
  const [year, index] = month.split("-").map(Number);
  return Date.UTC(year, index, 1);
}

// The smallest round step that spans `max` in at most `count` + 1 intervals
export function niceStep(max, count = 4) {
  if (!(max > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(max / count));
  const nice = [1, 2, 2.5, 5].find((n) => Math.ceil(max / (n * power)) <= count + 1) ?? 10;
  return nice * power;
}

const compactFormat = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function formatCompact(value) {
  return compactFormat.format(value);
}

export function useElementWidth(ref) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
