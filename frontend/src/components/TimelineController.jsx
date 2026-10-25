import React, { useEffect } from "react";
import { useSimulationStore } from "../store/useSimulationStore";

const BENCHMARK_DATES = [
  { date: "2025-01-03", label: "2025-01-03 · Opening Friday" },
  { date: "2025-02-14", label: "2025-02-14 · Valentine's Day" },
  { date: "2025-06-14", label: "2025-06-14 · Summer Peak Sat" },
  { date: "2025-07-19", label: "2025-07-19 · Riviera High Sat" },
  { date: "2025-08-15", label: "2025-08-15 · Mid-August Peak" },
  { date: "2025-10-18", label: "2025-10-18 · Autumn Saturday" },
  { date: "2025-12-20", label: "2025-12-20 · Holiday Finale" },
];

const SPEED_OPTIONS = [-60, -15, 1, 15, 60, 180, 600];

function getServicePhaseLabel(parisTimeStr) {
  const hour = parseInt(parisTimeStr.slice(0, 2), 10) || 12;
  if (hour < 11) return "MORNING PREP · DELIVERIES · CAFÉ RUSH";
  if (hour < 15) return "MIDI · FULL STREET LUNCH SERVICE";
  if (hour < 18) return "COUPURE · AFTERNOON CAFÉ & PREP";
  if (hour < 22) return "SOIR · DINNER SERVICE PEAK";
  return "CLOSING · BILLS & PLONGE";
}

export default function TimelineController() {
  const serviceDate = useSimulationStore((s) => s.serviceDate);
  const timestampMs = useSimulationStore((s) => s.timestampMs);
  const dayStartMs = useSimulationStore((s) => s.dayStartMs);
  const dayEndMs = useSimulationStore((s) => s.dayEndMs);
  const isPlaying = useSimulationStore((s) => s.isPlaying);
  const playbackSpeed = useSimulationStore((s) => s.playbackSpeed);
  const projectedState = useSimulationStore((s) => s.projectedState);

  const setServiceDate = useSimulationStore((s) => s.setServiceDate);
  const setTimestampMs = useSimulationStore((s) => s.setTimestampMs);
  const togglePlay = useSimulationStore((s) => s.togglePlay);
  const setPlaybackSpeed = useSimulationStore((s) => s.setPlaybackSpeed);
  const tickSimulation = useSimulationStore((s) => s.tickSimulation);
  const jumpToRelativeEvent = useSimulationStore((s) => s.jumpToRelativeEvent);

  // Drive simulation clock via requestAnimationFrame when playing
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

  const parisClock = new Date(timestampMs).toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const phaseLabel = getServicePhaseLabel(parisClock);
  const progressPct =
    dayEndMs > dayStartMs
      ? Math.max(0, Math.min(100, ((timestampMs - dayStartMs) / (dayEndMs - dayStartMs)) * 100))
      : 0;

  const jumpToTimeStr = (hhmm) => {
    // Determine offset from dayStartMs (07:00 local)
    const [hh, mm] = hhmm.split(":").map(Number);
    const offsetMinutes = (hh - 7) * 60 + mm;
    setTimestampMs(dayStartMs + offsetMinutes * 60 * 1000);
  };

  return (
    <footer className="h-24 bg-slate-950/95 border-t border-slate-800 px-5 py-2.5 flex flex-col justify-between select-none shrink-0 z-20">
      {/* Upper Row: Clock, Date Picker, Transport Controls, Speed, Quick Bookmarks */}
      <div className="flex items-center justify-between gap-4">
        {/* Left: Street Simulation Clock & Date Selector */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-1.5 flex items-center gap-3">
            <div>
              <span className="text-[9px] font-mono uppercase tracking-widest text-amber-400 block">
                SHARED STREET CLOCK (EUROPE/PARIS)
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xl font-black text-white tracking-tight">
                  {parisClock}
                </span>
                <span className="text-[10px] font-semibold text-emerald-400">
                  {phaseLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-1.5">
            <select
              value={serviceDate}
              onChange={(e) => setServiceDate(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
            >
              {BENCHMARK_DATES.map((d) => (
                <option key={d.date} value={d.date}>
                  {d.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              min="2025-01-03"
              max="2025-12-31"
              value={serviceDate}
              onChange={(e) => {
                if (e.target.value) setServiceDate(e.target.value);
              }}
              className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-500"
              title="Pick any 2025 service date (synthesizes on demand)"
            />
          </div>
        </div>

        {/* Center: Transport Controls (Prev Event, Play/Pause, Next Event) + Speed */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => jumpToRelativeEvent(-1)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 transition"
            title="Step to Previous Operational Event"
          >
            ⏮ Prev Event
          </button>

          <button
            onClick={togglePlay}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-md ${
              isPlaying
                ? "bg-amber-500 hover:bg-amber-400 text-slate-950"
                : "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
            }`}
          >
            {isPlaying ? "⏸ Pause Clock" : "▶ Play Simulation"}
          </button>

          <button
            onClick={() => jumpToRelativeEvent(1)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 transition"
            title="Step to Next Operational Event"
          >
            Next Event ⏭
          </button>

          {/* Speed Pills */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 ml-2">
            {SPEED_OPTIONS.map((spd) => (
              <button
                key={spd}
                onClick={() => setPlaybackSpeed(spd)}
                className={`px-2 py-1 rounded-md text-[11px] font-mono font-semibold transition ${
                  playbackSpeed === spd
                    ? "bg-amber-500 text-slate-950"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {spd > 0 ? `${spd}x` : `${spd}x`}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Quick Service Bookmarks */}
        <div className="flex items-center gap-1.5">
          {[
            { time: "08:15", label: "08:15 Prep/Café" },
            { time: "12:45", label: "12:45 Lunch Peak" },
            { time: "16:00", label: "16:00 Coupure" },
            { time: "20:00", label: "20:00 Dinner Peak" },
          ].map((bm) => (
            <button
              key={bm.time}
              onClick={() => jumpToTimeStr(bm.time)}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-medium text-slate-300 hover:text-amber-300 transition"
            >
              {bm.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Row: Full-Day Timeline Scrubber (07:00 -> 23:30) */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-mono text-slate-400">07:00</span>
        <div className="relative flex-1 flex items-center">
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-amber-500/80 rounded-l pointer-events-none"
            style={{ width: `${progressPct}%` }}
          />
          <input
            type="range"
            min={dayStartMs}
            max={dayEndMs}
            step={5000}
            value={timestampMs}
            onChange={(e) => setTimestampMs(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
          />
        </div>
        <span className="text-[10px] font-mono text-slate-400">23:30</span>
        <span className="text-[10px] font-mono text-slate-400 ml-2">
          Events: {projectedState?.eventsAppliedCount || 0} /{" "}
          {projectedState?.totalEventsInDay || 0}
        </span>
      </div>
    </footer>
  );
}
