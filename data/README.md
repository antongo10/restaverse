# Data — MongoDB Operational Collections (`data/mongodb/`)

This directory holds the 26 MongoDB JSON collections generated deterministically by [`scripts/build_month_simulation_db.py`](file:///Users/ag/Workspace/restaurants/scripts/build_month_simulation_db.py) and loaded by [`backend/db/mongoStore.mjs`](file:///Users/ag/Workspace/restaurants/backend/db/mongoStore.mjs).

---

## Collections Overview

| Collection File | Purpose |
| :--- | :--- |
| `streets.json` | Street geometry and metadata for `street-london-001` (*Boulevard de la Gastronomie*). |
| `businesses.json` | Definitions for **Bistrot Lumière**, **Osteria Bellavista**, and **Sakana-Tei 魚亭**. |
| `premises.json` & `floorPlans.json` | 3D/2D spatial bounds, wall segments, zones, and navigation graphs for each restaurant. |
| `sceneObjects.json` | Every interactive 3D table, kitchen/bar station, cold/dry storage rack, and POS terminal. |
| `employees.json` & `agentDefinitions.json` | Staff rosters, roles (`chef`, `waiter`, `bartender`, `plongeur`, `manager`), and 3D avatar definitions. |
| `suppliers.json`, `ingredients.json`, `products.json` | Supplier catalog, raw ingredients, and menu products with exact per-ingredient grammages. |
| `stockUnits.json` | Discrete physical containers (`unit-*`) placed on sorted 3D kitchen and bar shelves (`shelfLevel`, `slotIndex`, `fifoRank`, `initialQuantity`, `remainingQuantity`, `slicesConsumed`). |
| `dishInstances.json` | Individual plated dishes (`dish-*`) with full provenance linking `orderId`, `tableId`, `preparedByEmployeeId`, `servedByEmployeeId`, and `ingredientsConsumed` (`unitId` slices). |
| `contentionLog.json` | Multi-cook FIFO resource contention events and single-bottle barman lock transitions. |
| `orders.json`, `reservations.json`, `payments.json` | Customer reservations, itemized table orders, and POS/TPE payment records across all 31 days. |
| `inventoryMovements.json`, `productionBatches.json`, `expenses.json`, `payrollRecords.json`, `shifts.json`, `customers.json` | Supporting operational, inventory, and accounting collections. |
| `simulationEvents.json`, `simulationSnapshots.json`, `simulationSessions.json`, `dailySummaries.json` | Chronological event stream and snapshots powering 60 FPS forward and reverse replay. |

---

## Regenerating the Data

Because large generated collection files (`simulationEvents.json`, `orders.json`, `dishInstances.json`, `stockUnits.json`, `inventoryMovements.json`, `contentionLog.json`) are deterministic outputs of the seed engine, they can be regenerated at any time with:

```bash
python3 scripts/build_month_simulation_db.py
```

Note: When starting [`backend/server.mjs`](file:///Users/ag/Workspace/restaurants/backend/server.mjs), [`MongoOperationalStore`](file:///Users/ag/Workspace/restaurants/backend/db/mongoStore.mjs) automatically invokes `scripts/build_month_simulation_db.py` if `data/mongodb/simulationEvents.json` is not present on disk.
