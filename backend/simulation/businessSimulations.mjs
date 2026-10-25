/**
 * Polymorphic Business-Type Simulation Architecture & Street Coordinator
 *
 * Implements Section 5, 6, 7, 9, 10 & 14 of the Technical Specification:
 *   interface BusinessSimulation {
 *     initialize(context): Promise<void>;
 *     getInitialState(): BusinessState;
 *     applyEvent(event): void;
 *     getAvailableTasks(): SimulationTask[];
 *     getNavigationDestinations(): NavigationDestination[];
 *     getVisualConfiguration(): BusinessVisualConfig;
 *   }
 *
 * Enhanced with full Physical StockUnit FIFO Lineage, Multi-Cook Resource Contention
 * (`150g -> 120g -> 90g`), Single-Bottle Barman Constraint (`heldBottleCount <= 1`),
 * and Causal Dining Lifecycle tracking across all 3 restaurants.
 */

export class BaseBusinessSimulation {
  constructor(
    businessDoc,
    premisesDoc,
    sceneObjects,
    employees,
    products,
    ingredients,
    initialStockUnits = []
  ) {
    this.business = businessDoc;
    this.premises = premisesDoc;
    this.sceneObjects = sceneObjects.filter((s) => s.businessId === businessDoc._id);
    this.employees = employees.filter((e) => e.businessId === businessDoc._id);
    this.products = products.filter((p) => p.businessId === businessDoc._id);
    this.ingredients = ingredients.filter((i) => i.businessId === businessDoc._id);
    this.initialStockUnits = initialStockUnits.filter((u) => u.businessId === businessDoc._id);
    this.state = this.getInitialState();
  }

  async initialize(context = {}) {
    this.context = context;
    this.state = this.getInitialState();
  }

  getInitialState() {
    const stations = {};
    const tables = {};
    const storageState = {};
    const stockUnitsMap = {};

    for (const u of this.initialStockUnits) {
      const uid = u.unitId || u._id;
      stockUnitsMap[uid] = {
        ...u,
        _id: uid,
        unitId: uid,
        initialQuantity: Number(u.initialQuantity ?? u.remainingQuantity ?? 0),
        remainingQuantity: Number(u.initialQuantity ?? u.remainingQuantity ?? 0),
        status: "SEALED",
        openedAt: null,
        exhaustedAt: null,
        liveDepletionHistory: [],
      };
    }

    for (const obj of this.sceneObjects) {
      if (obj.domainEntityType === "table") {
        tables[obj.domainEntityId] = {
          tableId: obj.domainEntityId,
          sceneObjectId: obj.sceneObjectId,
          label: obj.label,
          tableLabel: obj.tableLabel || obj.label,
          seats: obj.seats || 2,
          status: "AVAILABLE",
          partyName: null,
          partySize: 0,
          activeOrderId: null,
          currentCourse: 0,
          waiterName: null,
          servedDishes: [],
          updatedAt: null,
          transform: obj.transform,
        };
      } else if (
        obj.domainEntityType === "station" ||
        obj.domainEntityType === "storage" ||
        obj.domainEntityType === "pos_terminal"
      ) {
        const stUnits = Object.values(stockUnitsMap).filter(
          (u) => u.storageObjectId === obj.domainEntityId || u.sceneObjectId === obj.sceneObjectId
        );
        stations[obj.domainEntityId] = {
          stationId: obj.domainEntityId,
          sceneObjectId: obj.sceneObjectId,
          label: obj.label,
          objectType: obj.objectType,
          stationKind: obj.stationKind,
          equipmentStyle: obj.equipmentStyle || null,
          status: "IDLE",
          doorOpen: false,
          doorOpenedBy: null,
          activeContention: null,
          activeTasks: [],
          completedCount: 0,
          stockUnitCount: stUnits.length,
          lastEventAt: null,
          transform: obj.transform,
        };
        if (obj.domainEntityType === "storage" || obj.stationKind === "cold_storage" || obj.stationKind === "bar") {
          storageState[obj.domainEntityId] = {
            storageObjectId: obj.domainEntityId,
            sceneObjectId: obj.sceneObjectId,
            label: obj.label,
            doorOpen: false,
            doorOpenedBy: null,
            activeContention: null,
            contentionHistory: [],
            unitIds: stUnits.map((u) => u.unitId),
          };
        }
      }
    }

    return {
      businessId: this.business._id,
      businessName: this.business.name,
      businessType: this.business.businessType,
      specialty: this.business.specialty || null,
      operatingStatus: "CLOSED",
      metrics: {
        revenueCents: 0,
        tipCents: 0,
        activeOrders: 0,
        completedOrders: 0,
        activeCovers: 0,
        totalCoversServed: 0,
        queueDepth: 0,
        deliveriesReceived: 0,
        batchesProduced: 0,
        stockDepletionsCount: 0,
        contentionEventsCount: 0,
        barPoursCount: 0,
      },
      tables,
      stations,
      storageState,
      stockUnitsMap,
      dishInstancesMap: {},
      contentionLog: [],
      barmanState: {
        heldBottleIds: [],
        heldBottleCount: 0,
        maxSimultaneousBottlesHeld: 1,
        singleBottleRuleEnforced: true,
        lastBottleUnitId: null,
        poursCompleted: 0,
      },
      activeOrdersMap: {},
      activeAgents: {},
      recentEvents: [],
    };
  }

  findStationByKind(kind, fallbackId) {
    if (fallbackId && this.state.stations[fallbackId]) {
      return this.state.stations[fallbackId];
    }
    return Object.values(this.state.stations).find((st) => st.stationKind === kind) || null;
  }

