import { create } from "zustand";

const API_BASE = "";

/**
 * Builds a unified navigation graph across all premises on the street
 * and provides A* shortest-path waypoint routing through doorways and aisles.
 */
function buildUnifiedNavGraph(premisesList = []) {
  const nodesById = {};
  const adj = {};

  const addNode = (n, businessId) => {
    nodesById[n.id] = { ...n, businessId };
    if (!adj[n.id]) adj[n.id] = [];
  };

  const addEdge = (a, b) => {
    if (!nodesById[a] || !nodesById[b]) return;
    const dx = nodesById[a].x - nodesById[b].x;
    const dz = nodesById[a].z - nodesById[b].z;
    const cost = Math.hypot(dx, dz);
    adj[a].push({ to: b, cost });
    adj[b].push({ to: a, cost });
  };

  for (const prem of premisesList) {
    const ng = prem.navigationGraph || {};
    for (const n of ng.nodes || prem.navigationNodes || []) {
      addNode(n, prem.businessId);
    }
    for (const [a, b] of ng.edges || []) {
      addEdge(a, b);
    }
  }

  // Link street sidewalk across the three restaurants
  addEdge("bl-street-east", "ob-street-entry");
  addEdge("ob-street-east", "sk-street-entry");

  return { nodesById, adj, nodeList: Object.values(nodesById) };
}

function classifyZoneBand(z, businessId = null) {
  const kitchenBoundary = businessId === "business-bistrot-lumiere" ? 0.15 : 4.8;
  if (z < kitchenBoundary) return "kitchen";
  if (z <= 14.1) return "dining";
  return "exterior";
}

export function findNavigationPath(navGraph, fromX, fromZ, toX, toZ, businessId = null) {
  const directDist = Math.hypot(toX - fromX, toZ - fromZ);
  const fromBand = classifyZoneBand(fromZ, businessId);
  const toBand = classifyZoneBand(toZ, businessId);

  if (!navGraph || navGraph.nodeList.length === 0 || (directDist < 1.9 && fromBand === toBand)) {
    return [
      { x: fromX, z: fromZ },
      { x: toX, z: toZ },
    ];
  }

  const candidates = navGraph.nodeList.filter((n) => !businessId || !n.businessId || n.businessId === businessId);
  const pool = candidates.length > 0 ? candidates : navGraph.nodeList;

  const findNearestNode = (px, pz, band) => {
    let best = null;
    let bestScore = Infinity;
    for (const n of pool) {
      const nBand = classifyZoneBand(n.z, businessId);
      const d = Math.hypot(n.x - px, n.z - pz);
      const penalty = nBand === band ? 0 : 6.0;
      if (d + penalty < bestScore) {
        bestScore = d + penalty;
        best = n;
      }
    }
    return best;
  };

  const startNode = findNearestNode(fromX, fromZ, fromBand);
  const endNode = findNearestNode(toX, toZ, toBand);
  if (!startNode || !endNode) {
    return [
      { x: fromX, z: fromZ },
      { x: toX, z: toZ },
    ];
  }

  if (startNode.id === endNode.id) {
    return [
      { x: fromX, z: fromZ },
      { x: startNode.x, z: startNode.z },
      { x: toX, z: toZ },
    ];
  }

  // A* search between startNode.id and endNode.id
  const openSet = new Set([startNode.id]);
  const cameFrom = {};
  const gScore = { [startNode.id]: 0 };
  const fScore = {
    [startNode.id]: Math.hypot(endNode.x - startNode.x, endNode.z - startNode.z),
  };

  while (openSet.size > 0) {
    let current = null;
    let lowestF = Infinity;
    for (const id of openSet) {
      const f = fScore[id] ?? Infinity;
      if (f < lowestF) {
        lowestF = f;
        current = id;
      }
    }

    if (!current) break;
    if (current === endNode.id) {
      const midNodes = [];
      let curr = current;
      while (curr) {
        const nd = navGraph.nodesById[curr];
        if (nd) midNodes.push({ x: nd.x, z: nd.z, nodeId: nd.id });
        curr = cameFrom[curr];
      }
      midNodes.reverse();
      return simplifyPolyline([{ x: fromX, z: fromZ }, ...midNodes, { x: toX, z: toZ }]);
    }

    openSet.delete(current);
    for (const edge of navGraph.adj[current] || []) {
      const tentativeG = (gScore[current] ?? Infinity) + edge.cost;
      if (tentativeG < (gScore[edge.to] ?? Infinity)) {
        cameFrom[edge.to] = current;
        gScore[edge.to] = tentativeG;
        const targetNode = navGraph.nodesById[edge.to];
        const h = targetNode ? Math.hypot(endNode.x - targetNode.x, endNode.z - targetNode.z) : 0;
        fScore[edge.to] = tentativeG + h;
        openSet.add(edge.to);
      }
    }
  }

  return [
    { x: fromX, z: fromZ },
    { x: toX, z: toZ },
  ];
}

function simplifyPolyline(pts) {
  if (pts.length <= 2) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const prev = out[out.length - 1];
    if (Math.hypot(pts[i].x - prev.x, pts[i].z - prev.z) > 0.25 || i === pts.length - 1) {
      out.push(pts[i]);
    }
  }
  return out;
}

function samplePolylineAt(points, tNorm) {
  if (!points || points.length === 0) return { x: 0, z: 0, headingRad: 0 };
  if (points.length === 1) return { x: points[0].x, z: points[0].z, headingRad: 0 };

  const segLengths = [];
  let totalLength = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const len = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].z - points[i].z);
    segLengths.push(len);
    totalLength += len;
  }

  if (totalLength < 0.001) {
    return { x: points[points.length - 1].x, z: points[points.length - 1].z, headingRad: 0 };
  }

  const targetDist = Math.max(0, Math.min(1, tNorm)) * totalLength;
  let accum = 0;
  for (let i = 0; i < segLengths.length; i++) {
    const segLen = segLengths[i];
    if (accum + segLen >= targetDist || i === segLengths.length - 1) {
      const localT = segLen > 0.0001 ? (targetDist - accum) / segLen : 1;
      const p0 = points[i];
      const p1 = points[i + 1];
      const x = p0.x + (p1.x - p0.x) * localT;
      const z = p0.z + (p1.z - p0.z) * localT;
      const headingRad = Math.atan2(p1.x - p0.x, p1.z - p0.z);
      return { x, z, headingRad };
    }
    accum += segLen;
  }

  const last = points[points.length - 1];
  return { x: last.x, z: last.z, headingRad: 0 };
}

/**
 * Ensures deterministic physical stockUnits (with shelfTier, shelfSlot, fifoOrder, initialQty,
 * consumptionHistory, contentionLog) and dishInstances (with full stages & ingredientUnitsUsed)
 * exist even if a dayBundle only provides raw events/orders, while preserving backend stockUnits
 * and dishInstances whenever provided.
 */
