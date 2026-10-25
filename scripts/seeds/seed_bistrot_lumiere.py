#!/usr/bin/env python3
"""
30-Day Full Operational & Physical Lineage Seed Generator for:
Bistrot Lumière (business-bistrot-lumiere / premises-bistrot-lumiere)
Dates: 2026-10-01 through 2026-10-31 (Europe/Paris local time, DST-aware)

Enforces:
1. Recipe -> Ingredient Grammage -> Discrete Physical StockUnit FIFO depletion
2. 150g Cucumber multi-cook contention (150g -> 120g -> 90g -> 60g -> 30g -> 0g)
3. Single-bottle Barman constraint (never > 1 bottle held/poured at a time)
4. Strict Causal Dining Lifecycle: guests NEVER leave before all dishes are
   cooked, plated, picked up at pass, delivered to table, and eaten for 16-24 min.
"""

from __future__ import annotations

import datetime as dt
from zoneinfo import ZoneInfo
import math
import random
from typing import Any, Dict, List, Optional, Tuple

try:
    from scripts.seeds.dialogue_simulator import build_event_dialogue  # type: ignore
except Exception:
    try:
        from seeds.dialogue_simulator import build_event_dialogue  # type: ignore
    except Exception:
        build_event_dialogue = None


BUSINESS_ID = "business-bistrot-lumiere"
PREMISES_ID = "premises-bistrot-lumiere"
PARIS_TZ = ZoneInfo("Europe/Paris")
FOCUS_DATE = "2026-10-24"

# Coordinates aligned with scripts/street_topology.py
STATION_COORDS: Dict[str, Dict[str, Any]] = {
    "storage-bl-cold": {
        "sceneObjectId": "scene-bl-storage-cold",
        "label": "Chambre Froide Positive",
        "x": 2.0,
        "z": -4.5,
    },
    "storage-bl-dry": {
        "sceneObjectId": "scene-bl-storage-dry",
        "label": "Réserve Sèche & Épicerie",
        "x": 2.0,
        "z": -1.2,
    },
    "station-bl-plonge": {
        "sceneObjectId": "scene-bl-station-plonge",
        "label": "Poste Plonge",
        "x": 4.8,
        "z": -4.5,
    },
    "station-bl-saladette": {
        "sceneObjectId": "scene-bl-station-saladette",
        "label": "Garde-Manger & Saladette",
        "x": 9.2,
        "z": -1.8,
    },
    "station-bl-friture": {
        "sceneObjectId": "scene-bl-station-friture",
        "label": "Poste Friture Double Bac",
        "x": 12.0,
        "z": -4.5,
    },
    "station-bl-piano": {
        "sceneObjectId": "scene-bl-station-piano",
        "label": "Piano de Cuisson 6 Feux",
        "x": 14.2,
        "z": -4.5,
    },
    "station-bl-passe": {
        "sceneObjectId": "scene-bl-station-passe",
        "label": "Passe Chauffant Cuisine",
        "x": 18.5,
        "z": 0.2,
    },
    "station-bl-bar": {
        "sceneObjectId": "scene-bl-station-bar",
        "label": "Comptoir Bar en Zinc",
        "x": 18.5,
        "z": 10.8,
    },
    "pos-bl-main": {
        "sceneObjectId": "scene-bl-pos-main",
        "label": "Terminal Caisse POS Principal",
        "x": 16.4,
        "z": 10.5,
    },
    "door-bl-main": {
        "sceneObjectId": "scene-bl-door-main",
        "label": "Entrée Principale Bistrot Lumière",
        "x": 10.0,
        "z": 14.0,
    },
}

TABLES_CONFIG: List[Dict[str, Any]] = [
    {"tableId": "bl-t1", "name": "Table 1", "zone": "SALLE", "capacity": 2, "x": 2.5, "z": 3.0},
    {"tableId": "bl-t2", "name": "Table 2", "zone": "SALLE", "capacity": 2, "x": 5.2, "z": 3.0},
    {"tableId": "bl-t3", "name": "Table 3", "zone": "SALLE", "capacity": 2, "x": 7.9, "z": 3.0},
    {"tableId": "bl-t4", "name": "Table 4", "zone": "SALLE", "capacity": 2, "x": 10.6, "z": 3.0},
    {"tableId": "bl-t5", "name": "Table 5", "zone": "SALLE", "capacity": 2, "x": 2.5, "z": 6.4},
    {"tableId": "bl-t6", "name": "Table 6", "zone": "SALLE", "capacity": 2, "x": 5.2, "z": 6.4},
    {"tableId": "bl-t7", "name": "Table 7", "zone": "SALLE", "capacity": 2, "x": 7.9, "z": 6.4},
    {"tableId": "bl-t8", "name": "Table 8", "zone": "SALLE", "capacity": 2, "x": 10.6, "z": 6.4},
    {"tableId": "bl-t9", "name": "Table 9", "zone": "SALLE", "capacity": 2, "x": 13.4, "z": 3.0},
    {"tableId": "bl-t10", "name": "Table 10", "zone": "SALLE", "capacity": 2, "x": 13.4, "z": 6.4},
    {"tableId": "bl-t11", "name": "Table 11", "zone": "SALLE", "capacity": 4, "x": 3.2, "z": 10.2},
    {"tableId": "bl-t12", "name": "Table 12", "zone": "SALLE", "capacity": 4, "x": 6.8, "z": 10.2},
    {"tableId": "bl-t13", "name": "Table 13", "zone": "SALLE", "capacity": 4, "x": 10.4, "z": 10.2},
    {"tableId": "bl-t14", "name": "Table 14", "zone": "SALLE", "capacity": 6, "x": 14.0, "z": 10.2},
    {"tableId": "bl-tr1", "name": "Terrasse 1", "zone": "TERRASSE", "capacity": 2, "x": 1.8, "z": 16.2},
    {"tableId": "bl-tr2", "name": "Terrasse 2", "zone": "TERRASSE", "capacity": 2, "x": 4.2, "z": 16.2},
    {"tableId": "bl-tr3", "name": "Terrasse 3", "zone": "TERRASSE", "capacity": 2, "x": 6.6, "z": 16.2},
    {"tableId": "bl-tr4", "name": "Terrasse 4", "zone": "TERRASSE", "capacity": 2, "x": 9.0, "z": 16.2},
    {"tableId": "bl-tr5", "name": "Terrasse 5", "zone": "TERRASSE", "capacity": 2, "x": 11.4, "z": 16.2},
    {"tableId": "bl-tr6", "name": "Terrasse 6", "zone": "TERRASSE", "capacity": 2, "x": 13.8, "z": 16.2},
    {"tableId": "bl-tr7", "name": "Terrasse 7", "zone": "TERRASSE", "capacity": 2, "x": 16.2, "z": 16.2},
    {"tableId": "bl-tr8", "name": "Terrasse 8", "zone": "TERRASSE", "capacity": 2, "x": 18.6, "z": 16.2},
]