  getNavigationDestinations() {
    const nodes = this.premises?.navigationGraph?.nodes || this.premises?.navigationNodes || [];
    return nodes.map((n) => ({
      id: n.id,
      x: n.x,
      z: n.z,
      zone: n.zone,
    }));
  }

  getAvailableTasks() {
    const tasks = [];
    for (const st of Object.values(this.state.stations)) {
      for (const t of st.activeTasks) {
        tasks.push({ ...t, stationId: st.stationId, stationLabel: st.label });
      }
    }
    return tasks;
  }

  getVisualConfiguration() {
    return {
      businessId: this.business._id,
      businessType: this.business.businessType,
      specialty: this.business.specialty,
      bounds: this.premises?.bounds,
      zones: this.premises?.zones || [],
      entrances: this.premises?.entrances || [],
      navigationGraph: this.premises?.navigationGraph || null,
    };
  }
}

/**
 * 1. FullServiceRestaurantSimulation
 * Supports multiple specialty full-service restaurants:
 *   - Bistrot Lumière (French Brasserie & Cuisine Niçoise)
 *   - Osteria Bellavista (Authentic Italian Trattoria & Tuscan Wood-Fired Grill)
 *   - Sakana-Tei 魚亭 (Japanese Omakase Sushi & Binchotan Charcoal Robatayaki)
 */
export class FullServiceRestaurantSimulation extends BaseBusinessSimulation {
  constructor(...args) {
    super(...args);
  }

  _ensureActorAgent(ev) {
    const s = this.state;
    const aid = ev.actor?.agentId || ev.actorId;
    if (!aid) return null;
    if (!s.activeAgents[aid] && String(aid).startsWith("agent-emp-")) {
      const emp = this.employees.find((e) => e.agentId === aid || e._id === ev.actor?.employeeId);
      const home = emp?.homeCoords || ev.payload?.homeCoords || ev.location || { x: 10, z: 6 };
      s.activeAgents[aid] = {
        agentId: aid,
        employeeId: emp?._id || ev.actor?.employeeId || aid.replace(/^agent-/, ""),
        name: emp?.name || ev.actor?.name || ev.actorName || "Membre d'équipe",
        role: emp?.role || ev.actor?.role || ev.actorRole || "Cuisine",
        jobTitle: emp?.jobTitle || ev.actor?.jobTitle || ev.actorRole || "En poste",
        agentKind: "employee",
        businessId: this.business._id,
        status: "ON_DUTY",
        currentTask: "En poste",
        x: home.x,
        z: home.z,
        targetX: home.x,
        targetZ: home.z,
        homeCoords: home,
        heldBottleIds: [],
        heldBottleCount: 0,
        lastMoveMs: ev.eventTimeMs || 0,
      };
    }
    const ag = s.activeAgents[aid];
    if (ag) {
      const dlg = ev.dialogue || ev.payload?.dialogue;
      if (dlg) {
        ag.speechBubble = dlg;
        ag.dialogue = dlg;
        ag.tone = ev.tone || ev.payload?.tone || "NEUTRAL";
        ag.lastSpeechMs = ev.eventTimeMs;
      }
    }
    return ag;
  }

