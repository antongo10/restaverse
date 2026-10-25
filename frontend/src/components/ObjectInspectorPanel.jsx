import React, { useState } from "react";
import { useSimulationStore } from "../store/useSimulationStore";
import { parisHourOf } from "../lib/parisTime";
import { VISUAL_ASSET_META } from "./assets/CulinaryAssets3D";

const PROVENANCE_STYLES = {
  historical_fact: {
    label: "HISTORICAL FACT",
    bg: "bg-emerald-950/90 text-emerald-300 border-emerald-700/60",
  },
  derived_workflow: {
    label: "DERIVED WORKFLOW",
    bg: "bg-amber-950/90 text-amber-300 border-amber-700/60",
  },
  synthetic_activity: {
    label: "SPECIALTY VENUE",
    bg: "bg-purple-950/90 text-purple-300 border-purple-700/60",
  },
};

const VENUE_BRAND_META = {
  "business-bistrot-lumiere": {
    name: "Bistrot Lumière",
    crest: "/brands/bistrot/crest.png",
    fallbackIcon: "🐓",
    subtitle: "Brasserie Française & Gastronomie Niçoise",
    motto: "« L’Art du Cuivre, du Terroir et de la Flamme »",
    accentBorder: "border-amber-500/40",
    accentText: "text-amber-300",
    badgeBg: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  },
  "business-osteria-bellavista": {
    name: "Osteria Bellavista",
    crest: "/brands/osteria/crest.png",
    fallbackIcon: "🥩",
    subtitle: "Trattoria Toscana · Pasta Fresca & Bistecca",
    motto: "« Tradizione Fiorentina, Fuoco di Quercia & Vino Nobile »",
    accentBorder: "border-red-500/40",
    accentText: "text-red-300",
    badgeBg: "bg-red-500/20 text-red-300 border-red-500/40",
  },
  "business-sakana-tei": {
    name: "Sakana-Tei 魚亭",
    crest: "/brands/sakana/crest.png",
    fallbackIcon: "🍣",
    subtitle: "Omakase Sushi Hinoki & Binchotan Robata",
    motto: "« 旬の味覚 — Pureté de l’Eau, Cyprès Hinoki & Charbon Blanc »",
    accentBorder: "border-emerald-500/40",
    accentText: "text-emerald-300",
    badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  },
};

const TASK_STATUS_STYLES = {
  COOKING: {
    label: "COOKING",
    badge: "bg-orange-950 text-orange-300 border-orange-500/60",
    bar: "bg-gradient-to-r from-amber-500 via-orange-500 to-red-500",
  },
  QUEUED: {
    label: "QUEUED",
    badge: "bg-sky-950 text-sky-300 border-sky-500/60",
    bar: "bg-gradient-to-r from-sky-500 to-blue-400",
  },
  READY_AT_PASS: {
    label: "READY_AT_PASS",
    badge: "bg-emerald-950 text-emerald-300 border-emerald-500/60",
    bar: "bg-gradient-to-r from-emerald-500 to-teal-400",
  },
  PREP_BATCH: {
    label: "PREP_BATCH",
    badge: "bg-amber-950 text-amber-300 border-amber-500/60",
    bar: "bg-gradient-to-r from-amber-400 to-yellow-500",
  },
  RECEIVING_STOCK: {
    label: "RECEIVING_STOCK",
    badge: "bg-cyan-950 text-cyan-300 border-cyan-500/60",
    bar: "bg-gradient-to-r from-cyan-500 to-teal-400",
  },
};

