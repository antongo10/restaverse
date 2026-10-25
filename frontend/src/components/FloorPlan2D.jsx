import React, { useState } from "react";
import { useSimulationStore } from "../store/useSimulationStore";

const WORLD_MIN_X = -2;
const WORLD_MAX_X = 64;
const WORLD_MIN_Z = -8;
const WORLD_MAX_Z = 29;
const SCALE = 19; // pixels per meter across the 62m street

function toPxX(x) {
  return (x - WORLD_MIN_X) * SCALE;
}
function toPxY(z) {
  return (z - WORLD_MIN_Z) * SCALE;
}

const TABLE_STATUS_COLORS = {
  AVAILABLE: { fill: "#064e3b", stroke: "#10b981", text: "#6ee7b7" },
  SEATED: { fill: "#1e3a8a", stroke: "#3b82f6", text: "#93c5fd" },
  ORDERED: { fill: "#78350f", stroke: "#f59e0b", text: "#fcd34d" },
  DINING_COURSE_1: { fill: "#78350f", stroke: "#f59e0b", text: "#fde68a" },
  DINING_COURSE_2: { fill: "#7c2d12", stroke: "#f97316", text: "#fdba74" },
  DINING_COURSE_3: { fill: "#581c87", stroke: "#a855f7", text: "#d8b4fe" },
  SERVED_COURSE_1: { fill: "#7c2d12", stroke: "#f97316", text: "#fdba74" },
  SERVED_COURSE_2: { fill: "#581c87", stroke: "#a855f7", text: "#d8b4fe" },
  SERVED_COURSE_3: { fill: "#831843", stroke: "#ec4899", text: "#f9a8d4" },
  NEEDS_CLEARING: { fill: "#7f1d1d", stroke: "#ef4444", text: "#fca5a5" },
};