STAFF_ROSTER: List[Dict[str, Any]] = [
    {
        "employeeId": "emp-lea",
        "agentId": "agent-emp-lea",
        "name": "Léa Fontaine",
        "role": "Directrice de Salle",
        "category": "MANAGER",
        "stationId": "pos-bl-main",
        "hourlyRate": 24.50,
    },
    {
        "employeeId": "emp-karim",
        "agentId": "agent-emp-karim",
        "name": "Karim Benali",
        "role": "Chef de Cuisine",
        "category": "KITCHEN",
        "stationId": "station-bl-piano",
        "hourlyRate": 26.00,
    },
    {
        "employeeId": "emp-sofia",
        "agentId": "agent-emp-sofia",
        "name": "Sofia Rossi",
        "role": "Second de Cuisine",
        "category": "KITCHEN",
        "stationId": "station-bl-saladette",
        "hourlyRate": 20.50,
    },
    {
        "employeeId": "emp-hugo",
        "agentId": "agent-emp-hugo",
        "name": "Hugo Lambert",
        "role": "Commis de Cuisine",
        "category": "KITCHEN",
        "stationId": "station-bl-friture",
        "hourlyRate": 15.50,
    },
    {
        "employeeId": "emp-mamadou",
        "agentId": "agent-emp-mamadou",
        "name": "Mamadou Diallo",
        "role": "Plongeur",
        "category": "KITCHEN",
        "stationId": "station-bl-plonge",
        "hourlyRate": 14.80,
    },
    {
        "employeeId": "emp-thomas",
        "agentId": "agent-emp-thomas",
        "name": "Thomas Girard",
        "role": "Chef de Rang",
        "category": "FLOOR",
        "stationId": "station-bl-passe",
        "hourlyRate": 17.50,
    },
    {
        "employeeId": "emp-chloe",
        "agentId": "agent-emp-chloe",
        "name": "Chloé Petit",
        "role": "Serveuse",
        "category": "FLOOR",
        "stationId": "station-bl-passe",
        "hourlyRate": 16.00,
    },
    {
        "employeeId": "emp-zoe",
        "agentId": "agent-emp-zoe",
        "name": "Zoé Chevalier",
        "role": "Serveuse",
        "category": "FLOOR",
        "stationId": "station-bl-passe",
        "hourlyRate": 16.00,
    },
    {
        "employeeId": "emp-nathan",
        "agentId": "agent-emp-nathan",
        "name": "Nathan Faure",
        "role": "Runner / Demi-Chef de Rang",
        "category": "FLOOR",
        "stationId": "station-bl-passe",
        "hourlyRate": 15.20,
    },
    {
        "employeeId": "emp-manon",
        "agentId": "agent-emp-manon",
        "name": "Manon Leroy",
        "role": "Cheffe Barman & Sommelière",
        "category": "BAR",
        "stationId": "station-bl-bar",
        "hourlyRate": 18.00,
    },
]

