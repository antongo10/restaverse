#!/usr/bin/env python3
"""
30-Day Full Operational & Physical Lineage Seed Generator for:
Osteria Bellavista (business-osteria-bellavista / premises-osteria-bellavista)
Dates: 2026-10-01 through 2026-10-31 (Europe/Paris local time, DST-aware)

Enforces:
1. Recipe -> Ingredient Grammage -> Discrete Physical StockUnit FIFO depletion
2. Multi-cook contention on 150g Cucumber / Cetriolo & 250g Mozzarella di Bufala
3. Single-bottle Barman constraint for Alessandro Greco (never > 1 bottle held/poured)
4. Strict Causal Dining Lifecycle: guests NEVER leave before all dishes are
   cooked, plated, picked up at pass, delivered to table, and eaten for 16-24 min.
"""

from __future__ import annotations

import datetime as dt
from zoneinfo import ZoneInfo
import random
from typing import Any, Dict, List, Optional, Tuple

try:
    from scripts.seeds.dialogue_simulator import build_event_dialogue  # type: ignore
except Exception:
    try:
        from seeds.dialogue_simulator import build_event_dialogue  # type: ignore
    except Exception:
        build_event_dialogue = None


BUSINESS_ID = "business-osteria-bellavista"
PREMISES_ID = "premises-osteria-bellavista"
PARIS_TZ = ZoneInfo("Europe/Paris")
FOCUS_DATE = "2026-10-24"

STATION_COORDS: Dict[str, Dict[str, Any]] = {
    "storage-ob-cold": {
        "sceneObjectId": "scene-ob-storage-cold",
        "label": "Cella Frigorifera & Dispensa",
        "x": 25.2,
        "z": -4.5,
    },
    "station-ob-plonge": {
        "sceneObjectId": "scene-ob-station-plonge",
        "label": "Lavaggio & Plonge",
        "x": 27.4,
        "z": -4.6,
    },
    "station-ob-antipasti": {
        "sceneObjectId": "scene-ob-station-antipasti",
        "label": "Banco Antipasti & Insalate",
        "x": 30.2,
        "z": -2.8,
    },
    "station-ob-pasta": {
        "sceneObjectId": "scene-ob-station-pasta",
        "label": "Bollitore Pasta Fresca",
        "x": 34.2,
        "z": -4.6,
    },
    "station-ob-grill": {
        "sceneObjectId": "scene-ob-station-grill",
        "label": "Griglia & Forno a Legna",
        "x": 38.4,
        "z": -4.5,
    },
    "station-ob-passe": {
        "sceneObjectId": "scene-ob-station-passe",
        "label": "Pass Cucina Riscaldato",
        "x": 38.4,
        "z": 0.0,
    },
    "station-ob-bar": {
        "sceneObjectId": "scene-ob-station-bar",
        "label": "Bancone Bar & Enoteca",
        "x": 39.0,
        "z": 10.8,
    },
    "pos-ob-main": {
        "sceneObjectId": "scene-ob-pos-main",
        "label": "Cassa Principale POS",
        "x": 36.8,
        "z": 10.5,
    },
    "door-ob-main": {
        "sceneObjectId": "scene-ob-door-main",
        "label": "Ingresso Osteria Bellavista",
        "x": 32.0,
        "z": 14.0,
    },
}

TABLES_CONFIG: List[Dict[str, Any]] = [
    {"tableId": "ob-t1", "name": "Tavolo 1", "zone": "SALA", "capacity": 2, "x": 25.6, "z": 3.2},
    {"tableId": "ob-t2", "name": "Tavolo 2", "zone": "SALA", "capacity": 2, "x": 29.2, "z": 3.2},
    {"tableId": "ob-t3", "name": "Tavolo 3", "zone": "SALA", "capacity": 4, "x": 33.0, "z": 3.2},
    {"tableId": "ob-t4", "name": "Tavolo 4", "zone": "SALA", "capacity": 2, "x": 25.6, "z": 7.0},
    {"tableId": "ob-t5", "name": "Tavolo 5", "zone": "SALA", "capacity": 4, "x": 29.5, "z": 7.0},
    {"tableId": "ob-t6", "name": "Tavolo 6", "zone": "SALA", "capacity": 4, "x": 33.8, "z": 7.0},
    {"tableId": "ob-t7", "name": "Tavolo 7", "zone": "SALA", "capacity": 6, "x": 29.5, "z": 10.6},
    {"tableId": "ob-tr1", "name": "Terrazza 1", "zone": "TERRAZZA", "capacity": 2, "x": 25.8, "z": 16.2},
    {"tableId": "ob-tr2", "name": "Terrazza 2", "zone": "TERRAZZA", "capacity": 2, "x": 30.2, "z": 16.2},
    {"tableId": "ob-tr3", "name": "Terrazza 3", "zone": "TERRAZZA", "capacity": 4, "x": 35.0, "z": 16.2},
]

STAFF_ROSTER: List[Dict[str, Any]] = [
    {
        "employeeId": "emp-ob-marco",
        "agentId": "agent-emp-ob-marco",
        "name": "Marco Bellini",
        "role": "Direttore di Sala",
        "category": "MANAGER",
        "stationId": "pos-ob-main",
        "hourlyRate": 24.00,
    },
    {
        "employeeId": "emp-ob-giulia",
        "agentId": "agent-emp-ob-giulia",
        "name": "Giulia Conti",
        "role": "Chef di Cucina (Primi & Pasta)",
        "category": "KITCHEN",
        "stationId": "station-ob-pasta",
        "hourlyRate": 25.50,
    },
    {
        "employeeId": "emp-ob-matteo",
        "agentId": "agent-emp-ob-matteo",
        "name": "Matteo Lombardi",
        "role": "Sous-Chef (Antipasti & Griglia)",
        "category": "KITCHEN",
        "stationId": "station-ob-antipasti",
        "hourlyRate": 20.00,
    },
    {
        "employeeId": "emp-ob-lorenzo",
        "agentId": "agent-emp-ob-lorenzo",
        "name": "Lorenzo Moretti",
        "role": "Addetto Plonge",
        "category": "KITCHEN",
        "stationId": "station-ob-plonge",
        "hourlyRate": 14.80,
    },
    {
        "employeeId": "emp-ob-chiara",
        "agentId": "agent-emp-ob-chiara",
        "name": "Chiara Bianchi",
        "role": "Capo Cameriere",
        "category": "FLOOR",
        "stationId": "station-ob-passe",
        "hourlyRate": 17.00,
    },
    {
        "employeeId": "emp-ob-alessandro",
        "agentId": "agent-emp-ob-alessandro",
        "name": "Alessandro Greco",
        "role": "Barman & Sommelier",
        "category": "BAR",
        "stationId": "station-ob-bar",
        "hourlyRate": 18.00,
    },
]

