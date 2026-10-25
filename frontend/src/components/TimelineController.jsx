import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSimulationStore } from "../store/useSimulationStore";
import { formatParisDate, formatParisTime, parisHourOf, parisTimeMs } from "../lib/parisTime";

const SPEEDS = [1, 10, 60, 300];
const EMPTY = [];
const BIN_MINUTES = 5;
const SERVICE_BANDS = [
  { label: "Lunch", from: [12, 0], to: [14, 30] },
  { label: "Dinner", from: [19, 0], to: [22, 30] },
];
const HOUR_TICKS = [8, 10, 12, 14, 16, 18, 20, 22];

function servicePhase(ms) {
  const hour = parisHourOf(ms);
  if (hour < 11) return "Morning prep";
  if (hour < 15) return "Lunch service";
  if (hour < 19) return "Afternoon break";
  if (hour < 23) return "Dinner service";
  return "Closing";
}

function formatEurosShort(cents) {
  return `€${Math.round((cents || 0) / 100).toLocaleString("en-GB")}`;
}

function formatLag(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 90) return `${s}s`;
  const m = Math.round(s / 60);
  return m < 90 ? `${m}m` : `${Math.round(m / 60)}h`;
}

const Icon = {
  prev: (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor" aria-hidden="true">
      <rect x="2" y="3" width="2" height="10" rx="0.5" />
      <path d="M13 3.5v9a.5.5 0 0 1-.8.4L6 8.4a.5.5 0 0 1 0-.8l6.2-4.5a.5.5 0 0 1 .8.4z" />
    </svg>
  ),
  next: (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor" aria-hidden="true">
      <rect x="12" y="3" width="2" height="10" rx="0.5" />
      <path d="M3 3.5v9a.5.5 0 0 0 .8.4L10 8.4a.5.5 0 0 0 0-.8L3.8 3.1a.5.5 0 0 0-.8.4z" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor" aria-hidden="true">
      <path d="M4.5 2.8v10.4a.6.6 0 0 0 .9.5l8.3-5.2a.6.6 0 0 0 0-1L5.4 2.3a.6.6 0 0 0-.9.5z" />
    </svg>
  ),
  reverse: (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor" aria-hidden="true">
      <path d="M11.5 2.8v10.4a.6.6 0 0 1-.9.5L2.3 8.5a.6.6 0 0 1 0-1l8.3-5.2a.6.6 0 0 1 .9.5z" />
    </svg>
  ),
  pause: (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor" aria-hidden="true">
      <rect x="3.5" y="2.5" width="3" height="11" rx="0.8" />
      <rect x="9.5" y="2.5" width="3" height="11" rx="0.8" />
    </svg>
  ),
};