INGREDIENTS_CATALOG: Dict[str, Dict[str, Any]] = {
    "ing-concombre": {
        "ingredientId": "ing-concombre",
        "name": "Concombre Frais Bio (Pièce 150g)",
        "unit": "g",
        "packageSize": 150,
        "containerType": "whole_cucumber_150g",
        "storageObjectId": "storage-bl-cold",
        "sceneObjectId": "scene-bl-storage-cold",
        "shelfSlot": "Étagère 2 - Bac Maraîcher A",
        "dailyUnits": 18,
        "unitCost": 0.85,
        "supplierId": "sup-rungis-maraicher",
    },
    "ing-tomate": {
        "ingredientId": "ing-tomate",
        "name": "Tomates Grappe Plein Champ",
        "unit": "g",
        "packageSize": 600,
        "containerType": "crate_600g",
        "storageObjectId": "storage-bl-cold",
        "sceneObjectId": "scene-bl-storage-cold",
        "shelfSlot": "Étagère 2 - Bac Maraîcher B",
        "dailyUnits": 8,
        "unitCost": 2.90,
        "supplierId": "sup-rungis-maraicher",
    },
    "ing-salade-verte": {
        "ingredientId": "ing-salade-verte",
        "name": "Mesclun & Jeunes Pousses Bio",
        "unit": "g",
        "packageSize": 500,
        "containerType": "bag_500g",
        "storageObjectId": "storage-bl-cold",
        "sceneObjectId": "scene-bl-storage-cold",
        "shelfSlot": "Étagère 1 - Bac Verdure",
        "dailyUnits": 8,
        "unitCost": 3.40,
        "supplierId": "sup-rungis-maraicher",
    },
    "ing-oeuf": {
        "ingredientId": "ing-oeuf",
        "name": "Œufs Fermiers Bio Label Rouge",
        "unit": "pc",
        "packageSize": 30,
        "containerType": "tray_30pc",
        "storageObjectId": "storage-bl-cold",
        "sceneObjectId": "scene-bl-storage-cold",
        "shelfSlot": "Étagère 1 - Alvéoles Œufs",
        "dailyUnits": 5,
        "unitCost": 9.60,
        "supplierId": "sup-cremerie-isigny",
    },
    "ing-bavette": {
        "ingredientId": "ing-bavette",
        "name": "Aloyau & Bavette de Bœuf Charolais",
        "unit": "g",
        "packageSize": 1800,
        "containerType": "vacuum_pack_1800g",
        "storageObjectId": "storage-bl-cold",
        "sceneObjectId": "scene-bl-storage-cold",
        "shelfSlot": "Étagère 3 - Viandes Maturées",
        "dailyUnits": 7,
        "unitCost": 38.00,
        "supplierId": "sup-boucherie-charolaise",
    },
    "ing-cuisse-canard": {
        "ingredientId": "ing-cuisse-canard",
        "name": "Cuisses de Canard Confites du Sud-Ouest",
        "unit": "pc",
        "packageSize": 10,
        "containerType": "tin_10pc",
        "storageObjectId": "storage-bl-cold",
        "sceneObjectId": "scene-bl-storage-cold",
        "shelfSlot": "Étagère 3 - Volailles & Confits",
        "dailyUnits": 4,
        "unitCost": 34.00,
        "supplierId": "sup-boucherie-charolaise",
    },
    "ing-cabillaud": {
        "ingredientId": "ing-cabillaud",
        "name": "Dos de Cabillaud Sauvage de Ligne",
        "unit": "g",
        "packageSize": 1500,
        "containerType": "ice_tray_1500g",
        "storageObjectId": "storage-bl-cold",
        "sceneObjectId": "scene-bl-storage-cold",
        "shelfSlot": "Étagère 4 - Marée Fraîche",
        "dailyUnits": 4,
        "unitCost": 36.00,
        "supplierId": "sup-maree-bretonne",
    },
    "ing-beurre": {
        "ingredientId": "ing-beurre",
        "name": "Beurre de Baratte Demi-Sel AOP",
        "unit": "g",
        "packageSize": 500,
        "containerType": "block_500g",
        "storageObjectId": "storage-bl-cold",
        "sceneObjectId": "scene-bl-storage-cold",
        "shelfSlot": "Étagère 1 - Crèmerie",
        "dailyUnits": 6,
        "unitCost": 5.80,
        "supplierId": "sup-cremerie-isigny",
    },
    "ing-creme": {
        "ingredientId": "ing-creme",
        "name": "Crème Fraîche Épaisse d'Isigny AOP",
        "unit": "ml",
        "packageSize": 1000,
        "containerType": "tub_1000ml",
        "storageObjectId": "storage-bl-cold",
        "sceneObjectId": "scene-bl-storage-cold",
        "shelfSlot": "Étagère 1 - Crèmerie",
        "dailyUnits": 5,
        "unitCost": 6.40,
        "supplierId": "sup-cremerie-isigny",
    },
    "ing-comte": {
        "ingredientId": "ing-comte",
        "name": "Comté AOP Affiné 18 Mois",
        "unit": "g",
        "packageSize": 1000,
        "containerType": "wheel_cut_1kg",
        "storageObjectId": "storage-bl-cold",
        "sceneObjectId": "scene-bl-storage-cold",
        "shelfSlot": "Étagère 1 - Fromages",
        "dailyUnits": 3,
        "unitCost": 22.00,
        "supplierId": "sup-cremerie-isigny",
    },
    "ing-pomme-de-terre": {
        "ingredientId": "ing-pomme-de-terre",
        "name": "Pommes de Terre Bintje Calibre Frites",
        "unit": "g",
        "packageSize": 2500,
        "containerType": "sack_2500g",
        "storageObjectId": "storage-bl-dry",
        "sceneObjectId": "scene-bl-storage-dry",
        "shelfSlot": "Rack Sec 1 - Tubercules",
        "dailyUnits": 6,
        "unitCost": 4.50,
        "supplierId": "sup-rungis-maraicher",
    },
    "ing-oignon": {
        "ingredientId": "ing-oignon",
        "name": "Oignons Rosés de Roscoff AOP",
        "unit": "g",
        "packageSize": 1500,
        "containerType": "net_1500g",
        "storageObjectId": "storage-bl-dry",
        "sceneObjectId": "scene-bl-storage-dry",
        "shelfSlot": "Rack Sec 1 - Alliacés",
        "dailyUnits": 3,
        "unitCost": 3.80,
        "supplierId": "sup-rungis-maraicher",
    },
    "ing-chocolat-noir": {
        "ingredientId": "ing-chocolat-noir",
        "name": "Chocolat Noir Grand Cru Guanaja 70%",
        "unit": "g",
        "packageSize": 1000,
        "containerType": "bag_pistoles_1kg",
        "storageObjectId": "storage-bl-dry",
        "sceneObjectId": "scene-bl-storage-dry",
        "shelfSlot": "Rack Sec 2 - Pâtisserie",
        "dailyUnits": 3,
        "unitCost": 18.50,
        "supplierId": "sup-epicerie-fine",
    },
    "ing-vin-rouge-bordeaux": {
        "ingredientId": "ing-vin-rouge-bordeaux",
        "name": "Bouteille Château Haut-Médoc AOC 75cl",
        "unit": "ml",
        "packageSize": 750,
        "containerType": "bottle_750ml",
        "storageObjectId": "station-bl-bar",
        "sceneObjectId": "scene-bl-station-bar",
        "shelfSlot": "Casier Cave Rouge - Rang A",
        "dailyUnits": 10,
        "unitCost": 11.50,
        "supplierId": "sup-vignerons-associes",
    },
    "ing-vin-blanc-chablis": {
        "ingredientId": "ing-vin-blanc-chablis",
        "name": "Bouteille Chablis 1er Cru Vaillons 75cl",
        "unit": "ml",
        "packageSize": 750,
        "containerType": "bottle_750ml",
        "storageObjectId": "station-bl-bar",
        "sceneObjectId": "scene-bl-station-bar",
        "shelfSlot": "Frigo Cave Blanc - Rang B",
        "dailyUnits": 8,
        "unitCost": 14.80,
        "supplierId": "sup-vignerons-associes",
    },
    "ing-cafe-grain": {
        "ingredientId": "ing-cafe-grain",
        "name": "Café en Grains Arabica Torréfaction Artisanale",
        "unit": "g",
        "packageSize": 1000,
        "containerType": "tin_1kg",
        "storageObjectId": "station-bl-bar",
        "sceneObjectId": "scene-bl-station-bar",
        "shelfSlot": "Trémie Moulin Expresso",
        "dailyUnits": 2,
        "unitCost": 21.00,
        "supplierId": "sup-epicerie-fine",
    },
    "ing-eau-minerale": {
        "ingredientId": "ing-eau-minerale",
        "name": "Bouteille Eau Minérale Gazeuse 100cl",
        "unit": "ml",
        "packageSize": 1000,
        "containerType": "bottle_1000ml",
        "storageObjectId": "station-bl-bar",
        "sceneObjectId": "scene-bl-station-bar",
        "shelfSlot": "Banque Réfrigérée Bar",
        "dailyUnits": 12,
        "unitCost": 1.40,
        "supplierId": "sup-vignerons-associes",
    },
}

