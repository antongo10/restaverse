import React, { useEffect } from "react";
import { useSimulationStore } from "./store/useSimulationStore";
import StreetScene3D from "./components/StreetScene3D";
import FloorPlan2D from "./components/FloorPlan2D";
import ObjectInspectorPanel from "./components/ObjectInspectorPanel";
import TimelineController from "./components/TimelineController";

const VENUES = [
  {
    businessId: "business-bistrot-lumiere",
    name: "Bistrot Lumière",
    cuisine: "French bistrot",
    crest: "/brands/bistrot/crest.png",
    fallbackIcon: "🐓",
    camera: "bistrot",
    fallbackObjectId: "scene-bl-station-bl-piano",
    accent: { dot: "bg-amber-400", bar: "bg-amber-400", ring: "hover:border-amber-500/60" },
  },
  {
    businessId: "business-osteria-bellavista",
    name: "Osteria Bellavista",
    cuisine: "Tuscan grill",
    crest: "/brands/osteria/crest.png",
    fallbackIcon: "🥩",
    camera: "osteria",
    fallbackObjectId: "scene-ob-station-ob-grill",
    accent: { dot: "bg-red-400", bar: "bg-red-400", ring: "hover:border-red-500/60" },
  },
  {
    businessId: "business-sakana-tei",
    name: "Sakana-Tei 魚亭",
    cuisine: "Omakase",
    crest: "/brands/sakana/crest.png",
    fallbackIcon: "🍣",
    camera: "sakana",
    fallbackObjectId: "scene-sk-station-sk-sushi-bar",
    accent: { dot: "bg-emerald-400", bar: "bg-emerald-400", ring: "hover:border-emerald-500/60" },
  },
];

const CAMERA_PRESETS = [
  { id: "street_overview", label: "Street" },
  { id: "isometric", label: "Isometric" },
  { id: "bistrot", label: "Bistrot Lumière" },
  { id: "kitchen", label: "Bistrot kitchen" },
  { id: "osteria", label: "Osteria Bellavista" },
  { id: "sakana", label: "Sakana-Tei" },
];

function formatEuros(cents) {
  return `€${Math.round((cents || 0) / 100).toLocaleString("en-GB")}`;
}

function VenueCard({ venue, state, onOpen }) {
  const tables = Object.values(state?.tables || {});
  const occupied = tables.filter((t) => t.status && t.status !== "AVAILABLE").length;
  const occupancyPct = tables.length ? (occupied / tables.length) * 100 : 0;
  const m = state?.metrics || {};

  return (
    <button
      type="button"
      onClick={onOpen}
      title={`Show ${venue.name}`}
      className={`group flex items-center gap-2.5 min-w-0 w-[236px] shrink bg-slate-900 border border-slate-800 ${venue.accent.ring} rounded-xl pl-1.5 pr-3 py-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400`}
    >
      <div className="relative w-9 h-9 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
        <span className="text-sm">{venue.fallbackIcon}</span>
        <img
          src={venue.crest}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold text-white truncate">{venue.name}</span>
          <span className="font-mono text-xs font-semibold text-emerald-300 tabular-nums">{formatEuros(m.revenueCents)}</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden" title={`${occupied} of ${tables.length} tables occupied`}>
            <div className={`h-full ${venue.accent.bar} transition-[width] duration-500`} style={{ width: `${occupancyPct}%` }} />
          </div>
          <span className="text-[10px] text-slate-400 tabular-nums whitespace-nowrap">
            {occupied}/{tables.length} tables · {m.activeCovers || 0} guests · {m.activeOrders || 0} open
          </span>
        </div>
      </div>
    </button>
  );
}

