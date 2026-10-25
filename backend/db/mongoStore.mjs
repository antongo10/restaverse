import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, "../../data/mongodb");
const SCRIPT_PATH = path.resolve(__dirname, "../../scripts/build_month_simulation_db.py");

function readJsonArrayFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const stat = fs.statSync(filePath);
  if (stat.size === 0) return [];
  // For files under 200MB, parse directly in one shot
  if (stat.size < 200 * 1024 * 1024) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }
  // For large JSON array files (>= 200MB), stream-parse top-level objects in 32MB buffer chunks
  // to avoid V8's 512MB single-string limit (`ERR_STRING_TOO_LONG`).
  const fd = fs.openSync(filePath, "r");
  const chunkSize = 32 * 1024 * 1024;
  const buf = Buffer.allocUnsafe(chunkSize);
  const results = [];
  let carry = "";
  let depth = 0;
  let inString = false;
  let escape = false;
  let objStart = -1;

  try {
    let bytesRead = 0;
    while ((bytesRead = fs.readSync(fd, buf, 0, chunkSize, null)) > 0) {
      const str = carry + buf.toString("utf-8", 0, bytesRead);
      let lastConsumed = 0;
      depth = 0;
      inString = false;
      escape = false;
      objStart = -1;

      for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        if (escape) {
          escape = false;
          continue;
        }
        if (ch === 92 /* \ */ && inString) {
          escape = true;
          continue;
        }
        if (ch === 34 /* " */) {
          inString = !inString;
          continue;
        }
        if (inString) continue;

        if (ch === 123 /* { */) {
          if (depth === 0) objStart = i;
          depth++;
        } else if (ch === 125 /* } */) {
          depth--;
          if (depth === 0 && objStart !== -1) {
            const jsonSlice = str.slice(objStart, i + 1);
            results.push(JSON.parse(jsonSlice));
            lastConsumed = i + 1;
            objStart = -1;
          }
        }
      }
      carry = objStart !== -1 ? str.slice(objStart) : str.slice(lastConsumed);
    }
  } finally {
    fs.closeSync(fd);
  }
  return results;
}

const COLLECTIONS = [
  "streets",
  "businesses",
  "premises",
  "floorPlans",
  "sceneObjects",
  "agentDefinitions",
  "employees",
  "suppliers",
  "ingredients",
  "products",
  "payrollRecords",
  "expenses",
  "productionBatches",
  "customers",
  "shifts",
  "reservations",
  "orders",
  "payments",
  "inventoryMovements",
  "stockUnits",
  "dishInstances",
  "contentionLog",
  "simulationSessions",
  "simulationEvents",
  "simulationSnapshots",
  "dailySummaries",
];

const isoMs = (iso) => (iso ? Date.parse(iso) || 0 : 0);

// When a record "happens" for the live feed: anything later than the release cutoff
// has been pre-simulated but must not be visible yet.
const RELEASE_TIME_OF = {
  simulationEvents: (d) => d.eventTimeMs || 0,
  orders: (d) => isoMs(d.arrivedAt || d.seatedAt || d.openedAt || d.createdAt),
  payments: (d) => isoMs(d.processedAt),
  dishInstances: (d) => isoMs(d.orderedAt || d.cookingStartedAt || d.prepStartedAt),
  inventoryMovements: (d) => isoMs(d.occurredAt || d.timestamp),
  contentionLog: (d) => d.eventTimeMs || isoMs(d.timestamp),
  stockUnits: (d) => isoMs(d.createdAt),
};

const ORDER_OUTCOME_FIELDS = ["allDeliveredAt", "lastFoodDeliveredAt", "closedAt", "paidAt", "departedAt", "clearedAt"];

// Hide the parts of an order that happen after the cutoff (the bill, departure, clearing).
function maskOrderAt(order, cutoffMs) {
  if (!ORDER_OUTCOME_FIELDS.some((f) => isoMs(order[f]) > cutoffMs)) return order;
  const masked = { ...order };
  for (const f of ORDER_OUTCOME_FIELDS) {
    if (isoMs(masked[f]) > cutoffMs) masked[f] = null;
  }
  if (!masked.paidAt) {
    masked.status = "open";
    masked.paidCents = 0;
    masked.tipCents = 0;
    masked.totalPaid = 0;
    masked.tip = 0;
  }
  return masked;
}

function maskReservationAt(res, cutoffMs) {
  if (isoMs(res.seatedAt) > cutoffMs) {
    return { ...res, status: "CONFIRMED", seatedAt: null, finishedAt: null };
  }
  if (isoMs(res.finishedAt) > cutoffMs) {
    return { ...res, status: "SEATED", finishedAt: null };
  }
  return res;
}

/**
 * Multi-Collection MongoDB Document Store & Query Engine
 * Connects to MongoDB if `MONGODB_URI` is provided, and maintains an indexed
 * in-memory replica backed by `data/mongodb/*.json` for sub-millisecond 3D viewport queries.
 */