MENU_RECIPES: List[Dict[str, Any]] = [
    {
        "itemId": "item-salade-concombre",
        "name": "Salade de Concombre & Herbes Fraîches",
        "category": "Entrées",
        "price": 9.50,
        "cost": 2.10,
        "stationId": "station-bl-saladette",
        "cookDurationSec": 210,
        "isBeverage": False,
        "recipe": [
            {"ingredientId": "ing-concombre", "quantity": 30, "unit": "g"},
            {"ingredientId": "ing-tomate", "quantity": 40, "unit": "g"},
            {"ingredientId": "ing-salade-verte", "quantity": 35, "unit": "g"},
        ],
    },
    {
        "itemId": "item-oeuf-mayo",
        "name": "Œuf Mayonnaise Bio & Pickles de Concombre",
        "category": "Entrées",
        "price": 8.50,
        "cost": 1.85,
        "stationId": "station-bl-saladette",
        "cookDurationSec": 195,
        "isBeverage": False,
        "recipe": [
            {"ingredientId": "ing-oeuf", "quantity": 2, "unit": "pc"},
            {"ingredientId": "ing-concombre", "quantity": 30, "unit": "g"},
            {"ingredientId": "ing-salade-verte", "quantity": 25, "unit": "g"},
        ],
    },
    {
        "itemId": "item-soupe-oignon",
        "name": "Soupe à l'Oignon Gratinée au Comté",
        "category": "Entrées",
        "price": 11.50,
        "cost": 2.80,
        "stationId": "station-bl-piano",
        "cookDurationSec": 270,
        "isBeverage": False,
        "recipe": [
            {"ingredientId": "ing-oignon", "quantity": 120, "unit": "g"},
            {"ingredientId": "ing-comte", "quantity": 45, "unit": "g"},
            {"ingredientId": "ing-beurre", "quantity": 20, "unit": "g"},
        ],
    },
    {
        "itemId": "item-entrecote-frites",
        "name": "Entrecôte Charolaise Beurre Maître d'Hôtel & Frites",
        "category": "Plats",
        "price": 26.50,
        "cost": 8.80,
        "stationId": "station-bl-piano",
        "cookDurationSec": 360,
        "isBeverage": False,
        "recipe": [
            {"ingredientId": "ing-bavette", "quantity": 220, "unit": "g"},
            {"ingredientId": "ing-pomme-de-terre", "quantity": 180, "unit": "g"},
            {"ingredientId": "ing-beurre", "quantity": 25, "unit": "g"},
        ],
    },
    {
        "itemId": "item-tartare-boeuf",
        "name": "Tartare de Bœuf au Couteau & Salade Croquante",
        "category": "Plats",
        "price": 21.00,
        "cost": 6.20,
        "stationId": "station-bl-saladette",
        "cookDurationSec": 260,
        "isBeverage": False,
        "recipe": [
            {"ingredientId": "ing-bavette", "quantity": 180, "unit": "g"},
            {"ingredientId": "ing-oeuf", "quantity": 1, "unit": "pc"},
            {"ingredientId": "ing-concombre", "quantity": 30, "unit": "g"},
            {"ingredientId": "ing-pomme-de-terre", "quantity": 150, "unit": "g"},
        ],
    },
    {
        "itemId": "item-confit-canard",
        "name": "Confit de Canard Fermier & Pommes Sarladaises",
        "category": "Plats",
        "price": 23.00,
        "cost": 6.90,
        "stationId": "station-bl-piano",
        "cookDurationSec": 340,
        "isBeverage": False,
        "recipe": [
            {"ingredientId": "ing-cuisse-canard", "quantity": 1, "unit": "pc"},
            {"ingredientId": "ing-pomme-de-terre", "quantity": 170, "unit": "g"},
            {"ingredientId": "ing-salade-verte", "quantity": 30, "unit": "g"},
        ],
    },
    {
        "itemId": "item-cabillaud-roti",
        "name": "Dos de Cabillaud Rôti, Beurre Blanc & Concombre Étuve",
        "category": "Plats",
        "price": 24.50,
        "cost": 7.50,
        "stationId": "station-bl-piano",
        "cookDurationSec": 330,
        "isBeverage": False,
        "recipe": [
            {"ingredientId": "ing-cabillaud", "quantity": 170, "unit": "g"},
            {"ingredientId": "ing-beurre", "quantity": 30, "unit": "g"},
            {"ingredientId": "ing-concombre", "quantity": 30, "unit": "g"},
        ],
    },
    {
        "itemId": "item-frites-maison",
        "name": "Poêlée de Frites Maison Double Bain",
        "category": "Plats",
        "price": 7.00,
        "cost": 1.40,
        "stationId": "station-bl-friture",
        "cookDurationSec": 230,
        "isBeverage": False,
        "recipe": [
            {"ingredientId": "ing-pomme-de-terre", "quantity": 220, "unit": "g"},
            {"ingredientId": "ing-concombre", "quantity": 30, "unit": "g"},
        ],
    },
    {
        "itemId": "item-creme-brulee",
        "name": "Crème Brûlée à la Vanille Bourbon",
        "category": "Desserts",
        "price": 9.50,
        "cost": 2.10,
        "stationId": "station-bl-saladette",
        "cookDurationSec": 180,
        "isBeverage": False,
        "recipe": [
            {"ingredientId": "ing-creme", "quantity": 120, "unit": "ml"},
            {"ingredientId": "ing-oeuf", "quantity": 2, "unit": "pc"},
        ],
    },
    {
        "itemId": "item-mousse-chocolat",
        "name": "Mousse au Chocolat Noir Grand Cru",
        "category": "Desserts",
        "price": 9.00,
        "cost": 2.00,
        "stationId": "station-bl-saladette",
        "cookDurationSec": 165,
        "isBeverage": False,
        "recipe": [
            {"ingredientId": "ing-chocolat-noir", "quantity": 75, "unit": "g"},
            {"ingredientId": "ing-oeuf", "quantity": 1, "unit": "pc"},
        ],
    },
    {
        "itemId": "item-verre-bordeaux",
        "name": "Verre de Haut-Médoc AOC (15cl)",
        "category": "Vins",
        "price": 8.00,
        "cost": 2.20,
        "stationId": "station-bl-bar",
        "cookDurationSec": 45,
        "isBeverage": True,
        "recipe": [
            {"ingredientId": "ing-vin-rouge-bordeaux", "quantity": 150, "unit": "ml"},
        ],
    },
    {
        "itemId": "item-verre-chablis",
        "name": "Verre de Chablis 1er Cru (15cl)",
        "category": "Vins",
        "price": 9.50,
        "cost": 2.80,
        "stationId": "station-bl-bar",
        "cookDurationSec": 45,
        "isBeverage": True,
        "recipe": [
            {"ingredientId": "ing-vin-blanc-chablis", "quantity": 150, "unit": "ml"},
        ],
    },
    {
        "itemId": "item-cafe-expresso",
        "name": "Café Expresso Grand Cru",
        "category": "Boissons",
        "price": 3.20,
        "cost": 0.45,
        "stationId": "station-bl-bar",
        "cookDurationSec": 35,
        "isBeverage": True,
        "recipe": [
            {"ingredientId": "ing-cafe-grain", "quantity": 18, "unit": "g"},
        ],
    },
    {
        "itemId": "item-eau-minerale",
        "name": "Eau Minérale Gazeuse (50cl)",
        "category": "Boissons",
        "price": 5.50,
        "cost": 1.10,
        "stationId": "station-bl-bar",
        "cookDurationSec": 30,
        "isBeverage": True,
        "recipe": [
            {"ingredientId": "ing-eau-minerale", "quantity": 500, "unit": "ml"},
        ],
    },
]

RECIPES_BY_ID = {r["itemId"]: r for r in MENU_RECIPES}

FRENCH_FIRST_NAMES = [
    "Camille", "Lucas", "Emma", "Louis", "Jade", "Gabriel", "Louise", "Raphaël",
    "Alice", "Arthur", "Chloé", "Jules", "Lina", "Adam", "Mila", "Maël",
    "Léa", "Paul", "Manon", "Victor", "Juliette", "Antoine", "Clara", "Maxime",
]
FRENCH_LAST_NAMES = [
    "Martin", "Bernard", "Thomas", "Robert", "Richard", "Dubois", "Moreau",
    "Laurent", "Simon", "Michel", "Lefebvre", "Leroy", "Roux", "David",
    "Bertrand", "Morel", "Fournier", "Girard", "Bonnet", "Dupont", "Lambert",
]


def _iso(ts_dt: dt.datetime) -> str:
    return ts_dt.astimezone(PARIS_TZ).isoformat(timespec="seconds")


def _make_dt(date_str: str, hour: int, minute: int, second: int = 0) -> dt.datetime:
    y, m, d = [int(p) for p in date_str.split("-")]
    return dt.datetime(y, m, d, hour, minute, second, tzinfo=PARIS_TZ)