  applyEvent(ev) {
    const s = this.state;
    const pl = ev.payload || ev.metadata || {};
    const tIso = ev.eventTime || ev.timestamp;
    const evType = ev.eventType || ev.type;

    s.recentEvents.push(ev);
    if (s.recentEvents.length > 35) s.recentEvents.shift();

    const actorAgent = this._ensureActorAgent(ev);

    switch (evType) {
      case "STOCK_DELIVERY_RECEIVED": {
        s.metrics.deliveriesReceived += 1;
        const stId = ev.target?.domainEntityId || ev.stationId;
        const st = this.findStationByKind("cold_storage", stId);
        if (st) {
          st.status = "RECEIVING_STOCK";
          st.completedCount += Number(pl.itemCount || 1);
          st.lastEventAt = tIso;
        }
        break;
      }
      case "EMPLOYEE_SHIFT_START":
      case "STAFF_CLOCK_IN": {
        s.operatingStatus = "OPEN";
        const aid = ev.actor?.agentId || ev.actorId;
        if (aid) {
          const home = pl.homeCoords || ev.location || { x: 10, z: 6 };
          s.activeAgents[aid] = {
            agentId: aid,
            employeeId: ev.actor?.employeeId || aid.replace(/^agent-/, ""),
            name: ev.actor?.name || ev.actorName,
            role: ev.actor?.role || ev.actorRole,
            jobTitle: ev.actor?.jobTitle || ev.actorRole,
            agentKind: "employee",
            businessId: this.business._id,
            status: "ON_DUTY",
            currentTask: "Poste en place",
            speechBubble: ev.dialogue || pl.dialogue || null,
            dialogue: ev.dialogue || pl.dialogue || null,
            tone: ev.tone || pl.tone || "ENERGETIC",
            x: home.x,
            z: home.z,
            targetX: home.x,
            targetZ: home.z,
            homeCoords: home,
            heldBottleIds: [],
            heldBottleCount: 0,
            lastMoveMs: ev.eventTimeMs,
          };
        }
        break;
      }
      case "EMPLOYEE_SHIFT_END":
      case "STAFF_CLOCK_OUT": {
        const aid = ev.actor?.agentId || ev.actorId;
        if (aid) delete s.activeAgents[aid];
        break;
      }
      case "CUSTOMER_ARRIVAL":
      case "CUSTOMER_ARRIVED": {
        const cid = ev.actor?.agentId || ev.actorId;
        if (cid) {
          const entrance = (this.premises?.entrances || [])[0] || { x: 10, z: 15.8 };
          const dest = pl.targetCoords || ev.location || { x: entrance.x, z: entrance.z - 2.2 };
          s.activeAgents[cid] = {
            agentId: cid,
            name: pl.partyName || ev.actor?.name || ev.actorName,
            role: "Customer",
            partySize: Number(pl.partySize || 2),
            guests: pl.guests || [],
            agentKind: "customer",
            businessId: this.business._id,
            orderId: pl.orderId || ev.orderId,
            tableId: ev.target?.tableId || pl.tableId || ev.tableId,
            status: "ARRIVING_AT_HOST",
            currentTask: "Accueil à l'entrée",
            speechBubble: ev.dialogue || pl.dialogue || null,
            dialogue: ev.dialogue || pl.dialogue || null,
            tone: ev.tone || pl.tone || "POLITE",
            x: entrance.x,
            z: entrance.z + 1.4,
            targetX: dest.x,
            targetZ: dest.z,
            lastMoveMs: ev.eventTimeMs,
          };
        }
        break;
      }
      case "PARTY_SEATED":
      case "CUSTOMER_SEATED": {
        const tid = pl.tableId || ev.tableId;
        const cid = pl.customerAgentId || ev.actor?.agentId || ev.actorId;
        const dest = pl.targetCoords || ev.location || { x: 10, z: 6 };
        if (tid && s.tables[tid]) {
          s.tables[tid].status = "SEATED";
          s.tables[tid].partyName = pl.partyName || ev.actor?.name || ev.actorName;
          s.tables[tid].partySize = Number(pl.partySize || 2);
          s.tables[tid].guests = pl.guests || [];
          s.tables[tid].activeOrderId = pl.orderId || ev.orderId;
          s.tables[tid].waiterName = ev.actor?.name || ev.waiterName;
          s.tables[tid].servedDishes = [];
          s.tables[tid].updatedAt = tIso;
        }
        if (cid && s.activeAgents[cid]) {
          s.activeAgents[cid].status = "SEATED";
          s.activeAgents[cid].tableId = tid;
          s.activeAgents[cid].currentTask = `À table (${pl.tableLabel || pl.tableName || tid || "Salle"})`;
          s.activeAgents[cid].x = dest.x;
          s.activeAgents[cid].z = dest.z;
          s.activeAgents[cid].targetX = dest.x;
          s.activeAgents[cid].targetZ = dest.z;
        }
        const waiterAid = ev.waiterId || ev.actor?.agentId;
        if (waiterAid && s.activeAgents[waiterAid]) {
          s.activeAgents[waiterAid].currentTask = `Placement ${pl.partyName || ""} (${pl.tableLabel || tid})`;
          s.activeAgents[waiterAid].targetX = dest.x + 0.65;
          s.activeAgents[waiterAid].targetZ = dest.z + 0.55;
          s.activeAgents[waiterAid].lastMoveMs = ev.eventTimeMs;
        }
        s.metrics.activeCovers += Number(pl.partySize || 2);
        s.metrics.totalCoversServed += Number(pl.partySize || 2);
        break;
      }
      case "WATER_AND_BREAD_SERVED":
      case "ORDER_TAKEN_AT_TABLE": {
        const tid = pl.tableId || ev.tableId;
        const dest = pl.targetCoords || ev.location || (tid && s.tables[tid]?.transform) || { x: 10, z: 6 };
        if (tid && s.tables[tid]) {
          s.tables[tid].status = evType === "WATER_AND_BREAD_SERVED" ? "WATER_SERVED" : "ORDER_TAKEN";
          s.tables[tid].updatedAt = tIso;
        }
        if (actorAgent) {
          actorAgent.status = "SERVING_TABLE";
          actorAgent.currentTask =
            evType === "WATER_AND_BREAD_SERVED"
              ? `Service carafe d'eau & pain (${pl.tableName || tid})`
              : `Prise de commande (${pl.tableName || tid})`;
          actorAgent.targetX = dest.x + 0.55;
          actorAgent.targetZ = dest.z + 0.55;
          actorAgent.lastMoveMs = ev.eventTimeMs;
        }
        break;
      }
      case "ORDER_CREATED":
      case "ORDER_ENTERED_AT_POS": {
        const ordId = pl.orderId || ev.orderId;
        s.metrics.activeOrders += 1;
        s.activeOrdersMap[ordId] = {
          orderId: ordId,
          orderNumber: pl.orderNumber || String(ordId).slice(-3),
          tableId: pl.tableId || ev.tableId,
          tableLabel: pl.tableLabel || pl.tableName || ev.tableId,
          covers: pl.covers || 2,
          waiterName: pl.waiterName || ev.actor?.name || ev.actorName,
          status: "OPEN",
          currentCourse: 1,
          openedAt: tIso,
          items: [...(pl.items || [])],
        };
        break;
      }
      case "ORDER_LINES_SENT_TO_STATION":
      case "KITCHEN_TICKET_RECEIVED": {
        const stId = ev.target?.domainEntityId || ev.stationId;
        const st = (stId && s.stations[stId]) || this.findStationByKind("hot_kitchen");
        const tableLabel =
          pl.tableLabel || pl.tableName || (pl.tableId && s.tables[pl.tableId]?.label) || pl.tableId || "Salle";
        if (st) {
          st.status = "QUEUED";
          st.lastEventAt = tIso;
          for (const [idx, item] of (pl.items || []).entries()) {
            const dishName = item.name || item.dishName || item.label || "Plat Signature";
            st.activeTasks.push({
              taskId: item.dishInstanceId || item.dishId || `${pl.orderId}-c${pl.course || 1}-${idx}`,
              dishInstanceId: item.dishInstanceId || item.dishId || null,
              orderId: pl.orderId || ev.orderId,
              tableId: pl.tableId || ev.tableId,
              tableLabel,
              course: pl.course || 1,
              dishName,
              label: dishName,
              category: item.category || "Cuisine",
              qty: Number(item.qty || 1),
              prepMinutes: Number(item.prepMinutes || 10),
              visualAsset: item.visualAsset || "copper_saute_pan",
              recipeSummary: item.recipeSummary || "Préparation minute aux produits frais",
              ingredientsConsumed: item.ingredientsConsumed || [],
              chefName: pl.chefName || "Brigade Cuisine",
              status: "QUEUED",
              sentAt: tIso,
            });
          }
        }
        break;
      }
      case "OPEN_STORAGE_DOOR": {
        const stId = ev.target?.domainEntityId || ev.stationId;
        const st = (stId && s.stations[stId]) || this.findStationByKind("cold_storage", stId);
        if (st) {
          st.doorOpen = true;
          st.doorOpenedBy = ev.actor?.name || ev.actorName;
          st.status = "DOOR_OPEN";
          st.lastEventAt = tIso;
        }
        if (stId && s.storageState[stId]) {
          s.storageState[stId].doorOpen = true;
          s.storageState[stId].doorOpenedBy = ev.actor?.name || ev.actorName;
        }
        if (actorAgent) {
          const dest = ev.location || st?.transform || { x: 2.0, z: -3.2 };
          actorAgent.status = "FETCHING_INGREDIENTS";
          actorAgent.currentTask = `Chambre froide: ${pl.dishName || "Prélèvement ingrédients"}`;
          actorAgent.targetX = dest.x;
          actorAgent.targetZ = dest.z + 0.6;
          actorAgent.lastMoveMs = ev.eventTimeMs;
        }
        break;
      }
      case "RESOURCE_CONTENTION_WAIT": {
        const stId = pl.storageObjectId || ev.target?.domainEntityId || ev.stationId;
        const st = (stId && s.stations[stId]) || this.findStationByKind("cold_storage", stId);
        const contentionEntry = {
          contentionId: pl.contentionId || ev._id,
          timestamp: tIso,
          storageObjectId: stId,
          ingredientId: pl.ingredientId,
          ingredientName: pl.ingredientName,
          unitId: pl.unitId,
          primaryActorId: pl.primaryActorId,
          primaryActorName: pl.primaryActorName,
          waitingActorId: pl.waitingActorId || ev.actor?.agentId,
          waitingActorName: pl.waitingActorName || ev.actor?.name,
          beforeQuantity: pl.beforeQuantity,
          deductedQuantity: pl.deductedQuantity,
          afterQuantity: pl.afterQuantity,
          primaryBeforeQuantity: pl.primaryBeforeQuantity,
          primaryAfterQuantity: pl.primaryAfterQuantity,
          waitingAfterQuantity: pl.waitingAfterQuantity ?? pl.afterQuantity,
          unit: pl.unit || "g",
          waitDurationSeconds: pl.waitDurationSeconds || 6,
          summary: pl.summary || ev.dialogue,
        };
        s.contentionLog.push(contentionEntry);
        s.metrics.contentionEventsCount += 1;
        if (st) {
          st.activeContention = contentionEntry;
          st.status = "CONTENTION_WAIT";
          st.lastEventAt = tIso;
        }
        if (stId && s.storageState[stId]) {
          s.storageState[stId].activeContention = contentionEntry;
          s.storageState[stId].contentionHistory.push(contentionEntry);
        }
        if (actorAgent) {
          actorAgent.status = "WAITING_CONTENTION";
          actorAgent.currentTask = `Attente ${pl.primaryActorName || "collègue"} (${pl.ingredientName || "Frigo"})`;
        }
        break;
      }
      case "INGREDIENT_CONTENTION_RESOLVED": {
        const stId = pl.storageObjectId || ev.target?.domainEntityId || ev.stationId;
        const st = (stId && s.stations[stId]) || this.findStationByKind("cold_storage", stId);
        if (st) {
          st.activeContention = null;
          st.status = "DOOR_OPEN";
          st.lastEventAt = tIso;
        }
        if (stId && s.storageState[stId]) {
          s.storageState[stId].activeContention = null;
        }
        if (actorAgent) {
          actorAgent.status = "FETCHING_INGREDIENTS";
          actorAgent.currentTask = `Prélèvement ${pl.ingredientName || "ingrédient"} (${pl.beforeQuantity}${pl.unit || "g"} → ${pl.afterQuantity}${pl.unit || "g"})`;
        }
        break;
      }
      case "STOCK_UNIT_DEPLETED": {
        const uid = pl.unitId;
        s.metrics.stockDepletionsCount += 1;
        if (uid) {
          if (!s.stockUnitsMap[uid]) {
            s.stockUnitsMap[uid] = {
              _id: uid,
              unitId: uid,
              businessId: this.business._id,
              ingredientId: pl.ingredientId,
              ingredientName: pl.ingredientName,
              storageObjectId: pl.storageObjectId || ev.stationId,
              sceneObjectId: pl.sceneObjectId || ev.target?.sceneObjectId,
              initialQuantity: Number(pl.beforeQuantity ?? 150),
              remainingQuantity: Number(pl.remainingAfter ?? 0),
              unit: pl.unit || "g",
              status: Number(pl.remainingAfter ?? 0) <= 0 ? "CONSUMED" : "PARTIAL",
              openedAt: tIso,
              exhaustedAt: Number(pl.remainingAfter ?? 0) <= 0 ? tIso : null,
              liveDepletionHistory: [],
            };
          } else {
            const unitDoc = s.stockUnitsMap[uid];
            unitDoc.remainingQuantity = Number(pl.remainingAfter ?? unitDoc.remainingQuantity);
            unitDoc.openedAt = unitDoc.openedAt || tIso;
            unitDoc.status = unitDoc.remainingQuantity <= 0 ? "CONSUMED" : "PARTIAL";
            if (unitDoc.remainingQuantity <= 0) {
              unitDoc.exhaustedAt = unitDoc.exhaustedAt || tIso;
            }
          }
          s.stockUnitsMap[uid].liveDepletionHistory.push({
            timestamp: tIso,
            actorId: ev.actor?.agentId || ev.actorId,
            actorName: ev.actor?.name || ev.actorName,
            orderId: ev.orderId || pl.orderId,
            dishId: ev.dishId || pl.dishId,
            deducted: Number(pl.quantity ?? pl.deducted ?? 0),
            beforeQuantity: Number(pl.beforeQuantity ?? 0),
            remainingAfter: Number(pl.remainingAfter ?? 0),
            unit: pl.unit || "g",
          });
        }
        break;
      }
      case "CLOSE_STORAGE_DOOR": {
        const stId = ev.target?.domainEntityId || ev.stationId;
        const st = (stId && s.stations[stId]) || this.findStationByKind("cold_storage", stId);
        if (st) {
          st.doorOpen = false;
          st.doorOpenedBy = null;
          st.status = st.activeTasks.length > 0 ? "COOKING" : "IDLE";
          st.lastEventAt = tIso;
        }
        if (stId && s.storageState[stId]) {
          s.storageState[stId].doorOpen = false;
          s.storageState[stId].doorOpenedBy = null;
        }
        break;
      }
      case "BARMAN_BOTTLE_PICKED": {
        const bottleId = pl.unitId;
        // Enforce strict single-bottle barman rule (never > 1 bottle held simultaneously)
        s.barmanState.heldBottleIds = bottleId ? [bottleId] : [];
        s.barmanState.heldBottleCount = s.barmanState.heldBottleIds.length;
        s.barmanState.singleBottleRuleEnforced = true;
        s.barmanState.lastBottleUnitId = bottleId || null;

        const barSt = this.findStationByKind("bar", ev.stationId || ev.target?.domainEntityId);
        if (barSt) {
          barSt.status = "POURING_DRINK";
          barSt.lastEventAt = tIso;
        }
        if (actorAgent) {
          actorAgent.status = "POURING_DRINK";
          actorAgent.heldBottleIds = s.barmanState.heldBottleIds;
          actorAgent.heldBottleCount = s.barmanState.heldBottleCount;
          actorAgent.currentTask = `Bouteille en main: ${bottleId} (1 max)`;
        }
        break;
      }
      case "BARMAN_DRINK_POURED": {
        const bottleId = pl.unitId;
        s.barmanState.poursCompleted += 1;
        s.metrics.barPoursCount += 1;
        if (bottleId && s.stockUnitsMap[bottleId]) {
          const u = s.stockUnitsMap[bottleId];
          u.remainingQuantity = Number(pl.remainingAfter ?? u.remainingQuantity);
          u.openedAt = u.openedAt || tIso;
          u.status = u.remainingQuantity <= 0 ? "CONSUMED" : "PARTIAL";
          u.liveDepletionHistory.push({
            timestamp: tIso,
            actorId: ev.actor?.agentId || ev.actorId,
            actorName: ev.actor?.name || ev.actorName,
            orderId: ev.orderId || pl.orderId,
            dishId: ev.dishId || pl.dishId,
            deducted: Number(pl.deducted ?? 0),
            beforeQuantity: Number(pl.beforeQuantity ?? 0),
            remainingAfter: Number(pl.remainingAfter ?? 0),
            unit: pl.unit || "ml",
          });
        }
        const did = ev.dishId || pl.dishId;
        if (did) {
          s.dishInstancesMap[did] = {
            ...(s.dishInstancesMap[did] || {}),
            dishInstanceId: did,
            dishId: did,
            orderId: ev.orderId || pl.orderId,
            tableId: ev.tableId || pl.tableId,
            status: "POURED_AT_BAR",
            preparedBy: ev.actor?.agentId || ev.actorId,
            preparedByName: ev.actor?.name || ev.actorName,
            sourceBottleUnitId: bottleId,
            pouredAt: tIso,
          };
        }
        break;
      }
      case "BARMAN_BOTTLE_RETURNED": {
        s.barmanState.heldBottleIds = [];
        s.barmanState.heldBottleCount = 0;
        const barSt = this.findStationByKind("bar", ev.stationId || ev.target?.domainEntityId);
        if (barSt) {
          barSt.status = "IDLE";
          barSt.completedCount += 1;
          barSt.lastEventAt = tIso;
        }
        if (actorAgent) {
          actorAgent.status = "ON_DUTY";
          actorAgent.heldBottleIds = [];
          actorAgent.heldBottleCount = 0;
          actorAgent.currentTask = `Bouteille ${pl.unitId || ""} reposée sur étagère`;
        }
        break;
      }
      case "DRINK_SERVED_AT_TABLE": {
        const tid = ev.tableId || pl.tableId;
        const did = ev.dishId || pl.dishId;
        if (tid && s.tables[tid]) {
          s.tables[tid].servedDishes.push({
            dishInstanceId: did,
            dishId: did,
            dishName: pl.itemName || "Boisson",
            category: "DRINK",
            qty: 1,
            sourceBottleUnitId: pl.sourceBottleUnitId,
            visualAsset: "wine_glasses_carafe",
            servedAt: tIso,
          });
          s.tables[tid].updatedAt = tIso;
        }
        if (did && s.dishInstancesMap[did]) {
          s.dishInstancesMap[did].status = "SERVED_ON_TABLE";
          s.dishInstancesMap[did].deliveredAt = tIso;
        }
        break;
      }
      case "ITEM_PREP_STARTED":
      case "COOKING_STARTED": {
        const stId = ev.target?.domainEntityId || ev.stationId;
        const st = (stId && s.stations[stId]) || this.findStationByKind("hot_kitchen");
        const chefName = ev.actor?.name || ev.actorName || pl.chefName || "Chef de Partie";
        const did = ev.dishId || pl.dishId;
        if (did) {
          s.dishInstancesMap[did] = {
            ...(s.dishInstancesMap[did] || {}),
            dishInstanceId: did,
            dishId: did,
            orderId: pl.orderId || ev.orderId,
            tableId: pl.tableId || ev.tableId,
            dishName: pl.dishName || (pl.items || [])[0]?.name || "Plat",
            stationId: stId,
            cookId: ev.actor?.agentId || ev.actorId,
            cookName: chefName,
            ingredientsConsumed: pl.ingredientsConsumed || (pl.items || [])[0]?.ingredientsConsumed || [],
            status: "COOKING",
            prepStartedAt: tIso,
          };
        }
        if (st) {
          st.status = "COOKING";
          st.lastEventAt = tIso;
          let matched = false;
          for (const tk of st.activeTasks) {
            if (
              (did && tk.dishInstanceId === did) ||
              (tk.orderId === (pl.orderId || ev.orderId) && tk.course === (pl.course || 2))
            ) {
              tk.status = "COOKING";
              tk.chefName = chefName;
              tk.startedAt = tIso;
              matched = true;
            }
          }
          if (!matched) {
            const itemsToAdd =
              (pl.items || []).length > 0
                ? pl.items
                : [{ dishInstanceId: did, name: pl.dishName || "Plat", ingredientsConsumed: pl.ingredientsConsumed || [] }];
            const tableLabel =
              pl.tableLabel || pl.tableName || (pl.tableId && s.tables[pl.tableId]?.label) || pl.tableId || "Salle";
            for (const [idx, item] of itemsToAdd.entries()) {
              const dishName = item.name || item.dishName || item.label || pl.dishName || "Plat Signature";
              st.activeTasks.push({
                taskId: item.dishInstanceId || did || `${pl.orderId}-c${pl.course || 2}-${idx}`,
                dishInstanceId: item.dishInstanceId || did || null,
                orderId: pl.orderId || ev.orderId,
                tableId: pl.tableId || ev.tableId,
                tableLabel,
                course: pl.course || 2,
                dishName,
                label: dishName,
                category: item.category || "Cuisine",
                qty: Number(item.qty || 1),
                prepMinutes: Number(item.prepMinutes || 10),
                visualAsset: item.visualAsset || "copper_saute_pan",
                recipeSummary: item.recipeSummary || "Préparation minute",
                ingredientsConsumed: item.ingredientsConsumed || pl.ingredientsConsumed || [],
                chefName,
                status: "COOKING",
                startedAt: tIso,
              });
            }
          }
        }
        if (actorAgent && st?.transform) {
          const firstItem = (pl.items || [])[0];
          const dishTitle = firstItem?.name || pl.dishName || pl.primaryDishName || "Plat";
          actorAgent.status = "COOKING";
          actorAgent.currentTask = `Cuisson: ${dishTitle}`;
          actorAgent.activeDish = dishTitle;
          actorAgent.activeDishId = did || null;
          actorAgent.visualAsset = firstItem?.visualAsset || "copper_saute_pan";
          actorAgent.targetX = st.transform.x;
          actorAgent.targetZ = st.transform.z + 0.82;
          actorAgent.lastMoveMs = ev.eventTimeMs;
        }
        break;
      }
      case "ITEM_READY_AT_PASS":
      case "DISH_PLATED_AT_PASS": {
        const did = ev.dishId || pl.dishId;
        if (did && s.dishInstancesMap[did]) {
          s.dishInstancesMap[did].status = "READY_AT_PASS";
          s.dishInstancesMap[did].platedAt = tIso;
        }
        for (const st of Object.values(s.stations)) {
          if (st.stationKind !== "pass") {
            const before = st.activeTasks.length;
            st.activeTasks = st.activeTasks.filter(
              (tk) =>
                !(
                  (did && tk.dishInstanceId === did) ||
                  (!did && tk.orderId === (pl.orderId || ev.orderId) && tk.course === pl.course)
                )
            );
            if (st.activeTasks.length < before) {
              st.completedCount += before - st.activeTasks.length;
            }
            if (st.activeTasks.length === 0) st.status = "IDLE";
          }
        }
        const passSt = this.findStationByKind("pass", ev.target?.domainEntityId);
        const tableLabel =
          pl.tableLabel || pl.tableName || (pl.tableId && s.tables[pl.tableId]?.label) || pl.tableId || "Salle";
        if (passSt && pl.station !== "bar") {
          passSt.status = "READY_FOR_PICKUP";
          passSt.lastEventAt = tIso;
          const itemsToPass =
            (pl.items || []).length > 0
              ? pl.items
              : [{ dishInstanceId: did, name: pl.dishName || "Plat Dressé", ingredientsConsumed: pl.ingredientsConsumed || [] }];
          for (const [idx, item] of itemsToPass.entries()) {
            const dishName = item.name || item.dishName || item.label || pl.dishName || "Plat Dressé";
            passSt.activeTasks.push({
              taskId: item.dishInstanceId || did || `${pl.orderId}-pass-c${pl.course || 2}-${idx}`,
              dishInstanceId: item.dishInstanceId || did || null,
              orderId: pl.orderId || ev.orderId,
              tableId: pl.tableId || ev.tableId,
              tableLabel,
              course: pl.course || 2,
              dishName,
              label: dishName,
              category: item.category || "Passe Chaude",
              qty: Number(item.qty || 1),
              prepMinutes: Number(item.prepMinutes || 10),
              visualAsset: item.visualAsset || "pass_heat_lamp_plate",
              recipeSummary: item.recipeSummary || "Dressé sur assiette chaude sous lampe",
              ingredientsConsumed: item.ingredientsConsumed || pl.ingredientsConsumed || [],
              chefName: pl.chefName || ev.actor?.name || "Chef",
              status: "READY_AT_PASS",
              readyAt: tIso,
            });
          }
        }
        break;
      }
      case "ORDER_PICKED_UP_FROM_PASS": {
        const did = ev.dishId || pl.dishId;
        if (did && s.dishInstancesMap[did]) {
          s.dishInstancesMap[did].status = "IN_TRANSIT_TO_TABLE";
          s.dishInstancesMap[did].pickedUpAt = tIso;
          s.dishInstancesMap[did].waiterId = ev.actor?.agentId || ev.actorId;
          s.dishInstancesMap[did].waiterName = ev.actor?.name || ev.actorName;
        }
        const passSt = this.findStationByKind("pass");
        if (actorAgent && passSt?.transform) {
          actorAgent.status = "PICKING_UP_PASS";
          actorAgent.carryingDish = pl.dishName || "Plat";
          actorAgent.currentTask = `Enlèvement au passe: ${pl.dishName || "Plat"}`;
          actorAgent.targetX = passSt.transform.x;
          actorAgent.targetZ = passSt.transform.z + 0.85;
          actorAgent.lastMoveMs = ev.eventTimeMs;
        }
        break;
      }
      case "ORDER_DELIVERED_TO_TABLE": {
        const did = ev.dishId || pl.dishId;
        const passSt = this.findStationByKind("pass");
        if (passSt) {
          const before = passSt.activeTasks.length;
          passSt.activeTasks = passSt.activeTasks.filter(
            (tk) =>
              !(
                (did && tk.dishInstanceId === did) ||
                (!did && tk.orderId === (pl.orderId || ev.orderId) && tk.course === pl.course)
              )
          );
          if (passSt.activeTasks.length < before) passSt.completedCount += before - passSt.activeTasks.length;
          if (passSt.activeTasks.length === 0) passSt.status = "IDLE";
        }
        const tid = pl.tableId || ev.tableId;
        const deliveredItems =
          (pl.items || []).length > 0
            ? pl.items
            : [
                {
                  dishInstanceId: did,
                  dishId: did,
                  name: pl.dishName || "Plat",
                  qty: 1,
                  visualAsset: "cold_plated_dish",
                  ingredientsConsumed: pl.ingredientsConsumed || [],
                },
              ];
        if (did && s.dishInstancesMap[did]) {
          s.dishInstancesMap[did].status = "SERVED_ON_TABLE";
          s.dishInstancesMap[did].deliveredAt = tIso;
          s.dishInstancesMap[did].waiterId = ev.actor?.agentId || ev.actorId;
          s.dishInstancesMap[did].waiterName = ev.actor?.name || ev.actorName;
        }
        if (tid && s.tables[tid]) {
          s.tables[tid].status = `DINING_COURSE_${pl.course || 2}`;
          s.tables[tid].currentCourse = pl.course || 2;
          for (const it of deliveredItems) {
            const itemDid = it.dishInstanceId || it.dishId || did;
            const existingIdx = s.tables[tid].servedDishes.findIndex(
              (d) => itemDid && (d.dishInstanceId === itemDid || d.dishId === itemDid)
            );
            const dishRecord = {
              dishInstanceId: itemDid,
              dishId: itemDid,
              dishName: it.name || it.dishName || pl.dishName || "Plat",
              qty: it.qty || 1,
              visualAsset: it.visualAsset || "cold_plated_dish",
              recipeSummary: it.recipeSummary || "",
              ingredientsConsumed:
                it.ingredientsConsumed ||
                s.dishInstancesMap[itemDid]?.ingredientsConsumed ||
                pl.ingredientsConsumed ||
                [],
              servedAt: tIso,
            };
            if (existingIdx >= 0) {
              s.tables[tid].servedDishes[existingIdx] = dishRecord;
            } else {
              s.tables[tid].servedDishes.push(dishRecord);
            }
          }
          s.tables[tid].updatedAt = tIso;
        }
        if (s.activeOrdersMap[pl.orderId || ev.orderId]) {
          s.activeOrdersMap[pl.orderId || ev.orderId].status = `SERVED_COURSE_${pl.course || 2}`;
          s.activeOrdersMap[pl.orderId || ev.orderId].currentCourse = pl.course || 2;
        }
        const dest = pl.targetCoords || ev.location || { x: 10, z: 6 };
        if (actorAgent) {
          const firstDish = deliveredItems[0]?.name || pl.dishName || `Suite ${pl.course || 2}`;
          actorAgent.status = "SERVING";
          actorAgent.carryingDish = firstDish;
          actorAgent.currentTask = `Service: ${firstDish} → ${pl.tableLabel || pl.tableName || tid || "Table"}`;
          if (passSt?.transform) {
            actorAgent.x = passSt.transform.x;
            actorAgent.z = passSt.transform.z + 0.9;
          }
          actorAgent.targetX = dest.x + 0.55;
          actorAgent.targetZ = dest.z + 0.55;
          actorAgent.lastMoveMs = ev.eventTimeMs;
        }
        break;
      }
      case "GUEST_DINING_CHECKIN": {
        const tid = pl.tableId || ev.tableId;
        if (tid && s.tables[tid]) {
          s.tables[tid].status = "DINING_SATISFIED";
          s.tables[tid].updatedAt = tIso;
        }
        break;
      }
      case "PAYMENT_COMPLETED": {
        const paid = Number(pl.paidCents || Math.round(Number(pl.amount || 0) * 100));
        const tip = Number(pl.tipCents || Math.round(paid * 0.08));
        const rev = Math.max(0, paid - tip);
        s.metrics.revenueCents += rev;
        s.metrics.tipCents += tip;
        s.metrics.completedOrders += 1;
        s.metrics.activeOrders = Math.max(0, s.metrics.activeOrders - 1);

        const tid = pl.tableId || ev.tableId;
        if (tid && s.tables[tid]) {
          s.tables[tid].status = "PAID";
          s.tables[tid].updatedAt = tIso;
        }
        break;
      }
      case "CUSTOMER_DEPARTED": {
        const tid = pl.tableId || ev.tableId;
        if (tid && s.tables[tid]) {
          s.metrics.activeCovers = Math.max(0, s.metrics.activeCovers - (s.tables[tid].partySize || 2));
          s.tables[tid].status = "NEEDS_CLEARING";
          s.tables[tid].updatedAt = tIso;
        }
        const cid = pl.customerAgentId || ev.actor?.agentId || ev.actorId;
        if (cid) delete s.activeAgents[cid];
        delete s.activeOrdersMap[pl.orderId || ev.orderId];
        break;
      }
      case "TABLE_CLEARED": {
        const tid = pl.tableId || ev.tableId;
        if (tid && s.tables[tid]) {
          if (s.tables[tid].status !== "NEEDS_CLEARING") {
            s.metrics.activeCovers = Math.max(0, s.metrics.activeCovers - (s.tables[tid].partySize || 2));
          }
          s.tables[tid].status = "AVAILABLE";
          s.tables[tid].partyName = null;
          s.tables[tid].partySize = 0;
          s.tables[tid].activeOrderId = null;
          s.tables[tid].currentCourse = 0;
          s.tables[tid].servedDishes = [];
          s.tables[tid].updatedAt = tIso;
        }
        const cid = pl.customerAgentId;
        if (cid) delete s.activeAgents[cid];
        delete s.activeOrdersMap[pl.orderId || ev.orderId];

        const dishSt = this.findStationByKind("dishwashing");
        if (dishSt) {
          dishSt.status = "WASHING";
          dishSt.completedCount += 1;
          dishSt.lastEventAt = tIso;
        }
        break;
      }
      case "DISHES_WASHED_AT_PLONGE": {
        const dishSt = this.findStationByKind("dishwashing", ev.stationId || ev.target?.domainEntityId);
        if (dishSt) {
          dishSt.status = "IDLE";
          dishSt.completedCount += 1;
          dishSt.lastEventAt = tIso;
        }
        if (actorAgent) {
          actorAgent.status = "ON_DUTY";
          actorAgent.currentTask = `Vaisselle lavée & rangée (${pl.soiledPlatesWashed || 4} pièces)`;
        }
        break;
      }
      default:
        break;
    }
  }
}

