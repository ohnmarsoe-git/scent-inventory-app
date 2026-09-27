export type PeriodKey =
  | "this_month"
  | "this_week"
  | "today"
  | "all_time"
  | "custom";

export type DateRange = {
  from: string; // YYYY-MM-DD
  to: string;
  label: string;
};

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function resolvePeriod(
  period: PeriodKey = "this_month",
  customFrom?: string,
  customTo?: string,
): DateRange {
  const now = new Date();
  const today = isoDate(now);

  if (period === "today") {
    return { from: today, to: today, label: "Today" };
  }

  if (period === "this_week") {
    const day = now.getDay(); // 0 Sun
    const diffToMonday = (day + 6) % 7;
    const start = new Date(now);
    start.setDate(now.getDate() - diffToMonday);
    return {
      from: isoDate(start),
      to: today,
      label: "This week",
    };
  }

  if (period === "all_time") {
    return {
      from: "2000-01-01",
      to: today,
      label: "All time",
    };
  }

  if (period === "custom" && customFrom && customTo) {
    return {
      from: customFrom,
      to: customTo,
      label: `${customFrom} → ${customTo}`,
    };
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: isoDate(start),
    to: today,
    label: "This month",
  };
}
