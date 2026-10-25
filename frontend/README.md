# Frontend — 3D Street Viewport, Venue Architecture, Culinary Assets & Provenance UI

The `frontend/` application renders the interactive **Multi-Venue 3D Hospitality Street Simulation** at 60 FPS using **Three.js**, **React 19**, **Zustand**, **React-Konva**, and **Tailwind CSS v4**.

---

## Component & Module Architecture

| File | Description |
| :--- | :--- |
| [`src/App.jsx`](file:///Users/ag/Workspace/restaurants/frontend/src/App.jsx) | Top-level workspace layout integrating the 3D/2D split view, restaurant filter tabs, live stream KPI header, and provenance banners. |
| [`src/store/useSimulationStore.js`](file:///Users/ag/Workspace/restaurants/frontend/src/store/useSimulationStore.js) | Deterministic client-side state projector (`projectStreetStateAtClient`), A* pathfinding interpolator (`buildCustomerActorsAt`, `buildStaffActorsAt`), forward/reverse playback engine (`playReverseTraceForDish`, `playReverseTraceForUnit`, `playForwardTraceForUnit`), and inspector selection state. |
| [`src/components/StreetScene3D.jsx`](file:///Users/ag/Workspace/restaurants/frontend/src/components/StreetScene3D.jsx) | Interactive WebGL/Three.js viewport with Orbit + WASD pedestrian controls, raycast selection (`table`, `station`, `employee`, `customer`, `dish_instance`, `stock_unit`), live HTML HUD overlays, and real-time 60 FPS character & prop animation loops. |
| [`src/components/scene3dBuilders.js`](file:///Users/ag/Workspace/restaurants/frontend/src/components/scene3dBuilders.js) | Procedural 3D builders for the boulevard streetscape (`buildParisianStreetEnvironment`), dining tables & chairs (`buildDiningTableGroup`), kitchen/bar stations (`buildKitchenStationGroup`), and articulated humanoid characters (`buildCharacterAvatar`). |
| [`src/components/venues/BistrotLumiere3D.js`](file:///Users/ag/Workspace/restaurants/frontend/src/components/venues/BistrotLumiere3D.js) | **Bistrot Lumière** bespoke 3D interior: Art Deco brass façade, red velvet banquettes, *Le Zinc* pewter bar, *Charvet* 8-burner stove island, framed *Passe Chaude* with copper heat lamps, and Parisian terrace. |
| [`src/components/venues/OsteriaBellavista3D.js`](file:///Users/ag/Workspace/restaurants/frontend/src/components/venues/OsteriaBellavista3D.js) | **Osteria Bellavista** bespoke 3D interior: brick-arch *Griglia Toscana a Legna* with glowing embers, 6-basket brass *Bollitore Pasta Fresca*, Carrara marble *Sfogliatura* bench, floor-to-ceiling *Enoteca* wine wall, and Tuscan olive terrace. |
| [`src/components/venues/SakanaTei3D.js`](file:///Users/ag/Workspace/restaurants/frontend/src/components/venues/SakanaTei3D.js) | **Sakana-Tei 魚亭** bespoke 3D interior: L-shaped Hinoki *Omakase* sushi counter with refrigerated glass *Neta* case, sunken *Binchotan Robatayaki* hearth, copper *Tempura & Ramen* cauldron station, glowing *Chōchin* lanterns, and *Noren* curtains. |
| [`src/components/assets/CulinaryAssets3D.js`](file:///Users/ag/Workspace/restaurants/frontend/src/components/assets/CulinaryAssets3D.js) | High-detail 3D cookware (`buildCookwareForTask`) and raycast-selectable plated dishes (`buildPlatedDishForOrder`, `scene-dish-*`) mapped to every menu item across all three restaurants. |
| [`src/components/assets/KitchenBarShelves3D.js`](file:///Users/ag/Workspace/restaurants/frontend/src/components/assets/KitchenBarShelves3D.js) | 3-tier × 6-slot sorted storage shelves (`buildSortedStorageShelves3D`) and back-bar bottle racks (`buildSortedBarShelves3D`) with clickable 3D physical stock units (`scene-unit-*`), fill-level indicators, and `#1 NEXT TO USE` FIFO badges. |
| [`src/components/ObjectInspectorPanel.jsx`](file:///Users/ag/Workspace/restaurants/frontend/src/components/ObjectInspectorPanel.jsx) | Multi-tab Inspector Panel for tables, plated dishes, physical stock units, kitchen/bar stations, and employees—featuring one-click reverse provenance (`⏪ Rembobiner jusqu'au Stock`) and forward ingredient tracing (`⏩ Suivre vers la Cuisine`). |
| [`src/components/FloorPlan2D.jsx`](file:///Users/ag/Workspace/restaurants/frontend/src/components/FloorPlan2D.jsx) | Synchronized 2D Konva architectural blueprint showing real-time agent positions, A* trajectories, table statuses, and station activity. |
| [`src/components/TimelineController.jsx`](file:///Users/ag/Workspace/restaurants/frontend/src/components/TimelineController.jsx) | Service date selector (`2026-10-01` .. `2026-10-31`), timeline scrubber, shift jump buttons (*Prep Matin*, *Rush Déjeuner*, *Mise en Place Soir*, *Rush Dîner*), and bidirectional playback speed controls (`-15x` .. `+60x`). |

---

## Articulated 3D Character States & Props

[`buildCharacterAvatar`](file:///Users/ag/Workspace/restaurants/frontend/src/components/scene3dBuilders.js#L510-L799) and the animation loop in [`StreetScene3D.jsx`](file:///Users/ag/Workspace/restaurants/frontend/src/components/StreetScene3D.jsx) drive context-aware postures and handheld 3D props:

- **Walking (`WALKING` / `ARRIVING` / `DEPARTING`)**: Natural bipedal leg/arm stride along A* floor-plan waypoints.
- **Seated Dining (`SEATED`)**: 90-degree hip/knee flexion seated neatly inside the assigned chair around the table, with subtle dining & conversation gestures.
- **Requesting & Paying Bill (`REQUESTING_BILL` / `PAYING_BILL` / `PAID_SEATED`)**: Lead guest raises their right arm holding a 3D gold payment card (`guestCardGroup`) when requesting the check, then taps the wireless TPE terminal when the waiter delivers the bill.
- **Waiter Service & POS/TPE Bill Delivery (`CARRYING_DISH` / `FETCHING_BILL` / `BRINGING_BILL`)**:
  - Carries a silver cloche & tray (`trayGroup`) when delivering plated dishes or bussing dirty plates to the Plonge.
  - Walks to the POS terminal (`pos-*-main`) on `BILL_REQUESTED` and carries a 3D leather check folder + glowing wireless TPE card reader (`billFolderGroup`) to the table on `BRINGING_BILL`.
- **Table Wiping & Plonge Bussing (`CLEARING_TABLE` / `BUSSING_TO_PLONGE`)**:
  - Vacated tables in `NEEDS_CLEARING` keep their dirty dishes visible until the waiter arrives, wipes the tabletop in a circular motion with a 3D blue microfiber cloth (`cleaningClothGroup`), loads the dirty plates onto a bussing tray, and walks to the dishwashing station (`plonge`).
- **Chef & Bartender Actions**: Chef pan-tossing/stirring (`panGroup`) at cooking stations and single-bottle bartender pouring at the bar.

---

## Development & Build Commands

```bash
# Install dependencies
npm install

# Start Vite dev server on port 5175
npm run dev -- --port 5175 --host

# Build production bundle into frontend/dist
npm run build

# Preview production build
npm run preview
```