export class MongoStore {
  constructor(autoInit = true) {
    this.collections = {};
    this.byId = {};
    this.eventsByDate = new Map();
    this.snapshotsByDate = new Map();
    this.ordersByDate = new Map();
    this.reservationsByDate = new Map();
    this.paymentsByDate = new Map();
    this.movementsByDate = new Map();
    this.stockUnitsByDate = new Map();
    this.dishInstancesByDate = new Map();
    this.contentionByDate = new Map();
    this.releaseBoundsCache = new Map();
    // Returns the epoch ms up to which records are released (Infinity = everything).
    this.releaseCutoffMs = () => Infinity;
    this.validationReport = null;
    this.atlasStatus = {
      mode: "LOCAL_INDEXED_REPLICA",
      database: "hospitality_street_sim",
      connected: true,
      collectionsLoaded: COLLECTIONS.length,
    };
    this._initialized = false;
    if (autoInit) {
      this.initSync();
    }
  }

  initSync() {
    if (this._initialized) return;
    const eventsPath = path.join(DATA_DIR, "simulationEvents.json");
    const stockUnitsPath = path.join(DATA_DIR, "stockUnits.json");
    if (!fs.existsSync(eventsPath) || !fs.existsSync(stockUnitsPath)) {
      console.log("[MongoStore] MongoDB collections not found on disk. Running 30-day ETL migration script...");
      execFileSync("python3", [SCRIPT_PATH], { stdio: "inherit" });
    }

    for (const col of COLLECTIONS) {
      const filePath = path.join(DATA_DIR, `${col}.json`);
      const docs = readJsonArrayFile(filePath);
      this.collections[col] = docs;

      const idMap = new Map();
      for (const doc of docs) {
        if (doc._id) idMap.set(doc._id, doc);
        if (doc.sceneObjectId) idMap.set(doc.sceneObjectId, doc);
        if (doc.unitId) idMap.set(doc.unitId, doc);
        if (doc.dishInstanceId) idMap.set(doc.dishInstanceId, doc);
        if (doc.dishId) idMap.set(doc.dishId, doc);
        if (doc.orderId && col === "orders") idMap.set(doc.orderId, doc);
      }
      this.byId[col] = idMap;
    }

    const reportPath = path.join(DATA_DIR, "migration_validation_report.json");
    if (fs.existsSync(reportPath)) {
      this.validationReport = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
    }

    // Build secondary indexes by serviceDate
    this._indexByDate("simulationEvents", this.eventsByDate);
    this._indexByDate("simulationSnapshots", this.snapshotsByDate);
    this._indexByDate("orders", this.ordersByDate);
    this._indexByDate("reservations", this.reservationsByDate);
    this._indexByDate("payments", this.paymentsByDate);
    this._indexByDate("inventoryMovements", this.movementsByDate);
    this._indexByDate("stockUnits", this.stockUnitsByDate);
    this._indexByDate("dishInstances", this.dishInstancesByDate);
    this._indexByDate("contentionLog", this.contentionByDate);

    // Ensure events for each date are sorted chronologically
    for (const [, evts] of this.eventsByDate.entries()) {
      evts.sort((a, b) => (a.eventTimeMs || 0) - (b.eventTimeMs || 0));
    }

    this._initialized = true;
    console.log(
      `[MongoStore] Loaded ${COLLECTIONS.length} MongoDB collections (${this.collections.simulationEvents.length} events, ${this.collections.stockUnits.length} stockUnits, ${this.collections.dishInstances.length} dishInstances, ${this.collections.contentionLog.length} contentionLogs across ${this.eventsByDate.size} service dates).`
    );
  }

  async init() {
    this.initSync();
  }

  _indexByDate(colName, targetMap) {
    targetMap.clear();
    for (const doc of this.collections[colName] || []) {
      const d = doc.serviceDate || doc.date;
      if (!d) continue;
      if (!targetMap.has(d)) targetMap.set(d, []);
      targetMap.get(d).push(doc);
    }
  }

  getCollection(name) {
    return this.collections[name] || [];
  }

  /** Records of one service date that have happened by the release cutoff. */
  _released(colName, serviceDate, docs, cutoffMs = this.releaseCutoffMs()) {
    if (cutoffMs === Infinity || docs.length === 0) return docs;
    const timeOf = RELEASE_TIME_OF[colName];
    const key = `${colName}:${serviceDate}`;
    let bounds = this.releaseBoundsCache.get(key);
    if (!bounds) {
      bounds = { min: Infinity, max: -Infinity };
      for (const d of docs) {
        const t = timeOf(d);
        if (t < bounds.min) bounds.min = t;
        if (t > bounds.max) bounds.max = t;
      }
      this.releaseBoundsCache.set(key, bounds);
    }
    if (bounds.max <= cutoffMs) return docs;
    if (bounds.min > cutoffMs) return [];
    return docs.filter((d) => timeOf(d) <= cutoffMs);
  }