function ensureProvenanceCatalog(bootstrap, dayBundle) {
  const events = dayBundle?.events || [];
  const baseMs =
    events[0]?.eventTimeMs ||
    Date.parse(`${dayBundle?.serviceDate || "2025-06-14"}T08:00:00+02:00`);
  const lunchMs = Date.parse(`${dayBundle?.serviceDate || "2025-06-14"}T12:18:00+02:00`);

  let rawStockUnits = Array.isArray(dayBundle?.stockUnits) && dayBundle.stockUnits.length > 0
    ? dayBundle.stockUnits
    : null;

  if (!rawStockUnits) {
    rawStockUnits = [
      // BISTROT LUMIÈRE — Cold Storage (storage-bl-cold) & Garde-Manger (station-bl-saladette) & Bar (station-bl-bar)
      {
        unitId: "unit-bl-concombre-1",
        sceneObjectId: "scene-unit-unit-bl-concombre-1",
        businessId: "business-bistrot-lumiere",
        stationId: "storage-bl-cold",
        storageSceneObjectId: "scene-bl-storage-cold",
        ingredientId: "ing-concombre-bio",
        ingredientName: "Concombre Bio de Provence",
        unitLabel: "Concombre Bio #1 (150g)",
        category: "Produce · Légumes Frais",
        shelfTier: 2,
        shelfSlot: 0,
        fifoOrder: 1,
        initialQty: 150,
        remainingQty: 150,
        unit: "g",
        visualType: "cucumber_unit",
        deliveredAtMs: baseMs,
        supplierName: "Maraîchers du Cours Saleya",
        consumptionHistory: [
          {
            stepIndex: 1,
            timestampMs: lunchMs + 4 * 60000,
            takenAtMs: lunchMs + 4 * 60000,
            returnedAtMs: lunchMs + 6 * 60000,
            actorAgentId: "agent-emp-sofia",
            actorName: "Sofia Rossi (Second de Cuisine)",
            cookId: "agent-emp-sofia",
            cookName: "Sofia Rossi",
            stationId: "station-bl-saladette",
            dishInstanceId: "dish-bl-salade-nicoise-1",
            dishName: "Salade Niçoise Tradition",
            orderId: "ord-bl-lunch-1",
            tableId: "table-bl-1",
            tableLabel: "Table 1",
            qtyTaken: 30,
            remainingBefore: 150,
            remainingAfter: 120,
            unit: "g",
            action: "TAKEN_USED_RETURNED",
            notes: "Prélèvement 30g sur Concombre #1 (150g → 120g) et retour immédiat sur Étagère Niveau 2 Slot #1",
          },
          {
            stepIndex: 2,
            timestampMs: lunchMs + 7 * 60000,
            takenAtMs: lunchMs + 7 * 60000,
            returnedAtMs: lunchMs + 9 * 60000,
            actorAgentId: "agent-emp-hugo",
            actorName: "Hugo Blanc (Commis Garde-Manger)",
            cookId: "agent-emp-hugo",
            cookName: "Hugo Blanc",
            stationId: "station-bl-saladette",
            dishInstanceId: "dish-bl-carpaccio-concombre-2",
            dishName: "Tartare de Daurade & Concombre Croquant",
            orderId: "ord-bl-lunch-2",
            tableId: "table-bl-3",
            tableLabel: "Table 3",
            qtyTaken: 30,
            remainingBefore: 120,
            remainingAfter: 90,
            unit: "g",
            action: "TAKEN_AFTER_MUTEX_WAIT",
            notes: "Pris après retour de Sofia Rossi : 30g prélevés sur le même Concombre #1 (120g → 90g restants)",
          },
        ],
        contentionLog: [
          {
            timestampMs: lunchMs + 4.5 * 60000,
            resolvedAtMs: lunchMs + 6 * 60000,
            waitingAgentId: "agent-emp-hugo",
            waitingAgentName: "Hugo Blanc (Commis)",
            holderAgentId: "agent-emp-sofia",
            holderAgentName: "Sofia Rossi (Second)",
            resolution: "WAIT_FOR_RETURN_FIFO_COHERENT",
            reason:
              "Concombre #1 (150g) déjà en main par Sofia Rossi (-30g en cours). Hugo Blanc patiente au lieu d'entamer Concombre #2, puis utilise les 120g restants (→ 90g).",
          },
        ],
      },
      {
        unitId: "unit-bl-concombre-2",
        sceneObjectId: "scene-unit-unit-bl-concombre-2",
        businessId: "business-bistrot-lumiere",
        stationId: "storage-bl-cold",
        storageSceneObjectId: "scene-bl-storage-cold",
        ingredientId: "ing-concombre-bio",
        ingredientName: "Concombre Bio de Provence",
        unitLabel: "Concombre Bio #2 (150g · Intact FIFO #2)",
        category: "Produce · Légumes Frais",
        shelfTier: 2,
        shelfSlot: 1,
        fifoOrder: 2,
        initialQty: 150,
        remainingQty: 150,
        unit: "g",
        visualType: "cucumber_unit",
        deliveredAtMs: baseMs,
        supplierName: "Maraîchers du Cours Saleya",
        consumptionHistory: [],
        contentionLog: [],
      },
      {
        unitId: "unit-bl-filet-boeuf-1",
        sceneObjectId: "scene-unit-unit-bl-filet-boeuf-1",
        businessId: "business-bistrot-lumiere",
        stationId: "storage-bl-cold",
        storageSceneObjectId: "scene-bl-storage-cold",
        ingredientId: "ing-filet-charolais",
        ingredientName: "Filet de Bœuf Charolais Maturé",
        unitLabel: "Pièce Filet Charolais #1 (1200g)",
        category: "Proteins · Viandes Maturées",
        shelfTier: 1,
        shelfSlot: 0,
        fifoOrder: 1,
        initialQty: 1200,
        remainingQty: 1200,
        unit: "g",
        visualType: "protein_cut",
        deliveredAtMs: baseMs,
        supplierName: "Boucherie des Terroirs",
        consumptionHistory: [
          {
            stepIndex: 1,
            timestampMs: lunchMs + 10 * 60000,
            takenAtMs: lunchMs + 10 * 60000,
            returnedAtMs: lunchMs + 13 * 60000,
            actorAgentId: "agent-emp-karim",
            actorName: "Karim Benali (Chef de Cuisine)",
            cookId: "agent-emp-karim",
            cookName: "Karim Benali",
            stationId: "station-bl-piano",
            dishInstanceId: "dish-bl-boeuf-rossini-1",
            dishName: "Tournedos de Bœuf Rossini au Foie Gras",
            orderId: "ord-bl-lunch-1",
            tableId: "table-bl-1",
            tableLabel: "Table 1",
            qtyTaken: 440,
            remainingBefore: 1200,
            remainingAfter: 760,
            unit: "g",
            action: "TAKEN_USED_RETURNED",
            notes: "Découpe de 2 tournedos (440g) au Piano Central, pièce de 760g remise au froid Niveau 1",
          },
        ],
        contentionLog: [],
      },
      {
        unitId: "unit-bl-loup-mer-1",
        sceneObjectId: "scene-unit-unit-bl-loup-mer-1",
        businessId: "business-bistrot-lumiere",
        stationId: "storage-bl-cold",
        storageSceneObjectId: "scene-bl-storage-cold",
        ingredientId: "ing-loup-mediterranee",
        ingredientName: "Loup de Méditerranée Sauvage",
        unitLabel: "Bac Loup de Mer #1 (1800g)",
        category: "Proteins · Marée Fraîche",
        shelfTier: 1,
        shelfSlot: 1,
        fifoOrder: 1,
        initialQty: 1800,
        remainingQty: 1800,
        unit: "g",
        visualType: "fish_fillet_box",
        deliveredAtMs: baseMs,
        supplierName: "Criée de Nice-Cros-de-Cagnes",
        consumptionHistory: [
          {
            stepIndex: 1,
            timestampMs: lunchMs + 12 * 60000,
            takenAtMs: lunchMs + 12 * 60000,
            returnedAtMs: lunchMs + 15 * 60000,
            actorAgentId: "agent-emp-karim",
            actorName: "Karim Benali (Chef de Cuisine)",
            cookId: "agent-emp-karim",
            cookName: "Karim Benali",
            stationId: "station-bl-piano",
            dishInstanceId: "dish-bl-loup-fenouil-1",
            dishName: "Filet de Loup Rôti au Fenouil Sauvage",
            orderId: "ord-bl-lunch-2",
            tableId: "table-bl-3",
            tableLabel: "Table 3",
            qtyTaken: 480,
            remainingBefore: 1800,
            remainingAfter: 1320,
            unit: "g",
            action: "TAKEN_USED_RETURNED",
            notes: "Levage de 2 filets (480g), retour bac glacé (1320g)",
          },
        ],
        contentionLog: [],
      },
      {
        unitId: "unit-bl-beurre-echire-1",
        sceneObjectId: "scene-unit-unit-bl-beurre-echire-1",
        businessId: "business-bistrot-lumiere",
        stationId: "storage-bl-cold",
        storageSceneObjectId: "scene-bl-storage-cold",
        ingredientId: "ing-beurre-echire",
        ingredientName: "Beurre de Baratte AOP Échiré",
        unitLabel: "Motte Beurre Échiré #1 (500g)",
        category: "Dairy · Crémerie AOP",
        shelfTier: 3,
        shelfSlot: 0,
        fifoOrder: 1,
        initialQty: 500,
        remainingQty: 500,
        unit: "g",
        visualType: "dairy_butter_block",
        deliveredAtMs: baseMs,
        supplierName: "Maison des Fromagers",
        consumptionHistory: [
          {
            stepIndex: 1,
            timestampMs: lunchMs + 11 * 60000,
            takenAtMs: lunchMs + 11 * 60000,
            returnedAtMs: lunchMs + 13 * 60000,
            actorAgentId: "agent-emp-karim",
            actorName: "Karim Benali (Chef de Cuisine)",
            cookId: "agent-emp-karim",
            cookName: "Karim Benali",
            stationId: "station-bl-piano",
            dishInstanceId: "dish-bl-boeuf-rossini-1",
            dishName: "Tournedos de Bœuf Rossini au Foie Gras",
            orderId: "ord-bl-lunch-1",
            tableId: "table-bl-1",
            tableLabel: "Table 1",
            qtyTaken: 65,
            remainingBefore: 500,
            remainingAfter: 435,
            unit: "g",
            action: "TAKEN_USED_RETURNED",
            notes: "Arrosage au beurre noisette (65g) au sautoir cuivre",
          },
        ],
        contentionLog: [],
      },
      {
        unitId: "unit-bl-chablis-bottle-1",
        sceneObjectId: "scene-unit-unit-bl-chablis-bottle-1",
        businessId: "business-bistrot-lumiere",
        stationId: "station-bl-bar",
        storageSceneObjectId: "scene-bl-station-bl-bar",
        ingredientId: "ing-vin-chablis-1er-cru",
        ingredientName: "Chablis 1er Cru Montmains 2021",
        unitLabel: "Bouteille Chablis 1er Cru #1 (750ml)",
        category: "Wine & Spirits · Cave du Bar",
        shelfTier: 1,
        shelfSlot: 0,
        fifoOrder: 1,
        initialQty: 750,
        remainingQty: 750,
        unit: "ml",
        visualType: "wine_bottle",
        deliveredAtMs: baseMs,
        supplierName: "Domaines de Bourgogne",
        consumptionHistory: [
          {
            stepIndex: 1,
            timestampMs: lunchMs + 5 * 60000,
            takenAtMs: lunchMs + 5 * 60000,
            returnedAtMs: lunchMs + 6.5 * 60000,
            actorAgentId: "agent-emp-manon",
            actorName: "Manon Leclerc (Cheffe Barmaid)",
            cookId: "agent-emp-manon",
            cookName: "Manon Leclerc",
            stationId: "station-bl-bar",
            dishInstanceId: "dish-bl-chablis-verre-1",
            dishName: "2 Verres de Chablis 1er Cru (250ml)",
            orderId: "ord-bl-lunch-1",
            tableId: "table-bl-1",
            tableLabel: "Table 1",
            qtyTaken: 250,
            remainingBefore: 750,
            remainingAfter: 500,
            unit: "ml",
            action: "BAR_POUR_RETURNED",
            notes: "Manon Leclerc prend la bouteille #1 sur l'étagère du bar, sert 2×125ml (500ml restants) et repose la bouteille.",
          },
        ],
        contentionLog: [],
      },
      {
        unitId: "unit-bl-pauillac-bottle-1",
        sceneObjectId: "scene-unit-unit-bl-pauillac-bottle-1",
        businessId: "business-bistrot-lumiere",
        stationId: "station-bl-bar",
        storageSceneObjectId: "scene-bl-station-bl-bar",
        ingredientId: "ing-vin-pauillac",
        ingredientName: "Château Batailley Pauillac Grand Cru",
        unitLabel: "Bouteille Pauillac #1 (750ml)",
        category: "Wine & Spirits · Cave du Bar",
        shelfTier: 2,
        shelfSlot: 0,
        fifoOrder: 1,
        initialQty: 750,
        remainingQty: 750,
        unit: "ml",
        visualType: "wine_bottle_red",
        deliveredAtMs: baseMs,
        supplierName: "Grands Crus Bordelais",
        consumptionHistory: [
          {
            stepIndex: 1,
            timestampMs: lunchMs + 9 * 60000,
            takenAtMs: lunchMs + 9 * 60000,
            returnedAtMs: lunchMs + 10.5 * 60000,
            actorAgentId: "agent-emp-manon",
            actorName: "Manon Leclerc (Cheffe Barmaid)",
            cookId: "agent-emp-manon",
            cookName: "Manon Leclerc",
            stationId: "station-bl-bar",
            dishInstanceId: "dish-bl-pauillac-verre-1",
            dishName: "Carafe & 2 Verres Pauillac (300ml)",
            orderId: "ord-bl-lunch-1",
            tableId: "table-bl-1",
            tableLabel: "Table 1",
            qtyTaken: 300,
            remainingBefore: 750,
            remainingAfter: 450,
            unit: "ml",
            action: "BAR_POUR_RETURNED",
            notes: "Service de 2 verres de dégustation (300ml), bouteille remise au râtelier Niveau 2 (450ml restants).",
          },
        ],
        contentionLog: [],
      },

      // OSTERIA BELLAVISTA — Cold Storage (storage-ob-cold) & Bar (station-ob-bar)
      {
        unitId: "unit-ob-chianina-1",
        sceneObjectId: "scene-unit-unit-ob-chianina-1",
        businessId: "business-osteria-bellavista",
        stationId: "storage-ob-cold",
        storageSceneObjectId: "scene-ob-storage-cold",
        ingredientId: "ing-bistecca-chianina",
        ingredientName: "Lombo di Chianina IGP (Maturation 40j)",
        unitLabel: "Carré Bistecca Fiorentina #1 (2400g)",
        category: "Proteins · Macelleria Toscana",
        shelfTier: 1,
        shelfSlot: 0,
        fifoOrder: 1,
        initialQty: 2400,
        remainingQty: 2400,
        unit: "g",
        visualType: "protein_cut",
        deliveredAtMs: baseMs,
        supplierName: "Antica Macelleria Falorni",
        consumptionHistory: [
          {
            stepIndex: 1,
            timestampMs: lunchMs + 8 * 60000,
            takenAtMs: lunchMs + 8 * 60000,
            returnedAtMs: lunchMs + 11 * 60000,
            actorAgentId: "agent-emp-ob-marco",
            actorName: "Marco Conti (Chef Grillardin)",
            cookId: "agent-emp-ob-marco",
            cookName: "Marco Conti",
            stationId: "station-ob-grill",
            dishInstanceId: "dish-ob-bistecca-1",
            dishName: "Bistecca alla Fiorentina sulla Brace",
            orderId: "ord-ob-lunch-1",
            tableId: "table-ob-1",
            tableLabel: "Tavolo 1",
            qtyTaken: 950,
            remainingBefore: 2400,
            remainingAfter: 1450,
            unit: "g",
            action: "TAKEN_USED_RETURNED",
            notes: "Découpe d'une côte à l'os de 950g pour Tavolo 1, carré de 1450g remis en chambre froide Niveau 1.",
          },
        ],
        contentionLog: [],
      },
      {
        unitId: "unit-ob-pomodoro-sanj-1",
        sceneObjectId: "scene-unit-unit-ob-pomodoro-sanj-1",
        businessId: "business-osteria-bellavista",
        stationId: "storage-ob-cold",
        storageSceneObjectId: "scene-ob-storage-cold",
        ingredientId: "ing-pomodoro-san-marzano",
        ingredientName: "Pomodori San Marzano DOP & Basilico",
        unitLabel: "Cagette San Marzano #1 (1000g)",
        category: "Produce · Orto Toscano",
        shelfTier: 2,
        shelfSlot: 0,
        fifoOrder: 1,
        initialQty: 1000,
        remainingQty: 1000,
        unit: "g",
        visualType: "produce_crate",
        deliveredAtMs: baseMs,
        supplierName: "Mercato Centrale Firenze",
        consumptionHistory: [
          {
            stepIndex: 1,
            timestampMs: lunchMs + 6 * 60000,
            takenAtMs: lunchMs + 6 * 60000,
            returnedAtMs: lunchMs + 8 * 60000,
            actorAgentId: "agent-emp-ob-giulia",
            actorName: "Giulia Ferri (Sfoglina Pasta)",
            cookId: "agent-emp-ob-giulia",
            cookName: "Giulia Ferri",
            stationId: "station-ob-pasta",
            dishInstanceId: "dish-ob-pappardelle-1",
            dishName: "Pappardelle Fresche al Cinghiale & San Marzano",
            orderId: "ord-ob-lunch-1",
            tableId: "table-ob-1",
            tableLabel: "Tavolo 1",
            qtyTaken: 280,
            remainingBefore: 1000,
            remainingAfter: 720,
            unit: "g",
            action: "TAKEN_USED_RETURNED",
            notes: "Prélèvement de 280g de tomates San Marzano (720g restants).",
          },
        ],
        contentionLog: [],
      },
      {
        unitId: "unit-ob-chianti-bottle-1",
        sceneObjectId: "scene-unit-unit-ob-chianti-bottle-1",
        businessId: "business-osteria-bellavista",
        stationId: "station-ob-bar",
        storageSceneObjectId: "scene-ob-station-ob-bar",
        ingredientId: "ing-chianti-classico-riserva",
        ingredientName: "Chianti Classico Riserva DOCG",
        unitLabel: "Fiasco Chianti Classico #1 (750ml)",
        category: "Wine & Spirits · Enoteca Bar",
        shelfTier: 1,
        shelfSlot: 0,
        fifoOrder: 1,
        initialQty: 750,
        remainingQty: 750,
        unit: "ml",
        visualType: "wine_bottle_red",
        deliveredAtMs: baseMs,
        supplierName: "Tenuta del Chianti",
        consumptionHistory: [
          {
            stepIndex: 1,
            timestampMs: lunchMs + 7 * 60000,
            takenAtMs: lunchMs + 7 * 60000,
            returnedAtMs: lunchMs + 8.5 * 60000,
            actorAgentId: "agent-emp-ob-alessandro",
            actorName: "Alessandro Moretti (Sommelier Barman)",
            cookId: "agent-emp-ob-alessandro",
            cookName: "Alessandro Moretti",
            stationId: "station-ob-bar",
            dishInstanceId: "dish-ob-chianti-calici-1",
            dishName: "2 Calici di Chianti Classico Riserva (300ml)",
            orderId: "ord-ob-lunch-1",
            tableId: "table-ob-1",
            tableLabel: "Tavolo 1",
            qtyTaken: 300,
            remainingBefore: 750,
            remainingAfter: 450,
            unit: "ml",
            action: "BAR_POUR_RETURNED",
            notes: "Service au verre (300ml) et remise en étagère Enoteca (450ml restants).",
          },
        ],
        contentionLog: [],
      },

      // SAKANA-TEI 魚亭 — Cold Storage (storage-sk-cold) & Sake Bar (station-sk-bar)
      {
        unitId: "unit-sk-otoro-saku-1",
        sceneObjectId: "scene-unit-unit-sk-otoro-saku-1",
        businessId: "business-sakana-tei",
        stationId: "storage-sk-cold",
        storageSceneObjectId: "scene-sk-storage-cold",
        ingredientId: "ing-hon-maguro-otoro",
        ingredientName: "Hon-Maguro Otoro (Thon Rouge Sauvage)",
        unitLabel: "Pavé Saku Otoro #1 (600g)",
        category: "Proteins · Toyosu Sashimi Grade",
        shelfTier: 1,
        shelfSlot: 0,
        fifoOrder: 1,
        initialQty: 600,
        remainingQty: 600,
        unit: "g",
        visualType: "fish_fillet_box",
        deliveredAtMs: baseMs,
        supplierName: "Criée & Import Toyosu",
        consumptionHistory: [
          {
            stepIndex: 1,
            timestampMs: lunchMs + 6 * 60000,
            takenAtMs: lunchMs + 6 * 60000,
            returnedAtMs: lunchMs + 8 * 60000,
            actorAgentId: "agent-emp-sk-kenji",
            actorName: "Maître Kenji Takahashi (Itamae Chef)",
            cookId: "agent-emp-sk-kenji",
            cookName: "Kenji Takahashi",
            stationId: "station-sk-sushi",
            dishInstanceId: "dish-sk-omakase-geta-1",
            dishName: "Assortiment Omakase Nigiri & Otoro sur Geta Hinoki",
            orderId: "ord-sk-lunch-1",
            tableId: "table-sk-1",
            tableLabel: "Comptoir Hinoki 1",
            qtyTaken: 160,
            remainingBefore: 600,
            remainingAfter: 440,
            unit: "g",
            action: "TAKEN_USED_RETURNED",
            notes: "Découpe Yanagiba de 160g sur le bloc Saku #1 (440g remis en coffre réfrigéré Hinoki).",
          },
        ],
        contentionLog: [],
      },
      {
        unitId: "unit-sk-sake-junmai-1",
        sceneObjectId: "scene-unit-unit-sk-sake-junmai-1",
        businessId: "business-sakana-tei",
        stationId: "station-sk-bar",
        storageSceneObjectId: "scene-sk-station-sk-bar",
        ingredientId: "ing-sake-daiginjo",
        ingredientName: "Saké Junmai Daiginjo Dassai 23",
        unitLabel: "Bouteille Dassai 23 #1 (720ml)",
        category: "Wine & Spirits · Sake Bar",
        shelfTier: 1,
        shelfSlot: 0,
        fifoOrder: 1,
        initialQty: 720,
        remainingQty: 720,
        unit: "ml",
        visualType: "sake_bottle",
        deliveredAtMs: baseMs,
        supplierName: "Maison Yamaguchi Sake",
        consumptionHistory: [
          {
            stepIndex: 1,
            timestampMs: lunchMs + 7 * 60000,
            takenAtMs: lunchMs + 7 * 60000,
            returnedAtMs: lunchMs + 8.5 * 60000,
            actorAgentId: "agent-emp-sk-yuki",
            actorName: "Yuki Sato (Kikisake-shi Sommelier)",
            cookId: "agent-emp-sk-yuki",
            cookName: "Yuki Sato",
            stationId: "station-sk-bar",
            dishInstanceId: "dish-sk-tokkuri-1",
            dishName: "Carafe Tokkuri Saké Daiginjo (180ml)",
            orderId: "ord-sk-lunch-1",
            tableId: "table-sk-1",
            tableLabel: "Comptoir Hinoki 1",
            qtyTaken: 180,
            remainingBefore: 720,
            remainingAfter: 540,
            unit: "ml",
            action: "BAR_POUR_RETURNED",
            notes: "Service d'un Tokkuri de 180ml, bouteille remise au frais (540ml restants).",
          },
        ],
        contentionLog: [],
      },
    ];
  }

  let rawDishInstances = Array.isArray(dayBundle?.dishInstances) && dayBundle.dishInstances.length > 0
    ? dayBundle.dishInstances
    : null;

  if (!rawDishInstances) {
    rawDishInstances = [
      {
        dishInstanceId: "dish-bl-salade-nicoise-1",
        sceneObjectId: "scene-dish-dish-bl-salade-nicoise-1",
        businessId: "business-bistrot-lumiere",
        orderId: "ord-bl-lunch-1",
        tableId: "table-bl-1",
        tableLabel: "Table 1",
        course: 1,
        dishName: "Salade Niçoise Tradition & Concombre Bio",
        visualAsset: "cold_plated_dish",
        recipeSummary: "Concombre Bio de Provence croquant (30g), thon germon, tomates cœur de bœuf, olives de Nice",
        stationId: "station-bl-saladette",
        cookAgentId: "agent-emp-sofia",
        cookName: "Sofia Rossi (Second de Cuisine)",
        waiterAgentId: "agent-emp-thomas",
        waiterName: "Thomas Moreau (Maître d'Hôtel)",
        orderedAtMs: lunchMs + 1 * 60000,
        prepStartedAtMs: lunchMs + 4 * 60000,
        readyAtPassMs: lunchMs + 14 * 60000,
        pickedUpAtMs: lunchMs + 15.5 * 60000,
        deliveredAtMs: lunchMs + 17 * 60000,
        ingredientUnitsUsed: [
          {
            unitId: "unit-bl-concombre-1",
            sceneObjectId: "scene-unit-unit-bl-concombre-1",
            unitLabel: "Concombre Bio #1 (150g)",
            ingredientName: "Concombre Bio de Provence",
            qtyUsed: 30,
            remainingBefore: 150,
            remainingAfter: 120,
            unit: "g",
            shelfTier: 2,
            shelfSlot: 0,
            storageStationId: "storage-bl-cold",
            takenAtMs: lunchMs + 4 * 60000,
            returnedAtMs: lunchMs + 6 * 60000,
          },
        ],
        stages: [
          {
            stage: "STOCK_DELIVERED",
            label: "Réception Chambre Froide (Concombre Bio #1 · 150g)",
            timestampMs: baseMs,
            actorAgentId: "agent-emp-karim",
            actorName: "Karim Benali",
            stationId: "storage-bl-cold",
            sceneObjectId: "scene-bl-storage-cold",
            detail: "Livraison matinale rangée sur Étagère Niveau 2 (Slot #1 FIFO)",
          },
          {
            stage: "INGREDIENT_TAKEN",
            label: "Prélèvement Ingrédient (30g sur Concombre #1 → 120g restants)",
            timestampMs: lunchMs + 4 * 60000,
            actorAgentId: "agent-emp-sofia",
            actorName: "Sofia Rossi",
            stationId: "storage-bl-cold",
            sceneObjectId: "scene-unit-unit-bl-concombre-1",
            detail: "Sofia Rossi prend Concombre Bio #1 (150g), taille 30g et repose les 120g restants au froid",
          },
          {
            stage: "COOKING_AT_STATION",
            label: "Dressage au Garde-Manger (Sofia Rossi)",
            timestampMs: lunchMs + 6 * 60000,
            actorAgentId: "agent-emp-sofia",
            actorName: "Sofia Rossi",
            stationId: "station-bl-saladette",
            sceneObjectId: "scene-bl-station-bl-saladette",
            detail: "Assaisonnement huile d'olive de Nice et dressage sur assiette froide",
          },
          {
            stage: "PLATED_AT_PASS",
            label: "Dépose au Passe Chaud & Annonce",
            timestampMs: lunchMs + 14 * 60000,
            actorAgentId: "agent-emp-sofia",
            actorName: "Sofia Rossi",
            stationId: "station-bl-passe",
            sceneObjectId: "scene-bl-station-bl-passe",
            detail: "Plat prêt au passe, attente enlèvement par Thomas Moreau",
          },
          {
            stage: "PICKED_UP_BY_WAITER",
            label: "Enlèvement au Passe par Thomas Moreau",
            timestampMs: lunchMs + 15.5 * 60000,
            actorAgentId: "agent-emp-thomas",
            actorName: "Thomas Moreau",
            stationId: "station-bl-passe",
            sceneObjectId: "scene-agent-emp-thomas",
            detail: "Thomas Moreau prend l'assiette sur plateau et se dirige vers la Table 1",
          },
          {
            stage: "SERVED_AT_TABLE",
            label: "Servi à la Table 1",
            timestampMs: lunchMs + 17 * 60000,
            actorAgentId: "agent-emp-thomas",
            actorName: "Thomas Moreau",
            stationId: "table-bl-1",
            sceneObjectId: "scene-bl-table-1",
            detail: "Déposé devant les convives de la Table 1",
          },
        ],
      },
      {
        dishInstanceId: "dish-bl-carpaccio-concombre-2",
        sceneObjectId: "scene-dish-dish-bl-carpaccio-concombre-2",
        businessId: "business-bistrot-lumiere",
        orderId: "ord-bl-lunch-2",
        tableId: "table-bl-3",
        tableLabel: "Table 3",
        course: 1,
        dishName: "Tartare de Daurade & Concombre Croquant",
        visualAsset: "cold_plated_dish",
        recipeSummary: "Daurade royale au couteau, brunoise de Concombre Bio #1 (30g pris après Sofia → 90g restants)",
        stationId: "station-bl-saladette",
        cookAgentId: "agent-emp-hugo",
        cookName: "Hugo Blanc (Commis Garde-Manger)",
        waiterAgentId: "agent-emp-chloe",
        waiterName: "Chloé Dubois (Cheffe de Rang)",
        orderedAtMs: lunchMs + 2 * 60000,
        prepStartedAtMs: lunchMs + 7 * 60000,
        readyAtPassMs: lunchMs + 16 * 60000,
        pickedUpAtMs: lunchMs + 17.5 * 60000,
        deliveredAtMs: lunchMs + 19 * 60000,
        ingredientUnitsUsed: [
          {
            unitId: "unit-bl-concombre-1",
            sceneObjectId: "scene-unit-unit-bl-concombre-1",
            unitLabel: "Concombre Bio #1 (120g → 90g)",
            ingredientName: "Concombre Bio de Provence",
            qtyUsed: 30,
            remainingBefore: 120,
            remainingAfter: 90,
            unit: "g",
            shelfTier: 2,
            shelfSlot: 0,
            storageStationId: "storage-bl-cold",
            takenAtMs: lunchMs + 7 * 60000,
            returnedAtMs: lunchMs + 9 * 60000,
            contentionNote: "Attendu 90s que Sofia Rossi repose le Concombre #1 (120g) — Concombre #2 resté intact",
          },
        ],
        stages: [
          {
            stage: "STOCK_DELIVERED",
            label: "Réception Chambre Froide (Concombre Bio #1 · 150g)",
            timestampMs: baseMs,
            actorAgentId: "agent-emp-karim",
            actorName: "Karim Benali",
            stationId: "storage-bl-cold",
            sceneObjectId: "scene-bl-storage-cold",
            detail: "Rangé sur Étagère Niveau 2 Slot #1",
          },
          {
            stage: "MUTEX_CONTENTION_WAIT",
            label: "Attente Coordonnée Mutex (Concombre #1 en main par Sofia Rossi)",
            timestampMs: lunchMs + 4.5 * 60000,
            actorAgentId: "agent-emp-hugo",
            actorName: "Hugo Blanc",
            stationId: "storage-bl-cold",
            sceneObjectId: "scene-unit-unit-bl-concombre-1",
            detail: "Hugo Blanc attend le retour du Concombre #1 entamé (120g) au lieu d'ouvrir le Concombre #2",
          },
          {
            stage: "INGREDIENT_TAKEN",
            label: "Reprise Concombre #1 (120g → 90g après coupe de 30g)",
            timestampMs: lunchMs + 7 * 60000,
            actorAgentId: "agent-emp-hugo",
            actorName: "Hugo Blanc",
            stationId: "storage-bl-cold",
            sceneObjectId: "scene-unit-unit-bl-concombre-1",
            detail: "Hugo Blanc prélève 30g sur le Concombre #1 et repose 90g sur l'étagère",
          },
          {
            stage: "COOKING_AT_STATION",
            label: "Taillage & Dressage au Garde-Manger (Hugo Blanc)",
            timestampMs: lunchMs + 9 * 60000,
            actorAgentId: "agent-emp-hugo",
            actorName: "Hugo Blanc",
            stationId: "station-bl-saladette",
            sceneObjectId: "scene-bl-station-bl-saladette",
            detail: "Brunoise de concombre bio et tartare de daurade aux agrumes",
          },
          {
            stage: "PLATED_AT_PASS",
            label: "Dépose au Passe Chaud",
            timestampMs: lunchMs + 16 * 60000,
            actorAgentId: "agent-emp-hugo",
            actorName: "Hugo Blanc",
            stationId: "station-bl-passe",
            sceneObjectId: "scene-bl-station-bl-passe",
            detail: "Dressé au passe pour la Table 3",
          },
          {
            stage: "PICKED_UP_BY_WAITER",
            label: "Enlèvement au Passe par Chloé Dubois",
            timestampMs: lunchMs + 17.5 * 60000,
            actorAgentId: "agent-emp-chloe",
            actorName: "Chloé Dubois",
            stationId: "station-bl-passe",
            sceneObjectId: "scene-agent-emp-chloe",
            detail: "Chloé Dubois achemine l'entrée vers la Table 3",
          },
          {
            stage: "SERVED_AT_TABLE",
            label: "Servi à la Table 3",
            timestampMs: lunchMs + 19 * 60000,
            actorAgentId: "agent-emp-chloe",
            actorName: "Chloé Dubois",
            stationId: "table-bl-3",
            sceneObjectId: "scene-bl-table-3",
            detail: "Servi aux clients de la Table 3",
          },
        ],
      },
      {
        dishInstanceId: "dish-bl-boeuf-rossini-1",
        sceneObjectId: "scene-dish-dish-bl-boeuf-rossini-1",
        businessId: "business-bistrot-lumiere",
        orderId: "ord-bl-lunch-1",
        tableId: "table-bl-1",
        tableLabel: "Table 1",
        course: 2,
        dishName: "Tournedos de Bœuf Rossini au Foie Gras",
        visualAsset: "copper_saute_pan",
        recipeSummary: "Filet de Bœuf Charolais #1 (440g) saisi au Beurre Échiré #1 (65g), jus truffé Périgord",
        stationId: "station-bl-piano",
        cookAgentId: "agent-emp-karim",
        cookName: "Karim Benali (Chef de Cuisine)",
        waiterAgentId: "agent-emp-thomas",
        waiterName: "Thomas Moreau (Maître d'Hôtel)",
        orderedAtMs: lunchMs + 1 * 60000,
        prepStartedAtMs: lunchMs + 10 * 60000,
        readyAtPassMs: lunchMs + 24 * 60000,
        pickedUpAtMs: lunchMs + 25.5 * 60000,
        deliveredAtMs: lunchMs + 27 * 60000,
        ingredientUnitsUsed: [
          {
            unitId: "unit-bl-filet-boeuf-1",
            sceneObjectId: "scene-unit-unit-bl-filet-boeuf-1",
            unitLabel: "Pièce Filet Charolais #1 (1200g → 760g)",
            ingredientName: "Filet de Bœuf Charolais Maturé",
            qtyUsed: 440,
            remainingBefore: 1200,
            remainingAfter: 760,
            unit: "g",
            shelfTier: 1,
            shelfSlot: 0,
            storageStationId: "storage-bl-cold",
            takenAtMs: lunchMs + 10 * 60000,
            returnedAtMs: lunchMs + 13 * 60000,
          },
          {
            unitId: "unit-bl-beurre-echire-1",
            sceneObjectId: "scene-unit-unit-bl-beurre-echire-1",
            unitLabel: "Motte Beurre Échiré #1 (500g → 435g)",
            ingredientName: "Beurre de Baratte AOP Échiré",
            qtyUsed: 65,
            remainingBefore: 500,
            remainingAfter: 435,
            unit: "g",
            shelfTier: 3,
            shelfSlot: 0,
            storageStationId: "storage-bl-cold",
            takenAtMs: lunchMs + 11 * 60000,
            returnedAtMs: lunchMs + 13 * 60000,
          },
        ],
        stages: [
          {
            stage: "STOCK_DELIVERED",
            label: "Réception Chambre Froide (Filet Charolais #1 · 1200g)",
            timestampMs: baseMs,
            actorAgentId: "agent-emp-karim",
            actorName: "Karim Benali",
            stationId: "storage-bl-cold",
            sceneObjectId: "scene-bl-storage-cold",
            detail: "Stocké en Chambre Froide Étagère Niveau 1 (Protéines)",
          },
          {
            stage: "INGREDIENT_TAKEN",
            label: "Découpe 440g sur Filet Charolais #1 (1200g → 760g)",
            timestampMs: lunchMs + 10 * 60000,
            actorAgentId: "agent-emp-karim",
            actorName: "Karim Benali",
            stationId: "storage-bl-cold",
            sceneObjectId: "scene-unit-unit-bl-filet-boeuf-1",
            detail: "Karim Benali prélève 440g de filet et 65g de Beurre Échiré #1",
          },
          {
            stage: "COOKING_AT_STATION",
            label: "Saisie au Sautoir Cuivre sur le Piano Central",
            timestampMs: lunchMs + 13 * 60000,
            actorAgentId: "agent-emp-karim",
            actorName: "Karim Benali",
            stationId: "station-bl-piano",
            sceneObjectId: "scene-bl-station-bl-piano",
            detail: "Cuisson saignante arrosée au beurre mousseux et réduction Madère",
          },
          {
            stage: "PLATED_AT_PASS",
            label: "Dressage au Passe Chaud sous Lampe",
            timestampMs: lunchMs + 24 * 60000,
            actorAgentId: "agent-emp-karim",
            actorName: "Karim Benali",
            stationId: "station-bl-passe",
            sceneObjectId: "scene-bl-station-bl-passe",
            detail: "Déposé au passe chaud pour la Table 1",
          },
          {
            stage: "PICKED_UP_BY_WAITER",
            label: "Enlèvement au Passe par Thomas Moreau",
            timestampMs: lunchMs + 25.5 * 60000,
            actorAgentId: "agent-emp-thomas",
            actorName: "Thomas Moreau",
            stationId: "station-bl-passe",
            sceneObjectId: "scene-agent-emp-thomas",
            detail: "Thomas Moreau porte les 2 Tournedos Rossini vers la Table 1",
          },
          {
            stage: "SERVED_AT_TABLE",
            label: "Servi à la Table 1",
            timestampMs: lunchMs + 27 * 60000,
            actorAgentId: "agent-emp-thomas",
            actorName: "Thomas Moreau",
            stationId: "table-bl-1",
            sceneObjectId: "scene-bl-table-1",
            detail: "Servi chaud à la Table 1",
          },
        ],
      },
      {
        dishInstanceId: "dish-ob-bistecca-1",
        sceneObjectId: "scene-dish-dish-ob-bistecca-1",
        businessId: "business-osteria-bellavista",
        orderId: "ord-ob-lunch-1",
        tableId: "table-ob-1",
        tableLabel: "Tavolo 1",
        course: 2,
        dishName: "Bistecca alla Fiorentina sulla Brace",
        visualAsset: "tuscan_bistecca_grill",
        recipeSummary: "Carré de Chianina IGP #1 (950g) saisi sur braises de chêne vert au romarin frais",
        stationId: "station-ob-grill",
        cookAgentId: "agent-emp-ob-marco",
        cookName: "Marco Conti (Chef Grillardin)",
        waiterAgentId: "agent-emp-ob-chiara",
        waiterName: "Chiara Lombardi (Cameriera)",
        orderedAtMs: lunchMs + 3 * 60000,
        prepStartedAtMs: lunchMs + 8 * 60000,
        readyAtPassMs: lunchMs + 21 * 60000,
        pickedUpAtMs: lunchMs + 22.5 * 60000,
        deliveredAtMs: lunchMs + 24 * 60000,
        ingredientUnitsUsed: [
          {
            unitId: "unit-ob-chianina-1",
            sceneObjectId: "scene-unit-unit-ob-chianina-1",
            unitLabel: "Carré Bistecca Fiorentina #1 (2400g → 1450g)",
            ingredientName: "Lombo di Chianina IGP (Maturation 40j)",
            qtyUsed: 950,
            remainingBefore: 2400,
            remainingAfter: 1450,
            unit: "g",
            shelfTier: 1,
            shelfSlot: 0,
            storageStationId: "storage-ob-cold",
            takenAtMs: lunchMs + 8 * 60000,
            returnedAtMs: lunchMs + 11 * 60000,
          },
        ],
        stages: [
          {
            stage: "STOCK_DELIVERED",
            label: "Réception Cella Frigorifera (Chianina #1 · 2400g)",
            timestampMs: baseMs,
            actorAgentId: "agent-emp-ob-marco",
            actorName: "Marco Conti",
            stationId: "storage-ob-cold",
            sceneObjectId: "scene-ob-storage-cold",
            detail: "Maturation sur Étagère Niveau 1",
          },
          {
            stage: "INGREDIENT_TAKEN",
            label: "Coupe 950g sur Carré Chianina #1 (2400g → 1450g)",
            timestampMs: lunchMs + 8 * 60000,
            actorAgentId: "agent-emp-ob-marco",
            actorName: "Marco Conti",
            stationId: "storage-ob-cold",
            sceneObjectId: "scene-unit-unit-ob-chianina-1",
            detail: "Marco Conti découpe la Bistecca et replace les 1450g restants au froid",
          },
          {
            stage: "COOKING_AT_STATION",
            label: "Grillade au Feu de Chêne (Griglia Toscana)",
            timestampMs: lunchMs + 11 * 60000,
            actorAgentId: "agent-emp-ob-marco",
            actorName: "Marco Conti",
            stationId: "station-ob-grill",
            sceneObjectId: "scene-ob-station-ob-grill",
            detail: "Saisie vive sur braises ardentes",
          },
          {
            stage: "PLATED_AT_PASS",
            label: "Repos & Tranchage au Passe",
            timestampMs: lunchMs + 21 * 60000,
            actorAgentId: "agent-emp-ob-marco",
            actorName: "Marco Conti",
            stationId: "station-ob-passe",
            sceneObjectId: "scene-ob-station-ob-passe",
            detail: "Fleur de sel et huile d'olive nouvelle",
          },
          {
            stage: "PICKED_UP_BY_WAITER",
            label: "Enlèvement au Passe par Chiara Lombardi",
            timestampMs: lunchMs + 22.5 * 60000,
            actorAgentId: "agent-emp-ob-chiara",
            actorName: "Chiara Lombardi",
            stationId: "station-ob-passe",
            sceneObjectId: "scene-agent-emp-ob-chiara",
            detail: "Transport sur planche chaude vers Tavolo 1",
          },
          {
            stage: "SERVED_AT_TABLE",
            label: "Servie à Tavolo 1",
            timestampMs: lunchMs + 24 * 60000,
            actorAgentId: "agent-emp-ob-chiara",
            actorName: "Chiara Lombardi",
            stationId: "table-ob-1",
            sceneObjectId: "scene-ob-table-1",
            detail: "Présentée et servie à Tavolo 1",
          },
        ],
      },
      {
        dishInstanceId: "dish-sk-omakase-geta-1",
        sceneObjectId: "scene-dish-dish-sk-omakase-geta-1",
        businessId: "business-sakana-tei",
        orderId: "ord-sk-lunch-1",
        tableId: "table-sk-1",
        tableLabel: "Comptoir Hinoki 1",
        course: 1,
        dishName: "Assortiment Omakase Nigiri & Otoro sur Geta Hinoki",
        visualAsset: "sushi_geta_board",
        recipeSummary: "Hon-Maguro Otoro #1 (160g), riz Koshihikari vinaigré Akazu, wasabi frais râpé",
        stationId: "station-sk-sushi",
        cookAgentId: "agent-emp-sk-kenji",
        cookName: "Maître Kenji Takahashi (Itamae Chef)",
        waiterAgentId: "agent-emp-sk-aoi",
        waiterName: "Aoi Nakamura (Service Salle)",
        orderedAtMs: lunchMs + 2 * 60000,
        prepStartedAtMs: lunchMs + 6 * 60000,
        readyAtPassMs: lunchMs + 15 * 60000,
        pickedUpAtMs: lunchMs + 16 * 60000,
        deliveredAtMs: lunchMs + 17.5 * 60000,
        ingredientUnitsUsed: [
          {
            unitId: "unit-sk-otoro-saku-1",
            sceneObjectId: "scene-unit-unit-sk-otoro-saku-1",
            unitLabel: "Pavé Saku Otoro #1 (600g → 440g)",
            ingredientName: "Hon-Maguro Otoro (Thon Rouge Sauvage)",
            qtyUsed: 160,
            remainingBefore: 600,
            remainingAfter: 440,
            unit: "g",
            shelfTier: 1,
            shelfSlot: 0,
            storageStationId: "storage-sk-cold",
            takenAtMs: lunchMs + 6 * 60000,
            returnedAtMs: lunchMs + 8 * 60000,
          },
        ],
        stages: [
          {
            stage: "STOCK_DELIVERED",
            label: "Réception Coffre Froid (Pavé Saku Otoro #1 · 600g)",
            timestampMs: baseMs,
            actorAgentId: "agent-emp-sk-kenji",
            actorName: "Kenji Takahashi",
            stationId: "storage-sk-cold",
            sceneObjectId: "scene-sk-storage-cold",
            detail: "Stocké à 2°C sur Étagère Niveau 1",
          },
          {
            stage: "INGREDIENT_TAKEN",
            label: "Découpe 160g sur Saku Otoro #1 (600g → 440g)",
            timestampMs: lunchMs + 6 * 60000,
            actorAgentId: "agent-emp-sk-kenji",
            actorName: "Kenji Takahashi",
            stationId: "storage-sk-cold",
            sceneObjectId: "scene-unit-unit-sk-otoro-saku-1",
            detail: "Maître Kenji tranche 160g au Yanagiba et repose les 440g restants",
          },
          {
            stage: "COOKING_AT_STATION",
            label: "Façonnage Nigiri au Comptoir Hinoki",
            timestampMs: lunchMs + 8 * 60000,
            actorAgentId: "agent-emp-sk-kenji",
            actorName: "Kenji Takahashi",
            stationId: "station-sk-sushi",
            sceneObjectId: "scene-sk-station-sk-sushi",
            detail: "Dressage sur planche Geta en cyprès Hinoki",
          },
          {
            stage: "PLATED_AT_PASS",
            label: "Prêt au Passe Hinoki",
            timestampMs: lunchMs + 15 * 60000,
            actorAgentId: "agent-emp-sk-kenji",
            actorName: "Kenji Takahashi",
            stationId: "station-sk-passe",
            sceneObjectId: "scene-sk-station-sk-passe",
            detail: "Annonce Omakase prête",
          },
          {
            stage: "PICKED_UP_BY_WAITER",
            label: "Enlèvement par Aoi Nakamura",
            timestampMs: lunchMs + 16 * 60000,
            actorAgentId: "agent-emp-sk-aoi",
            actorName: "Aoi Nakamura",
            stationId: "station-sk-passe",
            sceneObjectId: "scene-agent-emp-sk-aoi",
            detail: "Service vers la table",
          },
          {
            stage: "SERVED_AT_TABLE",
            label: "Servi au Comptoir Hinoki 1",
            timestampMs: lunchMs + 17.5 * 60000,
            actorAgentId: "agent-emp-sk-aoi",
            actorName: "Aoi Nakamura",
            stationId: "table-sk-1",
            sceneObjectId: "scene-sk-table-1",
            detail: "Servi devant les convives",
          },
        ],
      },
    ];
  }

  // Normalize backend stockUnits (storageObjectId -> stationId, initialQuantity -> initialQty, depletionHistory -> consumptionHistory, numeric shelfTier/shelfSlot/fifoOrder)
  const rawContentionList = Array.isArray(dayBundle?.contentionLog) ? dayBundle.contentionLog : [];
  const fifoCounterByIngredient = {};
  const slotCounterByStationTier = {};
  const normalizedUnitsById = {};

  rawStockUnits = (rawStockUnits || []).map((u) => {
    const uid = u.unitId || u._id;
    const rawStorageId = u.stationId || u.storageObjectId || "storage-bl-cold";
    // Map dry storage to Garde-Manger / Saladette so every unit maps to a rendered 3D station rack
    const stationId = rawStorageId === "storage-bl-dry" ? "station-bl-saladette" : rawStorageId;
    const ingKey = `${u.businessId}:${u.ingredientId || u.ingredientName}`;
    fifoCounterByIngredient[ingKey] = (fifoCounterByIngredient[ingKey] || 0) + 1;
    const fifoOrder = typeof u.fifoOrder === "number" ? u.fifoOrder : fifoCounterByIngredient[ingKey];

    let shelfTier = typeof u.shelfTier === "number" ? u.shelfTier : null;
    if (!shelfTier) {
      const slotStr = String(u.shelfSlot || "");
      const tierMatch = slotStr.match(/(\d)/);
      if (tierMatch) {
        shelfTier = Math.max(1, Math.min(3, Number(tierMatch[1])));
      } else {
        const cat = String(u.category || "").toLowerCase();
        shelfTier = cat.includes("meat") || cat.includes("fish") || cat.includes("viande") || cat.includes("protein")
          ? 1
          : cat.includes("produce") || cat.includes("légume") || cat.includes("vegetable") || cat.includes("wine")
          ? 2
          : 3;
      }
    }

    const tierKey = `${stationId}:${shelfTier}`;
    let shelfSlot = typeof u.shelfSlot === "number" ? u.shelfSlot : null;
    if (shelfSlot === null) {
      // Group identical ingredients into the same slot on that tier
      const ingSlotKey = `${stationId}:${shelfTier}:${u.ingredientId || u.ingredientName}`;
      if (slotCounterByStationTier[ingSlotKey] !== undefined) {
        shelfSlot = slotCounterByStationTier[ingSlotKey];
      } else {
        const nextSlot = (slotCounterByStationTier[tierKey] || 0) % 6;
        slotCounterByStationTier[tierKey] = (slotCounterByStationTier[tierKey] || 0) + 1;
        slotCounterByStationTier[ingSlotKey] = nextSlot;
        shelfSlot = nextSlot;
      }
    }

    const initialQty = Number(u.initialQty ?? u.initialQuantity ?? 150);
    const unit = u.unit || "g";
    const unitLabel =
      u.unitLabel ||
      `${u.ingredientName || "Ingrédient"} #${fifoOrder} (${initialQty}${unit}${fifoOrder === 1 ? " · FIFO #1" : ""})`;

    const rawHistory = u.consumptionHistory || u.depletionHistory || [];
    const consumptionHistory = rawHistory.map((dh, idx) => {
      const takenMs =
        dh.takenAtMs ||
        dh.timestampMs ||
        (dh.timestamp ? Date.parse(dh.timestamp) : baseMs + (idx + 1) * 60000);
      const qtyTaken = Number(dh.qtyTaken ?? dh.deducted ?? 30);
      const before = Number(dh.remainingBefore ?? dh.beforeQuantity ?? initialQty);
      const after = Number(dh.remainingAfter ?? Math.max(0, before - qtyTaken));
      return {
        stepIndex: dh.stepIndex || idx + 1,
        timestampMs: takenMs,
        takenAtMs: takenMs,
        returnedAtMs: dh.returnedAtMs || takenMs + 75000,
        actorAgentId: dh.actorAgentId || dh.actorId || dh.cookId,
        actorName: dh.actorName || dh.cookName || "Chef de Partie",
        cookId: dh.actorAgentId || dh.actorId || dh.cookId,
        cookName: dh.actorName || dh.cookName || "Chef de Partie",
        stationId: dh.stationId || stationId,
        dishInstanceId: dh.dishInstanceId || dh.dishId,
        dishName: dh.dishName || "Préparation",
        orderId: dh.orderId,
        tableId: dh.tableId,
        tableLabel: dh.tableLabel || dh.tableName || dh.tableId || "Salle",
        qtyTaken,
        remainingBefore: before,
        remainingAfter: after,
        unit: dh.unit || unit,
        action: dh.action || "TAKEN_USED_RETURNED",
        notes:
          dh.notes ||
          `${dh.actorName || "Chef"} prélève ${qtyTaken}${unit} (${before}${unit} → ${after}${unit}) pour ${dh.dishName || "Plat"}`,
      };
    });

    const matchedContention = [
      ...(u.contentionLog || []),
      ...rawContentionList
        .filter((c) => c.unitId === uid || (c.businessId === u.businessId && c.ingredientId === u.ingredientId && fifoOrder === 1))
        .map((c) => {
          const cMs = c.timestampMs || (c.timestamp ? Date.parse(c.timestamp) : lunchMs);
          const rMs =
            c.resolvedAtMs ||
            (c.resolvedAt ? Date.parse(c.resolvedAt) : cMs + Number(c.waitSeconds || 35) * 1000);
          return {
            timestampMs: cMs,
            resolvedAtMs: rMs,
            waitingAgentId: c.waitingAgentId,
            waitingAgentName: c.waitingAgentName || "Commis",
            holderAgentId: c.holderAgentId || c.heldByAgentId,
            holderAgentName: c.holderAgentName || c.heldByAgentName || "Chef",
            resolution: c.resolution || "WAIT_FOR_RETURN_FIFO_COHERENT",
            reason:
              c.reason ||
              c.detail ||
              `${c.waitingAgentName} patiente pendant que ${c.heldByAgentName} prélève sur ${unitLabel}, puis utilise le reste de la même unité FIFO #1`,
          };
        }),
    ];

    const normUnit = {
      ...u,
      unitId: uid,
      sceneObjectId: u.sceneObjectId || `scene-unit-${uid}`,
      stationId,
      shelfSlotLabel: typeof u.shelfSlot === "string" ? u.shelfSlot : u.shelfSlotLabel || `Niveau ${shelfTier} · Slot #${shelfSlot + 1}`,
      shelfTier,
      shelfSlot,
      fifoOrder,
      initialQty,
      remainingQty: Number(u.remainingQty ?? u.remainingQuantity ?? initialQty),
      unit,
      unitLabel,
      name: u.ingredientName || unitLabel,
      consumptionHistory,
      contentionLog: matchedContention,
    };
    normalizedUnitsById[uid] = normUnit;
    return normUnit;
  });

  // Normalize backend dishInstances (ISO timestamps -> Ms, ingredientsConsumed -> ingredientUnitsUsed, populate 6-stage provenance chain)
  rawDishInstances = (rawDishInstances || []).map((d) => {
    const did = d.dishInstanceId || d._id;
    const sceneObjectId = d.sceneObjectId || `scene-dish-${did}`;
    const orderedAtMs = d.orderedAtMs || (d.orderedAt ? Date.parse(d.orderedAt) : lunchMs);
    const prepStartedAtMs =
      d.prepStartedAtMs || (d.cookingStartedAt ? Date.parse(d.cookingStartedAt) : orderedAtMs + 90000);
    const readyAtPassMs =
      d.readyAtPassMs || (d.platedAtPassAt ? Date.parse(d.platedAtPassAt) : prepStartedAtMs + 7 * 60000);
    const pickedUpAtMs =
      d.pickedUpAtMs || (d.pickedUpFromPassAt ? Date.parse(d.pickedUpFromPassAt) : readyAtPassMs + 45000);
    const deliveredAtMs =
      d.deliveredAtMs || (d.deliveredToTableAt ? Date.parse(d.deliveredToTableAt) : pickedUpAtMs + 45000);
    const clearedAtMs = d.clearedAtMs || (d.clearedAt ? Date.parse(d.clearedAt) : deliveredAtMs + 38 * 60000);

    const tableLabel = d.tableLabel || d.tableName || d.tableId || "Table";
    const cookAgentId = d.cookAgentId || d.cookId || null;
    const cookName = d.cookName || "Chef de Partie";
    const waiterAgentId = d.waiterAgentId || d.waiterId || null;
    const waiterName = d.waiterName || "Service Salle";

    const ingredientUnitsUsed = (d.ingredientUnitsUsed || d.ingredientsConsumed || []).map((ic, idx) => {
      const matchedUnit = normalizedUnitsById[ic.unitId];
      const rawSt = ic.storageStationId || ic.storageObjectId || matchedUnit?.stationId || "storage-bl-cold";
      const storageStationId = rawSt === "storage-bl-dry" ? "station-bl-saladette" : rawSt;
      const qtyUsed = Number(ic.qtyUsed ?? ic.quantity ?? 30);
      const remainingBefore = Number(ic.remainingBefore ?? ic.beforeQuantity ?? matchedUnit?.initialQty ?? 150);
      const remainingAfter = Number(ic.remainingAfter ?? Math.max(0, remainingBefore - qtyUsed));
      const unit = ic.unit || matchedUnit?.unit || "g";
      return {
        unitId: ic.unitId,
        sceneObjectId: ic.sceneObjectId || matchedUnit?.sceneObjectId || `scene-unit-${ic.unitId}`,
        unitLabel:
          ic.unitLabel ||
          matchedUnit?.unitLabel ||
          `${ic.ingredientName || "Ingrédient"} (${remainingBefore}${unit} → ${remainingAfter}${unit})`,
        ingredientId: ic.ingredientId || matchedUnit?.ingredientId,
        ingredientName: ic.ingredientName || matchedUnit?.ingredientName || "Ingrédient Frais",
        qtyUsed,
        remainingBefore,
        remainingAfter,
        unit,
        storageStationId,
        shelfTier: ic.shelfTier ?? matchedUnit?.shelfTier ?? 1,
        shelfSlot: ic.shelfSlot ?? matchedUnit?.shelfSlot ?? idx % 6,
        takenAtMs: ic.takenAtMs || Math.max(orderedAtMs + 15000, prepStartedAtMs - 25000 + idx * 8000),
      };
    });

    const firstIng = ingredientUnitsUsed[0];
    const ingSummary =
      ingredientUnitsUsed.length > 0
        ? ingredientUnitsUsed
            .map((iu) => `${iu.qtyUsed}${iu.unit} ${iu.ingredientName} (${iu.remainingBefore}${iu.unit}→${iu.remainingAfter}${iu.unit})`)
            .join(" + ")
        : "Sélection FIFO sur étagère réfrigérée";

    const stages =
      Array.isArray(d.stages) && d.stages.length > 0
        ? d.stages
        : [
            {
              stage: "STOCK_DELIVERED",
              label: `Stock Matinal en Place (${firstIng?.unitLabel || "Étagères Triées FIFO"})`,
              timestampMs: baseMs,
              actorAgentId: cookAgentId,
              actorName: cookName,
              stationId: firstIng?.storageStationId || "storage-bl-cold",
              sceneObjectId: firstIng?.sceneObjectId || `scene-unit-${firstIng?.unitId || ""}`,
              detail: `Unités triées par niveau (1..3) et ordre FIFO sur ${firstIng?.storageStationId || "Chambre Froide"}`,
            },
            {
              stage: "INGREDIENT_TAKEN",
              label: `Prélèvement Stock : ${ingSummary.slice(0, 72)}`,
              timestampMs: Math.max(orderedAtMs + 10000, prepStartedAtMs - 25000),
              actorAgentId: cookAgentId,
              actorName: cookName,
              stationId: firstIng?.storageStationId || d.stationId,
              sceneObjectId: firstIng?.sceneObjectId || null,
              detail: `${cookName} prélève ${ingSummary} et repose les unités entamées sur leur étagère`,
            },
            ...(d.hadResourceContention
              ? [
                  {
                    stage: "MUTEX_CONTENTION_WAIT",
                    label: `File d'Attente Coordonnée (Mutex FIFO sur ${firstIng?.ingredientName || "Ingrédient"})`,
                    timestampMs: Math.max(orderedAtMs + 5000, prepStartedAtMs - 45000),
                    actorAgentId: cookAgentId,
                    actorName: cookName,
                    stationId: firstIng?.storageStationId || d.stationId,
                    sceneObjectId: firstIng?.sceneObjectId || null,
                    detail: `${cookName} attend le retour de l'unité #1 entamée sur l'étagère avant de prélever sa portion`,
                  },
                ]
              : []),
            {
              stage: "COOKING_AT_STATION",
              label: `Cuisson & Dressage : ${d.dishName}`,
              timestampMs: prepStartedAtMs,
              actorAgentId: cookAgentId,
              actorName: cookName,
              stationId: d.stationId,
              sceneObjectId: `scene-${d.businessId === "business-bistrot-lumiere" ? "bl" : d.businessId === "business-osteria-bellavista" ? "ob" : "sk"}-${d.stationId}`,
              detail: `Préparation minute par ${cookName} (${Math.round((d.prepDurationSeconds || 480) / 60)} min)`,
            },
            {
              stage: "PLATED_AT_PASS",
              label: `Dressé au Passe Chaud (${d.dishName})`,
              timestampMs: readyAtPassMs,
              actorAgentId: cookAgentId,
              actorName: cookName,
              stationId: d.businessId === "business-bistrot-lumiere" ? "station-bl-passe" : d.businessId === "business-osteria-bellavista" ? "station-ob-passe" : "station-sk-passe",
              detail: `Assiette vérifiée au passe avant enlèvement par ${waiterName}`,
            },
            {
              stage: "PICKED_UP_BY_WAITER",
              label: `Enlevé au Passe par ${waiterName}`,
              timestampMs: pickedUpAtMs,
              actorAgentId: waiterAgentId,
              actorName: waiterName,
              stationId: d.businessId === "business-bistrot-lumiere" ? "station-bl-passe" : d.businessId === "business-osteria-bellavista" ? "station-ob-passe" : "station-sk-passe",
              sceneObjectId: waiterAgentId ? `scene-${waiterAgentId}` : null,
              detail: `${waiterName} achemine l'assiette vers ${tableLabel} (Siège #${d.seatNumber || 1})`,
            },
            {
              stage: "SERVED_AT_TABLE",
              label: `Servi à ${tableLabel} (Convive #${d.seatNumber || 1})`,
              timestampMs: deliveredAtMs,
              actorAgentId: waiterAgentId,
              actorName: waiterName,
              stationId: d.tableId,
              sceneObjectId,
              detail: `${d.dishName} posé devant le convive (${d.partyName || tableLabel})`,
            },
          ].sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0));

    return {
      ...d,
      dishInstanceId: did,
      sceneObjectId,
      tableLabel,
      cookAgentId,
      cookName,
      waiterAgentId,
      waiterName,
      orderedAtMs,
      prepStartedAtMs,
      readyAtPassMs,
      pickedUpAtMs,
      deliveredAtMs,
      clearedAtMs,
      recipeSummary:
        d.recipeSummary ||
        (ingredientUnitsUsed.length > 0
          ? `Ingrédients traçables: ${ingredientUnitsUsed.map((i) => `${i.qtyUsed}${i.unit} ${i.ingredientName}`).join(", ")}`
          : "Préparation minute aux produits frais"),
      ingredientUnitsUsed,
      stages,
    };
  });

  return { rawStockUnits, rawDishInstances };
}

