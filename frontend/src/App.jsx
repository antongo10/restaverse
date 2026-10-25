import React, { useEffect } from "react";
import { useSimulationStore } from "./store/useSimulationStore";
import StreetScene3D from "./components/StreetScene3D";
import FloorPlan2D from "./components/FloorPlan2D";
import ObjectInspectorPanel from "./components/ObjectInspectorPanel";
import TimelineController from "./components/TimelineController";

function formatEuros(cents) {
  return `€${((cents || 0) / 100).toLocaleString("en-IE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function App() {
  const loading = useSimulationStore((s) => s.loading);
  const error = useSimulationStore((s) => s.error);
  const bootstrap = useSimulationStore((s) => s.bootstrap);
  const projectedState = useSimulationStore((s) => s.projectedState);
  const viewMode = useSimulationStore((s) => s.viewMode);
  const cameraPreset = useSimulationStore((s) => s.cameraPreset);
  const cutawayWalls = useSimulationStore((s) => s.cutawayWalls);
  const isPlaying = useSimulationStore((s) => s.isPlaying);
  const playbackSpeed = useSimulationStore((s) => s.playbackSpeed);
  const provenanceTrace = useSimulationStore((s) => s.provenanceTrace);

  const initPlatform = useSimulationStore((s) => s.initPlatform);
  const setViewMode = useSimulationStore((s) => s.setViewMode);
  const setCameraPreset = useSimulationStore((s) => s.setCameraPreset);
  const toggleCutawayWalls = useSimulationStore((s) => s.toggleCutawayWalls);
  const selectSceneObject = useSimulationStore((s) => s.selectSceneObject);
  const togglePlay = useSimulationStore((s) => s.togglePlay);
  const setPlaybackSpeed = useSimulationStore((s) => s.setPlaybackSpeed);
  const stopProvenanceTrace = useSimulationStore((s) => s.stopProvenanceTrace);

  useEffect(() => {
    initPlatform();
  }, [initPlatform]);

  const bStates = projectedState?.businessStates || {};
  const bistrot = bStates["business-bistrot-lumiere"];
  const osteria = bStates["business-osteria-bellavista"] || bStates["business-pizza-napoli"];
  const sakana = bStates["business-sakana-tei"] || bStates["business-cafe-atelier"];

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

  return (
    <div className="w-screen h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden font-sans">
      {/* TOP HEADER: Multi-Venue Street KPIs, Brand Crests, Camera Presets & View Controls */}
      <header className="h-16 bg-slate-950/95 border-b border-slate-800 px-4 flex items-center justify-between gap-3 select-none shrink-0 z-20">
        {/* Brand & Street Name */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-slate-950 font-black text-base shadow overflow-hidden border border-amber-400/50">
            <img
              src="/brands/culinary_hero.png"
              alt="3D Gastronomy Street"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-tight">
                {bootstrap?.street?.name || "Rue de la Lumière — Nice"}
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/70">
                MongoDB Atlas · 23 Collections
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              3 Specialty Restaurants · 3D Cookware & A* Waypoint Replay Engine
            </p>
          </div>
        </div>

        {/* Live Synchronized Business KPI Pills with Brand Crests */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {/* 1. Bistrot Lumière */}
          {bistrot && (
            <button
              onClick={() => {
                setCameraPreset("bistrot");
                selectSceneObject(
                  pickSignatureSceneObject("business-bistrot-lumiere", "scene-bl-station-bl-piano")
                );
              }}
              className="flex items-center gap-2.5 bg-slate-900/90 hover:bg-slate-800 border border-amber-500/40 rounded-xl px-2.5 py-1.5 text-left transition shrink-0"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-950 border border-amber-500/40 flex items-center justify-center overflow-hidden shrink-0">
                <img
                  src="/brands/bistrot/crest.png"
                  alt="Bistrot Lumière"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <span className="text-xs">🐓</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-xs font-bold text-white">Bistrot Lumière</span>
                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                    Française
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 flex items-center gap-2 mt-0.5">
                  <span className="font-mono font-bold text-emerald-400">
                    {formatEuros(bistrot.metrics.revenueCents)}
                  </span>
                  <span>· {bistrot.metrics.activeCovers}p</span>
                  <span>· {bistrot.metrics.activeOrders} open</span>
                </div>
              </div>
            </button>
          )}

          {/* 2. Osteria Bellavista */}
          {osteria && (
            <button
              onClick={() => {
                setCameraPreset("osteria");
                selectSceneObject(
                  pickSignatureSceneObject("business-osteria-bellavista", "scene-ob-station-ob-grill")
                );
              }}
              className="flex items-center gap-2.5 bg-slate-900/90 hover:bg-slate-800 border border-red-500/40 rounded-xl px-2.5 py-1.5 text-left transition shrink-0"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-950 border border-red-500/40 flex items-center justify-center overflow-hidden shrink-0">
                <img
                  src="/brands/osteria/crest.png"
                  alt="Osteria Bellavista"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <span className="text-xs">🥩</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-xs font-bold text-white">Osteria Bellavista</span>
                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-red-500/20 text-red-300">
                    Toscana
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 flex items-center gap-2 mt-0.5">
                  <span className="font-mono font-bold text-emerald-400">
                    {formatEuros(osteria.metrics.revenueCents)}
                  </span>
                  <span>· {osteria.metrics.activeCovers}p</span>
                  <span>· {osteria.metrics.activeOrders} open</span>
                </div>
              </div>
            </button>
          )}

          {/* 3. Sakana-Tei 魚亭 */}
          {sakana && (
            <button
              onClick={() => {
                setCameraPreset("sakana");
                selectSceneObject(
                  pickSignatureSceneObject("business-sakana-tei", "scene-sk-station-sk-sushi-bar")
                );
              }}
              className="flex items-center gap-2.5 bg-slate-900/90 hover:bg-slate-800 border border-emerald-500/40 rounded-xl px-2.5 py-1.5 text-left transition shrink-0"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-950 border border-emerald-500/40 flex items-center justify-center overflow-hidden shrink-0">
                <img
                  src="/brands/sakana/crest.png"
                  alt="Sakana-Tei 魚亭"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <span className="text-xs">🍣</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs font-bold text-white">Sakana-Tei 魚亭</span>
                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
                    Omakase
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 flex items-center gap-2 mt-0.5">
                  <span className="font-mono font-bold text-emerald-400">
                    {formatEuros(sakana.metrics.revenueCents)}
                  </span>
                  <span>· {sakana.metrics.activeCovers}p</span>
                  <span>· {sakana.metrics.activeOrders} open</span>
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Right: Bi-Directional Playback Controls, Camera Presets, Cutaway Toggle & 3D/2D Mode Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Bi-Directional Playback Speed Controls (Reverse & Forward) */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 gap-0.5">
            {[
              { label: "⏪ -5x", speed: -180, title: "Reverse Provenance Playback (-5x)" },
              { label: "⏪ -1x", speed: -60, title: "Reverse Provenance Playback (-1x)" },
            ].map((btn) => (
              <button
                key={btn.speed}
                onClick={() => setPlaybackSpeed(btn.speed)}
                title={btn.title}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition ${
                  isPlaying && playbackSpeed === btn.speed
                    ? "bg-amber-500 text-slate-950 shadow"
                    : "text-amber-300/80 hover:text-amber-200 hover:bg-slate-800"
                }`}
              >
                {btn.label}
              </button>
            ))}

            <button
              onClick={togglePlay}
              title={isPlaying ? "Pause Simulation" : "Play Simulation"}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                isPlaying
                  ? "bg-emerald-500 text-slate-950 shadow"
                  : "bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              {isPlaying ? "⏸" : "▶️"}
            </button>

            {[
              { label: "⏩ 1x", speed: 60, title: "Forward Playback (1x)" },
              { label: "⏩ 5x", speed: 180, title: "Forward Playback (5x)" },
              { label: "⏩ 15x", speed: 600, title: "Fast Forward Playback (15x)" },
            ].map((btn) => (
              <button
                key={btn.speed}
                onClick={() => setPlaybackSpeed(btn.speed)}
                title={btn.title}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition ${
                  isPlaying && playbackSpeed === btn.speed
                    ? "bg-sky-500 text-slate-950 shadow"
                    : "text-sky-300/80 hover:text-sky-200 hover:bg-slate-800"
                }`}
              >
                {btn.label}
              </button>
            ))}

            {provenanceTrace && (
              <button
                onClick={stopProvenanceTrace}
                title="Exit Active Provenance Trace"
                className="ml-0.5 px-2 py-1 rounded-lg text-[10px] font-mono font-bold bg-red-950 text-red-300 border border-red-700/60 hover:bg-red-900 transition"
              >
                ✕ Trace
              </button>
            )}
          </div>

          {viewMode === "3d" && (
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
              {[
                { id: "street_overview", label: "Street" },
                { id: "isometric", label: "Iso" },
                { id: "bistrot", label: "Bistrot" },
                { id: "kitchen", label: "Cuisine" },
                { id: "osteria", label: "Osteria" },
                { id: "sakana", label: "Sakana" },
              ].map((cam) => (
                <button
                  key={cam.id}
                  onClick={() => setCameraPreset(cam.id)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition ${
                    cameraPreset === cam.id
                      ? "bg-amber-500 text-slate-950"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {cam.label}
                </button>
              ))}
            </div>
          )}

          {viewMode === "3d" && (
            <button
              onClick={toggleCutawayWalls}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
                cutawayWalls
                  ? "bg-slate-900 border-amber-500/50 text-amber-300"
                  : "bg-slate-900 border-slate-800 text-slate-400"
              }`}
              title="Toggle Architectural Cutaway Walls"
            >
              {cutawayWalls ? "Cutaway: ON" : "Full Walls"}
            </button>
          )}

          {/* 3D / 2D Switcher */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => setViewMode("3d")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                viewMode === "3d"
                  ? "bg-sky-500 text-slate-950"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              3D Scene
            </button>
            <button
              onClick={() => setViewMode("2d")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                viewMode === "2d"
                  ? "bg-sky-500 text-slate-950"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              2D Blueprint
            </button>
          </div>
        </div>
      </header>

      {/* MAIN WORKSPACE: 3D/2D Viewport + Right Object Inspector */}
      <main className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 h-full relative overflow-hidden">
          {loading && (
            <div className="absolute inset-0 z-30 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 flex items-center gap-3 shadow-2xl">
                <div className="w-4 h-4 rounded-full bg-amber-400 animate-ping" />
                <span className="text-sm font-semibold text-slate-200">
                  Loading Synchronized Multi-Venue Street Simulation...
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-red-950/90 border border-red-700 text-red-200 px-4 py-2 rounded-xl text-xs font-medium shadow-lg">
              Backend connection error: {error}
            </div>
          )}

          {viewMode === "3d" ? <StreetScene3D /> : <FloorPlan2D />}
        </div>

        <ObjectInspectorPanel />
      </main>

      {/* BOTTOM TIMELINE & CLOCK CONTROLLER */}
      <TimelineController />
    </div>
  );
}
