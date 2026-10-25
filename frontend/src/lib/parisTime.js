// Europe/Paris wall-clock helpers (mirrors backend/live/parisTime.mjs). October 2026
// crosses the DST switch on the 25th, so day boundaries can't use a fixed +02:00.

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
export function parisTimeMs(dateStr, hour = 0, minute = 0, second = 0) {
  const pad = (n) => String(n).padStart(2, "0");
  const naive = Date.parse(`${dateStr}T${pad(hour)}:${pad(minute)}:${pad(second)}Z`);
  const guess = naive - parisOffsetMs(naive);
  return naive - parisOffsetMs(guess);
}

/** Paris-local calendar date (YYYY-MM-DD) of an epoch ms instant. */
export function parisDateOf(ms) {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: PARIS_TZ });
}

/** Paris-local hour (0-23) of an epoch ms instant. */
export function parisHourOf(ms) {
  return Number(partsFormatter.formatToParts(new Date(ms)).find((p) => p.type === "hour").value);
}

export function formatParisTime(ms, withSeconds = true) {
  return new Date(ms).toLocaleTimeString("en-GB", {
    timeZone: PARIS_TZ,
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
  });
}

export function formatParisDate(ms, options = { weekday: "short", day: "numeric", month: "short" }) {
  return new Date(ms).toLocaleDateString("en-GB", { timeZone: PARIS_TZ, ...options });
}

/** Service-day window shown on the timeline: Paris 07:00 -> 23:30. */
export function serviceDayWindow(dateStr) {
  return { dayStartMs: parisTimeMs(dateStr, 7, 0), dayEndMs: parisTimeMs(dateStr, 23, 30) };
}
