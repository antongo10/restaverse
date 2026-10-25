# Backend — Multi-Venue Simulation Engine, Lineage API & Atlas Stream Processor

The `backend/` service powers the deterministic multi-restaurant state evaluator, physical ingredient/dish lineage API, and MongoDB Atlas Stream Processing runtime for the **Multi-Venue 3D Hospitality Street Simulation Platform**.

---

## Module Structure

| File | Responsibility |
| :--- | :--- |
| [`server.mjs`](file:///Users/ag/Workspace/restaurants/backend/server.mjs) | Zero-dependency Node.js HTTP server (`PORT=4100`) exposing bootstrap, day-bundle, state evaluation, scene object inspection, and dish/stock-unit lineage endpoints, plus static serving for `/assets/*.glb` and `frontend/dist`. |
| [`db/mongoStore.mjs`](file:///Users/ag/Workspace/restaurants/backend/db/mongoStore.mjs) | [`MongoOperationalStore`](file:///Users/ag/Workspace/restaurants/backend/db/mongoStore.mjs#L113-L284) — Loads all 26 MongoDB collections from `data/mongodb/*.json` (using a chunked 32MB streaming parser for large event collections `>= 200MB`) and builds in-memory secondary indexes by `_id`, `sceneObjectId`, `unitId`, `dishInstanceId`, `orderId`, and `serviceDate`. Automatically triggers `scripts/build_month_simulation_db.py` if collections are missing. |
| [`simulation/businessSimulations.mjs`](file:///Users/ag/Workspace/restaurants/backend/simulation/businessSimulations.mjs) | [`createBusinessSimulation`](file:///Users/ag/Workspace/restaurants/backend/simulation/businessSimulations.mjs) — Deterministic per-venue state machine that replays chronological `simulationEvents` up to any `timestampMs` to compute live table statuses (`FREE`, `OCCUPIED`, `NEEDS_CLEARING`), seated party sizes, active kitchen/bar station tasks, FIFO `stockUnitsMap`, `dishInstancesMap`, `barmanState`, and staff/customer agent trajectories. |
| [`streams/atlasStreamProcessor.mjs`](file:///Users/ag/Workspace/restaurants/backend/streams/atlasStreamProcessor.mjs) | [`getAtlasStreamProcessorDefinition`](file:///Users/ag/Workspace/restaurants/backend/streams/atlasStreamProcessor.mjs#L11-L111) & [`computeStreamMetricsAt`](file:///Users/ag/Workspace/restaurants/backend/streams/atlasStreamProcessor.mjs#L117-L181) — Defines the MongoDB Atlas Stream Processing (`$source`, `$tumblingWindow`, `$merge`) pipelines and computes real-time 15-minute tumbling-window KPIs and operational alerts at any replay timestamp. |

---

## REST API Endpoints

### `GET /api/bootstrap`
Returns the static street topology and catalog metadata required to initialize the 3D scene and 2D floor plans:
- `street`: Street geometry (`street-london-001`)
- `businesses`: All 3 restaurant definitions (`business-bistrot-lumiere`, `business-osteria-bellavista`, `business-sakana-tei`)
- `premises` & `floorPlans`: Spatial bounds, wall segments, zones, and A* navigation waypoints
- `sceneObjects`: All interactive 3D tables, kitchen/bar stations, storage racks, and POS terminals
- `employees` & `agentDefinitions`: Staff rosters, roles (`chef`, `waiter`, `bartender`, `plongeur`, `manager`), and shift schedules
- `suppliers`, `ingredients`, `products`: Complete recipes, grammages, and supplier catalogs
- `dailySummaries`, `validationReport`, `atlasStatus`, `atlasStreamProcessor`

### `GET /api/simulation/day-bundle?date=YYYY-MM-DD`
Returns the complete operational dataset for a single service date (`2026-10-01` .. `2026-10-31`) for client-side 60 FPS deterministic scrubbing and reverse playback:
- `daySummary`
- `orders`, `reservations`, `payments`
- `inventoryMovements`
- `stockUnits` (discrete physical shelf containers with `unitId`, `shelfLevel`, `slotIndex`, `fifoRank`, `initialQuantity`, `slicesConsumed`)
- `dishInstances` (every plated dish `dish-*` with `orderId`, `tableId`, `preparedByEmployeeId`, `servedByEmployeeId`, `ingredientsConsumed`, and lifecycle timestamps)
- `contentionLog` (multi-cook FIFO lock/wait/retry events and single-bottle barman transitions)
- `events` (chronological `simulationEvents` for the day)
- `snapshots` (periodic state checkpoints)

### `GET /api/simulation/state?date=YYYY-MM-DD&timestampMs=<ms>`
Evaluates and returns the exact street state across all 3 restaurants at `timestampMs` via [`evaluateStreetStateAt`](file:///Users/ag/Workspace/restaurants/backend/server.mjs#L25-L83).

### `GET /api/inspect/:sceneObjectId?date=YYYY-MM-DD&timestampMs=<ms>`
Inspects any 3D object or entity at a specific point in time via [`inspectSceneObjectAt`](file:///Users/ag/Workspace/restaurants/backend/server.mjs#L85-L403):
- **Plated Dish (`dish-*` or `scene-dish-*`)**: Returns the `DishInstance` record, recipe breakdown, cook/waiter attribution, cooking/plating/service timestamps, exact `stockUnitsUsed` with remaining quantities at `timestampMs`, and any `contentionEvents`.
- **Physical Stock Unit (`unit-*` or `scene-unit-*`)**: Returns the `StockUnit` container metadata (`shelfSlot`, `containerType`, `fifoRank`, `initialQuantity`, `remainingQuantity`), every dish slice deducted from the unit (`slicesConsumed`), and contention history.
- **Dining Table (`scene-*-table-*`)**: Returns `OCCUPIED` / `NEEDS_CLEARING` / `FREE` status, `activeOrder`, `servedDishInstances`, `historicalOrdersToday`, and `reservationsToday`.
- **Kitchen / Bar / Storage Station (`scene-*-station-*`)**: Returns active cooking/bar tasks, sorted `shelfStockUnits`, `contentionEvents`, `barmanState`, and `recentInventoryMovements`.
- **Employee (`emp-*`)**: Returns live agent task/posture, `shiftsToday`, `payrollHistory`, and `recentAgentEvents`.

### `GET /api/lineage/dish/:dishId` & `GET /api/lineage/unit/:unitId`
Dedicated provenance aliases for querying full forward/reverse lineage of a dish instance or physical stock unit.

---

## Running the Backend

```bash
# Default port 4100
node backend/server.mjs

# Custom port
PORT=4200 node backend/server.mjs
```