export default function FloorPlan2D() {
  const bootstrap = useSimulationStore((s) => s.bootstrap);
  const projectedState = useSimulationStore((s) => s.projectedState);
  const selectedSceneObjectId = useSimulationStore((s) => s.selectedSceneObjectId);
  const selectSceneObject = useSimulationStore((s) => s.selectSceneObject);

  const [showNavGraph, setShowNavGraph] = useState(true);
  const [showAgentVectors, setShowAgentVectors] = useState(true);

  if (!bootstrap || !projectedState) return null;

  const widthPx = (WORLD_MAX_X - WORLD_MIN_X) * SCALE;
  const heightPx = (WORLD_MAX_Z - WORLD_MIN_Z) * SCALE;

  const premisesList = bootstrap.premises || [];
  const floorPlans = bootstrap.floorPlans || [];
  const sceneObjects = bootstrap.sceneObjects || [];
  const activeAgents = projectedState.activeAgents || [];

  // Map table and station runtime states across all 3 restaurants
  const runtimeTables = {};
  const runtimeStations = {};
  for (const bs of Object.values(projectedState.businessStates || {})) {
    Object.assign(runtimeTables, bs.tables || {});
    Object.assign(runtimeStations, bs.stations || {});
  }

  // Collect unified navigation nodes and edges across all premises
  const navNodesById = {};
  const navEdges = [];
  for (const prem of premisesList) {
    const fp = floorPlans.find((f) => f._id === prem.floorPlanId);
    const ng = prem.navigationGraph || fp?.navigationGraph || {};
    const nodes = ng.nodes || prem.navigationNodes || [];
    for (const n of nodes) {
      navNodesById[n.id] = { ...n, businessId: prem.businessId };
    }
    for (const edge of ng.edges || []) {
      if (Array.isArray(edge) && edge.length >= 2) {
        navEdges.push([edge[0], edge[1]]);
      } else if (edge?.from && edge?.to) {
        navEdges.push([edge.from, edge.to]);
      }
    }
  }
  // Cross-venue sidewalk links
  if (navNodesById["bl-street-east"] && navNodesById["ob-street-entry"]) {
    navEdges.push(["bl-street-east", "ob-street-entry"]);
  }
  if (navNodesById["ob-street-east"] && navNodesById["sk-street-entry"]) {
    navEdges.push(["ob-street-east", "sk-street-entry"]);
  }

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-auto flex flex-col items-center justify-center p-4 select-none">
      {/* Blueprint Controls */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-3 bg-slate-900/90 border border-slate-800 px-3.5 py-2 rounded-xl shadow-lg backdrop-blur-md text-xs text-slate-300">
        <span className="font-semibold text-amber-400 uppercase tracking-wider">
          2D Architectural CAD & A* Nav-Graph (X = 0..62m)
        </span>
        <label className="flex items-center gap-1.5 cursor-pointer ml-2">
          <input
            type="checkbox"
            checked={showNavGraph}
            onChange={(e) => setShowNavGraph(e.target.checked)}
            className="rounded accent-amber-500"
          />
          <span>A* Nodes & Doorway Edges</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={showAgentVectors}
            onChange={(e) => setShowAgentVectors(e.target.checked)}
            className="rounded accent-sky-500"
          />
          <span>Active Waypoint Polylines</span>
        </label>
      </div>

      <div className="border border-slate-800 rounded-2xl bg-[#09111e] p-3 shadow-2xl overflow-auto max-w-full max-h-full">
        <svg
          width={widthPx}
          height={heightPx}
          viewBox={`0 0 ${widthPx} ${heightPx}`}
          className="block"
        >
          {/* Meter Grid */}
          <defs>
            <pattern id="cad-grid" width={SCALE} height={SCALE} patternUnits="userSpaceOnUse">
              <path
                d={`M ${SCALE} 0 L 0 0 0 ${SCALE}`}
                fill="none"
                stroke="#1e293b"
                strokeWidth="0.6"
              />
            </pattern>
          </defs>
          <rect width={widthPx} height={heightPx} fill="url(#cad-grid)" />

          {/* Sidewalk Promenade & Terrace Band (Z = 14m..23.5m) */}
          <rect
            x={0}
            y={toPxY(14)}
            width={widthPx}
            height={9.5 * SCALE}
            fill="#1e293b"
            fillOpacity="0.4"
          />
          <text
            x={14}
            y={toPxY(22.8)}
            fill="#64748b"
            fontSize="10"
            fontWeight="600"
            letterSpacing="1.5"
          >
            PROMENADE PIÉTONNE & TERRASSES OMBRAGÉES (Z = 14m..23.5m)
          </text>

          {/* Roadway Band (Z = 23.5m..29m) */}
          <rect
            x={0}
            y={toPxY(23.5)}
            width={widthPx}
            height={5.5 * SCALE}
            fill="#0f172a"
            fillOpacity="0.85"
          />
          <line
            x1={0}
            y1={toPxY(26.5)}
            x2={widthPx}
            y2={toPxY(26.5)}
            stroke="#475569"
            strokeWidth="1.5"
            strokeDasharray="10 8"
          />
          <text
            x={14}
            y={toPxY(28.2)}
            fill="#475569"
            fontSize="10"
            fontWeight="600"
            letterSpacing="2"
          >
            RUE DE LA LUMIÈRE — CHAUSSÉE GASTRONOMIQUE (X = 0m..62m)
          </text>

          {/* Premises & Interior Zones for all 3 Specialty Restaurants */}
          {premisesList.map((prem) => {
            const b = prem.bounds || { minX: 0, maxX: 20, minZ: 0, maxZ: 18 };
            const fp = floorPlans.find((f) => f._id === prem.floorPlanId);
            const zones = prem.zones || fp?.zones || [];
            const isSelectedPrem =
              selectedSceneObjectId === `scene-${prem._id}` ||
              selectedSceneObjectId === `scene-premises-${prem._id}`;

            const brandAccent =
              prem.businessId === "business-bistrot-lumiere"
                ? "#f59e0b"
                : prem.businessId === "business-osteria-bellavista"
                ? "#ef4444"
                : "#10b981";

            return (
              <g key={prem._id}>
                {/* Zones */}
                {zones.map((z, zIdx) => {
                  const minX = z.bounds ? z.bounds.minX : z.x;
                  const minZ = z.bounds ? z.bounds.minZ : z.z;
                  const zw = z.bounds ? z.bounds.maxX - z.bounds.minX : z.width;
                  const zd = z.bounds ? z.bounds.maxZ - z.bounds.minZ : z.depth;
                  return (
                    <g key={z.zoneId || zIdx}>
                      <rect
                        x={toPxX(minX)}
                        y={toPxY(minZ)}
                        width={zw * SCALE}
                        height={zd * SCALE}
                        fill={z.floorColor || z.color || "#334155"}
                        fillOpacity="0.24"
                        stroke="#475569"
                        strokeWidth="1"
                        strokeDasharray="3 3"
                      />
                      <text
                        x={toPxX(minX) + 6}
                        y={toPxY(minZ) + 12}
                        fill="#94a3b8"
                        fontSize="9"
                        fontWeight="600"
                      >
                        {z.name}
                      </text>
                    </g>
                  );
                })}

                {/* Outer structural perimeter */}
                <rect
                  x={toPxX(b.minX)}
                  y={toPxY(b.minZ)}
                  width={(b.maxX - b.minX) * SCALE}
                  height={(b.maxZ - b.minZ) * SCALE}
                  fill="none"
                  stroke={isSelectedPrem ? "#fbbf24" : brandAccent}
                  strokeWidth={isSelectedPrem ? "2.8" : "1.8"}
                  strokeOpacity={isSelectedPrem ? "1" : "0.75"}
                  onClick={() => selectSceneObject(`scene-${prem._id}`)}
                  className="cursor-pointer"
                />
                <text
                  x={toPxX((b.minX + b.maxX) / 2)}
                  y={toPxY(b.minZ) - 6}
                  textAnchor="middle"
                  fill="#f8fafc"
                  fontSize="11"
                  fontWeight="700"
                >
                  {prem.name}
                </text>
              </g>
            );
          })}

          {/* Connected A* Navigation Graph Nodes & Doorway Edges Overlay */}
          {showNavGraph && (
            <g>
              {navEdges.map(([fromId, toId], idx) => {
                const n1 = navNodesById[fromId];
                const n2 = navNodesById[toId];
                if (!n1 || !n2) return null;
                const isDoorEdge =
                  fromId.includes("door") ||
                  toId.includes("door") ||
                  fromId.includes("entry") ||
                  toId.includes("entry");
                return (
                  <line
                    key={`edge-${idx}`}
                    x1={toPxX(n1.x)}
                    y1={toPxY(n1.z)}
                    x2={toPxX(n2.x)}
                    y2={toPxY(n2.z)}
                    stroke={isDoorEdge ? "#fbbf24" : "#38bdf8"}
                    strokeOpacity={isDoorEdge ? "0.55" : "0.32"}
                    strokeWidth={isDoorEdge ? "1.6" : "1.1"}
                    strokeDasharray="2 3"
                  />
                );
              })}
              {Object.values(navNodesById).map((n) => {
                const isDoorway =
                  n.id.includes("door") || n.id.includes("entry") || n.kind === "doorway";
                return (
                  <g key={n.id}>
                    <circle
                      cx={toPxX(n.x)}
                      cy={toPxY(n.z)}
                      r={isDoorway ? 3.8 : 2.6}
                      fill={isDoorway ? "#f59e0b" : "#0284c7"}
                      stroke={isDoorway ? "#fef3c7" : "#bae6fd"}
                      strokeWidth="0.9"
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* Scene Objects (Tables, Kitchen Stations, Sushi Bars, Wood Grills, Passes, Storage) */}
          {sceneObjects
            .filter((o) => o.objectType !== "premises_building" && o.objectType !== "employee_agent")
            .map((obj) => {
              const isSelected = selectedSceneObjectId === obj.sceneObjectId;
              const tr = obj.transform || { x: 0, z: 0, width: 1.2, depth: 1.2 };
              const cx = toPxX(tr.x);
              const cy = toPxY(tr.z);
              const w = Math.max(18, (tr.width || tr.w || 1.1) * SCALE);
              const d = Math.max(16, (tr.depth || tr.d || 1.1) * SCALE);

              if (obj.domainEntityType === "table") {
                const tState = runtimeTables[obj.domainEntityId];
                const st = tState?.status || "AVAILABLE";
                const palette = TABLE_STATUS_COLORS[st] || TABLE_STATUS_COLORS.AVAILABLE;
                const shortTableName = (
                  obj.tableLabel ||
                  obj.domainEntityId.replace(/^(bl-|ob-|sk-|pz-|cf-)/, "")
                ).toUpperCase();

                return (
                  <g
                    key={obj.sceneObjectId}
                    onClick={() => selectSceneObject(obj.sceneObjectId)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={cx - w / 2}
                      y={cy - d / 2}
                      width={w}
                      height={d}
                      rx={obj.shape === "round" ? Math.min(w, d) / 2 : 4}
                      fill={palette.fill}
                      stroke={isSelected ? "#fbbf24" : palette.stroke}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                    />
                    <text
                      x={cx}
                      y={cy - 1}
                      textAnchor="middle"
                      fill="#f8fafc"
                      fontSize="8"
                      fontWeight="700"
                    >
                      {shortTableName}
                    </text>
                    <text
                      x={cx}
                      y={cy + 7}
                      textAnchor="middle"
                      fill={palette.text}
                      fontSize="7"
                    >
                      {tState?.partySize ? `${tState.partySize}p` : `${obj.seats || 2}p`}
                    </text>
                  </g>
                );
              }

              // Kitchen / Bar / Pass / Storage Station
              const stState = runtimeStations[obj.domainEntityId];
              const activeTasks = stState?.activeTasks || [];
              const activeCount = activeTasks.length;
              const isBusy = activeCount > 0;
              const topDish = activeTasks[0]?.dishName || activeTasks[0]?.label;
              const cleanStationName = obj.label.split("(")[0].trim();

              return (
                <g
                  key={obj.sceneObjectId}
                  onClick={() => selectSceneObject(obj.sceneObjectId)}
                  className="cursor-pointer"
                >
                  <rect
                    x={cx - w / 2}
                    y={cy - d / 2}
                    width={w}
                    height={d}
                    rx={3}
                    fill={isBusy ? "#7c2d12" : "#1e293b"}
                    stroke={isSelected ? "#fbbf24" : isBusy ? "#f97316" : "#64748b"}
                    strokeWidth={isSelected ? 2.5 : 1.4}
                  />
                  <text
                    x={cx}
                    y={topDish ? cy - 2 : cy + 3}
                    textAnchor="middle"
                    fill="#f8fafc"
                    fontSize="7.5"
                    fontWeight="700"
                  >
                    {cleanStationName.slice(0, 16)}
                  </text>
                  {topDish && (
                    <text
                      x={cx}
                      y={cy + 7}
                      textAnchor="middle"
                      fill="#fde68a"
                      fontSize="6.8"
                      fontWeight="600"
                    >
                      {topDish.slice(0, 18)}
                    </text>
                  )}
                  {isBusy && (
                    <g>
                      <circle
                        cx={cx + w / 2 - 4}
                        cy={cy - d / 2 + 4}
                        r={6.5}
                        fill="#ea580c"
                        stroke="#fff"
                        strokeWidth="1"
                      />
                      <text
                        x={cx + w / 2 - 4}
                        y={cy - d / 2 + 6.5}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="7"
                        fontWeight="800"
                      >
                        {activeCount}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

          {/* Live Moving Agents & Active A* Waypoint Polylines */}
          {activeAgents.map((ag) => {
            const ax = toPxX(ag.x ?? ag.targetX ?? 0);
            const ay = toPxY(ag.z ?? ag.targetZ ?? 8);
            const isEmp = ag.agentKind === "employee";
            const sceneId = isEmp ? `scene-${ag.agentId}` : ag.agentId;
            const isSelected =
              selectedSceneObjectId === sceneId || selectedSceneObjectId === `scene-${ag.agentId}`;

            const polylinePts =
              ag.pathPoints && ag.pathPoints.length >= 2
                ? ag.pathPoints.map((pt) => `${toPxX(pt.x)},${toPxY(pt.z)}`).join(" ")
                : `${ax},${ay} ${toPxX(ag.targetX ?? ag.x ?? 0)},${toPxY(ag.targetZ ?? ag.z ?? 8)}`;

            return (
              <g
                key={ag.agentId}
                onClick={() => selectSceneObject(`scene-${ag.agentId}`)}
                className="cursor-pointer"
              >
                {showAgentVectors && (ag.isMoving || isSelected) && (
                  <g>
                    <polyline
                      points={polylinePts}
                      fill="none"
                      stroke={isSelected ? "#fbbf24" : isEmp ? "#38bdf8" : "#f472b6"}
                      strokeWidth={isSelected ? "2" : "1.3"}
                      strokeDasharray="3 2"
                      strokeOpacity={isSelected ? "0.95" : "0.7"}
                    />
                    {(ag.pathPoints || []).map((pt, pIdx) => (
                      <circle
                        key={pIdx}
                        cx={toPxX(pt.x)}
                        cy={toPxY(pt.z)}
                        r={1.8}
                        fill={isEmp ? "#38bdf8" : "#f472b6"}
                      />
                    ))}
                  </g>
                )}
                <circle
                  cx={ax}
                  cy={ay}
                  r={isSelected ? 7.5 : 5.2}
                  fill={isEmp ? "#0284c7" : "#db2777"}
                  stroke={isSelected ? "#fbbf24" : "#f8fafc"}
                  strokeWidth={isSelected ? 2.5 : 1.2}
                />
                <text
                  x={ax}
                  y={ay - 7.5}
                  textAnchor="middle"
                  fill="#f1f5f9"
                  fontSize="7.8"
                  fontWeight="600"
                >
                  {ag.name?.split(" ")[0]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
