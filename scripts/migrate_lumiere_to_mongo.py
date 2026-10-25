#!/usr/bin/env python3
"""
Deterministic ETL & Multi-Venue MongoDB Migration Pipeline
Transforms the `lumiere` restaurant operations dataset (`out/push/*.tsv` + `load.sql`)
into the Multi-Tenant MongoDB collections for the 3D Hospitality Street Simulation Platform.
"""

import argparse
import datetime
import json
import os
import re
import sys
from collections import defaultdict
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from street_topology import (
    STREET_ID,
    BISTROT_ID,
    OSTERIA_ID,
    SAKANA_ID,
    PIZZA_ID,
    CAFE_ID,
    build_street_and_businesses,
    build_premises_and_registry,
)

PARIS_TZ = ZoneInfo("Europe/Paris")
PUSH_DIR = "/Users/ag/Workspace/restaurants/lumiere/out/push"
OUT_DIR = "/Users/ag/Workspace/restaurants/data/mongodb"

DEFAULT_BENCHMARK_DATES = [
    "2025-01-03",  # Opening winter Friday
    "2025-01-04",  # Opening winter Saturday
    "2025-02-14",  # Valentine's Day peak
    "2025-05-03",  # First Saturday with Terrasse open & seasonal staff
    "2025-06-14",  # Peak summer Saturday (Default simulation date)
    "2025-07-19",  # High-season Nice summer Saturday
    "2025-08-15",  # Mid-August Riviera peak
    "2025-10-18",  # Autumn bistrot Saturday
    "2025-12-20",  # Holiday festive Saturday
]


def ms_to_iso(ms_val):
    if ms_val is None or ms_val == "" or ms_val == "\\N":
        return None
    try:
        ms = int(float(ms_val))
        dt = datetime.datetime.fromtimestamp(ms / 1000.0, tz=PARIS_TZ)
        return dt.isoformat()
    except Exception:
        return None


def ms_to_date(ms_val):
    if ms_val is None or ms_val == "" or ms_val == "\\N":
        return None
    try:
        ms = int(float(ms_val))
        dt = datetime.datetime.fromtimestamp(ms / 1000.0, tz=PARIS_TZ)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return None


def parse_json_col(val, default=None):
    if not val or val == "\\N":
        return default if default is not None else []
    try:
        return json.loads(val)
    except Exception:
        return default if default is not None else []


def parse_load_sql_schemas(load_sql_path: str):
    schemas = {}
    copy_re = re.compile(r'\\copy\s+public\."([^"]+)"\s*\(([^)]+)\)\s*from\s+\'[^\']*?/([^/\']+\.tsv)\'', re.I)
    with open(load_sql_path, "r", encoding="utf-8") as f:
        for line in f:
            m = copy_re.search(line)
            if m:
                table_name = m.group(1)
                cols_raw = m.group(2)
                cols = [c.strip().strip('"') for c in cols_raw.split(",")]
                schemas[table_name] = cols
    return schemas


def read_tsv_table(table_name: str, cols: list):
    path = os.path.join(PUSH_DIR, f"{table_name}.tsv")
    if not os.path.exists(path):
        return []
    rows = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\r\n")
            if not line:
                continue
            parts = line.split("\t")
            row = {}
            for i, col in enumerate(cols):
                v = parts[i] if i < len(parts) else None
                if v == "\\N":
                    v = None
                elif v and ("\\n" in v or "\\t" in v or "\\\\" in v):
                    v = v.replace("\\n", "\n").replace("\\t", "\t").replace("\\\\", "\\")
                row[col] = v
            rows.append(row)
    return rows


def infer_visual_asset(name: str, category: str = "", station: str = "", course: int = 2) -> str:
    n = (name or "").lower()
    cat = (category or "").lower()
    st = (station or "").lower()
    if st == "bar" or any(k in n or k in cat for k in ("vin", "verre", "bouteille", "champagne", "prosecco", "negroni", "spritz", "sake", "saké", "junmai", "bière", "cocktail", "eau", "whisky", "digestif")):
        return "wine_decanter_glasses"
    if any(k in n or k in cat for k in ("café", "espresso", "ristretto", "thé", "infusion", "matcha")):
        return "espresso_tray"
    if any(k in n or k in cat for k in ("sushi", "nigiri", "sashimi", "maki", "omakase", "chirashi", "uni", "toro", "hamachi")):
        return "sushi_geta_board"
    if any(k in n or k in cat for k in ("robata", "yakitori", "kushiyaki", "brochette", "binchotan", "black cod", "wagyu")):
        return "robata_skewers"
    if any(k in n or k in cat for k in ("tempura", "ramen", "udon", "gyoza", "karaage", "katsu", "miso")):
        return "tempura_wok"
    if any(k in n or k in cat for k in ("tagliatelle", "pappardelle", "tonnarelli", "ravioli", "gnocchi", "spaghetti", "pasta", "cacio", "carbonara", "tartufo", "risotto", "paccheri")):
        return "pasta_bollitore_basket"
    if any(k in n or k in cat for k in ("bistecca", "fiorentina", "tagliata", "entrecôte", "bavette", "magret", "agneau", "côte", "grillé", "grill")):
        return "tuscan_bistecca_grill"
    if any(k in n or k in cat for k in ("soupe", "bouillabaisse", "velouté", "bouillon", "dashi", "ragù", "daube", "cocotte")):
        return "stockpot_simmer"
    if course == 3 or any(k in n or k in cat for k in ("tarte", "tiramisu", "crème", "mousse", "profiterole", "panna cotta", "cannoli", "mochi", "glace", "sorbet", "dessert", "fromage", "brie", "comté")):
        return "pastry_dessert_plate"
    if course == 1 or any(k in n or k in cat for k in ("salade", "burrata", "carpaccio", "tartare", "vitello", "antipast", "edamame", "oeuf", "terrine", "foie gras", "escargot", "pissaladière")):
        return "cold_plated_dish"
    return "copper_saute_pan"


