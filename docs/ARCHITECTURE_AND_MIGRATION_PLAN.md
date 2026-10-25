# Multi-Venue 3D Simulation Platform: Codebase Audit, MongoDB Data-Model Proposal & Migration Plan

See full architecture specification and migration design for the Multi-Venue 3D Hospitality Street Simulation Platform.

## 1. Architectural Overview

1. **Multi-Venue Polymorphism (`BusinessSimulation` Contract)**:
   - `FullServiceRestaurantSimulation` (**Bistrot Lumière** — full-service French bistrot migrated from `lumiere` with Salle, Terrasse, Kitchen, and Bar).
   - `PizzaTakeawaySimulation` (**Marco's Pizza Napoletana** — counter/online orders, pizza prep table, deck oven, boxing/cut table, collection counter, no table reservations).
   - `CafeSimulation` (**Café Atelier** — counter queue, espresso machine & grinder, pastry vitrine, pickup counter, optional casual bistro tables).
2. **Shared Street-Level Clock & Deterministic Event Replay**:
   - All businesses on `street-001` ("Rue de la Lumière, Nice") share a synchronized simulation clock (`State(T) = Snapshot(T_0 <= T) + Events(T_0, T]`).
   - Supports play, pause, variable speed (`1x`, `10x`, `30x`, `60x`, `300x`), reverse scrubbing, step-by-event, and date selection across the migrated dataset.
3. **MongoDB Atlas Operational Data Store + Atlas Stream Processing**:
   - 21 multi-tenant collections with preserved source IDs and provenance (`sourceMeta: { system, originalTable, originalId, provenance }`).
   - Official `mongodb` driver connection via `MONGODB_URI` with automatic local collection persistence (`data/mongodb/`) and one-command Atlas sync (`npm run mongo:sync-atlas`).
   - Atlas Stream Processing pipeline (`backend/streams/atlasStreamProcessor.js`) for continuous event validation, venue routing, 5-minute tumbling-window KPIs (`streamVenueMetrics`), and low-stock alerting (`streamOperationalAlerts`).
4. **Interactive 3D Scene & Object Registry**:
   - Built on Three.js + React-Konva (reusing `HomeDesign` 3D room/furniture builders and `.glb` models), upgraded to a multi-premises street environment with cutaway walls, `THREE.Raycaster` selection, agent pathfinding interpolation, and a time-accurate Inspector panel.
