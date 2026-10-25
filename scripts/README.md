# Scripts — 31-Day Multi-Restaurant Simulation Builder, Coherency Engine & Atlas Sync

The `scripts/` directory contains the deterministic Python simulation generators, physical stock-unit coherency engine, dialogue generator, street topology builder, and MongoDB Atlas provisioning script.

---

## Files & Modules

| File | Description |
| :--- | :--- |
| [`build_month_simulation_db.py`](file:///Users/ag/Workspace/restaurants/scripts/build_month_simulation_db.py) | Master 31-day (`2026-10-01` .. `2026-10-31`) ETL & simulation builder that combines all three restaurant seed modules, validates causal invariants (`0` early departures, `maxSimultaneousBottlesHeldByBarman == 1`, FIFO depletion), and writes all 26 MongoDB JSON collections to `data/mongodb/`. |
| [`street_topology.py`](file:///Users/ag/Workspace/restaurants/scripts/street_topology.py) | Defines the spatial layout of *Boulevard de la Gastronomie* (`street-london-001`), the three restaurant premises (`premises-bistrot-lumiere`, `premises-osteria-bellavista`, `premises-sakana-tei`), 2D/3D wall segments, zones, and interactive `sceneObjects`. |
| [`seeds/seed_bistrot_lumiere.py`](file:///Users/ag/Workspace/restaurants/scripts/seeds/seed_bistrot_lumiere.py) | 31-day operational generator for **Bistrot Lumière** (French Brasserie & Cuisine Niçoise), including recipes, staff rosters, table configurations, and service timelines. |
| [`seeds/seed_osteria_bellavista.py`](file:///Users/ag/Workspace/restaurants/scripts/seeds/seed_osteria_bellavista.py) | 31-day operational generator for **Osteria Bellavista** (Tuscan Trattoria & Wood-Fired Grill). |
| [`seeds/seed_sakana_tei.py`](file:///Users/ag/Workspace/restaurants/scripts/seeds/seed_sakana_tei.py) | 31-day operational generator for **Sakana-Tei 魚亭** (Hinoki Omakase Sushi & Binchotan Robatayaki). |
| [`seeds/coherency_engine.py`](file:///Users/ag/Workspace/restaurants/scripts/seeds/coherency_engine.py) | Enforces physical FIFO stock-unit depletion (`unitId`, `shelfLevel`, `slotIndex`, `fifoRank`), multi-cook contention locking (`UNIT_LOCKED_BY_COOK`, `INGREDIENT_CONTENTION_WAIT`, `COOK_GATHERING_OTHER_ITEMS`, `UNIT_RETURNED_TO_SHELF`), and single-bottle barman serialization (`BARMAN_BOTTLE_TAKEN` → `BARMAN_DRINK_POURED` → `BARMAN_BOTTLE_RETURNED`). |
| [`seeds/dialogue_simulator.py`](file:///Users/ag/Workspace/restaurants/scripts/seeds/dialogue_simulator.py) | Generates contextual, venue-specific French/Italian/Japanese-inflected hospitality dialogue for guest arrivals, order taking, kitchen pass calls, wine/sake service, bill requests, and table bussing. |
| [`sync_to_mongodb_atlas.mjs`](file:///Users/ag/Workspace/restaurants/scripts/sync_to_mongodb_atlas.mjs) | Bulk-upserts all generated collections in `data/mongodb/*.json` to a live MongoDB Atlas cluster and creates the compound indexes required by the simulation and stream processor. |

---

## Usage

### Generate All 26 MongoDB Collections Locally
```bash
python3 scripts/build_month_simulation_db.py
```

### Sync Generated Collections & Indexes to MongoDB Atlas
```bash
MONGODB_URI="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/" node scripts/sync_to_mongodb_atlas.mjs
```