def _fallback_dialogue(event_type: str, speaker_name: str, context: Dict[str, Any]) -> Dict[str, Any]:
    if build_event_dialogue is not None:
        try:
            res = build_event_dialogue(event_type, speaker_name, context)
            if isinstance(res, dict) and res.get("dialogue"):
                return res
        except Exception:
            pass
    table_name = context.get("tableName", "la table")
    dish_name = context.get("dishName", "le plat")
    ing_name = context.get("ingredientName", "l'ingrédient")
    rem = context.get("remainingAfter", "")
    before = context.get("beforeQuantity", "")
    unit = context.get("unit", "g")
    templates = {
        "CUSTOMER_ARRIVED": (f"Bonjour ! Une table pour {context.get('partySize', 2)} personnes, s'il vous plaît.", "POLITE"),
        "CUSTOMER_SEATED": (f"Installez-vous confortablement à {table_name}, voici la carte du jour.", "WARM"),
        "WATER_AND_BREAD_SERVED": (f"Je vous dépose la carafe d'eau fraîche et le pain au levain pour {table_name}.", "ATTENTIVE"),
        "ORDER_TAKEN_AT_TABLE": (f"C'est bien noté pour {table_name} : {context.get('summary', dish_name)}.", "PROFESSIONAL"),
        "ORDER_ENTERED_AT_POS": (f"Envoi ticket cuisine et bar sur le POS pour {table_name}.", "FOCUSED"),
        "OPEN_STORAGE_DOOR": (f"J'ouvre la réserve pour prélever {ing_name}.", "BRISK"),
        "RESOURCE_CONTENTION_WAIT": (
            f"Pardon {context.get('otherActorName', 'collègue')}, je prends juste 30g sur le concombre entamé après toi !",
            "COLLABORATIVE",
        ),
        "INGREDIENT_CONTENTION_RESOLVED": (
            f"Concombre partagé récupéré ({before}{unit} -> {rem}{unit} restants), je file en poste !",
            "RELIEVED",
        ),
        "STOCK_UNIT_DEPLETED": (
            f"Prélèvement de {context.get('deducted', 30)}{unit} sur {ing_name} ({before}{unit} -> {rem}{unit}).",
            "PRECISE",
        ),
        "BARMAN_BOTTLE_PICKED": (
            f"Prise en main d'une seule bouteille : {ing_name} ({context.get('unitId', '')}).",
            "FOCUSED",
        ),
        "BARMAN_DRINK_POURED": (
            f"Service au verre : {dish_name} ({before}{unit} -> {rem}{unit} dans la bouteille).",
            "SKILLED",
        ),
        "BARMAN_BOTTLE_RETURNED": (
            f"Bouteille {context.get('unitId', '')} reposée au casier avant la suivante.",
            "METHODICAL",
        ),
        "COOKING_STARTED": (f"Ça marche en cuisson : {dish_name} pour {table_name} !", "ENERGETIC"),
        "DISH_PLATED_AT_PASS": (f"Chaud devant au passe ! {dish_name} dressé pour {table_name} !", "URGENT"),
        "ORDER_PICKED_UP_FROM_PASS": (f"Service ! J'enlève {dish_name} au passe pour {table_name}.", "BRISK"),
        "ORDER_DELIVERED_TO_TABLE": (f"Et voici votre {dish_name}, bon appétit à {table_name} !", "WARM"),
        "GUEST_DINING_CHECKIN": (f"Tout se passe à votre goût à {table_name} ? C'est délicieux, merci !", "HAPPY"),
        "PAYMENT_COMPLETED": (f"Merci infiniment pour votre visite à {table_name}, règlement validé !", "GRATEFUL"),
        "CUSTOMER_DEPARTED": (f"Au revoir et à très bientôt au Bistrot Lumière !", "CHEERFUL"),
        "TABLE_CLEARED": (f"{table_name} débarrassée et redressée à blanc.", "EFFICIENT"),
    }
    text, tone = templates.get(event_type, (f"{speaker_name} exécute {event_type}.", "NEUTRAL"))
    return {"dialogue": text, "tone": tone, "language": "fr"}