function Segmented({ options, value, onChange, label }) {
  return (
    <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={`h-7 px-3 rounded-lg text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
            value === o.id ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-100"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function App() {
  const loading = useSimulationStore((s) => s.loading);
  const error = useSimulationStore((s) => s.error);
  const bootstrap = useSimulationStore((s) => s.bootstrap);
  const businessStates = useSimulationStore((s) => s.projectedState?.businessStates);
  const month = useSimulationStore((s) => s.month);
  const viewMode = useSimulationStore((s) => s.viewMode);
  const cameraPreset = useSimulationStore((s) => s.cameraPreset);
  const cutawayWalls = useSimulationStore((s) => s.cutawayWalls);

  const initPlatform = useSimulationStore((s) => s.initPlatform);
  const setViewMode = useSimulationStore((s) => s.setViewMode);
  const setCameraPreset = useSimulationStore((s) => s.setCameraPreset);
  const toggleCutawayWalls = useSimulationStore((s) => s.toggleCutawayWalls);
  const selectSceneObject = useSimulationStore((s) => s.selectSceneObject);

  useEffect(() => {
    initPlatform();
  }, [initPlatform]);

  const pickSignatureSceneObject = (businessId, fallbackId) => {
    const objs = bootstrap?.sceneObjects || [];
    const signatureStation = objs.find(
      (o) =>
        o.businessId === businessId &&
        ["hot_kitchen", "grill_hearth", "sushi_counter", "pasta_station"].includes(o.stationKind)
    );
    if (signatureStation) return signatureStation.sceneObjectId;
    const anyTable = objs.find((o) => o.businessId === businessId && o.domainEntityType === "table");
    return anyTable?.sceneObjectId || fallbackId;
  };

  const liveStartDay = month?.liveStartDate ? Number(month.liveStartDate.slice(8)) : null;

  return (
    <div className="w-screen h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden font-sans">
      <header className="h-14 bg-slate-950 border-b border-slate-800 px-4 flex items-center gap-4 select-none shrink-0 z-20">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 overflow-hidden border border-amber-400/50">
            <img
              src="/brands/culinary_hero.png"
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
          <div className="leading-tight">
            <h1 className="text-sm font-bold text-white tracking-tight">
              {bootstrap?.street?.name || "Rue de la Lumière — Nice"}
            </h1>
            <p className="text-[11px] text-slate-400">
              October 2026
              {liveStartDay && (
                <>
                  {" · "}history 1–{liveStartDay - 1} · <span className="text-rose-400">live from {liveStartDay}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex-1 min-w-0 flex items-center justify-center gap-2 overflow-hidden">
          {VENUES.map((v) => (
            <VenueCard
              key={v.businessId}
              venue={v}
              state={businessStates?.[v.businessId]}
              onOpen={() => {
                setCameraPreset(v.camera);
                selectSceneObject(pickSignatureSceneObject(v.businessId, v.fallbackObjectId));
              }}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {viewMode === "3d" && (
            <>
              <label className="sr-only" htmlFor="camera-preset">
                Camera
              </label>
              <select
                id="camera-preset"
                value={cameraPreset}
                onChange={(e) => setCameraPreset(e.target.value)}
                className="h-8 bg-slate-900 border border-slate-800 rounded-xl pl-2.5 pr-7 text-xs font-semibold text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                {cameraPreset === "follow_agent" && <option value="follow_agent">Following agent</option>}
                {CAMERA_PRESETS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={toggleCutawayWalls}
                aria-pressed={cutawayWalls}
                title={cutawayWalls ? "Show full-height walls" : "Cut walls away to see inside"}
                className={`h-8 px-3 rounded-xl text-xs font-semibold border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  cutawayWalls
                    ? "bg-slate-900 border-amber-500/50 text-amber-300"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                Cutaway
              </button>
            </>
          )}
          <Segmented
            label="View"
            value={viewMode}
            onChange={setViewMode}
            options={[
              { id: "3d", label: "3D" },
              { id: "2d", label: "Plan" },
            ]}
          />
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 h-full relative overflow-hidden">
          {loading && (
            <div className="absolute inset-0 z-30 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-3 flex items-center gap-3 shadow-2xl">
                <div className="w-3 h-3 rounded-full bg-amber-400 animate-ping" />
                <span className="text-sm font-medium text-slate-200">Loading service day…</span>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-red-950/90 border border-red-700 text-red-200 px-4 py-2 rounded-xl text-xs font-medium shadow-lg">
              Can't reach the simulation server: {error}. Check that the backend is running on port 4100.
            </div>
          )}

          {viewMode === "3d" ? <StreetScene3D /> : <FloorPlan2D />}
        </div>

        <ObjectInspectorPanel />
      </main>

      <TimelineController />
    </div>
  );
}