function TransportButton({ onClick, title, active, children, primary }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active || undefined}
      className={`h-8 flex items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
        primary ? "w-10" : "w-8"
      } ${
        active
          ? "bg-amber-500 text-slate-950"
          : primary
          ? "bg-slate-100 text-slate-950 hover:bg-white"
          : "text-slate-300 hover:text-white hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

/** 31 days of October: bar height = revenue, solid = history, red = today's live feed. */
function MonthLedger({ calendar, serviceDate, onSelect }) {
  const maxRevenue = Math.max(1, ...calendar.map((d) => d.revenueCents || 0));
  const firstLive = calendar.findIndex((d) => d.segment === "live");
  const historicCount = firstLive === -1 ? calendar.length : firstLive;

  return (
    <div className="flex flex-col min-w-0" role="group" aria-label="Month">
      <div className="flex text-[9px] font-mono uppercase tracking-widest leading-none mb-1">
        <span className="text-slate-500" style={{ flex: historicCount }}>
          History · {calendar[0]?.date.slice(8)}–{calendar[historicCount - 1]?.date.slice(8)} Oct
        </span>
        {firstLive !== -1 && (
          <span className="text-rose-400 pl-1 border-l border-rose-500/40" style={{ flex: calendar.length - historicCount }}>
            Live · {calendar[firstLive].date.slice(8)}–{calendar[calendar.length - 1].date.slice(8)}
          </span>
        )}
      </div>
      <div className="flex items-end gap-[2px] h-7">
        {calendar.map((d) => {
          const selected = d.date === serviceDate;
          const upcoming = d.state === "upcoming";
          const live = d.state === "live";
          const heightPct = upcoming ? 0 : Math.max(8, ((d.revenueCents || 0) / maxRevenue) * 100);
          const day = Number(d.date.slice(8));
          const weekday = formatParisDate(parisTimeMs(d.date, 12), { weekday: "short" });
          const title = upcoming
            ? `${weekday} ${day} Oct · not served yet`
            : `${weekday} ${day} Oct · ${d.orderCount} checks · ${d.covers} covers · ${formatEurosShort(d.revenueCents)}${live ? " so far (live)" : ""}`;
          return (
            <button
              key={d.date}
              type="button"
              disabled={upcoming}
              onClick={() => onSelect(d.date)}
              title={title}
              aria-label={title}
              aria-current={selected ? "date" : undefined}
              className={`relative flex-1 min-w-[9px] max-w-[22px] h-full rounded-[3px] flex items-end overflow-hidden transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                upcoming
                  ? "border border-dashed border-slate-700/70 cursor-not-allowed"
                  : selected
                  ? "bg-slate-800 ring-1 ring-amber-400"
                  : "bg-slate-900 hover:bg-slate-800"
              }`}
            >
              {!upcoming && (
                <span
                  className={`w-full rounded-[2px] ${
                    live ? "bg-rose-500" : selected ? "bg-amber-400" : "bg-slate-600"
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
              )}
              {live && <span className="absolute top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-rose-400 animate-pulse" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Day scrubber: the street's rhythm of service, drawn from event density. */
function DayScrubber({ events, dayStartMs, dayEndMs, timestampMs, liveEdgeMs, serviceDate, onScrub }) {
  const trackRef = useRef(null);
  const [hoverMs, setHoverMs] = useState(null);
  const draggingRef = useRef(false);
  const span = dayEndMs - dayStartMs;
  const pct = (ms) => Math.max(0, Math.min(100, ((ms - dayStartMs) / span) * 100));

  const bins = useMemo(() => {
    const count = Math.ceil(span / (BIN_MINUTES * 60000));
    const arr = new Array(count).fill(0);
    for (const e of events) {
      const i = Math.floor((e.eventTimeMs - dayStartMs) / (BIN_MINUTES * 60000));
      if (i >= 0 && i < count) arr[i] += 1;
    }
    return arr;
    // Recount only when events are appended or the day changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.length, dayStartMs, span]);
  const maxBin = Math.max(1, ...bins);
  const playheadBin = Math.floor((timestampMs - dayStartMs) / (BIN_MINUTES * 60000));

  const msFromClientX = (clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return dayStartMs + ratio * span;
  };

  const onKeyDown = (e) => {
    const step = (e.shiftKey ? 10 : 1) * 60000;
    if (e.key === "ArrowRight") onScrub(timestampMs + step);
    else if (e.key === "ArrowLeft") onScrub(timestampMs - step);
    else if (e.key === "Home") onScrub(dayStartMs);
    else if (e.key === "End") onScrub(liveEdgeMs ?? dayEndMs);
    else return;
    e.preventDefault();
  };

  const hasFuture = liveEdgeMs != null && liveEdgeMs < dayEndMs;

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 select-none">
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label={`Time of day, ${serviceDate}`}
          aria-valuemin={dayStartMs}
          aria-valuemax={liveEdgeMs ?? dayEndMs}
          aria-valuenow={Math.round(timestampMs)}
          aria-valuetext={formatParisTime(timestampMs, false)}
          onKeyDown={onKeyDown}
          onPointerDown={(e) => {
            draggingRef.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            onScrub(msFromClientX(e.clientX));
          }}
          onPointerMove={(e) => {
            const ms = msFromClientX(e.clientX);
            setHoverMs(ms);
            if (draggingRef.current) onScrub(ms);
          }}
          onPointerUp={() => (draggingRef.current = false)}
          onPointerLeave={() => setHoverMs(null)}
          className="relative h-9 rounded-md bg-slate-900 border border-slate-800 cursor-pointer overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          {SERVICE_BANDS.map((b) => {
            const from = parisTimeMs(serviceDate, ...b.from);
            const to = parisTimeMs(serviceDate, ...b.to);
            return (
              <div
                key={b.label}
                className="absolute inset-y-0 bg-slate-800/50 border-x border-slate-700/40"
                style={{ left: `${pct(from)}%`, width: `${pct(to) - pct(from)}%` }}
              >
                <span className="absolute top-0.5 left-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                  {b.label}
                </span>
              </div>
            );
          })}

          <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${bins.length} 100`} preserveAspectRatio="none" aria-hidden="true">
            {bins.map((n, i) =>
              n > 0 ? (
                <rect
                  key={i}
                  x={i + 0.1}
                  width={0.8}
                  y={100 - Math.max(6, (n / maxBin) * 78)}
                  height={Math.max(6, (n / maxBin) * 78)}
                  className={i <= playheadBin ? "fill-amber-400/80" : "fill-slate-500/70"}
                />
              ) : null
            )}
          </svg>

          {hasFuture && (
            <div
              className="absolute inset-y-0 right-0 border-l border-rose-500/70"
              style={{
                left: `${pct(liveEdgeMs)}%`,
                backgroundImage: "repeating-linear-gradient(135deg, rgba(100,116,139,0.18) 0 4px, transparent 4px 9px)",
              }}
            >
              <span className="absolute bottom-0.5 left-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                Not happened yet
              </span>
            </div>
          )}

          <div className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_6px_rgba(255,255,255,0.7)] pointer-events-none" style={{ left: `${pct(timestampMs)}%` }} />
        </div>

        {hoverMs != null && (
          <div
            className="absolute -top-6 -translate-x-1/2 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-200 pointer-events-none"
            style={{ left: `${pct(hoverMs)}%` }}
          >
            {formatParisTime(hasFuture ? Math.min(hoverMs, liveEdgeMs) : hoverMs, false)}
          </div>
        )}

        <div className="relative h-3.5 mt-0.5 text-[9px] font-mono text-slate-500" aria-hidden="true">
          {HOUR_TICKS.map((h) => (
            <span key={h} className="absolute -translate-x-1/2" style={{ left: `${pct(parisTimeMs(serviceDate, h))}%` }}>
              {String(h).padStart(2, "0")}:00
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TimelineController() {
  const serviceDate = useSimulationStore((s) => s.serviceDate);
  const timestampMs = useSimulationStore((s) => s.timestampMs);
  const dayStartMs = useSimulationStore((s) => s.dayStartMs);
  const dayEndMs = useSimulationStore((s) => s.dayEndMs);
  const isPlaying = useSimulationStore((s) => s.isPlaying);
  const playbackSpeed = useSimulationStore((s) => s.playbackSpeed);
  const followLive = useSimulationStore((s) => s.followLive);
  const feed = useSimulationStore((s) => s.feed);
  const monthCalendar = useSimulationStore((s) => s.monthCalendar);
  const events = useSimulationStore((s) => s.dayBundle?.events || EMPTY);
  const eventsApplied = useSimulationStore((s) => s.projectedState?.eventsAppliedCount || 0);

  const setServiceDate = useSimulationStore((s) => s.setServiceDate);
  const setTimestampMs = useSimulationStore((s) => s.setTimestampMs);
  const togglePlay = useSimulationStore((s) => s.togglePlay);
  const setPlaybackSpeed = useSimulationStore((s) => s.setPlaybackSpeed);
  const tickSimulation = useSimulationStore((s) => s.tickSimulation);
  const jumpToRelativeEvent = useSimulationStore((s) => s.jumpToRelativeEvent);
  const goLive = useSimulationStore((s) => s.goLive);

  // Drive the clock with requestAnimationFrame while playing (replay or live)
  useEffect(() => {
    if (!isPlaying) return undefined;
    let rafId;
    let lastTime = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;
      tickSimulation(dt);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, tickSimulation]);

  const isLiveDay = serviceDate === feed.liveDate;
  const liveEdgeMs = isLiveDay ? Math.min(dayEndMs, feed.releasedUntilMs) : null;
  const isLive = followLive && isPlaying;
  const lagMs = isLiveDay && !isLive ? Math.max(0, feed.releasedUntilMs - timestampMs) : 0;
  const magnitude = Math.abs(playbackSpeed) || 1;
  const playingForward = isPlaying && playbackSpeed > 0;
  const playingReverse = isPlaying && playbackSpeed < 0;

  return (
    <footer className="shrink-0 z-20 bg-slate-950 border-t border-slate-800 px-4 pt-2 pb-1.5 select-none">
      <div className="flex items-center gap-4 mb-1.5">
        {/* Clock */}
        <div className="flex items-baseline gap-2.5 min-w-[230px]">
          <span className="font-mono text-2xl font-bold text-white tabular-nums tracking-tight">
            {formatParisTime(timestampMs)}
          </span>
          <div className="leading-tight">
            <div className="text-xs font-semibold text-slate-200">{formatParisDate(timestampMs)}</div>
            <div className="text-[11px] text-slate-400">{servicePhase(timestampMs)}</div>
          </div>
        </div>

        {/* Transport */}
        <div className="flex items-center gap-0.5 bg-slate-900 border border-slate-800 rounded-xl p-0.5">
          <TransportButton onClick={() => jumpToRelativeEvent(-1)} title="Previous event">
            {Icon.prev}
          </TransportButton>
          <TransportButton
            onClick={() => (playingReverse ? togglePlay() : setPlaybackSpeed(-magnitude))}
            title={playingReverse ? "Pause" : `Play backwards at ${magnitude}×`}
            active={playingReverse}
          >
            {playingReverse ? Icon.pause : Icon.reverse}
          </TransportButton>
          <TransportButton
            primary
            onClick={() => (playingForward ? togglePlay() : setPlaybackSpeed(magnitude))}
            title={playingForward ? "Pause" : `Play at ${magnitude}×`}
          >
            {playingForward ? Icon.pause : Icon.play}
          </TransportButton>
          <TransportButton onClick={() => jumpToRelativeEvent(1)} title="Next event">
            {Icon.next}
          </TransportButton>
        </div>

        {/* Speed */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5" role="group" aria-label="Replay speed">
          {SPEEDS.map((spd) => {
            const selected = !isLive && magnitude === spd;
            return (
              <button
                key={spd}
                type="button"
                onClick={() => setPlaybackSpeed(playingReverse ? -spd : spd)}
                aria-pressed={selected}
                title={spd === 1 ? "Real time" : `${spd}× real time`}
                className={`h-8 px-2.5 rounded-lg text-xs font-mono font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  selected ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-100"
                }`}
              >
                {spd}×
              </button>
            );
          })}
        </div>

        {/* Live */}
        <button
          type="button"
          onClick={goLive}
          disabled={!feed.liveDate}
          title={
            isLive
              ? `Following the live feed at 1× — new data every ${feed.batchSeconds}s`
              : "Jump to the live feed"
          }
          className={`h-9 px-3 rounded-xl flex items-center gap-2 text-xs font-bold tracking-wide border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
            isLive
              ? "bg-rose-600 border-rose-500 text-white"
              : "bg-slate-900 border-slate-700 text-slate-200 hover:border-rose-500/70 hover:text-white"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${feed.connected ? "bg-rose-300" : "bg-slate-500"} ${isLive ? "animate-pulse" : ""}`} />
          {isLive ? "LIVE" : "Go live"}
          {!isLive && lagMs > 0 && <span className="font-mono font-medium text-slate-400">−{formatLag(lagMs)}</span>}
        </button>
        {!feed.connected && feed.liveDate && <span className="text-[11px] text-slate-500">Reconnecting to live feed…</span>}

        <div className="flex-1" />

        <MonthLedger calendar={monthCalendar} serviceDate={serviceDate} onSelect={(d) => setServiceDate(d, { follow: d === feed.liveDate })} />
      </div>

      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <DayScrubber
            events={events}
            dayStartMs={dayStartMs}
            dayEndMs={dayEndMs}
            timestampMs={timestampMs}
            liveEdgeMs={liveEdgeMs}
            serviceDate={serviceDate}
            onScrub={setTimestampMs}
          />
        </div>
        <div className="w-28 pt-1.5 text-right leading-tight">
          <div className="text-xs font-mono font-semibold text-slate-200 tabular-nums">{eventsApplied.toLocaleString("en-GB")}</div>
          <div className="text-[10px] text-slate-500">events so far</div>
        </div>
      </div>
    </footer>
  );
}