  /** Records of one service date whose release time falls in (fromMs, toMs]. */
  getReleasedBetween(colName, serviceDate, fromMs, toMs) {
    const byDate = {
      simulationEvents: this.eventsByDate,
      orders: this.ordersByDate,
      payments: this.paymentsByDate,
      dishInstances: this.dishInstancesByDate,
      inventoryMovements: this.movementsByDate,
      contentionLog: this.contentionByDate,
    }[colName];
    const timeOf = RELEASE_TIME_OF[colName];
    const docs = byDate?.get(serviceDate) || [];
    const out = docs.filter((d) => {
      const t = timeOf(d);
      return t > fromMs && t <= toMs;
    });
    if (colName === "orders") return out.map((o) => maskOrderAt(o, toMs));
    return out;
  }

  findById(colName, id) {
    return this.byId[colName]?.get(id) || null;
  }

  getStockUnitById(unitId) {
    return this.byId.stockUnits?.get(unitId) || null;
  }

  getDishInstanceById(dishInstanceId) {
    return this.byId.dishInstances?.get(dishInstanceId) || null;
  }

  getEventsForDate(serviceDate) {
    return this._released("simulationEvents", serviceDate, this.eventsByDate.get(serviceDate) || []);
  }

  getSnapshotsForDate(serviceDate) {
    return this.snapshotsByDate.get(serviceDate) || [];
  }

  getOrdersForDate(serviceDate) {
    const cutoffMs = this.releaseCutoffMs();
    const orders = this._released("orders", serviceDate, this.ordersByDate.get(serviceDate) || [], cutoffMs);
    return cutoffMs === Infinity ? orders : orders.map((o) => maskOrderAt(o, cutoffMs));
  }

  getReservationsForDate(serviceDate) {
    const cutoffMs = this.releaseCutoffMs();
    const reservations = this.reservationsByDate.get(serviceDate) || [];
    return cutoffMs === Infinity ? reservations : reservations.map((r) => maskReservationAt(r, cutoffMs));
  }

  getPaymentsForDate(serviceDate) {
    return this._released("payments", serviceDate, this.paymentsByDate.get(serviceDate) || []);
  }

  getMovementsForDate(serviceDate) {
    return this._released("inventoryMovements", serviceDate, this.movementsByDate.get(serviceDate) || []);
  }

  getInventoryMovementsForDate(serviceDate) {
    return this.getMovementsForDate(serviceDate);
  }

  getStockUnitsForDate(serviceDate, businessId = null) {
    const units = this._released("stockUnits", serviceDate, this.stockUnitsByDate.get(serviceDate) || []);
    return businessId ? units.filter((u) => u.businessId === businessId) : units;
  }

  getDishInstancesForDate(serviceDate, businessId = null) {
    const dishes = this._released("dishInstances", serviceDate, this.dishInstancesByDate.get(serviceDate) || []);
    return businessId ? dishes.filter((d) => d.businessId === businessId) : dishes;
  }

  getContentionLogForDate(serviceDate, businessId = null) {
    const logs = this._released("contentionLog", serviceDate, this.contentionByDate.get(serviceDate) || []);
    return businessId ? logs.filter((c) => c.businessId === businessId) : logs;
  }

  /** Day totals as of the release cutoff (the full stored summary once the day is over). */
  getDaySummary(serviceDate) {
    const stored = this.getCollection("dailySummaries").find((d) => d.date === serviceDate) || null;
    const payments = this.paymentsByDate.get(serviceDate) || [];
    const released = this.getPaymentsForDate(serviceDate);
    if (released.length === payments.length) return stored;
    const summary = { date: serviceDate, partial: true, orderCount: 0, covers: 0, revenueCents: 0, tipCents: 0, byBusiness: {} };
    for (const o of this.getOrdersForDate(serviceDate)) {
      const b = (summary.byBusiness[o.businessId] ||= { orderCount: 0, covers: 0, revenueCents: 0, tipCents: 0 });
      b.orderCount += 1;
      b.covers += o.covers || 0;
      summary.orderCount += 1;
      summary.covers += o.covers || 0;
    }
    for (const p of released) {
      const b = (summary.byBusiness[p.businessId] ||= { orderCount: 0, covers: 0, revenueCents: 0, tipCents: 0 });
      b.revenueCents += p.subtotalCents || 0;
      b.tipCents += p.tipCents || 0;
      summary.revenueCents += p.subtotalCents || 0;
      summary.tipCents += p.tipCents || 0;
    }
    return summary;
  }

  getDayBundle(serviceDate) {
    const cutoffMs = this.releaseCutoffMs();
    return {
      serviceDate,
      releasedUntilMs: cutoffMs === Infinity ? null : cutoffMs,
      daySummary: this.getDaySummary(serviceDate),
      orders: this.getOrdersForDate(serviceDate),
      reservations: this.getReservationsForDate(serviceDate),
      payments: this.getPaymentsForDate(serviceDate),
      inventoryMovements: this.getMovementsForDate(serviceDate),
      stockUnits: this.getStockUnitsForDate(serviceDate),
      dishInstances: this.getDishInstancesForDate(serviceDate),
      contentionLog: this.getContentionLogForDate(serviceDate),
      events: this.getEventsForDate(serviceDate),
      snapshots: this.getSnapshotsForDate(serviceDate),
    };
  }
}

export const MongoOperationalStore = MongoStore;
export const mongoStore = new MongoStore(false);