/**
 * Deterministic client-side state projector mirroring `backend/simulation/businessSimulations.mjs`
 * so 60 FPS timeline scrubbing, reverse playback, and multi-waypoint A* navigation are instantaneous.
 */
export function projectStreetStateAt(bootstrap, dayBundle, timestampMs) {
  if (!bootstrap || !dayBundle) return null;

  const businesses = bootstrap.businesses || [];
  const premisesList = bootstrap.premises || [];
  const sceneObjects = bootstrap.sceneObjects || [];
  const employees = bootstrap.employees || [];
  const events = dayBundle.events || [];

  const { rawStockUnits, rawDishInstances } = ensureProvenanceCatalog(bootstrap, dayBundle);

  // Initialize deterministic Stock Units State & Dish Instances State at start of day
  const stockUnitsState = {};
  for (const u of rawStockUnits) {
    const uid = u.unitId || u._id;
    if (!uid) continue;
    stockUnitsState[uid] = {
      ...u,
      unitId: uid,
      sceneObjectId: u.sceneObjectId || `scene-unit-${uid}`,
      shelfTier: Number(u.shelfTier || 1),
      shelfSlot: Number(u.shelfSlot ?? 0),
      fifoOrder: Number(u.fifoOrder || 1),
      initialQty: Number(u.initialQty || 100),
      remainingQty: Number(u.initialQty || 100),
      unit: u.unit || "g",
      status: "ON_SHELF",
      holderAgentId: null,
      holderName: null,
      activeConsumer: null,
      appliedConsumption: [],
      activeContention: null,
      appliedContentionLog: [],
    };
  }

  const dishInstancesState = {};
  for (const d of rawDishInstances) {
    const did = d.dishInstanceId || d._id;
    if (!did) continue;
    dishInstancesState[did] = {
      ...d,
      dishInstanceId: did,
      sceneObjectId: d.sceneObjectId || `scene-dish-${did}`,
      status: "QUEUED",
      currentStage: "ORDERED",
      currentStationId: d.stationId || null,
      assignedCookName: d.cookName || "Chef de Partie",
      waiterName: d.waiterName || "Service Salle",
      ingredientUnitsUsed: d.ingredientUnitsUsed || [],
      stages: d.stages || [],
    };
  }

  const navGraph = buildUnifiedNavGraph(premisesList);

  const businessStates = {};
  for (const b of businesses) {
    const tables = {};
    const stations = {};
    for (const obj of sceneObjects) {
      if (obj.businessId !== b._id) continue;
      if (obj.domainEntityType === "table") {
        tables[obj.domainEntityId] = {
          tableId: obj.domainEntityId,
          sceneObjectId: obj.sceneObjectId,
          label: obj.label,
          seats: obj.seats || 2,
          status: "AVAILABLE",
          partyName: null,
          partySize: 0,
          activeOrderId: null,
          currentCourse: 0,
          waiterName: null,
          servedDishes: [],
          transform: obj.transform,
        };
      } else if (["station", "storage", "pos_terminal"].includes(obj.domainEntityType)) {
        stations[obj.domainEntityId] = {
          stationId: obj.domainEntityId,
          sceneObjectId: obj.sceneObjectId,
          label: obj.label,
          objectType: obj.objectType,
          stationKind: obj.stationKind,
          equipmentStyle: obj.equipmentStyle || null,
          status: "IDLE",
          activeTasks: [],
          completedCount: 0,
          transform: obj.transform,
        };
      }
    }

    const activeAgents = {};
    if (b._id !== "business-bistrot-lumiere") {
      for (const emp of employees.filter((e) => e.businessId === b._id)) {
        activeAgents[emp.agentId] = {
          agentId: emp.agentId,
          employeeId: emp._id,
          name: emp.name,
          role: emp.role,
          jobTitle: emp.jobTitle,
          agentKind: "employee",
          businessId: b._id,
          status: "ON_DUTY",
          currentTask: emp.jobTitle || emp.role,
          fromX: emp.homeCoords.x,
          fromZ: emp.homeCoords.z,
          targetX: emp.homeCoords.x,
          targetZ: emp.homeCoords.z,
          homeCoords: emp.homeCoords,
          pathPoints: [
            { x: emp.homeCoords.x, z: emp.homeCoords.z },
            { x: emp.homeCoords.x, z: emp.homeCoords.z },
          ],
          moveStartMs: 0,
          moveDurationMs: 1000,
        };
      }
    }

    businessStates[b._id] = {
      businessId: b._id,
      businessName: b.name,
      businessType: b.businessType,
      specialty: b.specialty || null,
      operatingStatus: b._id === "business-bistrot-lumiere" ? "CLOSED" : "OPEN",
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
      },
      tables,
      stations,
      activeOrdersMap: {},
      activeAgents,
      recentEvents: [],
    };
  }

  const findStation = (bs, preferredId, kindFallback) => {
    if (preferredId && bs.stations[preferredId]) return bs.stations[preferredId];
    return Object.values(bs.stations).find((s) => s.stationKind === kindFallback) || null;
  };

  const inferDishVisualAsset = (item = {}, businessId = "", course = 1) => {
    if (item.visualAsset && item.visualAsset !== "cold_plated_dish") return item.visualAsset;
    const nm = String(item.name || item.dishName || item.label || "").toLowerCase();
    const cat = String(item.category || "").toLowerCase();
    if (nm.includes("sushi") || nm.includes("nigiri") || nm.includes("sashimi") || nm.includes("omakase") || nm.includes("chirashi")) {
      return "sushi_geta_board";
    }
    if (nm.includes("bistecca") || nm.includes("fiorentina") || nm.includes("tagliata") || nm.includes("costata")) {
      return "tuscan_bistecca_grill";
    }
    if (nm.includes("yakitori") || nm.includes("robata") || nm.includes("misoyaki") || nm.includes("wagyu") || nm.includes("brochette")) {
      return "robata_skewers";
    }
    if (nm.includes("tagliatelle") || nm.includes("pappardelle") || nm.includes("ravioli") || nm.includes("pasta") || nm.includes("gnocchi") || nm.includes("risotto")) {
      return "pasta_bollitore_basket";
    }
    if (nm.includes("ramen") || nm.includes("tempura") || nm.includes("udon") || nm.includes("gyoza")) {
      return "tempura_wok";
    }
    if (
      course === 3 ||
      cat.includes("dessert") ||
      cat.includes("dolci") ||
      nm.includes("tiramisu") ||
      nm.includes("brûlée") ||
      nm.includes("tarte") ||
      nm.includes("profiterole") ||
      nm.includes("mousse") ||
      nm.includes("matcha") ||
      nm.includes("panna")
    ) {
      return "pastry_dessert_plate";
    }
    if (cat.includes("vin") || cat.includes("wine") || cat.includes("boisson") || nm.includes("chianti") || nm.includes("bordeaux") || nm.includes("saké")) {
      return "wine_decanter_glasses";
    }
    if (businessId === "business-sakana-tei") {
      return course === 1 ? "sushi_geta_board" : "robata_skewers";
    }
    if (businessId === "business-osteria-bellavista") {
      return course === 1 ? "pasta_bollitore_basket" : "tuscan_bistecca_grill";
    }
    return course === 1 ? "cold_plated_dish" : "copper_saute_pan";
  };

  // Evaluates an agent's instantaneous (x, z, headingRad) at `atMs` across any multi-leg segments or single move
  const evaluateAgentAt = (ag, atMs) => {
    if (!ag) return { x: 0, z: 0, headingRad: 0, isMoving: false, moveProgress: 1 };
    if (ag.segments && ag.segments.length > 0) {
      let activeSeg = ag.segments[ag.segments.length - 1];
      for (const seg of ag.segments) {
        if (atMs <= seg.endMs) {
          activeSeg = seg;
          break;
        }
      }
      const dur = Math.max(500, (activeSeg.endMs || 0) - (activeSeg.startMs || 0));
      const elapsed = Math.max(0, atMs - (activeSeg.startMs || 0));
      const t = activeSeg.isDwell ? 1 : Math.min(1, elapsed / dur);
      const smooth = t * t * (3 - 2 * t);
      const pts =
        activeSeg.pathPoints && activeSeg.pathPoints.length >= 2
          ? activeSeg.pathPoints
          : [
              { x: activeSeg.fromX ?? 0, z: activeSeg.fromZ ?? 0 },
              { x: activeSeg.targetX ?? 0, z: activeSeg.targetZ ?? 0 },
            ];
      const sampled = samplePolylineAt(pts, smooth);
      const dist = Math.hypot((activeSeg.targetX ?? 0) - (activeSeg.fromX ?? 0), (activeSeg.targetZ ?? 0) - (activeSeg.fromZ ?? 0));
      return {
        x: sampled.x,
        z: sampled.z,
        headingRad: activeSeg.fixedHeadingRad !== undefined ? activeSeg.fixedHeadingRad : sampled.headingRad,
        isMoving: !activeSeg.isDwell && t < 0.99 && dist > 0.25,
        moveProgress: smooth,
        pathPoints: pts,
        status: activeSeg.status || ag.status,
        currentTask: activeSeg.currentTask || ag.currentTask,
        carryingDish: activeSeg.carryingDish !== undefined ? activeSeg.carryingDish : ag.carryingDish,
      };
    }

    const dur = Math.max(1000, ag.moveDurationMs || 20000);
    const elapsed = Math.max(0, atMs - (ag.moveStartMs || 0));
    const t = Math.min(1, elapsed / dur);
    const smooth = t * t * (3 - 2 * t);
    const pts =
      ag.pathPoints && ag.pathPoints.length >= 2
        ? ag.pathPoints
        : [
            { x: ag.fromX ?? ag.targetX ?? 0, z: ag.fromZ ?? ag.targetZ ?? 0 },
            { x: ag.targetX ?? 0, z: ag.targetZ ?? 0 },
          ];
    const sampled = samplePolylineAt(pts, smooth);
    const dist = Math.hypot((ag.targetX ?? 0) - (ag.fromX ?? 0), (ag.targetZ ?? 0) - (ag.fromZ ?? 0));
    return {
      x: sampled.x,
      z: sampled.z,
      headingRad: sampled.headingRad,
      isMoving: t < 0.99 && dist > 0.25,
      moveProgress: smooth,
      pathPoints: pts,
      status: ag.status,
      currentTask: ag.currentTask,
      carryingDish: ag.carryingDish,
    };
  };

  const moveAgent = (ag, toX, toZ, evMs, durationMs = 22000) => {
    if (!ag) return;
    const cur = evaluateAgentAt(ag, evMs);
    const startX = cur.x ?? ag.targetX ?? ag.fromX ?? toX;
    const startZ = cur.z ?? ag.targetZ ?? ag.fromZ ?? toZ;
    ag.segments = null;
    ag.fromX = startX;
    ag.fromZ = startZ;
    ag.targetX = toX;
    ag.targetZ = toZ;
    ag.pathPoints = findNavigationPath(navGraph, startX, startZ, toX, toZ, ag.businessId);
    ag.moveStartMs = evMs;
    ag.moveDurationMs = durationMs;
  };

  // Schedules a realistic waiter round-trip: walk to table -> pause at table facing guests -> walk back to station/pass
  const scheduleWaiterRoundTrip = (
    ag,
    evMs,
    {
      pickupCoords = null,
      tableSideX,
      tableSideZ,
      tableCenterX,
      tableCenterZ,
      outboundTask,
      tableDwellTask,
      returnTask,
      idleTask,
      outboundStatus = "ON_DUTY",
      carryingDish = null,
    }
  ) => {
    if (!ag || ag.agentKind === "customer") return;
    const cur = evaluateAgentAt(ag, evMs);
    let cursorX = cur.x ?? ag.homeCoords?.x ?? tableSideX;
    let cursorZ = cur.z ?? ag.homeCoords?.z ?? tableSideZ;
    let cursorMs = evMs;

    const segments = [];

    // Optional Leg 0: Walk to pass to pick up plated dishes
    if (pickupCoords && Math.hypot(pickupCoords.x - cursorX, pickupCoords.z - cursorZ) > 0.8) {
      const toPassPath = findNavigationPath(navGraph, cursorX, cursorZ, pickupCoords.x, pickupCoords.z, ag.businessId);
      const leg0Dur = 8000;
      segments.push({
        startMs: cursorMs,
        endMs: cursorMs + leg0Dur,
        fromX: cursorX,
        fromZ: cursorZ,
        targetX: pickupCoords.x,
        targetZ: pickupCoords.z,
        pathPoints: toPassPath,
        status: "ON_DUTY",
        currentTask: `Collecte au passe: ${carryingDish || "Suite"}`,
        carryingDish: null,
      });
      cursorX = pickupCoords.x;
      cursorZ = pickupCoords.z;
      cursorMs += leg0Dur;
    }

    // Leg 1: Walk from current/pass to table side
    const toTablePath = findNavigationPath(navGraph, cursorX, cursorZ, tableSideX, tableSideZ, ag.businessId);
    const leg1Dur = 16000;
    segments.push({
      startMs: cursorMs,
      endMs: cursorMs + leg1Dur,
      fromX: cursorX,
      fromZ: cursorZ,
      targetX: tableSideX,
      targetZ: tableSideZ,
      pathPoints: toTablePath,
      status: outboundStatus,
      currentTask: outboundTask,
      carryingDish,
    });
    cursorMs += leg1Dur;

    // Leg 2: Brief dwell beside the table facing the table center (never stuck forever!)
    const faceTableHeading = Math.atan2(tableCenterX - tableSideX, tableCenterZ - tableSideZ);
    const dwellDur = 7500;
    segments.push({
      startMs: cursorMs,
      endMs: cursorMs + dwellDur,
      fromX: tableSideX,
      fromZ: tableSideZ,
      targetX: tableSideX,
      targetZ: tableSideZ,
      pathPoints: [
        { x: tableSideX, z: tableSideZ },
        { x: tableSideX, z: tableSideZ },
      ],
      isDwell: true,
      fixedHeadingRad: faceTableHeading,
      status: outboundStatus,
      currentTask: tableDwellTask || outboundTask,
      carryingDish,
    });
    cursorMs += dwellDur;

    // Leg 3: Walk back along A* path to waiter home station / service pass
    const retX = ag.homeCoords?.x ?? pickupCoords?.x ?? 10;
    const retZ = ag.homeCoords?.z ?? pickupCoords?.z ?? 8;
    const toHomePath = findNavigationPath(navGraph, tableSideX, tableSideZ, retX, retZ, ag.businessId);
    const leg3Dur = 16000;
    segments.push({
      startMs: cursorMs,
      endMs: cursorMs + leg3Dur,
      fromX: tableSideX,
      fromZ: tableSideZ,
      targetX: retX,
      targetZ: retZ,
      pathPoints: toHomePath,
      status: "ON_DUTY",
      currentTask: returnTask || "Retour au poste de salle",
      carryingDish: null,
    });
    cursorMs += leg3Dur;

    // Leg 4: Idle at station facing dining room
    segments.push({
      startMs: cursorMs,
      endMs: Number.MAX_SAFE_INTEGER,
      fromX: retX,
      fromZ: retZ,
      targetX: retX,
      targetZ: retZ,
      pathPoints: [
        { x: retX, z: retZ },
        { x: retX, z: retZ },
      ],
      isDwell: true,
      fixedHeadingRad: 0,
      status: "ON_DUTY",
      currentTask: idleTask || "Service en salle & surveillance",
      carryingDish: null,
    });

    ag.segments = segments;
    ag.fromX = segments[0].fromX;
    ag.fromZ = segments[0].fromZ;
    ag.targetX = retX;
    ag.targetZ = retZ;
    ag.pathPoints = toTablePath;
    ag.moveStartMs = evMs;
    ag.moveDurationMs = leg1Dur;
  };

  const dayOrdersById = {};
  for (const o of dayBundle.orders || []) {
    if (o._id) dayOrdersById[o._id] = o;
  }

  const activeDialogues = [];
  const appliedEvents = [];
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev.eventTimeMs > timestampMs) break;
    appliedEvents.push(ev);

    const bs = businessStates[ev.businessId];
    if (!bs) continue;
    const pl = ev.payload || {};
    bs.recentEvents.push(ev);
    if (bs.recentEvents.length > 22) bs.recentEvents.shift();

    // Capture dialogue / speech turns (both structured dialogueLines and string ev.dialogue / pl.dialogueText)
    const rawDlgString = ev.dialogue || pl.dialogueText || pl.speechText || pl.utterance;
    if (
      pl.dialogueLines ||
      rawDlgString ||
      ev.eventType === "AGENT_CONVERSATION" ||
      ev.eventType === "DIALOGUE_TURN" ||
      ev.eventType === "CUSTOMER_WAITER_DIALOGUE"
    ) {
      const lines = Array.isArray(pl.dialogueLines)
        ? pl.dialogueLines
        : [
            {
              speakerId: ev.actor?.agentId,
              speakerName: ev.actor?.name || "Agent",
              speakerRole: ev.actor?.role || "Staff",
              text: rawDlgString || ev.summary || "",
              timestampMs: ev.eventTimeMs,
            },
          ];
      const dlg = {
        dialogueId: ev._id || `dlg-${i}`,
        businessId: ev.businessId,
        timestampMs: ev.eventTimeMs,
        tableId: pl.tableId || ev.target?.tableId || null,
        stationId: pl.stationId || ev.target?.domainEntityId || null,
        topic: pl.topic || ev.eventType,
        lines,
      };
      activeDialogues.push(dlg);
      const aid = ev.actor?.agentId;
      if (aid && bs.activeAgents[aid] && timestampMs - ev.eventTimeMs <= 45000) {
        const lastLine = lines[lines.length - 1];
        const cleanBubble = String(lastLine?.text || rawDlgString || "")
          .replace(/^\[[^\]]+\]:\s*/, "")
          .replace(/^[«"]|[»"]$/g, "")
          .trim();
        bs.activeAgents[aid].speechBubble = cleanBubble || null;
        bs.activeAgents[aid].speechAtMs = ev.eventTimeMs;
      }
    }

    switch (ev.eventType) {
      case "STOCK_DELIVERY_RECEIVED": {
        bs.metrics.deliveriesReceived += 1;
        const st = findStation(bs, ev.target?.domainEntityId, "cold_storage");
        if (st) {
          st.status = "RECEIVING_STOCK";
          st.completedCount += Number(pl.itemCount || 1);
          const items = pl.items || [];
          st.activeTasks = items.slice(0, 4).map((it, idx) => ({
            taskId: `${ev._id}-stock-${idx}`,
            orderId: pl.purchaseOrderId || ev._id,
            tableId: null,
            tableLabel: pl.supplierName || "Fournisseur",
            course: 0,
            dishName: it.name || it.ingredientName || "Ingrédient Frais",
            label: it.name || it.ingredientName || "Ingrédient Frais",
            category: "Réception Marchandises",
            qty: it.qty || 1,
            unit: it.unit || "kg",
            visualAsset: it.visualAsset || "ingredient_prep_crate",
            recipeSummary: it.recipeSummary || `Livraison ${pl.supplierName || "Producteur"}`,
            chefName: ev.actor?.name || "Chef",
            status: "RECEIVING_STOCK",
            startedAtMs: ev.eventTimeMs,
          }));
        }
        break;
      }
      case "OPEN_STORAGE_DOOR": {
        const actorAid = ev.actor?.agentId;
        const stObj = findStation(bs, ev.target?.domainEntityId || pl.storageObjectId, "storage");
        if (actorAid && bs.activeAgents[actorAid]) {
          bs.activeAgents[actorAid].status = "TAKING_INGREDIENT";
          bs.activeAgents[actorAid].currentTask = `Accès Chambre Froide (${pl.ingredientName || "Prélèvement FIFO"})`;
          if (stObj?.transform) {
            moveAgent(bs.activeAgents[actorAid], stObj.transform.x, stObj.transform.z + 0.78, ev.eventTimeMs, 8000);
          }
        }
        break;
      }
      case "RESOURCE_CONTENTION_WAIT":
      case "INGREDIENT_CONTENTION_DEFERRED":
      case "INGREDIENT_CONTENTION_RETRY":
      case "INGREDIENT_WAIT_FOR_UNIT": {
        const uid = pl.unitId || ev.target?.domainEntityId;
        const uState = uid ? stockUnitsState[uid] : null;
        const waitAid = ev.actor?.agentId || pl.waitingAgentId;
        if (uState) {
          const cEntry = {
            timestampMs: ev.eventTimeMs,
            waitingAgentId: waitAid,
            waitingAgentName: ev.actor?.name || pl.waitingAgentName || "Commis",
            holderAgentId: pl.holderAgentId || pl.heldByAgentId || uState.holderAgentId,
            holderAgentName: pl.holderAgentName || pl.heldByAgentName || uState.holderName || "Chef",
            resolution: pl.resolution || "WAIT_FOR_RETURN_FIFO_COHERENT",
            reason:
              pl.reason ||
              pl.detail ||
              `Unité ${uState.unitLabel} en cours d'utilisation — attente coordonnée avant prélèvement`,
          };
          uState.appliedContentionLog.push(cEntry);
          if (timestampMs - ev.eventTimeMs <= 90000) {
            uState.activeContention = cEntry;
          }
        }
        if (waitAid && bs.activeAgents[waitAid]) {
          bs.activeAgents[waitAid].status = "WAITING_INGREDIENT";
          bs.activeAgents[waitAid].currentTask = `Attente coordonnée FIFO: ${pl.ingredientName || pl.unitLabel || uState?.unitLabel || "Ingrédient #1"}`;
        }
        break;
      }
      case "INGREDIENT_CONTENTION_RESOLVED": {
        const uid = pl.unitId || ev.target?.domainEntityId;
        const uState = uid ? stockUnitsState[uid] : null;
        if (uState) {
          uState.activeContention = null;
        }
        break;
      }
      case "STOCK_UNIT_DEPLETED":
      case "INGREDIENT_UNIT_TAKEN": {
        const uid = pl.unitId || ev.target?.domainEntityId;
        const uState = uid ? stockUnitsState[uid] : null;
        const actorAid = ev.actor?.agentId || pl.cookId;
        const actorName = ev.actor?.name || pl.cookName || "Chef";
        if (uState) {
          const qtyTaken = Number(pl.qtyTaken ?? pl.deducted ?? pl.qtyUsed ?? 30);
          const before = pl.beforeQuantity !== undefined ? Number(pl.beforeQuantity) : uState.remainingQty;
          const after =
            pl.remainingAfter !== undefined
              ? Number(pl.remainingAfter)
              : Math.max(0, before - qtyTaken);
          uState.remainingQty = after;
          uState.status = after <= 0 ? "DEPLETED" : "IN_USE_BY_COOK";
          uState.holderAgentId = actorAid;
          uState.holderName = actorName;
          uState.activeContention = null;
          uState.appliedConsumption.push({
            stepIndex: uState.appliedConsumption.length + 1,
            timestampMs: ev.eventTimeMs,
            takenAtMs: ev.eventTimeMs,
            returnedAtMs: ev.eventTimeMs + 60000,
            actorAgentId: actorAid,
            actorName,
            cookId: actorAid,
            cookName: actorName,
            stationId: pl.stationId || ev.target?.stationId || uState.stationId,
            dishInstanceId: ev.dishInstanceId || pl.dishInstanceId,
            dishName: pl.dishName || pl.itemName || "Préparation",
            orderId: ev.orderId || pl.orderId,
            tableId: pl.tableId,
            tableLabel: pl.tableLabel || pl.tableName,
            qtyTaken,
            remainingBefore: before,
            remainingAfter: after,
            unit: uState.unit,
            action: "TAKEN_FROM_SHELF",
            notes: pl.notes || `${actorName} prélève ${qtyTaken}${uState.unit} (${before}${uState.unit} → ${after}${uState.unit})`,
          });
        }
        if (actorAid && bs.activeAgents[actorAid]) {
          const stObj = findStation(bs, pl.storageStationId || pl.storageObjectId || uState?.stationId, "storage");
          bs.activeAgents[actorAid].status = "TAKING_INGREDIENT";
          bs.activeAgents[actorAid].carryingIngredientUnit = uState?.unitLabel || pl.unitLabel || pl.ingredientName || "Ingrédient";
          bs.activeAgents[actorAid].currentTask = `Prélèvement ${pl.deducted ?? pl.qtyTaken ?? ""}${uState?.unit || "g"} ${uState?.ingredientName || pl.ingredientName || "Stock"}`;
          if (stObj?.transform) {
            moveAgent(bs.activeAgents[actorAid], stObj.transform.x, stObj.transform.z + 0.78, ev.eventTimeMs, 9000);
          }
        }
        break;
      }
      case "CLOSE_STORAGE_DOOR":
      case "INGREDIENT_UNIT_RETURNED": {
        const uid = pl.unitId || ev.target?.domainEntityId;
        const uState = uid ? stockUnitsState[uid] : null;
        const actorAid = ev.actor?.agentId || pl.cookId;
        if (uState) {
          if (pl.remainingAfter !== undefined) {
            uState.remainingQty = Number(pl.remainingAfter);
          }
          uState.status = uState.remainingQty <= 0 ? "DEPLETED" : "ON_SHELF";
          uState.holderAgentId = null;
          uState.holderName = null;
          const lastEntry = uState.appliedConsumption[uState.appliedConsumption.length - 1];
          if (lastEntry && !lastEntry.returnedAtMs) {
            lastEntry.returnedAtMs = ev.eventTimeMs;
            lastEntry.action = "TAKEN_USED_RETURNED";
          }
        }
        if (actorAid && bs.activeAgents[actorAid]) {
          bs.activeAgents[actorAid].carryingIngredientUnit = null;
        }
        break;
      }
      case "BARMAN_BOTTLE_PICKED":
      case "BARMAN_DRINK_POURED":
      case "BAR_BOTTLE_TAKEN":
      case "BAR_DRINK_POURED": {
        const uid = pl.unitId || pl.bottleUnitId || ev.target?.domainEntityId;
        const uState = uid ? stockUnitsState[uid] : null;
        const barAid = ev.actor?.agentId;
        const barName = ev.actor?.name || "Barman";
        const isPick = ev.eventType === "BAR_BOTTLE_TAKEN" || ev.eventType === "BARMAN_BOTTLE_PICKED";
        if (uState) {
          const qtyTaken = Number(pl.qtyTaken ?? pl.pourMl ?? pl.deducted ?? 120);
          const before = pl.beforeQuantity !== undefined ? Number(pl.beforeQuantity) : uState.remainingQty;
          const after =
            pl.remainingAfter !== undefined
              ? Number(pl.remainingAfter)
              : isPick
              ? before
              : Math.max(0, before - qtyTaken);
          uState.remainingQty = after;
          uState.status = isPick ? "IN_USE_BY_BARMAN" : after <= 0 ? "DEPLETED" : "ON_SHELF";
          uState.holderAgentId = isPick ? barAid : null;
          uState.holderName = isPick ? barName : null;
          if (!isPick) {
            uState.appliedConsumption.push({
              stepIndex: uState.appliedConsumption.length + 1,
              timestampMs: ev.eventTimeMs,
              takenAtMs: ev.eventTimeMs,
              returnedAtMs: ev.eventTimeMs + 35000,
              actorAgentId: barAid,
              actorName: barName,
              cookId: barAid,
              cookName: barName,
              stationId: pl.stationId || uState.stationId,
              dishInstanceId: ev.dishInstanceId || pl.dishInstanceId,
              dishName: pl.drinkName || pl.dishName || "Service Verre",
              orderId: ev.orderId || pl.orderId,
              tableId: pl.tableId,
              tableLabel: pl.tableLabel || pl.tableName,
              qtyTaken,
              remainingBefore: before,
              remainingAfter: after,
              unit: uState.unit || "ml",
              action: "BAR_POUR_RETURNED",
              notes: pl.notes || `${barName} sert ${qtyTaken}ml sur ${uState.unitLabel} (${after}ml restants)`,
            });
          }
        }
        if (barAid && bs.activeAgents[barAid]) {
          bs.activeAgents[barAid].status = "POURING_DRINK";
          bs.activeAgents[barAid].currentTask = `Service au bar: ${pl.drinkName || uState?.ingredientName || "Grand Cru"}`;
        }
        break;
      }
      case "BARMAN_BOTTLE_RETURNED":
      case "BAR_BOTTLE_RETURNED": {
        const uid = pl.unitId || pl.bottleUnitId || ev.target?.domainEntityId;
        const uState = uid ? stockUnitsState[uid] : null;
        if (uState) {
          if (pl.remainingAfter !== undefined) uState.remainingQty = Number(pl.remainingAfter);
          uState.status = uState.remainingQty <= 0 ? "DEPLETED" : "ON_SHELF";
          uState.holderAgentId = null;
          uState.holderName = null;
        }
        break;
      }
      case "PRODUCTION_BATCH_STARTED": {
        const st = findStation(bs, ev.target?.domainEntityId, "hot_kitchen");
        if (st) {
          st.status = "PREP_BATCH";
          st.activeTasks.push({
            taskId: `${ev._id}-batch`,
            orderId: pl.batchId || ev._id,
            tableId: null,
            tableLabel: "Mise en Place",
            course: 0,
            dishName: pl.ingredientName || pl.label || "Préparation Maison",
            label: pl.ingredientName || pl.label || "Préparation Maison",
            category: "Mise en Place",
            qty: pl.quantityProduced || 1,
            unit: pl.unit || "lot",
            visualAsset: pl.visualAsset || "stockpot_simmer",
            recipeSummary: pl.recipeSummary || "Production fraîche du matin",
            chefName: ev.actor?.name || "Chef de Partie",
            status: "COOKING",
            startedAtMs: ev.eventTimeMs,
          });
        }
        break;
      }
      case "PRODUCTION_BATCH_COMPLETED": {
        bs.metrics.batchesProduced += 1;
        const st = findStation(bs, ev.target?.domainEntityId, "hot_kitchen");
        if (st) {
          st.activeTasks = st.activeTasks.filter((tk) => tk.orderId !== (pl.batchId || ev._id));
          st.status = st.activeTasks.length > 0 ? "COOKING" : "IDLE";
          st.completedCount += 1;
        }
        break;
      }
      case "EMPLOYEE_SHIFT_START": {
        bs.operatingStatus = "OPEN";
        const aid = ev.actor?.agentId;
        const home = pl.homeCoords || { x: 10, z: 6 };
        const prem = premisesList.find((p) => p.businessId === ev.businessId);
        const entry = (prem?.entrances || [])[0] || { x: home.x, z: 14.5 };
        if (aid) {
          const pathPoints = findNavigationPath(navGraph, entry.x, entry.z, home.x, home.z, ev.businessId);
          bs.activeAgents[aid] = {
            agentId: aid,
            employeeId: ev.actor.employeeId,
            name: ev.actor.name,
            role: ev.actor.role,
            jobTitle: ev.actor.jobTitle,
            agentKind: "employee",
            businessId: ev.businessId,
            status: "ON_DUTY",
            currentTask: ev.actor.jobTitle || "En service",
            fromX: entry.x,
            fromZ: entry.z,
            targetX: home.x,
            targetZ: home.z,
            homeCoords: home,
            pathPoints,
            moveStartMs: ev.eventTimeMs,
            moveDurationMs: 18000,
          };
        }
        break;
      }
      case "EMPLOYEE_SHIFT_END": {
        if (ev.actor?.agentId) delete bs.activeAgents[ev.actor.agentId];
        break;
      }
      case "CUSTOMER_ARRIVAL": {
        const cid = ev.actor?.agentId;
        if (!cid) break;
        const prem = premisesList.find((p) => p.businessId === ev.businessId);
        const entry = (prem?.entrances || [])[0] || { x: 10, z: 15.8 };
        const dest = pl.targetCoords || { x: entry.x, z: entry.z - 2.2 };
        // Start customer party on the street promenade sidewalk and walk through the front entrance to the host stand
        const startX = entry.x - 5.5;
        const startZ = 18.8;
        bs.activeAgents[cid] = {
          agentId: cid,
          name: pl.partyName || ev.actor.name,
          role: "Customer",
          partySize: Number(pl.partySize || 2),
          agentKind: "customer",
          businessId: ev.businessId,
          orderId: pl.orderId,
          tableId: ev.target?.tableId || pl.tableId,
          status: "ARRIVING",
          currentTask: `Arrivée promenade → Accueil (${pl.partySize || 2}p)`,
          fromX: startX,
          fromZ: startZ,
          targetX: dest.x,
          targetZ: dest.z,
          pathPoints: findNavigationPath(navGraph, startX, startZ, dest.x, dest.z, ev.businessId),
          moveStartMs: ev.eventTimeMs,
          moveDurationMs: 24000,
        };
        break;
      }
      case "PARTY_SEATED": {
        const tid = pl.tableId || ev.target?.tableId;
        const tbObj = tid ? bs.tables[tid] : null;
        const dest = tbObj?.transform || pl.targetCoords || { x: 10, z: 6 };
        const tableLabel = tbObj?.label || pl.tableName || pl.tableLabel || tid || "Salle";
        if (tbObj) {
          tbObj.status = "SEATED";
          tbObj.partyName = pl.partyName || ev.actor?.name;
          tbObj.partySize = Number(pl.partySize || 2);
          tbObj.activeOrderId = pl.orderId || ev.orderId;
          tbObj.waiterName =
            pl.waiterName || (ev.actor?.role?.toUpperCase() !== "CUSTOMER" ? ev.actor?.name : "Service Salle");
          tbObj.servedDishes = [];
        }
        const cid =
          pl.customerAgentId ||
          (ev.actor?.role?.toUpperCase() === "CUSTOMER" || String(ev.actor?.agentId || "").includes("agent-cust-")
            ? ev.actor?.agentId
            : null);
        if (cid) {
          if (!bs.activeAgents[cid]) {
            const prem = premisesList.find((p) => p.businessId === ev.businessId);
            const entry = (prem?.entrances || [])[0] || { x: 10, z: 15.8 };
            bs.activeAgents[cid] = {
              agentId: cid,
              name: pl.partyName || ev.actor?.name || "Clients",
              role: "Customer",
              partySize: Number(pl.partySize || 2),
              agentKind: "customer",
              businessId: ev.businessId,
              orderId: pl.orderId || ev.orderId,
              tableId: tid,
              status: "ARRIVING",
              currentTask: `Accueil → ${tableLabel}`,
              fromX: entry.x,
              fromZ: entry.z,
              targetX: dest.x,
              targetZ: dest.z,
              pathPoints: findNavigationPath(navGraph, entry.x, entry.z, dest.x, dest.z, ev.businessId),
              moveStartMs: ev.eventTimeMs - 14000,
              moveDurationMs: 14000,
            };
          }
          const custAg = bs.activeAgents[cid];
          custAg.status = "SEATED";
          custAg.tableId = tid;
          custAg.tableSeats = tbObj?.seats || Number(pl.partySize || 2);
          custAg.tableWidth = tbObj?.transform?.width || 0.9;
          custAg.tableDepth = tbObj?.transform?.depth || 0.9;
          custAg.currentTask = `À table (${tableLabel} • ${pl.partySize || 2} couverts)`;
          moveAgent(custAg, dest.x, dest.z, ev.eventTimeMs, 16000);
        }
        const waiterAid =
          pl.waiterId ||
          (ev.actor?.role?.toUpperCase() !== "CUSTOMER" && !String(ev.actor?.agentId || "").includes("agent-cust-")
            ? ev.actor?.agentId
            : null);
        if (waiterAid && bs.activeAgents[waiterAid]) {
          scheduleWaiterRoundTrip(bs.activeAgents[waiterAid], ev.eventTimeMs, {
            tableSideX: dest.x + 0.65,
            tableSideZ: dest.z + 0.52,
            tableCenterX: dest.x,
            tableCenterZ: dest.z,
            outboundTask: `Accueil & placement ${pl.partyName || "Clients"} → ${tableLabel}`,
            tableDwellTask: `Présentation de la carte (${tableLabel})`,
            returnTask: "Retour au poste de salle",
            idleTask: "Service en salle & accueil",
            outboundStatus: "ON_DUTY",
          });
        }
        bs.metrics.activeCovers += Number(pl.partySize || 2);
        bs.metrics.totalCoversServed += Number(pl.partySize || 2);
        break;
      }
      case "ORDER_CREATED":
      case "ORDER_TAKEN_AT_TABLE": {
        const ordId = ev.orderId || pl.orderId;
        const tid = pl.tableId || ev.target?.tableId;
        const tbObj = tid ? bs.tables[tid] : null;
        if (!bs.activeOrdersMap[ordId]) {
          bs.metrics.activeOrders += 1;
          const dbOrd = dayOrdersById[ordId];
          bs.activeOrdersMap[ordId] = {
            orderId: ordId,
            orderNumber: pl.orderNumber || dbOrd?.orderNumber || String(ordId || "").slice(-6),
            tableId: tid,
            tableLabel: pl.tableLabel || pl.tableName || tbObj?.label || tid,
            covers: pl.covers || pl.partySize || dbOrd?.covers || tbObj?.partySize || 2,
            waiterName: ev.actor?.name || pl.waiterName || dbOrd?.waiterName,
            openedAt: dbOrd?.openedAt || ev.timestamp,
            totalCents: dbOrd?.paidCents || dbOrd?.dueCents || dbOrd?.subtotalCents || pl.totalCents || 0,
            status: "OPEN",
            currentCourse: 1,
            items: [],
          };
        }
        if (ev.eventType === "ORDER_TAKEN_AT_TABLE") {
          const waiterAid = ev.actor?.agentId;
          const dest = tbObj?.transform || { x: 10, z: 6 };
          const tableLabel = pl.tableName || tbObj?.label || tid || "Table";
          if (waiterAid && bs.activeAgents[waiterAid]) {
            scheduleWaiterRoundTrip(bs.activeAgents[waiterAid], ev.eventTimeMs, {
              tableSideX: dest.x + 0.62,
              tableSideZ: dest.z + 0.52,
              tableCenterX: dest.x,
              tableCenterZ: dest.z,
              outboundTask: `Prise de commande → ${tableLabel}`,
              tableDwellTask: `Prise de commande (${tableLabel})`,
              returnTask: "Envoi des bons en cuisine",
              idleTask: "Service en salle",
              outboundStatus: "ON_DUTY",
            });
          }
        }
        break;
      }
      case "WATER_AND_BREAD_SERVED":
      case "GUEST_DINING_CHECKIN": {
        const tid = pl.tableId || ev.target?.tableId;
        const tbObj = tid ? bs.tables[tid] : null;
        const waiterAid = ev.actor?.agentId;
        if (waiterAid && bs.activeAgents[waiterAid] && tbObj?.transform) {
          const dest = tbObj.transform;
          const tableLabel = pl.tableName || tbObj.label || tid;
          scheduleWaiterRoundTrip(bs.activeAgents[waiterAid], ev.eventTimeMs, {
            tableSideX: dest.x + 0.62,
            tableSideZ: dest.z + 0.52,
            tableCenterX: dest.x,
            tableCenterZ: dest.z,
            outboundTask:
              ev.eventType === "WATER_AND_BREAD_SERVED"
                ? `Service carafe & pain → ${tableLabel}`
                : `Suivi courtois → ${tableLabel}`,
            tableDwellTask:
              ev.eventType === "WATER_AND_BREAD_SERVED"
                ? `Mise en place pain & eau (${tableLabel})`
                : `Vérification satisfaction (${tableLabel})`,
            returnTask: "Retour en salle",
            idleTask: "Surveillance des tables",
            outboundStatus: "ON_DUTY",
          });
        }
        break;
      }
      case "ORDER_LINES_SENT_TO_STATION": {
        const ordId = ev.orderId || pl.orderId;
        const st = findStation(bs, ev.target?.domainEntityId, "hot_kitchen");
        const tableLabel = pl.tableLabel || pl.tableName || (pl.tableId && bs.tables[pl.tableId]?.label) || pl.tableId || "Comptoir";
        const rawItems =
          Array.isArray(pl.items) && pl.items.length > 0
            ? pl.items
            : pl.itemName || pl.dishName
            ? [
                {
                  dishInstanceId: ev.dishInstanceId || pl.dishInstanceId,
                  name: pl.itemName || pl.dishName,
                  category: pl.category || "Cuisine",
                  qty: 1,
                },
              ]
            : [];
        const enrichedItems = rawItems.map((item) => ({
          ...item,
          visualAsset: inferDishVisualAsset(item, ev.businessId, pl.course),
        }));
        if (st) {
          st.status = "QUEUED";
          for (const [idx, item] of enrichedItems.entries()) {
            const dishName = item.name || item.dishName || item.label || "Plat Signature";
            const dishInstId = item.dishInstanceId || ev.dishInstanceId || `${ordId}-c${pl.course}-${idx}`;
            st.activeTasks.push({
              taskId: dishInstId,
              dishInstanceId: dishInstId,
              orderId: ordId,
              tableId: pl.tableId,
              tableLabel,
              course: pl.course,
              dishName,
              label: dishName,
              category: item.category || "Cuisine",
              qty: Number(item.qty || 1),
              prepMinutes: Number(item.prepMinutes || 12),
              visualAsset: item.visualAsset,
              recipeSummary: item.recipeSummary || "Préparation minute aux produits frais",
              chefName: pl.chefName || "Brigade Cuisine",
              ingredientUnitsUsed: item.ingredientUnitsUsed || [],
              status: "QUEUED",
              startedAtMs: ev.eventTimeMs,
            });
          }
        }
        if (bs.activeOrdersMap[ordId]) {
          const ord = bs.activeOrdersMap[ordId];
          ord.status = `COURSE_${pl.course}_SENT`;
          ord.items.push(...enrichedItems);
          if (!ord.totalCents || ord.totalCents === 0) {
            ord.totalCents = ord.items.reduce(
              (sum, it) => sum + (it.lineTotalCents || (it.unitPriceCents || 2200) * Number(it.qty || 1)),
              0
            );
          }
        }
        break;
      }
      case "ITEM_PREP_STARTED": {
        const ordId = ev.orderId || pl.orderId;
        const st = findStation(bs, ev.target?.domainEntityId, "hot_kitchen");
        const chefName = ev.actor?.name || pl.chefName || "Chef de Partie";
        const singleDishId = ev.dishInstanceId || pl.dishInstanceId;
        const rawItems =
          Array.isArray(pl.items) && pl.items.length > 0
            ? pl.items
            : pl.itemName || pl.dishName
            ? [
                {
                  dishInstanceId: singleDishId,
                  name: pl.itemName || pl.dishName,
                  category: pl.category || "Cuisine",
                  qty: 1,
                  ingredientUnitsUsed: pl.ingredientsConsumed || [],
                },
              ]
            : [];
        if (st) {
          st.status = "COOKING";
          let matched = false;
          for (const tk of st.activeTasks) {
            if (
              (singleDishId && tk.dishInstanceId === singleDishId) ||
              (!singleDishId && tk.orderId === ordId && tk.course === pl.course)
            ) {
              tk.status = "COOKING";
              tk.chefName = chefName;
              tk.startedAtMs = ev.eventTimeMs;
              matched = true;
            }
          }
          if (!matched && rawItems.length > 0) {
            const tableLabel = pl.tableLabel || pl.tableName || (pl.tableId && bs.tables[pl.tableId]?.label) || pl.tableId || "Salle";
            for (const [idx, item] of rawItems.entries()) {
              const dishName = item.name || item.dishName || item.label || "Plat Signature";
              const dishInstId = item.dishInstanceId || singleDishId || `${ordId}-c${pl.course}-${idx}`;
              const catDish = dishInstancesState[dishInstId];
              st.activeTasks.push({
                taskId: dishInstId,
                dishInstanceId: dishInstId,
                orderId: ordId,
                tableId: pl.tableId,
                tableLabel,
                course: pl.course,
                dishName,
                label: dishName,
                category: item.category || "Cuisine",
                qty: Number(item.qty || 1),
                prepMinutes: Number(item.prepMinutes || 12),
                visualAsset: inferDishVisualAsset(item, ev.businessId, pl.course),
                recipeSummary: item.recipeSummary || catDish?.recipeSummary || "Préparation minute",
                chefName,
                ingredientUnitsUsed: catDish?.ingredientUnitsUsed || item.ingredientUnitsUsed || [],
                status: "COOKING",
                startedAtMs: ev.eventTimeMs,
              });
            }
          }
        }
        const cookAid = ev.actor?.agentId;
        if (cookAid && bs.activeAgents[cookAid] && st?.transform) {
          const firstItem = rawItems[0];
          const dishTitle = firstItem?.name || pl.itemName || pl.primaryDishName || "Plat";
          bs.activeAgents[cookAid].status = "COOKING";
          bs.activeAgents[cookAid].activeDish = dishTitle;
          bs.activeAgents[cookAid].visualAsset = inferDishVisualAsset(firstItem || { name: dishTitle }, ev.businessId, pl.course);
          bs.activeAgents[cookAid].currentTask = `Cuisson: ${dishTitle}`;
          moveAgent(bs.activeAgents[cookAid], st.transform.x, st.transform.z + 0.82, ev.eventTimeMs, 14000);
        }
        break;
      }
      case "ITEM_READY_AT_PASS": {
        const ordId = ev.orderId || pl.orderId;
        const singleDishId = ev.dishInstanceId || pl.dishInstanceId;
        for (const st of Object.values(bs.stations)) {
          if (st.stationKind !== "pass") {
            const before = st.activeTasks.length;
            st.activeTasks = st.activeTasks.filter((tk) =>
              singleDishId
                ? tk.dishInstanceId !== singleDishId
                : !(tk.orderId === ordId && tk.course === pl.course)
            );
            if (st.activeTasks.length < before) st.completedCount += before - st.activeTasks.length;
            if (st.activeTasks.length === 0) st.status = "IDLE";
          }
        }
        const passSt = findStation(bs, ev.target?.domainEntityId, "pass");
        const tableLabel = pl.tableLabel || pl.tableName || (pl.tableId && bs.tables[pl.tableId]?.label) || pl.tableId || "Salle";
        const rawItems =
          Array.isArray(pl.items) && pl.items.length > 0
            ? pl.items
            : pl.itemName || pl.dishName
            ? [{ dishInstanceId: singleDishId, name: pl.itemName || pl.dishName, qty: 1 }]
            : [];
        if (passSt && pl.station !== "bar") {
          passSt.status = "READY_AT_PASS";
          for (const [idx, item] of rawItems.entries()) {
            const dishName = item.name || item.dishName || item.label || "Plat Dressé";
            const dishInstId = item.dishInstanceId || singleDishId || `${ordId}-pass-c${pl.course}-${idx}`;
            const catDish = dishInstancesState[dishInstId];
            passSt.activeTasks.push({
              taskId: dishInstId,
              dishInstanceId: dishInstId,
              orderId: ordId,
              tableId: pl.tableId,
              tableLabel,
              course: pl.course,
              dishName,
              label: dishName,
              category: item.category || "Passe Chaude",
              qty: Number(item.qty || 1),
              prepMinutes: Number(item.prepMinutes || 10),
              visualAsset: inferDishVisualAsset(item, ev.businessId, pl.course),
              recipeSummary: item.recipeSummary || catDish?.recipeSummary || "Dressé sur assiette chaude sous lampe",
              chefName: ev.actor?.name || pl.chefName || "Chef",
              ingredientUnitsUsed: catDish?.ingredientUnitsUsed || item.ingredientUnitsUsed || [],
              status: "READY_AT_PASS",
              startedAtMs: ev.eventTimeMs,
            });
          }
        }
        break;
      }
      case "ORDER_PICKED_UP_FROM_PASS": {
        const ordId = ev.orderId || pl.orderId;
        const singleDishId = ev.dishInstanceId || pl.dishInstanceId;
        const passSt = findStation(bs, ev.target?.domainEntityId, "pass");
        if (passSt) {
          passSt.activeTasks = passSt.activeTasks.filter((tk) =>
            singleDishId
              ? tk.dishInstanceId !== singleDishId
              : !(tk.orderId === ordId && tk.course === pl.course)
          );
          if (passSt.activeTasks.length === 0) passSt.status = "IDLE";
        }
        const waiterAid = ev.actor?.agentId;
        if (waiterAid && bs.activeAgents[waiterAid]) {
          bs.activeAgents[waiterAid].status = "SERVING";
          bs.activeAgents[waiterAid].carryingDish = pl.itemName || pl.dishName || `Suite ${pl.course || 1}`;
          bs.activeAgents[waiterAid].currentTask = `Enlèvement au passe → ${pl.tableName || pl.tableLabel || pl.tableId || "Salle"}`;
        }
        break;
      }
      case "DRINK_SERVED_AT_TABLE":
      case "ORDER_DELIVERED_TO_TABLE": {
        const ordId = ev.orderId || pl.orderId;
        const singleDishId = ev.dishInstanceId || pl.dishInstanceId;
        const passSt = findStation(bs, null, "pass");
        if (passSt && ev.eventType === "ORDER_DELIVERED_TO_TABLE") {
          const before = passSt.activeTasks.length;
          passSt.activeTasks = passSt.activeTasks.filter((tk) =>
            singleDishId
              ? tk.dishInstanceId !== singleDishId
              : !(tk.orderId === ordId && tk.course === pl.course)
          );
          if (passSt.activeTasks.length < before) passSt.completedCount += before - passSt.activeTasks.length;
          if (passSt.activeTasks.length === 0) passSt.status = "IDLE";
        }
        const tid = pl.tableId || ev.target?.tableId;
        const tbObj = tid ? bs.tables[tid] : null;
        const ord = bs.activeOrdersMap[ordId];
        const isDrinkService = ev.eventType === "DRINK_SERVED_AT_TABLE";
        const courseNum = isDrinkService ? 0 : pl.course !== undefined ? Number(pl.course) : 1;

        const sourceItems =
          Array.isArray(pl.items) && pl.items.length > 0
            ? pl.items
            : pl.itemName || pl.dishName || pl.drinkName || singleDishId
            ? [
                {
                  dishInstanceId: singleDishId,
                  name: pl.itemName || pl.dishName || pl.drinkName || "Plat Signature",
                  course: courseNum,
                  seatNumber: pl.seatNumber,
                  qty: 1,
                },
              ]
            : ord?.items && ord.items.length > 0
            ? ord.items
            : [{ name: `Suite ${courseNum || 1}`, qty: tbObj?.partySize || 2 }];

        if (tbObj) {
          const newlyDelivered = sourceItems.map((it, idx) => {
            const matchedCatalogDish =
              (it.dishInstanceId && dishInstancesState[it.dishInstanceId]) ||
              Object.values(dishInstancesState).find(
                (d) =>
                  d.dishInstanceId === it.dishInstanceId ||
                  (d.tableId === tid &&
                    d.course === courseNum &&
                    d.dishName?.toLowerCase() === String(it.name || it.dishName || "").toLowerCase())
              );
            const dishInstanceId =
              it.dishInstanceId ||
              matchedCatalogDish?.dishInstanceId ||
              `dish-${tid}-${ordId || "ord"}-c${courseNum}-${idx}`;
            const sceneObjectId = matchedCatalogDish?.sceneObjectId || `scene-dish-${dishInstanceId}`;

            if (!dishInstancesState[dishInstanceId]) {
              dishInstancesState[dishInstanceId] = {
                dishInstanceId,
                sceneObjectId,
                businessId: ev.businessId,
                orderId: ordId,
                tableId: tid,
                tableLabel: tbObj.label || tid,
                course: courseNum,
                dishName: it.name || it.dishName || "Plat Signature",
                visualAsset: inferDishVisualAsset(it, ev.businessId, courseNum),
                recipeSummary: it.recipeSummary || matchedCatalogDish?.recipeSummary || "Préparation minute aux produits frais",
                stationId: matchedCatalogDish?.stationId || null,
                cookAgentId: matchedCatalogDish?.cookAgentId || null,
                cookName: it.chefName || matchedCatalogDish?.cookName || "Chef de Partie",
                waiterAgentId: ev.actor?.agentId || matchedCatalogDish?.waiterAgentId || null,
                waiterName: ev.actor?.name || tbObj.waiterName || matchedCatalogDish?.waiterName || "Service Salle",
                orderedAtMs: ev.eventTimeMs - 14 * 60000,
                prepStartedAtMs: ev.eventTimeMs - 10 * 60000,
                readyAtPassMs: ev.eventTimeMs - 2 * 60000,
                pickedUpAtMs: ev.eventTimeMs - 1 * 60000,
                deliveredAtMs: ev.eventTimeMs,
                status: "SERVED_AT_TABLE",
                currentStage: "SERVED_AT_TABLE",
                ingredientUnitsUsed: it.ingredientUnitsUsed || matchedCatalogDish?.ingredientUnitsUsed || [],
                stages: matchedCatalogDish?.stages || [],
              };
            }

            return {
              dishInstanceId,
              sceneObjectId,
              dishName: it.name || it.dishName || matchedCatalogDish?.dishName || "Plat",
              qty: it.qty || 1,
              course: courseNum,
              seatNumber: it.seatNumber || matchedCatalogDish?.seatNumber || idx + 1,
              orderId: ordId,
              tableId: tid,
              tableLabel: tbObj.label || tid,
              visualAsset: inferDishVisualAsset(it, ev.businessId, courseNum),
              recipeSummary: it.recipeSummary || matchedCatalogDish?.recipeSummary || "",
              cookName: it.chefName || matchedCatalogDish?.cookName || "Brigade Cuisine",
              waiterName: ev.actor?.name || tbObj.waiterName || "Service Salle",
              deliveredAtMs: ev.eventTimeMs,
              ingredientUnitsUsed:
                it.ingredientUnitsUsed || matchedCatalogDish?.ingredientUnitsUsed || [],
            };
          });

          if (isDrinkService) {
            tbObj.servedDrinks = [...(tbObj.servedDrinks || []), ...newlyDelivered].slice(-Math.max(2, tbObj.partySize || 2));
          } else {
            tbObj.status = `DINING_COURSE_${courseNum}`;
            tbObj.currentCourse = courseNum;
            const maxPlates = Math.max(1, Number(tbObj.partySize) || 2);
            const sameCourseExisting = (tbObj.servedDishes || []).filter((sd) => sd.course === courseNum);
            const mergedById = new Map();
            for (const ed of sameCourseExisting) {
              mergedById.set(ed.dishInstanceId, ed);
            }
            for (const nd of newlyDelivered) {
              mergedById.set(nd.dishInstanceId, nd);
            }
            tbObj.servedDishes = Array.from(mergedById.values())
              .slice(-maxPlates)
              .map((d, seatIdx) => ({ ...d, seatNumber: seatIdx + 1 }));
          }
        }
        if (ord && courseNum > 0) ord.status = `DINING_COURSE_${courseNum}`;

        // Update seated customer task label to show the dish they are enjoying
        const firstDish = sourceItems[0]?.name || sourceItems[0]?.dishName || pl.itemName || pl.drinkName || `Suite ${courseNum}`;
        for (const ag of Object.values(bs.activeAgents)) {
          if (ag.agentKind === "customer" && ag.tableId === tid && ag.status === "SEATED") {
            ag.currentTask = `Dégustation: ${firstDish}`;
          }
        }

        const waiterAid = ev.actor?.agentId;
        const dest = tbObj?.transform || pl.targetCoords || { x: 10, z: 6 };
        const tableLabel = tbObj?.label || pl.tableName || pl.tableLabel || tid || "Table";
        if (waiterAid && bs.activeAgents[waiterAid]) {
          const pickupCoords = passSt?.transform
            ? { x: passSt.transform.x, z: passSt.transform.z + 0.85 }
            : null;
          scheduleWaiterRoundTrip(bs.activeAgents[waiterAid], ev.eventTimeMs, {
            pickupCoords,
            tableSideX: dest.x + 0.62,
            tableSideZ: dest.z + 0.52,
            tableCenterX: dest.x,
            tableCenterZ: dest.z,
            outboundTask: `Service: ${firstDish} → ${tableLabel}`,
            tableDwellTask: `Annonce & dressage: ${firstDish} (${tableLabel})`,
            returnTask: "Retour au passe / salle",
            idleTask: "En salle — Surveillance des tables",
            outboundStatus: "SERVING",
            carryingDish: firstDish,
          });
        }
        break;
      }
      case "PAYMENT_COMPLETED": {
        const rev = Number(pl.paidCents ?? pl.amountCents ?? 0) - Number(pl.tipCents || 0);
        bs.metrics.revenueCents += rev;
        bs.metrics.tipCents += Number(pl.tipCents || 0);
        bs.metrics.completedOrders += 1;
        bs.metrics.activeOrders = Math.max(0, bs.metrics.activeOrders - 1);
        const tid = pl.tableId || ev.target?.tableId;
        const tbObj = tid ? bs.tables[tid] : null;
        const tableLabel = tbObj?.label || pl.tableName || pl.tableLabel || tid || "Table";
        if (tbObj) {
          // Guests remain seated right after paying until CUSTOMER_DEPARTED (~45s later)
          tbObj.status = "PAID_SEATED";
        }
        const cid =
          pl.customerAgentId ||
          Object.values(bs.activeAgents).find((a) => a.agentKind === "customer" && a.tableId === tid)?.agentId;
        if (cid && bs.activeAgents[cid]) {
          const custAg = bs.activeAgents[cid];
          custAg.status = "SEATED";
          custAg.currentTask = `Addition réglée (${((pl.paidCents || pl.amountCents || 6800) / 100).toFixed(0)}€) — Fin de repas`;
          if (timestampMs - ev.eventTimeMs <= 35000) {
            custAg.speechBubble =
              ev.businessId === "business-osteria-bellavista"
                ? "Grazie mille, tutto squisito!"
                : ev.businessId === "business-sakana-tei"
                ? "Gochisōsama deshita! C'était parfait."
                : "Merci beaucoup, c'était délicieux !";
            custAg.speechAtMs = ev.eventTimeMs;
          }
          // Fallback: if 48s have elapsed since payment and CUSTOMER_DEPARTED hasn't fired yet, depart now
          if (timestampMs >= ev.eventTimeMs + 48000 && custAg.status !== "DEPARTING") {
            const prem = premisesList.find((p) => p.businessId === ev.businessId);
            const entry = (prem?.entrances || [])[0] || { x: 10, z: 14.5 };
            custAg.status = "DEPARTING";
            custAg.currentTask = "Addition réglée — Sortie vers la promenade";
            custAg.departedAtMs = ev.eventTimeMs + 48000;
            custAg.departDurationMs = 35000;
            moveAgent(custAg, entry.x + 7.5, 18.8, ev.eventTimeMs + 48000, 35000);
            if (tbObj) tbObj.status = "NEEDS_CLEARING";
          }
        }

        // Waiter finishes TPE payment at the table and walks back to station
        const floorWaiters = Object.values(bs.activeAgents).filter(
          (a) =>
            a.agentKind === "employee" &&
            (a.role === "Floor" || /serveu|waiter|salle|rang|cameriere|sekkyaku/i.test(`${a.role} ${a.jobTitle || ""}`))
        );
        const waiterAg =
          (pl.waiterId && bs.activeAgents[pl.waiterId]) ||
          floorWaiters.find((a) => pl.waiterName && a.name?.toLowerCase().includes(String(pl.waiterName).toLowerCase())) ||
          floorWaiters.find((a) => tbObj?.waiterName && a.name?.toLowerCase().includes(String(tbObj.waiterName).toLowerCase())) ||
          floorWaiters[0];
        if (waiterAg && tbObj?.transform) {
          const tableSideX = tbObj.transform.x + 0.62;
          const tableSideZ = tbObj.transform.z + 0.52;
          const faceHeading = Math.atan2(tbObj.transform.x - tableSideX, tbObj.transform.z - tableSideZ);
          const retX = waiterAg.homeCoords?.x ?? 10;
          const retZ = waiterAg.homeCoords?.z ?? 8;
          const toHomePath = findNavigationPath(navGraph, tableSideX, tableSideZ, retX, retZ, ev.businessId);
          waiterAg.segments = [
            {
              startMs: ev.eventTimeMs,
              endMs: ev.eventTimeMs + 6500,
              fromX: tableSideX,
              fromZ: tableSideZ,
              targetX: tableSideX,
              targetZ: tableSideZ,
              pathPoints: [
                { x: tableSideX, z: tableSideZ },
                { x: tableSideX, z: tableSideZ },
              ],
              isDwell: true,
              fixedHeadingRad: faceHeading,
              status: "BRINGING_BILL",
              currentTask: `💳 Paiement TPE accepté (${tableLabel})`,
              carryingDish: null,
            },
            {
              startMs: ev.eventTimeMs + 6500,
              endMs: ev.eventTimeMs + 20500,
              fromX: tableSideX,
              fromZ: tableSideZ,
              targetX: retX,
              targetZ: retZ,
              pathPoints: toHomePath,
              status: "ON_DUTY",
              currentTask: `Retour caisse avec TPE (${tableLabel})`,
              carryingDish: null,
            },
            {
              startMs: ev.eventTimeMs + 20500,
              endMs: Number.MAX_SAFE_INTEGER,
              fromX: retX,
              fromZ: retZ,
              targetX: retX,
              targetZ: retZ,
              pathPoints: [
                { x: retX, z: retZ },
                { x: retX, z: retZ },
              ],
              isDwell: true,
              fixedHeadingRad: 0,
              status: "ON_DUTY",
              currentTask: "Service en salle & surveillance",
              carryingDish: null,
            },
          ];
        }
        delete bs.activeOrdersMap[ev.orderId || pl.orderId];
        break;
      }
      case "CUSTOMER_DEPARTED": {
        const tid = pl.tableId || ev.target?.tableId;
        const tbObj = tid ? bs.tables[tid] : null;
        if (tbObj) {
          bs.metrics.activeCovers = Math.max(0, bs.metrics.activeCovers - (tbObj.partySize || 2));
          tbObj.status = "NEEDS_CLEARING";
        }
        const cid =
          ev.actor?.agentId ||
          pl.customerAgentId ||
          Object.values(bs.activeAgents).find((a) => a.agentKind === "customer" && a.tableId === tid)?.agentId;
        if (cid && bs.activeAgents[cid]) {
          const custAg = bs.activeAgents[cid];
          if (custAg.status !== "DEPARTING") {
            const prem = premisesList.find((p) => p.businessId === ev.businessId);
            const entry = (prem?.entrances || [])[0] || { x: 10, z: 14.5 };
            custAg.status = "DEPARTING";
            custAg.currentTask = "Au revoir — Sortie vers la promenade";
            custAg.departedAtMs = ev.eventTimeMs;
            custAg.departDurationMs = 34000;
            moveAgent(custAg, entry.x + 7.5, 18.8, ev.eventTimeMs, 34000);
          }
        }
        break;
      }
      case "TABLE_CLEARED": {
        const tid = pl.tableId || ev.target?.tableId;
        const tbObj = tid ? bs.tables[tid] : null;
        const tableLabel = tbObj?.label || pl.tableName || pl.tableLabel || tid || "Table";
        const tableCoords = tbObj?.transform || { x: 10, z: 8 };
        if (tbObj) {
          tbObj.status = "AVAILABLE";
          tbObj.partyName = null;
          tbObj.partySize = 0;
          tbObj.activeOrderId = null;
          tbObj.currentCourse = 0;
          tbObj.servedDishes = [];
          tbObj.servedDrinks = [];
        }
        const dishSt = findStation(bs, null, "dishwashing");
        const waiterAid = ev.actor?.agentId;
        const waiterAg =
          (waiterAid && bs.activeAgents[waiterAid]) ||
          Object.values(bs.activeAgents).find(
            (a) => a.agentKind === "employee" && (a.role === "Floor" || /serveu|waiter|salle/i.test(a.jobTitle || ""))
          );
        if (waiterAg) {
          const tableSideX = tableCoords.x + 0.58;
          const tableSideZ = tableCoords.z + 0.48;
          const plongeX = dishSt?.transform ? dishSt.transform.x : (waiterAg.homeCoords?.x ?? 10);
          const plongeZ = dishSt?.transform ? dishSt.transform.z + 0.82 : (waiterAg.homeCoords?.z ?? 4);
          const retX = waiterAg.homeCoords?.x ?? 10;
          const retZ = waiterAg.homeCoords?.z ?? 8;
          const toPlongePath = findNavigationPath(navGraph, tableSideX, tableSideZ, plongeX, plongeZ, ev.businessId);
          const toHomePath = findNavigationPath(navGraph, plongeX, plongeZ, retX, retZ, ev.businessId);
          waiterAg.segments = [
            {
              startMs: ev.eventTimeMs,
              endMs: ev.eventTimeMs + 15000,
              fromX: tableSideX,
              fromZ: tableSideZ,
              targetX: plongeX,
              targetZ: plongeZ,
              pathPoints: toPlongePath,
              status: "BUSSING_TO_PLONGE",
              currentTask: `Débarrassage vaisselle sale → Plonge (${tableLabel})`,
              carryingDish: `Vaisselle sale (${tableLabel})`,
            },
            {
              startMs: ev.eventTimeMs + 15000,
              endMs: ev.eventTimeMs + 19500,
              fromX: plongeX,
              fromZ: plongeZ,
              targetX: plongeX,
              targetZ: plongeZ,
              pathPoints: [
                { x: plongeX, z: plongeZ },
                { x: plongeX, z: plongeZ },
              ],
              isDwell: true,
              fixedHeadingRad: Math.PI,
              status: "BUSSING_TO_PLONGE",
              currentTask: `Dépose bac vaisselle en plonge (${tableLabel})`,
              carryingDish: `Vaisselle sale (${tableLabel})`,
            },
            {
              startMs: ev.eventTimeMs + 19500,
              endMs: ev.eventTimeMs + 33500,
              fromX: plongeX,
              fromZ: plongeZ,
              targetX: retX,
              targetZ: retZ,
              pathPoints: toHomePath,
              status: "ON_DUTY",
              currentTask: `Retour en salle (${tableLabel} prête)`,
              carryingDish: null,
            },
            {
              startMs: ev.eventTimeMs + 33500,
              endMs: Number.MAX_SAFE_INTEGER,
              fromX: retX,
              fromZ: retZ,
              targetX: retX,
              targetZ: retZ,
              pathPoints: [
                { x: retX, z: retZ },
                { x: retX, z: retZ },
              ],
              isDwell: true,
              fixedHeadingRad: 0,
              status: "ON_DUTY",
              currentTask: "Service en salle & surveillance",
              carryingDish: null,
            },
          ];
        }
        if (dishSt && timestampMs - ev.eventTimeMs <= 45000) {
          dishSt.status = "WASHING";
          dishSt.activeTasks = [
            ...(dishSt.activeTasks || []).slice(-2),
            {
              taskId: `plonge-drop-${ev._id}`,
              orderId: ev.orderId || pl.orderId,
              tableId: tid,
              tableLabel,
              course: 0,
              dishName: `Bac Vaisselle (${tableLabel})`,
              label: `Bac Vaisselle (${tableLabel})`,
              category: "Plonge & Laverie",
              qty: 1,
              visualAsset: "cold_plated_dish",
              recipeSummary: "Tri couverts, prélavage douchette & mise en panier",
              chefName: ev.actor?.name || "Plongeur",
              status: "WASHING",
              startedAtMs: ev.eventTimeMs,
            },
          ];
        }
        break;
      }
      case "DISHES_WASHED_AT_PLONGE": {
        const tid = pl.tableId || ev.target?.tableId;
        const tableLabel = pl.tableName || pl.tableLabel || (tid && bs.tables[tid]?.label) || tid || "Salle";
        const dishSt = findStation(bs, ev.target?.domainEntityId, "dishwashing");
        if (dishSt) {
          dishSt.completedCount += 1;
          if (timestampMs - ev.eventTimeMs <= 50000) {
            dishSt.status = "WASHING";
            dishSt.activeTasks = [
              {
                taskId: `plonge-wash-${ev._id}`,
                orderId: ev.orderId || pl.orderId,
                tableId: tid,
                tableLabel,
                course: 0,
                dishName: `Lavage 85°C • ${tableLabel}`,
                label: `Lavage 85°C • ${tableLabel}`,
                category: "Cycle Stérilisation Plonge",
                qty: Number(pl.platesWashed || 2),
                visualAsset: "cold_plated_dish",
                recipeSummary: "Cycle tunnel haute température & séchage vapeur",
                chefName: ev.actor?.name || "Plongeur",
                status: "WASHING",
                startedAtMs: ev.eventTimeMs,
              },
            ];
          } else if ((dishSt.activeTasks || []).length === 0) {
            dishSt.status = "IDLE";
          }
        }
        const plongeurAid = ev.actor?.agentId;
        if (plongeurAid && bs.activeAgents[plongeurAid] && dishSt?.transform) {
          bs.activeAgents[plongeurAid].status = "ON_DUTY";
          bs.activeAgents[plongeurAid].currentTask = `🫧 Lavage & stérilisation vaisselle (${tableLabel})`;
          moveAgent(bs.activeAgents[plongeurAid], dishSt.transform.x, dishSt.transform.z + 0.72, ev.eventTimeMs, 10000);
        }
        break;
      }
      default:
        break;
    }
  }

  // Lookahead Projector for continuous multi-stage interactions leading up to PAYMENT_COMPLETED and TABLE_CLEARED:
  // 1) Clients raising hand to request the bill -> Waiter walking to POS terminal to print check & grab TPE -> Waiter presenting bill & TPE at table -> Guest paying by card
  // 2) Waiter walking to vacated NEEDS_CLEARING table -> Wiping down table with microfiber cloth & stacking dirty plates onto bussing tray
  const assignedLookaheadWaiters = new Set();
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev.eventTimeMs <= timestampMs) continue;
    if (ev.eventTimeMs > timestampMs + 62000) break;

    const bs = businessStates[ev.businessId];
    if (!bs) continue;
    const pl = ev.payload || {};

    if (ev.eventType === "PAYMENT_COMPLETED") {
      const timeUntilPaid = ev.eventTimeMs - timestampMs; // (0 .. 62000 ms before payment completes)
      if (timeUntilPaid <= 60000) {
        const tid = pl.tableId || ev.target?.tableId;
        const tbObj = tid ? bs.tables[tid] : null;
        const tableLabel = tbObj?.label || pl.tableName || pl.tableLabel || tid || "Table";
        const isPayingPhase = timeUntilPaid <= 22000;

        if (tbObj && tbObj.status !== "AVAILABLE") {
          tbObj.status = isPayingPhase ? "PAYING_BILL" : "REQUESTING_BILL";
        }

        // 1. Seated customer raises hand / presents gold card & speaks
        const custAg = Object.values(bs.activeAgents).find(
          (a) => a.agentKind === "customer" && a.tableId === tid
        );
        if (custAg) {
          custAg.status = isPayingPhase ? "PAYING_BILL" : "REQUESTING_BILL";
          custAg.currentTask = isPayingPhase
            ? `💳 Règlement par carte sur TPE (${((pl.paidCents || pl.amountCents || 6800) / 100).toFixed(0)}€)`
            : "✋ Demande l'addition au serveur";
          custAg.speechBubble = isPayingPhase
            ? ev.businessId === "business-osteria-bellavista"
              ? "Pago con carta contactless, grazie!"
              : ev.businessId === "business-sakana-tei"
              ? "Kādo de onegaishimasu (Par carte s'il vous plaît)."
              : "Je règle par carte sans contact, merci !"
            : ev.businessId === "business-osteria-bellavista"
            ? "Scusi, il conto per favore!"
            : ev.businessId === "business-sakana-tei"
            ? "Sumimasen, o-kaikei onegaishimasu! (L'addition SVP)"
            : "S'il vous plaît, l'addition !";
          custAg.speechAtMs = timestampMs;
        }

        // 2. Waiter walks to POS terminal to print bill & grab TPE, then walks to table to present bill & TPE
        const floorWaiters = Object.values(bs.activeAgents).filter(
          (a) =>
            a.agentKind === "employee" &&
            (a.role === "Floor" || /serveu|waiter|salle|rang|cameriere|sekkyaku/i.test(`${a.role} ${a.jobTitle || ""}`))
        );
        const preferredWaiter =
          (pl.waiterId && bs.activeAgents[pl.waiterId]) ||
          floorWaiters.find((a) => pl.waiterName && a.name?.toLowerCase().includes(String(pl.waiterName).toLowerCase())) ||
          floorWaiters.find((a) => tbObj?.waiterName && a.name?.toLowerCase().includes(String(tbObj.waiterName).toLowerCase()));
        const waiterAg =
          (preferredWaiter && !assignedLookaheadWaiters.has(preferredWaiter.agentId) ? preferredWaiter : null) ||
          floorWaiters.find((a) => !assignedLookaheadWaiters.has(a.agentId)) ||
          preferredWaiter ||
          floorWaiters[0];

        const posSt = findStation(bs, null, "pos") || findStation(bs, null, "pass");
        if (waiterAg && tbObj?.transform && timeUntilPaid <= 54000) {
          assignedLookaheadWaiters.add(waiterAg.agentId);
          const tReq = ev.eventTimeMs - 54000;
          const curAtReq = evaluateAgentAt(waiterAg, tReq);
          const startX = curAtReq.x ?? waiterAg.homeCoords?.x ?? 10;
          const startZ = curAtReq.z ?? waiterAg.homeCoords?.z ?? 8;
          const posX = posSt?.transform ? posSt.transform.x : startX;
          const posZ = posSt?.transform ? posSt.transform.z - 0.72 : startZ;
          const tableSideX = tbObj.transform.x + 0.62;
          const tableSideZ = tbObj.transform.z + 0.52;
          const faceTableHeading = Math.atan2(tbObj.transform.x - tableSideX, tbObj.transform.z - tableSideZ);

          const toPosPath = findNavigationPath(navGraph, startX, startZ, posX, posZ, ev.businessId);
          const posToTablePath = findNavigationPath(navGraph, posX, posZ, tableSideX, tableSideZ, ev.businessId);

          waiterAg.segments = [
            {
              startMs: tReq,
              endMs: tReq + 13000,
              fromX: startX,
              fromZ: startZ,
              targetX: posX,
              targetZ: posZ,
              pathPoints: toPosPath,
              status: "FETCHING_BILL",
              currentTask: `Va chercher l'addition & TPE au POS (${tableLabel})`,
              carryingDish: null,
            },
            {
              startMs: tReq + 13000,
              endMs: tReq + 19000,
              fromX: posX,
              fromZ: posZ,
              targetX: posX,
              targetZ: posZ,
              pathPoints: [
                { x: posX, z: posZ },
                { x: posX, z: posZ },
              ],
              isDwell: true,
              fixedHeadingRad: 0,
              status: "FETCHING_BILL",
              currentTask: `🖨️ Impression note & prise TPE (${tableLabel})`,
              carryingDish: null,
            },
            {
              startMs: tReq + 19000,
              endMs: tReq + 33000,
              fromX: posX,
              fromZ: posZ,
              targetX: tableSideX,
              targetZ: tableSideZ,
              pathPoints: posToTablePath,
              status: "BRINGING_BILL",
              currentTask: `Apporte l'addition & TPE → ${tableLabel}`,
              carryingDish: null,
            },
            {
              startMs: tReq + 33000,
              endMs: ev.eventTimeMs + 6500,
              fromX: tableSideX,
              fromZ: tableSideZ,
              targetX: tableSideX,
              targetZ: tableSideZ,
              pathPoints: [
                { x: tableSideX, z: tableSideZ },
                { x: tableSideX, z: tableSideZ },
              ],
              isDwell: true,
              fixedHeadingRad: faceTableHeading,
              status: "BRINGING_BILL",
              currentTask: `💳 Présentation addition & encaissement TPE (${tableLabel})`,
              carryingDish: null,
            },
          ];
          waiterAg.speechBubble = isPayingPhase
            ? "Voici le terminal sans contact, merci !"
            : "Je vous apporte l'addition tout de suite !";
          waiterAg.speechAtMs = timestampMs;

          if (posSt && timeUntilPaid >= 32000 && timeUntilPaid <= 46000) {
            posSt.status = "COOKING";
            posSt.activeTasks = [
              {
                taskId: `pos-bill-${ev._id}`,
                orderId: ev.orderId || pl.orderId,
                tableId: tid,
                tableLabel,
                course: 0,
                dishName: `Addition & TPE • ${tableLabel}`,
                label: `Addition & TPE • ${tableLabel}`,
                category: "Caisse & Facturation",
                qty: 1,
                visualAsset: "cold_plated_dish",
                recipeSummary: `Édition ticket ${((pl.paidCents || pl.amountCents || 6800) / 100).toFixed(2)}€`,
                chefName: waiterAg.name,
                status: "COOKING",
                startedAtMs: tReq + 13000,
              },
            ];
          }
        }
      }
    } else if (ev.eventType === "TABLE_CLEARED") {
      const timeUntilCleared = ev.eventTimeMs - timestampMs; // (0 .. 28000 ms before table finishes clearing)
      if (timeUntilCleared <= 28000) {
        const tid = pl.tableId || ev.target?.tableId;
        const tbObj = tid ? bs.tables[tid] : null;
        const tableLabel = tbObj?.label || pl.tableName || pl.tableLabel || tid || "Table";
        if (tbObj) {
          tbObj.status = timeUntilCleared <= 15000 ? "CLEARING_TABLE" : "NEEDS_CLEARING";
        }
        const floorWaiters = Object.values(bs.activeAgents).filter(
          (a) =>
            a.agentKind === "employee" &&
            (a.role === "Floor" || /serveu|waiter|salle|rang|cameriere|sekkyaku/i.test(`${a.role} ${a.jobTitle || ""}`))
        );
        const preferredClearWaiter =
          (ev.actor?.agentId && bs.activeAgents[ev.actor.agentId]) ||
          floorWaiters.find((a) => tbObj?.waiterName && a.name?.toLowerCase().includes(String(tbObj.waiterName).toLowerCase()));
        const waiterAg =
          (preferredClearWaiter && !assignedLookaheadWaiters.has(preferredClearWaiter.agentId)
            ? preferredClearWaiter
            : null) ||
          floorWaiters.find((a) => !assignedLookaheadWaiters.has(a.agentId)) ||
          preferredClearWaiter ||
          floorWaiters[0];

        if (waiterAg && tbObj?.transform) {
          assignedLookaheadWaiters.add(waiterAg.agentId);
          const tStartClear = ev.eventTimeMs - 28000;
          const curAtStart = evaluateAgentAt(waiterAg, tStartClear);
          const startX = curAtStart.x ?? waiterAg.homeCoords?.x ?? 10;
          const startZ = curAtStart.z ?? waiterAg.homeCoords?.z ?? 8;
          const tableSideX = tbObj.transform.x + 0.58;
          const tableSideZ = tbObj.transform.z + 0.48;
          const faceTableHeading = Math.atan2(tbObj.transform.x - tableSideX, tbObj.transform.z - tableSideZ);
          const toTablePath = findNavigationPath(navGraph, startX, startZ, tableSideX, tableSideZ, ev.businessId);

          waiterAg.segments = [
            {
              startMs: tStartClear,
              endMs: tStartClear + 13000,
              fromX: startX,
              fromZ: startZ,
              targetX: tableSideX,
              targetZ: tableSideZ,
              pathPoints: toTablePath,
              status: "CLEARING_TABLE",
              currentTask: `En route pour débarrasser ${tableLabel}`,
              carryingDish: null,
            },
            {
              startMs: tStartClear + 13000,
              endMs: ev.eventTimeMs,
              fromX: tableSideX,
              fromZ: tableSideZ,
              targetX: tableSideX,
              targetZ: tableSideZ,
              pathPoints: [
                { x: tableSideX, z: tableSideZ },
                { x: tableSideX, z: tableSideZ },
              ],
              isDwell: true,
              fixedHeadingRad: faceTableHeading,
              status: "CLEARING_TABLE",
              currentTask: `🧹 Débarrassage & nettoyage (${tableLabel})`,
              carryingDish: `Vaisselle sale (${tableLabel})`,
            },
          ];
          if (timeUntilCleared <= 15000) {
            waiterAg.speechBubble = "Je débarrasse et remets la table au propre.";
            waiterAg.speechAtMs = timestampMs;
          }
        }
      }
    }
  }

  // Evaluate deterministic Stock Units at `timestampMs` from their catalog consumptionHistory & contentionLog
  for (const u of Object.values(stockUnitsState)) {
    if (Array.isArray(u.consumptionHistory) && u.consumptionHistory.length > 0) {
      let rem = u.initialQty;
      let status = "ON_SHELF";
      let holderId = null;
      let holderName = null;
      let activeConsumer = null;
      const applied = [];

      for (const ch of u.consumptionHistory) {
        const tStart = ch.takenAtMs || ch.timestampMs || 0;
        const tReturn = ch.returnedAtMs || tStart + 75000;
        if (timestampMs >= tStart) {
          rem = ch.remainingAfter !== undefined ? Number(ch.remainingAfter) : Math.max(0, rem - Number(ch.qtyTaken || 0));
          applied.push(ch);
          if (timestampMs < tReturn) {
            status = u.unit === "ml" ? "IN_USE_BY_BARMAN" : "IN_USE_BY_COOK";
            holderId = ch.actorAgentId || ch.cookId;
            holderName = ch.actorName || ch.cookName;
            activeConsumer = ch;
          } else {
            status = rem <= 0 ? "DEPLETED" : "ON_SHELF";
          }
        }
      }
      u.remainingQty = rem;
      u.status = status;
      u.holderAgentId = holderId;
      u.holderName = holderName;
      u.activeConsumer = activeConsumer;
      u.appliedConsumption = applied;
    }

    if (Array.isArray(u.contentionLog) && u.contentionLog.length > 0) {
      const appliedCont = u.contentionLog.filter((c) => timestampMs >= (c.timestampMs || 0));
      u.appliedContentionLog = appliedCont;
      const liveCont = u.contentionLog.find(
        (c) => timestampMs >= (c.timestampMs || 0) && timestampMs <= (c.resolvedAtMs || (c.timestampMs || 0) + 90000)
      );
      if (liveCont) u.activeContention = liveCont;
    }

    u.fillRatio = u.initialQty > 0 ? Math.max(0, Math.min(1, u.remainingQty / u.initialQty)) : 0;
  }

  // Evaluate Dish Instances at `timestampMs` & attach to tables if currently served
  for (const d of Object.values(dishInstancesState)) {
    const stages = d.stages || [];
    let activeStage = stages[0] || { stage: "ORDERED", label: "Commandé" };
    for (const stg of stages) {
      if (timestampMs >= (stg.timestampMs || 0)) {
        activeStage = stg;
      }
    }
    d.currentStage = activeStage.stage;
    d.currentStageLabel = activeStage.label;
    d.currentStageDetail = activeStage.detail;
    d.currentActorAgentId = activeStage.actorAgentId || d.cookAgentId;
    d.currentActorName = activeStage.actorName || d.cookName;
    d.currentStationId = activeStage.stationId || d.stationId;
    d.completedStages = stages.filter((s) => timestampMs >= (s.timestampMs || 0));

    // Ensure table shows served catalog dishes if timestampMs is within active dining window
    const bs = businessStates[d.businessId];
    const tb = bs?.tables?.[d.tableId];
    const endWindowMs = d.clearedAtMs || (d.deliveredAtMs ? d.deliveredAtMs + 38 * 60000 : 0);
    const isDrinkCatalogItem =
      d.course === 0 ||
      String(d.stationId || "").includes("bar") ||
      /verre|bouteille|carafe|eau|café|espresso|calice|saké|sake|thé/i.test(d.dishName || "");
    if (
      tb &&
      !isDrinkCatalogItem &&
      tb.status !== "AVAILABLE" &&
      d.deliveredAtMs &&
      timestampMs >= d.deliveredAtMs &&
      timestampMs < endWindowMs &&
      (!tb.currentCourse || d.course === tb.currentCourse)
    ) {
      const maxPlates = Math.max(1, Number(tb.partySize) || 2);
      const alreadyListed = (tb.servedDishes || []).some(
        (sd) => sd.dishInstanceId === d.dishInstanceId
      );
      if (!alreadyListed && (tb.servedDishes || []).length < maxPlates) {
        tb.servedDishes = [
          ...(tb.servedDishes || []),
          {
            dishInstanceId: d.dishInstanceId,
            sceneObjectId: d.sceneObjectId,
            dishName: d.dishName,
            qty: 1,
            course: d.course || 1,
            seatNumber: (tb.servedDishes || []).length + 1,
            orderId: d.orderId,
            tableId: d.tableId,
            tableLabel: d.tableLabel || tb.label,
            visualAsset: inferDishVisualAsset({ name: d.dishName, visualAsset: d.visualAsset }, d.businessId, d.course),
            recipeSummary: d.recipeSummary,
            cookName: d.cookName,
            waiterName: d.waiterName,
            deliveredAtMs: d.deliveredAtMs,
            ingredientUnitsUsed: d.ingredientUnitsUsed || [],
          },
        ];
      }
    }
  }

  // Attach sorted shelfInventory to each storage / fridge / bar station
  // Dynamically mark the first non-depleted unit of each ingredient as `fifoOrder = 1` (NEXT TO USE)
  for (const bs of Object.values(businessStates)) {
    for (const st of Object.values(bs.stations)) {
      const rawStationUnits = Object.values(stockUnitsState).filter(
        (u) => u.businessId === bs.businessId && u.stationId === st.stationId
      );

      // Group by ingredient so we can surface the active/partially-used unit (#1) + immediate backup (#2) cleanly on the 3-tier × 6-slot rack
      const byIng = new Map();
      for (const u of rawStationUnits) {
        const k = u.ingredientId || u.ingredientName || u.unitId;
        if (!byIng.has(k)) byIng.set(k, []);
        byIng.get(k).push(u);
      }

      const curatedUnits = [];
      for (const group of byIng.values()) {
        // Sort non-depleted units first, with partially used (entamé) first, then original fifoOrder
        group.sort((a, b) => {
          const aDepleted = a.remainingQty <= 0 ? 1 : 0;
          const bDepleted = b.remainingQty <= 0 ? 1 : 0;
          if (aDepleted !== bDepleted) return aDepleted - bDepleted;
          const aEntame = a.remainingQty < a.initialQty && a.remainingQty > 0 ? 0 : 1;
          const bEntame = b.remainingQty < b.initialQty && b.remainingQty > 0 ? 0 : 1;
          if (aEntame !== bEntame) return aEntame - bEntame;
          return (a.fifoOrder || 1) - (b.fifoOrder || 1);
        });
        group.forEach((u, idx) => {
          u.fifoOrder = idx + 1;
        });
        // Keep up to 2 units per ingredient (the active FIFO #1 unit and the immediate backup FIFO #2 unit) so the 3D rack stays crisp and legible
        curatedUnits.push(...group.slice(0, 2));
      }

      curatedUnits.sort((a, b) => {
        if (a.shelfTier !== b.shelfTier) return a.shelfTier - b.shelfTier;
        if (a.shelfSlot !== b.shelfSlot) return a.shelfSlot - b.shelfSlot;
        return (a.fifoOrder || 1) - (b.fifoOrder || 1);
      });

      // Re-index slots cleanly across the 3 tiers (up to 18 visible 3D units per rack)
      const tierSlotCounts = { 1: 0, 2: 0, 3: 0 };
      const visibleShelfUnits = curatedUnits.slice(0, 18).map((u) => {
        const t = u.shelfTier >= 1 && u.shelfTier <= 3 ? u.shelfTier : 1;
        const s = tierSlotCounts[t] % 6;
        tierSlotCounts[t] += 1;
        return {
          ...u,
          shelfTier: t,
          shelfSlot: s,
          slotIndex: s,
        };
      });

      st.shelfInventory = visibleShelfUnits;
    }
  }

  // Compute interpolated (x, z, headingRad) along each agent's A* waypoint path at `timestampMs`
  const allAgents = [];
  for (const bs of Object.values(businessStates)) {
    for (const [aid, ag] of Object.entries(bs.activeAgents)) {
      if (ag.status === "DEPARTING" && ag.departedAtMs && timestampMs > ag.departedAtMs + (ag.departDurationMs || 38000)) {
        delete bs.activeAgents[aid];
        continue;
      }
      const sampled = evaluateAgentAt(ag, timestampMs);
      ag.x = sampled.x;
      ag.z = sampled.z;
      ag.headingRad = sampled.headingRad;
      ag.moveProgress = sampled.moveProgress;
      ag.isMoving = sampled.isMoving;
      if (sampled.pathPoints) ag.pathPoints = sampled.pathPoints;
      if (sampled.status) ag.status = sampled.status;
      if (sampled.currentTask) ag.currentTask = sampled.currentTask;
      if (sampled.carryingDish !== undefined) ag.carryingDish = sampled.carryingDish;
      allAgents.push(ag);
    }
  }

  // Add 4 deterministic ambient boulevard pedestrians strolling along the cobblestone street promenade
  const streetStrollers = [
    { id: "ped-promenade-1", name: "Promeneur Saint-Germain", partySize: 2, z: 18.4, speed: 0.0011, phase: 0.0, dir: 1 },
    { id: "ped-promenade-2", name: "Couple Passants", partySize: 2, z: 19.6, speed: 0.0009, phase: 0.35, dir: -1 },
    { id: "ped-promenade-3", name: "Flâneur Boulevard", partySize: 1, z: 20.4, speed: 0.0013, phase: 0.65, dir: 1 },
    { id: "ped-promenade-4", name: "Visiteurs Quartier", partySize: 2, z: 19.0, speed: 0.001, phase: 0.82, dir: -1 },
  ];
  for (const ped of streetStrollers) {
    const cycle = ((timestampMs * ped.speed * 0.001 + ped.phase) % 1 + 1) % 1;
    const x = ped.dir > 0 ? -4 + cycle * 70 : 66 - cycle * 70;
    allAgents.push({
      agentId: ped.id,
      name: ped.name,
      role: "Pedestrian",
      partySize: ped.partySize,
      agentKind: "customer",
      businessId: "street-london-001",
      status: "ARRIVING",
      currentTask: "Promenade sur le boulevard",
      x,
      z: ped.z,
      headingRad: ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2,
      isMoving: true,
      moveProgress: cycle,
      pathPoints: [
        { x: ped.dir > 0 ? -4 : 66, z: ped.z },
        { x: ped.dir > 0 ? 66 : -4, z: ped.z },
      ],
    });
  }

  return {
    timestampMs,
    eventsAppliedCount: appliedEvents.length,
    totalEventsInDay: events.length,
    businessStates,
    activeAgents: allAgents,
    stockUnitsState,
    dishInstancesState,
    activeDialogues: activeDialogues.slice(-30).reverse(),
    recentStreetEvents: appliedEvents.slice(-35).reverse(),
  };
}

