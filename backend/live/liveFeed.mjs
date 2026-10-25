import { parisDateOf } from "./parisTime.mjs";

const BATCH_COLLECTIONS = [
  "simulationEvents",
  "orders",
  "payments",
  "dishInstances",
  "inventoryMovements",
  "contentionLog",
];

/**
 * Live feed for the pre-simulated month.
 *
 * The whole month is generated up front, but nothing later than the wall clock is
 * visible: the release cutoff is "now" rounded down to the batch size, so data
 * appears in 15-second increments at 1x, exactly as a live POS/KDS feed would
 * deliver it. Dates before `startDate` are plain history.
 */
export class LiveFeed {
  constructor(store, session = {}) {
    this.store = store;
    this.dates = session.availableDates || [];
    this.startDate = session.liveFeed?.startDate || this.dates[this.dates.length - 1];
    this.batchMs = (session.liveFeed?.batchSeconds || 15) * 1000;
    this.clients = new Set();
    this.lastBatchEndMs = this.releasedUntilMs();
    this.timer = null;
  }

  releasedUntilMs(nowMs = Date.now()) {
    return Math.floor(nowMs / this.batchMs) * this.batchMs;
  }

  /** Paris service date the feed is currently writing to (clamped to the month). */
  liveDate(nowMs = Date.now()) {
    const today = parisDateOf(this.releasedUntilMs(nowMs));
    if (today < this.dates[0]) return this.dates[0];
    if (today > this.dates[this.dates.length - 1]) return this.dates[this.dates.length - 1];
    return today;
  }

  status() {
    return {
      startDate: this.startDate,
      batchSeconds: this.batchMs / 1000,
      releasedUntilMs: this.releasedUntilMs(),
      serverNowMs: Date.now(),
      liveDate: this.liveDate(),
    };
  }

  /** One entry per day of the month: historic, live (today) or upcoming, with totals so far. */
  calendar() {
    const today = this.liveDate();
    return this.dates.map((date) => {
      const state = date < today ? "complete" : date === today ? "live" : "upcoming";
      const summary = state === "upcoming" ? null : this.store.getDaySummary(date);
      return {
        date,
        segment: date < this.startDate ? "historic" : "live",
        state,
        orderCount: summary?.orderCount || 0,
        covers: summary?.covers || 0,
        revenueCents: summary?.revenueCents || 0,
        byBusiness: summary?.byBusiness || {},
      };
    });
  }

  start() {
    const schedule = () => {
      const now = Date.now();
      const nextBoundary = this.releasedUntilMs(now) + this.batchMs;
      this.timer = setTimeout(() => {
        this.emitBatch();
        schedule();
      }, nextBoundary - now + 25);
    };
    schedule();
  }

  emitBatch() {
    const fromMs = this.lastBatchEndMs;
    const toMs = this.releasedUntilMs();
    if (toMs <= fromMs) return;
    this.lastBatchEndMs = toMs;
    if (this.clients.size === 0) return;

    // A batch normally covers one service date; around midnight it can touch two.
    const dates = [...new Set([parisDateOf(fromMs + 1), parisDateOf(toMs)])].filter((d) => this.dates.includes(d));
    const calendar = this.calendar();
    const days = dates.map((serviceDate) => {
      const day = { serviceDate };
      for (const col of BATCH_COLLECTIONS) {
        day[col === "simulationEvents" ? "events" : col] = this.store.getReleasedBetween(col, serviceDate, fromMs, toMs);
      }
      day.calendarDay = calendar.find((c) => c.date === serviceDate) || null;
      return day;
    });

    this.broadcast("batch", { fromMs, toMs, serverNowMs: Date.now(), liveDate: this.liveDate(), days });
  }

  broadcast(type, payload) {
    const frame = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const res of this.clients) res.write(frame);
  }

  /** Server-Sent Events endpoint: a hello with the feed status, then one frame per batch. */
  handleStream(req, res) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
    });
    res.write(`retry: 3000\nevent: hello\ndata: ${JSON.stringify(this.status())}\n\n`);
    this.clients.add(res);
    req.on("close", () => this.clients.delete(res));
  }
}