INGREDIENTS_CATALOG: Dict[str, Dict[str, Any]] = {
    "ing-ob-concombre": {
        "ingredientId": "ing-ob-concombre",
        "name": "Cetriolo Croccante Bio (150g)",
        "unit": "g",
        "packageSize": 150,
        "containerType": "whole_cucumber_150g",
        "storageObjectId": "storage-ob-cold",
        "sceneObjectId": "scene-ob-storage-cold",
        "shelfSlot": "Scaffale 2 - Ortaggi Freschi",
        "dailyUnits": 12,
        "unitCost": 0.85,
        "supplierId": "sup-mercato-milano",
    },
    "ing-ob-mozzarella": {
        "ingredientId": "ing-ob-mozzarella",
        "name": "Mozzarella di Bufala Campana DOP (250g)",
        "unit": "g",
        "packageSize": 250,
        "containerType": "tub_250g",
        "storageObjectId": "storage-ob-cold",
        "sceneObjectId": "scene-ob-storage-cold",
        "shelfSlot": "Scaffale 1 - Latticini DOP",
        "dailyUnits": 10,
        "unitCost": 3.60,
        "supplierId": "sup-caseificio-campano",
    },
    "ing-ob-pomodoro": {
        "ingredientId": "ing-ob-pomodoro",
        "name": "Pomodoro Cuore di Bue & San Marzano",
        "unit": "g",
        "packageSize": 1000,
        "containerType": "crate_1000g",
        "storageObjectId": "storage-ob-cold",
        "sceneObjectId": "scene-ob-storage-cold",
        "shelfSlot": "Scaffale 2 - Pomodori",
        "dailyUnits": 6,
        "unitCost": 4.20,
        "supplierId": "sup-mercato-milano",
    },
    "ing-ob-pasta-fresca": {
        "ingredientId": "ing-ob-pasta-fresca",
        "name": "Tagliolini & Tonnarelli all'Uovo Freschi",
        "unit": "g",
        "packageSize": 1500,
        "containerType": "tray_1500g",
        "storageObjectId": "storage-ob-cold",
        "sceneObjectId": "scene-ob-storage-cold",
        "shelfSlot": "Scaffale 3 - Pasta Fresca",
        "dailyUnits": 5,
        "unitCost": 11.50,
        "supplierId": "sup-pastificio-artigiano",
    },
    "ing-ob-guanciale": {
        "ingredientId": "ing-ob-guanciale",
        "name": "Guanciale di Amatrice Stagionato",
        "unit": "g",
        "packageSize": 1000,
        "containerType": "slab_1000g",
        "storageObjectId": "storage-ob-cold",
        "sceneObjectId": "scene-ob-storage-cold",
        "shelfSlot": "Scaffale 3 - Salumi",
        "dailyUnits": 4,
        "unitCost": 19.00,
        "supplierId": "sup-salumificio-umbro",
    },
    "ing-ob-pecorino": {
        "ingredientId": "ing-ob-pecorino",
        "name": "Pecorino Romano DOP",
        "unit": "g",
        "packageSize": 1000,
        "containerType": "wedge_1000g",
        "storageObjectId": "storage-ob-cold",
        "sceneObjectId": "scene-ob-storage-cold",
        "shelfSlot": "Scaffale 1 - Formaggi",
        "dailyUnits": 3,
        "unitCost": 18.00,
        "supplierId": "sup-caseificio-campano",
    },
    "ing-ob-vitello": {
        "ingredientId": "ing-ob-vitello",
        "name": "Tagliata di Manzo & Ossobuco Piemontese",
        "unit": "g",
        "packageSize": 1800,
        "containerType": "vacuum_1800g",
        "storageObjectId": "storage-ob-cold",
        "sceneObjectId": "scene-ob-storage-cold",
        "shelfSlot": "Scaffale 4 - Carni Frollate",
        "dailyUnits": 4,
        "unitCost": 39.00,
        "supplierId": "sup-macelleria-piemonte",
    },
    "ing-ob-mascarpone": {
        "ingredientId": "ing-ob-mascarpone",
        "name": "Mascarpone Fresco & Savoiardi Artigianali",
        "unit": "g",
        "packageSize": 1000,
        "containerType": "tub_1000g",
        "storageObjectId": "storage-ob-cold",
        "sceneObjectId": "scene-ob-storage-cold",
        "shelfSlot": "Scaffale 1 - Dolci",
        "dailyUnits": 4,
        "unitCost": 9.80,
        "supplierId": "sup-caseificio-campano",
    },
    "ing-ob-chianti": {
        "ingredientId": "ing-ob-chianti",
        "name": "Bottiglia Chianti Classico Riserva DOCG 75cl",
        "unit": "ml",
        "packageSize": 750,
        "containerType": "bottle_750ml",
        "storageObjectId": "station-ob-bar",
        "sceneObjectId": "scene-ob-station-bar",
        "shelfSlot": "Cantinetta Rossa - Scaffale A",
        "dailyUnits": 8,
        "unitCost": 12.50,
        "supplierId": "sup-enoteca-toscana",
    },
    "ing-ob-prosecco": {
        "ingredientId": "ing-ob-prosecco",
        "name": "Bottiglia Prosecco Valdobbiadene DOCG 75cl",
        "unit": "ml",
        "packageSize": 750,
        "containerType": "bottle_750ml",
        "storageObjectId": "station-ob-bar",
        "sceneObjectId": "scene-ob-station-bar",
        "shelfSlot": "Vetrina Bollicine - Scaffale B",
        "dailyUnits": 7,
        "unitCost": 10.50,
        "supplierId": "sup-enoteca-toscana",
    },
    "ing-ob-acqua": {
        "ingredientId": "ing-ob-acqua",
        "name": "Acqua Minerale San Pellegrino 100cl",
        "unit": "ml",
        "packageSize": 1000,
        "containerType": "bottle_1000ml",
        "storageObjectId": "station-ob-bar",
        "sceneObjectId": "scene-ob-station-bar",
        "shelfSlot": "Banco Frigo Bar",
        "dailyUnits": 10,
        "unitCost": 1.30,
        "supplierId": "sup-enoteca-toscana",
    },
}

MENU_RECIPES: List[Dict[str, Any]] = [
    {
        "itemId": "item-ob-caprese-panzanella",
        "name": "Caprese di Bufala DOP & Panzanella al Cetriolo",
        "category": "Antipasti",
        "price": 13.50,
        "cost": 3.40,
        "stationId": "station-ob-antipasti",
        "cookDurationSec": 195,
        "isBeverage": False,
        "recipe": [
            {"ingredientId": "ing-ob-mozzarella", "quantity": 80, "unit": "g"},
            {"ingredientId": "ing-ob-concombre", "quantity": 30, "unit": "g"},
            {"ingredientId": "ing-ob-pomodoro", "quantity": 90, "unit": "g"},
        ],
    },
    {
        "itemId": "item-ob-carpaccio-estivo",
        "name": "Carpaccio di Manzo, Cetriolo Croccante & Pecorino",
        "category": "Antipasti",
        "price": 15.00,
        "cost": 4.10,
        "stationId": "station-ob-antipasti",
        "cookDurationSec": 210,
        "isBeverage": False,
        "recipe": [
            {"ingredientId": "ing-ob-vitello", "quantity": 90, "unit": "g"},
            {"ingredientId": "ing-ob-concombre", "quantity": 30, "unit": "g"},
            {"ingredientId": "ing-ob-pecorino", "quantity": 25, "unit": "g"},
        ],
    },
    {
        "itemId": "item-ob-tonnarelli-carbonara",
        "name": "Tonnarelli Freschi alla Carbonara Tradizionale",
        "category": "Primi",
        "price": 18.50,
        "cost": 4.60,
        "stationId": "station-ob-pasta",
        "cookDurationSec": 290,
        "isBeverage": False,
        "recipe": [
            {"ingredientId": "ing-ob-pasta-fresca", "quantity": 150, "unit": "g"},
            {"ingredientId": "ing-ob-guanciale", "quantity": 65, "unit": "g"},
            {"ingredientId": "ing-ob-pecorino", "quantity": 40, "unit": "g"},
            {"ingredientId": "ing-ob-concombre", "quantity": 30, "unit": "g"},
        ],
    },
    {
        "itemId": "item-ob-paccheri-bufala",
        "name": "Paccheri al San Marzano, Bufala & Basilico",
        "category": "Primi",
        "price": 17.50,
        "cost": 4.20,
        "stationId": "station-ob-pasta",
        "cookDurationSec": 280,
        "isBeverage": False,
        "recipe": [
            {"ingredientId": "ing-ob-pasta-fresca", "quantity": 150, "unit": "g"},
            {"ingredientId": "ing-ob-pomodoro", "quantity": 120, "unit": "g"},
            {"ingredientId": "ing-ob-mozzarella", "quantity": 75, "unit": "g"},
        ],
    },
    {
        "itemId": "item-ob-tagliata-griglia",
        "name": "Tagliata di Manzo alla Griglia, Rucola & Cetriolo",
        "category": "Secondi",
        "price": 26.00,
        "cost": 8.40,
        "stationId": "station-ob-grill",
        "cookDurationSec": 350,
        "isBeverage": False,
        "recipe": [
            {"ingredientId": "ing-ob-vitello", "quantity": 210, "unit": "g"},
            {"ingredientId": "ing-ob-concombre", "quantity": 30, "unit": "g"},
            {"ingredientId": "ing-ob-pecorino", "quantity": 30, "unit": "g"},
        ],
    },
    {
        "itemId": "item-ob-tiramisu",
        "name": "Tiramisù Artigianale della Casa",
        "category": "Dolci",
        "price": 9.50,
        "cost": 2.20,
        "stationId": "station-ob-antipasti",
        "cookDurationSec": 170,
        "isBeverage": False,
        "recipe": [
            {"ingredientId": "ing-ob-mascarpone", "quantity": 110, "unit": "g"},
        ],
    },
    {
        "itemId": "item-ob-calice-chianti",
        "name": "Calice di Chianti Classico DOCG (15cl)",
        "category": "Vini",
        "price": 8.50,
        "cost": 2.30,
        "stationId": "station-ob-bar",
        "cookDurationSec": 40,
        "isBeverage": True,
        "recipe": [
            {"ingredientId": "ing-ob-chianti", "quantity": 150, "unit": "ml"},
        ],
    },
    {
        "itemId": "item-ob-calice-prosecco",
        "name": "Calice di Prosecco Superiore DOCG (15cl)",
        "category": "Vini",
        "price": 8.00,
        "cost": 2.00,
        "stationId": "station-ob-bar",
        "cookDurationSec": 40,
        "isBeverage": True,
        "recipe": [
            {"ingredientId": "ing-ob-prosecco", "quantity": 150, "unit": "ml"},
        ],
    },
    {
        "itemId": "item-ob-acqua-sp",
        "name": "Acqua San Pellegrino (50cl)",
        "category": "Bevande",
        "price": 5.00,
        "cost": 0.90,
        "stationId": "station-ob-bar",
        "cookDurationSec": 30,
        "isBeverage": True,
        "recipe": [
            {"ingredientId": "ing-ob-acqua", "quantity": 500, "unit": "ml"},
        ],
    },
]

