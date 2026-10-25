// Europe/Paris wall-clock helpers. The month spans the 25 October 2026 DST switch
// (+02:00 -> +01:00), so service-day boundaries can never be built with a fixed offset.

const PARIS_TZ = "Europe/Paris";

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PARIS_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function parisOffsetMs(utcMs) {
  const p = Object.fromEntries(partsFormatter.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Epoch ms of a Paris-local wall-clock time on `dateStr` (YYYY-MM-DD). */
export function parisTimeMs(dateStr, hour = 0, minute = 0) {
  const naive = Date.parse(`${dateStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);
  const guess = naive - parisOffsetMs(naive);
  return naive - parisOffsetMs(guess);
}

/** Paris-local calendar date (YYYY-MM-DD) of an epoch ms instant. */
export function parisDateOf(ms) {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: PARIS_TZ });
}