export const useSimulationStore = create((set, get) => ({
  loading: true,
  error: null,
  bootstrap: null,
  dayBundle: null,
  serviceDate: "2025-06-14",
  timestampMs: Date.parse("2025-06-14T12:47:35+02:00"),
  dayStartMs: Date.parse("2025-06-14T07:00:00+02:00"),
  dayEndMs: Date.parse("2025-06-14T23:30:00+02:00"),
  isPlaying: false,
  playbackSpeed: 60, // positive = forward, negative = reverse playback
  viewMode: "3d", // "3d" | "2d" | "architecture"
  cameraPreset: "street_overview", // "street_overview" | "isometric" | "bistrot" | "osteria" | "sakana" | "kitchen" | "follow_agent"
  cutawayWalls: true,
  selectedSceneObjectId: "scene-bl-table-bl-t5",
  inspectorData: null,
  followedAgentId: null,
  eventFilterBusinessId: "ALL",
  projectedState: null,
  provenanceTrace: null, // { mode: "DISH_REVERSE" | "INGREDIENT_FORWARD" | "INGREDIENT_REVERSE", targetId, title, subtitle, stages, startTimeMs, endTimeMs }

  initPlatform: async () => {
    set({ loading: true, error: null });
    try {
      const [bootRes, bundleRes] = await Promise.all([
        fetch(`${API_BASE}/api/bootstrap`),
        fetch(`${API_BASE}/api/simulation/day-bundle?date=2025-06-14`),
      ]);
      const bootstrap = await bootRes.json();
      const dayBundle = await bundleRes.json();
      const initialTs = Date.parse("2025-06-14T12:47:35+02:00");
      const projectedState = projectStreetStateAt(bootstrap, dayBundle, initialTs);

      set({
        loading: false,
        bootstrap,
        dayBundle,
        serviceDate: "2025-06-14",
        timestampMs: initialTs,
        dayStartMs: Date.parse("2025-06-14T07:00:00+02:00"),
        dayEndMs: Date.parse("2025-06-14T23:30:00+02:00"),
        projectedState,
      });
      get().selectSceneObject("scene-bl-table-bl-t5");
    } catch (err) {
      set({ loading: false, error: err.message || "Failed to initialize platform" });
    }
  },

  setServiceDate: async (newDate) => {
    set({ loading: true, isPlaying: false, provenanceTrace: null });
    try {
      const res = await fetch(`${API_BASE}/api/simulation/day-bundle?date=${encodeURIComponent(newDate)}`);
      const dayBundle = await res.json();
      const newTs = Date.parse(`${newDate}T12:47:35+02:00`);
      const projectedState = projectStreetStateAt(get().bootstrap, dayBundle, newTs);
      set({
        loading: false,
        serviceDate: newDate,
        dayBundle,
        timestampMs: newTs,
        dayStartMs: Date.parse(`${newDate}T07:00:00+02:00`),
        dayEndMs: Date.parse(`${newDate}T23:30:00+02:00`),
        projectedState,
      });
      if (get().selectedSceneObjectId) {
        get().selectSceneObject(get().selectedSceneObjectId);
      }
    } catch (err) {
      set({ loading: false, error: err.message });
    }
  },

  setTimestampMs: (nextMs) => {
    const { dayStartMs, dayEndMs, bootstrap, dayBundle } = get();
    const clamped = Math.max(dayStartMs, Math.min(dayEndMs, nextMs));
    const projectedState = projectStreetStateAt(bootstrap, dayBundle, clamped);
    set({ timestampMs: clamped, projectedState });
  },

  tickSimulation: (deltaRealSeconds) => {
    const { isPlaying, playbackSpeed, timestampMs, dayStartMs, dayEndMs, bootstrap, dayBundle, provenanceTrace } = get();
    if (!isPlaying) return;
    let nextMs = timestampMs + deltaRealSeconds * playbackSpeed * 1000;

    // If an active provenance trace has a bounded window, pause cleanly when reaching the start/end of the trace
    if (provenanceTrace) {
      if (playbackSpeed < 0 && provenanceTrace.startTimeMs && nextMs <= provenanceTrace.startTimeMs) {
        nextMs = provenanceTrace.startTimeMs;
        const projectedState = projectStreetStateAt(bootstrap, dayBundle, nextMs);
        set({ timestampMs: nextMs, projectedState, isPlaying: false });
        return;
      }
      if (playbackSpeed > 0 && provenanceTrace.endTimeMs && nextMs >= provenanceTrace.endTimeMs) {
        nextMs = provenanceTrace.endTimeMs;
        const projectedState = projectStreetStateAt(bootstrap, dayBundle, nextMs);
        set({ timestampMs: nextMs, projectedState, isPlaying: false });
        return;
      }
    }

    if (nextMs >= dayEndMs) {
      nextMs = dayEndMs;
      set({ isPlaying: false });
    } else if (nextMs <= dayStartMs) {
      nextMs = dayStartMs;
      set({ isPlaying: false });
    }
    const projectedState = projectStreetStateAt(bootstrap, dayBundle, nextMs);

    // Dynamically follow the active stage's actor agent during provenance playback
    let nextFollowed = get().followedAgentId;
    if (provenanceTrace && Array.isArray(provenanceTrace.stages) && provenanceTrace.stages.length > 0) {
      let currentStage = provenanceTrace.stages[0];
      for (const stg of provenanceTrace.stages) {
        if (nextMs >= (stg.timestampMs || 0)) {
          currentStage = stg;
        }
      }
      if (currentStage?.actorAgentId) {
        nextFollowed = currentStage.actorAgentId;
      }
    }

    set({ timestampMs: nextMs, projectedState, followedAgentId: nextFollowed });
  },

  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed, isPlaying: true }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setCameraPreset: (preset) => set({ cameraPreset: preset }),
  toggleCutawayWalls: () => set((s) => ({ cutawayWalls: !s.cutawayWalls })),
  setEventFilterBusinessId: (bid) => set({ eventFilterBusinessId: bid }),

  startDishReverseTrace: (dishInstanceOrId) => {
    const { projectedState, bootstrap, dayBundle, timestampMs } = get();
    const dishMap = projectedState?.dishInstancesState || {};
    const dish =
      typeof dishInstanceOrId === "string"
        ? dishMap[dishInstanceOrId] || dishMap[dishInstanceOrId.replace(/^scene-dish-/, "")]
        : dishInstanceOrId;
    if (!dish) return;

    const stages = dish.stages || [];
    const deliveredMs = dish.deliveredAtMs || stages[stages.length - 1]?.timestampMs || timestampMs;
    const earliestMs = Math.max(
      get().dayStartMs,
      (dish.prepStartedAtMs || stages[1]?.timestampMs || deliveredMs - 15 * 60000) - 60000
    );
    const startJumpMs = Math.min(get().dayEndMs, deliveredMs);
    const nextProjected = projectStreetStateAt(bootstrap, dayBundle, startJumpMs);

    set({
      timestampMs: startJumpMs,
      projectedState: nextProjected,
      selectedSceneObjectId: dish.sceneObjectId || `scene-dish-${dish.dishInstanceId}`,
      playbackSpeed: -60,
      isPlaying: true,
      followedAgentId: dish.waiterAgentId || dish.cookAgentId || null,
      cameraPreset: dish.waiterAgentId || dish.cookAgentId ? "follow_agent" : get().cameraPreset,
      provenanceTrace: {
        mode: "DISH_REVERSE",
        targetId: dish.dishInstanceId,
        sceneObjectId: dish.sceneObjectId || `scene-dish-${dish.dishInstanceId}`,
        title: `⏪ Rembobinage Provenance : ${dish.dishName}`,
        subtitle: `Table (${dish.tableLabel || dish.tableId}) → Serveur (${dish.waiterName || "Salle"}) → Passe → Cuisine (${dish.cookName || "Chef"}) → Étagère Stock`,
        stages,
        ingredientUnitsUsed: dish.ingredientUnitsUsed || [],
        startTimeMs: earliestMs,
        endTimeMs: deliveredMs + 30000,
      },
    });
  },

  startIngredientForwardTrace: (unitOrId) => {
    const { projectedState, bootstrap, dayBundle, timestampMs } = get();
    const unitMap = projectedState?.stockUnitsState || {};
    const unit =
      typeof unitOrId === "string"
        ? unitMap[unitOrId] || unitMap[unitOrId.replace(/^scene-unit-/, "")]
        : unitOrId;
    if (!unit) return;

    const history = unit.consumptionHistory || unit.appliedConsumption || [];
    const firstUseMs = history[0]?.takenAtMs || history[0]?.timestampMs || timestampMs - 10 * 60000;
    const lastUseMs =
      (history[history.length - 1]?.returnedAtMs || history[history.length - 1]?.timestampMs || firstUseMs) + 12 * 60000;
    const jumpMs = Math.max(get().dayStartMs, firstUseMs - 30000);
    const nextProjected = projectStreetStateAt(bootstrap, dayBundle, jumpMs);

    const stages = [
      {
        stage: "ON_SHELF_INITIAL",
        label: `Stock Initial Étagère Niveau ${unit.shelfTier} Slot #${(unit.shelfSlot ?? 0) + 1} (${unit.initialQty}${unit.unit})`,
        timestampMs: jumpMs,
        stationId: unit.stationId,
        detail: `${unit.unitLabel} — Priorité FIFO #${unit.fifoOrder || 1}`,
      },
      ...history.map((h, idx) => ({
        stage: `CONSUMPTION_${idx + 1}`,
        label: `${h.actorName || h.cookName} prélève ${h.qtyTaken}${unit.unit} (${h.remainingBefore}${unit.unit} → ${h.remainingAfter}${unit.unit})`,
        timestampMs: h.takenAtMs || h.timestampMs,
        actorAgentId: h.actorAgentId || h.cookId,
        actorName: h.actorName || h.cookName,
        stationId: h.stationId || unit.stationId,
        detail: `Pour ${h.dishName || "Plat"} (${h.tableLabel || h.tableId || "Service"})`,
      })),
    ];

    set({
      timestampMs: jumpMs,
      projectedState: nextProjected,
      selectedSceneObjectId: unit.sceneObjectId || `scene-unit-${unit.unitId}`,
      playbackSpeed: 60,
      isPlaying: true,
      followedAgentId: history[0]?.actorAgentId || history[0]?.cookId || null,
      provenanceTrace: {
        mode: "INGREDIENT_FORWARD",
        targetId: unit.unitId,
        sceneObjectId: unit.sceneObjectId || `scene-unit-${unit.unitId}`,
        title: `⏩ Traçabilité Directe : ${unit.unitLabel}`,
        subtitle: `Étagère Niveau ${unit.shelfTier} (${unit.initialQty}${unit.unit}) → Prélèvements Cuisiniers / Barman → Assiettes Servies`,
        stages,
        startTimeMs: jumpMs,
        endTimeMs: Math.min(get().dayEndMs, lastUseMs),
      },
    });
  },

  startIngredientReverseTrace: (unitOrId) => {
    const { projectedState, bootstrap, dayBundle, timestampMs } = get();
    const unitMap = projectedState?.stockUnitsState || {};
    const unit =
      typeof unitOrId === "string"
        ? unitMap[unitOrId] || unitMap[unitOrId.replace(/^scene-unit-/, "")]
        : unitOrId;
    if (!unit) return;

    const history = unit.consumptionHistory || unit.appliedConsumption || [];
    const firstUseMs = history[0]?.takenAtMs || history[0]?.timestampMs || timestampMs - 15 * 60000;
    const lastUseMs =
      (history[history.length - 1]?.returnedAtMs || history[history.length - 1]?.timestampMs || timestampMs) + 60000;
    const jumpMs = Math.min(get().dayEndMs, Math.max(timestampMs, lastUseMs));
    const nextProjected = projectStreetStateAt(bootstrap, dayBundle, jumpMs);

    const stages = [
      {
        stage: "ON_SHELF_INITIAL",
        label: `État Intact sur Étagère Niveau ${unit.shelfTier} (${unit.initialQty}${unit.unit})`,
        timestampMs: Math.max(get().dayStartMs, firstUseMs - 45000),
        stationId: unit.stationId,
        detail: `${unit.unitLabel} avant premier prélèvement`,
      },
      ...history.map((h, idx) => ({
        stage: `CONSUMPTION_${idx + 1}`,
        label: `${h.actorName || h.cookName} : -${h.qtyTaken}${unit.unit} (${h.remainingBefore}${unit.unit} → ${h.remainingAfter}${unit.unit})`,
        timestampMs: h.takenAtMs || h.timestampMs,
        actorAgentId: h.actorAgentId || h.cookId,
        actorName: h.actorName || h.cookName,
        stationId: h.stationId || unit.stationId,
        detail: `Utilisé dans ${h.dishName} (${h.tableLabel || "Salle"})`,
      })),
    ];

    set({
      timestampMs: jumpMs,
      projectedState: nextProjected,
      selectedSceneObjectId: unit.sceneObjectId || `scene-unit-${unit.unitId}`,
      playbackSpeed: -60,
      isPlaying: true,
      followedAgentId: history[history.length - 1]?.actorAgentId || null,
      provenanceTrace: {
        mode: "INGREDIENT_REVERSE",
        targetId: unit.unitId,
        sceneObjectId: unit.sceneObjectId || `scene-unit-${unit.unitId}`,
        title: `⏪ Rembobinage Unité Stock : ${unit.unitLabel}`,
        subtitle: `État actuel (${unit.remainingQty}${unit.unit}) ⏪ Retours Étagère ⏪ Prélèvements ⏪ Stock Intact (${unit.initialQty}${unit.unit})`,
        stages,
        startTimeMs: Math.max(get().dayStartMs, firstUseMs - 45000),
        endTimeMs: jumpMs,
      },
    });
  },

  stopProvenanceTrace: () => {
    set({ provenanceTrace: null, isPlaying: false, playbackSpeed: 60 });
  },

  jumpToRelativeEvent: (direction = 1) => {
    const { dayBundle, timestampMs, eventFilterBusinessId } = get();
    if (!dayBundle?.events?.length) return;
    const evts =
      eventFilterBusinessId === "ALL"
        ? dayBundle.events
        : dayBundle.events.filter((e) => e.businessId === eventFilterBusinessId);
    if (direction > 0) {
      const next = evts.find((e) => e.eventTimeMs > timestampMs + 500);
      if (next) get().setTimestampMs(next.eventTimeMs);
    } else {
      const prevs = evts.filter((e) => e.eventTimeMs < timestampMs - 500);
      if (prevs.length > 0) get().setTimestampMs(prevs[prevs.length - 1].eventTimeMs);
    }
  },

  selectSceneObject: async (sceneObjectId, followIfAgent = false) => {
    set({ selectedSceneObjectId: sceneObjectId });
    if (!sceneObjectId) {
      set({ inspectorData: null });
      return;
    }
    if (followIfAgent && sceneObjectId.includes("agent-")) {
      set({ followedAgentId: sceneObjectId.replace(/^scene-/, ""), cameraPreset: "follow_agent" });
    }
    // Check if selecting a virtual dish instance or physical stock unit first
    const ps = get().projectedState;
    if (sceneObjectId.startsWith("scene-dish-") || sceneObjectId.startsWith("dish-")) {
      const did = sceneObjectId.replace(/^scene-dish-/, "");
      const dishObj = ps?.dishInstancesState?.[did];
      if (dishObj) {
        set({
          inspectorData: {
            objectType: "plated_dish",
            sceneObjectId: dishObj.sceneObjectId || `scene-dish-${did}`,
            dishInstanceId: did,
            label: dishObj.dishName,
            businessId: dishObj.businessId,
            dishInstance: dishObj,
          },
        });
        return;
      }
    } else if (sceneObjectId.startsWith("scene-unit-") || sceneObjectId.startsWith("unit-")) {
      const uid = sceneObjectId.replace(/^scene-unit-/, "");
      const unitObj = ps?.stockUnitsState?.[uid];
      if (unitObj) {
        set({
          inspectorData: {
            objectType: "stock_unit",
            sceneObjectId: unitObj.sceneObjectId || `scene-unit-${uid}`,
            unitId: uid,
            label: unitObj.unitLabel,
            businessId: unitObj.businessId,
            stockUnit: unitObj,
          },
        });
        return;
      }
    }
    try {
      const { serviceDate, timestampMs } = get();
      const res = await fetch(
        `${API_BASE}/api/inspect/${encodeURIComponent(sceneObjectId)}?date=${encodeURIComponent(serviceDate)}&timestampMs=${Math.round(timestampMs)}`
      );
      if (res.ok) {
        const data = await res.json();
        set({ inspectorData: data });
      }
    } catch {
      // Fallback handled by live projectedState in Inspector
    }
  },
}));