/**
 * 2. PizzaTakeawaySimulation (extensible format for takeaway venues)
 */
export class PizzaTakeawaySimulation extends BaseBusinessSimulation {}

/**
 * 3. CafeSimulation (extensible format for counter-service cafés)
 */
export class CafeSimulation extends BaseBusinessSimulation {}

export function createBusinessSimulation(
  businessDoc,
  premisesDoc,
  sceneObjects,
  employees,
  products,
  ingredients,
  initialStockUnits = []
) {
  switch (businessDoc.businessType) {
    case "restaurant":
      return new FullServiceRestaurantSimulation(
        businessDoc,
        premisesDoc,
        sceneObjects,
        employees,
        products,
        ingredients,
        initialStockUnits
      );
    case "pizza_takeaway":
      return new PizzaTakeawaySimulation(
        businessDoc,
        premisesDoc,
        sceneObjects,
        employees,
        products,
        ingredients,
        initialStockUnits
      );
    case "cafe":
      return new CafeSimulation(
        businessDoc,
        premisesDoc,
        sceneObjects,
        employees,
        products,
        ingredients,
        initialStockUnits
      );
    default:
      return new BaseBusinessSimulation(
        businessDoc,
        premisesDoc,
        sceneObjects,
        employees,
        products,
        ingredients,
        initialStockUnits
      );
  }
}