RECIPES_BY_ID = {r["itemId"]: r for r in MENU_RECIPES}

GUEST_NAMES = [
    ("Elena", "Rossi"), ("Matteo", "Ferrari"), ("Sofia", "Bianchi"), ("Leonardo", "Romano"),
    ("Giulia", "Colombo"), ("Alessandro", "Ricci"), ("Chiara", "Marino"), ("Lorenzo", "Greco"),
    ("Clémence", "Moreau"), ("Bastien", "Lefèvre"), ("Aurélie", "Garnier"), ("Damien", "Faure"),
]


def _iso(ts_dt: dt.datetime) -> str:
    return ts_dt.astimezone(PARIS_TZ).isoformat(timespec="seconds")


def _make_dt(date_str: str, hour: int, minute: int, second: int = 0) -> dt.datetime:
    y, m, d = [int(p) for p in date_str.split("-")]
    return dt.datetime(y, m, d, hour, minute, second, tzinfo=PARIS_TZ)


def generate_osteria_bellavista_month(
    start_date: str = "2026-10-01",
    days: int = 31,
) -> Dict[str, Any]:
    """Generates full month dataset for Osteria Bellavista."""
    rng = random.Random(2025061402)

    all_events: List[Dict[str, Any]] = []
    all_orders: List[Dict[str, Any]] = []
    all_shifts: List[Dict[str, Any]] = []
    all_stock_units: List[Dict[str, Any]] = []
    all_dish_instances: List[Dict[str, Any]] = []
    all_contention_logs: List[Dict[str, Any]] = []
    all_inventory_lots: List[Dict[str, Any]] = []
    all_inventory_movements: List[Dict[str, Any]] = []
    all_accounting_entries: List[Dict[str, Any]] = []
    all_reviews: List[Dict[str, Any]] = []
    daily_kpis: List[Dict[str, Any]] = []

    cook_by_station = {
        "station-ob-pasta": STAFF_ROSTER[1],      # Giulia Conti
        "station-ob-antipasti": STAFF_ROSTER[2],  # Matteo Lombardi
        "station-ob-grill": STAFF_ROSTER[2],      # Matteo Lombardi
    }
    floor_waiters = [STAFF_ROSTER[4], STAFF_ROSTER[0]]  # Chiara Bianchi & Marco Bellini
    barman = STAFF_ROSTER[5]   # Alessandro Greco
    plongeur = STAFF_ROSTER[3] # Lorenzo Moretti

    start_dt = dt.date.fromisoformat(start_date)

    for day_idx in range(days):
        cur_date = start_dt + dt.timedelta(days=day_idx)
        date_str = cur_date.isoformat()
        is_weekend = cur_date.weekday() >= 4
        is_focus_day = (date_str == FOCUS_DATE)

        day_units_by_ing: Dict[str, List[Dict[str, Any]]] = {}
        morning_delivery_dt = _make_dt(date_str, 8, 45, 0)

        for ing_id, spec in INGREDIENTS_CATALOG.items():
            units_list: List[Dict[str, Any]] = []
            count = spec["dailyUnits"] + (3 if is_weekend else 0)
            for u_idx in range(1, count + 1):
                unit_id = f"unit-ob-{ing_id.replace('ing-ob-', '')}-{date_str.replace('-', '')}-{u_idx:02d}"
                unit_doc = {
                    "unitId": unit_id,
                    "businessId": BUSINESS_ID,
                    "premisesId": PREMISES_ID,
                    "serviceDate": date_str,
                    "ingredientId": ing_id,
                    "ingredientName": spec["name"],
                    "containerType": spec["containerType"],
                    "storageObjectId": spec["storageObjectId"],
                    "sceneObjectId": spec["sceneObjectId"],
                    "shelfSlot": spec["shelfSlot"],
                    "initialQuantity": spec["packageSize"],
                    "remainingQuantity": spec["packageSize"],
                    "unit": spec["unit"],
                    "unitCost": spec["unitCost"],
                    "status": "AVAILABLE",
                    "openedAt": None,
                    "exhaustedAt": None,
                    "createdAt": _iso(morning_delivery_dt),
                    "depletionHistory": [],
                }
                units_list.append(unit_doc)
                all_stock_units.append(unit_doc)
            day_units_by_ing[ing_id] = units_list

            all_inventory_lots.append({
                "lotId": f"lot-ob-{ing_id.replace('ing-ob-', '')}-{date_str.replace('-', '')}",
                "businessId": BUSINESS_ID,
                "premisesId": PREMISES_ID,
                "serviceDate": date_str,
                "ingredientId": ing_id,
                "ingredientName": spec["name"],
                "storageObjectId": spec["storageObjectId"],
                "initialQuantity": spec["packageSize"] * count,
                "remainingQuantity": spec["packageSize"] * count,
                "unit": spec["unit"],
                "unitCount": count,
                "packageSize": spec["packageSize"],
                "receivedAt": _iso(morning_delivery_dt),
                "expiryDate": (cur_date + dt.timedelta(days=4)).isoformat(),
            })

        storage_access_history: List[Dict[str, Any]] = []

        def deduct_ingredient_fifo(
            ing_id: str,
            qty_needed: float,
            actor: Dict[str, Any],
            order_id: str,
            dish_id: str,
            dish_name: str,
            table_name: str,
            access_dt: dt.datetime,
        ) -> Tuple[List[Dict[str, Any]], Optional[Dict[str, Any]]]:
            units = day_units_by_ing[ing_id]
            rem_to_take = qty_needed
            consumed_slices: List[Dict[str, Any]] = []
            contention_record: Optional[Dict[str, Any]] = None
            spec = INGREDIENTS_CATALOG[ing_id]
            storage_id = spec["storageObjectId"]

            matched_prev = None
            for prev in reversed(storage_access_history):
                if (
                    prev["actorId"] != actor["agentId"]
                    and prev["ingredientId"] == ing_id
                    and prev["afterQty"] > 0
                    and abs((access_dt - prev["dt"]).total_seconds()) <= 360
                ):
                    matched_prev = prev
                    break
            if matched_prev is None:
                for prev in reversed(storage_access_history):
                    delta_s = abs((access_dt - prev["dt"]).total_seconds())
                    if delta_s > 45:
                        break
                    if prev["actorId"] != actor["agentId"] and prev["storageObjectId"] == storage_id:
                        matched_prev = prev
                        break

            if matched_prev is not None:
                delta_s = abs((access_dt - matched_prev["dt"]).total_seconds())
                contention_record = {
                    "contentionId": f"cont-ob-{date_str.replace('-', '')}-{len(all_contention_logs) + 1:04d}",
                    "businessId": BUSINESS_ID,
                    "premisesId": PREMISES_ID,
                    "serviceDate": date_str,
                    "timestamp": _iso(access_dt),
                    "storageObjectId": storage_id,
                    "sceneObjectId": spec["sceneObjectId"],
                    "ingredientId": ing_id,
                    "ingredientName": spec["name"],
                    "primaryActorId": matched_prev["actorId"],
                    "primaryActorName": matched_prev["actorName"],
                    "primaryBeforeQuantity": matched_prev["beforeQty"],
                    "primaryDeducted": round(matched_prev["beforeQty"] - matched_prev["afterQty"], 2),
                    "primaryAfterQuantity": matched_prev["afterQty"],
                    "waitingActorId": actor["agentId"],
                    "waitingActorName": actor["name"],
                    "waitingBeforeQuantity": matched_prev["afterQty"],
                    "waitingDeducted": qty_needed,
                    "waitingAfterQuantity": max(0, round(matched_prev["afterQty"] - qty_needed, 2)),
                    "unitId": matched_prev["unitId"],
                    "waitDurationSeconds": round(max(4.0, 16.0 - min(delta_s, 30.0) * 0.25), 1),
                    "resolution": "SHARED_PARTIAL_UNIT_FIFO",
                    "beforeQuantity": matched_prev["afterQty"],
                    "deductedQuantity": qty_needed,
                    "afterQuantity": max(0, round(matched_prev["afterQty"] - qty_needed, 2)),
                    "unit": spec["unit"],
                    "summary": (
                        f"{actor['name']} attend {matched_prev['actorName']} devant {spec['name']} "
                        f"({matched_prev['unitId']}) puis prélève {qty_needed}{spec['unit']} "
                        f"({matched_prev['beforeQty']}{spec['unit']} -> {matched_prev['afterQty']}{spec['unit']} -> {max(0, round(matched_prev['afterQty'] - qty_needed, 2))}{spec['unit']})."
                    ),
                }
                all_contention_logs.append(contention_record)

            for unit_doc in units:
                if rem_to_take <= 0:
                    break
                avail = unit_doc["remainingQuantity"]
                if avail <= 0:
                    continue
                take = min(avail, rem_to_take)
                before_q = avail
                after_q = round(avail - take, 2)
                unit_doc["remainingQuantity"] = after_q
                if unit_doc["openedAt"] is None:
                    unit_doc["openedAt"] = _iso(access_dt)
                unit_doc["status"] = "CONSUMED" if after_q <= 0 else "PARTIAL"
                if after_q <= 0:
                    unit_doc["exhaustedAt"] = _iso(access_dt)

                unit_doc["depletionHistory"].append({
                    "timestamp": _iso(access_dt),
                    "actorId": actor["agentId"],
                    "actorName": actor["name"],
                    "orderId": order_id,
                    "dishId": dish_id,
                    "dishName": dish_name,
                    "tableName": table_name,
                    "deducted": take,
                    "beforeQuantity": before_q,
                    "remainingAfter": after_q,
                    "unit": unit_doc["unit"],
                })
                consumed_slices.append({
                    "unitId": unit_doc["unitId"],
                    "ingredientId": ing_id,
                    "ingredientName": spec["name"],
                    "storageObjectId": storage_id,
                    "sceneObjectId": spec["sceneObjectId"],
                    "quantity": take,
                    "unit": unit_doc["unit"],
                    "beforeQuantity": before_q,
                    "remainingAfter": after_q,
                    "unitStatusAfter": unit_doc["status"],
                })
                storage_access_history.append({
                    "dt": access_dt,
                    "actorId": actor["agentId"],
                    "actorName": actor["name"],
                    "storageObjectId": storage_id,
                    "ingredientId": ing_id,
                    "unitId": unit_doc["unitId"],
                    "beforeQty": before_q,
                    "afterQty": after_q,
                })
                all_inventory_movements.append({
                    "movementId": f"mov-ob-{date_str.replace('-', '')}-{len(all_inventory_movements) + 1:05d}",
                    "businessId": BUSINESS_ID,
                    "premisesId": PREMISES_ID,
                    "serviceDate": date_str,
                    "timestamp": _iso(access_dt),
                    "unitId": unit_doc["unitId"],
                    "ingredientId": ing_id,
                    "ingredientName": spec["name"],
                    "storageObjectId": storage_id,
                    "actorId": actor["agentId"],
                    "actorName": actor["name"],
                    "orderId": order_id,
                    "dishId": dish_id,
                    "delta": -take,
                    "beforeQuantity": before_q,
                    "remainingAfter": after_q,
                    "unit": unit_doc["unit"],
                })
                rem_to_take -= take

            if rem_to_take > 0:
                u_idx = len(units) + 1
                unit_id = f"unit-ob-{ing_id.replace('ing-ob-', '')}-{date_str.replace('-', '')}-{u_idx:02d}"
                before_q = spec["packageSize"]
                after_q = max(0, before_q - rem_to_take)
                new_unit = {
                    "unitId": unit_id,
                    "businessId": BUSINESS_ID,
                    "premisesId": PREMISES_ID,
                    "serviceDate": date_str,
                    "ingredientId": ing_id,
                    "ingredientName": spec["name"],
                    "containerType": spec["containerType"],
                    "storageObjectId": storage_id,
                    "sceneObjectId": spec["sceneObjectId"],
                    "shelfSlot": spec["shelfSlot"],
                    "initialQuantity": before_q,
                    "remainingQuantity": after_q,
                    "unit": spec["unit"],
                    "unitCost": spec["unitCost"],
                    "status": "PARTIAL" if after_q > 0 else "CONSUMED",
                    "openedAt": _iso(access_dt),
                    "exhaustedAt": _iso(access_dt) if after_q <= 0 else None,
                    "createdAt": _iso(morning_delivery_dt),
                    "depletionHistory": [{
                        "timestamp": _iso(access_dt),
                        "actorId": actor["agentId"],
                        "actorName": actor["name"],
                        "orderId": order_id,
                        "dishId": dish_id,
                        "dishName": dish_name,
                        "tableName": table_name,
                        "deducted": rem_to_take,
                        "beforeQuantity": before_q,
                        "remainingAfter": after_q,
                        "unit": spec["unit"],
                    }],
                }
                units.append(new_unit)
                all_stock_units.append(new_unit)
                consumed_slices.append({
                    "unitId": unit_id,
                    "ingredientId": ing_id,
                    "ingredientName": spec["name"],
                    "storageObjectId": storage_id,
                    "sceneObjectId": spec["sceneObjectId"],
                    "quantity": rem_to_take,
                    "unit": spec["unit"],
                    "beforeQuantity": before_q,
                    "remainingAfter": after_q,
                    "unitStatusAfter": new_unit["status"],
                })

            return consumed_slices, contention_record

        # Staff shifts
        for staff in STAFF_ROSTER:
            shift_id = f"shift-ob-{staff['employeeId']}-{date_str}"
            clock_in_dt = _make_dt(date_str, 10, rng.randint(20, 45), rng.randint(0, 50))
            clock_out_dt = _make_dt(date_str, 23, rng.randint(5, 30), rng.randint(0, 50))
            st_coord = STATION_COORDS.get(staff["stationId"], STATION_COORDS["pos-ob-main"])
            all_shifts.append({
                "shiftId": shift_id,
                "businessId": BUSINESS_ID,
                "premisesId": PREMISES_ID,
                "serviceDate": date_str,
                "employeeId": staff["employeeId"],
                "agentId": staff["agentId"],
                "employeeName": staff["name"],
                "role": staff["role"],
                "category": staff["category"],
                "assignedStationId": staff["stationId"],
                "clockIn": _iso(clock_in_dt),
                "clockOut": _iso(clock_out_dt),
                "hourlyRate": staff["hourlyRate"],
            })
            all_events.append({
                "eventId": f"evt-ob-clockin-{staff['employeeId']}-{date_str}",
                "businessId": BUSINESS_ID,
                "premisesId": PREMISES_ID,
                "serviceDate": date_str,
                "timestamp": _iso(clock_in_dt),
                "type": "STAFF_CLOCK_IN",
                "actorId": staff["agentId"],
                "actorName": staff["name"],
                "actorRole": staff["role"],
                "stationId": staff["stationId"],
                "targetObjectId": st_coord["sceneObjectId"],
                "location": {"x": st_coord["x"], "y": 0, "z": st_coord["z"]},
                "dialogue": f"Buongiorno a tutti ! {staff['name']} en poste sur {st_coord['label']}.",
                "tone": "ENERGETIC",
                "metadata": {"shiftId": shift_id, "stationId": staff["stationId"]},
            })
            all_events.append({
                "eventId": f"evt-ob-clockout-{staff['employeeId']}-{date_str}",
                "businessId": BUSINESS_ID,
                "premisesId": PREMISES_ID,
                "serviceDate": date_str,
                "timestamp": _iso(clock_out_dt),
                "type": "STAFF_CLOCK_OUT",
                "actorId": staff["agentId"],
                "actorName": staff["name"],
                "actorRole": staff["role"],
                "stationId": staff["stationId"],
                "targetObjectId": "scene-ob-door-main",
                "location": {"x": 32.0, "y": 0, "z": 14.0},
                "dialogue": f"Buona serata ! Fin de service pour {staff['name']}.",
                "tone": "RELIEVED",
                "metadata": {"shiftId": shift_id},
            })

        barman_free_dt = _make_dt(date_str, 11, 30, 0)
        day_revenue = 0.0
        day_cogs = 0.0
        day_covers = 0
        day_orders_count = 0

        waves = [
            ("LUNCH_1", 12, 14, 10 if is_focus_day else (8 if is_weekend else 7)),
            ("LUNCH_2", 13, 18, 6 if is_weekend else 5),
            ("DINNER_1", 19, 25, 9 if is_weekend else 7),
            ("DINNER_2", 20, 55, 7 if is_weekend else 5),
        ]

        order_seq = 0
        dish_seq = 0

        for wave_name, base_h, base_m, num_tables in waves:
            selected_tables = TABLES_CONFIG[: min(num_tables, len(TABLES_CONFIG))]
            for t_idx, tbl in enumerate(selected_tables):
                order_seq += 1
                order_id = f"ord-ob-{date_str.replace('-', '')}-{order_seq:03d}"
                waiter = floor_waiters[t_idx % len(floor_waiters)]
                party_size = min(tbl["capacity"], rng.choice([2, 2, 3, 4]))
                day_covers += party_size
                day_orders_count += 1

                offset_sec = t_idx * 95 + rng.randint(0, 20)
                t_arrive = _make_dt(date_str, base_h, base_m, 0) + dt.timedelta(seconds=offset_sec)
                t_seat = t_arrive + dt.timedelta(seconds=rng.randint(25, 45))
                t_water = t_seat + dt.timedelta(seconds=rng.randint(35, 60))
                t_order = t_water + dt.timedelta(seconds=rng.randint(85, 140))
                t_pos = t_order + dt.timedelta(seconds=rng.randint(30, 50))
                t_ticket = t_pos + dt.timedelta(seconds=5)

                guests: List[Dict[str, Any]] = []
                for g_i in range(party_size):
                    fn, ln = rng.choice(GUEST_NAMES)
                    guests.append({
                        "agentId": f"agent-cust-ob-{date_str.replace('-', '')}-{order_seq:03d}-{g_i + 1}",
                        "name": f"{fn} {ln}",
                        "seatIndex": g_i,
                    })
                lead_guest = guests[0]

                food_items_chosen = [
                    RECIPES_BY_ID["item-ob-caprese-panzanella" if t_idx % 2 == 0 else "item-ob-carpaccio-estivo"],
                    RECIPES_BY_ID["item-ob-tonnarelli-carbonara"],
                ]
                if party_size >= 2:
                    food_items_chosen.append(
                        RECIPES_BY_ID["item-ob-tagliata-griglia" if t_idx % 2 == 0 else "item-ob-paccheri-bufala"]
                    )
                food_items_chosen.append(RECIPES_BY_ID["item-ob-tiramisu"])

                drink_items_chosen = [
                    RECIPES_BY_ID["item-ob-calice-chianti" if t_idx % 2 == 0 else "item-ob-calice-prosecco"],
                    RECIPES_BY_ID["item-ob-acqua-sp"],
                ]

                table_scene_id = f"scene-ob-table-{tbl['tableId']}"
                table_loc = {"x": tbl["x"], "y": 0, "z": tbl["z"]}

                all_events.append({
                    "eventId": f"evt-{order_id}-arr",
                    "businessId": BUSINESS_ID,
                    "premisesId": PREMISES_ID,
                    "serviceDate": date_str,
                    "timestamp": _iso(t_arrive),
                    "type": "CUSTOMER_ARRIVED",
                    "actorId": lead_guest["agentId"],
                    "actorName": lead_guest["name"],
                    "actorRole": "CUSTOMER",
                    "orderId": order_id,
                    "tableId": tbl["tableId"],
                    "targetObjectId": "scene-ob-door-main",
                    "location": {"x": 32.0, "y": 0, "z": 14.0},
                    "dialogue": f"Buongiorno ! Un tavolo per {party_size}, per favore.",
                    "tone": "POLITE",
                    "metadata": {"partySize": party_size, "tableId": tbl["tableId"], "tableName": tbl["name"], "guests": guests},
                })

                all_events.append({
                    "eventId": f"evt-{order_id}-seat",
                    "businessId": BUSINESS_ID,
                    "premisesId": PREMISES_ID,
                    "serviceDate": date_str,
                    "timestamp": _iso(t_seat),
                    "type": "CUSTOMER_SEATED",
                    "actorId": lead_guest["agentId"],
                    "actorName": lead_guest["name"],
                    "actorRole": "CUSTOMER",
                    "waiterId": waiter["agentId"],
                    "waiterName": waiter["name"],
                    "orderId": order_id,
                    "tableId": tbl["tableId"],
                    "targetObjectId": table_scene_id,
                    "location": table_loc,
                    "dialogue": f"Benvenuti al {tbl['name']}, ecco il menu del giorno !",
                    "tone": "WARM",
                    "metadata": {"partySize": party_size, "tableId": tbl["tableId"], "waiterId": waiter["agentId"], "guests": guests},
                })

                all_events.append({
                    "eventId": f"evt-{order_id}-water",
                    "businessId": BUSINESS_ID,
                    "premisesId": PREMISES_ID,
                    "serviceDate": date_str,
                    "timestamp": _iso(t_water),
                    "type": "WATER_AND_BREAD_SERVED",
                    "actorId": waiter["agentId"],
                    "actorName": waiter["name"],
                    "actorRole": waiter["role"],
                    "orderId": order_id,
                    "tableId": tbl["tableId"],
                    "targetObjectId": table_scene_id,
                    "location": table_loc,
                    "dialogue": f"Focaccia calda all'olio EVO e acqua fresca per {tbl['name']}.",
                    "tone": "ATTENTIVE",
                    "metadata": {"tableId": tbl["tableId"]},
                })

                summary_str = ", ".join(it["name"] for it in food_items_chosen[:3])
                all_events.append({
                    "eventId": f"evt-{order_id}-taken",
                    "businessId": BUSINESS_ID,
                    "premisesId": PREMISES_ID,
                    "serviceDate": date_str,
                    "timestamp": _iso(t_order),
                    "type": "ORDER_TAKEN_AT_TABLE",
                    "actorId": waiter["agentId"],
                    "actorName": waiter["name"],
                    "actorRole": waiter["role"],
                    "orderId": order_id,
                    "tableId": tbl["tableId"],
                    "targetObjectId": table_scene_id,
                    "location": table_loc,
                    "dialogue": f"Perfetto per {tbl['name']} : {summary_str}.",
                    "tone": "PROFESSIONAL",
                    "metadata": {"tableId": tbl["tableId"], "summary": summary_str},
                })

                pos_coord = STATION_COORDS["pos-ob-main"]
                all_events.append({
                    "eventId": f"evt-{order_id}-pos",
                    "businessId": BUSINESS_ID,
                    "premisesId": PREMISES_ID,
                    "serviceDate": date_str,
                    "timestamp": _iso(t_pos),
                    "type": "ORDER_ENTERED_AT_POS",
                    "actorId": waiter["agentId"],
                    "actorName": waiter["name"],
                    "actorRole": waiter["role"],
                    "orderId": order_id,
                    "tableId": tbl["tableId"],
                    "stationId": "pos-ob-main",
                    "targetObjectId": pos_coord["sceneObjectId"],
                    "location": {"x": pos_coord["x"], "y": 0, "z": pos_coord["z"]},
                    "dialogue": f"Comanda inviata in cucina e al bar per {tbl['name']}.",
                    "tone": "FOCUSED",
                    "metadata": {"tableId": tbl["tableId"], "orderId": order_id},
                })

                # Drinks: Single-bottle Barman sequence
                bar_coord = STATION_COORDS["station-ob-bar"]
                order_items_records: List[Dict[str, Any]] = []
                order_total = 0.0
                order_cogs = 0.0

                for d_idx, bev in enumerate(drink_items_chosen):
                    order_total += bev["price"]
                    order_cogs += bev["cost"]
                    t_b_start = max(t_ticket + dt.timedelta(seconds=10 + d_idx * 25), barman_free_dt)
                    t_b_pour = t_b_start + dt.timedelta(seconds=12)
                    t_b_return = t_b_pour + dt.timedelta(seconds=10)
                    t_b_serve = t_b_return + dt.timedelta(seconds=20)
                    barman_free_dt = t_b_return + dt.timedelta(seconds=5)

                    bev_ing = bev["recipe"][0]
                    dish_seq += 1
                    bev_dish_id = f"dish-ob-{date_str.replace('-', '')}-{dish_seq:04d}"
                    slices, _ = deduct_ingredient_fifo(
                        bev_ing["ingredientId"],
                        bev_ing["quantity"],
                        barman,
                        order_id,
                        bev_dish_id,
                        bev["name"],
                        tbl["name"],
                        t_b_pour,
                    )
                    s0 = slices[0]
                    bottle_unit_id = s0["unitId"]

                    all_events.append({
                        "eventId": f"evt-{order_id}-bpik-{d_idx}",
                        "businessId": BUSINESS_ID,
                        "premisesId": PREMISES_ID,
                        "serviceDate": date_str,
                        "timestamp": _iso(t_b_start),
                        "type": "BARMAN_BOTTLE_PICKED",
                        "actorId": barman["agentId"],
                        "actorName": barman["name"],
                        "actorRole": barman["role"],
                        "orderId": order_id,
                        "tableId": tbl["tableId"],
                        "stationId": "station-ob-bar",
                        "targetObjectId": bar_coord["sceneObjectId"],
                        "location": {"x": bar_coord["x"], "y": 0, "z": bar_coord["z"]},
                        "dialogue": f"Prendo una sola bottiglia : {s0['ingredientName']} ({bottle_unit_id}).",
                        "tone": "FOCUSED",
                        "metadata": {
                            "unitId": bottle_unit_id,
                            "heldBottleIds": [bottle_unit_id],
                            "heldBottleCount": 1,
                            "singleBottleRuleEnforced": True,
                        },
                    })
                    all_events.append({
                        "eventId": f"evt-{order_id}-bpour-{d_idx}",
                        "businessId": BUSINESS_ID,
                        "premisesId": PREMISES_ID,
                        "serviceDate": date_str,
                        "timestamp": _iso(t_b_pour),
                        "type": "BARMAN_DRINK_POURED",
                        "actorId": barman["agentId"],
                        "actorName": barman["name"],
                        "actorRole": barman["role"],
                        "orderId": order_id,
                        "dishId": bev_dish_id,
                        "tableId": tbl["tableId"],
                        "stationId": "station-ob-bar",
                        "targetObjectId": bar_coord["sceneObjectId"],
                        "location": {"x": bar_coord["x"], "y": 0, "z": bar_coord["z"]},
                        "dialogue": f"Mescolatura calice {bev['name']} ({s0['beforeQuantity']}{s0['unit']} -> {s0['remainingAfter']}{s0['unit']}).",
                        "tone": "SKILLED",
                        "metadata": {
                            "unitId": bottle_unit_id,
                            "heldBottleIds": [bottle_unit_id],
                            "heldBottleCount": 1,
                            "deducted": s0["quantity"],
                            "beforeQuantity": s0["beforeQuantity"],
                            "remainingAfter": s0["remainingAfter"],
                            "unit": s0["unit"],
                        },
                    })
                    all_events.append({
                        "eventId": f"evt-{order_id}-bret-{d_idx}",
                        "businessId": BUSINESS_ID,
                        "premisesId": PREMISES_ID,
                        "serviceDate": date_str,
                        "timestamp": _iso(t_b_return),
                        "type": "BARMAN_BOTTLE_RETURNED",
                        "actorId": barman["agentId"],
                        "actorName": barman["name"],
                        "actorRole": barman["role"],
                        "orderId": order_id,
                        "tableId": tbl["tableId"],
                        "stationId": "station-ob-bar",
                        "targetObjectId": bar_coord["sceneObjectId"],
                        "location": {"x": bar_coord["x"], "y": 0, "z": bar_coord["z"]},
                        "dialogue": f"Bottiglia {bottle_unit_id} riposta in cantinetta prima della prossima.",
                        "tone": "METHODICAL",
                        "metadata": {"unitId": bottle_unit_id, "heldBottleIds": [], "heldBottleCount": 0},
                    })
                    all_events.append({
                        "eventId": f"evt-{order_id}-bserv-{d_idx}",
                        "businessId": BUSINESS_ID,
                        "premisesId": PREMISES_ID,
                        "serviceDate": date_str,
                        "timestamp": _iso(t_b_serve),
                        "type": "DRINK_SERVED_AT_TABLE",
                        "actorId": waiter["agentId"],
                        "actorName": waiter["name"],
                        "actorRole": waiter["role"],
                        "orderId": order_id,
                        "dishId": bev_dish_id,
                        "tableId": tbl["tableId"],
                        "targetObjectId": table_scene_id,
                        "location": table_loc,
                        "dialogue": f"Ecco il vostro {bev['name']}, salute !",
                        "tone": "WARM",
                        "metadata": {"dishId": bev_dish_id, "itemName": bev["name"], "sourceBottleUnitId": bottle_unit_id},
                    })

                    order_items_records.append({
                        "dishId": bev_dish_id,
                        "itemId": bev["itemId"],
                        "name": bev["name"],
                        "category": bev["category"],
                        "price": bev["price"],
                        "stationId": bev["stationId"],
                        "preparedBy": barman["agentId"],
                        "servedBy": waiter["agentId"],
                        "ingredientsConsumed": slices,
                        "platedAt": _iso(t_b_pour),
                        "deliveredAt": _iso(t_b_serve),
                    })

                # Food items
                last_food_delivered_dt = t_ticket + dt.timedelta(seconds=300)
                passe_coord = STATION_COORDS["station-ob-passe"]
                storage_coord = STATION_COORDS["storage-ob-cold"]

                for f_idx, food in enumerate(food_items_chosen):
                    dish_seq += 1
                    dish_id = f"dish-ob-{date_str.replace('-', '')}-{dish_seq:04d}"
                    order_total += food["price"]
                    order_cogs += food["cost"]

                    if food["stationId"] == "station-ob-garde":
                        cook = STAFF_ROSTER[3] if (order_seq % 2 == 1) else STAFF_ROSTER[2]
                    else:
                        cook = cook_by_station.get(food["stationId"], STAFF_ROSTER[1])
                    st_coord = STATION_COORDS[food["stationId"]]
                    t_open_storage = t_ticket + dt.timedelta(seconds=15 + f_idx * 36)

                    dish_slices: List[Dict[str, Any]] = []
                    for r_ing in food["recipe"]:
                        slices, contention = deduct_ingredient_fifo(
                            r_ing["ingredientId"],
                            r_ing["quantity"],
                            cook,
                            order_id,
                            dish_id,
                            food["name"],
                            tbl["name"],
                            t_open_storage + dt.timedelta(seconds=6),
                        )
                        dish_slices.extend(slices)
                        s0 = slices[0]
                        if contention is not None:
                            all_events.append({
                                "eventId": f"evt-{dish_id}-cont-wait",
                                "businessId": BUSINESS_ID,
                                "premisesId": PREMISES_ID,
                                "serviceDate": date_str,
                                "timestamp": _iso(t_open_storage + dt.timedelta(seconds=3)),
                                "type": "RESOURCE_CONTENTION_WAIT",
                                "actorId": cook["agentId"],
                                "actorName": cook["name"],
                                "actorRole": cook["role"],
                                "orderId": order_id,
                                "dishId": dish_id,
                                "stationId": "storage-ob-cold",
                                "targetObjectId": storage_coord["sceneObjectId"],
                                "location": {"x": storage_coord["x"], "y": 0, "z": storage_coord["z"]},
                                "dialogue": f"Permesso {contention['primaryActorName']}, prendo subito dopo di te da {s0['ingredientName']} !",
                                "tone": "COLLABORATIVE",
                                "metadata": contention,
                            })
                            all_events.append({
                                "eventId": f"evt-{dish_id}-cont-res",
                                "businessId": BUSINESS_ID,
                                "premisesId": PREMISES_ID,
                                "serviceDate": date_str,
                                "timestamp": _iso(t_open_storage + dt.timedelta(seconds=7)),
                                "type": "INGREDIENT_CONTENTION_RESOLVED",
                                "actorId": cook["agentId"],
                                "actorName": cook["name"],
                                "actorRole": cook["role"],
                                "orderId": order_id,
                                "dishId": dish_id,
                                "stationId": "storage-ob-cold",
                                "targetObjectId": storage_coord["sceneObjectId"],
                                "location": {"x": storage_coord["x"], "y": 0, "z": storage_coord["z"]},
                                "dialogue": f"Unità condivisa prelevata ({s0['beforeQuantity']}{s0['unit']} -> {s0['remainingAfter']}{s0['unit']}), torno ai fornelli !",
                                "tone": "RELIEVED",
                                "metadata": contention,
                            })
                        all_events.append({
                            "eventId": f"evt-{dish_id}-depl-{r_ing['ingredientId']}",
                            "businessId": BUSINESS_ID,
                            "premisesId": PREMISES_ID,
                            "serviceDate": date_str,
                            "timestamp": _iso(t_open_storage + dt.timedelta(seconds=9)),
                            "type": "STOCK_UNIT_DEPLETED",
                            "actorId": cook["agentId"],
                            "actorName": cook["name"],
                            "actorRole": cook["role"],
                            "orderId": order_id,
                            "dishId": dish_id,
                            "stationId": "storage-ob-cold",
                            "targetObjectId": storage_coord["sceneObjectId"],
                            "location": {"x": storage_coord["x"], "y": 0, "z": storage_coord["z"]},
                            "dialogue": f"Prelevati {s0['quantity']}{s0['unit']} di {s0['ingredientName']} ({s0['beforeQuantity']}{s0['unit']} -> {s0['remainingAfter']}{s0['unit']}).",
                            "tone": "PRECISE",
                            "metadata": s0,
                        })

                    all_events.append({
                        "eventId": f"evt-{dish_id}-open",
                        "businessId": BUSINESS_ID,
                        "premisesId": PREMISES_ID,
                        "serviceDate": date_str,
                        "timestamp": _iso(t_open_storage),
                        "type": "OPEN_STORAGE_DOOR",
                        "actorId": cook["agentId"],
                        "actorName": cook["name"],
                        "actorRole": cook["role"],
                        "orderId": order_id,
                        "dishId": dish_id,
                        "stationId": "storage-ob-cold",
                        "targetObjectId": storage_coord["sceneObjectId"],
                        "location": {"x": storage_coord["x"], "y": 0, "z": storage_coord["z"]},
                        "dialogue": f"Apro la cella frigo per {food['name']}.",
                        "tone": "BRISK",
                        "metadata": {"dishId": dish_id, "dishName": food["name"]},
                    })

                    t_close_storage = t_open_storage + dt.timedelta(seconds=14)
                    all_events.append({
                        "eventId": f"evt-{dish_id}-close",
                        "businessId": BUSINESS_ID,
                        "premisesId": PREMISES_ID,
                        "serviceDate": date_str,
                        "timestamp": _iso(t_close_storage),
                        "type": "CLOSE_STORAGE_DOOR",
                        "actorId": cook["agentId"],
                        "actorName": cook["name"],
                        "actorRole": cook["role"],
                        "orderId": order_id,
                        "dishId": dish_id,
                        "stationId": "storage-ob-cold",
                        "targetObjectId": storage_coord["sceneObjectId"],
                        "location": {"x": storage_coord["x"], "y": 0, "z": storage_coord["z"]},
                        "dialogue": "Cella frigo chiusa.",
                        "tone": "NEUTRAL",
                        "metadata": {"dishId": dish_id},
                    })

                    t_cook_start = t_close_storage + dt.timedelta(seconds=15)
                    t_plated = t_cook_start + dt.timedelta(seconds=food["cookDurationSec"])
                    t_pickup = t_plated + dt.timedelta(seconds=rng.randint(25, 60))
                    t_delivered = t_pickup + dt.timedelta(seconds=rng.randint(18, 30))

                    if t_delivered > last_food_delivered_dt:
                        last_food_delivered_dt = t_delivered

                    all_events.append({
                        "eventId": f"evt-{dish_id}-cook",
                        "businessId": BUSINESS_ID,
                        "premisesId": PREMISES_ID,
                        "serviceDate": date_str,
                        "timestamp": _iso(t_cook_start),
                        "type": "COOKING_STARTED",
                        "actorId": cook["agentId"],
                        "actorName": cook["name"],
                        "actorRole": cook["role"],
                        "orderId": order_id,
                        "dishId": dish_id,
                        "tableId": tbl["tableId"],
                        "stationId": food["stationId"],
                        "targetObjectId": st_coord["sceneObjectId"],
                        "location": {"x": st_coord["x"], "y": 0, "z": st_coord["z"]},
                        "dialogue": f"In preparazione : {food['name']} per {tbl['name']} !",
                        "tone": "ENERGETIC",
                        "metadata": {
                            "dishId": dish_id,
                            "itemName": food["name"],
                            "stationId": food["stationId"],
                            "ingredientsConsumed": dish_slices,
                        },
                    })

                    all_events.append({
                        "eventId": f"evt-{dish_id}-pass",
                        "businessId": BUSINESS_ID,
                        "premisesId": PREMISES_ID,
                        "serviceDate": date_str,
                        "timestamp": _iso(t_plated),
                        "type": "DISH_PLATED_AT_PASS",
                        "actorId": cook["agentId"],
                        "actorName": cook["name"],
                        "actorRole": cook["role"],
                        "orderId": order_id,
                        "dishId": dish_id,
                        "tableId": tbl["tableId"],
                        "stationId": "station-ob-passe",
                        "targetObjectId": passe_coord["sceneObjectId"],
                        "location": {"x": passe_coord["x"], "y": 0, "z": passe_coord["z"]},
                        "dialogue": f"Pronto al pass : {food['name']} per {tbl['name']} !",
                        "tone": "URGENT",
                        "metadata": {"dishId": dish_id, "itemName": food["name"], "tableId": tbl["tableId"], "stationId": "station-ob-passe"},
                    })

                    all_events.append({
                        "eventId": f"evt-{dish_id}-pkup",
                        "businessId": BUSINESS_ID,
                        "premisesId": PREMISES_ID,
                        "serviceDate": date_str,
                        "timestamp": _iso(t_pickup),
                        "type": "ORDER_PICKED_UP_FROM_PASS",
                        "actorId": waiter["agentId"],
                        "actorName": waiter["name"],
                        "actorRole": waiter["role"],
                        "orderId": order_id,
                        "dishId": dish_id,
                        "tableId": tbl["tableId"],
                        "stationId": "station-ob-passe",
                        "targetObjectId": passe_coord["sceneObjectId"],
                        "location": {"x": passe_coord["x"], "y": 0, "z": passe_coord["z"]},
                        "dialogue": f"Esco col piatto {food['name']} per {tbl['name']}.",
                        "tone": "BRISK",
                        "metadata": {"dishId": dish_id, "itemName": food["name"], "tableId": tbl["tableId"]},
                    })

                    all_events.append({
                        "eventId": f"evt-{dish_id}-deliv",
                        "businessId": BUSINESS_ID,
                        "premisesId": PREMISES_ID,
                        "serviceDate": date_str,
                        "timestamp": _iso(t_delivered),
                        "type": "ORDER_DELIVERED_TO_TABLE",
                        "actorId": waiter["agentId"],
                        "actorName": waiter["name"],
                        "actorRole": waiter["role"],
                        "orderId": order_id,
                        "dishId": dish_id,
                        "tableId": tbl["tableId"],
                        "targetObjectId": table_scene_id,
                        "location": table_loc,
                        "dialogue": f"Ecco a voi {food['name']}, buon appetito a {tbl['name']} !",
                        "tone": "WARM",
                        "metadata": {
                            "dishId": dish_id,
                            "itemName": food["name"],
                            "tableId": tbl["tableId"],
                            "ingredientsConsumed": dish_slices,
                        },
                    })

                    all_dish_instances.append({
                        "dishId": dish_id,
                        "businessId": BUSINESS_ID,
                        "premisesId": PREMISES_ID,
                        "serviceDate": date_str,
                        "orderId": order_id,
                        "tableId": tbl["tableId"],
                        "tableSceneObjectId": table_scene_id,
                        "tableName": tbl["name"],
                        "itemId": food["itemId"],
                        "dishName": food["name"],
                        "category": food["category"],
                        "price": food["price"],
                        "stationId": food["stationId"],
                        "stationSceneObjectId": st_coord["sceneObjectId"],
                        "passSceneObjectId": passe_coord["sceneObjectId"],
                        "preparedBy": cook["agentId"],
                        "preparedByName": cook["name"],
                        "servedBy": waiter["agentId"],
                        "servedByName": waiter["name"],
                        "orderedAt": _iso(t_order),
                        "cookingStartedAt": _iso(t_cook_start),
                        "platedAtPassAt": _iso(t_plated),
                        "pickedUpFromPassAt": _iso(t_pickup),
                        "deliveredToTableAt": _iso(t_delivered),
                        "clearedAt": None,
                        "status": "SERVED_ON_TABLE",
                        "ingredientsConsumed": dish_slices,
                    })
                    order_items_records.append({
                        "dishId": dish_id,
                        "itemId": food["itemId"],
                        "name": food["name"],
                        "category": food["category"],
                        "price": food["price"],
                        "stationId": food["stationId"],
                        "preparedBy": cook["agentId"],
                        "servedBy": waiter["agentId"],
                        "ingredientsConsumed": dish_slices,
                        "cookingStartedAt": _iso(t_cook_start),
                        "platedAt": _iso(t_plated),
                        "deliveredAt": _iso(t_delivered),
                    })

                # Strict 16-24 min dining after last_food_delivered_dt
                dining_seconds = rng.randint(16 * 60, 24 * 60)
                t_checkin = last_food_delivered_dt + dt.timedelta(seconds=360)
                t_paid = last_food_delivered_dt + dt.timedelta(seconds=dining_seconds)
                t_depart = t_paid + dt.timedelta(seconds=45)
                t_clear = t_depart + dt.timedelta(seconds=90)
                t_wash = t_clear + dt.timedelta(seconds=65)

                for d_inst in reversed(all_dish_instances):
                    if d_inst["orderId"] != order_id:
                        break
                    d_inst["clearedAt"] = _iso(t_clear)

                all_events.append({
                    "eventId": f"evt-{order_id}-chkin",
                    "businessId": BUSINESS_ID,
                    "premisesId": PREMISES_ID,
                    "serviceDate": date_str,
                    "timestamp": _iso(t_checkin),
                    "type": "GUEST_DINING_CHECKIN",
                    "actorId": waiter["agentId"],
                    "actorName": waiter["name"],
                    "actorRole": waiter["role"],
                    "orderId": order_id,
                    "tableId": tbl["tableId"],
                    "targetObjectId": table_scene_id,
                    "location": table_loc,
                    "dialogue": f"Tutto bene al {tbl['name']} ? La pasta è cotta a puntino !",
                    "tone": "HAPPY",
                    "metadata": {"tableId": tbl["tableId"]},
                })

                all_events.append({
                    "eventId": f"evt-{order_id}-paid",
                    "businessId": BUSINESS_ID,
                    "premisesId": PREMISES_ID,
                    "serviceDate": date_str,
                    "timestamp": _iso(t_paid),
                    "type": "PAYMENT_COMPLETED",
                    "actorId": lead_guest["agentId"],
                    "actorName": lead_guest["name"],
                    "actorRole": "CUSTOMER",
                    "waiterId": waiter["agentId"],
                    "orderId": order_id,
                    "tableId": tbl["tableId"],
                    "targetObjectId": table_scene_id,
                    "location": table_loc,
                    "dialogue": f"Grazie mille dal {tbl['name']}, pagamento completato !",
                    "tone": "GRATEFUL",
                    "metadata": {
                        "orderId": order_id,
                        "tableId": tbl["tableId"],
                        "totalAmount": round(order_total, 2),
                        "paymentMethod": "CARD",
                        "guests": guests,
                    },
                })

                all_events.append({
                    "eventId": f"evt-{order_id}-dep",
                    "businessId": BUSINESS_ID,
                    "premisesId": PREMISES_ID,
                    "serviceDate": date_str,
                    "timestamp": _iso(t_depart),
                    "type": "CUSTOMER_DEPARTED",
                    "actorId": lead_guest["agentId"],
                    "actorName": lead_guest["name"],
                    "actorRole": "CUSTOMER",
                    "orderId": order_id,
                    "tableId": tbl["tableId"],
                    "targetObjectId": "scene-ob-door-main",
                    "location": {"x": 32.0, "y": 0, "z": 14.0},
                    "dialogue": "Arrivederci e grazie per l'ospitalità !",
                    "tone": "CHEERFUL",
                    "metadata": {
                        "orderId": order_id,
                        "tableId": tbl["tableId"],
                        "guests": guests,
                        "diningSecondsAfterLastDelivery": dining_seconds,
                    },
                })

                all_events.append({
                    "eventId": f"evt-{order_id}-clr",
                    "businessId": BUSINESS_ID,
                    "premisesId": PREMISES_ID,
                    "serviceDate": date_str,
                    "timestamp": _iso(t_clear),
                    "type": "TABLE_CLEARED",
                    "actorId": waiter["agentId"],
                    "actorName": waiter["name"],
                    "actorRole": waiter["role"],
                    "orderId": order_id,
                    "tableId": tbl["tableId"],
                    "targetObjectId": table_scene_id,
                    "location": table_loc,
                    "dialogue": f"{tbl['name']} sbarazzato e pronto per i prossimi ospiti.",
                    "tone": "EFFICIENT",
                    "metadata": {"orderId": order_id, "tableId": tbl["tableId"]},
                })

                plonge_coord = STATION_COORDS["station-ob-plonge"]
                all_events.append({
                    "eventId": f"evt-{order_id}-plonge",
                    "businessId": BUSINESS_ID,
                    "premisesId": PREMISES_ID,
                    "serviceDate": date_str,
                    "timestamp": _iso(t_wash),
                    "type": "DISHES_WASHED_AT_PLONGE",
                    "actorId": plongeur["agentId"],
                    "actorName": plongeur["name"],
                    "actorRole": plongeur["role"],
                    "orderId": order_id,
                    "stationId": "station-ob-plonge",
                    "targetObjectId": plonge_coord["sceneObjectId"],
                    "location": {"x": plonge_coord["x"], "y": 0, "z": plonge_coord["z"]},
                    "dialogue": f"Stoviglie del {tbl['name']} lavate e igienizzate.",
                    "tone": "FOCUSED",
                    "metadata": {"orderId": order_id, "tableId": tbl["tableId"]},
                })

                all_orders.append({
                    "orderId": order_id,
                    "businessId": BUSINESS_ID,
                    "premisesId": PREMISES_ID,
                    "serviceDate": date_str,
                    "shift": "LUNCH" if "LUNCH" in wave_name else "DINNER",
                    "tableId": tbl["tableId"],
                    "tableSceneObjectId": table_scene_id,
                    "tableName": tbl["name"],
                    "zone": tbl["zone"],
                    "waiterId": waiter["agentId"],
                    "waiterName": waiter["name"],
                    "partySize": party_size,
                    "guests": guests,
                    "customerId": lead_guest["agentId"],
                    "customerName": lead_guest["name"],
                    "arrivedAt": _iso(t_arrive),
                    "seatedAt": _iso(t_seat),
                    "orderedAt": _iso(t_order),
                    "lastFoodDeliveredAt": _iso(last_food_delivered_dt),
                    "paidAt": _iso(t_paid),
                    "departedAt": _iso(t_depart),
                    "clearedAt": _iso(t_clear),
                    "status": "COMPLETED",
                    "totalAmount": round(order_total, 2),
                    "foodCost": round(order_cogs, 2),
                    "items": order_items_records,
                })

                day_revenue += order_total
                day_cogs += order_cogs

        payroll_cost = sum(s["hourlyRate"] * 8.5 for s in STAFF_ROSTER)
        all_accounting_entries.extend([
            {
                "entryId": f"acc-ob-rev-{date_str}",
                "businessId": BUSINESS_ID,
                "serviceDate": date_str,
                "timestamp": _iso(_make_dt(date_str, 23, 45, 0)),
                "type": "REVENUE",
                "category": "Vendite Cucina Italiana & Enoteca",
                "amount": round(day_revenue, 2),
            },
            {
                "entryId": f"acc-ob-cogs-{date_str}",
                "businessId": BUSINESS_ID,
                "serviceDate": date_str,
                "timestamp": _iso(_make_dt(date_str, 23, 50, 0)),
                "type": "EXPENSE",
                "category": "Ingredienti Freschi DOP",
                "amount": -round(day_cogs, 2),
            },
            {
                "entryId": f"acc-ob-pay-{date_str}",
                "businessId": BUSINESS_ID,
                "serviceDate": date_str,
                "timestamp": _iso(_make_dt(date_str, 23, 55, 0)),
                "type": "EXPENSE",
                "category": "Stipendi Brigata",
                "amount": -round(payroll_cost, 2),
            },
        ])

        all_reviews.append({
            "reviewId": f"rev-ob-{date_str}",
            "businessId": BUSINESS_ID,
            "serviceDate": date_str,
            "rating": 4.8,
            "author": "Client Vérifié",
            "comment": "Carbonara authentique au guanciale et mozzarella di bufala exceptionnelle !",
        })

        daily_kpis.append({
            "businessId": BUSINESS_ID,
            "serviceDate": date_str,
            "revenue": round(day_revenue, 2),
            "foodCost": round(day_cogs, 2),
            "payrollCost": round(payroll_cost, 2),
            "netOperatingProfit": round(day_revenue - day_cogs - payroll_cost, 2),
            "ordersCount": day_orders_count,
            "covers": day_covers,
            "avgTicket": round(day_revenue / max(1, day_orders_count), 2),
            "contentionEventsCount": sum(1 for c in all_contention_logs if c["serviceDate"] == date_str),
        })

    all_events.sort(key=lambda e: e["timestamp"])

    return {
        "businessId": BUSINESS_ID,
        "premisesId": PREMISES_ID,
        "employees": STAFF_ROSTER,
        "tables": TABLES_CONFIG,
        "menuItems": MENU_RECIPES,
        "ingredientsCatalog": list(INGREDIENTS_CATALOG.values()),
        "shifts": all_shifts,
        "orders": all_orders,
        "events": all_events,
        "stockUnits": all_stock_units,
        "dishInstances": all_dish_instances,
        "contentionLog": all_contention_logs,
        "inventoryLots": all_inventory_lots,
        "inventoryMovements": all_inventory_movements,
        "accountingEntries": all_accounting_entries,
        "reviews": all_reviews,
        "dailyKpis": daily_kpis,
    }