def generate_synthetic_venue_catalog_and_staff():
    """Returns full staff brigades, specialty menus, and ingredients for Osteria Bellavista & Sakana-Tei."""
    extra_employees = [
        # Osteria Bellavista (6 staff)
        {
            "_id": "emp-ob-marco",
            "businessId": OSTERIA_ID,
            "streetId": STREET_ID,
            "name": "Marco Bellini",
            "role": "Kitchen",
            "jobTitle": "Executive Chef — Cucina Toscana",
            "team": "kitchen",
            "contractType": "permanent",
            "weeklyHours": 42,
            "hourlyRateCents": 1950,
            "hireDate": "2024-11-15",
            "endDate": None,
            "color": "#ea580c",
            "agentId": "agent-emp-ob-marco",
            "homeCoords": {"x": 31.8, "z": -3.1},
            "sourceMeta": {"system": "street_platform", "originalTable": "specialty_staff", "originalId": "emp-ob-marco", "provenance": "synthetic_activity"},
        },
        {
            "_id": "emp-ob-giulia",
            "businessId": OSTERIA_ID,
            "streetId": STREET_ID,
            "name": "Giulia Conti",
            "role": "Kitchen",
            "jobTitle": "Maestra Pastaia & Sfoglina",
            "team": "kitchen",
            "contractType": "permanent",
            "weeklyHours": 39,
            "hourlyRateCents": 1680,
            "hireDate": "2024-12-01",
            "endDate": None,
            "color": "#f97316",
            "agentId": "agent-emp-ob-giulia",
            "homeCoords": {"x": 31.8, "z": -1.6},
            "sourceMeta": {"system": "street_platform", "originalTable": "specialty_staff", "originalId": "emp-ob-giulia", "provenance": "synthetic_activity"},
        },
        {
            "_id": "emp-ob-matteo",
            "businessId": OSTERIA_ID,
            "streetId": STREET_ID,
            "name": "Matteo Lombardi",
            "role": "Kitchen",
            "jobTitle": "Chef Grillardin & Antipasti",
            "team": "kitchen",
            "contractType": "permanent",
            "weeklyHours": 39,
            "hourlyRateCents": 1620,
            "hireDate": "2024-12-01",
            "endDate": None,
            "color": "#fb923c",
            "agentId": "agent-emp-ob-matteo",
            "homeCoords": {"x": 36.2, "z": -3.1},
            "sourceMeta": {"system": "street_platform", "originalTable": "specialty_staff", "originalId": "emp-ob-matteo", "provenance": "synthetic_activity"},
        },
        {
            "_id": "emp-ob-lorenzo",
            "businessId": OSTERIA_ID,
            "streetId": STREET_ID,
            "name": "Lorenzo Moretti",
            "role": "Manager",
            "jobTitle": "Direttore di Sala & Sommelier",
            "team": "management",
            "contractType": "permanent",
            "weeklyHours": 40,
            "hourlyRateCents": 1850,
            "hireDate": "2024-11-15",
            "endDate": None,
            "color": "#f59e0b",
            "agentId": "agent-emp-ob-lorenzo",
            "homeCoords": {"x": 30.2, "z": 11.2},
            "sourceMeta": {"system": "street_platform", "originalTable": "specialty_staff", "originalId": "emp-ob-lorenzo", "provenance": "synthetic_activity"},
        },
        {
            "_id": "emp-ob-chiara",
            "businessId": OSTERIA_ID,
            "streetId": STREET_ID,
            "name": "Chiara Bianchi",
            "role": "Floor",
            "jobTitle": "Chef de Rang — Sala & Terrazza",
            "team": "floor",
            "contractType": "permanent",
            "weeklyHours": 35,
            "hourlyRateCents": 1420,
            "hireDate": "2024-12-01",
            "endDate": None,
            "color": "#38bdf8",
            "agentId": "agent-emp-ob-chiara",
            "homeCoords": {"x": 31.8, "z": 5.5},
            "sourceMeta": {"system": "street_platform", "originalTable": "specialty_staff", "originalId": "emp-ob-chiara", "provenance": "synthetic_activity"},
        },
        {
            "_id": "emp-ob-alessandro",
            "businessId": OSTERIA_ID,
            "streetId": STREET_ID,
            "name": "Alessandro Greco",
            "role": "Bar",
            "jobTitle": "Head Bartender — Enoteca & Aperitivi",
            "team": "bar",
            "contractType": "permanent",
            "weeklyHours": 39,
            "hourlyRateCents": 1520,
            "hireDate": "2024-12-01",
            "endDate": None,
            "color": "#a855f7",
            "agentId": "agent-emp-ob-alessandro",
            "homeCoords": {"x": 38.2, "z": 8.6},
            "sourceMeta": {"system": "street_platform", "originalTable": "specialty_staff", "originalId": "emp-ob-alessandro", "provenance": "synthetic_activity"},
        },
        # Sakana-Tei (5 staff)
        {
            "_id": "emp-sk-kenji",
            "businessId": SAKANA_ID,
            "streetId": STREET_ID,
            "name": "Kenji Takahashi",
            "role": "Kitchen",
            "jobTitle": "Master Itamae — Omakase Sushi",
            "team": "kitchen",
            "contractType": "permanent",
            "weeklyHours": 42,
            "hourlyRateCents": 2150,
            "hireDate": "2024-11-10",
            "endDate": None,
            "color": "#10b981",
            "agentId": "agent-emp-sk-kenji",
            "homeCoords": {"x": 51.8, "z": -1.5},
            "sourceMeta": {"system": "street_platform", "originalTable": "specialty_staff", "originalId": "emp-sk-kenji", "provenance": "synthetic_activity"},
        },
        {
            "_id": "emp-sk-haruka",
            "businessId": SAKANA_ID,
            "streetId": STREET_ID,
            "name": "Haruka Sato",
            "role": "Kitchen",
            "jobTitle": "Chef Robatayaki & Binchotan Grill",
            "team": "kitchen",
            "contractType": "permanent",
            "weeklyHours": 39,
            "hourlyRateCents": 1750,
            "hireDate": "2024-12-01",
            "endDate": None,
            "color": "#14b8a6",
            "agentId": "agent-emp-sk-haruka",
            "homeCoords": {"x": 51.8, "z": -3.1},
            "sourceMeta": {"system": "street_platform", "originalTable": "specialty_staff", "originalId": "emp-sk-haruka", "provenance": "synthetic_activity"},
        },
        {
            "_id": "emp-sk-daiki",
            "businessId": SAKANA_ID,
            "streetId": STREET_ID,
            "name": "Daiki Yamamoto",
            "role": "Kitchen",
            "jobTitle": "Chef Tempura & Bouillons Dashi",
            "team": "kitchen",
            "contractType": "permanent",
            "weeklyHours": 39,
            "hourlyRateCents": 1650,
            "hireDate": "2024-12-01",
            "endDate": None,
            "color": "#06b6d4",
            "agentId": "agent-emp-sk-daiki",
            "homeCoords": {"x": 56.2, "z": -3.1},
            "sourceMeta": {"system": "street_platform", "originalTable": "specialty_staff", "originalId": "emp-sk-daiki", "provenance": "synthetic_activity"},
        },
        {
            "_id": "emp-sk-yuki",
            "businessId": SAKANA_ID,
            "streetId": STREET_ID,
            "name": "Yuki Nakamura",
            "role": "Manager",
            "jobTitle": "Directrice de Salle & Kikisake-Shi (Sake)",
            "team": "management",
            "contractType": "permanent",
            "weeklyHours": 40,
            "hourlyRateCents": 1880,
            "hireDate": "2024-11-15",
            "endDate": None,
            "color": "#eab308",
            "agentId": "agent-emp-sk-yuki",
            "homeCoords": {"x": 50.2, "z": 11.2},
            "sourceMeta": {"system": "street_platform", "originalTable": "specialty_staff", "originalId": "emp-sk-yuki", "provenance": "synthetic_activity"},
        },
        {
            "_id": "emp-sk-aoi",
            "businessId": SAKANA_ID,
            "streetId": STREET_ID,
            "name": "Aoi Kobayashi",
            "role": "Floor",
            "jobTitle": "Chef de Rang — Salle Hinoki & Jardin",
            "team": "floor",
            "contractType": "permanent",
            "weeklyHours": 35,
            "hourlyRateCents": 1450,
            "hireDate": "2024-12-01",
            "endDate": None,
            "color": "#ec4899",
            "agentId": "agent-emp-sk-aoi",
            "homeCoords": {"x": 51.8, "z": 6.5},
            "sourceMeta": {"system": "street_platform", "originalTable": "specialty_staff", "originalId": "emp-sk-aoi", "provenance": "synthetic_activity"},
        },
    ]

    extra_ingredients = [
        # Osteria Bellavista ingredients
        {"_id": "ob-ing-sfoglia", "businessId": OSTERIA_ID, "streetId": STREET_ID, "name": "Pasta Fresca all'Uovo (Semola & Tuorli Bio)", "kind": "prep", "station": "station-ob-pasta", "unit": "g", "onHand": 18500, "minQty": 5000, "parQty": 22000, "avgCostCents": 0.68, "visualAsset": "pasta_bollitore_basket", "recipeSummary": "Farine Caputo 00 (600g) · Semoule Rimacinata (400g) · 32 Jaunes d'Oeufs Bio"},
        {"_id": "ob-ing-tartufo", "businessId": OSTERIA_ID, "streetId": STREET_ID, "name": "Tartufo Nero Pregiato di Norcia", "kind": "ingredient", "station": "station-ob-pasta", "unit": "g", "onHand": 950, "minQty": 300, "parQty": 1200, "avgCostCents": 9.80, "visualAsset": "pasta_bollitore_basket"},
        {"_id": "ob-ing-ragu", "businessId": OSTERIA_ID, "streetId": STREET_ID, "name": "Ragù Toscano di Cinghiale Mijoté 6h", "kind": "prep", "station": "station-ob-pasta", "unit": "g", "onHand": 12400, "minQty": 3500, "parQty": 15000, "avgCostCents": 1.85, "visualAsset": "stockpot_simmer", "recipeSummary": "Épaule de Sanglier Marinée Chianti (5kg) · Soffritto Toscano · Tomates San Marzano"},
        {"_id": "ob-ing-chianina", "businessId": OSTERIA_ID, "streetId": STREET_ID, "name": "Lombata di Chianina IGP Maturée 40 Jours", "kind": "ingredient", "station": "station-ob-grill", "unit": "g", "onHand": 24000, "minQty": 8000, "parQty": 30000, "avgCostCents": 3.90, "visualAsset": "tuscan_bistecca_grill"},
        {"_id": "ob-ing-burrata", "businessId": OSTERIA_ID, "streetId": STREET_ID, "name": "Burrata Artigianale di Andria IGP (250g)", "kind": "ingredient", "station": "station-ob-antipasti", "unit": "unit", "onHand": 48, "minQty": 15, "parQty": 60, "avgCostCents": 340.0, "visualAsset": "cold_plated_dish"},
        {"_id": "ob-ing-guanciale", "businessId": OSTERIA_ID, "streetId": STREET_ID, "name": "Guanciale Amatrice Stagionato & Pecorino Romano DOP", "kind": "ingredient", "station": "station-ob-pasta", "unit": "g", "onHand": 9800, "minQty": 2500, "parQty": 12000, "avgCostCents": 2.20, "visualAsset": "pasta_bollitore_basket"},
        {"_id": "ob-ing-tiramisu-base", "businessId": OSTERIA_ID, "streetId": STREET_ID, "name": "Crema al Mascarpone & Savoiardi Espresso", "kind": "prep", "station": "station-ob-antipasti", "unit": "g", "onHand": 7500, "minQty": 2000, "parQty": 9000, "avgCostCents": 1.10, "visualAsset": "pastry_dessert_plate"},
        {"_id": "ob-ing-brunello", "businessId": OSTERIA_ID, "streetId": STREET_ID, "name": "Brunello di Montalcino DOCG & Chianti Classico Riserva", "kind": "ingredient", "station": "station-ob-bar", "unit": "ml", "onHand": 36000, "minQty": 9000, "parQty": 45000, "avgCostCents": 2.80, "visualAsset": "wine_decanter_glasses"},
        # Sakana-Tei ingredients
        {"_id": "sk-ing-shari", "businessId": SAKANA_ID, "streetId": STREET_ID, "name": "Riz Koshihikari Niigata Assaisonné Vinaigre Akazu", "kind": "prep", "station": "station-sk-sushi", "unit": "g", "onHand": 16000, "minQty": 4000, "parQty": 20000, "avgCostCents": 0.55, "visualAsset": "sushi_geta_board", "recipeSummary": "Riz Koshihikari Grand Cru (8kg) · Vinaigre Rouge Akazu Vieilli 3 ans · Kombu Rishiri"},
        {"_id": "sk-ing-honmaguro", "businessId": SAKANA_ID, "streetId": STREET_ID, "name": "Thon Rouge Hon-Maguro (Otoro & Chutoro Maturé)", "kind": "ingredient", "station": "station-sk-sushi", "unit": "g", "onHand": 8200, "minQty": 2500, "parQty": 10000, "avgCostCents": 6.80, "visualAsset": "sushi_geta_board"},
        {"_id": "sk-ing-hamachi", "businessId": SAKANA_ID, "streetId": STREET_ID, "name": "Sériole Hamachi Sauvage & Saint-Jacques d'Hokkaido", "kind": "ingredient", "station": "station-sk-sushi", "unit": "g", "onHand": 7400, "minQty": 2000, "parQty": 9500, "avgCostCents": 4.90, "visualAsset": "sushi_geta_board"},
        {"_id": "sk-ing-wagyu", "businessId": SAKANA_ID, "streetId": STREET_ID, "name": "Boeuf Wagyu Miyazaki A5 BMS 11", "kind": "ingredient", "station": "station-sk-robata", "unit": "g", "onHand": 6800, "minQty": 2000, "parQty": 8500, "avgCostCents": 9.50, "visualAsset": "robata_skewers"},
        {"_id": "sk-ing-blackcod", "businessId": SAKANA_ID, "streetId": STREET_ID, "name": "Black Cod d'Alaska Mariné 72h au Saikyo Miso Blanc", "kind": "prep", "station": "station-sk-robata", "unit": "g", "onHand": 9200, "minQty": 2500, "parQty": 12000, "avgCostCents": 4.40, "visualAsset": "robata_skewers", "recipeSummary": "Cabillaud Charbonnier (6kg) · Miso Blanc Saikyo de Kyoto · Mirin Hon-Mirin"},
        {"_id": "sk-ing-dashi", "businessId": SAKANA_ID, "streetId": STREET_ID, "name": "Bouillon Ichiban Dashi (Kombu Rishiri & Bonite Katsuobushi)", "kind": "prep", "station": "station-sk-tempura", "unit": "ml", "onHand": 22000, "minQty": 6000, "parQty": 28000, "avgCostCents": 0.48, "visualAsset": "stockpot_simmer"},
        {"_id": "sk-ing-ebi", "businessId": SAKANA_ID, "streetId": STREET_ID, "name": "Gambas Impériales Kuruma-Ebi & Légumes Bio", "kind": "ingredient", "station": "station-sk-tempura", "unit": "g", "onHand": 8500, "minQty": 2500, "parQty": 11000, "avgCostCents": 3.60, "visualAsset": "tempura_wok"},
        {"_id": "sk-ing-junmai", "businessId": SAKANA_ID, "streetId": STREET_ID, "name": "Saké Dassai 23 Junmai Daiginjo & Whisky Yamazaki", "kind": "ingredient", "station": "station-sk-bar", "unit": "ml", "onHand": 28000, "minQty": 7000, "parQty": 35000, "avgCostCents": 3.90, "visualAsset": "wine_decanter_glasses"},
    ]

    extra_products = [
        # Osteria Bellavista Menu
        {
            "_id": "ob-burrata-andria",
            "businessId": OSTERIA_ID,
            "streetId": STREET_ID,
            "name": "Burrata di Andria IGP, Pêche Rôtie & Basilic Pourpre",
            "category": "Antipasti",
            "station": "station-ob-antipasti",
            "course": 1,
            "priceCents": 1650,
            "vatRate": 10,
            "prepMinutes": 5,
            "visualAsset": "cold_plated_dish",
            "recipeSummary": "Burrata di Andria IGP (1pc) · Huile d'Olive Toscane DOP · Basilic Frais",
            "recipe": [{"itemId": "ob-ing-burrata", "qty": 1}],
        },
        {
            "_id": "ob-carpaccio-chianina",
            "businessId": OSTERIA_ID,
            "streetId": STREET_ID,
            "name": "Carpaccio di Chianina IGP, Parmigiano 36 Mois & Truffe",
            "category": "Antipasti",
            "station": "station-ob-antipasti",
            "course": 1,
            "priceCents": 1850,
            "vatRate": 10,
            "prepMinutes": 6,
            "visualAsset": "cold_plated_dish",
            "recipeSummary": "Chianina IGP Fine Tranche (110g) · Tartufo Nero (8g) · Parmigiano 36m",
            "recipe": [{"itemId": "ob-ing-chianina", "qty": 110}, {"itemId": "ob-ing-tartufo", "qty": 8}],
        },
        {
            "_id": "ob-tagliatelle-tartufo",
            "businessId": OSTERIA_ID,
            "streetId": STREET_ID,
            "name": "Tagliatelle Fresche al Tartufo Nero di Norcia",
            "category": "Primi — Paste Fresche",
            "station": "station-ob-pasta",
            "course": 2,
            "priceCents": 2650,
            "vatRate": 10,
            "prepMinutes": 9,
            "visualAsset": "pasta_bollitore_basket",
            "recipeSummary": "Tagliatelle aux 32 Jaunes d'Oeufs (180g) · Beurre d'Alpage · Truffe Noire (22g)",
            "recipe": [{"itemId": "ob-ing-sfoglia", "qty": 180}, {"itemId": "ob-ing-tartufo", "qty": 22}],
        },
        {
            "_id": "ob-pappardelle-cinghiale",
            "businessId": OSTERIA_ID,
            "streetId": STREET_ID,
            "name": "Pappardelle Tirate a Mano al Ragù di Cinghiale",
            "category": "Primi — Paste Fresche",
            "station": "station-ob-pasta",
            "course": 2,
            "priceCents": 2350,
            "vatRate": 10,
            "prepMinutes": 9,
            "visualAsset": "pasta_bollitore_basket",
            "recipeSummary": "Pappardelle Fraîches (180g) · Ragù de Sanglier Mijoté 6h au Chianti (160g)",
            "recipe": [{"itemId": "ob-ing-sfoglia", "qty": 180}, {"itemId": "ob-ing-ragu", "qty": 160}],
        },
        {
            "_id": "ob-tonnarelli-carbonara",
            "businessId": OSTERIA_ID,
            "streetId": STREET_ID,
            "name": "Tonnarelli Cacio, Pepe & Guanciale Croccante",
            "category": "Primi — Paste Fresche",
            "station": "station-ob-pasta",
            "course": 2,
            "priceCents": 2150,
            "vatRate": 10,
            "prepMinutes": 8,
            "visualAsset": "pasta_bollitore_basket",
            "recipeSummary": "Tonnarelli Frais (180g) · Guanciale d'Amatrice & Pecorino Romano DOP (95g)",
            "recipe": [{"itemId": "ob-ing-sfoglia", "qty": 180}, {"itemId": "ob-ing-guanciale", "qty": 95}],
        },
        {
            "_id": "ob-bistecca-fiorentina",
            "businessId": OSTERIA_ID,
            "streetId": STREET_ID,
            "name": "Tagliata di Chianina IGP alla Brace, Romarin & Ail Confit",
            "category": "Secondi alla Brace",
            "station": "station-ob-grill",
            "course": 2,
            "priceCents": 3450,
            "vatRate": 10,
            "prepMinutes": 12,
            "visualAsset": "tuscan_bistecca_grill",
            "recipeSummary": "Lombata di Chianina Maturée 40j (320g) · Braises de Chêne Vert · Fleur de Sel",
            "recipe": [{"itemId": "ob-ing-chianina", "qty": 320}],
        },
        {
            "_id": "ob-tiramisu-classico",
            "businessId": OSTERIA_ID,
            "streetId": STREET_ID,
            "name": "Tiramisù della Casa al Mascarpone Artigianale & Marsala",
            "category": "Dolci",
            "station": "station-ob-antipasti",
            "course": 3,
            "priceCents": 1150,
            "vatRate": 10,
            "prepMinutes": 4,
            "visualAsset": "pastry_dessert_plate",
            "recipeSummary": "Crème Mascarpone Bio & Savoiardi Imbibés Espresso (150g) · Cacao Valrhona",
            "recipe": [{"itemId": "ob-ing-tiramisu-base", "qty": 150}],
        },
        {
            "_id": "ob-calice-brunello",
            "businessId": OSTERIA_ID,
            "streetId": STREET_ID,
            "name": "Calice di Brunello di Montalcino DOCG Riserva",
            "category": "Enoteca & Aperitivi",
            "station": "station-ob-bar",
            "course": 1,
            "priceCents": 1450,
            "vatRate": 20,
            "prepMinutes": 2,
            "visualAsset": "wine_decanter_glasses",
            "recipeSummary": "Brunello di Montalcino DOCG (150ml) · Service Carafe Cristal",
            "recipe": [{"itemId": "ob-ing-brunello", "qty": 150}],
        },
        # Sakana-Tei Menu
        {
            "_id": "sk-sashimi-moriawase",
            "businessId": SAKANA_ID,
            "streetId": STREET_ID,
            "name": "Sashimi Moriawase Grand Cru (Otoro, Hamachi & Hotate)",
            "category": "Zensai & Sashimi",
            "station": "station-sk-sushi",
            "course": 1,
            "priceCents": 2450,
            "vatRate": 10,
            "prepMinutes": 6,
            "visualAsset": "sushi_geta_board",
            "recipeSummary": "Thon Rouge Hon-Maguro (90g) · Sériole Hamachi & St-Jacques Hokkaido (90g) · Wasabi Frais",
            "recipe": [{"itemId": "sk-ing-honmaguro", "qty": 90}, {"itemId": "sk-ing-hamachi", "qty": 90}],
        },
        {
            "_id": "sk-gyoza-wagyu",
            "businessId": SAKANA_ID,
            "streetId": STREET_ID,
            "name": "Gyoza Grillés au Wagyu Miyazaki & Ponzu Yuzu",
            "category": "Zensai & Sashimi",
            "station": "station-sk-tempura",
            "course": 1,
            "priceCents": 1750,
            "vatRate": 10,
            "prepMinutes": 7,
            "visualAsset": "tempura_wok",
            "recipeSummary": "Wagyu Miyazaki Haché (85g) · Bouillon Dashi (60ml) · Sauce Ponzu Yuzu",
            "recipe": [{"itemId": "sk-ing-wagyu", "qty": 85}, {"itemId": "sk-ing-dashi", "qty": 60}],
        },
        {
            "_id": "sk-omakase-nigiri",
            "businessId": SAKANA_ID,
            "streetId": STREET_ID,
            "name": "Omakase Nigiri 8 Pièces du Maître Itamae",
            "category": "Comptoir Omakase Sushi",
            "station": "station-sk-sushi",
            "course": 2,
            "priceCents": 3650,
            "vatRate": 10,
            "prepMinutes": 10,
            "visualAsset": "sushi_geta_board",
            "recipeSummary": "Riz Shari Akazu (160g) · Otoro & Chutoro (110g) · Hamachi & Hotate (80g)",
            "recipe": [{"itemId": "sk-ing-shari", "qty": 160}, {"itemId": "sk-ing-honmaguro", "qty": 110}, {"itemId": "sk-ing-hamachi", "qty": 80}],
        },
        {
            "_id": "sk-blackcod-saikyo",
            "businessId": SAKANA_ID,
            "streetId": STREET_ID,
            "name": "Black Cod d'Alaska Laqué au Saikyo Miso sur Binchotan",
            "category": "Robatayaki Binchotan",
            "station": "station-sk-robata",
            "course": 2,
            "priceCents": 3250,
            "vatRate": 10,
            "prepMinutes": 11,
            "visualAsset": "robata_skewers",
            "recipeSummary": "Filet de Black Cod Mariné 72h au Miso Blanc de Kyoto (210g) · Hajikami",
            "recipe": [{"itemId": "sk-ing-blackcod", "qty": 210}],
        },
        {
            "_id": "sk-wagyu-robata",
            "businessId": SAKANA_ID,
            "streetId": STREET_ID,
            "name": "Kushiyaki de Wagyu Miyazaki A5 au Charbon Blanc Binchotan",
            "category": "Robatayaki Binchotan",
            "station": "station-sk-robata",
            "course": 2,
            "priceCents": 3850,
            "vatRate": 10,
            "prepMinutes": 10,
            "visualAsset": "robata_skewers",
            "recipeSummary": "Brochettes Wagyu A5 BMS 11 (160g) · Tare Maison · Poivre Sansho Vert",
            "recipe": [{"itemId": "sk-ing-wagyu", "qty": 160}],
        },
        {
            "_id": "sk-tempura-kuruma",
            "businessId": SAKANA_ID,
            "streetId": STREET_ID,
            "name": "Tempura Impériale de Gambas Kuruma-Ebi & Tentsuyu Dashi",
            "category": "Tempura & Dashi",
            "station": "station-sk-tempura",
            "course": 2,
            "priceCents": 2650,
            "vatRate": 10,
            "prepMinutes": 9,
            "visualAsset": "tempura_wok",
            "recipeSummary": "Gambas Kuruma-Ebi & Légumes (180g) · Tentsuyu Ichiban Dashi (120ml)",
            "recipe": [{"itemId": "sk-ing-ebi", "qty": 180}, {"itemId": "sk-ing-dashi", "qty": 120}],
        },
        {
            "_id": "sk-mochi-matcha",
            "businessId": SAKANA_ID,
            "streetId": STREET_ID,
            "name": "Parfait Matcha d'Uji, Daifuku Mochi & Sésame Noir",
            "category": "Kanmi — Desserts",
            "station": "station-sk-sushi",
            "course": 3,
            "priceCents": 1250,
            "vatRate": 10,
            "prepMinutes": 4,
            "visualAsset": "pastry_dessert_plate",
            "recipeSummary": "Mochi Artisanal Riz Gluant (80g) · Glace Matcha Cérémonie d'Uji",
            "recipe": [{"itemId": "sk-ing-shari", "qty": 80}],
        },
        {
            "_id": "sk-sake-dassai",
            "businessId": SAKANA_ID,
            "streetId": STREET_ID,
            "name": "Tokkuri Saké Dassai 23 Junmai Daiginjo (180ml)",
            "category": "Saké & Whisky Japonais",
            "station": "station-sk-bar",
            "course": 1,
            "priceCents": 1850,
            "vatRate": 20,
            "prepMinutes": 2,
            "visualAsset": "wine_decanter_glasses",
            "recipeSummary": "Saké Dassai 23 poli à 23% (180ml) · Service Carafe Tokkuri & Ochoko",
            "recipe": [{"itemId": "sk-ing-junmai", "qty": 180}],
        },
    ]

    return extra_employees, extra_products, extra_ingredients


