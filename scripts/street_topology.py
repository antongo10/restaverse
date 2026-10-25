#!/usr/bin/env python3
"""
Multi-Tenant Street, Premises, FloorPlans, Connected Navigation Waypoint Graphs,
and Interactive Scene Object Registry for the Multi-Venue 3D Hospitality Street Platform.

Three Full-Service Specialty Restaurants on Rue de la Lumière (Nice):
  1. Bistrot Lumière (business-bistrot-lumiere) — Grande Brasserie Niçoise & Méditerranéenne (X = 0..22m)
  2. Osteria Bellavista (business-osteria-bellavista) — Trattoria Gastronomica, Pasta Fresca & Griglia Toscana (X = 24..42m)
  3. Sakana-Tei 魚亭 (business-sakana-tei) — Japanese Izakaya, Hinoki Omakase Sushi & Binchotan Robatayaki (X = 44..62m)
"""

from typing import Dict, List, Any

STREET_ID = "street-nice-001"
BISTROT_ID = "business-bistrot-lumiere"
OSTERIA_ID = "business-osteria-bellavista"
SAKANA_ID = "business-sakana-tei"

# Keep backward-compatible aliases if imported elsewhere
PIZZA_ID = OSTERIA_ID
CAFE_ID = SAKANA_ID


def build_street_and_businesses(rest_row: Dict[str, Any], org_row: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
    streets = [
        {
            "_id": STREET_ID,
            "name": "Rue de la Lumière — Quartier Gastronomique (Nice)",
            "city": "Nice",
            "timezone": "Europe/Paris",
            "environmentId": "env-nice-port-001",
            "status": "active",
            "dimensions": {
                "widthMeters": 66.0,
                "depthMeters": 34.0,
                "sidewalkZStart": 14.0,
                "sidewalkZEnd": 19.0,
                "roadZStart": 23.5,
                "roadZEnd": 29.5,
            },
            "businessIds": [BISTROT_ID, OSTERIA_ID, SAKANA_ID],
            "spawnPoints": [
                {"id": "street-west", "x": -2.0, "y": 0.0, "z": 16.0, "label": "Promenade du Paillon (West)"},
                {"id": "street-east", "x": 64.0, "y": 0.0, "z": 16.0, "label": "Port Lympia (East)"},
                {"id": "alley-delivery", "x": -2.0, "y": 0.0, "z": -7.2, "label": "Voie de Livraison Nord"},
            ],
            "sourceMeta": {
                "system": "mise_lumiere",
                "originalTable": "organizations",
                "originalId": org_row.get("id", "lumiere"),
                "provenance": "historical_fact",
            },
        }
    ]

    businesses = [
        {
            "_id": BISTROT_ID,
            "streetId": STREET_ID,
            "name": rest_row.get("name", "Bistrot Lumière"),
            "slug": rest_row.get("slug", "bistrot-lumiere"),
            "businessType": "restaurant",
            "specialty": "French Brasserie & Cuisine Niçoise",
            "cuisine": rest_row.get("cuisine", "Bistrot niçois & Méditerranée"),
            "operatingStatus": "open",
            "timezone": "Europe/Paris",
            "currency": "EUR",
            "address": rest_row.get("address", "8 rue de la Lumière, 06300 Nice"),
            "phone": rest_row.get("phone", "04 99 00 12 34"),
            "managerName": rest_row.get("manager", "Léa Fontaine"),
            "premisesId": "premises-bistrot-lumiere",
            "floorPlanId": "floorplan-bistrot-lumiere",
            "simulationConfigId": "simconfig-bistrot-001",
            "accentColor": "#f59e0b",
            "workflows": [
                "reservations",
                "host_seating",
                "table_occupancy",
                "multi_course_ordering",
                "charvet_range_cooking",
                "garde_manger_plating",
                "bar_sommelier_service",
                "heated_pass_pickup",
                "table_delivery",
                "billing_payment",
                "table_clearing",
                "hobart_dishwashing",
                "stock_purchasing",
            ],
            "serviceHours": {
                "lunch": {"start": "11:45", "end": "14:45"},
                "dinner": {"start": "18:45", "end": "22:45"},
            },
            "sourceMeta": {
                "system": "mise_lumiere",
                "originalTable": "restaurants",
                "originalId": rest_row.get("id", "bistrot-lumiere"),
                "provenance": "historical_fact",
            },
        },
        {
            "_id": OSTERIA_ID,
            "streetId": STREET_ID,
            "name": "Osteria Bellavista",
            "slug": "osteria-bellavista",
            "businessType": "restaurant",
            "specialty": "Authentic Italian Trattoria, Fresh Pasta & Wood-Fired Tuscan Grill",
            "cuisine": "Cucina Italiana & Griglia a Carbone",
            "operatingStatus": "open",
            "timezone": "Europe/Paris",
            "currency": "EUR",
            "address": "10 rue de la Lumière, 06300 Nice",
            "phone": "04 99 00 45 67",
            "managerName": "Lorenzo Moretti",
            "premisesId": "premises-osteria-bellavista",
            "floorPlanId": "floorplan-osteria-bellavista",
            "simulationConfigId": "simconfig-osteria-001",
            "accentColor": "#ef4444",
            "workflows": [
                "reservations",
                "host_seating",
                "table_occupancy",
                "antipasti_burrata_bar",
                "fresh_pasta_bollitore",
                "wood_fired_bistecca_grill",
                "aperitivo_enoteca_bar",
                "heated_pass_pickup",
                "table_delivery",
                "billing_payment",
                "table_clearing",
            ],
            "serviceHours": {
                "lunch": {"start": "11:45", "end": "15:00"},
                "dinner": {"start": "18:30", "end": "23:00"},
            },
            "sourceMeta": {
                "system": "street_platform",
                "originalTable": "specialty_restaurant",
                "originalId": OSTERIA_ID,
                "provenance": "synthetic_activity",
            },
        },
        {
            "_id": SAKANA_ID,
            "streetId": STREET_ID,
            "name": "Sakana-Tei 魚亭",
            "slug": "sakana-tei",
            "businessType": "restaurant",
            "specialty": "Japanese Izakaya, Hinoki Omakase Sushi & Binchotan Robatayaki",
            "cuisine": "Washoku, Edomae Sushi & Robata",
            "operatingStatus": "open",
            "timezone": "Europe/Paris",
            "currency": "EUR",
            "address": "12 rue de la Lumière, 06300 Nice",
            "phone": "04 99 00 89 10",
            "managerName": "Yuki Nakamura",
            "premisesId": "premises-sakana-tei",
            "floorPlanId": "floorplan-sakana-tei",
            "simulationConfigId": "simconfig-sakana-001",
            "accentColor": "#10b981",
            "workflows": [
                "reservations",
                "host_seating",
                "omakase_sushi_counter",
                "binchotan_robatayaki_grill",
                "copper_tempura_ramen_station",
                "sake_whisky_highball_bar",
                "pass_pickup",
                "table_delivery",
                "billing_payment",
                "table_clearing",
            ],
            "serviceHours": {
                "lunch": {"start": "12:00", "end": "14:45"},
                "dinner": {"start": "18:45", "end": "23:00"},
            },
            "sourceMeta": {
                "system": "street_platform",
                "originalTable": "specialty_restaurant",
                "originalId": SAKANA_ID,
                "provenance": "synthetic_activity",
            },
        },
    ]
    return {"streets": streets, "businesses": businesses}


def build_navigation_graph_for_premises(prem_id: str) -> Dict[str, Any]:
    """
    Returns a connected `{ nodes: [...], edges: [[idA, idB], ...] }` graph for realistic
    wall-aware A* pathfinding inside each restaurant and out onto the street & terrace.
    """
    if prem_id == "premises-bistrot-lumiere":
        nodes = [
            # Street & Terrace
            {"id": "bl-st-west", "x": 2.0, "z": 15.8, "zone": "street"},
            {"id": "bl-st-entry", "x": 10.0, "z": 15.6, "zone": "street"},
            {"id": "bl-st-east", "x": 18.0, "z": 15.8, "zone": "street"},
            {"id": "bl-tr-north-w", "x": 3.0, "z": 16.8, "zone": "terrasse"},
            {"id": "bl-tr-north-c", "x": 8.5, "z": 16.8, "zone": "terrasse"},
            {"id": "bl-tr-north-e", "x": 13.5, "z": 16.8, "zone": "terrasse"},
            {"id": "bl-tr-south-w", "x": 3.0, "z": 20.2, "zone": "terrasse"},
            {"id": "bl-tr-south-c", "x": 8.5, "z": 20.2, "zone": "terrasse"},
            {"id": "bl-tr-south-e", "x": 13.5, "z": 20.2, "zone": "terrasse"},
            # Main Entrance Doorway & Host Stand
            {"id": "bl-door-main", "x": 10.0, "z": 13.8, "zone": "salle"},
            {"id": "bl-host", "x": 10.0, "z": 12.0, "zone": "salle"},
            # Salle Aisles (Grid avoiding tables)
            {"id": "bl-aisle-sw", "x": 3.2, "z": 10.5, "zone": "salle"},
            {"id": "bl-aisle-sc", "x": 8.2, "z": 10.5, "zone": "salle"},
            {"id": "bl-aisle-se", "x": 13.5, "z": 10.5, "zone": "salle"},
            {"id": "bl-aisle-mw", "x": 3.2, "z": 6.2, "zone": "salle"},
            {"id": "bl-aisle-mc", "x": 8.2, "z": 6.2, "zone": "salle"},
            {"id": "bl-aisle-me", "x": 13.8, "z": 6.2, "zone": "salle"},
            {"id": "bl-aisle-nw", "x": 3.2, "z": 2.2, "zone": "salle"},
            {"id": "bl-aisle-nc", "x": 8.2, "z": 2.2, "zone": "salle"},
            {"id": "bl-aisle-ne", "x": 13.8, "z": 2.2, "zone": "salle"},
            # Bar & Pass Front (Salle side)
            {"id": "bl-bar-front", "x": 16.8, "z": 9.0, "zone": "bar"},
            {"id": "bl-pos-front", "x": 16.0, "z": 10.4, "zone": "bar"},
            {"id": "bl-bar-back", "x": 18.8, "z": 11.8, "zone": "bar"},
            {"id": "bl-pass-front", "x": 18.5, "z": 1.4, "zone": "salle"},
            # Kitchen Doorway & Kitchen Corridor (North of Z=0 partition wall)
            {"id": "bl-kitchen-door", "x": 15.8, "z": 0.0, "zone": "kitchen"},
            {"id": "bl-pass-back", "x": 18.5, "z": -1.2, "zone": "kitchen"},
            {"id": "bl-k-east", "x": 16.5, "z": -2.8, "zone": "kitchen"},
            {"id": "bl-k-hot", "x": 14.2, "z": -3.2, "zone": "kitchen"},
            {"id": "bl-k-fry", "x": 12.0, "z": -3.2, "zone": "kitchen"},
            {"id": "bl-k-cold", "x": 9.2, "z": -1.6, "zone": "kitchen"},
            {"id": "bl-k-dish", "x": 4.8, "z": -3.2, "zone": "kitchen"},
            {"id": "bl-k-storage", "x": 2.0, "z": -3.2, "zone": "kitchen"},
        ]
        edges = [
            ["bl-st-west", "bl-st-entry"],
            ["bl-st-entry", "bl-st-east"],
            ["bl-st-entry", "bl-tr-north-c"],
            ["bl-tr-north-w", "bl-tr-north-c"],
            ["bl-tr-north-c", "bl-tr-north-e"],
            ["bl-tr-south-w", "bl-tr-south-c"],
            ["bl-tr-south-c", "bl-tr-south-e"],
            ["bl-tr-north-w", "bl-tr-south-w"],
            ["bl-tr-north-c", "bl-tr-south-c"],
            ["bl-tr-north-e", "bl-tr-south-e"],
            ["bl-st-entry", "bl-door-main"],
            ["bl-door-main", "bl-host"],
            ["bl-host", "bl-aisle-sc"],
            ["bl-host", "bl-aisle-se"],
            ["bl-aisle-sw", "bl-aisle-sc"],
            ["bl-aisle-sc", "bl-aisle-se"],
            ["bl-aisle-mw", "bl-aisle-mc"],
            ["bl-aisle-mc", "bl-aisle-me"],
            ["bl-aisle-nw", "bl-aisle-nc"],
            ["bl-aisle-nc", "bl-aisle-ne"],
            ["bl-aisle-sw", "bl-aisle-mw"],
            ["bl-aisle-mw", "bl-aisle-nw"],
            ["bl-aisle-sc", "bl-aisle-mc"],
            ["bl-aisle-mc", "bl-aisle-nc"],
            ["bl-aisle-se", "bl-aisle-me"],
            ["bl-aisle-me", "bl-aisle-ne"],
            ["bl-aisle-se", "bl-pos-front"],
            ["bl-pos-front", "bl-bar-front"],
            ["bl-bar-front", "bl-bar-back"],
            ["bl-aisle-me", "bl-bar-front"],
            ["bl-aisle-ne", "bl-pass-front"],
            ["bl-aisle-me", "bl-pass-front"],
            ["bl-aisle-ne", "bl-kitchen-door"],
            ["bl-pass-front", "bl-kitchen-door"],
            ["bl-kitchen-door", "bl-pass-back"],
            ["bl-kitchen-door", "bl-k-east"],
            ["bl-pass-back", "bl-k-east"],
            ["bl-k-east", "bl-k-hot"],
            ["bl-k-hot", "bl-k-fry"],
            ["bl-k-fry", "bl-k-cold"],
            ["bl-k-cold", "bl-k-dish"],
            ["bl-k-dish", "bl-k-storage"],
        ]
        return {"nodes": nodes, "edges": edges}

    if prem_id == "premises-osteria-bellavista":
        nodes = [
            # Street & Terrace
            {"id": "ob-st-west", "x": 26.0, "z": 15.6, "zone": "street"},
            {"id": "ob-st-entry", "x": 33.0, "z": 15.6, "zone": "street"},
            {"id": "ob-st-east", "x": 40.0, "z": 15.6, "zone": "street"},
            {"id": "ob-tr-w", "x": 27.5, "z": 18.0, "zone": "terrasse"},
            {"id": "ob-tr-c", "x": 33.0, "z": 18.0, "zone": "terrasse"},
            {"id": "ob-tr-e", "x": 38.5, "z": 18.0, "zone": "terrasse"},
            # Door & Host
            {"id": "ob-door-main", "x": 33.0, "z": 13.8, "zone": "salle"},
            {"id": "ob-host", "x": 33.0, "z": 11.8, "zone": "salle"},
            # Dining Room Aisles
            {"id": "ob-aisle-sw", "x": 27.0, "z": 10.2, "zone": "salle"},
            {"id": "ob-aisle-sc", "x": 32.5, "z": 10.2, "zone": "salle"},
            {"id": "ob-aisle-mw", "x": 27.0, "z": 6.2, "zone": "salle"},
            {"id": "ob-aisle-mc", "x": 32.5, "z": 6.2, "zone": "salle"},
            {"id": "ob-aisle-me", "x": 36.8, "z": 6.2, "zone": "salle"},
            {"id": "ob-aisle-nw", "x": 27.0, "z": 2.4, "zone": "salle"},
            {"id": "ob-aisle-nc", "x": 32.5, "z": 2.4, "zone": "salle"},
            {"id": "ob-aisle-ne", "x": 36.8, "z": 2.4, "zone": "salle"},
            # Aperitivo Bar & Pass Front
            {"id": "ob-pos-front", "x": 36.5, "z": 10.2, "zone": "bar"},
            {"id": "ob-bar-front", "x": 38.0, "z": 8.8, "zone": "bar"},
            {"id": "ob-bar-back", "x": 39.2, "z": 11.4, "zone": "bar"},
            {"id": "ob-pass-front", "x": 38.0, "z": 1.4, "zone": "salle"},
            # Kitchen Doorway & Cucina Corridor
            {"id": "ob-kitchen-door", "x": 35.2, "z": 0.0, "zone": "kitchen"},
            {"id": "ob-pass-back", "x": 38.0, "z": -1.2, "zone": "kitchen"},
            {"id": "ob-k-grill", "x": 38.2, "z": -3.2, "zone": "kitchen"},
            {"id": "ob-k-pasta", "x": 34.2, "z": -3.2, "zone": "kitchen"},
            {"id": "ob-k-antipasti", "x": 30.2, "z": -2.4, "zone": "kitchen"},
            {"id": "ob-k-dish", "x": 27.2, "z": -3.2, "zone": "kitchen"},
            {"id": "ob-k-storage", "x": 25.4, "z": -3.2, "zone": "kitchen"},
        ]
        edges = [
            ["ob-st-west", "ob-st-entry"],
            ["ob-st-entry", "ob-st-east"],
            ["ob-st-entry", "ob-tr-c"],
            ["ob-tr-w", "ob-tr-c"],
            ["ob-tr-c", "ob-tr-e"],
            ["ob-st-entry", "ob-door-main"],
            ["ob-door-main", "ob-host"],
            ["ob-host", "ob-aisle-sc"],
            ["ob-host", "ob-pos-front"],
            ["ob-aisle-sw", "ob-aisle-sc"],
            ["ob-aisle-sc", "ob-pos-front"],
            ["ob-aisle-mw", "ob-aisle-mc"],
            ["ob-aisle-mc", "ob-aisle-me"],
            ["ob-aisle-nw", "ob-aisle-nc"],
            ["ob-aisle-nc", "ob-aisle-ne"],
            ["ob-aisle-sw", "ob-aisle-mw"],
            ["ob-aisle-mw", "ob-aisle-nw"],
            ["ob-aisle-sc", "ob-aisle-mc"],
            ["ob-aisle-mc", "ob-aisle-nc"],
            ["ob-aisle-me", "ob-aisle-ne"],
            ["ob-pos-front", "ob-bar-front"],
            ["ob-bar-front", "ob-bar-back"],
            ["ob-aisle-me", "ob-bar-front"],
            ["ob-aisle-ne", "ob-pass-front"],
            ["ob-aisle-ne", "ob-kitchen-door"],
            ["ob-pass-front", "ob-kitchen-door"],
            ["ob-kitchen-door", "ob-pass-back"],
            ["ob-pass-back", "ob-k-grill"],
            ["ob-k-grill", "ob-k-pasta"],
            ["ob-k-pasta", "ob-k-antipasti"],
            ["ob-k-antipasti", "ob-k-dish"],
            ["ob-k-dish", "ob-k-storage"],
        ]
        return {"nodes": nodes, "edges": edges}

    # Sakana-Tei
    nodes = [
        # Street & Zen Terrace
        {"id": "sk-st-west", "x": 46.0, "z": 15.6, "zone": "street"},
        {"id": "sk-st-entry", "x": 53.0, "z": 15.6, "zone": "street"},
        {"id": "sk-st-east", "x": 60.0, "z": 15.6, "zone": "street"},
        {"id": "sk-tr-w", "x": 47.5, "z": 18.0, "zone": "terrasse"},
        {"id": "sk-tr-c", "x": 53.0, "z": 18.0, "zone": "terrasse"},
        {"id": "sk-tr-e", "x": 58.5, "z": 18.0, "zone": "terrasse"},
        # Door & Host
        {"id": "sk-door-main", "x": 53.0, "z": 13.8, "zone": "salle"},
        {"id": "sk-host", "x": 53.0, "z": 11.8, "zone": "salle"},
        # Izakaya Hall Aisles
        {"id": "sk-aisle-sw", "x": 47.0, "z": 10.2, "zone": "salle"},
        {"id": "sk-aisle-sc", "x": 52.5, "z": 10.2, "zone": "salle"},
        {"id": "sk-aisle-mw", "x": 47.0, "z": 6.2, "zone": "salle"},
        {"id": "sk-aisle-mc", "x": 52.5, "z": 6.2, "zone": "salle"},
        {"id": "sk-aisle-me", "x": 56.8, "z": 6.2, "zone": "salle"},
        {"id": "sk-aisle-nw", "x": 47.0, "z": 2.5, "zone": "salle"},
        {"id": "sk-aisle-nc", "x": 52.5, "z": 2.5, "zone": "salle"},
        {"id": "sk-aisle-ne", "x": 56.8, "z": 2.5, "zone": "salle"},
        # Sake Bar & Omakase / Pass Front
        {"id": "sk-pos-front", "x": 56.5, "z": 10.2, "zone": "bar"},
        {"id": "sk-bar-front", "x": 58.0, "z": 8.8, "zone": "bar"},
        {"id": "sk-bar-back", "x": 59.2, "z": 11.4, "zone": "bar"},
        {"id": "sk-pass-front", "x": 58.2, "z": 1.4, "zone": "salle"},
        # Kitchen Doorway & Robata/Sushi Corridor
        {"id": "sk-kitchen-door", "x": 55.2, "z": 0.0, "zone": "kitchen"},
        {"id": "sk-pass-back", "x": 58.2, "z": -1.2, "zone": "kitchen"},
        {"id": "sk-k-robata", "x": 58.2, "z": -3.2, "zone": "kitchen"},
        {"id": "sk-k-tempura", "x": 54.2, "z": -3.2, "zone": "kitchen"},
        {"id": "sk-k-sushi", "x": 50.2, "z": -1.4, "zone": "kitchen"},
        {"id": "sk-k-dish", "x": 47.2, "z": -3.2, "zone": "kitchen"},
        {"id": "sk-k-storage", "x": 45.4, "z": -3.2, "zone": "kitchen"},
    ]
    edges = [
        ["sk-st-west", "sk-st-entry"],
        ["sk-st-entry", "sk-st-east"],
        ["sk-st-entry", "sk-tr-c"],
        ["sk-tr-w", "sk-tr-c"],
        ["sk-tr-c", "sk-tr-e"],
        ["sk-st-entry", "sk-door-main"],
        ["sk-door-main", "sk-host"],
        ["sk-host", "sk-aisle-sc"],
        ["sk-host", "sk-pos-front"],
        ["sk-aisle-sw", "sk-aisle-sc"],
        ["sk-aisle-sc", "sk-pos-front"],
        ["sk-aisle-mw", "sk-aisle-mc"],
        ["sk-aisle-mc", "sk-aisle-me"],
        ["sk-aisle-nw", "sk-aisle-nc"],
        ["sk-aisle-nc", "sk-aisle-ne"],
        ["sk-aisle-sw", "sk-aisle-mw"],
        ["sk-aisle-mw", "sk-aisle-nw"],
        ["sk-aisle-sc", "sk-aisle-mc"],
        ["sk-aisle-mc", "sk-aisle-nc"],
        ["sk-aisle-me", "sk-aisle-ne"],
        ["sk-pos-front", "sk-bar-front"],
        ["sk-bar-front", "sk-bar-back"],
        ["sk-aisle-me", "sk-bar-front"],
        ["sk-aisle-ne", "sk-pass-front"],
        ["sk-aisle-ne", "sk-kitchen-door"],
        ["sk-pass-front", "sk-kitchen-door"],
        ["sk-kitchen-door", "sk-pass-back"],
        ["sk-pass-back", "sk-k-robata"],
        ["sk-k-robata", "sk-k-tempura"],
        ["sk-k-tempura", "sk-k-sushi"],
        ["sk-k-sushi", "sk-k-dish"],
        ["sk-k-dish", "sk-k-storage"],
    ]
    return {"nodes": nodes, "edges": edges}


def build_premises_and_registry(
    dining_areas: List[Dict[str, Any]],
    dining_tables: List[Dict[str, Any]],
    asset_models: Dict[str, Dict[str, Any]],
    asset_lots: List[Dict[str, Any]],
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Constructs `premises`, `floorPlans`, and `sceneObjects` (Interactive Object Registry)
    for all three specialty restaurants on Rue de la Lumière.
    """
    scene_objects: List[Dict[str, Any]] = []

    premises_defs = [
        {
            "_id": "premises-bistrot-lumiere",
            "businessId": BISTROT_ID,
            "streetId": STREET_ID,
            "name": "Bistrot Lumière — Brasserie Niçoise & Méditerranée",
            "floorPlanId": "floorplan-bistrot-lumiere",
            "theme": "french_bistrot",
            "streetOffset": {"x": 0.0, "y": 0.0, "z": 0.0},
            "bounds": {"minX": 0.0, "maxX": 22.0, "minZ": -6.0, "maxZ": 22.5, "indoorMaxZ": 14.0, "wallHeight": 3.4},
            "entrances": [
                {"id": "door-bl-main", "label": "Entrée Principale Bistrot", "x": 10.0, "z": 14.0, "width": 2.2, "kind": "customer"},
                {"id": "door-bl-kitchen", "label": "Porte Cuisine & Passe", "x": 15.8, "z": 0.0, "width": 1.5, "kind": "internal"},
                {"id": "door-bl-service", "label": "Accès Livraisons Nord", "x": 2.5, "z": -6.0, "width": 1.6, "kind": "service"},
            ],
            "zones": [
                {"id": "zone-bl-kitchen", "zoneId": "zone-bl-kitchen", "name": "Cuisine & Plonge", "x": 0.0, "z": -6.0, "width": 22.0, "depth": 6.0, "bounds": {"minX": 0.0, "maxX": 22.0, "minZ": -6.0, "maxZ": 0.0}, "floorColor": "#64748b", "color": "#475569"},
                {"id": "zone-bl-salle", "zoneId": "zone-bl-salle", "name": "Salle Principale (Parquet Chêne)", "x": 0.0, "z": 0.0, "width": 22.0, "depth": 14.0, "bounds": {"minX": 0.0, "maxX": 22.0, "minZ": 0.0, "maxZ": 14.0}, "floorColor": "#855836", "color": "#92400e"},
                {"id": "zone-bl-bar", "zoneId": "zone-bl-bar", "name": "Comptoir Zinc & Cave à Vins", "x": 15.5, "z": 8.5, "width": 6.2, "depth": 5.2, "bounds": {"minX": 15.5, "maxX": 21.7, "minZ": 8.5, "maxZ": 13.7}, "floorColor": "#5c3a21", "color": "#b45309"},
                {"id": "zone-bl-terrasse", "zoneId": "zone-bl-terrasse", "name": "Terrasse Riviera", "x": 0.5, "z": 15.2, "width": 16.5, "depth": 7.0, "bounds": {"minX": 0.5, "maxX": 17.0, "minZ": 15.2, "maxZ": 22.2}, "floorColor": "#78716c", "color": "#a8a29e", "openedOn": "2025-04-28"},
            ],
            "navigationGraph": build_navigation_graph_for_premises("premises-bistrot-lumiere"),
        },
        {
            "_id": "premises-osteria-bellavista",
            "businessId": OSTERIA_ID,
            "streetId": STREET_ID,
            "name": "Osteria Bellavista — Trattoria & Griglia Toscana",
            "floorPlanId": "floorplan-osteria-bellavista",
            "theme": "italian_osteria",
            "streetOffset": {"x": 24.0, "y": 0.0, "z": 0.0},
            "bounds": {"minX": 24.0, "maxX": 42.0, "minZ": -6.0, "maxZ": 21.5, "indoorMaxZ": 14.0, "wallHeight": 3.4},
            "entrances": [
                {"id": "door-ob-main", "label": "Ingresso Osteria Bellavista", "x": 33.0, "z": 14.0, "width": 2.2, "kind": "customer"},
                {"id": "door-ob-kitchen", "label": "Porta Cucina", "x": 35.2, "z": 0.0, "width": 1.5, "kind": "internal"},
            ],
            "zones": [
                {"id": "zone-ob-kitchen", "zoneId": "zone-ob-kitchen", "name": "Cucina Pasta Fresca & Griglia", "x": 24.0, "z": -6.0, "width": 18.0, "depth": 6.0, "bounds": {"minX": 24.0, "maxX": 42.0, "minZ": -6.0, "maxZ": 0.0}, "floorColor": "#7c2d12", "color": "#9a3412"},
                {"id": "zone-ob-salle", "zoneId": "zone-ob-salle", "name": "Sala Trattoria & Pergola", "x": 24.0, "z": 0.0, "width": 18.0, "depth": 14.0, "bounds": {"minX": 24.0, "maxX": 42.0, "minZ": 0.0, "maxZ": 14.0}, "floorColor": "#78350f", "color": "#b91c1c"},
                {"id": "zone-ob-bar", "zoneId": "zone-ob-bar", "name": "Banco Aperitivo & Enoteca Barolo", "x": 36.2, "z": 8.5, "width": 5.5, "depth": 5.2, "bounds": {"minX": 36.2, "maxX": 41.7, "minZ": 8.5, "maxZ": 13.7}, "floorColor": "#451a03", "color": "#dc2626"},
                {"id": "zone-ob-terrasse", "zoneId": "zone-ob-terrasse", "name": "Dehors Terrazza", "x": 25.0, "z": 15.2, "width": 15.5, "depth": 6.0, "bounds": {"minX": 25.0, "maxX": 40.5, "minZ": 15.2, "maxZ": 21.2}, "floorColor": "#78716c", "color": "#d97706"},
            ],
            "navigationGraph": build_navigation_graph_for_premises("premises-osteria-bellavista"),
        },
        {
            "_id": "premises-sakana-tei",
            "businessId": SAKANA_ID,
            "streetId": STREET_ID,
            "name": "Sakana-Tei 魚亭 — Omakase Sushi & Robatayaki",
            "floorPlanId": "floorplan-sakana-tei",
            "theme": "japanese_izakaya",
            "streetOffset": {"x": 44.0, "y": 0.0, "z": 0.0},
            "bounds": {"minX": 44.0, "maxX": 62.0, "minZ": -6.0, "maxZ": 21.5, "indoorMaxZ": 14.0, "wallHeight": 3.4},
            "entrances": [
                {"id": "door-sk-main", "label": "Noren Entrance Sakana-Tei", "x": 53.0, "z": 14.0, "width": 2.2, "kind": "customer"},
                {"id": "door-sk-kitchen", "label": "Robata Kitchen Passage", "x": 55.2, "z": 0.0, "width": 1.5, "kind": "internal"},
            ],
            "zones": [
                {"id": "zone-sk-kitchen", "zoneId": "zone-sk-kitchen", "name": "Robatayaki, Tempura & Ramen Kitchen", "x": 44.0, "z": -6.0, "width": 18.0, "depth": 6.0, "bounds": {"minX": 44.0, "maxX": 62.0, "minZ": -6.0, "maxZ": 0.0}, "floorColor": "#334155", "color": "#0f766e"},
                {"id": "zone-sk-salle", "zoneId": "zone-sk-salle", "name": "Hinoki Omakase & Izakaya Hall", "x": 44.0, "z": 0.0, "width": 18.0, "depth": 14.0, "bounds": {"minX": 44.0, "maxX": 62.0, "minZ": 0.0, "maxZ": 14.0}, "floorColor": "#713f12", "color": "#059669"},
                {"id": "zone-sk-bar", "zoneId": "zone-sk-bar", "name": "Sake Junmai & Whisky Highball Bar", "x": 56.2, "z": 8.5, "width": 5.5, "depth": 5.2, "bounds": {"minX": 56.2, "maxX": 61.7, "minZ": 8.5, "maxZ": 13.7}, "floorColor": "#1e293b", "color": "#10b981"},
                {"id": "zone-sk-terrasse", "zoneId": "zone-sk-terrasse", "name": "Zen Bamboo Terrace", "x": 45.0, "z": 15.2, "width": 15.5, "depth": 6.0, "bounds": {"minX": 45.0, "maxX": 60.5, "minZ": 15.2, "maxZ": 21.2}, "floorColor": "#57534e", "color": "#34d399"},
            ],
            "navigationGraph": build_navigation_graph_for_premises("premises-sakana-tei"),
        },
    ]

    for p in premises_defs:
        p["navigationNodes"] = p["navigationGraph"]["nodes"]
        bx = (p["bounds"]["minX"] + p["bounds"]["maxX"]) / 2.0
        bz = (p["bounds"]["minZ"] + p["bounds"]["indoorMaxZ"]) / 2.0
        bw = p["bounds"]["maxX"] - p["bounds"]["minX"]
        bd = p["bounds"]["indoorMaxZ"] - p["bounds"]["minZ"]
        scene_objects.append({
            "_id": f"scene-premises-{p['_id']}",
            "sceneObjectId": f"scene-premises-{p['_id']}",
            "streetId": STREET_ID,
            "businessId": p["businessId"],
            "premisesId": p["_id"],
            "objectType": "premises_building",
            "label": p["name"],
            "zoneId": p["zones"][0]["id"],
            "domainEntityType": "business",
            "domainEntityId": p["businessId"],
            "transform": {"x": bx, "y": 0.0, "z": bz, "w": bw, "d": bd, "width": bw, "depth": bd, "height": 3.4, "rotationY": 0.0},
            "interactive": True,
        })

    # =========================================================================
    # 1. BISTROT LUMIÈRE: 22 Dining Tables + 11 Kitchen/Pass/Bar Stations
    # =========================================================================
    area_map = {a["id"]: a for a in dining_areas}
    bl_table_objects = []
    for t in dining_tables:
        tid = t["id"]
        area = area_map.get(t["areaId"], {})
        map_x = float(area.get("mapX", 0) or 0)
        map_y = float(area.get("mapY", 0) or 0)
        tx = map_x + float(t["x"]) + float(t["w"]) / 2.0
        tz = map_y + float(t["y"]) + float(t["h"]) / 2.0
        tw = max(0.95, float(t["w"]) * 0.58)
        td = max(0.95, float(t["h"]) * 0.58)
        seats = int(t["seats"] or 2)
        is_terrace = t["areaId"] == "bl-a-terrasse"
        sobj_id = f"scene-bl-table-{tid}"
        obj = {
            "_id": sobj_id,
            "sceneObjectId": sobj_id,
            "streetId": STREET_ID,
            "businessId": BISTROT_ID,
            "premisesId": "premises-bistrot-lumiere",
            "objectType": "dining_table",
            "label": f"Table {t['label']} ({seats}p {'Terrasse' if is_terrace else 'Salle'})",
            "zoneId": "zone-bl-terrasse" if is_terrace else "zone-bl-salle",
            "domainEntityType": "table",
            "domainEntityId": tid,
            "tableLabel": t["label"],
            "seats": seats,
            "shape": t.get("shape", "square"),
            "tableStyle": "french_linen",
            "areaId": t["areaId"],
            "modelId": t.get("modelId", "bl-m-table-70"),
            "modelUrl": "/assets/coffee_table_placeholder.glb",
            "transform": {"x": round(tx, 2), "y": 0.0, "z": round(tz, 2), "w": round(tw, 2), "d": round(td, 2), "width": round(tw, 2), "depth": round(td, 2), "height": 0.76, "rotationY": 0.0},
            "interactive": True,
        }
        scene_objects.append(obj)
        bl_table_objects.append(obj)

    lot_by_model: Dict[str, str] = {}
    for lot in asset_lots:
        lot_by_model.setdefault(lot["modelId"], lot["id"])

    bl_stations = [
        {
            "sceneObjectId": "scene-bl-station-piano",
            "objectType": "kitchen_range",
            "label": "Piano Gaz 4 Feux Vifs Charvet (Sauté, Viandes & Poissons)",
            "zoneId": "zone-bl-kitchen",
            "domainEntityType": "station",
            "domainEntityId": "station-bl-piano",
            "stationKind": "kitchen_hot",
            "equipmentStyle": "charvet_range",
            "modelId": "bl-m-piano",
            "assetLotId": lot_by_model.get("bl-m-piano"),
            "transform": {"x": 14.2, "y": 0.0, "z": -4.6, "w": 2.2, "d": 1.0, "width": 2.2, "depth": 1.0, "height": 0.92, "rotationY": 0.0},
        },
        {
            "sceneObjectId": "scene-bl-station-combi",
            "objectType": "combi_oven",
            "label": "Four Mixte Rational iCombi Pro 6-1/1 (Rôtisserie & Braisage)",
            "zoneId": "zone-bl-kitchen",
            "domainEntityType": "station",
            "domainEntityId": "station-bl-combi",
            "stationKind": "kitchen_oven",
            "equipmentStyle": "combi_oven",
            "modelId": "bl-m-combi",
            "assetLotId": lot_by_model.get("bl-m-combi"),
            "transform": {"x": 17.2, "y": 0.0, "z": -4.6, "w": 1.2, "d": 0.95, "width": 1.2, "depth": 0.95, "height": 1.55, "rotationY": 0.0},
        },
        {
            "sceneObjectId": "scene-bl-station-friteuse",
            "objectType": "fryer_station",
            "label": "Friteuse Double 2×8L Valentine (Frites Maison & Socca)",
            "zoneId": "zone-bl-kitchen",
            "domainEntityType": "station",
            "domainEntityId": "station-bl-friteuse",
            "stationKind": "kitchen_fryer",
            "equipmentStyle": "fryer_vat",
            "modelId": "bl-m-friteuse",
            "assetLotId": lot_by_model.get("bl-m-friteuse"),
            "transform": {"x": 11.8, "y": 0.0, "z": -4.6, "w": 1.1, "d": 0.9, "width": 1.1, "depth": 0.9, "height": 0.92, "rotationY": 0.0},
        },
        {
            "sceneObjectId": "scene-bl-station-saladette",
            "objectType": "cold_prep_station",
            "label": "Garde-Manger & Pâtisserie (Saladette Réfrigérée 3 Portes)",
            "zoneId": "zone-bl-kitchen",
            "domainEntityType": "station",
            "domainEntityId": "station-bl-saladette",
            "stationKind": "kitchen_cold",
            "equipmentStyle": "cold_prep_marble",
            "modelId": "bl-m-saladette",
            "assetLotId": lot_by_model.get("bl-m-saladette"),
            "transform": {"x": 9.0, "y": 0.0, "z": -2.6, "w": 2.4, "d": 0.9, "width": 2.4, "depth": 0.9, "height": 0.95, "rotationY": 0.0},
        },
        {
            "sceneObjectId": "scene-bl-station-plonge",
            "objectType": "dishwashing_station",
            "label": "Laverie & Lave-Vaisselle Capot Hobart",
            "zoneId": "zone-bl-kitchen",
            "domainEntityType": "station",
            "domainEntityId": "station-bl-plonge",
            "stationKind": "dishwashing",
            "equipmentStyle": "dish_pit",
            "modelId": "bl-m-plonge",
            "assetLotId": lot_by_model.get("bl-m-plonge"),
            "transform": {"x": 4.8, "y": 0.0, "z": -4.6, "w": 2.4, "d": 0.95, "width": 2.4, "depth": 0.95, "height": 1.4, "rotationY": 0.0},
        },
        {
            "sceneObjectId": "scene-bl-storage-cold",
            "objectType": "ingredient_storage",
            "label": "Chambres Froides Positives & Négatives (Polar / Liebherr)",
            "zoneId": "zone-bl-kitchen",
            "domainEntityType": "storage",
            "domainEntityId": "storage-bl-cold",
            "stationKind": "storage",
            "equipmentStyle": "walkin_cooler",
            "modelId": "bl-m-frigo",
            "assetLotId": lot_by_model.get("bl-m-frigo"),
            "transform": {"x": 1.8, "y": 0.0, "z": -4.5, "w": 2.6, "d": 1.1, "width": 2.6, "depth": 1.1, "height": 2.1, "rotationY": 0.0},
        },
        {
            "sceneObjectId": "scene-bl-station-passe",
            "objectType": "kitchen_pass",
            "label": "Passe Cuisine & Rampe Chauffante Cuivre (Bistrot Lumière)",
            "zoneId": "zone-bl-salle",
            "domainEntityType": "station",
            "domainEntityId": "station-bl-passe",
            "stationKind": "pass",
            "equipmentStyle": "heated_pass",
            "modelId": "bl-m-inox",
            "assetLotId": lot_by_model.get("bl-m-inox"),
            "transform": {"x": 18.8, "y": 0.0, "z": 0.0, "w": 4.2, "d": 1.0, "width": 4.2, "depth": 1.0, "height": 0.95, "rotationY": 0.0},
        },
        {
            "sceneObjectId": "scene-bl-station-bar",
            "objectType": "bar_counter",
            "label": "Comptoir Bar en Zinc, Cave à Vins & Tirage Pression",
            "zoneId": "zone-bl-bar",
            "domainEntityType": "station",
            "domainEntityId": "station-bl-bar",
            "stationKind": "bar",
            "equipmentStyle": "french_zinc_bar",
            "modelId": "bl-m-arrierebar",
            "assetLotId": lot_by_model.get("bl-m-arrierebar"),
            "transform": {"x": 18.6, "y": 0.0, "z": 10.8, "w": 4.8, "d": 1.5, "width": 4.8, "depth": 1.5, "height": 1.12, "rotationY": 0.0},
        },
        {
            "sceneObjectId": "scene-bl-station-expresso",
            "objectType": "coffee_machine",
            "label": "Machine Expresso Conti 2 Groupes & Moulin Mazzer",
            "zoneId": "zone-bl-bar",
            "domainEntityType": "station",
            "domainEntityId": "station-bl-expresso",
            "stationKind": "bar_coffee",
            "equipmentStyle": "espresso_bar",
            "modelId": "bl-m-moulin",
            "assetLotId": lot_by_model.get("bl-m-moulin"),
            "transform": {"x": 20.2, "y": 0.95, "z": 10.9, "w": 0.9, "d": 0.65, "width": 0.9, "depth": 0.65, "height": 0.55, "rotationY": 0.0},
        },
        {
            "sceneObjectId": "scene-bl-pos-main",
            "objectType": "pos_terminal",
            "label": "Caisse Centrale iPad & Terminal TPE (Bistrot Lumière)",
            "zoneId": "zone-bl-bar",
            "domainEntityType": "pos_terminal",
            "domainEntityId": "pos-bl-main",
            "stationKind": "pos",
            "equipmentStyle": "pos_stand",
            "modelId": "bl-m-caisse",
            "assetLotId": lot_by_model.get("bl-m-caisse"),
            "transform": {"x": 16.4, "y": 0.95, "z": 10.5, "w": 0.55, "d": 0.5, "width": 0.55, "depth": 0.5, "height": 0.45, "rotationY": 0.0},
        },
        {
            "sceneObjectId": "scene-bl-door-main",
            "objectType": "entrance",
            "label": "Entrée Principale Bistrot Lumière",
            "zoneId": "zone-bl-salle",
            "domainEntityType": "entrance",
            "domainEntityId": "door-bl-main",
            "transform": {"x": 10.0, "y": 0.0, "z": 14.0, "w": 2.2, "d": 0.35, "width": 2.2, "depth": 0.35, "height": 2.4, "rotationY": 0.0},
        },
    ]

    for st in bl_stations:
        st["_id"] = st["sceneObjectId"]
        st["streetId"] = STREET_ID
        st["businessId"] = BISTROT_ID
        st["premisesId"] = "premises-bistrot-lumiere"
        st["interactive"] = True
        scene_objects.append(st)

    # =========================================================================
    # 2. OSTERIA BELLAVISTA: 10 Dining Tables + 8 Cucina/Pass/Aperitivo Stations
    # =========================================================================
    ob_tables_spec = [
        {"id": "ob-t1", "label": "T1", "seats": 2, "x": 26.2, "z": 3.8, "w": 1.1, "d": 1.1, "zone": "zone-ob-salle"},
        {"id": "ob-t2", "label": "T2", "seats": 4, "x": 30.2, "z": 3.8, "w": 1.4, "d": 1.15, "zone": "zone-ob-salle"},
        {"id": "ob-t3", "label": "T3", "seats": 4, "x": 34.4, "z": 3.8, "w": 1.4, "d": 1.15, "zone": "zone-ob-salle"},
        {"id": "ob-t4", "label": "T4", "seats": 2, "x": 26.2, "z": 8.0, "w": 1.1, "d": 1.1, "zone": "zone-ob-salle"},
        {"id": "ob-t5", "label": "T5", "seats": 6, "x": 30.5, "z": 8.0, "w": 1.85, "d": 1.25, "zone": "zone-ob-salle"},
        {"id": "ob-t6", "label": "T6", "seats": 4, "x": 34.6, "z": 8.0, "w": 1.4, "d": 1.15, "zone": "zone-ob-salle"},
        {"id": "ob-t7", "label": "T7", "seats": 2, "x": 29.2, "z": 11.6, "w": 1.1, "d": 1.1, "zone": "zone-ob-salle"},
        {"id": "ob-tr1", "label": "TR1", "seats": 2, "x": 27.5, "z": 17.5, "w": 1.1, "d": 1.1, "zone": "zone-ob-terrasse"},
        {"id": "ob-tr2", "label": "TR2", "seats": 4, "x": 32.8, "z": 17.5, "w": 1.4, "d": 1.15, "zone": "zone-ob-terrasse"},
        {"id": "ob-tr3", "label": "TR3", "seats": 4, "x": 38.0, "z": 17.5, "w": 1.4, "d": 1.15, "zone": "zone-ob-terrasse"},
    ]
    for t in ob_tables_spec:
        is_tr = "terrasse" in t["zone"]
        sobj_id = f"scene-ob-table-{t['id']}"
        scene_objects.append({
            "_id": sobj_id,
            "sceneObjectId": sobj_id,
            "streetId": STREET_ID,
            "businessId": OSTERIA_ID,
            "premisesId": "premises-osteria-bellavista",
            "objectType": "dining_table",
            "label": f"Tavolo {t['label']} ({t['seats']}p {'Dehors' if is_tr else 'Sala Trattoria'})",
            "zoneId": t["zone"],
            "domainEntityType": "table",
            "domainEntityId": t["id"],
            "tableLabel": t["label"],
            "seats": t["seats"],
            "tableStyle": "italian_trattoria",
            "transform": {"x": t["x"], "y": 0.0, "z": t["z"], "w": t["w"], "d": t["d"], "width": t["w"], "depth": t["d"], "height": 0.76, "rotationY": 0.0},
            "interactive": True,
        })

    ob_stations = [
        {
            "sceneObjectId": "scene-ob-station-pasta",
            "objectType": "kitchen_range",
            "label": "Bollitore Pasta Fresca & Mantecatura Risotti (6 Paniers Cuivre)",
            "zoneId": "zone-ob-kitchen",
            "domainEntityType": "station",
            "domainEntityId": "station-ob-pasta",
            "stationKind": "pasta_station",
            "equipmentStyle": "pasta_boiler_range",
            "transform": {"x": 34.2, "y": 0.0, "z": -4.6, "w": 2.4, "d": 1.0, "width": 2.4, "depth": 1.0, "height": 0.92, "rotationY": 0.0},
        },
        {
            "sceneObjectId": "scene-ob-station-grill",
            "objectType": "wood_grill",
            "label": "Griglia Toscana a Carbone & Forno Bistecca Fiorentina",
            "zoneId": "zone-ob-kitchen",
            "domainEntityType": "station",
            "domainEntityId": "station-ob-grill",
            "stationKind": "wood_grill",
            "equipmentStyle": "tuscan_hearth_grill",
            "transform": {"x": 38.4, "y": 0.0, "z": -4.5, "w": 2.4, "d": 1.15, "width": 2.4, "depth": 1.15, "height": 1.65, "rotationY": 0.0},
        },
        {
            "sceneObjectId": "scene-ob-station-antipasti",
            "objectType": "cold_prep_station",
            "label": "Banco Antipasti, Burrata, Dolci & Affettatrice Berkel",
            "zoneId": "zone-ob-kitchen",
            "domainEntityType": "station",
            "domainEntityId": "station-ob-antipasti",
            "stationKind": "antipasti_station",
            "equipmentStyle": "cold_prep_marble",
            "transform": {"x": 30.2, "y": 0.0, "z": -2.8, "w": 2.4, "d": 0.9, "width": 2.4, "depth": 0.9, "height": 0.95, "rotationY": 0.0},
        },
        {
            "sceneObjectId": "scene-ob-station-plonge",
            "objectType": "dishwashing_station",
            "label": "Lavaggio Stoviglie & Cristalleria Osteria",
            "zoneId": "zone-ob-kitchen",
            "domainEntityType": "station",
            "domainEntityId": "station-ob-plonge",
            "stationKind": "dishwashing",
            "equipmentStyle": "dish_pit",
            "transform": {"x": 27.4, "y": 0.0, "z": -4.6, "w": 2.0, "d": 0.9, "width": 2.0, "depth": 0.9, "height": 1.35, "rotationY": 0.0},
        },
        {
            "sceneObjectId": "scene-ob-storage-cold",
            "objectType": "ingredient_storage",
            "label": "Cella Frigorifera Salumi DOP, Tartufi d'Alba & Parmigiano 36M",
            "zoneId": "zone-ob-kitchen",
            "domainEntityType": "storage",
            "domainEntityId": "storage-ob-cold",
            "stationKind": "storage",
            "equipmentStyle": "walkin_cooler",
            "transform": {"x": 25.2, "y": 0.0, "z": -4.5, "w": 2.0, "d": 1.05, "width": 2.0, "depth": 1.05, "height": 2.1, "rotationY": 0.0},
        },
        {
            "sceneObjectId": "scene-ob-station-passe",
            "objectType": "kitchen_pass",
            "label": "Pass Cucina Marmo di Carrara & Lampade Rame (Osteria)",
            "zoneId": "zone-ob-salle",
            "domainEntityType": "station",
            "domainEntityId": "station-ob-passe",
            "stationKind": "pass",
            "equipmentStyle": "heated_pass",
            "transform": {"x": 38.4, "y": 0.0, "z": 0.0, "w": 3.8, "d": 1.0, "width": 3.8, "depth": 1.0, "height": 0.95, "rotationY": 0.0},
        },
        {
            "sceneObjectId": "scene-ob-station-bar",
            "objectType": "bar_counter",
            "label": "Banco Aperitivo, Negroni Bar & Cantina Barolo DOCG",
            "zoneId": "zone-ob-bar",
            "domainEntityType": "station",
            "domainEntityId": "station-ob-bar",
            "stationKind": "bar",
            "equipmentStyle": "italian_enoteca_bar",
            "transform": {"x": 39.0, "y": 0.0, "z": 10.8, "w": 4.4, "d": 1.4, "width": 4.4, "depth": 1.4, "height": 1.12, "rotationY": 0.0},
        },
        {
            "sceneObjectId": "scene-ob-pos-main",
            "objectType": "pos_terminal",
            "label": "Cassa Centrale Osteria Bellavista",
            "zoneId": "zone-ob-bar",
            "domainEntityType": "pos_terminal",
            "domainEntityId": "pos-ob-main",
            "stationKind": "pos",
            "equipmentStyle": "pos_stand",
            "transform": {"x": 36.8, "y": 0.95, "z": 10.5, "w": 0.55, "d": 0.5, "width": 0.55, "depth": 0.5, "height": 0.45, "rotationY": 0.0},
        },
    ]
    for st in ob_stations:
        st["_id"] = st["sceneObjectId"]
        st["streetId"] = STREET_ID
        st["businessId"] = OSTERIA_ID
        st["premisesId"] = "premises-osteria-bellavista"
        st["interactive"] = True
        scene_objects.append(st)

    # =========================================================================
    # 3. SAKANA-TEI 魚亭: 10 Dining Tables + 8 Sushi/Robata/Tempura/Sake Stations
    # =========================================================================
    sk_tables_spec = [
        {"id": "sk-t1", "label": "K1", "seats": 2, "x": 46.2, "z": 3.8, "w": 1.1, "d": 1.1, "zone": "zone-sk-salle"},
        {"id": "sk-t2", "label": "K2", "seats": 4, "x": 50.2, "z": 3.8, "w": 1.4, "d": 1.15, "zone": "zone-sk-salle"},
        {"id": "sk-t3", "label": "K3", "seats": 4, "x": 54.4, "z": 3.8, "w": 1.4, "d": 1.15, "zone": "zone-sk-salle"},
        {"id": "sk-t4", "label": "K4", "seats": 2, "x": 46.2, "z": 8.0, "w": 1.1, "d": 1.1, "zone": "zone-sk-salle"},
        {"id": "sk-t5", "label": "K5", "seats": 6, "x": 50.5, "z": 8.0, "w": 1.85, "d": 1.25, "zone": "zone-sk-salle"},
        {"id": "sk-t6", "label": "K6", "seats": 4, "x": 54.6, "z": 8.0, "w": 1.4, "d": 1.15, "zone": "zone-sk-salle"},
        {"id": "sk-t7", "label": "K7", "seats": 2, "x": 49.2, "z": 11.6, "w": 1.1, "d": 1.1, "zone": "zone-sk-salle"},
        {"id": "sk-tr1", "label": "Z1", "seats": 2, "x": 47.5, "z": 17.5, "w": 1.1, "d": 1.1, "zone": "zone-sk-terrasse"},
        {"id": "sk-tr2", "label": "Z2", "seats": 4, "x": 52.8, "z": 17.5, "w": 1.4, "d": 1.15, "zone": "zone-sk-terrasse"},
        {"id": "sk-tr3", "label": "Z3", "seats": 4, "x": 58.0, "z": 17.5, "w": 1.4, "d": 1.15, "zone": "zone-sk-terrasse"},
    ]
    for t in sk_tables_spec:
        is_tr = "terrasse" in t["zone"]
        sobj_id = f"scene-sk-table-{t['id']}"
        scene_objects.append({
            "_id": sobj_id,
            "sceneObjectId": sobj_id,
            "streetId": STREET_ID,
            "businessId": SAKANA_ID,
            "premisesId": "premises-sakana-tei",
            "objectType": "dining_table",
            "label": f"Table Tatami {t['label']} ({t['seats']}p {'Jardin Zen' if is_tr else 'Salle Izakaya'})",
            "zoneId": t["zone"],
            "domainEntityType": "table",
            "domainEntityId": t["id"],
            "tableLabel": t["label"],
            "seats": t["seats"],
            "tableStyle": "japanese_hinoki",
            "transform": {"x": t["x"], "y": 0.0, "z": t["z"], "w": t["w"], "d": t["d"], "width": t["w"], "depth": t["d"], "height": 0.74, "rotationY": 0.0},
            "interactive": True,
        })

    sk_stations = [
        {
            "sceneObjectId": "scene-sk-station-sushi",
            "objectType": "sushi_counter",
            "label": "Comptoir Omakase en Cyprès Hinoki & Vitrine Sashimi Edomae",
            "zoneId": "zone-sk-kitchen",
            "domainEntityType": "station",
            "domainEntityId": "station-sk-sushi",
            "stationKind": "sushi_bar",
            "equipmentStyle": "hinoki_sushi_counter",
            "transform": {"x": 50.2, "y": 0.0, "z": -2.2, "w": 2.8, "d": 1.0, "width": 2.8, "depth": 1.0, "height": 1.02, "rotationY": 0.0},
        },
        {
            "sceneObjectId": "scene-sk-station-robata",
            "objectType": "robata_grill",
            "label": "Grill Robatayaki au Charbon Blanc Binchotan (Wagyu & Black Cod)",
            "zoneId": "zone-sk-kitchen",
            "domainEntityType": "station",
            "domainEntityId": "station-sk-robata",
            "stationKind": "robata_grill",
            "equipmentStyle": "binchotan_robata",
            "transform": {"x": 58.2, "y": 0.0, "z": -4.5, "w": 2.4, "d": 1.1, "width": 2.4, "depth": 1.1, "height": 1.15, "rotationY": 0.0},
        },
        {
            "sceneObjectId": "scene-sk-station-tempura",
            "objectType": "kitchen_range",
            "label": "Friteuse Tempura Cuivre & Chaudrons Ramen Tonkotsu",
            "zoneId": "zone-sk-kitchen",
            "domainEntityType": "station",
            "domainEntityId": "station-sk-tempura",
            "stationKind": "tempura_ramen",
            "equipmentStyle": "tempura_ramen_range",
            "transform": {"x": 54.2, "y": 0.0, "z": -4.6, "w": 2.3, "d": 1.0, "width": 2.3, "depth": 1.0, "height": 0.94, "rotationY": 0.0},
        },
        {
            "sceneObjectId": "scene-sk-station-plonge",
            "objectType": "dishwashing_station",
            "label": "Plonge Céramiques & Laques Japonaises",
            "zoneId": "zone-sk-kitchen",
            "domainEntityType": "station",
            "domainEntityId": "station-sk-plonge",
            "stationKind": "dishwashing",
            "equipmentStyle": "dish_pit",
            "transform": {"x": 47.4, "y": 0.0, "z": -4.6, "w": 2.0, "d": 0.9, "width": 2.0, "depth": 0.9, "height": 1.35, "rotationY": 0.0},
        },
        {
            "sceneObjectId": "scene-sk-storage-cold",
            "objectType": "ingredient_storage",
            "label": "Chambre Froide -60°C Thon Rouge Otoro, Saint-Jacques & Wagyu A5",
            "zoneId": "zone-sk-kitchen",
            "domainEntityType": "storage",
            "domainEntityId": "storage-sk-cold",
            "stationKind": "storage",
            "equipmentStyle": "walkin_cooler",
            "transform": {"x": 45.2, "y": 0.0, "z": -4.5, "w": 2.0, "d": 1.05, "width": 2.0, "depth": 1.05, "height": 2.1, "rotationY": 0.0},
        },
        {
            "sceneObjectId": "scene-sk-station-passe",
            "objectType": "kitchen_pass",
            "label": "Passe Cuisine Hinoki & Dressage Izakaya (Sakana-Tei)",
            "zoneId": "zone-sk-salle",
            "domainEntityType": "station",
            "domainEntityId": "station-sk-passe",
            "stationKind": "pass",
            "equipmentStyle": "heated_pass",
            "transform": {"x": 58.4, "y": 0.0, "z": 0.0, "w": 3.8, "d": 1.0, "width": 3.8, "depth": 1.0, "height": 0.95, "rotationY": 0.0},
        },
        {
            "sceneObjectId": "scene-sk-station-bar",
            "objectType": "bar_counter",
            "label": "Bar à Saké Junmai Daiginjo, Matcha & Whisky Japonais",
            "zoneId": "zone-sk-bar",
            "domainEntityType": "station",
            "domainEntityId": "station-sk-bar",
            "stationKind": "bar",
            "equipmentStyle": "japanese_sake_bar",
            "transform": {"x": 59.0, "y": 0.0, "z": 10.8, "w": 4.4, "d": 1.4, "width": 4.4, "depth": 1.4, "height": 1.12, "rotationY": 0.0},
        },
        {
            "sceneObjectId": "scene-sk-pos-main",
            "objectType": "pos_terminal",
            "label": "Caisse Centrale Sakana-Tei",
            "zoneId": "zone-sk-bar",
            "domainEntityType": "pos_terminal",
            "domainEntityId": "pos-sk-main",
            "stationKind": "pos",
            "equipmentStyle": "pos_stand",
            "transform": {"x": 56.8, "y": 0.95, "z": 10.5, "w": 0.55, "d": 0.5, "width": 0.55, "depth": 0.5, "height": 0.45, "rotationY": 0.0},
        },
    ]
    for st in sk_stations:
        st["_id"] = st["sceneObjectId"]
        st["streetId"] = STREET_ID
        st["businessId"] = SAKANA_ID
        st["premisesId"] = "premises-sakana-tei"
        st["interactive"] = True
        scene_objects.append(st)

    floor_plans = [
        {
            "_id": p["floorPlanId"],
            "premisesId": p["_id"],
            "businessId": p["businessId"],
            "streetId": STREET_ID,
            "name": p["name"],
            "theme": p["theme"],
            "bounds": p["bounds"],
            "zones": p["zones"],
            "entrances": p["entrances"],
            "navigationNodes": p["navigationNodes"],
            "navigationGraph": p["navigationGraph"],
        }
        for p in premises_defs
    ]

    return {
        "premises": premises_defs,
        "floorPlans": floor_plans,
        "sceneObjects": scene_objects,
        "blTableObjects": bl_table_objects,
    }