def generate_bistrot_lumiere_month(
    start_date: str = "2026-10-01",
    days: int = 31,
) -> Dict[str, Any]:
    """Generates full month dataset for Bistrot Lumière."""
    rng = random.Random(2025061401)

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
        "station-bl-piano": STAFF_ROSTER[1],      # Karim Benali
        "station-bl-saladette": STAFF_ROSTER[2],  # Sofia Rossi
        "station-bl-friture": STAFF_ROSTER[3],    # Hugo Lambert
    }
    floor_waiters = [STAFF_ROSTER[5], STAFF_ROSTER[6], STAFF_ROSTER[7], STAFF_ROSTER[8]]
    barman = STAFF_ROSTER[9]   # Manon Leroy
    plongeur = STAFF_ROSTER[4] # Mamadou Diallo
    manager = STAFF_ROSTER[0]  # Léa Fontaine

    start_dt = dt.date.fromisoformat(start_date)

    for day_idx in range(days):
        cur_date = start_dt + dt.timedelta(days=day_idx)
        date_str = cur_date.isoformat()
        is_weekend = cur_date.weekday() >= 4
        is_focus_day = (date_str == FOCUS_DATE)

        # 1. Create physical StockUnits for the day (FIFO shelves)
        day_units_by_ing: Dict[str, List[Dict[str, Any]]] = {}
        morning_delivery_dt = _make_dt(date_str, 8, 30, 0)

        for ing_id, spec in INGREDIENTS_CATALOG.items():
            units_list: List[Dict[str, Any]] = []
            count = spec["dailyUnits"] + (4 if is_weekend else 0)
            for u_idx in range(1, count + 1):
                unit_id = f"unit-bl-{ing_id.replace('ing-', '')}-{date_str.replace('-', '')}-{u_idx:02d}"
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

            lot_id = f"lot-bl-{ing_id.replace('ing-', '')}-{date_str.replace('-', '')}"
            all_inventory_lots.append({
                "lotId": lot_id,
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

        # Helper to deduct ingredient FIFO from physical StockUnits
        # Also tracks cold-storage access timestamps per cook to detect contention!
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

            # Check if another cook accessed the same ingredient or same storage
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
                    "contentionId": f"cont-bl-{date_str.replace('-', '')}-{len(all_contention_logs) + 1:04d}",
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
                    "waitDurationSeconds": round(max(4.0, 18.0 - min(delta_s, 30.0) * 0.3), 1),
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
                if after_q <= 0:
                    unit_doc["status"] = "CONSUMED"
                    unit_doc["exhaustedAt"] = _iso(access_dt)
                else:
                    unit_doc["status"] = "PARTIAL"

                slice_entry = {
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
                }
                unit_doc["depletionHistory"].append(slice_entry)
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
                    "movementId": f"mov-bl-{date_str.replace('-', '')}-{len(all_inventory_movements) + 1:05d}",
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

            # If shelf ran out, auto-spawn an emergency reserve unit so lineage never breaks
            if rem_to_take > 0:
                u_idx = len(units) + 1
                unit_id = f"unit-bl-{ing_id.replace('ing-', '')}-{date_str.replace('-', '')}-{u_idx:02d}"
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

        # 2. Generate Staff Shifts & Clock-in/out Events
        for staff in STAFF_ROSTER:
            shift_id = f"shift-bl-{staff['employeeId']}-{date_str}"
            clock_in_dt = _make_dt(date_str, 10, rng.randint(15, 45), rng.randint(0, 50))
            clock_out_dt = _make_dt(date_str, 23, rng.randint(5, 35), rng.randint(0, 50))
            st_coord = STATION_COORDS.get(staff["stationId"], STATION_COORDS["pos-bl-main"])
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
                "eventId": f"evt-bl-clockin-{staff['employeeId']}-{date_str}",
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
                "dialogue": f"Bonjour l'équipe ! {staff['name']} en poste sur {st_coord['label']}.",
                "tone": "ENERGETIC",
                "metadata": {"shiftId": shift_id, "stationId": staff["stationId"]},
            })
            all_events.append({
                "eventId": f"evt-bl-clockout-{staff['employeeId']}-{date_str}",
                "businessId": BUSINESS_ID,
                "premisesId": PREMISES_ID,
                "serviceDate": date_str,
                "timestamp": _iso(clock_out_dt),
                "type": "STAFF_CLOCK_OUT",
                "actorId": staff["agentId"],
                "actorName": staff["name"],
                "actorRole": staff["role"],
                "stationId": staff["stationId"],
                "targetObjectId": "scene-bl-door-main",
                "location": {"x": 10.0, "y": 0, "z": 14.0},
                "dialogue": f"Fin de service pour {staff['name']}, à demain tout le monde !",
                "tone": "RELIEVED",
                "metadata": {"shiftId": shift_id},
            })

        # 3. Schedule Lunch & Dinner Seatings
        # Ensure intense activity between 12:15 and 13:15 (especially on FOCUS_DATE at 12:45:00!)
        barman_free_dt = _make_dt(date_str, 11, 30, 0)
        day_revenue = 0.0
        day_cogs = 0.0
        day_covers = 0
        day_orders_count = 0

        # Build waves of table seatings:
        # Wave 1 (Lunch Peak 1, seated across 12:12 - 12:36 so at 12:45 they are actively eating/being served/cooking!)
        # Wave 2 (Lunch Peak 2, seated across 13:10 - 13:35)
        # Wave 3 (Dinner Peak 1, seated across 19:20 - 19:55)
        # Wave 4 (Dinner Peak 2, seated across 20:50 - 21:25)
        waves = [
            ("LUNCH_1", 12, 12, 18 if is_focus_day else (14 if is_weekend else 11)),
            ("LUNCH_2", 13, 12, 10 if is_weekend else 7),
            ("DINNER_1", 19, 20, 16 if is_weekend else 12),
            ("DINNER_2", 20, 50, 12 if is_weekend else 8),
        ]

        order_seq = 0
        dish_seq = 0

        for wave_name, base_h, base_m, num_tables in waves:
            selected_tables = TABLES_CONFIG[: min(num_tables, len(TABLES_CONFIG))]
            for t_idx, tbl in enumerate(selected_tables):
                order_seq += 1
                order_id = f"ord-bl-{date_str.replace('-', '')}-{order_seq:03d}"
                waiter = floor_waiters[t_idx % len(floor_waiters)]
                party_size = min(tbl["capacity"], rng.choice([2, 2, 2, 3, 4]))
                day_covers += party_size
                day_orders_count += 1

                # Deterministic staggered arrival so at 12:45:00 on FOCUS_DATE we have:
                # - Tables seated at 12:15-12:24 currently eating served dishes on table
                # - Tables seated at 12:26-12:34 with dishes at the pass or being delivered right at 12:44-12:46
                # - Tables seated at 12:35-12:40 with cooks fetching cucumber (150g->120g->90g) at 12:43-12:45 & cooking!
                if wave_name == "LUNCH_1":
                    offset_sec = t_idx * 85 + rng.randint(0, 18)
                else:
                    offset_sec = t_idx * 110 + rng.randint(0, 45)

                t_arrive = _make_dt(date_str, base_h, base_m, 0) + dt.timedelta(seconds=offset_sec)
                t_seat = t_arrive + dt.timedelta(seconds=rng.randint(25, 45))
                t_water = t_seat + dt.timedelta(seconds=rng.randint(35, 65))
                t_order = t_water + dt.timedelta(seconds=rng.randint(90, 150))
                t_pos = t_order + dt.timedelta(seconds=rng.randint(30, 55))
                t_ticket = t_pos + dt.timedelta(seconds=5)

                # Build guests for this party
                guests: List[Dict[str, Any]] = []
                for g_i in range(party_size):
                    g_first = rng.choice(FRENCH_FIRST_NAMES)
                    g_last = rng.choice(FRENCH_LAST_NAMES)
                    g_id = f"agent-cust-bl-{date_str.replace('-', '')}-{order_seq:03d}-{g_i + 1}"
                    guests.append({
                        "agentId": g_id,
                        "name": f"{g_first} {g_last}",
                        "seatIndex": g_i,
                    })
                lead_guest = guests[0]

                # Select menu items for this table:
                # Ensure high cucumber dish selection so 150g->120g->90g happens continuously
                food_items_chosen: List[Dict[str, Any]] = []
                drink_items_chosen: List[Dict[str, Any]] = []

                if t_idx % 2 == 0:
                    food_items_chosen.append(RECIPES_BY_ID["item-salade-concombre"])
                else:
                    food_items_chosen.append(RECIPES_BY_ID["item-oeuf-mayo"])

                main_choices = [
                    RECIPES_BY_ID["item-entrecote-frites"],
                    RECIPES_BY_ID["item-tartare-boeuf"],
                    RECIPES_BY_ID["item-confit-canard"],
                    RECIPES_BY_ID["item-cabillaud-roti"],
                ]
                for g_i in range(party_size):
                    food_items_chosen.append(main_choices[(t_idx + g_i) % len(main_choices)])

                if party_size >= 2:
                    food_items_chosen.append(
                        RECIPES_BY_ID["item-creme-brulee" if t_idx % 2 == 0 else "item-mousse-chocolat"]
                    )

                drink_items_chosen.append(
                    RECIPES_BY_ID["item-verre-bordeaux" if t_idx % 2 == 0 else "item-verre-chablis"]
                )
                drink_items_chosen.append(RECIPES_BY_ID["item-eau-minerale"])

                table_scene_id = f"scene-bl-table-{tbl['tableId']}"
                table_loc = {"x": tbl["x"], "y": 0, "z": tbl["z"]}

                # Emit Arrival, Seating, Water, Order Taken, POS Entry
                dlg_arr = _fallback_dialogue("CUSTOMER_ARRIVED", lead_guest["name"], {"partySize": party_size, "tableName": tbl["name"]})
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
                    "targetObjectId": "scene-bl-door-main",
                    "location": {"x": 10.0, "y": 0, "z": 14.0},
                    "dialogue": dlg_arr["dialogue"],
                    "tone": dlg_arr["tone"],
                    "metadata": {
                        "partySize": party_size,
                        "tableId": tbl["tableId"],
                        "tableName": tbl["name"],
                        "guests": guests,
                    },
                })

                dlg_seat = _fallback_dialogue("CUSTOMER_SEATED", waiter["name"], {"tableName": tbl["name"], "partySize": party_size})
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
                    "dialogue": dlg_seat["dialogue"],
                    "tone": dlg_seat["tone"],
                    "metadata": {
                        "partySize": party_size,
                        "tableId": tbl["tableId"],
                        "tableName": tbl["name"],
                        "waiterId": waiter["agentId"],
                        "guests": guests,
                    },
                })

                dlg_water = _fallback_dialogue("WATER_AND_BREAD_SERVED", waiter["name"], {"tableName": tbl["name"]})
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
                    "dialogue": dlg_water["dialogue"],
                    "tone": dlg_water["tone"],
                    "metadata": {"tableId": tbl["tableId"], "tableName": tbl["name"]},
                })

                order_summary_str = ", ".join(it["name"] for it in (food_items_chosen[:3] + drink_items_chosen[:1]))
                dlg_take = _fallback_dialogue("ORDER_TAKEN_AT_TABLE", waiter["name"], {"tableName": tbl["name"], "summary": order_summary_str})
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
                    "dialogue": dlg_take["dialogue"],
                    "tone": dlg_take["tone"],
                    "metadata": {"tableId": tbl["tableId"], "summary": order_summary_str},
                })

                pos_coord = STATION_COORDS["pos-bl-main"]
                dlg_pos = _fallback_dialogue("ORDER_ENTERED_AT_POS", waiter["name"], {"tableName": tbl["name"]})
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
                    "stationId": "pos-bl-main",
                    "targetObjectId": pos_coord["sceneObjectId"],
                    "location": {"x": pos_coord["x"], "y": 0, "z": pos_coord["z"]},
                    "dialogue": dlg_pos["dialogue"],
                    "tone": dlg_pos["tone"],
                    "metadata": {"tableId": tbl["tableId"], "orderId": order_id},
                })

                # 4. Process Drinks strictly ONE BOTTLE AT A TIME by Barman Manon Leroy
                bar_coord = STATION_COORDS["station-bl-bar"]
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
                    bev_dish_id = f"dish-bl-{date_str.replace('-', '')}-{dish_seq:04d}"
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
                        "stationId": "station-bl-bar",
                        "targetObjectId": bar_coord["sceneObjectId"],
                        "location": {"x": bar_coord["x"], "y": 0, "z": bar_coord["z"]},
                        "dialogue": _fallback_dialogue(
                            "BARMAN_BOTTLE_PICKED",
                            barman["name"],
                            {"ingredientName": s0["ingredientName"], "unitId": bottle_unit_id},
                        )["dialogue"],
                        "tone": "FOCUSED",
                        "metadata": {
                            "unitId": bottle_unit_id,
                            "heldBottleIds": [bottle_unit_id],
                            "heldBottleCount": 1,
                            "singleBottleRuleEnforced": True,
                            "ingredientId": bev_ing["ingredientId"],
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
                        "stationId": "station-bl-bar",
                        "targetObjectId": bar_coord["sceneObjectId"],
                        "location": {"x": bar_coord["x"], "y": 0, "z": bar_coord["z"]},
                        "dialogue": _fallback_dialogue(
                            "BARMAN_DRINK_POURED",
                            barman["name"],
                            {
                                "dishName": bev["name"],
                                "beforeQuantity": s0["beforeQuantity"],
                                "remainingAfter": s0["remainingAfter"],
                                "unit": s0["unit"],
                            },
                        )["dialogue"],
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
                        "stationId": "station-bl-bar",
                        "targetObjectId": bar_coord["sceneObjectId"],
                        "location": {"x": bar_coord["x"], "y": 0, "z": bar_coord["z"]},
                        "dialogue": _fallback_dialogue(
                            "BARMAN_BOTTLE_RETURNED", barman["name"], {"unitId": bottle_unit_id}
                        )["dialogue"],
                        "tone": "METHODICAL",
                        "metadata": {
                            "unitId": bottle_unit_id,
                            "heldBottleIds": [],
                            "heldBottleCount": 0,
                        },
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
                        "dialogue": f"Voici votre {bev['name']} fraîchement servi au verre !",
                        "tone": "WARM",
                        "metadata": {
                            "dishId": bev_dish_id,
                            "itemName": bev["name"],
                            "sourceBottleUnitId": bottle_unit_id,
                        },
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

                # 5. Process Food Items (Storage Fetch -> Contention -> Cooking -> Pass -> Delivery)
                last_food_delivered_dt = t_ticket + dt.timedelta(seconds=300)
                passe_coord = STATION_COORDS["station-bl-passe"]

                for f_idx, food in enumerate(food_items_chosen):
                    dish_seq += 1
                    dish_id = f"dish-bl-{date_str.replace('-', '')}-{dish_seq:04d}"
                    order_total += food["price"]
                    order_cogs += food["cost"]

                    if food["stationId"] == "station-bl-saladette":
                        cook = STAFF_ROSTER[2] if (order_seq % 2 == 1) else STAFF_ROSTER[3]
                    else:
                        cook = cook_by_station.get(food["stationId"], STAFF_ROSTER[1])
                    st_coord = STATION_COORDS[food["stationId"]]

                    # Course stagger so Entrées cook first, Plats right after
                    course_delay_s = 15 + f_idx * 38
                    t_open_storage = t_ticket + dt.timedelta(seconds=course_delay_s)

                    dish_slices: List[Dict[str, Any]] = []
                    first_storage_coord = STATION_COORDS["storage-bl-cold"]

                    for r_ing in food["recipe"]:
                        ing_spec = INGREDIENTS_CATALOG[r_ing["ingredientId"]]
                        storage_coord = STATION_COORDS[ing_spec["storageObjectId"]]
                        first_storage_coord = storage_coord

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
                                "stationId": ing_spec["storageObjectId"],
                                "targetObjectId": storage_coord["sceneObjectId"],
                                "location": {"x": storage_coord["x"], "y": 0, "z": storage_coord["z"]},
                                "dialogue": _fallback_dialogue(
                                    "RESOURCE_CONTENTION_WAIT",
                                    cook["name"],
                                    {"otherActorName": contention["primaryActorName"]},
                                )["dialogue"],
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
                                "stationId": ing_spec["storageObjectId"],
                                "targetObjectId": storage_coord["sceneObjectId"],
                                "location": {"x": storage_coord["x"], "y": 0, "z": storage_coord["z"]},
                                "dialogue": _fallback_dialogue(
                                    "INGREDIENT_CONTENTION_RESOLVED",
                                    cook["name"],
                                    {
                                        "beforeQuantity": s0["beforeQuantity"],
                                        "remainingAfter": s0["remainingAfter"],
                                        "unit": s0["unit"],
                                    },
                                )["dialogue"],
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
                            "stationId": ing_spec["storageObjectId"],
                            "targetObjectId": storage_coord["sceneObjectId"],
                            "location": {"x": storage_coord["x"], "y": 0, "z": storage_coord["z"]},
                            "dialogue": _fallback_dialogue(
                                "STOCK_UNIT_DEPLETED",
                                cook["name"],
                                {
                                    "deducted": s0["quantity"],
                                    "ingredientName": s0["ingredientName"],
                                    "beforeQuantity": s0["beforeQuantity"],
                                    "remainingAfter": s0["remainingAfter"],
                                    "unit": s0["unit"],
                                },
                            )["dialogue"],
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
                        "stationId": "storage-bl-cold",
                        "targetObjectId": first_storage_coord["sceneObjectId"],
                        "location": {"x": first_storage_coord["x"], "y": 0, "z": first_storage_coord["z"]},
                        "dialogue": _fallback_dialogue(
                            "OPEN_STORAGE_DOOR",
                            cook["name"],
                            {"ingredientName": dish_slices[0]["ingredientName"]},
                        )["dialogue"],
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
                        "stationId": "storage-bl-cold",
                        "targetObjectId": first_storage_coord["sceneObjectId"],
                        "location": {"x": first_storage_coord["x"], "y": 0, "z": first_storage_coord["z"]},
                        "dialogue": "Porte chambre froide refermée, retour en poste.",
                        "tone": "NEUTRAL",
                        "metadata": {"dishId": dish_id},
                    })

                    t_cook_start = t_close_storage + dt.timedelta(seconds=16)
                    t_plated = t_cook_start + dt.timedelta(seconds=food["cookDurationSec"])
                    t_pickup = t_plated + dt.timedelta(seconds=rng.randint(28, 65))
                    t_delivered = t_pickup + dt.timedelta(seconds=rng.randint(18, 32))

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
                        "dialogue": _fallback_dialogue(
                            "COOKING_STARTED", cook["name"], {"dishName": food["name"], "tableName": tbl["name"]}
                        )["dialogue"],
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
                        "stationId": "station-bl-passe",
                        "targetObjectId": passe_coord["sceneObjectId"],
                        "location": {"x": passe_coord["x"], "y": 0, "z": passe_coord["z"]},
                        "dialogue": _fallback_dialogue(
                            "DISH_PLATED_AT_PASS", cook["name"], {"dishName": food["name"], "tableName": tbl["name"]}
                        )["dialogue"],
                        "tone": "URGENT",
                        "metadata": {
                            "dishId": dish_id,
                            "itemName": food["name"],
                            "tableId": tbl["tableId"],
                            "stationId": "station-bl-passe",
                        },
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
                        "stationId": "station-bl-passe",
                        "targetObjectId": passe_coord["sceneObjectId"],
                        "location": {"x": passe_coord["x"], "y": 0, "z": passe_coord["z"]},
                        "dialogue": _fallback_dialogue(
                            "ORDER_PICKED_UP_FROM_PASS", waiter["name"], {"dishName": food["name"], "tableName": tbl["name"]}
                        )["dialogue"],
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
                        "dialogue": _fallback_dialogue(
                            "ORDER_DELIVERED_TO_TABLE", waiter["name"], {"dishName": food["name"], "tableName": tbl["name"]}
                        )["dialogue"],
                        "tone": "WARM",
                        "metadata": {
                            "dishId": dish_id,
                            "itemName": food["name"],
                            "tableId": tbl["tableId"],
                            "ingredientsConsumed": dish_slices,
                        },
                    })

                    dish_doc = {
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
                        "clearedAt": None,  # Filled below once dining completes
                        "status": "SERVED_ON_TABLE",
                        "ingredientsConsumed": dish_slices,
                    }
                    all_dish_instances.append(dish_doc)
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

                # 6. STRICT DINING DURATION: 16 to 24 minutes AFTER last_food_delivered_dt!
                dining_seconds = rng.randint(16 * 60, 24 * 60)
                t_checkin = last_food_delivered_dt + dt.timedelta(seconds=360)
                t_paid = last_food_delivered_dt + dt.timedelta(seconds=dining_seconds)
                t_depart = t_paid + dt.timedelta(seconds=45)
                t_clear = t_depart + dt.timedelta(seconds=90)
                t_wash = t_clear + dt.timedelta(seconds=65)

                # Update clearedAt on dish instances for this order
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
                    "dialogue": _fallback_dialogue("GUEST_DINING_CHECKIN", waiter["name"], {"tableName": tbl["name"]})["dialogue"],
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
                    "dialogue": _fallback_dialogue("PAYMENT_COMPLETED", waiter["name"], {"tableName": tbl["name"]})["dialogue"],
                    "tone": "GRATEFUL",
                    "metadata": {
                        "orderId": order_id,
                        "tableId": tbl["tableId"],
                        "totalAmount": round(order_total, 2),
                        "paymentMethod": "CARD" if order_seq % 4 != 0 else "CASH",
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
                    "targetObjectId": "scene-bl-door-main",
                    "location": {"x": 10.0, "y": 0, "z": 14.0},
                    "dialogue": _fallback_dialogue("CUSTOMER_DEPARTED", lead_guest["name"], {"tableName": tbl["name"]})["dialogue"],
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
                    "dialogue": _fallback_dialogue("TABLE_CLEARED", waiter["name"], {"tableName": tbl["name"]})["dialogue"],
                    "tone": "EFFICIENT",
                    "metadata": {"orderId": order_id, "tableId": tbl["tableId"]},
                })

                plonge_coord = STATION_COORDS["station-bl-plonge"]
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
                    "stationId": "station-bl-plonge",
                    "targetObjectId": plonge_coord["sceneObjectId"],
                    "location": {"x": plonge_coord["x"], "y": 0, "z": plonge_coord["z"]},
                    "dialogue": f"Bac vaisselle de {tbl['name']} passé au tunnel haute température.",
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

        # Daily accounting & reviews
        payroll_cost = sum(s["hourlyRate"] * 8.5 for s in STAFF_ROSTER)
        all_accounting_entries.extend([
            {
                "entryId": f"acc-bl-rev-{date_str}",
                "businessId": BUSINESS_ID,
                "serviceDate": date_str,
                "timestamp": _iso(_make_dt(date_str, 23, 45, 0)),
                "type": "REVENUE",
                "category": "Ventes Restauration & Bar",
                "amount": round(day_revenue, 2),
            },
            {
                "entryId": f"acc-bl-cogs-{date_str}",
                "businessId": BUSINESS_ID,
                "serviceDate": date_str,
                "timestamp": _iso(_make_dt(date_str, 23, 50, 0)),
                "type": "EXPENSE",
                "category": "Achats Matières Premières (Rungis)",
                "amount": -round(day_cogs, 2),
            },
            {
                "entryId": f"acc-bl-pay-{date_str}",
                "businessId": BUSINESS_ID,
                "serviceDate": date_str,
                "timestamp": _iso(_make_dt(date_str, 23, 55, 0)),
                "type": "EXPENSE",
                "category": "Salaires & Charges Équipe",
                "amount": -round(payroll_cost, 2),
            },
        ])

        all_reviews.append({
            "reviewId": f"rev-bl-{date_str}",
            "businessId": BUSINESS_ID,
            "serviceDate": date_str,
            "rating": 4.8 if is_weekend else 4.7,
            "author": "Client Vérifié Paris 11e",
            "comment": "Service irréprochable, entrecôte maturée fondante et salade de concombre ultra fraîche !",
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
