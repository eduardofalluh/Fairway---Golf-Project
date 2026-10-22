const ZONE = "America/Toronto";

export function formatPrice(n: number): string {
  return `$${n.toLocaleString("en-CA", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

export function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export function minutesToLabel(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Minutes since midnight → "HH:MM", clamped to the same day. */
export function minutesToHHMM(total: number): string {
  const t = Math.min(23 * 60 + 59, Math.max(0, Math.round(total)));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

export function addDaysISO(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Current local (Montréal/Toronto share a zone) minutes since midnight. */
export function localNowMinutes(): number {
  const hhmm = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date());
  return parseTimeToMinutes(hhmm);
}
