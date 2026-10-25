#!/usr/bin/env python3
"""
30-Day Full Operational & Physical Lineage Seed Generator for:
Sakana-Tei (business-sakana-tei / premises-sakana-tei)
Dates: 2026-10-01 through 2026-10-31 (Europe/Paris local time, DST-aware)

Enforces:
1. Recipe -> Ingredient Grammage -> Discrete Physical StockUnit FIFO depletion
2. Multi-cook contention on 150g Japanese Kyuri Cucumber (150g -> 120g -> 90g) & 300g Salmon Saku
3. Single-bottle Barman constraint for Ren Kobayashi (never > 1 bottle held/poured)
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


BUSINESS_ID = "business-sakana-tei"
PREMISES_ID = "premises-sakana-tei"
PARIS_TZ = ZoneInfo("Europe/Paris")
FOCUS_DATE = "2026-10-24"

STATION_COORDS: Dict[str, Dict[str, Any]] = {
    "storage-sk-cold": {
        "sceneObjectId": "scene-sk-storage-cold",
        "label": "Chambre Froide Poissons & Légumes",
        "x": 45.2,
        "z": -4.5,
    },
    "station-sk-plonge": {
        "sceneObjectId": "scene-sk-station-plonge",
        "label": "Poste Plonge Sakana-Tei",
        "x": 47.4,
        "z": -4.6,
    },
    "station-sk-sushi": {
        "sceneObjectId": "scene-sk-station-sushi",
        "label": "Comptoir Sushi & Découpe Sashimi",
        "x": 50.2,
        "z": -2.2,
    },
    "station-sk-tempura": {
        "sceneObjectId": "scene-sk-station-tempura",
        "label": "Poste Fritures Tempura",
        "x": 54.2,
        "z": -4.6,
    },
    "station-sk-robata": {
        "sceneObjectId": "scene-sk-station-robata",
        "label": "Grill Robatayaki Binchotan",
        "x": 58.2,
        "z": -4.5,
    },
    "station-sk-passe": {
        "sceneObjectId": "scene-sk-station-passe",
        "label": "Passe Cuisine Japonaise",
        "x": 58.4,
        "z": 0.0,
    },
    "station-sk-bar": {
        "sceneObjectId": "scene-sk-station-bar",
        "label": "Bar à Sakés & Whiskies Japonais",
        "x": 59.0,
        "z": 10.8,
    },
    "pos-sk-main": {
        "sceneObjectId": "scene-sk-pos-main",
        "label": "Terminal POS Sakana-Tei",
        "x": 56.8,
        "z": 10.5,
    },
    "door-sk-main": {
        "sceneObjectId": "scene-sk-door-main",
        "label": "Entrée Noren Sakana-Tei",
        "x": 52.0,
        "z": 14.0,
    },
}

TABLES_CONFIG: List[Dict[str, Any]] = [
    {"tableId": "sk-t1", "name": "Table Tatami 1", "zone": "SALLE", "capacity": 2, "x": 45.6, "z": 3.2},
    {"tableId": "sk-t2", "name": "Table Tatami 2", "zone": "SALLE", "capacity": 2, "x": 49.2, "z": 3.2},
    {"tableId": "sk-t3", "name": "Table Tatami 3", "zone": "SALLE", "capacity": 4, "x": 53.0, "z": 3.2},
    {"tableId": "sk-t4", "name": "Table 4", "zone": "SALLE", "capacity": 2, "x": 45.6, "z": 7.0},
    {"tableId": "sk-t5", "name": "Table 5", "zone": "SALLE", "capacity": 4, "x": 49.5, "z": 7.0},
    {"tableId": "sk-t6", "name": "Table 6", "zone": "SALLE", "capacity": 4, "x": 53.8, "z": 7.0},
    {"tableId": "sk-t7", "name": "Grande Table Omakase 7", "zone": "SALLE", "capacity": 6, "x": 49.5, "z": 10.6},
    {"tableId": "sk-tr1", "name": "Terrasse Zen 1", "zone": "TERRASSE", "capacity": 2, "x": 45.8, "z": 16.2},
    {"tableId": "sk-tr2", "name": "Terrasse Zen 2", "zone": "TERRASSE", "capacity": 2, "x": 50.2, "z": 16.2},
    {"tableId": "sk-tr3", "name": "Terrasse Zen 3", "zone": "TERRASSE", "capacity": 4, "x": 55.0, "z": 16.2},
]

STAFF_ROSTER: List[Dict[str, Any]] = [
    {
        "employeeId": "emp-sk-yuki",
        "agentId": "agent-emp-sk-yuki",
        "name": "Yuki Nakamura",
        "role": "Directrice de Salle & Accueil",
        "category": "MANAGER",
        "stationId": "pos-sk-main",
        "hourlyRate": 24.50,
    },
    {
        "employeeId": "emp-sk-kenji",
        "agentId": "agent-emp-sk-kenji",
        "name": "Kenji Takahashi",
        "role": "Maître Sushi (Itamae)",
        "category": "KITCHEN",
        "stationId": "station-sk-sushi",
        "hourlyRate": 27.50,
    },
    {
        "employeeId": "emp-sk-haruka",
        "agentId": "agent-emp-sk-haruka",
        "name": "Haruka Sato",
        "role": "Cheffe Robata & Tempura",
        "category": "KITCHEN",
        "stationId": "station-sk-tempura",
        "hourlyRate": 22.00,
    },
    {
        "employeeId": "emp-sk-daiki",
        "agentId": "agent-emp-sk-daiki",
        "name": "Daiki Yamamoto",
        "role": "Plongeur & Préparateur Riz",
        "category": "KITCHEN",
        "stationId": "station-sk-plonge",
        "hourlyRate": 15.00,
    },
    {
        "employeeId": "emp-sk-aoi",
        "agentId": "agent-emp-sk-aoi",
        "name": "Aoi Kobayashi",
        "role": "Cheffe de Rang",
        "category": "FLOOR",
        "stationId": "station-sk-passe",
        "hourlyRate": 17.20,
    },
    {
        "employeeId": "emp-sk-ren",
        "agentId": "agent-emp-sk-ren",
        "name": "Ren Kobayashi",
        "role": "Maître Saké & Barman",
        "category": "BAR",
        "stationId": "station-sk-bar",
        "hourlyRate": 18.80,
    },
]

INGREDIENTS_CATALOG: Dict[str, Dict[str, Any]] = {
    "ing-sk-concombre": {
        "ingredientId": "ing-sk-concombre",
        "name": "Concombre Japonais Kyuri Bio (150g)",
        "unit": "g",
        "packageSize": 150,
        "containerType": "whole_cucumber_150g",
        "storageObjectId": "storage-sk-cold",
        "sceneObjectId": "scene-sk-storage-cold",
        "shelfSlot": "Étagère 2 - Légumes Kyuri & Shiso",
        "dailyUnits": 14,
        "unitCost": 0.95,
        "supplierId": "sup-kioko-maraicher",
    },
    "ing-sk-saumon": {
        "ingredientId": "ing-sk-saumon",
        "name": "Pavé Saku de Saumon Label Rouge (300g)",
        "unit": "g",
        "packageSize": 300,
        "containerType": "saku_block_300g",
        "storageObjectId": "storage-sk-cold",
        "sceneObjectId": "scene-sk-storage-cold",
        "shelfSlot": "Étagère 1 - Coffre Glacé Sashimi",
        "dailyUnits": 10,
        "unitCost": 9.80,
        "supplierId": "sup-maree-tsukiji-paris",
    },
    "ing-sk-thon-toro": {
        "ingredientId": "ing-sk-thon-toro",
        "name": "Longes de Thon Rouge Akami & Otoro",
        "unit": "g",
        "packageSize": 600,
        "containerType": "saku_600g",
        "storageObjectId": "storage-sk-cold",
        "sceneObjectId": "scene-sk-storage-cold",
        "shelfSlot": "Étagère 1 - Coffre Glacé Sashimi",
        "dailyUnits": 5,
        "unitCost": 32.00,
        "supplierId": "sup-maree-tsukiji-paris",
    },
    "ing-sk-crevette-ebi": {
        "ingredientId": "ing-sk-crevette-ebi",
        "name": "Crevettes Impériales Black Tiger (Tempura)",
        "unit": "pc",
        "packageSize": 25,
        "containerType": "tray_25pc",
        "storageObjectId": "storage-sk-cold",
        "sceneObjectId": "scene-sk-storage-cold",
        "shelfSlot": "Étagère 3 - Crustacés",
        "dailyUnits": 5,
        "unitCost": 24.00,
        "supplierId": "sup-maree-tsukiji-paris",
    },
    "ing-sk-boeuf-wagyu": {
        "ingredientId": "ing-sk-boeuf-wagyu",
        "name": "Bœuf Wagyu Kagoshima & Poulet Yakitori",
        "unit": "g",
        "packageSize": 1200,
        "containerType": "vacuum_1200g",
        "storageObjectId": "storage-sk-cold",
        "sceneObjectId": "scene-sk-storage-cold",
        "shelfSlot": "Étagère 4 - Viandes Robata",
        "dailyUnits": 4,
        "unitCost": 46.00,
        "supplierId": "sup-wagyu-import",
    },
    "ing-sk-riz-shari": {
        "ingredientId": "ing-sk-riz-shari",
        "name": "Riz Koshihikari Vinaigré Shari",
        "unit": "g",
        "packageSize": 2000,
        "containerType": "hangiri_2000g",
        "storageObjectId": "storage-sk-cold",
        "sceneObjectId": "scene-sk-storage-cold",
        "shelfSlot": "Étagère 2 - Préparations",
        "dailyUnits": 5,
        "unitCost": 8.50,
        "supplierId": "sup-kioko-maraicher",
    },
    "ing-sk-matcha": {
        "ingredientId": "ing-sk-matcha",
        "name": "Appareil Matcha d'Uji & Sésame Noir",
        "unit": "g",
        "packageSize": 800,
        "containerType": "tub_800g",
        "storageObjectId": "storage-sk-cold",
        "sceneObjectId": "scene-sk-storage-cold",
        "shelfSlot": "Étagère 3 - Pâtisserie Japonaise",
        "dailyUnits": 4,
        "unitCost": 16.00,
        "supplierId": "sup-kioko-maraicher",
    },
    "ing-sk-sake-junmai": {
        "ingredientId": "ing-sk-sake-junmai",
        "name": "Bouteille Saké Dassai Junmai Daiginjo 72cl",
        "unit": "ml",
        "packageSize": 720,
        "containerType": "bottle_720ml",
        "storageObjectId": "station-sk-bar",
        "sceneObjectId": "scene-sk-station-bar",
        "shelfSlot": "Cave à Saké Réfrigérée - Rang A",
        "dailyUnits": 9,
        "unitCost": 24.00,
        "supplierId": "sup-maison-du-sake",
    },
    "ing-sk-whisky-nikka": {
        "ingredientId": "ing-sk-whisky-nikka",
        "name": "Bouteille Whisky Japonais Nikka Highball 70cl",
        "unit": "ml",
        "packageSize": 700,
        "containerType": "bottle_700ml",
        "storageObjectId": "station-sk-bar",
        "sceneObjectId": "scene-sk-station-bar",
        "shelfSlot": "Étagère Whiskies Japonais - Rang B",
        "dailyUnits": 5,
        "unitCost": 31.00,
        "supplierId": "sup-maison-du-sake",
    },
    "ing-sk-the-sencha": {
        "ingredientId": "ing-sk-the-sencha",
        "name": "Carafe Thé Vert Sencha Infusé à Froid 100cl",
        "unit": "ml",
        "packageSize": 1000,
        "containerType": "bottle_1000ml",
        "storageObjectId": "station-sk-bar",
        "sceneObjectId": "scene-sk-station-bar",
        "shelfSlot": "Banque Froide Bar",
        "dailyUnits": 10,
        "unitCost": 2.40,
        "supplierId": "sup-kioko-maraicher",
    },
}

MENU_RECIPES: List[Dict[str, Any]] = [
    {
        "itemId": "item-sk-sunomono-kappa",
        "name": "Sunomono de Concombre Kyuri & Kappa Maki",
        "category": "Zensai (Entrées)",
        "price": 11.00,
        "cost": 2.40,
        "stationId": "station-sk-sushi",
        "cookDurationSec": 185,
        "isBeverage": False,
        "recipe": [
            {"ingredientId": "ing-sk-concombre", "quantity": 30, "unit": "g"},
            {"ingredientId": "ing-sk-riz-shari", "quantity": 90, "unit": "g"},
        ],
    },
    {
        "itemId": "item-sk-chirashi-royal",
        "name": "Chirashi Royal Saumon, Thon Toro & Kyuri Croquant",
        "category": "Sushi & Sashimi",
        "price": 25.50,
        "cost": 7.90,
        "stationId": "station-sk-sushi",
        "cookDurationSec": 260,
        "isBeverage": False,
        "recipe": [
            {"ingredientId": "ing-sk-saumon", "quantity": 90, "unit": "g"},
            {"ingredientId": "ing-sk-thon-toro", "quantity": 75, "unit": "g"},
            {"ingredientId": "ing-sk-concombre", "quantity": 30, "unit": "g"},
            {"ingredientId": "ing-sk-riz-shari", "quantity": 180, "unit": "g"},
        ],
    },
    {
        "itemId": "item-sk-tempura-moriawase",
        "name": "Tempura Moriawase (Crevettes Black Tiger & Légumes)",
        "category": "Tempura",
        "price": 22.00,
        "cost": 6.40,
        "stationId": "station-sk-tempura",
        "cookDurationSec": 295,
        "isBeverage": False,
        "recipe": [
            {"ingredientId": "ing-sk-crevette-ebi", "quantity": 4, "unit": "pc"},
            {"ingredientId": "ing-sk-concombre", "quantity": 30, "unit": "g"},
        ],
    },
    {
        "itemId": "item-sk-robata-wagyu",
        "name": "Robatayaki de Wagyu Grillé au Binchotan & Salade Kyuri",
        "category": "Robata Grill",
        "price": 29.00,
        "cost": 9.80,
        "stationId": "station-sk-robata",
        "cookDurationSec": 340,
        "isBeverage": False,
        "recipe": [
            {"ingredientId": "ing-sk-boeuf-wagyu", "quantity": 160, "unit": "g"},
            {"ingredientId": "ing-sk-concombre", "quantity": 30, "unit": "g"},
        ],
    },
    {
        "itemId": "item-sk-mochi-matcha",
        "name": "Duo de Daifuku Mochi au Matcha d'Uji",
        "category": "Desserts",
        "price": 9.50,
        "cost": 2.30,
        "stationId": "station-sk-sushi",
        "cookDurationSec": 160,
        "isBeverage": False,
        "recipe": [
            {"ingredientId": "ing-sk-matcha", "quantity": 90, "unit": "g"},
        ],
    },
    {
        "itemId": "item-sk-tokkuri-sake",
        "name": "Tokkuri Saké Junmai Daiginjo (12cl)",
        "category": "Sakés",
        "price": 12.50,
        "cost": 3.80,
        "stationId": "station-sk-bar",
        "cookDurationSec": 40,
        "isBeverage": True,
        "recipe": [
            {"ingredientId": "ing-sk-sake-junmai", "quantity": 120, "unit": "ml"},
        ],
    },
    {
        "itemId": "item-sk-nikka-highball",
        "name": "Nikka Whisky Highball Glace Sculptée",
        "category": "Cocktails & Whiskies",
        "price": 13.00,
        "cost": 3.20,
        "stationId": "station-sk-bar",
        "cookDurationSec": 45,
        "isBeverage": True,
        "recipe": [
            {"ingredientId": "ing-sk-whisky-nikka", "quantity": 50, "unit": "ml"},
        ],
    },
    {
        "itemId": "item-sk-sencha-glace",
        "name": "Verre de Thé Vert Sencha Infusé à Froid",
        "category": "Boissons",
        "price": 5.50,
        "cost": 0.90,
        "stationId": "station-sk-bar",
        "cookDurationSec": 30,
        "isBeverage": True,
        "recipe": [
            {"ingredientId": "ing-sk-the-sencha", "quantity": 250, "unit": "ml"},
        ],
    },
]

RECIPES_BY_ID = {r["itemId"]: r for r in MENU_RECIPES}

GUEST_NAMES = [
    ("Haruto", "Watanabe"), ("Yuna", "Ito"), ("Sora", "Tanaka"), ("Mei", "Nakamura"),
    ("Alexandre", "Vasseur"), ("Inès", "Fontaine"), ("Théo", "Mercier"), ("Salomé", "Perrin"),
    ("Romain", "Chevalier"), ("Noémie", "Boucher"), ("Quentin", "Lemaire"), ("Margaux", "Rousseau"),
]


def _iso(ts_dt: dt.datetime) -> str:
    return ts_dt.astimezone(PARIS_TZ).isoformat(timespec="seconds")


def _make_dt(date_str: str, hour: int, minute: int, second: int = 0) -> dt.datetime:
    y, m, d = [int(p) for p in date_str.split("-")]
    return dt.datetime(y, m, d, hour, minute, second, tzinfo=PARIS_TZ)


def generate_sakana_tei_month(
    start_date: str = "2026-10-01",
    days: int = 31,
) -> Dict[str, Any]:
    """Generates full month dataset for Sakana-Tei."""
    rng = random.Random(2025061403)

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
        "station-sk-sushi": STAFF_ROSTER[1],    # Kenji Takahashi
        "station-sk-tempura": STAFF_ROSTER[2],  # Haruka Sato
        "station-sk-robata": STAFF_ROSTER[2],   # Haruka Sato
    }
    floor_waiters = [STAFF_ROSTER[4], STAFF_ROSTER[0]]  # Aoi Kobayashi & Yuki Nakamura
    barman = STAFF_ROSTER[5]   # Ren Kobayashi
    plongeur = STAFF_ROSTER[3] # Daiki Yamamoto

    start_dt = dt.date.fromisoformat(start_date)

    for day_idx in range(days):
        cur_date = start_dt + dt.timedelta(days=day_idx)
        date_str = cur_date.isoformat()
        is_weekend = cur_date.weekday() >= 4
        is_focus_day = (date_str == FOCUS_DATE)

        day_units_by_ing: Dict[str, List[Dict[str, Any]]] = {}
        morning_delivery_dt = _make_dt(date_str, 8, 50, 0)

        for ing_id, spec in INGREDIENTS_CATALOG.items():
            units_list: List[Dict[str, Any]] = []
            count = spec["dailyUnits"] + (3 if is_weekend else 0)
            for u_idx in range(1, count + 1):
                unit_id = f"unit-sk-{ing_id.replace('ing-sk-', '')}-{date_str.replace('-', '')}-{u_idx:02d}"
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
                "lotId": f"lot-sk-{ing_id.replace('ing-sk-', '')}-{date_str.replace('-', '')}",
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
                "expiryDate": (cur_date + dt.timedelta(days=3)).isoformat(),
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
                    "contentionId": f"cont-sk-{date_str.replace('-', '')}-{len(all_contention_logs) + 1:04d}",
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
                    "movementId": f"mov-sk-{date_str.replace('-', '')}-{len(all_inventory_movements) + 1:05d}",
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
                unit_id = f"unit-sk-{ing_id.replace('ing-sk-', '')}-{date_str.replace('-', '')}-{u_idx:02d}"
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
            shift_id = f"shift-sk-{staff['employeeId']}-{date_str}"
            clock_in_dt = _make_dt(date_str, 10, rng.randint(20, 45), rng.randint(0, 50))
            clock_out_dt = _make_dt(date_str, 23, rng.randint(5, 30), rng.randint(0, 50))
            st_coord = STATION_COORDS.get(staff["stationId"], STATION_COORDS["pos-sk-main"])
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
                "eventId": f"evt-sk-clockin-{staff['employeeId']}-{date_str}",
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
                "dialogue": f"Ohayō gozaimasu ! {staff['name']} en place sur {st_coord['label']}.",
                "tone": "ENERGETIC",
                "metadata": {"shiftId": shift_id, "stationId": staff["stationId"]},
            })
            all_events.append({
                "eventId": f"evt-sk-clockout-{staff['employeeId']}-{date_str}",
                "businessId": BUSINESS_ID,
                "premisesId": PREMISES_ID,
                "serviceDate": date_str,
                "timestamp": _iso(clock_out_dt),
                "type": "STAFF_CLOCK_OUT",
                "actorId": staff["agentId"],
                "actorName": staff["name"],
                "actorRole": staff["role"],
                "stationId": staff["stationId"],
                "targetObjectId": "scene-sk-door-main",
                "location": {"x": 52.0, "y": 0, "z": 14.0},
                "dialogue": f"Otsukaresama deshita ! Fin de service pour {staff['name']}.",
                "tone": "RELIEVED",
                "metadata": {"shiftId": shift_id},
            })

        barman_free_dt = _make_dt(date_str, 11, 30, 0)
        day_revenue = 0.0
        day_cogs = 0.0
        day_covers = 0
        day_orders_count = 0

        waves = [
            ("LUNCH_1", 12, 13, 10 if is_focus_day else (8 if is_weekend else 7)),
            ("LUNCH_2", 13, 16, 6 if is_weekend else 5),
            ("DINNER_1", 19, 22, 9 if is_weekend else 7),
            ("DINNER_2", 20, 52, 7 if is_weekend else 5),
        ]

        order_seq = 0
        dish_seq = 0

        for wave_name, base_h, base_m, num_tables in waves:
            selected_tables = TABLES_CONFIG[: min(num_tables, len(TABLES_CONFIG))]
            for t_idx, tbl in enumerate(selected_tables):
                order_seq += 1
                order_id = f"ord-sk-{date_str.replace('-', '')}-{order_seq:03d}"
                waiter = floor_waiters[t_idx % len(floor_waiters)]
                party_size = min(tbl["capacity"], rng.choice([2, 2, 3, 4]))
                day_covers += party_size
                day_orders_count += 1

                offset_sec = t_idx * 90 + rng.randint(0, 20)
                t_arrive = _make_dt(date_str, base_h, base_m, 0) + dt.timedelta(seconds=offset_sec)
                t_seat = t_arrive + dt.timedelta(seconds=rng.randint(25, 45))
                t_water = t_seat + dt.timedelta(seconds=rng.randint(35, 60))
                t_order = t_water + dt.timedelta(seconds=rng.randint(85, 135))
                t_pos = t_order + dt.timedelta(seconds=rng.randint(30, 50))
                t_ticket = t_pos + dt.timedelta(seconds=5)

                guests: List[Dict[str, Any]] = []
                for g_i in range(party_size):
                    fn, ln = rng.choice(GUEST_NAMES)
                    guests.append({
                        "agentId": f"agent-cust-sk-{date_str.replace('-', '')}-{order_seq:03d}-{g_i + 1}",
                        "name": f"{fn} {ln}",
                        "seatIndex": g_i,
                    })
                lead_guest = guests[0]

                food_items_chosen = [
                    RECIPES_BY_ID["item-sk-sunomono-kappa"],
                    RECIPES_BY_ID["item-sk-chirashi-royal"],
                    RECIPES_BY_ID["item-sk-tempura-moriawase" if t_idx % 2 == 0 else "item-sk-robata-wagyu"],
                    RECIPES_BY_ID["item-sk-mochi-matcha"],
                ]
                drink_items_chosen = [
                    RECIPES_BY_ID["item-sk-tokkuri-sake" if t_idx % 2 == 0 else "item-sk-nikka-highball"],
                    RECIPES_BY_ID["item-sk-sencha-glace"],
                ]

                table_scene_id = f"scene-sk-table-{tbl['tableId']}"
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
                    "targetObjectId": "scene-sk-door-main",
                    "location": {"x": 52.0, "y": 0, "z": 14.0},
                    "dialogue": f"Konnichiwa ! Une table pour {party_size} personnes, s'il vous plaît.",
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
                    "dialogue": f"Irasshaimase ! Bienvenue à {tbl['name']}, voici nos suggestions Omakase.",
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
                    "dialogue": f"Oshibori chauds et eau filtrée déposés à {tbl['name']}.",
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
                    "dialogue": f"Arigatō ! Commande validée pour {tbl['name']} : {summary_str}.",
                    "tone": "PROFESSIONAL",
                    "metadata": {"tableId": tbl["tableId"], "summary": summary_str},
                })

                pos_coord = STATION_COORDS["pos-sk-main"]
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
                    "stationId": "pos-sk-main",
                    "targetObjectId": pos_coord["sceneObjectId"],
                    "location": {"x": pos_coord["x"], "y": 0, "z": pos_coord["z"]},
                    "dialogue": f"Transmission au comptoir Sushi, Tempura et Bar Saké pour {tbl['name']}.",
                    "tone": "FOCUSED",
                    "metadata": {"tableId": tbl["tableId"], "orderId": order_id},
                })

                # Drinks: Single-bottle Barman sequence
                bar_coord = STATION_COORDS["station-sk-bar"]
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
                    bev_dish_id = f"dish-sk-{date_str.replace('-', '')}-{dish_seq:04d}"
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
                        "stationId": "station-sk-bar",
                        "targetObjectId": bar_coord["sceneObjectId"],
                        "location": {"x": bar_coord["x"], "y": 0, "z": bar_coord["z"]},
                        "dialogue": f"Prise d'une seule bouteille : {s0['ingredientName']} ({bottle_unit_id}).",
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
                        "stationId": "station-sk-bar",
                        "targetObjectId": bar_coord["sceneObjectId"],
                        "location": {"x": bar_coord["x"], "y": 0, "z": bar_coord["z"]},
                        "dialogue": f"Service précis {bev['name']} ({s0['beforeQuantity']}{s0['unit']} -> {s0['remainingAfter']}{s0['unit']}).",
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
                        "stationId": "station-sk-bar",
                        "targetObjectId": bar_coord["sceneObjectId"],
                        "location": {"x": bar_coord["x"], "y": 0, "z": bar_coord["z"]},
                        "dialogue": f"Bouteille {bottle_unit_id} remise en cave avant tout autre service.",
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
                        "dialogue": f"Voici votre {bev['name']}, Kanpai !",
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
                passe_coord = STATION_COORDS["station-sk-passe"]
                storage_coord = STATION_COORDS["storage-sk-cold"]

                for f_idx, food in enumerate(food_items_chosen):
                    dish_seq += 1
                    dish_id = f"dish-sk-{date_str.replace('-', '')}-{dish_seq:04d}"
                    order_total += food["price"]
                    order_cogs += food["cost"]

                    if food["stationId"] == "station-sk-sushi":
                        cook = STAFF_ROSTER[1] if (order_seq % 2 == 1) else STAFF_ROSTER[2]
                    else:
                        cook = cook_by_station.get(food["stationId"], STAFF_ROSTER[1])
                    st_coord = STATION_COORDS[food["stationId"]]
                    t_open_storage = t_ticket + dt.timedelta(seconds=14 + f_idx * 35)

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
                                "stationId": "storage-sk-cold",
                                "targetObjectId": storage_coord["sceneObjectId"],
                                "location": {"x": storage_coord["x"], "y": 0, "z": storage_coord["z"]},
                                "dialogue": f"Sumimasen {contention['primaryActorName']}, je prends 30g sur le concombre Kyuri entamé après toi !",
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
                                "stationId": "storage-sk-cold",
                                "targetObjectId": storage_coord["sceneObjectId"],
                                "location": {"x": storage_coord["x"], "y": 0, "z": storage_coord["z"]},
                                "dialogue": f"Kyuri partagé récupéré ({s0['beforeQuantity']}{s0['unit']} -> {s0['remainingAfter']}{s0['unit']}), retour au poste !",
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
                            "stationId": "storage-sk-cold",
                            "targetObjectId": storage_coord["sceneObjectId"],
                            "location": {"x": storage_coord["x"], "y": 0, "z": storage_coord["z"]},
                            "dialogue": f"Prélèvement {s0['quantity']}{s0['unit']} sur {s0['ingredientName']} ({s0['beforeQuantity']}{s0['unit']} -> {s0['remainingAfter']}{s0['unit']}).",
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
                        "stationId": "storage-sk-cold",
                        "targetObjectId": storage_coord["sceneObjectId"],
                        "location": {"x": storage_coord["x"], "y": 0, "z": storage_coord["z"]},
                        "dialogue": f"Ouverture chambre froide poissons/légumes pour {food['name']}.",
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
                        "stationId": "storage-sk-cold",
                        "targetObjectId": storage_coord["sceneObjectId"],
                        "location": {"x": storage_coord["x"], "y": 0, "z": storage_coord["z"]},
                        "dialogue": "Chambre froide refermée.",
                        "tone": "NEUTRAL",
                        "metadata": {"dishId": dish_id},
                    })

                    t_cook_start = t_close_storage + dt.timedelta(seconds=15)
                    t_plated = t_cook_start + dt.timedelta(seconds=food["cookDurationSec"])
                    t_pickup = t_plated + dt.timedelta(seconds=rng.randint(25, 55))
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
                        "dialogue": f"Préparation minutieuse : {food['name']} pour {tbl['name']} !",
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
                        "stationId": "station-sk-passe",
                        "targetObjectId": passe_coord["sceneObjectId"],
                        "location": {"x": passe_coord["x"], "y": 0, "z": passe_coord["z"]},
                        "dialogue": f"Dressage terminé au passe : {food['name']} pour {tbl['name']} !",
                        "tone": "URGENT",
                        "metadata": {"dishId": dish_id, "itemName": food["name"], "tableId": tbl["tableId"], "stationId": "station-sk-passe"},
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
                        "stationId": "station-sk-passe",
                        "targetObjectId": passe_coord["sceneObjectId"],
                        "location": {"x": passe_coord["x"], "y": 0, "z": passe_coord["z"]},
                        "dialogue": f"Enlèvement au passe de {food['name']} pour {tbl['name']}.",
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
                        "dialogue": f"Itadakimasu ! Voici votre {food['name']} servi à {tbl['name']}.",
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
                    "dialogue": f"La dégustation à {tbl['name']} est-elle à votre goût ? Tout est parfait !",
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
                    "dialogue": f"Domo arigatō gozaimasu ! Addition réglée pour {tbl['name']}.",
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
                    "targetObjectId": "scene-sk-door-main",
                    "location": {"x": 52.0, "y": 0, "z": 14.0},
                    "dialogue": "Arigatō gozaimashita, à très bientôt chez Sakana-Tei !",
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
                    "dialogue": f"{tbl['name']} débarrassée et dressée pour les prochains convives.",
                    "tone": "EFFICIENT",
                    "metadata": {"orderId": order_id, "tableId": tbl["tableId"]},
                })

                plonge_coord = STATION_COORDS["station-sk-plonge"]
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
                    "stationId": "station-sk-plonge",
                    "targetObjectId": plonge_coord["sceneObjectId"],
                    "location": {"x": plonge_coord["x"], "y": 0, "z": plonge_coord["z"]},
                    "dialogue": f"Céramiques et bols laqués de {tbl['name']} lavés avec soin.",
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
                "entryId": f"acc-sk-rev-{date_str}",
                "businessId": BUSINESS_ID,
                "serviceDate": date_str,
                "timestamp": _iso(_make_dt(date_str, 23, 45, 0)),
                "type": "REVENUE",
                "category": "Ventes Sushi, Robata & Sakés",
                "amount": round(day_revenue, 2),
            },
            {
                "entryId": f"acc-sk-cogs-{date_str}",
                "businessId": BUSINESS_ID,
                "serviceDate": date_str,
                "timestamp": _iso(_make_dt(date_str, 23, 50, 0)),
                "type": "EXPENSE",
                "category": "Poissons Sashimi, Wagyu & Kyuri",
                "amount": -round(day_cogs, 2),
            },
            {
                "entryId": f"acc-sk-pay-{date_str}",
                "businessId": BUSINESS_ID,
                "serviceDate": date_str,
                "timestamp": _iso(_make_dt(date_str, 23, 55, 0)),
                "type": "EXPENSE",
                "category": "Salaires Brigade Sakana-Tei",
                "amount": -round(payroll_cost, 2),
            },
        ])

        all_reviews.append({
            "reviewId": f"rev-sk-{date_str}",
            "businessId": BUSINESS_ID,
            "serviceDate": date_str,
            "rating": 4.9,
            "author": "Client Vérifié",
            "comment": "Chirashi d'une fraîcheur absolue, Wagyu au binchotan et service du saké magistral !",
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