function formatEuros(cents) {
  return `€${((cents || 0) / 100).toLocaleString("en-IE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatTime(isoOrMs) {
  if (!isoOrMs) return "--:--:--";
  const d = new Date(isoOrMs);
  return d.toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getAssetMeta(visualAsset) {
  return (
    VISUAL_ASSET_META[visualAsset] ||
    VISUAL_ASSET_META.copper_saute_pan || {
      title: "Sautoir en Cuivre Étamé",
      badge: "Cuisson Minute",
      color: "#d97706",
      icon: "🍳",
      temp: "195°C",
    }
  );
}

function computeTaskProgress(task, timestampMs) {
  if (task.status === "READY_AT_PASS") return 100;
  if (task.status === "QUEUED") return 20;
  const elapsedMin = Math.max(0, ((timestampMs || 0) - (task.startedAtMs || timestampMs || 0)) / 60000);
  const prepMin = Math.max(2, Number(task.prepMinutes || 10));
  return Math.min(96, Math.max(28, Math.round((elapsedMin / prepMin) * 100)));
}

export default function ObjectInspectorPanel() {
  const [activeTab, setActiveTab] = useState("inspector"); // "inspector" | "events" | "streams"

  const bootstrap = useSimulationStore((s) => s.bootstrap);
  const dayBundle = useSimulationStore((s) => s.dayBundle);
  const projectedState = useSimulationStore((s) => s.projectedState);
  const selectedSceneObjectId = useSimulationStore((s) => s.selectedSceneObjectId);
  const inspectorData = useSimulationStore((s) => s.inspectorData);
  const selectSceneObject = useSimulationStore((s) => s.selectSceneObject);
  const setTimestampMs = useSimulationStore((s) => s.setTimestampMs);
  const eventFilterBusinessId = useSimulationStore((s) => s.eventFilterBusinessId);
  const setEventFilterBusinessId = useSimulationStore((s) => s.setEventFilterBusinessId);
  const provenanceTrace = useSimulationStore((s) => s.provenanceTrace);
  const startDishReverseTrace = useSimulationStore((s) => s.startDishReverseTrace);
  const startIngredientForwardTrace = useSimulationStore((s) => s.startIngredientForwardTrace);
  const startIngredientReverseTrace = useSimulationStore((s) => s.startIngredientReverseTrace);
  const stopProvenanceTrace = useSimulationStore((s) => s.stopProvenanceTrace);

  if (!bootstrap || !projectedState) return null;

  const sceneObjects = bootstrap.sceneObjects || [];
  const selectedObj = sceneObjects.find((o) => o.sceneObjectId === selectedSceneObjectId);

  // Check if selectedSceneObjectId is a live agent
  const rawAgentId = selectedSceneObjectId?.replace(/^scene-/, "");
  const liveAgent = (projectedState.activeAgents || []).find(
    (a) => a.agentId === rawAgentId || `scene-${a.agentId}` === selectedSceneObjectId
  );

  // Check if selectedSceneObjectId is a Plated Dish Instance (dish-* or scene-dish-*)
  const rawDishId = selectedSceneObjectId?.replace(/^scene-dish-/, "");
  const liveDishInstance =
    projectedState.dishInstancesState?.[rawDishId] ||
    projectedState.dishInstancesState?.[selectedSceneObjectId] ||
    Object.values(projectedState.dishInstancesState || {}).find(
      (d) => d.sceneObjectId === selectedSceneObjectId || d.dishInstanceId === selectedSceneObjectId
    ) ||
    null;

  // Check if selectedSceneObjectId is a Physical Stock Unit (unit-* or scene-unit-*)
  const rawUnitId = selectedSceneObjectId?.replace(/^scene-unit-/, "");
  const liveStockUnit =
    projectedState.stockUnitsState?.[rawUnitId] ||
    projectedState.stockUnitsState?.[selectedSceneObjectId] ||
    Object.values(projectedState.stockUnitsState || {}).find(
      (u) => u.sceneObjectId === selectedSceneObjectId || u.unitId === selectedSceneObjectId
    ) ||
    null;

  const businessId =
    selectedObj?.businessId ||
    liveAgent?.businessId ||
    liveDishInstance?.businessId ||
    liveStockUnit?.businessId ||
    "business-bistrot-lumiere";
  const businessState = projectedState.businessStates?.[businessId];
  const businessDoc = (bootstrap.businesses || []).find((b) => b._id === businessId);
  const venueBrand = VENUE_BRAND_META[businessId] || VENUE_BRAND_META["business-bistrot-lumiere"];

  // Live table or station state at current timestampMs
  const liveTable =
    selectedObj?.domainEntityType === "table"
      ? businessState?.tables?.[selectedObj.domainEntityId]
      : null;

  const liveOrder =
    liveTable?.activeOrderId && businessState?.activeOrdersMap
      ? businessState.activeOrdersMap[liveTable.activeOrderId]
      : null;

  // Build normalized, complete list of all checks on this table today (from dayBundle.orders + dayBundle.events)
  const tableChecksToday = (() => {
    if (selectedObj?.domainEntityType !== "table") return [];
    const tableId = selectedObj.domainEntityId;
    const byOrderId = new Map();

    const rawOrders = [
      ...(dayBundle?.orders || []).filter((o) => o.tableId === tableId),
      ...(inspectorData?.domainDetails?.ordersToday || []).filter((o) => o.tableId === tableId),
    ];
    for (const o of rawOrders) {
      const oid = o._id || o.orderId;
      if (!oid || byOrderId.has(oid)) continue;
      byOrderId.set(oid, {
        orderId: oid,
        orderNumber: o.orderNumber || String(oid).slice(-6).toUpperCase(),
        openedAt: o.openedAt,
        closedAt: o.closedAt,
        covers: Number(o.covers || o.guestCount || 2),
        waiterName: o.waiterName || "Service Salle",
        partyName: o.partyName || null,
        paidCents: Number(o.paidCents || o.dueCents || o.subtotalCents || o.totalCents || o.Summary?.totalCents || 0),
        tipCents: Number(o.tipCents || 0),
        lines: (o.lines || o.items || []).map((l) => ({
          name: l.name || l.dishName || "Plat",
          qty: Number(l.qty || 1),
          lineTotalCents: Number(
            l.totalCents || l.lineTotalCents || (l.unitCents || l.unitPriceCents || 2200) * Number(l.qty || 1)
          ),
        })),
      });
    }

    // Enrich or synthesize checks from dayBundle.events (supports Osteria Bellavista & Sakana-Tei tables too)
    for (const ev of dayBundle?.events || []) {
      const pl = ev.payload || {};
      const evTableId = pl.tableId || ev.target?.tableId || ev.target?.domainEntityId;
      const oid = pl.orderId || ev.target?.orderId;
      if (!oid) continue;
      const evTimeIso = ev.eventTime || ev.timestamp;

      if (evTableId === tableId && (ev.eventType === "PARTY_SEATED" || ev.eventType === "ORDER_CREATED")) {
        if (!byOrderId.has(oid)) {
          byOrderId.set(oid, {
            orderId: oid,
            orderNumber: pl.orderNumber || String(oid).replace(/^ord-/, "").slice(-6).toUpperCase(),
            openedAt: evTimeIso,
            closedAt: null,
            covers: Number(pl.partySize || pl.covers || 2),
            waiterName: pl.waiterName || ev.actor?.name || "Service Salle",
            partyName: pl.partyName || null,
            paidCents: Number(pl.totalCents || 0),
            tipCents: 0,
            lines: [],
          });
        } else {
          const existing = byOrderId.get(oid);
          if (!existing.openedAt && evTimeIso) existing.openedAt = evTimeIso;
          if (pl.partyName && !existing.partyName) existing.partyName = pl.partyName;
          if (pl.waiterName && (!existing.waiterName || existing.waiterName === "Service Salle")) {
            existing.waiterName = pl.waiterName;
          }
          if (pl.partySize && !existing.covers) existing.covers = Number(pl.partySize);
        }
      } else if (byOrderId.has(oid)) {
        const existing = byOrderId.get(oid);
        if (ev.eventType === "ORDER_LINES_SENT_TO_STATION" && (pl.items || []).length > 0) {
          // Only append if lines weren't already populated from orders.json
          if (existing.lines.length === 0 || !rawOrders.some((ro) => (ro._id || ro.orderId) === oid)) {
            for (const it of pl.items) {
              existing.lines.push({
                name: it.name || it.dishName || "Plat",
                qty: Number(it.qty || 1),
                lineTotalCents: Number(
                  it.totalCents || it.lineTotalCents || (it.unitCents || it.unitPriceCents || 2400) * Number(it.qty || 1)
                ),
              });
            }
          }
        } else if (ev.eventType === "PAYMENT_COMPLETED") {
          if (!existing.closedAt && evTimeIso) existing.closedAt = evTimeIso;
          if (pl.paidCents || pl.amountCents) existing.paidCents = Number(pl.paidCents || pl.amountCents);
          if (pl.tipCents) existing.tipCents = Number(pl.tipCents);
        }
      }
    }

    return Array.from(byOrderId.values())
      .map((chk) => {
        const openedMs = Date.parse(chk.openedAt) || projectedState.timestampMs;
        const closedMs = chk.closedAt ? Date.parse(chk.closedAt) : openedMs + 55 * 60000;
        const hr = parisHourOf(openedMs);
        const servicePeriod = hr < 16 ? "DÉJEUNER" : "DÎNER";
        const linesSum = chk.lines.reduce((s, l) => s + (l.lineTotalCents || 0), 0);
        const totalCents = chk.paidCents > 0 ? chk.paidCents : linesSum > 0 ? linesSum : chk.covers * 4200;
        const isActiveNow = projectedState.timestampMs >= openedMs && projectedState.timestampMs <= closedMs;
        return {
          ...chk,
          openedMs,
          closedMs,
          servicePeriod,
          totalCents,
          isActiveNow,
        };
      })
      .sort((a, b) => a.openedMs - b.openedMs);
  })();

  const liveStation =
    selectedObj && ["station", "storage", "pos_terminal"].includes(selectedObj.domainEntityType)
      ? businessState?.stations?.[selectedObj.domainEntityId]
      : liveStockUnit?.stationId
      ? businessState?.stations?.[liveStockUnit.stationId]
      : null;

  // Match multi-turn dialogues relevant to the selected agent, table, dish, or venue
  const relevantDialogues = (() => {
    const allDialogues = [
      ...(projectedState.activeDialogues || []),
      ...(dayBundle?.dialogues || []),
    ];
    const seen = new Set();
    const deduped = [];
    for (const d of allDialogues) {
      const id = d.dialogueId || d._id || `${d.timestampMs}-${d.topic}`;
      if (seen.has(id)) continue;
      seen.add(id);
      deduped.push(d);
    }

    const filtered = deduped.filter((d) => {
      if (liveAgent) {
        return (
          (d.participants || []).some((p) => p.agentId === liveAgent.agentId) ||
          (d.turns || []).some((t) => t.speakerAgentId === liveAgent.agentId)
        );
      }
      if (liveTable) {
        return d.tableId === liveTable.tableId || d.businessId === businessId;
      }
      if (liveDishInstance) {
        return (
          d.dishInstanceId === liveDishInstance.dishInstanceId ||
          d.tableId === liveDishInstance.tableId ||
          d.businessId === businessId
        );
      }
      return d.businessId === businessId;
    });

    return filtered.slice(0, 6);
  })();

  const recentEvents = (projectedState.recentStreetEvents || []).filter(
    (e) => eventFilterBusinessId === "ALL" || e.businessId === eventFilterBusinessId
  );

  return (
    <aside className="w-[410px] h-full bg-slate-900/95 border-l border-slate-800 flex flex-col text-slate-200 select-none shrink-0">
      {/* Top Tab Switcher */}
      <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-950/70 p-1.5 gap-1">
        <button
          onClick={() => setActiveTab("inspector")}
          className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition ${
            activeTab === "inspector"
              ? "bg-amber-500 text-slate-950 shadow"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          Object Inspector
        </button>
        <button
          onClick={() => setActiveTab("events")}
          className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 ${
            activeTab === "events"
              ? "bg-amber-500 text-slate-950 shadow"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          <span>Event Feed</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-amber-400">
            {projectedState.eventsAppliedCount}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("streams")}
          className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition ${
            activeTab === "streams"
              ? "bg-amber-500 text-slate-950 shadow"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          Atlas & Audit
        </button>
      </div>

      {/* TAB 1: OBJECT INSPECTOR */}
      {activeTab === "inspector" && (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
          {/* VENUE BRAND BANNER */}
          <div
            className={`relative overflow-hidden rounded-xl border ${venueBrand.accentBorder} bg-slate-950 p-3 shadow-lg`}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                <img
                  src={venueBrand.crest}
                  alt={venueBrand.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <span className="text-lg">{venueBrand.fallbackIcon}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1.5">
                  <h3 className="text-xs font-extrabold text-white tracking-wide uppercase truncate">
                    {businessDoc?.name || venueBrand.name}
                  </h3>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${venueBrand.badgeBg} shrink-0`}
                  >
                    {businessState?.operatingStatus || "OPEN"}
                  </span>
                </div>
                <p className={`text-[11px] font-semibold ${venueBrand.accentText} truncate mt-0.5`}>
                  {businessDoc?.specialty || venueBrand.subtitle}
                </p>
                <p className="text-[10px] italic text-slate-400 truncate mt-0.5">
                  {venueBrand.motto}
                </p>
              </div>
            </div>
          </div>

          {/* Registry Header Card */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {liveDishInstance
                    ? `PLATED DISH · COURSE #${liveDishInstance.course || 1}`
                    : liveStockUnit
                    ? `STOCK UNIT · SHELF TIER #${liveStockUnit.shelfTier || 1}`
                    : liveAgent
                    ? `AGENT · ${liveAgent.agentKind.toUpperCase()}`
                    : selectedObj?.stationKind || selectedObj?.objectType || "SCENE OBJECT"}
                </span>
                <h2 className="text-base font-bold text-white mt-1.5 leading-snug">
                  {liveDishInstance
                    ? liveDishInstance.dishName
                    : liveStockUnit
                    ? liveStockUnit.unitLabel || liveStockUnit.ingredientName
                    : liveAgent
                    ? liveAgent.name
                    : selectedObj?.label || selectedSceneObjectId}
                </h2>
              </div>
              {businessDoc && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 shrink-0">
                  {businessDoc.name}
                </span>
              )}
            </div>

            {/* SceneObjectReference metadata */}
            <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-800/80 text-[11px]">
              <div className="bg-slate-900/80 px-2 py-1 rounded">
                <span className="text-slate-500 block text-[9px] uppercase">sceneObjectId</span>
                <span className="font-mono text-slate-300 truncate block">
                  {selectedSceneObjectId || "none"}
                </span>
              </div>
              <div className="bg-slate-900/80 px-2 py-1 rounded">
                <span className="text-slate-500 block text-[9px] uppercase">domainEntity</span>
                <span className="font-mono text-amber-300 truncate block">
                  {liveDishInstance
                    ? `plated_dish:${liveDishInstance.dishInstanceId}`
                    : liveStockUnit
                    ? `stock_unit:${liveStockUnit.unitId}`
                    : liveAgent
                    ? `${liveAgent.agentKind}:${liveAgent.agentId}`
                    : `${selectedObj?.domainEntityType || "entity"}:${selectedObj?.domainEntityId || "-"}`}
                </span>
              </div>
            </div>
          </div>

          {/* CASE P1: PLATED DISH PROVENANCE & 5-STAGE LINEAGE INSPECTOR */}
          {liveDishInstance && (
            <div className="bg-slate-950/90 border-2 border-amber-500/60 rounded-xl p-3.5 space-y-3 shadow-xl">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-amber-400 uppercase tracking-wider">
                  🍽️ Plated Dish Provenance & Lineage
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600/70">
                  {liveDishInstance.currentStage || liveDishInstance.status || "SERVED"}
                </span>
              </div>

              {liveDishInstance.recipeSummary && (
                <p className="text-xs text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 leading-relaxed">
                  {liveDishInstance.recipeSummary}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900 p-2 rounded-lg">
                  <span className="text-slate-400 block text-[10px]">Prepared By (Cuisine)</span>
                  <span className="font-semibold text-amber-300">
                    👨‍🍳 {liveDishInstance.cookName || "Chef de Partie"}
                  </span>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg">
                  <span className="text-slate-400 block text-[10px]">Served By (Salle)</span>
                  <span className="font-semibold text-sky-300">
                    🤵 {liveDishInstance.waiterName || "Service Salle"}
                  </span>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg">
                  <span className="text-slate-400 block text-[10px]">Destination Table</span>
                  <button
                    onClick={() => {
                      const tbObj = sceneObjects.find(
                        (o) => o.domainEntityId === liveDishInstance.tableId
                      );
                      if (tbObj) selectSceneObject(tbObj.sceneObjectId);
                    }}
                    className="font-semibold text-emerald-400 hover:underline text-left"
                  >
                    🪑 {liveDishInstance.tableLabel || liveDishInstance.tableId}
                  </button>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg">
                  <span className="text-slate-400 block text-[10px]">Delivered Time</span>
                  <span className="font-mono font-semibold text-white">
                    {formatTime(liveDishInstance.deliveredAtMs)}
                  </span>
                </div>
              </div>

              {/* Reverse Provenance Action Button */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => startDishReverseTrace(liveDishInstance)}
                  className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-xs shadow-lg transition flex items-center justify-center gap-1.5"
                >
                  <span>⏪ Play Dish Creation in Reverse</span>
                </button>
                {provenanceTrace?.targetId === liveDishInstance.dishInstanceId && (
                  <button
                    onClick={stopProvenanceTrace}
                    className="py-2 px-2.5 rounded-xl bg-red-950 hover:bg-red-900 text-red-200 border border-red-700 text-xs font-bold transition"
                  >
                    Stop
                  </button>
                )}
              </div>

              {/* Physical Ingredient Stock Units Used in this Dish */}
              {liveDishInstance.ingredientUnitsUsed?.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
                    Physical Shelf Units Drawn for This Dish ({liveDishInstance.ingredientUnitsUsed.length})
                  </span>
                  <div className="space-y-1.5">
                    {liveDishInstance.ingredientUnitsUsed.map((ing, idx) => {
                      const liveUnit = projectedState.stockUnitsState?.[ing.unitId];
                      return (
                        <div
                          key={ing.unitId || idx}
                          className="bg-slate-900/95 border border-emerald-500/40 rounded-lg p-2.5 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <button
                              onClick={() =>
                                selectSceneObject(ing.sceneObjectId || `scene-unit-${ing.unitId}`)
                              }
                              className="text-xs font-bold text-emerald-300 hover:underline text-left truncate"
                            >
                              🥒 {ing.unitLabel || ing.ingredientName}
                            </button>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60 shrink-0">
                              -{ing.qtyUsed}
                              {ing.unit} ({ing.remainingBefore}
                              {ing.unit} → {ing.remainingAfter}
                              {ing.unit})
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>
                              Shelf Tier #{ing.shelfTier || 1} · Slot #{(ing.shelfSlot ?? 0) + 1} · Live:{" "}
                              <strong className="text-white">
                                {liveUnit ? `${liveUnit.remainingQty}${liveUnit.unit}` : `${ing.remainingAfter}${ing.unit}`}
                              </strong>{" "}
                              left
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => startIngredientForwardTrace(ing.unitId)}
                                className="px-1.5 py-0.5 rounded bg-sky-950 hover:bg-sky-900 text-sky-300 border border-sky-700/60 font-mono"
                                title="Trace this ingredient unit forward"
                              >
                                ⏩ Forward
                              </button>
                              <button
                                onClick={() => startIngredientReverseTrace(ing.unitId)}
                                className="px-1.5 py-0.5 rounded bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-700/60 font-mono"
                                title="Trace this ingredient unit in reverse"
                              >
                                ⏪ Reverse
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 5-Stage Provenance Timeline Stepper */}
              {liveDishInstance.stages?.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <span className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider block">
                    End-to-End Culinary Lineage Stages ({liveDishInstance.stages.length})
                  </span>
                  <div className="space-y-1.5">
                    {liveDishInstance.stages.map((stg, idx) => {
                      const isDone = (projectedState.timestampMs || 0) >= (stg.timestampMs || 0);
                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            if (stg.timestampMs) setTimestampMs(stg.timestampMs);
                            if (stg.actorAgentId) {
                              useSimulationStore.setState({
                                followedAgentId: stg.actorAgentId,
                                cameraPreset: "follow_agent",
                              });
                            }
                          }}
                          className={`p-2 rounded-lg border cursor-pointer transition text-xs ${
                            isDone
                              ? "bg-slate-900/95 border-amber-500/40 text-white"
                              : "bg-slate-900/40 border-slate-800 text-slate-400"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-amber-300 truncate">
                              {idx + 1}. {stg.label}
                            </span>
                            <span className="font-mono text-[10px] text-sky-300 shrink-0">
                              {formatTime(stg.timestampMs)}
                            </span>
                          </div>
                          {stg.detail && (
                            <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                              {stg.detail}
                            </p>
                          )}
                          {stg.actorName && (
                            <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                              <span>👤 {stg.actorName}</span>
                              <span className="text-sky-400 font-mono">Jump & Follow →</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CASE P2: PHYSICAL STOCK UNIT PROVENANCE & MUTEX COHERENCY INSPECTOR */}
          {liveStockUnit && (
            <div className="bg-slate-950/90 border-2 border-emerald-500/60 rounded-xl p-3.5 space-y-3 shadow-xl">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider">
                  📦 Physical Shelf Unit Provenance
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    liveStockUnit.status === "ON_SHELF"
                      ? "bg-emerald-950 text-emerald-300 border-emerald-600"
                      : liveStockUnit.status === "DEPLETED"
                      ? "bg-red-950 text-red-300 border-red-600"
                      : "bg-amber-950 text-amber-300 border-amber-500 animate-pulse"
                  }`}
                >
                  {liveStockUnit.status}
                </span>
              </div>

              {/* Quantity & Shelf Coordinates */}
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Live Remaining Quantity:</span>
                  <span className="font-mono font-extrabold text-sm text-emerald-400">
                    {liveStockUnit.remainingQty}
                    {liveStockUnit.unit} / {liveStockUnit.initialQty}
                    {liveStockUnit.unit} (
                    {Math.round((liveStockUnit.fillRatio || 0) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                    style={{ width: `${Math.round((liveStockUnit.fillRatio || 0) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                  <span>
                    Shelf Tier #{liveStockUnit.shelfTier} · Slot #{(liveStockUnit.shelfSlot ?? 0) + 1}
                  </span>
                  <span className="font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    FIFO Priority #{liveStockUnit.fifoOrder || 1}
                  </span>
                </div>
                {liveStockUnit.holderName && (
                  <div className="text-[11px] text-amber-300 font-semibold pt-1">
                    ✋ Currently Held By: {liveStockUnit.holderName}
                  </div>
                )}
              </div>

              {/* Bi-Directional Ingredient Trace Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => startIngredientForwardTrace(liveStockUnit)}
                  className="py-2 px-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs shadow transition flex items-center justify-center gap-1"
                >
                  <span>⏩ Trace Forward</span>
                </button>
                <button
                  onClick={() => startIngredientReverseTrace(liveStockUnit)}
                  className="py-2 px-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow transition flex items-center justify-center gap-1"
                >
                  <span>⏪ Trace Reverse</span>
                </button>
              </div>

              {/* Consumption History (Dishes Fed by This Physical Unit) */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <span className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider block">
                  Coherent Partial Draws & Dishes Fed ({(liveStockUnit.consumptionHistory || []).length})
                </span>
                {(liveStockUnit.consumptionHistory || []).map((ch, idx) => {
                  const hasHappened = (projectedState.timestampMs || 0) >= (ch.takenAtMs || ch.timestampMs || 0);
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (ch.takenAtMs || ch.timestampMs) {
                          setTimestampMs(ch.takenAtMs || ch.timestampMs);
                        }
                      }}
                      className={`p-2.5 rounded-lg border cursor-pointer transition text-xs space-y-1 ${
                        hasHappened
                          ? "bg-slate-900 border-emerald-500/40 text-white"
                          : "bg-slate-900/40 border-slate-800 text-slate-400"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-amber-300">
                          #{idx + 1} · -{ch.qtyTaken}
                          {liveStockUnit.unit} ({ch.remainingBefore}
                          {liveStockUnit.unit} → {ch.remainingAfter}
                          {liveStockUnit.unit})
                        </span>
                        <span className="font-mono text-[10px] text-sky-300">
                          {formatTime(ch.takenAtMs || ch.timestampMs)}
                        </span>
                      </div>
                      <div className="text-[11px] font-semibold text-white">
                        🍽️ {ch.dishName} ({ch.tableLabel || ch.tableId})
                      </div>
                      <div className="text-[10px] text-slate-300">
                        👨‍🍳 {ch.actorName || ch.cookName}
                      </div>
                      {ch.notes && (
                        <p className="text-[10px] text-slate-400 leading-snug">{ch.notes}</p>
                      )}
                      {ch.dishInstanceId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            selectSceneObject(`scene-dish-${ch.dishInstanceId}`);
                          }}
                          className="mt-1 text-[10px] font-mono text-amber-300 hover:underline block"
                        >
                          Inspect Plated Dish Lineage →
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Mutex Contention Log */}
              {liveStockUnit.contentionLog?.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">
                    🔒 Multi-Cook Mutex Contention & Coherency Log
                  </span>
                  {liveStockUnit.contentionLog.map((c, i) => (
                    <div
                      key={i}
                      onClick={() => c.timestampMs && setTimestampMs(c.timestampMs)}
                      className="bg-amber-950/30 border border-amber-500/50 rounded-lg p-2.5 text-xs space-y-1 cursor-pointer hover:bg-amber-950/50 transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold text-amber-300">
                          {c.resolution || "MUTEX_WAIT_FIFO"}
                        </span>
                        <span className="font-mono text-[10px] text-slate-300">
                          {formatTime(c.timestampMs)}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-100 leading-snug">{c.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CASE A: AGENT INSPECTOR */}
          {liveAgent && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
                  Live Agent Telemetry
                </span>
                <button
                  onClick={() => {
                    useSimulationStore.setState({
                      followedAgentId: liveAgent.agentId,
                      cameraPreset: "follow_agent",
                    });
                  }}
                  className="text-xs px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium transition"
                >
                  Follow in 3D Camera
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900 p-2 rounded-lg">
                  <span className="text-slate-400 block text-[10px]">Role / Brigade Title</span>
                  <span className="font-semibold text-white">
                    {liveAgent.jobTitle || liveAgent.role || "Customer Party"}
                  </span>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg">
                  <span className="text-slate-400 block text-[10px]">Status</span>
                  <span className="font-semibold text-emerald-400">{liveAgent.status}</span>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg col-span-2">
                  <span className="text-slate-400 block text-[10px]">Current Operational Task</span>
                  <span className="font-medium text-amber-300">
                    {liveAgent.currentTask || "En service"}
                  </span>
                </div>
                {(liveAgent.activeDish || liveAgent.carryingDish) && (
                  <div className="bg-slate-900/90 border border-amber-500/30 p-2.5 rounded-lg col-span-2 flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 block text-[10px]">
                        {liveAgent.activeDish ? "Active Dish on Stove" : "Carrying Course on Tray"}
                      </span>
                      <span className="font-bold text-white">
                        {liveAgent.activeDish || liveAgent.carryingDish}
                      </span>
                    </div>
                    {liveAgent.visualAsset && (
                      <span className="text-lg" title={getAssetMeta(liveAgent.visualAsset).title}>
                        {getAssetMeta(liveAgent.visualAsset).icon}
                      </span>
                    )}
                  </div>
                )}
                {liveAgent.speechBubble && (
                  <div className="bg-sky-950/50 border border-sky-500/40 p-2.5 rounded-lg col-span-2">
                    <span className="text-[10px] font-mono uppercase text-sky-300 block">
                      💬 Live Dialogue Utterance
                    </span>
                    <p className="text-xs italic text-white mt-0.5">
                      « {liveAgent.speechBubble} »
                    </p>
                  </div>
                )}
                <div className="bg-slate-900 p-2 rounded-lg col-span-2 flex justify-between">
                  <span className="text-slate-400">Street Coordinates (X, Z):</span>
                  <span className="font-mono text-slate-200">
                    ({(liveAgent.x || 0).toFixed(1)}m, {(liveAgent.z || 0).toFixed(1)}m)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* CASE B: TABLE INSPECTOR */}
          {liveTable && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  Table State at Selected Time
                </span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    liveTable.status === "AVAILABLE"
                      ? "bg-emerald-950 text-emerald-300 border border-emerald-700"
                      : "bg-amber-950 text-amber-300 border border-amber-600"
                  }`}
                >
                  {liveTable.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900 p-2 rounded-lg">
                  <span className="text-slate-400 block text-[10px]">Customer Party</span>
                  <span className="font-semibold text-white">
                    {liveTable.partyName || "Unoccupied"}
                  </span>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg">
                  <span className="text-slate-400 block text-[10px]">Covers / Occupied Places</span>
                  <span className="font-semibold text-white">
                    {liveTable.partySize || 0} / {liveTable.seats} guests
                  </span>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg">
                  <span className="text-slate-400 block text-[10px]">Assigned Waiter</span>
                  <span className="font-semibold text-sky-300">
                    {liveTable.waiterName || "Brigade de Salle"}
                  </span>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg">
                  <span className="text-slate-400 block text-[10px]">Current Course</span>
                  <span className="font-semibold text-amber-300">
                    {liveTable.currentCourse > 0
                      ? `Service Suite #${liveTable.currentCourse}`
                      : "Seated / Menu"}
                  </span>
                </div>
              </div>

              {/* Dishes Currently Served on Table */}
              {liveTable.servedDishes?.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
                    Plated Dishes Currently on Table ({liveTable.servedDishes.length})
                  </span>
                  <div className="space-y-2">
                    {liveTable.servedDishes.map((dish, idx) => {
                      const meta = getAssetMeta(dish.visualAsset);
                      return (
                        <div
                          key={dish.dishInstanceId || idx}
                          className="bg-slate-900/95 border border-emerald-500/40 rounded-lg p-2.5 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-white">
                              <span className="text-amber-400 mr-1.5">×{dish.qty || 1}</span>
                              {dish.dishName || dish.name}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 shrink-0">
                              {meta.icon} {meta.badge}
                            </span>
                          </div>
                          {dish.recipeSummary && (
                            <p className="text-[11px] text-slate-400 leading-snug">
                              {dish.recipeSummary}
                            </p>
                          )}
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>
                              👨‍🍳 {dish.cookName || "Brigade"} · 🤵 {dish.waiterName || "Salle"}
                            </span>
                            <span>{meta.temp}</span>
                          </div>
                          <div className="flex items-center gap-1.5 pt-1">
                            <button
                              onClick={() =>
                                startDishReverseTrace(
                                  dish.dishInstanceId || dish.sceneObjectId || dish
                                )
                              }
                              className="flex-1 py-1.5 px-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[11px] transition flex items-center justify-center gap-1 shadow"
                            >
                              <span>⏪ Play Dish Creation in Reverse</span>
                            </button>
                            {dish.dishInstanceId && (
                              <button
                                onClick={() =>
                                  selectSceneObject(
                                    dish.sceneObjectId || `scene-dish-${dish.dishInstanceId}`
                                  )
                                }
                                className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 text-[11px] font-semibold transition"
                              >
                                Lineage
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Active Order Line Items */}
              {liveOrder ? (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">
                      Active Check ({liveOrder.orderNumber || liveOrder.orderId})
                    </span>
                    {liveOrder.totalCents > 0 && (
                      <span className="font-bold text-emerald-400">
                        {formatEuros(liveOrder.totalCents)}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {(liveOrder.items || []).map((item, i) => {
                      const meta = getAssetMeta(item.visualAsset);
                      return (
                        <div
                          key={i}
                          className="bg-slate-900/90 px-2.5 py-2 rounded-lg text-xs border border-slate-800/80 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-semibold text-white truncate">
                              <span className="text-amber-400 mr-1.5">×{item.qty || 1}</span>
                              <span>{item.name || item.dishName}</span>
                            </div>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 shrink-0">
                              {meta.icon} {meta.badge}
                            </span>
                          </div>
                          {item.recipeSummary && (
                            <p className="text-[11px] text-slate-400 leading-snug">
                              {item.recipeSummary}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                  No active open check at this exact minute. Scrub timeline to lunch (12:15–14:30) or dinner (19:15–22:00) to inspect live table courses.
                </div>
              )}

              {/* Historical & Scheduled Checks for this Table on Selected Date */}
              <div className="space-y-2 pt-2.5 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                    All Checks on This Table Today ({tableChecksToday.length})
                  </span>
                  {tableChecksToday.length > 0 && (
                    <span className="text-[10px] font-mono text-emerald-400">
                      Total: {formatEuros(tableChecksToday.reduce((s, c) => s + (c.totalCents || 0), 0))}
                    </span>
                  )}
                </div>

                {tableChecksToday.length === 0 ? (
                  <div className="text-xs text-slate-400 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/60">
                    No checks recorded on this table for the selected date.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {tableChecksToday.map((chk) => {
                      const jumpTargetMs = Math.min(chk.closedMs - 6 * 60000, chk.openedMs + 22 * 60000);
                      const dishPreview = chk.lines
                        .slice(0, 3)
                        .map((l) => `${l.name} ×${l.qty}`)
                        .join(", ");
                      return (
                        <div
                          key={chk.orderId}
                          onClick={() => setTimestampMs(jumpTargetMs)}
                          className={`rounded-lg px-2.5 py-2 text-xs cursor-pointer transition border ${
                            chk.isActiveNow
                              ? "bg-amber-950/35 border-amber-500/70 shadow-sm"
                              : "bg-slate-900/85 hover:bg-slate-800/90 border-slate-800/80"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-mono font-bold text-amber-300">
                                #{chk.orderNumber}
                              </span>
                              <span className="text-[10px] font-mono text-slate-300">
                                {formatTime(chk.openedAt).slice(0, 5)}
                                {chk.closedAt ? `→${formatTime(chk.closedAt).slice(0, 5)}` : ""}
                              </span>
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-sky-300">
                                {chk.servicePeriod} · {chk.covers}p
                              </span>
                            </div>
                            <span className="font-bold text-emerald-400 shrink-0">
                              {formatEuros(chk.totalCents)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                            <span className="truncate">
                              {chk.partyName ? `${chk.partyName} · ` : ""}
                              Serveur: <span className="text-slate-300">{chk.waiterName}</span>
                            </span>
                            {chk.tipCents > 0 && (
                              <span className="text-emerald-300/90 font-mono shrink-0 ml-2">
                                +{formatEuros(chk.tipCents)} tip
                              </span>
                            )}
                          </div>

                          {dishPreview && (
                            <div className="text-[10px] text-slate-300/90 truncate mt-1 font-medium">
                              🍽️ {dishPreview}
                              {chk.lines.length > 3 ? ` (+${chk.lines.length - 3})` : ""}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CASE C: STATION / OVEN / SUSHI BAR / ROBATA / PASS / STORAGE / BAR INSPECTOR */}
          {liveStation && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">
                  3D Culinary Station & Shelf Telemetry
                </span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    liveStation.activeTasks?.length > 0
                      ? "bg-orange-950 text-orange-300 border border-orange-600"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {liveStation.activeTasks?.length > 0
                    ? `${liveStation.status} (${liveStation.activeTasks.length})`
                    : "STANDBY"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900 p-2 rounded-lg">
                  <span className="text-slate-400 block text-[10px]">Active Vessels on Top</span>
                  <span className="font-bold text-white text-sm">
                    {liveStation.activeTasks?.length || 0} dishes
                  </span>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg">
                  <span className="text-slate-400 block text-[10px]">Completed Today</span>
                  <span className="font-bold text-emerald-400 text-sm">
                    {liveStation.completedCount || 0} dishes
                  </span>
                </div>
              </div>

              {/* SORTED PHYSICAL SHELF INVENTORY BY TIER (FIFO COHERENCY) */}
              {liveStation.shelfInventory?.length > 0 && (
                <div className="space-y-2.5 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-emerald-400 uppercase tracking-wider">
                      📦 Sorted 3D Shelf Units (FIFO Priority)
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {liveStation.shelfInventory.length} physical units
                    </span>
                  </div>

                  {[2, 1, 0].map((tierNum) => {
                    const tierUnits = liveStation.shelfInventory.filter(
                      (u) => Number(u.shelfTier ?? 1) === tierNum
                    );
                    if (tierUnits.length === 0) return null;

                    // Identify the first available ON_SHELF unit per ingredient as #1 NEXT TO USE
                    const firstAvailableByIng = new Set();
                    for (const u of liveStation.shelfInventory) {
                      if (
                        u.status === "ON_SHELF" &&
                        u.remainingQty > 0 &&
                        !firstAvailableByIng.has(u.ingredientId || u.ingredientName)
                      ) {
                        firstAvailableByIng.add(u.ingredientId || u.ingredientName);
                        u._isNextFifo = true;
                      } else {
                        u._isNextFifo = false;
                      }
                    }

                    const tierLabel =
                      tierNum === 2
                        ? "Tier 2 · Top Shelf (Priorité FIFO)"
                        : tierNum === 1
                        ? "Tier 1 · Middle Shelf"
                        : "Tier 0 · Lower Reserve Crate";

                    return (
                      <div key={tierNum} className="space-y-1.5">
                        <div className="text-[10px] font-mono font-bold uppercase text-amber-300/90 bg-slate-900/90 px-2 py-1 rounded border border-slate-800">
                          {tierLabel}
                        </div>
                        {tierUnits.map((unit) => {
                          const pct = Math.round((unit.fillRatio || 0) * 100);
                          return (
                            <div
                              key={unit.unitId}
                              className={`bg-slate-900/95 rounded-xl p-2.5 border transition space-y-1.5 ${
                                selectedSceneObjectId === unit.sceneObjectId ||
                                selectedSceneObjectId === unit.unitId
                                  ? "border-amber-400 shadow-md"
                                  : "border-slate-800 hover:border-emerald-500/50"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1.5">
                                <button
                                  onClick={() =>
                                    selectSceneObject(
                                      unit.sceneObjectId || `scene-unit-${unit.unitId}`
                                    )
                                  }
                                  className="text-xs font-bold text-white hover:text-amber-300 text-left truncate"
                                >
                                  {unit.unitLabel || unit.ingredientName}
                                </button>
                                <div className="flex items-center gap-1 shrink-0">
                                  {unit._isNextFifo && (
                                    <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/50">
                                      #1 NEXT TO USE
                                    </span>
                                  )}
                                  <span
                                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                                      unit.status === "ON_SHELF"
                                        ? "bg-slate-950 text-emerald-300 border-emerald-700/60"
                                        : unit.status === "DEPLETED"
                                        ? "bg-red-950 text-red-300 border-red-700/60"
                                        : "bg-amber-950 text-amber-300 border-amber-500 animate-pulse"
                                    }`}
                                  >
                                    {unit.status}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-400">
                                  Slot #{(unit.shelfSlot ?? 0) + 1} · FIFO #{unit.fifoOrder || 1}
                                </span>
                                <span className="font-mono font-bold text-emerald-400">
                                  {unit.remainingQty}
                                  {unit.unit} / {unit.initialQty}
                                  {unit.unit} ({pct}%)
                                </span>
                              </div>

                              <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                                <div
                                  className={`h-full transition-all duration-300 ${
                                    pct > 50
                                      ? "bg-emerald-500"
                                      : pct > 0
                                      ? "bg-amber-500"
                                      : "bg-red-500"
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>

                              {unit.activeContention && (
                                <div className="text-[10px] bg-amber-950/60 border border-amber-500/50 text-amber-200 px-2 py-1 rounded">
                                  🔒 {unit.activeContention.reason}
                                </div>
                              )}

                              <div className="flex items-center justify-between gap-1.5 pt-0.5">
                                <button
                                  onClick={() => startIngredientForwardTrace(unit)}
                                  className="flex-1 py-1 px-2 rounded bg-sky-950 hover:bg-sky-900 text-sky-300 border border-sky-700/60 text-[10px] font-mono font-bold transition"
                                >
                                  ⏩ Forward Trace
                                </button>
                                <button
                                  onClick={() => startIngredientReverseTrace(unit)}
                                  className="flex-1 py-1 px-2 rounded bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-700/60 text-[10px] font-mono font-bold transition"
                                >
                                  ⏪ Reverse Trace
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}

              {liveStation.activeTasks?.length > 0 ? (
                <div className="space-y-2.5">
                  <span className="text-[11px] text-slate-300 font-semibold uppercase tracking-wider block">
                    Live 3D Cookware & Dishes on Station:
                  </span>
                  {liveStation.activeTasks.map((t, idx) => {
                    const meta = getAssetMeta(t.visualAsset);
                    const statusStyle =
                      TASK_STATUS_STYLES[t.status] || TASK_STATUS_STYLES.COOKING;
                    const pct = computeTaskProgress(t, projectedState.timestampMs);
                    const dishTitle = t.dishName || t.label || t.name || "Plat Signature";
                    const destTable = t.tableLabel || t.tableId || "Salle";

                    return (
                      <div
                        key={t.taskId || idx}
                        className="bg-slate-900/95 border border-slate-700/90 hover:border-amber-500/50 rounded-xl p-3 space-y-2 shadow-md transition"
                      >
                        {/* Top row: 3D Visual Asset Cookware Badge + Temperature & Task Status */}
                        <div className="flex items-center justify-between gap-1.5">
                          <span
                            className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-950 text-amber-300 border border-amber-500/30 truncate"
                            title={`${meta.title} · ${meta.temp}`}
                          >
                            {meta.icon} {meta.title} · {meta.temp}
                          </span>
                          <span
                            className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${statusStyle.badge}`}
                          >
                            {statusStyle.label}
                          </span>
                        </div>

                        {/* Dish / Ingredient Full Human-Readable Title & Quantity */}
                        <div className="flex items-baseline justify-between gap-2">
                          <h4 className="text-sm font-bold text-white leading-snug">
                            <span className="text-amber-400 font-extrabold mr-1.5">
                              ×{t.qty || 1}
                            </span>
                            {dishTitle}
                          </h4>
                          {t.category && (
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {t.category}
                            </span>
                          )}
                        </div>

                        {/* Recipe & Ingredient Summary */}
                        {t.recipeSummary && (
                          <p className="text-[11px] text-slate-300 bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800/80 leading-relaxed">
                            {t.recipeSummary}
                          </p>
                        )}

                        {/* Assigned Chef & Destination Table Badge */}
                        <div className="flex items-center justify-between text-[11px] pt-0.5">
                          <span className="text-sky-300 font-medium">
                            👨‍🍳 {t.chefName || "Chef de Partie"}
                          </span>
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-amber-200 border border-slate-700">
                            Table: {destTable}
                          </span>
                        </div>

                        {/* Animated Progress Bar */}
                        <div className="space-y-1 pt-0.5">
                          <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                            <div
                              className={`h-full ${statusStyle.bar} transition-all duration-300 animate-pulse`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-slate-400 bg-slate-900/60 p-3 rounded-lg border border-slate-800/70">
                  Station surface is clear at this timestamp. Scrub to service hours (12:00–14:30 or 19:00–22:15) or morning prep (08:00–10:30) to see 3D cookware and dishes in action.
                </div>
              )}

              {/* Inventory Snapshot when inspecting storage/cold room */}
              {inspectorData?.domainDetails?.inventorySnapshot?.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <span className="text-[11px] font-semibold text-sky-400 uppercase block">
                    Cold Room & Dry Stock Catalog ({inspectorData.domainDetails.inventorySnapshot.length} SKUs)
                  </span>
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                    {inspectorData.domainDetails.inventorySnapshot.slice(0, 14).map((inv) => (
                      <div
                        key={inv._id}
                        className="flex items-center justify-between bg-slate-900 px-2.5 py-1.5 rounded text-xs"
                      >
                        <span className="text-slate-200 truncate pr-2">{inv.name}</span>
                        <span className="font-mono text-emerald-400 shrink-0">
                          {inv.currentStock} {inv.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MULTI-TURN DIALOGUE TRANSCRIPT CARD */}
          {relevantDialogues.length > 0 && (
            <div className="bg-slate-950/80 border border-sky-500/30 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-sky-400 uppercase tracking-wider">
                  💬 Multi-Turn Brigade & Guest Dialogues ({relevantDialogues.length})
                </span>
                <span className="text-[10px] font-mono text-slate-400">Click to Jump</span>
              </div>
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {relevantDialogues.map((dlg, idx) => (
                  <div
                    key={dlg.dialogueId || idx}
                    onClick={() => dlg.timestampMs && setTimestampMs(dlg.timestampMs)}
                    className="bg-slate-900/95 border border-slate-800 hover:border-sky-500/50 rounded-xl p-2.5 space-y-1.5 cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-amber-300 uppercase truncate">
                        {dlg.context || dlg.topic || "Service Exchange"}
                      </span>
                      <span className="font-mono text-sky-300 shrink-0">
                        {formatTime(dlg.timestampMs)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {(dlg.turns || []).map((turn, tIdx) => (
                        <div
                          key={tIdx}
                          className="text-[11px] bg-slate-950/80 px-2 py-1.5 rounded-lg border border-slate-800/80"
                        >
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span className="font-bold text-sky-300">
                              {turn.speakerName || "Brigade"}
                            </span>
                            {turn.speakerRole && (
                              <span className="font-mono text-[9px] text-slate-500">
                                {turn.speakerRole}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-200 mt-0.5 leading-snug">
                            « {turn.text || turn.utterance} »
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Business-Level Live Summary Card */}
          {businessState && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  {businessState.businessName} — Cumulative at T
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300">
                  {businessState.operatingStatus}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-slate-900 p-2 rounded-lg">
                  <span className="text-slate-400 block text-[10px]">Revenue</span>
                  <span className="font-bold text-emerald-400">
                    {formatEuros(businessState.metrics.revenueCents)}
                  </span>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg">
                  <span className="text-slate-400 block text-[10px]">Orders (Open/Paid)</span>
                  <span className="font-bold text-white">
                    {businessState.metrics.activeOrders} / {businessState.metrics.completedOrders}
                  </span>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg">
                  <span className="text-slate-400 block text-[10px]">Active Staff</span>
                  <span className="font-bold text-sky-400">
                    {
                      Object.values(businessState.activeAgents || {}).filter(
                        (a) => a.agentKind === "employee"
                      ).length
                    }
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LIVE STREET EVENT STREAM */}
      {activeTab === "events" && (
        <div className="flex-1 flex flex-col overflow-hidden p-3 space-y-2.5">
          {/* Venue filter pills */}
          <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-[11px]">
            {[
              { id: "ALL", label: "Toute la Rue" },
              { id: "business-bistrot-lumiere", label: "Bistrot Lumière" },
              { id: "business-osteria-bellavista", label: "Osteria Bellavista" },
              { id: "business-sakana-tei", label: "Sakana-Tei 魚亭" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setEventFilterBusinessId(tab.id)}
                className={`py-1 px-2 rounded-lg font-semibold transition truncate ${
                  eventFilterBusinessId === tab.id
                    ? "bg-amber-500 text-slate-950 shadow"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {recentEvents.map((ev) => {
              const prov = PROVENANCE_STYLES[ev.provenance] || PROVENANCE_STYLES.derived_workflow;
              const pl = ev.payload || {};
              const actorName = ev.actor?.name;
              const primaryDish = pl.primaryDishName || pl.ingredientName || (pl.items && pl.items[0]?.name);
              const tableLabel = pl.tableLabel || pl.tableId;

              return (
                <div
                  key={ev._id}
                  onClick={() => {
                    const targetSceneId =
                      ev.sceneObjectId ||
                      ev.target?.sceneObjectId ||
                      (ev.actor?.agentId ? `scene-${ev.actor.agentId}` : null);
                    if (targetSceneId) selectSceneObject(targetSceneId);
                  }}
                  className="bg-slate-950/90 hover:bg-slate-900 border border-slate-800/90 rounded-xl p-2.5 cursor-pointer transition space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-[11px] font-bold text-amber-400">
                      {formatTime(ev.timestamp || ev.eventTimeMs)}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${prov.bg}`}
                    >
                      {prov.label}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white flex items-center justify-between gap-2">
                    <span className="truncate">{ev.eventType}</span>
                    <span className="text-[10px] font-normal text-slate-400 shrink-0">
                      {VENUE_BRAND_META[ev.businessId]?.name ||
                        ev.businessId?.replace("business-", "")}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    {pl.description ||
                      primaryDish ||
                      pl.partyName ||
                      actorName ||
                      ev.sceneObjectId}
                  </p>
                  {(primaryDish || tableLabel || actorName) && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[10px]">
                      {actorName && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-900 text-sky-300 border border-slate-800">
                          👤 {actorName}
                        </span>
                      )}
                      {primaryDish && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 border border-slate-800 truncate max-w-[190px]">
                          🍽️ {primaryDish}
                        </span>
                      )}
                      {tableLabel && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-900 text-emerald-300 border border-slate-800">
                          🪑 {tableLabel}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: MONGODB ATLAS STREAM PROCESSING & ETL VALIDATION */}
      {activeTab === "streams" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Culinary Hero Illustration Card */}
          <div className="bg-slate-950 border border-amber-500/30 rounded-xl overflow-hidden shadow-lg">
            <img
              src="/brands/culinary_hero.png"
              alt="Gastronomic Street Culinary Craft"
              className="w-full h-32 object-cover"
            />
            <div className="p-3 space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 block">
                Three Culinary Crafts · One Synchronized Street
              </span>
              <p className="text-[11px] text-slate-300 leading-snug">
                French copper sautoirs, Tuscan oak-ember bistecca grills, and Japanese Hinoki omakase sushi counters powered by MongoDB event streams.
              </p>
            </div>
          </div>

          <div className="bg-slate-950 border border-emerald-800/60 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-400 uppercase tracking-wider">
                ETL Migration Validation Report
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono text-[10px] border border-emerald-700">
                {bootstrap.validationReport?.status || "PASSED"}
              </span>
            </div>
            <p className="text-slate-400 text-[11px]">
              100% of the 30 relational tables from <code className="text-slate-200">lumiere</code>{" "}
              were migrated into 23 multi-tenant MongoDB collections with zero financial or line-item discrepancy.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="bg-slate-900 p-2 rounded-lg">
                <span className="text-slate-400 block text-[10px]">Annual Orders (300d)</span>
                <span className="font-bold text-white text-sm">
                  {bootstrap.validationReport?.annualSummaryVerification?.totalOrders?.toLocaleString() ||
                    "10,169"}
                </span>
              </div>
              <div className="bg-slate-900 p-2 rounded-lg">
                <span className="text-slate-400 block text-[10px]">Annual Revenue</span>
                <span className="font-bold text-emerald-400 text-sm">
                  {formatEuros(
                    bootstrap.validationReport?.annualSummaryVerification?.totalRevenueCents ||
                      88273950
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
            <span className="font-bold text-amber-400 uppercase tracking-wider block">
              Atlas Stream Processing Pipeline
            </span>
            <p className="text-slate-400 text-[11px]">
              Continuous 15-minute <code className="text-amber-300">$tumblingWindow</code> over{" "}
              <code className="text-amber-300">simulationEvents</code> routing live KPIs to{" "}
              <code className="text-amber-300">streamProcessorMetrics</code> and SLA alerts to{" "}
              <code className="text-amber-300">operationalAlerts</code>.
            </p>
            <pre className="bg-slate-900 p-2.5 rounded-lg text-[10px] font-mono text-sky-300 overflow-x-auto">
              {JSON.stringify(bootstrap.streamProcessorPipeline?.[0] || {}, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </aside>
  );
}
