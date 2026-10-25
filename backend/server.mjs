import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { URL } from "node:url";
import { MongoOperationalStore } from "./db/mongoStore.mjs";
import { createBusinessSimulation } from "./simulation/businessSimulations.mjs";
import { getAtlasStreamProcessorDefinition, computeStreamMetricsAt } from "./streams/atlasStreamProcessor.mjs";
import { LiveFeed } from "./live/liveFeed.mjs";
import { parisTimeMs } from "./live/parisTime.mjs";

const PORT = Number(process.env.PORT || 4100);
const ASSETS_DIR = "/Users/ag/Workspace/restaurants/homedesign-base/backend/assets";
const DIST_DIR = "/Users/ag/Workspace/restaurants/frontend/dist";
const store = new MongoOperationalStore();
const session = store.getCollection("simulationSessions")[0] || {};
const liveFeed = new LiveFeed(store, session);
// Nothing later than the live feed's latest 15-second batch is visible through any endpoint.
store.releaseCutoffMs = () => liveFeed.releasedUntilMs();

function readDateAndTimestamp(searchParams) {
  const date = searchParams.get("date") || liveFeed.liveDate();
  const tsParam = searchParams.get("timestampMs");
  const tsMs = tsParam ? Number(tsParam) : parisTimeMs(date, 12, 45);
  return { date, tsMs: Math.min(tsMs, liveFeed.releasedUntilMs()) };
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

export function evaluateStreetStateAt(serviceDate, timestampMs) {
  const businesses = store.getCollection("businesses");
  const premisesList = store.getCollection("premises");
  const sceneObjects = store.getCollection("sceneObjects");
  const employees = store.getCollection("employees");
  const products = store.getCollection("products");
  const ingredients = store.getCollection("ingredients");
  const dayStockUnits = store.getStockUnitsForDate(serviceDate);

  timestampMs = Math.min(timestampMs, store.releaseCutoffMs());
  const eventsForDay = store
    .getEventsForDate(serviceDate)
    .filter((e) => e.eventTimeMs <= timestampMs);

  const simByBusiness = {};
  for (const b of businesses) {
    const prem = premisesList.find((p) => p.businessId === b._id);
    simByBusiness[b._id] = createBusinessSimulation(
      b,
      prem,
      sceneObjects,
      employees,
      products,
      ingredients,
      dayStockUnits
    );
  }

  for (const ev of eventsForDay) {
    const sim = simByBusiness[ev.businessId];
    if (sim) sim.applyEvent(ev);
  }

  const businessStates = {};
  const allActiveAgents = [];
  for (const [bid, sim] of Object.entries(simByBusiness)) {
    businessStates[bid] = sim.state;
    for (const ag of Object.values(sim.state.activeAgents)) {
      allActiveAgents.push(ag);
    }
  }

  const streamMetrics = computeStreamMetricsAt(eventsForDay, timestampMs);
  const snapshots = store
    .getCollection("simulationSnapshots")
    .filter((s) => s.serviceDate === serviceDate && s.snapshotTimeMs <= timestampMs);
  const nearestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

  return {
    serviceDate,
    timestampMs,
    timestampIso: new Date(timestampMs).toISOString(),
    nearestSnapshot,
    eventsAppliedCount: eventsForDay.length,
    businessStates,
    activeAgents: allActiveAgents,
    streamMetrics,
    recentStreetEvents: eventsForDay.slice(-35).reverse(),
  };
}

export function inspectSceneObjectAt(sceneObjectId, serviceDate, timestampMs) {
  const cleanId = String(sceneObjectId).replace(/^scene-dish-/, "dish-").replace(/^scene-unit-/, "unit-");
  const streetState = evaluateStreetStateAt(serviceDate, timestampMs);

  // 1. Direct inspection of a discrete DishInstance (`dish-*`)
  if (cleanId.startsWith("dish-")) {
    const dishDoc = store.getDishInstanceById(cleanId);
    if (!dishDoc) {
      return { error: `DishInstance '${cleanId}' not found` };
    }
    const bState = streetState.businessStates[dishDoc.businessId] || {};
    const liveDish = bState.dishInstancesMap?.[cleanId] || {};
    const prodDoc = store.getCollection("products").find((p) => p._id === (dishDoc.itemId || dishDoc.productId)) || null;
    const orderDoc = store.getOrdersForDate(dishDoc.serviceDate || serviceDate).find((o) => o._id === dishDoc.orderId) || null;
    const enrichedUnitsUsed = (dishDoc.ingredientsConsumed || []).map((slice) => {
      const unitDoc = bState.stockUnitsMap?.[slice.unitId] || store.getStockUnitById(slice.unitId) || {};
      return {
        ...slice,
        shelfSlot: unitDoc.shelfSlot || null,
        containerType: unitDoc.containerType || null,
        initialUnitQuantity: unitDoc.initialQuantity,
        currentRemainingQuantityAtTimestamp: unitDoc.remainingQuantity,
        currentUnitStatusAtTimestamp: unitDoc.status,
      };
    });
    const dishContentions = store
      .getContentionLogForDate(dishDoc.serviceDate || serviceDate)
      .filter((c) => c.unitId && enrichedUnitsUsed.some((u) => u.unitId === c.unitId));

    return {
      sceneObject: {
        sceneObjectId: cleanId,
        objectType: "dish_instance",
        label: dishDoc.name || dishDoc.dishName,
        businessId: dishDoc.businessId,
        premisesId: dishDoc.premisesId,
        domainEntityType: "dish_instance",
        domainEntityId: cleanId,
      },
      domainEntity: {
        ...dishDoc,
        recipe: prodDoc?.recipe || [],
        recipeSummary: dishDoc.recipeSummary || prodDoc?.recipeSummary || "",
      },
      runtimeState: {
        status: liveDish.status || dishDoc.status || "SERVED",
        cookName: dishDoc.preparedByName || dishDoc.cookName,
        waiterName: dishDoc.servedByName || dishDoc.waiterName,
        tableId: dishDoc.tableId,
        tableName: dishDoc.tableName,
        cookingStartedAt: dishDoc.cookingStartedAt,
        platedAt: dishDoc.platedAt,
        deliveredAt: dishDoc.deliveredAt,
        eatenCompletedAt: dishDoc.eatenCompletedAt,
      },
      relatedRecords: {
        order: orderDoc,
        product: prodDoc,
        stockUnitsUsed: enrichedUnitsUsed,
        contentionEvents: dishContentions,
      },
    };
  }

  // 2. Direct inspection of a discrete physical StockUnit (`unit-*`)
  if (cleanId.startsWith("unit-")) {
    const unitDoc = store.getStockUnitById(cleanId);
    if (!unitDoc) {
      return { error: `StockUnit '${cleanId}' not found` };
    }
    const bState = streetState.businessStates[unitDoc.businessId] || {};
    const liveUnit = bState.stockUnitsMap?.[cleanId] || unitDoc;
    const unitContentions = store
      .getContentionLogForDate(unitDoc.serviceDate || serviceDate)
      .filter((c) => c.unitId === cleanId);

    return {
      sceneObject: {
        sceneObjectId: cleanId,
        objectType: "stock_unit",
        label: `${unitDoc.ingredientName} (${cleanId})`,
        businessId: unitDoc.businessId,
        premisesId: unitDoc.premisesId,
        domainEntityType: "stock_unit",
        domainEntityId: cleanId,
      },
      domainEntity: unitDoc,
      runtimeState: {
        unitId: cleanId,
        ingredientId: unitDoc.ingredientId,
        ingredientName: unitDoc.ingredientName,
        storageObjectId: unitDoc.storageObjectId,
        shelfSlot: unitDoc.shelfSlot,
        initialQuantity: unitDoc.initialQuantity,
        remainingQuantity: liveUnit.remainingQuantity ?? unitDoc.remainingQuantity,
        unit: unitDoc.unit,
        status: liveUnit.status || unitDoc.status,
        openedAt: liveUnit.openedAt || unitDoc.openedAt,
        exhaustedAt: liveUnit.exhaustedAt || unitDoc.exhaustedAt,
      },
      relatedRecords: {
        depletionHistoryUpToTimestamp: liveUnit.liveDepletionHistory || [],
        fullDayDepletionHistory: (unitDoc.depletionHistory || []).filter(
          (h) => Date.parse(h.timestamp) <= streetState.timestampMs
        ),
        contentionEvents: unitContentions,
      },
    };
  }

  const sceneObjects = store.getCollection("sceneObjects");
  const sceneObj = sceneObjects.find((s) => s.sceneObjectId === sceneObjectId || s._id === sceneObjectId);

  if (!sceneObj) {
    // Check if it's a dynamic customer or employee agent id
    const dynAgent = streetState.activeAgents.find(
      (a) => a.agentId === sceneObjectId || `scene-${a.agentId}` === sceneObjectId || a.employeeId === sceneObjectId
    );
    if (dynAgent) {
      const ord = store.getOrdersForDate(serviceDate).find((o) => o._id === dynAgent.orderId);
      const agentEvents = streetState.recentStreetEvents.filter(
        (e) => e.actor?.agentId === dynAgent.agentId || e.actorId === dynAgent.agentId
      );
      return {
        sceneObject: {
          sceneObjectId,
          objectType: dynAgent.agentKind === "employee" ? "employee_agent" : "customer_agent",
          label: dynAgent.name,
          businessId: dynAgent.businessId,
          domainEntityType: dynAgent.agentKind === "employee" ? "employee" : "customer_party",
          domainEntityId: dynAgent.agentId,
        },
        runtimeState: dynAgent,
        relatedOrder: ord || null,
        recentEvents: agentEvents,
      };
    }
    return { error: `SceneObject '${sceneObjectId}' not found` };
  }

  const bState = streetState.businessStates[sceneObj.businessId] || {};
  const entityType = sceneObj.domainEntityType;
  const entityId = sceneObj.domainEntityId;

  let domainEntity = null;
  let runtimeState = null;
  let relatedRecords = {};

  if (entityType === "table") {
    runtimeState = bState.tables?.[entityId] || null;
    const dayOrders = store
      .getOrdersForDate(serviceDate)
      .filter((o) => o.tableId === entityId);

    const byOrderId = new Map();
    for (const o of dayOrders) {
      byOrderId.set(o._id, { ...o });
    }
    const tableEvents = store
      .getEventsForDate(serviceDate)
      .filter(
        (e) =>
          e.tableId === entityId ||
          e.target?.domainEntityId === entityId ||
          e.payload?.tableId === entityId
      );
    for (const ev of tableEvents) {
      const ordId = ev.orderId || ev.payload?.orderId;
      if (!ordId) continue;
      const existing = byOrderId.get(ordId) || {
        _id: ordId,
        orderNumber: String(ordId).replace(/^ord-/, "").slice(-6).toUpperCase(),
        serviceDate,
        tableId: entityId,
        businessId: sceneObj.businessId,
        items: [],
      };
      const evTime = ev.eventTime || ev.eventTimeIso;
      if (ev.eventType === "PARTY_SEATED") {
        existing.openedAt = existing.openedAt || evTime;
        existing.covers = existing.covers || ev.payload?.partySize || sceneObj.seats || 2;
        existing.partyName = existing.partyName || ev.payload?.partyName || ev.actor?.name;
      } else if (ev.eventType === "ORDER_CREATED") {
        existing.openedAt = existing.openedAt || evTime;
        existing.covers = existing.covers || ev.payload?.covers || sceneObj.seats || 2;
        existing.waiterName = existing.waiterName || ev.payload?.waiterName || ev.actor?.name;
        if (ev.payload?.totalCents && !existing.dueCents) {
          existing.dueCents = ev.payload.totalCents;
        }
        if (Array.isArray(ev.payload?.items) && (!existing.lines || existing.lines.length === 0)) {
          existing.lines = ev.payload.items;
        }
      } else if (ev.eventType === "PAYMENT_COMPLETED") {
        existing.closedAt = existing.closedAt || evTime;
        if (ev.payload?.paidCents || ev.payload?.amountCents) {
          existing.paidCents = ev.payload.paidCents || ev.payload.amountCents;
          existing.dueCents = existing.dueCents || existing.paidCents;
        }
      }
      const parsedMs = Date.parse(existing.openedAt);
      const hr = !Number.isNaN(parsedMs) ? new Date(parsedMs).getHours() : 12;
      existing.shiftName = existing.shiftName || (hr < 16 ? "DÉJEUNER" : "DÎNER");
      byOrderId.set(ordId, existing);
    }

    const mergedDayOrders = Array.from(byOrderId.values()).sort((a, b) =>
      String(a.openedAt || "").localeCompare(String(b.openedAt || ""))
    );
    const activeOrder = mergedDayOrders.find((o) => o._id === runtimeState?.activeOrderId) || null;
    const tableDishInstances = store
      .getDishInstancesForDate(serviceDate)
      .filter((d) => d.tableId === entityId && (!activeOrder || d.orderId === activeOrder._id));
    const dayReservations = store
      .getReservationsForDate(serviceDate)
      .filter((r) => (r.tableIds || []).includes(entityId));
    domainEntity = {
      tableId: entityId,
      label: sceneObj.label,
      seats: sceneObj.seats,
      shape: sceneObj.shape,
      areaId: sceneObj.areaId,
      modelId: sceneObj.modelId,
    };
    relatedRecords = {
      activeOrder,
      servedDishInstances: tableDishInstances,
      historicalOrdersToday: mergedDayOrders,
      reservationsToday: dayReservations,
    };
  } else if (entityType === "station" || entityType === "storage" || entityType === "pos_terminal") {
    runtimeState = bState.stations?.[entityId] || null;
    const stationEvents = streetState.recentStreetEvents.filter(
      (e) =>
        e.target?.sceneObjectId === sceneObj.sceneObjectId ||
        e.target?.domainEntityId === entityId ||
        e.stationId === entityId
    );
    const relevantIngredients = store
      .getCollection("ingredients")
      .filter((i) => i.businessId === sceneObj.businessId)
      .slice(0, 20);
    const dayMovements = store
      .getInventoryMovementsForDate(serviceDate)
      .filter((m) => m.businessId === sceneObj.businessId && (!m.storageObjectId || m.storageObjectId === entityId))
      .slice(0, 35);

    // Discrete StockUnits on the shelves of this storage/bar/station
    const allLiveUnits = Object.values(bState.stockUnitsMap || {});
    const shelfStockUnits = allLiveUnits.filter(
      (u) =>
        u.storageObjectId === entityId ||
        u.sceneObjectId === sceneObj.sceneObjectId ||
        (sceneObj.stationKind === "cold_storage" && u.storageObjectId?.includes("cold")) ||
        (sceneObj.stationKind === "bar" && u.storageObjectId?.includes("bar"))
    );
    const contentionEvents = store
      .getContentionLogForDate(serviceDate)
      .filter(
        (c) =>
          c.businessId === sceneObj.businessId &&
          (c.storageObjectId === entityId || c.sceneObjectId === sceneObj.sceneObjectId)
      )
      .slice(0, 40);

    domainEntity = {
      stationId: entityId,
      label: sceneObj.label,
      stationKind: sceneObj.stationKind,
      modelId: sceneObj.modelId,
      assetLotId: sceneObj.assetLotId,
    };
    relatedRecords = {
      activeTasks: runtimeState?.activeTasks || [],
      shelfStockUnits,
      contentionEvents,
      barmanState: sceneObj.stationKind === "bar" ? bState.barmanState : undefined,
      recentStationEvents: stationEvents,
      inventoryItems: relevantIngredients,
      recentInventoryMovements: dayMovements,
    };
  } else if (entityType === "employee") {
    domainEntity = store.getCollection("employees").find((e) => e._id === entityId) || null;
    runtimeState = streetState.activeAgents.find((a) => a.employeeId === entityId || a.agentId === sceneObj.agentId) || {
      status: "OFF_DUTY",
      currentTask: "Hors service à cette heure",
    };
    const shiftsToday = store.getCollection("shifts").filter((s) => s.employeeId === entityId && s.date === serviceDate);
    const payrollHistory = store.getCollection("payrollRecords").filter((p) => p.employeeId === entityId);
    const recentAgentEvents = streetState.recentStreetEvents.filter(
      (e) => e.actor?.employeeId === entityId || e.actor?.agentId === sceneObj.agentId
    );
    relatedRecords = { shiftsToday, payrollHistory, recentAgentEvents };
  } else if (entityType === "business") {
    domainEntity = store.getCollection("businesses").find((b) => b._id === entityId) || null;
    runtimeState = bState.metrics || null;
    relatedRecords = {
      employees: store.getCollection("employees").filter((e) => e.businessId === entityId),
      products: store.getCollection("products").filter((p) => p.businessId === entityId),
      suppliers: store.getCollection("suppliers").filter((s) => s.businessId === entityId),
      barmanState: bState.barmanState,
    };
  }

  return {
    sceneObject: sceneObj,
    domainEntity,
    runtimeState,
    relatedRecords,
    domainDetails: {
      ordersToday: relatedRecords.historicalOrdersToday || [],
      servedDishInstances: relatedRecords.servedDishInstances || [],
      reservationsToday: relatedRecords.reservationsToday || [],
      shelfStockUnits: relatedRecords.shelfStockUnits || [],
      contentionEvents: relatedRecords.contentionEvents || [],
      inventorySnapshot: relatedRecords.inventoryItems || [],
      recentInventoryMovements: relatedRecords.recentInventoryMovements || [],
      shiftsToday: relatedRecords.shiftsToday || [],
      payrollHistory: relatedRecords.payrollHistory || [],
    },
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsedUrl.pathname;

  // Serve 3D .glb assets from homedesign-base/backend/assets
  if (pathname.startsWith("/assets/") && pathname.endsWith(".glb")) {
    const fileName = path.basename(pathname);
    const assetPath = path.join(ASSETS_DIR, fileName);
    if (fs.existsSync(assetPath)) {
      res.writeHead(200, {
        "Content-Type": "model/gltf-binary",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400",
      });
      return fs.createReadStream(assetPath).pipe(res);
    }
    res.writeHead(404);
    return res.end("Asset not found");
  }

  if (pathname === "/api/live/stream" && req.method === "GET") {
    return liveFeed.handleStream(req, res);
  }

  if (pathname === "/api/live/status" && req.method === "GET") {
    return sendJson(res, 200, { ...liveFeed.status(), monthCalendar: liveFeed.calendar() });
  }

  if (pathname === "/api/bootstrap" && req.method === "GET") {
    const monthCalendar = liveFeed.calendar();
    return sendJson(res, 200, {
      street: store.getCollection("streets")[0],
      businesses: store.getCollection("businesses"),
      premises: store.getCollection("premises"),
      floorPlans: store.getCollection("floorPlans"),
      sceneObjects: store.getCollection("sceneObjects"),
      agentDefinitions: store.getCollection("agentDefinitions"),
      employees: store.getCollection("employees"),
      suppliers: store.getCollection("suppliers"),
      ingredients: store.getCollection("ingredients"),
      products: store.getCollection("products"),
      expenses: store.getCollection("expenses").slice(0, 60),
      payrollRecords: store.getCollection("payrollRecords").slice(0, 50),
      productionBatches: store.getCollection("productionBatches").slice(0, 60),
      simulationSession: session,
      dailySummaries: monthCalendar.filter((d) => d.state !== "upcoming").map((d) => store.getDaySummary(d.date)),
      monthCalendar,
      liveFeed: liveFeed.status(),
      validationReport: store.validationReport,
      atlasStatus: store.atlasStatus,
      atlasStreamProcessor: getAtlasStreamProcessorDefinition(),
      streamProcessorPipeline: getAtlasStreamProcessorDefinition().pipeline,
    });
  }

  if (pathname === "/api/simulation/day-bundle" && req.method === "GET") {
    const date = parsedUrl.searchParams.get("date") || liveFeed.liveDate();
    const bundle = store.getDayBundle(date);
    return sendJson(res, 200, bundle);
  }

  if (pathname === "/api/simulation/state" && req.method === "GET") {
    const { date, tsMs } = readDateAndTimestamp(parsedUrl.searchParams);
    const state = evaluateStreetStateAt(date, tsMs);
    return sendJson(res, 200, state);
  }

  if (pathname.startsWith("/api/inspect/") && req.method === "GET") {
    const sceneObjectId = decodeURIComponent(pathname.replace("/api/inspect/", ""));
    const { date, tsMs } = readDateAndTimestamp(parsedUrl.searchParams);
    const result = inspectSceneObjectAt(sceneObjectId, date, tsMs);
    return sendJson(res, 200, result);
  }

  if (pathname.startsWith("/api/lineage/dish/") && req.method === "GET") {
    const dishId = decodeURIComponent(pathname.replace("/api/lineage/dish/", ""));
    const { date, tsMs } = readDateAndTimestamp(parsedUrl.searchParams);
    return sendJson(res, 200, inspectSceneObjectAt(dishId, date, tsMs));
  }

  if (pathname.startsWith("/api/lineage/unit/") && req.method === "GET") {
    const unitId = decodeURIComponent(pathname.replace("/api/lineage/unit/", ""));
    const { date, tsMs } = readDateAndTimestamp(parsedUrl.searchParams);
    return sendJson(res, 200, inspectSceneObjectAt(unitId, date, tsMs));
  }

  // Serve built frontend static files from frontend/dist
  if (fs.existsSync(DIST_DIR)) {
    const safeRel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const candidate = path.join(DIST_DIR, safeRel);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      const ext = path.extname(candidate).toLowerCase();
      const mimeMap = {
        ".html": "text/html; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".svg": "image/svg+xml",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
      };
      res.writeHead(200, { "Content-Type": mimeMap[ext] || "application/octet-stream" });
      return fs.createReadStream(candidate).pipe(res);
    }
  }

  return sendJson(res, 404, { error: "Not found", path: pathname });
});

if (process.env.NODE_ENV !== "test") {
  liveFeed.start();
  server.listen(PORT, () => {
    console.log(`Multi-Venue 3D Hospitality Street Simulation API listening on http://localhost:${PORT}`);
  });
}