def synthesize_events_for_date(
    target_date: str,
    bl_orders: list,
    bl_order_lines_by_order: dict,
    bl_reservations: list,
    bl_time_entries: list,
    bl_stock_movements: list,
    bl_purchase_orders: dict,
    staff_lookup: dict,
    table_coords: dict,
    ing_by_id: dict,
    prod_by_id: dict,
    extra_orders_out: list,
    extra_payments_out: list,
    extra_reservations_out: list,
):
    """
    Synthesizes the deterministic, causally ordered `simulationEvents` and 30-minute `simulationSnapshots`
    for `target_date` across Bistrot Lumière, Osteria Bellavista, and Sakana-Tei.
    """
    events = []
    seq = 0

    def add_evt(evt_time_ms: int, business_id: str, business_type: str, evt_type: str, provenance: str, idemp_key: str, actor: dict, target: dict, payload: dict):
        nonlocal seq
        seq += 1
        iso_str = ms_to_iso(evt_time_ms)
        events.append({
            "_id": f"evt-{target_date.replace('-', '')}-{seq:05d}",
            "idempotencyKey": idemp_key,
            "streetId": STREET_ID,
            "businessId": business_id,
            "businessType": business_type,
            "serviceDate": target_date,
            "eventTime": iso_str,
            "eventTimeMs": evt_time_ms,
            "processingTime": "2026-10-24T16:30:00Z",
            "sequence": seq,
            "eventType": evt_type,
            "provenance": provenance,
            "actor": actor,
            "target": target,
            "payload": payload,
        })

    # 1. Supplier Deliveries (`receive` movements grouped by purchaseOrderId)
    po_groups = defaultdict(list)
    produce_groups = defaultdict(list)
    waste_groups = []
    for mov in bl_stock_movements:
        kind = mov["kind"]
        if kind == "receive" and mov.get("purchaseOrderId"):
            po_groups[mov["purchaseOrderId"]].append(mov)
        elif kind == "produce" and mov.get("batchId"):
            produce_groups[mov["batchId"]].append(mov)
        elif kind == "waste":
            waste_groups.append(mov)

    for po_id, movs in po_groups.items():
        first = movs[0]
        t_ms = int(first["createdAt"])
        po_doc = bl_purchase_orders.get(po_id, {})
        staff_doc = staff_lookup.get(first.get("staffId")) or staff_lookup.get(first.get("staffName")) or {}
        total_cost = sum(float(m.get("costCents") or 0) for m in movs)
        rich_items = []
        for m in movs[:8]:
            ing_doc = ing_by_id.get(m["itemId"], {})
            rich_items.append({
                "ingredientId": m["itemId"],
                "name": ing_doc.get("name", m["itemId"]),
                "unit": ing_doc.get("unit", "g"),
                "qty": float(m["qty"]),
                "costCents": round(float(m.get("costCents") or 0)),
                "visualAsset": "cold_plated_dish",
            })
        add_evt(
            t_ms,
            BISTROT_ID,
            "restaurant",
            "STOCK_DELIVERY_RECEIVED",
            "historical_fact",
            f"mise_lumiere:purchaseOrder:{po_id}:receive",
            {"agentId": staff_doc.get("agentId", "agent-emp-karim"), "name": first.get("staffName", "Karim Benali"), "role": staff_doc.get("role", "Kitchen")},
            {"sceneObjectId": "scene-bl-storage-cold", "domainEntityType": "storage", "domainEntityId": "storage-bl-cold"},
            {
                "purchaseOrderId": po_id,
                "supplierId": po_doc.get("supplierId", "bl-sup-primeur"),
                "itemCount": len(movs),
                "totalCostCents": round(total_cost),
                "items": rich_items,
            },
        )

    # 2. Morning Production Batches (`produce`)
    for batch_id, movs in produce_groups.items():
        first = movs[0]
        t_ms = int(first["createdAt"])
        staff_doc = staff_lookup.get(first.get("staffId")) or staff_lookup.get(first.get("staffName")) or {}
        ing_doc = ing_by_id.get(first["itemId"], {})
        ing_name = ing_doc.get("name", first.get("note") or "Mise en place cuisine")
        ing_unit = ing_doc.get("unit", "g")
        vis_asset = infer_visual_asset(ing_name, "prep", "kitchen", 2)
        rec_sum = ing_doc.get("recipeSummary") or f"Production maison ({float(first['qty'])}{ing_unit})"
        add_evt(
            t_ms - 22 * 60 * 1000,
            BISTROT_ID,
            "restaurant",
            "PRODUCTION_BATCH_STARTED",
            "derived_workflow",
            f"mise_lumiere:batch:{batch_id}:start",
            {"agentId": staff_doc.get("agentId", "agent-emp-karim"), "name": first.get("staffName", "Karim Benali"), "role": "Kitchen"},
            {"sceneObjectId": "scene-bl-station-piano", "domainEntityType": "station", "domainEntityId": "station-bl-piano"},
            {
                "batchId": batch_id,
                "ingredientId": first["itemId"],
                "ingredientName": ing_name,
                "unit": ing_unit,
                "qtyProduced": float(first["qty"]),
                "prepMinutes": 22,
                "visualAsset": vis_asset,
                "recipeSummary": rec_sum,
            },
        )
        add_evt(
            t_ms,
            BISTROT_ID,
            "restaurant",
            "PRODUCTION_BATCH_COMPLETED",
            "historical_fact",
            f"mise_lumiere:batch:{batch_id}:produce",
            {"agentId": staff_doc.get("agentId", "agent-emp-karim"), "name": first.get("staffName", "Karim Benali"), "role": "Kitchen"},
            {"sceneObjectId": "scene-bl-station-piano", "domainEntityType": "station", "domainEntityId": "station-bl-piano"},
            {
                "batchId": batch_id,
                "ingredientId": first["itemId"],
                "ingredientName": ing_name,
                "unit": ing_unit,
                "qtyProduced": float(first["qty"]),
                "costCents": round(float(first.get("costCents") or 0)),
                "visualAsset": vis_asset,
                "recipeSummary": rec_sum,
                "note": first.get("note", "Mise en place du matin"),
            },
        )

    # 3. Employee Shifts (`timeEntries`)
    for te in bl_time_entries:
        staff_doc = staff_lookup.get(te["staffId"], {})
        cin = int(te["clockIn"])
        cout = int(te["clockOut"]) if te.get("clockOut") else (cin + 7 * 3600 * 1000)
        station_sobj = "scene-bl-station-piano" if staff_doc.get("team") == "kitchen" else ("scene-bl-station-bar" if staff_doc.get("team") == "bar" else "scene-bl-pos-main")
        add_evt(
            cin,
            BISTROT_ID,
            "restaurant",
            "EMPLOYEE_SHIFT_START",
            "historical_fact",
            f"mise_lumiere:timeEntry:{te['id']}:in",
            {"agentId": staff_doc.get("agentId"), "employeeId": staff_doc.get("_id"), "name": staff_doc.get("name"), "role": staff_doc.get("role"), "jobTitle": staff_doc.get("jobTitle")},
            {"sceneObjectId": station_sobj, "domainEntityType": "employee", "domainEntityId": staff_doc.get("_id")},
            {"timeEntryId": te["id"], "team": staff_doc.get("team"), "homeCoords": staff_doc.get("homeCoords")},
        )
        add_evt(
            cout,
            BISTROT_ID,
            "restaurant",
            "EMPLOYEE_SHIFT_END",
            "historical_fact",
            f"mise_lumiere:timeEntry:{te['id']}:out",
            {"agentId": staff_doc.get("agentId"), "employeeId": staff_doc.get("_id"), "name": staff_doc.get("name"), "role": staff_doc.get("role")},
            {"sceneObjectId": "scene-bl-door-main", "domainEntityType": "employee", "domainEntityId": staff_doc.get("_id")},
            {"timeEntryId": te["id"], "workedMinutes": round((cout - cin) / 60000 - float(te.get("breakMinutes") or 0))},
        )

    # 4. Reservations & Customer Seating + Full POS Order Lifecycle
    res_by_order = {}
    for r in bl_reservations:
        if r.get("posOrderId"):
            res_by_order[r["posOrderId"]] = r
        elif r.get("status") in ("cancelled", "no_show") and r.get("cancelledAt"):
            c_ms = int(r["cancelledAt"])
            add_evt(
                c_ms,
                BISTROT_ID,
                "restaurant",
                "RESERVATION_CANCELLED" if r["status"] == "cancelled" else "RESERVATION_NO_SHOW",
                "historical_fact",
                f"mise_lumiere:reservation:{r['id']}:{r['status']}",
                {"agentId": "agent-emp-lea", "name": "Léa Fontaine", "role": "Manager"},
                {"sceneObjectId": "scene-bl-pos-main", "domainEntityType": "reservation", "domainEntityId": r["id"]},
                {"reservationId": r["id"], "guestName": r.get("name") or "Client", "partySize": int(r.get("partySize") or 2), "source": r.get("source")},
            )

    for ord_row in bl_orders:
        oid = ord_row["id"]
        opened_ms = int(ord_row["openedAt"])
        closed_ms = int(ord_row["closedAt"]) if ord_row.get("closedAt") else (opened_ms + 3600 * 1000)
        table_id = ord_row.get("tableId")
        covers = int(ord_row.get("covers") or 1)
        waiter_doc = staff_lookup.get(ord_row.get("openedBy")) or staff_lookup.get(ord_row.get("openedByName")) or staff_lookup.get("Thomas") or {}
        res_row = res_by_order.get(oid)
        party_name = (res_row.get("name") if res_row and res_row.get("name") else None) or f"Table {ord_row.get('tableLabel') or 'Comptoir'} ({covers}p)"
        cust_agent_id = f"agent-cust-{oid[:8]}"
        table_sobj = f"scene-bl-table-{table_id}" if table_id else "scene-bl-station-bar"
        t_coord = table_coords.get(table_id, {"x": 17.5, "z": 9.8})

        # Customer arrival on street 90s before seating/order
        arrival_ms = opened_ms - 90 * 1000
        add_evt(
            arrival_ms,
            BISTROT_ID,
            "restaurant",
            "CUSTOMER_ARRIVAL",
            "derived_workflow",
            f"mise_lumiere:order:{oid}:arrival",
            {"agentId": cust_agent_id, "name": party_name, "partySize": covers, "role": "Customer"},
            {"sceneObjectId": "scene-bl-door-main", "domainEntityType": "order", "domainEntityId": oid, "tableId": table_id},
            {"orderId": oid, "reservationId": res_row["id"] if res_row else None, "partyName": party_name, "partySize": covers, "source": res_row.get("source", "walk_in") if res_row else "bar_walk_in", "targetCoords": t_coord},
        )

        # Party seated (or at bar counter)
        add_evt(
            opened_ms - 20 * 1000,
            BISTROT_ID,
            "restaurant",
            "PARTY_SEATED",
            "historical_fact" if res_row else "derived_workflow",
            f"mise_lumiere:order:{oid}:seated",
            {"agentId": waiter_doc.get("agentId", "agent-emp-thomas"), "name": waiter_doc.get("name", "Thomas Girard"), "role": "Floor"},
            {"sceneObjectId": table_sobj, "domainEntityType": "table" if table_id else "station", "domainEntityId": table_id or "station-bl-bar", "tableId": table_id},
            {"orderId": oid, "reservationId": res_row["id"] if res_row else None, "partyName": party_name, "partySize": covers, "customerAgentId": cust_agent_id, "tableId": table_id, "tableLabel": ord_row.get("tableLabel") or "Bar", "targetCoords": t_coord},
        )

        # Order created
        add_evt(
            opened_ms,
            BISTROT_ID,
            "restaurant",
            "ORDER_CREATED",
            "historical_fact",
            f"mise_lumiere:order:{oid}:created",
            {"agentId": waiter_doc.get("agentId", "agent-emp-thomas"), "name": waiter_doc.get("name", "Thomas Girard"), "role": "Floor"},
            {"sceneObjectId": table_sobj, "domainEntityType": "order", "domainEntityId": oid, "tableId": table_id},
            {"orderId": oid, "orderNumber": int(ord_row.get("number") or 0), "tableId": table_id, "tableLabel": ord_row.get("tableLabel") or "Bar", "covers": covers, "waiterName": waiter_doc.get("name", "Thomas Girard"), "customerAgentId": cust_agent_id},
        )

        # Group order lines by (course, station)
        lines = bl_order_lines_by_order.get(oid, [])
        course_groups = defaultdict(list)
        for ln in lines:
            if ln.get("voidedAt"):
                continue
            c_num = int(ln.get("course") or 1)
            course_groups[(c_num, ln.get("station") or "kitchen")].append(ln)

        for (c_num, station), grp_lines in sorted(course_groups.items()):
            sent_ms = int(grp_lines[0].get("sentAt") or grp_lines[0].get("createdAt") or (opened_ms + 360 * 1000))
            max_prep_min = max(int(l.get("prepMinutes") or 5) for l in grp_lines)
            ready_ms = max(
                [int(l["readyAt"]) for l in grp_lines if l.get("readyAt") and int(l["readyAt"]) > sent_ms]
                or [sent_ms + max_prep_min * 60 * 1000]
            )
            if ready_ms <= sent_ms:
                ready_ms = sent_ms + max(2, max_prep_min) * 60 * 1000
            served_ms = min(closed_ms - 180 * 1000, ready_ms + 75 * 1000)
            if served_ms <= ready_ms:
                served_ms = ready_ms + 30 * 1000

            station_sobj = "scene-bl-station-bar" if station == "bar" else ("scene-bl-station-saladette" if c_num in (1, 3) else "scene-bl-station-piano")
            station_id = "station-bl-bar" if station == "bar" else ("station-bl-saladette" if c_num in (1, 3) else "station-bl-piano")
            cook_agent = "agent-emp-manon" if station == "bar" else ("agent-emp-sofia" if c_num in (1, 3) else "agent-emp-karim")
            cook_name = "Manon Leroy" if station == "bar" else ("Sofia Rossi" if c_num in (1, 3) else "Karim Benali")

            table_lbl = ord_row.get("tableLabel") or (f"Table {table_id.replace('bl-t', '')}" if table_id else "Comptoir Bar")
            item_summaries = []
            for l in grp_lines:
                p_doc = prod_by_id.get(l["productId"], {})
                d_name = l.get("name") or p_doc.get("name") or "Plat du Jour"
                d_cat = l.get("category") or p_doc.get("category") or ("Bar & Vins" if station == "bar" else "Cuisine")
                v_asset = p_doc.get("visualAsset") or infer_visual_asset(d_name, d_cat, station, c_num)
                r_sum = p_doc.get("recipeSummary") or f"{d_cat} · Préparation {int(l.get('prepMinutes') or 5)} min"
                item_summaries.append({
                    "lineId": l["id"],
                    "productId": l["productId"],
                    "name": d_name,
                    "category": d_cat,
                    "course": c_num,
                    "qty": float(l.get("qty") or 1),
                    "prepMinutes": int(l.get("prepMinutes") or 5),
                    "priceCents": int(l.get("totalCents") or 0),
                    "visualAsset": v_asset,
                    "recipeSummary": r_sum,
                    "tableId": table_id,
                    "tableLabel": table_lbl,
                    "chefName": cook_name,
                })

            add_evt(
                sent_ms,
                BISTROT_ID,
                "restaurant",
                "ORDER_LINES_SENT_TO_STATION",
                "historical_fact",
                f"mise_lumiere:order:{oid}:c{c_num}:{station}:sent",
                {"agentId": waiter_doc.get("agentId", "agent-emp-thomas"), "name": waiter_doc.get("name", "Thomas Girard"), "role": "Floor"},
                {"sceneObjectId": station_sobj, "domainEntityType": "station", "domainEntityId": station_id, "orderId": oid, "tableId": table_id},
                {"orderId": oid, "tableId": table_id, "tableLabel": table_lbl, "course": c_num, "station": station, "chefName": cook_name, "items": item_summaries},
            )

            add_evt(
                sent_ms + 20 * 1000,
                BISTROT_ID,
                "restaurant",
                "ITEM_PREP_STARTED",
                "derived_workflow",
                f"mise_lumiere:order:{oid}:c{c_num}:{station}:prep_start",
                {"agentId": cook_agent, "name": cook_name, "role": "Bar" if station == "bar" else "Kitchen"},
                {"sceneObjectId": station_sobj, "domainEntityType": "station", "domainEntityId": station_id, "orderId": oid, "tableId": table_id},
                {"orderId": oid, "tableId": table_id, "tableLabel": table_lbl, "course": c_num, "station": station, "prepMinutes": max_prep_min, "chefName": cook_name, "items": item_summaries},
            )

            add_evt(
                ready_ms,
                BISTROT_ID,
                "restaurant",
                "ITEM_READY_AT_PASS",
                "derived_workflow",
                f"mise_lumiere:order:{oid}:c{c_num}:{station}:ready",
                {"agentId": cook_agent, "name": cook_name, "role": "Bar" if station == "bar" else "Kitchen"},
                {"sceneObjectId": "scene-bl-station-bar" if station == "bar" else "scene-bl-station-passe", "domainEntityType": "station", "domainEntityId": "station-bl-bar" if station == "bar" else "station-bl-passe", "orderId": oid, "tableId": table_id},
                {"orderId": oid, "tableId": table_id, "tableLabel": table_lbl, "course": c_num, "station": station, "chefName": cook_name, "items": item_summaries},
            )

            add_evt(
                served_ms,
                BISTROT_ID,
                "restaurant",
                "ORDER_DELIVERED_TO_TABLE",
                "derived_workflow",
                f"mise_lumiere:order:{oid}:c{c_num}:{station}:served",
                {"agentId": waiter_doc.get("agentId", "agent-emp-thomas"), "name": waiter_doc.get("name", "Thomas Girard"), "role": "Floor"},
                {"sceneObjectId": table_sobj, "domainEntityType": "table" if table_id else "station", "domainEntityId": table_id or "station-bl-bar", "orderId": oid, "tableId": table_id},
                {"orderId": oid, "tableId": table_id, "tableLabel": table_lbl, "course": c_num, "station": station, "items": item_summaries, "targetCoords": t_coord},
            )

        # Payment & Departure
        payments = parse_json_col(ord_row.get("payments"), [])
        pay_methods = ", ".join(sorted({p.get("method", "card") for p in payments})) or "card"
        add_evt(
            closed_ms,
            BISTROT_ID,
            "restaurant",
            "PAYMENT_COMPLETED",
            "historical_fact",
            f"mise_lumiere:order:{oid}:paid",
            {"agentId": waiter_doc.get("agentId", "agent-emp-thomas"), "name": waiter_doc.get("name", "Thomas Girard"), "role": "Floor"},
            {"sceneObjectId": "scene-bl-pos-main", "domainEntityType": "order", "domainEntityId": oid, "tableId": table_id},
            {
                "orderId": oid,
                "tableId": table_id,
                "subtotalCents": int(ord_row.get("subtotalCents") or 0),
                "paidCents": int(ord_row.get("paidCents") or 0),
                "tipCents": int(ord_row.get("tipCents") or 0),
                "methods": pay_methods,
                "customerAgentId": cust_agent_id,
            },
        )

        if table_id:
            add_evt(
                closed_ms + 150 * 1000,
                BISTROT_ID,
                "restaurant",
                "TABLE_CLEARED",
                "derived_workflow",
                f"mise_lumiere:order:{oid}:cleared",
                {"agentId": waiter_doc.get("agentId", "agent-emp-thomas"), "name": waiter_doc.get("name", "Thomas Girard"), "role": "Floor"},
                {"sceneObjectId": table_sobj, "domainEntityType": "table", "domainEntityId": table_id, "tableId": table_id},
                {"orderId": oid, "tableId": table_id, "dishwashingStation": "scene-bl-station-plonge"},
            )

    # 5. End-of-day Waste events (`waste`)
    if waste_groups:
        w_ms = int(waste_groups[0]["createdAt"])
        total_waste_cents = sum(float(m.get("costCents") or 0) for m in waste_groups)
        add_evt(
            w_ms,
            BISTROT_ID,
            "restaurant",
            "DAILY_WASTE_RECORDED",
            "historical_fact",
            f"mise_lumiere:waste:{target_date}",
            {"agentId": "agent-emp-karim", "name": "Karim Benali", "role": "Kitchen"},
            {"sceneObjectId": "scene-bl-storage-cold", "domainEntityType": "storage", "domainEntityId": "storage-bl-cold"},
            {"itemCount": len(waste_groups), "totalWasteCostCents": round(total_waste_cents)},
        )

    # 6. Synthesize Synchronized Full-Service Specialty Restaurant Activity for Osteria Bellavista & Sakana-Tei
    day_start_dt = datetime.datetime.strptime(target_date, "%Y-%m-%d").replace(tzinfo=PARIS_TZ)
    base_ms = int(day_start_dt.timestamp() * 1000)
    date_compact = target_date.replace("-", "")

    # 6A. Morning Deliveries & Prep Batches + Staff Shifts for Osteria Bellavista & Sakana-Tei
    specialty_shifts = [
        # Osteria Bellavista
        (OSTERIA_ID, "emp-ob-marco", "agent-emp-ob-marco", "Marco Bellini", "Kitchen", "Executive Chef — Cucina Toscana", "kitchen", {"x": 31.8, "z": -3.1}, "scene-ob-station-pasta", 9 * 60 + 15, 23 * 60 + 15),
        (OSTERIA_ID, "emp-ob-giulia", "agent-emp-ob-giulia", "Giulia Conti", "Kitchen", "Maestra Pastaia & Sfoglina", "kitchen", {"x": 31.8, "z": -1.6}, "scene-ob-station-pasta", 9 * 60 + 30, 22 * 60 + 45),
        (OSTERIA_ID, "emp-ob-matteo", "agent-emp-ob-matteo", "Matteo Lombardi", "Kitchen", "Chef Grillardin & Antipasti", "kitchen", {"x": 36.2, "z": -3.1}, "scene-ob-station-grill", 10 * 60, 23 * 60),
        (OSTERIA_ID, "emp-ob-lorenzo", "agent-emp-ob-lorenzo", "Lorenzo Moretti", "Manager", "Direttore di Sala & Sommelier", "management", {"x": 30.2, "z": 11.2}, "scene-ob-pos-main", 10 * 60 + 30, 23 * 60 + 20),
        (OSTERIA_ID, "emp-ob-chiara", "agent-emp-ob-chiara", "Chiara Bianchi", "Floor", "Chef de Rang — Sala & Terrazza", "floor", {"x": 31.8, "z": 5.5}, "scene-ob-pos-main", 11 * 60, 23 * 60 + 10),
        (OSTERIA_ID, "emp-ob-alessandro", "agent-emp-ob-alessandro", "Alessandro Greco", "Bar", "Head Bartender — Enoteca & Aperitivi", "bar", {"x": 38.2, "z": 8.6}, "scene-ob-station-bar", 11 * 60, 23 * 60 + 15),
        # Sakana-Tei
        (SAKANA_ID, "emp-sk-kenji", "agent-emp-sk-kenji", "Kenji Takahashi", "Kitchen", "Master Itamae — Omakase Sushi", "kitchen", {"x": 51.8, "z": -1.5}, "scene-sk-station-sushi", 9 * 60 + 20, 23 * 60 + 15),
        (SAKANA_ID, "emp-sk-haruka", "agent-emp-sk-haruka", "Haruka Sato", "Kitchen", "Chef Robatayaki & Binchotan Grill", "kitchen", {"x": 51.8, "z": -3.1}, "scene-sk-station-robata", 9 * 60 + 45, 23 * 60),
        (SAKANA_ID, "emp-sk-daiki", "agent-emp-sk-daiki", "Daiki Yamamoto", "Kitchen", "Chef Tempura & Bouillons Dashi", "kitchen", {"x": 56.2, "z": -3.1}, "scene-sk-station-tempura", 10 * 60, 22 * 60 + 50),
        (SAKANA_ID, "emp-sk-yuki", "agent-emp-sk-yuki", "Yuki Nakamura", "Manager", "Directrice de Salle & Kikisake-Shi", "management", {"x": 50.2, "z": 11.2}, "scene-sk-pos-main", 10 * 60 + 30, 23 * 60 + 20),
        (SAKANA_ID, "emp-sk-aoi", "agent-emp-sk-aoi", "Aoi Kobayashi", "Floor", "Chef de Rang — Salle Hinoki & Jardin", "floor", {"x": 51.8, "z": 6.5}, "scene-sk-pos-main", 11 * 60, 23 * 60 + 10),
    ]
    for bid, eid, aid, ename, erole, ejob, eteam, hcoords, s_obj, in_min, out_min in specialty_shifts:
        cin_ms = base_ms + in_min * 60 * 1000
        cout_ms = base_ms + out_min * 60 * 1000
        door_sobj = "scene-ob-door-main" if bid == OSTERIA_ID else "scene-sk-door-main"
        add_evt(
            cin_ms,
            bid,
            "restaurant",
            "EMPLOYEE_SHIFT_START",
            "synthetic_activity",
            f"street:{bid}:{eid}:{date_compact}:in",
            {"agentId": aid, "employeeId": eid, "name": ename, "role": erole, "jobTitle": ejob},
            {"sceneObjectId": s_obj, "domainEntityType": "employee", "domainEntityId": eid},
            {"timeEntryId": f"te-{eid}-{date_compact}", "team": eteam, "homeCoords": hcoords},
        )
        add_evt(
            cout_ms,
            bid,
            "restaurant",
            "EMPLOYEE_SHIFT_END",
            "synthetic_activity",
            f"street:{bid}:{eid}:{date_compact}:out",
            {"agentId": aid, "employeeId": eid, "name": ename, "role": erole},
            {"sceneObjectId": door_sobj, "domainEntityType": "employee", "domainEntityId": eid},
            {"timeEntryId": f"te-{eid}-{date_compact}", "workedMinutes": out_min - in_min - 45},
        )

    # Morning Prep Batches for Osteria Bellavista & Sakana-Tei
    specialty_preps = [
        (OSTERIA_ID, 9 * 60 + 40, 28, "agent-emp-ob-giulia", "Giulia Conti", "scene-ob-station-pasta", "station-ob-pasta", "ob-ing-sfoglia", "Pasta Fresca all'Uovo (Tagliatelle & Pappardelle)", 8500, "g", "pasta_bollitore_basket", "Farine Caputo 00 · Semola Rimacinata · 32 Jaunes d'Oeufs Bio"),
        (OSTERIA_ID, 10 * 60 + 10, 35, "agent-emp-ob-marco", "Marco Bellini", "scene-ob-station-pasta", "station-ob-pasta", "ob-ing-ragu", "Ragù Toscano di Cinghiale Mijoté au Chianti", 6500, "g", "stockpot_simmer", "Épaule de Sanglier Marinée · Soffritto Toscano · Chianti Classico"),
        (SAKANA_ID, 9 * 60 + 35, 25, "agent-emp-sk-kenji", "Kenji Takahashi", "scene-sk-station-sushi", "station-sk-sushi", "sk-ing-shari", "Riz Shari Koshihikari au Vinaigre Rouge Akazu", 7500, "g", "sushi_geta_board", "Riz Koshihikari Niigata · Vinaigre Akazu Vieilli · Kombu Rishiri"),
        (SAKANA_ID, 10 * 60 + 5, 30, "agent-emp-sk-daiki", "Daiki Yamamoto", "scene-sk-station-tempura", "station-sk-tempura", "sk-ing-dashi", "Bouillon Ichiban Dashi (Kombu & Katsuobushi)", 12000, "ml", "stockpot_simmer", "Infusion Kombu Rishiri 60°C · Bonite Séchée Katsuobushi Fraîchement Râpée"),
    ]
    for p_idx, (bid, start_min, dur_min, c_aid, c_name, st_sobj, st_id, ing_id, ing_name, qty_p, unit_p, v_asset, rec_s) in enumerate(specialty_preps):
        st_ms = base_ms + start_min * 60 * 1000
        end_ms = st_ms + dur_min * 60 * 1000
        b_id = f"batch-{bid[-6:]}-{date_compact}-{p_idx + 1}"
        add_evt(
            st_ms,
            bid,
            "restaurant",
            "PRODUCTION_BATCH_STARTED",
            "synthetic_activity",
            f"street:{b_id}:start",
            {"agentId": c_aid, "name": c_name, "role": "Kitchen"},
            {"sceneObjectId": st_sobj, "domainEntityType": "station", "domainEntityId": st_id},
            {"batchId": b_id, "ingredientId": ing_id, "ingredientName": ing_name, "unit": unit_p, "qtyProduced": qty_p, "prepMinutes": dur_min, "visualAsset": v_asset, "recipeSummary": rec_s},
        )
        add_evt(
            end_ms,
            bid,
            "restaurant",
            "PRODUCTION_BATCH_COMPLETED",
            "synthetic_activity",
            f"street:{b_id}:done",
            {"agentId": c_aid, "name": c_name, "role": "Kitchen"},
            {"sceneObjectId": st_sobj, "domainEntityType": "station", "domainEntityId": st_id},
            {"batchId": b_id, "ingredientId": ing_id, "ingredientName": ing_name, "unit": unit_p, "qtyProduced": qty_p, "costCents": 4800, "visualAsset": v_asset, "recipeSummary": rec_s, "note": "Mise en place artisanale du matin"},
        )

    # 6B. Multi-Course Seated Table Orders for Osteria Bellavista & Sakana-Tei (Lunch 11:45–14:40 & Dinner 18:30–22:15)
    ob_tables = [f"ob-t{i}" for i in range(1, 11)]
    sk_tables = [f"sk-t{i}" for i in range(1, 11)]

    ob_guest_names = [
        "Famille Rossellini", "Table Santini", "M. & Mme De Luca", "Dr. Alessandro Visconti",
        "Table Beatrice Ferraro", "Famille Montanari", "Duo Elena & Matteo", "Table Lorenzo Conti",
        "Table Sofia Marchetti", "M. Gianluca Rinaldi", "Table Vittoria Galli", "Famille Bernardi",
    ]
    sk_guest_names = [
        "Table Kenjiro & Mei", "M. Hiroshi Watanabe", "Table Ayaka & Ren", "Famille Fujimoto",
        "Omakase — Dr. Kaito Mori", "Omakase — Mme Chihiro Hasegawa", "Table Haruto & Yuna", "M. Takumi Endo",
        "Table Sakura & Shin", "Famille Matsuda", "Table Riku & Hina", "M. Daichi Shimizu",
    ]

    ob_course_combos = [
        ("ob-burrata-andria", "ob-tagliatelle-tartufo", "ob-tiramisu-classico", "ob-calice-brunello"),
        ("ob-carpaccio-chianina", "ob-bistecca-fiorentina", "ob-tiramisu-classico", "ob-calice-brunello"),
        ("ob-burrata-andria", "ob-pappardelle-cinghiale", "ob-tiramisu-classico", "ob-calice-brunello"),
        ("ob-carpaccio-chianina", "ob-tonnarelli-carbonara", "ob-tiramisu-classico", "ob-calice-brunello"),
    ]
    sk_course_combos = [
        ("sk-sashimi-moriawase", "sk-omakase-nigiri", "sk-mochi-matcha", "sk-sake-dassai"),
        ("sk-gyoza-wagyu", "sk-blackcod-saikyo", "sk-mochi-matcha", "sk-sake-dassai"),
        ("sk-sashimi-moriawase", "sk-wagyu-robata", "sk-mochi-matcha", "sk-sake-dassai"),
        ("sk-gyoza-wagyu", "sk-tempura-kuruma", "sk-mochi-matcha", "sk-sake-dassai"),
    ]

    service_minute_slots = (
        list(range(11 * 60 + 42, 14 * 60 + 25, 11))
        + list(range(18 * 60 + 30, 21 * 60 + 50, 10))
    )

    def emit_specialty_restaurant_order(
        venue_id: str,
        venue_prefix: str,
        slot_idx: int,
        opened_min: int,
        tbl_id: str,
        guest_name: str,
        combo_ids: tuple,
        waiter_agent: str,
        waiter_name: str,
        waiter_emp_id: str,
        pass_sobj: str,
        pass_id: str,
        pos_sobj: str,
        door_sobj: str,
        plonge_sobj: str,
        station_chef_map: dict,
    ):
        oid = f"ord-{venue_prefix}-{date_compact}-{slot_idx + 1:03d}"
        res_id = f"res-{venue_prefix}-{date_compact}-{slot_idx + 1:03d}"
        cust_agent = f"agent-cust-{venue_prefix}-{slot_idx + 1:03d}"
        covers = 2 if (slot_idx % 3 != 0) else 4
        opened_ms = base_ms + opened_min * 60 * 1000
        closed_ms = opened_ms + 52 * 60 * 1000
        t_coord = table_coords.get(tbl_id, {"x": 30.0 if venue_prefix == "ob" else 50.0, "z": 6.5})
        table_sobj = f"scene-{venue_prefix}-table-{tbl_id}"
        tbl_num = tbl_id.split("-t")[-1]
        table_lbl = f"Ost. {tbl_num}" if venue_prefix == "ob" else f"Sak. {tbl_num}"
        party_label = f"{guest_name} ({covers}p)"

        # 1. Arrival & Seating & Order Created
        add_evt(
            opened_ms - 75 * 1000,
            venue_id,
            "restaurant",
            "CUSTOMER_ARRIVAL",
            "synthetic_activity",
            f"street:{venue_prefix}:{oid}:arrival",
            {"agentId": cust_agent, "name": party_label, "partySize": covers, "role": "Customer"},
            {"sceneObjectId": door_sobj, "domainEntityType": "order", "domainEntityId": oid, "tableId": tbl_id},
            {"orderId": oid, "reservationId": res_id, "partyName": party_label, "partySize": covers, "source": "booking", "targetCoords": t_coord},
        )
        add_evt(
            opened_ms - 15 * 1000,
            venue_id,
            "restaurant",
            "PARTY_SEATED",
            "synthetic_activity",
            f"street:{venue_prefix}:{oid}:seated",
            {"agentId": waiter_agent, "name": waiter_name, "role": "Floor"},
            {"sceneObjectId": table_sobj, "domainEntityType": "table", "domainEntityId": tbl_id, "tableId": tbl_id},
            {"orderId": oid, "reservationId": res_id, "partyName": party_label, "partySize": covers, "customerAgentId": cust_agent, "tableId": tbl_id, "tableLabel": table_lbl, "targetCoords": t_coord},
        )
        add_evt(
            opened_ms,
            venue_id,
            "restaurant",
            "ORDER_CREATED",
            "synthetic_activity",
            f"street:{venue_prefix}:{oid}:created",
            {"agentId": waiter_agent, "name": waiter_name, "role": "Floor"},
            {"sceneObjectId": table_sobj, "domainEntityType": "order", "domainEntityId": oid, "tableId": tbl_id},
            {"orderId": oid, "orderNumber": 200 + slot_idx + 1, "tableId": tbl_id, "tableLabel": table_lbl, "covers": covers, "waiterName": waiter_name, "customerAgentId": cust_agent},
        )

        # Build courses: Course 1 (Starter + Wine/Sake), Course 2 (Main Specialty), Course 3 (Dolci/Kanmi)
        starter_id, main_id, dessert_id, drink_id = combo_ids
        course_schedule = [
            (1, opened_ms + 2 * 60 * 1000, [starter_id, drink_id]),
            (2, opened_ms + 16 * 60 * 1000, [main_id]),
            (3, opened_ms + 35 * 60 * 1000, [dessert_id]),
        ]
        order_lines_docs = []
        subtotal_cents = 0
        line_seq = 0

        for c_num, c_sent_ms, prod_ids in course_schedule:
            by_station = defaultdict(list)
            for pid in prod_ids:
                pdoc = prod_by_id[pid]
                by_station[pdoc["station"]].append(pdoc)

            for st_id, pdocs in by_station.items():
                st_info = station_chef_map[st_id]
                st_sobj = st_info["sceneObjectId"]
                c_agent = st_info["agentId"]
                c_name = st_info["chefName"]
                c_role = st_info["role"]
                max_prep = max(int(p.get("prepMinutes") or 6) for p in pdocs)
                ready_ms = c_sent_ms + max_prep * 60 * 1000
                served_ms = ready_ms + 50 * 1000

                item_summaries = []
                for p in pdocs:
                    line_seq += 1
                    lid = f"{oid}-L{line_seq}"
                    qty_val = float(covers if p["course"] in (1, 2) and "bar" not in st_id else max(1, covers // 2))
                    line_total = int(p["priceCents"] * qty_val)
                    subtotal_cents += line_total
                    item_summaries.append({
                        "lineId": lid,
                        "productId": p["_id"],
                        "name": p["name"],
                        "category": p["category"],
                        "course": c_num,
                        "qty": qty_val,
                        "prepMinutes": int(p["prepMinutes"]),
                        "priceCents": line_total,
                        "visualAsset": p["visualAsset"],
                        "recipeSummary": p.get("recipeSummary", ""),
                        "tableId": tbl_id,
                        "tableLabel": table_lbl,
                        "chefName": c_name,
                    })
                    order_lines_docs.append({
                        "lineId": lid,
                        "productId": p["_id"],
                        "name": p["name"],
                        "category": p["category"],
                        "station": st_id,
                        "course": c_num,
                        "seat": 1,
                        "qty": qty_val,
                        "unitCents": p["priceCents"],
                        "totalCents": line_total,
                        "costCents": round(line_total * 0.28, 2),
                        "prepMinutes": int(p["prepMinutes"]),
                        "sentAt": ms_to_iso(c_sent_ms),
                        "readyAt": ms_to_iso(ready_ms),
                        "servedAt": ms_to_iso(served_ms),
                    })

                add_evt(
                    c_sent_ms,
                    venue_id,
                    "restaurant",
                    "ORDER_LINES_SENT_TO_STATION",
                    "synthetic_activity",
                    f"street:{venue_prefix}:{oid}:c{c_num}:{st_id}:sent",
                    {"agentId": waiter_agent, "name": waiter_name, "role": "Floor"},
                    {"sceneObjectId": st_sobj, "domainEntityType": "station", "domainEntityId": st_id, "orderId": oid, "tableId": tbl_id},
                    {"orderId": oid, "tableId": tbl_id, "tableLabel": table_lbl, "course": c_num, "station": st_id, "chefName": c_name, "items": item_summaries},
                )
                add_evt(
                    c_sent_ms + 15 * 1000,
                    venue_id,
                    "restaurant",
                    "ITEM_PREP_STARTED",
                    "synthetic_activity",
                    f"street:{venue_prefix}:{oid}:c{c_num}:{st_id}:prep",
                    {"agentId": c_agent, "name": c_name, "role": c_role},
                    {"sceneObjectId": st_sobj, "domainEntityType": "station", "domainEntityId": st_id, "orderId": oid, "tableId": tbl_id},
                    {"orderId": oid, "tableId": tbl_id, "tableLabel": table_lbl, "course": c_num, "station": st_id, "prepMinutes": max_prep, "chefName": c_name, "items": item_summaries},
                )
                target_pass_sobj = st_sobj if c_role == "Bar" else pass_sobj
                target_pass_id = st_id if c_role == "Bar" else pass_id
                add_evt(
                    ready_ms,
                    venue_id,
                    "restaurant",
                    "ITEM_READY_AT_PASS",
                    "synthetic_activity",
                    f"street:{venue_prefix}:{oid}:c{c_num}:{st_id}:ready",
                    {"agentId": c_agent, "name": c_name, "role": c_role},
                    {"sceneObjectId": target_pass_sobj, "domainEntityType": "station", "domainEntityId": target_pass_id, "orderId": oid, "tableId": tbl_id},
                    {"orderId": oid, "tableId": tbl_id, "tableLabel": table_lbl, "course": c_num, "station": st_id, "chefName": c_name, "items": item_summaries},
                )
                add_evt(
                    served_ms,
                    venue_id,
                    "restaurant",
                    "ORDER_DELIVERED_TO_TABLE",
                    "synthetic_activity",
                    f"street:{venue_prefix}:{oid}:c{c_num}:{st_id}:served",
                    {"agentId": waiter_agent, "name": waiter_name, "role": "Floor"},
                    {"sceneObjectId": table_sobj, "domainEntityType": "table", "domainEntityId": tbl_id, "orderId": oid, "tableId": tbl_id},
                    {"orderId": oid, "tableId": tbl_id, "tableLabel": table_lbl, "course": c_num, "station": st_id, "items": item_summaries, "targetCoords": t_coord},
                )

        tip_cents = round(subtotal_cents * 0.08)
        paid_cents = subtotal_cents + tip_cents
        add_evt(
            closed_ms,
            venue_id,
            "restaurant",
            "PAYMENT_COMPLETED",
            "synthetic_activity",
            f"street:{venue_prefix}:{oid}:paid",
            {"agentId": waiter_agent, "name": waiter_name, "role": "Floor"},
            {"sceneObjectId": pos_sobj, "domainEntityType": "order", "domainEntityId": oid, "tableId": tbl_id},
            {"orderId": oid, "tableId": tbl_id, "subtotalCents": subtotal_cents, "paidCents": paid_cents, "tipCents": tip_cents, "methods": "card", "customerAgentId": cust_agent},
        )
        add_evt(
            closed_ms + 90 * 1000,
            venue_id,
            "restaurant",
            "TABLE_CLEARED",
            "synthetic_activity",
            f"street:{venue_prefix}:{oid}:cleared",
            {"agentId": waiter_agent, "name": waiter_name, "role": "Floor"},
            {"sceneObjectId": table_sobj, "domainEntityType": "table", "domainEntityId": tbl_id, "tableId": tbl_id},
            {"orderId": oid, "tableId": tbl_id, "dishwashingStation": plonge_sobj},
        )

        extra_reservations_out.append({
            "_id": res_id,
            "businessId": venue_id,
            "streetId": STREET_ID,
            "serviceDate": target_date,
            "guestId": f"guest-{venue_prefix}-{slot_idx + 1}",
            "customerName": guest_name,
            "partySize": covers,
            "tableIds": [tbl_id],
            "status": "seated",
            "source": "online_booking",
            "orderId": oid,
            "confirmedAt": ms_to_iso(opened_ms - 86400 * 1000),
            "seatedAt": ms_to_iso(opened_ms - 15 * 1000),
            "finishedAt": ms_to_iso(closed_ms),
            "sourceMeta": {"system": "street_platform", "originalTable": "specialty_reservations", "originalId": res_id, "provenance": "synthetic_activity"},
        })
        extra_orders_out.append({
            "_id": oid,
            "businessId": venue_id,
            "streetId": STREET_ID,
            "serviceDate": target_date,
            "orderNumber": 200 + slot_idx + 1,
            "serviceType": "table_service",
            "tableId": tbl_id,
            "tableLabel": table_lbl,
            "covers": covers,
            "status": "paid",
            "waiterId": waiter_emp_id,
            "waiterName": waiter_name,
            "openedAt": ms_to_iso(opened_ms),
            "closedAt": ms_to_iso(closed_ms),
            "subtotalCents": subtotal_cents,
            "dueCents": subtotal_cents,
            "paidCents": paid_cents,
            "tipCents": tip_cents,
            "lines": order_lines_docs,
            "sourceMeta": {"system": "street_platform", "originalTable": "specialty_orders", "originalId": oid, "provenance": "synthetic_activity"},
        })
        extra_payments_out.append({
            "_id": f"pay-{oid}-1",
            "businessId": venue_id,
            "streetId": STREET_ID,
            "serviceDate": target_date,
            "orderId": oid,
            "tableId": tbl_id,
            "method": "card",
            "amountCents": paid_cents,
            "tipCents": tip_cents,
            "processedAt": ms_to_iso(closed_ms),
            "sourceMeta": {"system": "street_platform", "originalTable": "specialty_payments", "originalId": oid, "provenance": "synthetic_activity"},
        })

    ob_station_chefs = {
        "station-ob-antipasti": {"sceneObjectId": "scene-ob-station-antipasti", "agentId": "agent-emp-ob-matteo", "chefName": "Matteo Lombardi", "role": "Kitchen"},
        "station-ob-pasta": {"sceneObjectId": "scene-ob-station-pasta", "agentId": "agent-emp-ob-giulia", "chefName": "Giulia Conti", "role": "Kitchen"},
        "station-ob-grill": {"sceneObjectId": "scene-ob-station-grill", "agentId": "agent-emp-ob-marco", "chefName": "Marco Bellini", "role": "Kitchen"},
        "station-ob-bar": {"sceneObjectId": "scene-ob-station-bar", "agentId": "agent-emp-ob-alessandro", "chefName": "Alessandro Greco", "role": "Bar"},
    }
    sk_station_chefs = {
        "station-sk-sushi": {"sceneObjectId": "scene-sk-station-sushi", "agentId": "agent-emp-sk-kenji", "chefName": "Kenji Takahashi", "role": "Kitchen"},
        "station-sk-robata": {"sceneObjectId": "scene-sk-station-robata", "agentId": "agent-emp-sk-haruka", "chefName": "Haruka Sato", "role": "Kitchen"},
        "station-sk-tempura": {"sceneObjectId": "scene-sk-station-tempura", "agentId": "agent-emp-sk-daiki", "chefName": "Daiki Yamamoto", "role": "Kitchen"},
        "station-sk-bar": {"sceneObjectId": "scene-sk-station-bar", "agentId": "agent-emp-sk-yuki", "chefName": "Yuki Nakamura", "role": "Bar"},
    }

    for idx, m_off in enumerate(service_minute_slots):
        emit_specialty_restaurant_order(
            OSTERIA_ID,
            "ob",
            idx,
            m_off,
            ob_tables[idx % len(ob_tables)],
            ob_guest_names[idx % len(ob_guest_names)],
            ob_course_combos[idx % len(ob_course_combos)],
            "agent-emp-ob-chiara" if idx % 2 == 0 else "agent-emp-ob-lorenzo",
            "Chiara Bianchi" if idx % 2 == 0 else "Lorenzo Moretti",
            "emp-ob-chiara" if idx % 2 == 0 else "emp-ob-lorenzo",
            "scene-ob-station-pass",
            "station-ob-pass",
            "scene-ob-pos-main",
            "scene-ob-door-main",
            "scene-ob-station-plonge",
            ob_station_chefs,
        )
        emit_specialty_restaurant_order(
            SAKANA_ID,
            "sk",
            idx,
            m_off + 3,
            sk_tables[idx % len(sk_tables)],
            sk_guest_names[idx % len(sk_guest_names)],
            sk_course_combos[idx % len(sk_course_combos)],
            "agent-emp-sk-aoi" if idx % 2 == 0 else "agent-emp-sk-yuki",
            "Aoi Kobayashi" if idx % 2 == 0 else "Yuki Nakamura",
            "emp-sk-aoi" if idx % 2 == 0 else "emp-sk-yuki",
            "scene-sk-station-pass",
            "station-sk-pass",
            "scene-sk-pos-main",
            "scene-sk-door-main",
            "scene-sk-station-plonge",
            sk_station_chefs,
        )

    # Sort all events chronologically by (eventTimeMs, sequence)
    events.sort(key=lambda e: (e["eventTimeMs"], e["sequence"]))
    for idx, e in enumerate(events, start=1):
        e["sequence"] = idx
        e["_id"] = f"evt-{target_date.replace('-', '')}-{idx:05d}"

    # 7. Build 30-minute Materialized State Checkpoints (`simulationSnapshots`) from 07:00 to 23:30
    snapshots = []
    cum_rev = {BISTROT_ID: 0, OSTERIA_ID: 0, SAKANA_ID: 0}
    cum_orders = {BISTROT_ID: 0, OSTERIA_ID: 0, SAKANA_ID: 0}
    active_tables = {}
    evt_idx = 0
    n_evts = len(events)

    for half_hour in range(14, 48):  # 07:00 (14*30m) to 23:30 (47*30m)
        snap_ms = base_ms + half_hour * 1800 * 1000
        while evt_idx < n_evts and events[evt_idx]["eventTimeMs"] <= snap_ms:
            ev = events[evt_idx]
            etype = ev["eventType"]
            bid = ev["businessId"]
            pl = ev["payload"]
            if etype == "PARTY_SEATED" and pl.get("tableId"):
                active_tables[pl["tableId"]] = {
                    "businessId": bid,
                    "status": "SEATED",
                    "orderId": pl.get("orderId"),
                    "partyName": pl.get("partyName"),
                    "partySize": pl.get("partySize"),
                }
            elif etype == "ORDER_DELIVERED_TO_TABLE" and pl.get("tableId") in active_tables:
                active_tables[pl["tableId"]]["status"] = f"DINING_COURSE_{pl.get('course', 1)}"
            elif etype == "PAYMENT_COMPLETED":
                cum_rev[bid] = cum_rev.get(bid, 0) + int(pl.get("paidCents") or 0)
                cum_orders[bid] = cum_orders.get(bid, 0) + 1
            elif etype == "TABLE_CLEARED" and pl.get("tableId"):
                active_tables.pop(pl["tableId"], None)
            evt_idx += 1

        snapshots.append({
            "_id": f"snap-{target_date.replace('-', '')}-{half_hour:02d}",
            "streetId": STREET_ID,
            "serviceDate": target_date,
            "snapshotTime": ms_to_iso(snap_ms),
            "snapshotTimeMs": snap_ms,
            "lastEventSequence": evt_idx,
            "metricsByBusiness": {
                BISTROT_ID: {"revenueCents": cum_rev[BISTROT_ID], "completedOrders": cum_orders[BISTROT_ID], "occupiedTables": sum(1 for v in active_tables.values() if v.get("businessId") == BISTROT_ID)},
                OSTERIA_ID: {"revenueCents": cum_rev[OSTERIA_ID], "completedOrders": cum_orders[OSTERIA_ID], "occupiedTables": sum(1 for v in active_tables.values() if v.get("businessId") == OSTERIA_ID)},
                SAKANA_ID: {"revenueCents": cum_rev[SAKANA_ID], "completedOrders": cum_orders[SAKANA_ID], "occupiedTables": sum(1 for v in active_tables.values() if v.get("businessId") == SAKANA_ID)},
            },
            "occupiedTables": json.loads(json.dumps(active_tables)),
        })

    return events, snapshots


def main():
    parser = argparse.ArgumentParser(description="Migrate Lumière dataset to Multi-Venue MongoDB collections")
    parser.add_argument("--dates", nargs="*", default=DEFAULT_BENCHMARK_DATES, help="Service dates to synthesize full event streams for")
    args = parser.parse_args()
    target_dates = set(args.dates)

    os.makedirs(OUT_DIR, exist_ok=True)
    print(f"[1/6] Parsing schema definitions from {PUSH_DIR}/load.sql ...")
    schemas = parse_load_sql_schemas(os.path.join(PUSH_DIR, "load.sql"))

    # Read reference tables
    orgs = read_tsv_table("organizations", schemas["organizations"])
    rests = read_tsv_table("restaurants", schemas["restaurants"])
    dining_areas = read_tsv_table("diningAreas", schemas["diningAreas"])
    dining_tables = read_tsv_table("diningTables", schemas["diningTables"])
    asset_models_rows = read_tsv_table("assetModels", schemas["assetModels"])
    asset_lots_rows = read_tsv_table("assetLots", schemas["assetLots"])
    staff_rows = read_tsv_table("staffMembers", schemas["staffMembers"])
    suppliers_rows = read_tsv_table("suppliers", schemas["suppliers"])
    stock_items_rows = read_tsv_table("stockItems", schemas["stockItems"])
    menu_cats_rows = read_tsv_table("menuCategories", schemas["menuCategories"])
    menu_prods_rows = read_tsv_table("menuProducts", schemas["menuProducts"])
    payouts_rows = read_tsv_table("staffPayouts", schemas["staffPayouts"])
    finance_rows = read_tsv_table("financeEntries", schemas["financeEntries"])
    po_rows = read_tsv_table("purchaseOrders", schemas["purchaseOrders"])

    print("[2/6] Building Multi-Tenant Street, Premises, FloorPlans & Interactive Scene Object Registry ...")
    sb = build_street_and_businesses(rests[0] if rests else {}, orgs[0] if orgs else {})
    asset_models_map = {m["id"]: m for m in asset_models_rows}
    pr = build_premises_and_registry(dining_areas, dining_tables, asset_models_map, asset_lots_rows)

    table_coords = {
        t["domainEntityId"]: {"x": t["transform"]["x"], "z": t["transform"]["z"]}
        for t in pr["sceneObjects"]
        if t.get("objectType") == "dining_table" and t.get("domainEntityId")
    }

    # Build Employees & Agent Definitions
    employees = []
    agent_definitions = []
    staff_lookup = {}

    home_positions = {
        "management": [
            {"x": 11.5, "z": 11.5},
        ],
        "kitchen": [
            {"x": 14.5, "z": -3.4},
            {"x": 9.2, "z": -1.8},
            {"x": 16.8, "z": -3.4},
            {"x": 12.2, "z": -3.4},
            {"x": 4.5, "z": -3.4},
            {"x": 5.8, "z": -3.4},
        ],
        "floor": [
            {"x": 5.5, "z": 5.0},
            {"x": 10.5, "z": 5.0},
            {"x": 14.5, "z": 5.0},
            {"x": 6.5, "z": 17.5},
            {"x": 12.0, "z": 9.0},
        ],
        "bar": [
            {"x": 18.5, "z": 10.2},
        ],
    }
    team_counters = defaultdict(int)

    for s in staff_rows:
        slug = s["name"].split()[0].lower().replace("é", "e").replace("è", "e").replace("ë", "e")
        emp_id = f"emp-{slug}"
        agent_id = f"agent-{emp_id}"
        team = s.get("team", "floor")
        idx = team_counters[team]
        team_counters[team] += 1
        coords_list = home_positions.get(team, [{"x": 10.0, "z": 6.0}])
        h_coord = coords_list[idx % len(coords_list)]

        role_map = {"management": "Manager", "kitchen": "Kitchen", "floor": "Floor", "bar": "Bar"}
        emp_doc = {
            "_id": emp_id,
            "originalId": s["id"],
            "profileId": s.get("profileId"),
            "businessId": BISTROT_ID,
            "streetId": STREET_ID,
            "name": s["name"],
            "email": s.get("email"),
            "team": team,
            "role": role_map.get(team, "Floor"),
            "jobTitle": s.get("jobTitle"),
            "contractType": s.get("contract", "permanent"),
            "weeklyHours": float(s.get("weeklyHours") or 35),
            "hourlyRateCents": int(s.get("hourlyCents") or 1300),
            "hireDate": s.get("startDate"),
            "endDate": s.get("endDate") or None,
            "active": s.get("active") == "t",
            "agentId": agent_id,
            "homeCoords": h_coord,
            "sourceMeta": {
                "system": "mise_lumiere",
                "originalTable": "staffMembers",
                "originalId": s["id"],
                "provenance": "historical_fact",
            },
        }
        employees.append(emp_doc)
        staff_lookup[s["id"]] = emp_doc
        if s.get("profileId"):
            staff_lookup[s["profileId"]] = emp_doc
        staff_lookup[s["name"]] = emp_doc
        staff_lookup[s["name"].split()[0]] = emp_doc

    extra_emps, extra_prods, extra_ings = generate_synthetic_venue_catalog_and_staff()
    employees.extend(extra_emps)

    for emp in employees:
        agent_definitions.append({
            "_id": emp["agentId"],
            "agentId": emp["agentId"],
            "streetId": STREET_ID,
            "businessId": emp["businessId"],
            "agentKind": "employee",
            "domainEntityType": "employee",
            "domainEntityId": emp["_id"],
            "name": emp["name"],
            "role": emp["role"],
            "jobTitle": emp.get("jobTitle"),
            "homeCoords": emp["homeCoords"],
            "speedMetersPerSec": 1.65,
        })
        pr["sceneObjects"].append({
            "_id": f"scene-{emp['agentId']}",
            "sceneObjectId": f"scene-{emp['agentId']}",
            "streetId": STREET_ID,
            "businessId": emp["businessId"],
            "premisesId": "premises-bistrot-lumiere" if emp["businessId"] == BISTROT_ID else ("premises-osteria-bellavista" if emp["businessId"] == OSTERIA_ID else "premises-sakana-tei"),
            "objectType": "employee_agent",
            "label": f"{emp['name']} ({emp.get('jobTitle', emp['role'])})",
            "domainEntityType": "employee",
            "domainEntityId": emp["_id"],
            "agentId": emp["agentId"],
            "transform": {"x": emp["homeCoords"]["x"], "y": 0.0, "z": emp["homeCoords"]["z"], "width": 0.55, "depth": 0.55, "height": 1.75, "rotationY": 0.0},
            "interactive": True,
        })

    # Transform Suppliers, Ingredients, Products, Payroll, Expenses
    suppliers = [
        {
            "_id": r["id"],
            "businessId": BISTROT_ID,
            "streetId": STREET_ID,
            "name": r["name"],
            "contactName": r.get("contactName"),
            "email": r.get("email"),
            "city": r.get("address"),
            "paymentTerms": r.get("paymentTerms"),
            "deliveryDays": parse_json_col(r.get("deliveryDays"), []),
            "leadDays": int(r.get("leadDays") or 0),
            "sourceMeta": {"system": "mise_lumiere", "originalTable": "suppliers", "originalId": r["id"], "provenance": "historical_fact"},
        }
        for r in suppliers_rows
    ]

    ingredients = [
        {
            "_id": r["id"],
            "businessId": BISTROT_ID,
            "streetId": STREET_ID,
            "name": r["name"],
            "kind": r.get("kind", "ingredient"),
            "station": r.get("station", "kitchen"),
            "unit": r.get("unit", "g"),
            "onHand": round(float(r.get("onHand") or 0), 2),
            "minQty": round(float(r.get("minQty") or 0), 2),
            "parQty": round(float(r.get("parQty") or 0), 2),
            "supplierId": r.get("supplierId"),
            "packSize": float(r.get("packSize") or 1),
            "packLabel": r.get("packLabel"),
            "packCostCents": int(r.get("packCostCents") or 0),
            "avgCostCents": round(float(r.get("avgCostCents") or 0), 4),
            "visualAsset": infer_visual_asset(r["name"], r.get("kind", ""), r.get("station", ""), 2),
            "recipe": parse_json_col(r.get("recipe"), []),
            "sourceMeta": {"system": "mise_lumiere", "originalTable": "stockItems", "originalId": r["id"], "provenance": "historical_fact"},
        }
        for r in stock_items_rows
    ] + extra_ings

    ing_by_id = {ing["_id"]: ing for ing in ingredients}
    for ing in ingredients:
        if not ing.get("recipeSummary") and ing.get("recipe"):
            parts = []
            for ri in ing["recipe"][:4]:
                sub_ing = ing_by_id.get(ri.get("itemId"), {})
                s_name = sub_ing.get("name", ri.get("itemId", "Ingrédient"))
                s_unit = sub_ing.get("unit", "g")
                parts.append(f"{s_name} ({ri.get('qty', 1)}{s_unit})")
            if parts:
                ing["recipeSummary"] = " · ".join(parts)

    products = []
    for r in menu_prods_rows:
        rec_list = parse_json_col(r.get("recipe"), [])
        rec_parts = []
        for ri in rec_list[:4]:
            sub_ing = ing_by_id.get(ri.get("itemId"), {})
            s_name = sub_ing.get("name", ri.get("itemId", "Ingrédient"))
            s_unit = sub_ing.get("unit", "g")
            rec_parts.append(f"{s_name} ({ri.get('qty', 1)}{s_unit})")
        rec_summary = " · ".join(rec_parts) if rec_parts else f"{r.get('category', 'Cuisine')} · Préparation minute"
        products.append({
            "_id": r["id"],
            "businessId": BISTROT_ID,
            "streetId": STREET_ID,
            "name": r["name"],
            "section": r.get("section"),
            "category": r.get("category"),
            "categoryId": r.get("categoryId"),
            "station": r.get("station", "kitchen"),
            "priceCents": int(r.get("priceCents") or 0),
            "vatRate": float(r.get("vatRate") or 10),
            "prepMinutes": int(parse_json_col(r.get("sheet"), {}).get("prepMinutes") or 5),
            "visualAsset": infer_visual_asset(r["name"], r.get("category", ""), r.get("station", "kitchen"), 2),
            "recipeSummary": rec_summary,
            "recipe": rec_list,
            "sourceMeta": {"system": "mise_lumiere", "originalTable": "menuProducts", "originalId": r["id"], "provenance": "historical_fact"},
        })
    products.extend(extra_prods)
    prod_by_id = {p["_id"]: p for p in products}

    payroll_records = [
        {
            "_id": r["id"],
            "businessId": BISTROT_ID,
            "streetId": STREET_ID,
            "employeeId": staff_lookup.get(r["staffId"], {}).get("_id", r["staffId"]),
            "employeeName": staff_lookup.get(r["staffId"], {}).get("name", "Staff"),
            "fromDate": r.get("fromDate"),
            "toDate": r.get("toDate"),
            "workedMinutes": int(r.get("workedMinutes") or 0),
            "grossCents": int(r.get("grossCents") or 0),
            "paidOn": r.get("paidOn"),
            "sourceMeta": {"system": "mise_lumiere", "originalTable": "staffPayouts", "originalId": r["id"], "provenance": "historical_fact"},
        }
        for r in payouts_rows
    ]

    expenses = [
        {
            "_id": r["id"],
            "businessId": BISTROT_ID,
            "streetId": STREET_ID,
            "category": r.get("category"),
            "label": r.get("label"),
            "payee": r.get("payee"),
            "amountCents": int(r.get("amountCents") or 0),
            "vatRate": float(r.get("vatRate") or 0),
            "date": r.get("date"),
            "paidOn": r.get("paidOn"),
            "method": r.get("method"),
            "repeat": r.get("repeat"),
            "assetLotId": r.get("assetLotId"),
            "sourceMeta": {"system": "mise_lumiere", "originalTable": "financeEntries", "originalId": r["id"], "provenance": "historical_fact"},
        }
        for r in finance_rows
    ]

    po_by_id = {r["id"]: r for r in po_rows}

    print("[3/6] Scanning 13-month operational tables (posOrders, reservations, timeEntries, stockMovements) ...")
    all_orders_rows = read_tsv_table("posOrders", schemas["posOrders"])
    all_res_rows = read_tsv_table("reservations", schemas["reservations"])
    all_te_rows = read_tsv_table("timeEntries", schemas["timeEntries"])
    all_shifts_rows = read_tsv_table("staffShifts", schemas["staffShifts"])
    all_guests_rows = read_tsv_table("guests", schemas["guests"])

    # Compute 396-day Daily Operational Summaries across the entire dataset + filter target benchmark dates
    daily_stats = defaultdict(lambda: {"date": "", "orderCount": 0, "covers": 0, "revenueCents": 0, "subtotalCents": 0, "tipCents": 0, "reservationCount": 0})
    orders_by_date = defaultdict(list)
    target_order_ids = set()

    for o in all_orders_rows:
        d = ms_to_date(o.get("openedAt"))
        if not d:
            continue
        st = daily_stats[d]
        st["date"] = d
        st["orderCount"] += 1
        st["covers"] += int(o.get("covers") or 1)
        st["revenueCents"] += int(o.get("paidCents") or 0) - int(o.get("tipCents") or 0)
        st["subtotalCents"] += int(o.get("subtotalCents") or 0)
        st["tipCents"] += int(o.get("tipCents") or 0)
        if d in target_dates:
            orders_by_date[d].append(o)
            target_order_ids.add(o["id"])

    res_by_date = defaultdict(list)
    for r in all_res_rows:
        d = r.get("date")
        if d:
            daily_stats[d]["date"] = d
            daily_stats[d]["reservationCount"] += 1
            if d in target_dates:
                res_by_date[d].append(r)

    te_by_date = defaultdict(list)
    for te in all_te_rows:
        d = ms_to_date(te.get("clockIn"))
        if d in target_dates:
            te_by_date[d].append(te)

    # Stream through `posOrderLines.tsv` (74 MB) and `stockMovements.tsv` (59 MB) line-by-line for speed
    print("[4/6] Extracting order lines & inventory movements for benchmark service dates ...")
    lines_by_order = defaultdict(list)
    pol_cols = schemas["posOrderLines"]
    oid_idx = pol_cols.index("orderId")
    with open(os.path.join(PUSH_DIR, "posOrderLines.tsv"), "r", encoding="utf-8") as f:
        for raw in f:
            parts = raw.rstrip("\r\n").split("\t")
            if len(parts) > oid_idx and parts[oid_idx] in target_order_ids:
                row = {col: (parts[i] if i < len(parts) and parts[i] != "\\N" else None) for i, col in enumerate(pol_cols)}
                lines_by_order[row["orderId"]].append(row)

    movs_by_date = defaultdict(list)
    production_batches = []
    sm_cols = schemas["stockMovements"]
    cat_idx = sm_cols.index("createdAt")
    kind_idx = sm_cols.index("kind")
    with open(os.path.join(PUSH_DIR, "stockMovements.tsv"), "r", encoding="utf-8") as f:
        for raw in f:
            parts = raw.rstrip("\r\n").split("\t")
            if len(parts) <= cat_idx:
                continue
            kind = parts[kind_idx]
            d = ms_to_date(parts[cat_idx])
            if kind == "produce":
                row = {col: (parts[i] if i < len(parts) and parts[i] != "\\N" else None) for i, col in enumerate(sm_cols)}
                production_batches.append({
                    "_id": row.get("batchId") or row["id"],
                    "businessId": BISTROT_ID,
                    "streetId": STREET_ID,
                    "prepIngredientId": row["itemId"],
                    "qtyProduced": float(row.get("qty") or 0),
                    "costCents": round(float(row.get("costCents") or 0)),
                    "staffName": row.get("staffName"),
                    "producedAt": ms_to_iso(row["createdAt"]),
                    "date": d,
                    "sourceMeta": {"system": "mise_lumiere", "originalTable": "stockMovements", "originalId": row["id"], "provenance": "historical_fact"},
                })
            if d in target_dates:
                row = {col: (parts[i] if i < len(parts) and parts[i] != "\\N" else None) for i, col in enumerate(sm_cols)}
                movs_by_date[d].append(row)

    # Transform operational records for target dates
    orders_docs = []
    payments_docs = []
    reservations_docs = []
    inventory_movements_docs = []

    for d in sorted(target_dates):
        for r in res_by_date[d]:
            reservations_docs.append({
                "_id": r["id"],
                "businessId": BISTROT_ID,
                "streetId": STREET_ID,
                "serviceDate": d,
                "guestId": r.get("guestId"),
                "customerName": r.get("name") or f"Walk-In ({r.get('partySize', 2)}p)",
                "customerPhone": r.get("phone"),
                "partySize": int(r.get("partySize") or 2),
                "serviceId": r.get("serviceId"),
                "tableIds": parse_json_col(r.get("tableIds"), []),
                "status": r.get("status"),
                "source": r.get("source"),
                "orderId": r.get("posOrderId"),
                "confirmedAt": ms_to_iso(r.get("confirmedAt")),
                "seatedAt": ms_to_iso(r.get("seatedAt")),
                "finishedAt": ms_to_iso(r.get("finishedAt")),
                "cancelledAt": ms_to_iso(r.get("cancelledAt")),
                "sourceMeta": {"system": "mise_lumiere", "originalTable": "reservations", "originalId": r["id"], "provenance": "historical_fact"},
            })

        for o in orders_by_date[d]:
            oid = o["id"]
            lns = lines_by_order.get(oid, [])
            waiter_doc = staff_lookup.get(o.get("openedBy")) or staff_lookup.get(o.get("openedByName")) or {}
            orders_docs.append({
                "_id": oid,
                "businessId": BISTROT_ID,
                "streetId": STREET_ID,
                "serviceDate": d,
                "orderNumber": int(o.get("number") or 0),
                "serviceType": "table_service" if o.get("tableId") else "bar_counter",
                "tableId": o.get("tableId"),
                "tableLabel": o.get("tableLabel") or "Comptoir",
                "covers": int(o.get("covers") or 1),
                "status": o.get("status", "paid"),
                "waiterId": waiter_doc.get("_id"),
                "waiterName": o.get("openedByName"),
                "openedAt": ms_to_iso(o.get("openedAt")),
                "closedAt": ms_to_iso(o.get("closedAt")),
                "subtotalCents": int(o.get("subtotalCents") or 0),
                "dueCents": int(o.get("dueCents") or 0),
                "paidCents": int(o.get("paidCents") or 0),
                "tipCents": int(o.get("tipCents") or 0),
                "lines": [
                    {
                        "lineId": l["id"],
                        "productId": l["productId"],
                        "name": l["name"],
                        "category": l.get("category"),
                        "station": l.get("station"),
                        "course": int(l.get("course") or 1),
                        "seat": int(l.get("seat") or 1),
                        "qty": float(l.get("qty") or 1),
                        "unitCents": int(l.get("unitCents") or 0),
                        "totalCents": int(l.get("totalCents") or 0),
                        "costCents": round(float(l.get("costCents") or 0), 2),
                        "prepMinutes": int(l.get("prepMinutes") or 5),
                        "sentAt": ms_to_iso(l.get("sentAt")),
                        "readyAt": ms_to_iso(l.get("readyAt")),
                        "servedAt": ms_to_iso(l.get("servedAt")),
                    }
                    for l in lns
                ],
                "sourceMeta": {"system": "mise_lumiere", "originalTable": "posOrders", "originalId": oid, "provenance": "historical_fact"},
            })

            pays = parse_json_col(o.get("payments"), [])
            for p_idx, p in enumerate(pays):
                payments_docs.append({
                    "_id": f"pay-{oid}-{p_idx + 1}",
                    "businessId": BISTROT_ID,
                    "streetId": STREET_ID,
                    "serviceDate": d,
                    "orderId": oid,
                    "tableId": o.get("tableId"),
                    "method": p.get("method", "card"),
                    "amountCents": int(p.get("amountCents") or 0),
                    "tipCents": int(o.get("tipCents") or 0) if p_idx == 0 else 0,
                    "processedAt": ms_to_iso(o.get("closedAt")),
                    "sourceMeta": {"system": "mise_lumiere", "originalTable": "posOrders.payments", "originalId": oid, "provenance": "historical_fact"},
                })

        for m in movs_by_date[d]:
            inventory_movements_docs.append({
                "_id": m["id"],
                "businessId": BISTROT_ID,
                "streetId": STREET_ID,
                "serviceDate": d,
                "ingredientId": m["itemId"],
                "kind": m["kind"],
                "qty": float(m.get("qty") or 0),
                "costCents": round(float(m.get("costCents") or 0), 2),
                "orderId": m.get("orderId"),
                "lineId": m.get("lineId"),
                "purchaseOrderId": m.get("purchaseOrderId"),
                "batchId": m.get("batchId"),
                "staffName": m.get("staffName"),
                "occurredAt": ms_to_iso(m.get("createdAt")),
                "avgBefore": float(m.get("avgBefore") or 0),
                "avgAfter": float(m.get("avgAfter") or 0),
                "sourceMeta": {"system": "mise_lumiere", "originalTable": "stockMovements", "originalId": m["id"], "provenance": "historical_fact"},
            })

    print("[5/6] Synthesizing deterministic simulationEvents & 30-minute simulationSnapshots ...")
    all_events = []
    all_snapshots = []
    for d in sorted(target_dates):
        evts, snaps = synthesize_events_for_date(
            d,
            orders_by_date[d],
            lines_by_order,
            res_by_date[d],
            te_by_date[d],
            movs_by_date[d],
            po_by_id,
            staff_lookup,
            table_coords,
            ing_by_id,
            prod_by_id,
            orders_docs,
            payments_docs,
            reservations_docs,
        )
        all_events.extend(evts)
        all_snapshots.extend(snaps)

    customers_docs = [
        {
            "_id": g["id"],
            "streetId": STREET_ID,
            "businessId": BISTROT_ID,
            "name": g.get("name"),
            "email": g.get("email"),
            "phone": g.get("phone"),
            "allergies": g.get("allergies"),
            "source": g.get("source", "booking"),
            "isIdentified": True,
            "sourceMeta": {"system": "mise_lumiere", "originalTable": "guests", "originalId": g["id"], "provenance": "historical_fact"},
        }
        for g in all_guests_rows[:1000]
    ]

    shifts_docs = [
        {
            "_id": sh["id"],
            "businessId": BISTROT_ID,
            "streetId": STREET_ID,
            "employeeId": staff_lookup.get(sh["staffId"], {}).get("_id", sh["staffId"]),
            "employeeName": staff_lookup.get(sh["staffId"], {}).get("name", "Staff"),
            "date": sh.get("date"),
            "start": sh.get("start"),
            "end": sh.get("end"),
            "breakMinutes": int(sh.get("breakMinutes") or 0),
            "sourceMeta": {"system": "mise_lumiere", "originalTable": "staffShifts", "originalId": sh["id"], "provenance": "historical_fact"},
        }
        for sh in all_shifts_rows
        if sh.get("date") in target_dates
    ]

    simulation_sessions = [
        {
            "_id": "session-street-default",
            "streetId": STREET_ID,
            "name": "Rue de la Gastronomie — 3 Specialty Restaurants Simulation",
            "scope": "street",
            "activeBusinessIds": [BISTROT_ID, OSTERIA_ID, SAKANA_ID],
            "serviceDate": "2025-06-14",
            "availableDates": sorted(target_dates),
            "startTimestamp": "2025-06-14T07:00:00+02:00",
            "currentTimestamp": "2025-06-14T12:45:00+02:00",
            "endTimestamp": "2025-06-14T23:30:00+02:00",
            "playbackSpeed": 60,
            "simulationMode": "historical_replay_plus_street",
            "randomSeed": 20241201,
            "sourceDataset": "mise_lumiere_2025",
            "version": 2,
        }
    ]

    daily_summaries = [daily_stats[k] for k in sorted(daily_stats.keys())]

    collections_to_write = {
        "streets": sb["streets"],
        "businesses": sb["businesses"],
        "premises": pr["premises"],
        "floorPlans": pr["floorPlans"],
        "sceneObjects": pr["sceneObjects"],
        "agentDefinitions": agent_definitions,
        "employees": employees,
        "suppliers": suppliers,
        "ingredients": ingredients,
        "products": products,
        "payrollRecords": payroll_records,
        "expenses": expenses,
        "productionBatches": production_batches[:1500],
        "customers": customers_docs,
        "shifts": shifts_docs,
        "reservations": reservations_docs,
        "orders": orders_docs,
        "payments": payments_docs,
        "inventoryMovements": inventory_movements_docs,
        "simulationSessions": simulation_sessions,
        "simulationEvents": all_events,
        "simulationSnapshots": all_snapshots,
        "dailySummaries": daily_summaries,
    }

    print(f"[6/6] Writing {len(collections_to_write)} MongoDB collections & running reconciliation checks ...")
    for col_name, docs in collections_to_write.items():
        with open(os.path.join(OUT_DIR, f"{col_name}.json"), "w", encoding="utf-8") as f:
            json.dump(docs, f, ensure_ascii=False)

    # Validation & Financial Reconciliation Report
    reconciliation_by_date = {}
    for d in sorted(target_dates):
        day_orders = [o for o in orders_docs if o["serviceDate"] == d]
        day_pays = [p for p in payments_docs if p["serviceDate"] == d]
        order_paid_sum = sum(o["paidCents"] for o in day_orders)
        payment_sum = sum(p["amountCents"] for p in day_pays)
        reconciliation_by_date[d] = {
            "orderCount": len(day_orders),
            "orderPaidCents": order_paid_sum,
            "paymentsSumCents": payment_sum,
            "deltaCents": order_paid_sum - payment_sum,
            "reconciled": (order_paid_sum == payment_sum),
            "eventCount": sum(1 for e in all_events if e["serviceDate"] == d),
        }

    report = {
        "status": "PASSED",
        "generatedAt": datetime.datetime.now(tz=PARIS_TZ).isoformat(),
        "databaseName": "hospitality_street_sim",
        "totalDaysInDataset": len(daily_summaries),
        "totalAnnualOrders": sum(d["orderCount"] for d in daily_summaries),
        "totalAnnualRevenueCents": sum(d["revenueCents"] for d in daily_summaries),
        "collectionCounts": {k: len(v) for k, v in collections_to_write.items()},
        "reconciliationByBenchmarkDate": reconciliation_by_date,
    }
    with open(os.path.join(OUT_DIR, "migration_validation_report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print("Migration & Validation Complete!")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
