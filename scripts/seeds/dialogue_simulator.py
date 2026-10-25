#!/usr/bin/env python3
"""
Deterministic Multi-Turn Hospitality Dialogue Simulator (`DialogueSimulator`)
for the Multi-Venue 3D Hospitality Street Simulation Platform.

Produces realistic, culturally authentic multi-turn conversations and concise 3D floating
speech bubbles across all three specialty restaurants on Rue de la Lumière (Nice):
  1. `business-bistrot-lumiere` (**Bistrot Lumière** — Parisian Brasserie & Cuisine Niçoise)
  2. `business-osteria-bellavista` (**Osteria Bellavista** — Tuscan Trattoria & Wood-Fired Grill)
  3. `business-sakana-tei` (**Sakana-Tei 魚亭** — Hinoki Omakase Sushi & Binchotan Robatayaki)
"""

from __future__ import annotations

import hashlib
import random
from typing import Any, Dict, List, Optional, Union

BISTROT_ID = "business-bistrot-lumiere"
OSTERIA_ID = "business-osteria-bellavista"
SAKANA_ID = "business-sakana-tei"

SUPPORTED_INTERACTION_TYPES = (
    "CUSTOMER_ARRIVAL",
    "PARTY_SEATED",
    "ORDER_CREATED",
    "ORDER_LINES_SENT_TO_STATION",
    "INGREDIENT_UNIT_TAKEN",
    "INGREDIENT_CONTENTION_DEFERRED",
    "INGREDIENT_CONTENTION_RETRY",
    "INGREDIENT_WAIT_FOR_UNIT",
    "INGREDIENT_UNIT_RETURNED",
    "BAR_BOTTLE_TAKEN",
    "BAR_DRINK_POURED",
    "BAR_BOTTLE_RETURNED",
    "ITEM_PREP_STARTED",
    "ITEM_READY_AT_PASS",
    "ORDER_PICKED_UP_FROM_PASS",
    "ORDER_DELIVERED_TO_TABLE",
    "PAYMENT_COMPLETED",
    "CUSTOMER_DEPARTED",
)

VENUE_PROFILES: Dict[str, Dict[str, Any]] = {
    BISTROT_ID: {
        "name": "Bistrot Lumière",
        "style": "french_bistrot",
        "defaultHost": {"name": "Léa Fontaine", "role": "Host", "agentId": "agent-emp-lea"},
        "defaultWaiter": {"name": "Thomas Girard", "role": "Waiter", "agentId": "agent-emp-thomas"},
        "defaultChef": {"name": "Karim Benali", "role": "Chef", "agentId": "agent-emp-karim"},
        "defaultColdChef": {"name": "Sofia Rossi", "role": "Chef", "agentId": "agent-emp-sofia"},
        "defaultBarman": {"name": "Manon Leroy", "role": "Barman", "agentId": "agent-emp-manon"},
        "defaultStarter": "Salade Niçoise Traditionnelle au Thon Germon",
        "defaultMain": "Entrecôte Maturée Charolaise Sauce Béarnaise",
        "defaultDessert": "Tarte Fine aux Pommes Caramélisées",
        "defaultDrink": "Verre de Chablis Premier Cru Vaillons",
        "defaultDailySpecial": "Loup de Méditerranée Rôti au Fenouil Sauvage",
        "defaultShelfLabel": "Chambre Froide — Étagère Maraîchère (Niveau 2)",
        "defaultBarShelfLabel": "Comptoir Zinc — Étagère Spiritueux & Crus",
    },
    OSTERIA_ID: {
        "name": "Osteria Bellavista",
        "style": "italian_osteria",
        "defaultHost": {"name": "Lorenzo Moretti", "role": "Host", "agentId": "agent-emp-ob-lorenzo"},
        "defaultWaiter": {"name": "Chiara Bianchi", "role": "Waiter", "agentId": "agent-emp-ob-chiara"},
        "defaultChef": {"name": "Marco Bellini", "role": "Chef", "agentId": "agent-emp-ob-marco"},
        "defaultColdChef": {"name": "Matteo Lombardi", "role": "Chef", "agentId": "agent-emp-ob-matteo"},
        "defaultBarman": {"name": "Alessandro Greco", "role": "Barman", "agentId": "agent-emp-ob-alessandro"},
        "defaultStarter": "Burrata di Andria IGP, Pêche Rôtie & Basilic Pourpre",
        "defaultMain": "Tagliatelle Fresche al Tartufo Nero di Norcia",
        "defaultDessert": "Tiramisù della Casa al Mascarpone Artigianale & Marsala",
        "defaultDrink": "Calice di Brunello di Montalcino DOCG Riserva",
        "defaultDailySpecial": "Tagliata di Chianina IGP alla Brace & Romarin",
        "defaultShelfLabel": "Cella Frigorifera DOP — Niveau 2 (Orto & Tartufi)",
        "defaultBarShelfLabel": "Banco Aperitivo — Étagère Enoteca & Amari",
    },
    SAKANA_ID: {
        "name": "Sakana-Tei 魚亭",
        "style": "japanese_izakaya",
        "defaultHost": {"name": "Yuki Nakamura", "role": "Host", "agentId": "agent-emp-sk-yuki"},
        "defaultWaiter": {"name": "Aoi Kobayashi", "role": "Waiter", "agentId": "agent-emp-sk-aoi"},
        "defaultChef": {"name": "Kenji Takahashi", "role": "Chef", "agentId": "agent-emp-sk-kenji"},
        "defaultColdChef": {"name": "Haruka Sato", "role": "Chef", "agentId": "agent-emp-sk-haruka"},
        "defaultBarman": {"name": "Yuki Nakamura", "role": "Barman", "agentId": "agent-emp-sk-yuki"},
        "defaultStarter": "Sashimi Moriawase Grand Cru (Otoro, Hamachi & Hotate)",
        "defaultMain": "Omakase Nigiri 8 Pièces du Maître Itamae",
        "defaultDessert": "Parfait Matcha d'Uji, Daifuku Mochi & Sésame Noir",
        "defaultDrink": "Tokkuri Saké Dassai 23 Junmai Daiginjo (180ml)",
        "defaultDailySpecial": "Black Cod d'Alaska Laqué au Saikyo Miso sur Binchotan",
        "defaultShelfLabel": "Chambre Froide -60°C & Étagère Fraîcheur (Niveau 2)",
        "defaultBarShelfLabel": "Bar Saké & Whisky — Étagère Junmai Daiginjo",
    },
}


def _coerce_rng(
    rng: Optional[Union[random.Random, int, str]],
    business_id: str,
    interaction_type: str,
    context: Dict[str, Any],
) -> random.Random:
    if isinstance(rng, random.Random):
        return rng
    if isinstance(rng, int):
        return random.Random(rng)
    if isinstance(rng, str):
        seed_int = int(hashlib.sha256(rng.encode("utf-8")).hexdigest()[:16], 16)
        return random.Random(seed_int)
    seed_material = "|".join(
        str(x)
        for x in (
            business_id,
            interaction_type,
            context.get("orderId") or context.get("order_id") or "",
            context.get("unitId") or context.get("unit_id") or "",
            context.get("dishName") or context.get("dish_name") or "",
            context.get("tableLabel") or context.get("table_label") or "",
            context.get("course") or "",
            context.get("sequence") or context.get("eventTimeMs") or "",
        )
    )
    seed_int = int(hashlib.sha256(seed_material.encode("utf-8")).hexdigest()[:16], 16)
    return random.Random(seed_int)


def _fmt_qty(val: Any, unit: str = "g") -> str:
    try:
        fval = float(val)
        if abs(fval - round(fval)) < 1e-6:
            return f"{int(round(fval))}{unit}"
        return f"{fval:.1f}{unit}"
    except Exception:
        return f"{val}{unit}"


def _clean_guest_name(raw_name: str) -> str:
    if not raw_name:
        return "Moreau"
    cleaned = raw_name.split("(")[0].strip()
    for prefix in ("Table ", "Tavolo ", "Famille ", "Omakase — "):
        if cleaned.startswith(prefix) and len(cleaned) > len(prefix):
            cleaned = cleaned[len(prefix):].strip()
    return cleaned or "Moreau"


def generate_interaction_dialogue(
    business_id: str,
    interaction_type: str,
    context: Optional[Dict[str, Any]] = None,
    rng: Optional[Union[random.Random, int, str]] = None,
) -> Dict[str, Any]:
    """
    Deterministically generates a rich multi-turn hospitality conversation and 3D summary speech bubble
    for any interaction across Bistrot Lumière, Osteria Bellavista, and Sakana-Tei.
    """
    ctx = dict(context or {})
    venue = VENUE_PROFILES.get(business_id, VENUE_PROFILES[BISTROT_ID])
    style = venue["style"]
    local_rng = _coerce_rng(rng, business_id, interaction_type, ctx)

    # Extract common context entities with fallback defaults
    raw_party_name = (
        ctx.get("partyName")
        or ctx.get("party_name")
        or ctx.get("guestName")
        or ctx.get("customerName")
        or "Famille Moreau"
    )
    guest_display = _clean_guest_name(str(raw_party_name))
    party_size = int(ctx.get("partySize") or ctx.get("party_size") or ctx.get("covers") or 2)
    table_label = str(
        ctx.get("tableLabel")
        or ctx.get("table_label")
        or ctx.get("tableId")
        or ("T4" if style != "japanese_izakaya" else "K2")
    )
    order_id = str(ctx.get("orderId") or ctx.get("order_id") or "ord-001")

    host_name = str(ctx.get("hostName") or ctx.get("host_name") or venue["defaultHost"]["name"])
    host_agent_id = ctx.get("hostAgentId") or ctx.get("host_agent_id") or venue["defaultHost"]["agentId"]

    waiter_name = str(ctx.get("waiterName") or ctx.get("waiter_name") or venue["defaultWaiter"]["name"])
    waiter_agent_id = ctx.get("waiterAgentId") or ctx.get("waiter_agent_id") or venue["defaultWaiter"]["agentId"]

    chef_name = str(
        ctx.get("cookName")
        or ctx.get("cook_name")
        or ctx.get("chefName")
        or ctx.get("chef_name")
        or venue["defaultChef"]["name"]
    )
    chef_agent_id = (
        ctx.get("cookAgentId")
        or ctx.get("cook_agent_id")
        or ctx.get("chefAgentId")
        or ctx.get("chef_agent_id")
        or venue["defaultChef"]["agentId"]
    )

    contended_cook_name = str(
        ctx.get("contendedWithCookName")
        or ctx.get("contended_with_cook_name")
        or ctx.get("holderCookName")
        or venue["defaultColdChef"]["name"]
    )
    if contended_cook_name == chef_name:
        contended_cook_name = (
            venue["defaultColdChef"]["name"]
            if chef_name != venue["defaultColdChef"]["name"]
            else venue["defaultChef"]["name"]
        )
    contended_cook_agent_id = (
        ctx.get("contendedWithCookAgentId")
        or venue["defaultColdChef"]["agentId"]
    )

    barman_name = str(ctx.get("barmanName") or ctx.get("barman_name") or venue["defaultBarman"]["name"])
    barman_agent_id = ctx.get("barmanAgentId") or ctx.get("barman_agent_id") or venue["defaultBarman"]["agentId"]

    customer_agent_id = ctx.get("customerAgentId") or ctx.get("customer_agent_id") or f"agent-cust-{order_id[-6:]}"

    # Extract dishes from context (`items`, `dishName`, `starterName`, `mainName`, `dessertName`, `drinkName`)
    items_list = ctx.get("items") or []
    item_names = [it.get("name") for it in items_list if isinstance(it, dict) and it.get("name")]
    dish_name = str(
        ctx.get("dishName")
        or ctx.get("dish_name")
        or (item_names[0] if item_names else venue["defaultMain"])
    )
    starter_name = str(ctx.get("starterName") or ctx.get("starter_name") or (item_names[0] if len(item_names) > 0 else venue["defaultStarter"]))
    main_name = str(ctx.get("mainName") or ctx.get("main_name") or (item_names[1] if len(item_names) > 1 else dish_name))
    dessert_name = str(ctx.get("dessertName") or ctx.get("dessert_name") or venue["defaultDessert"])
    drink_name = str(ctx.get("drinkName") or ctx.get("drink_name") or venue["defaultDrink"])

    # Extract ingredient & shelf details
    unit_id = str(ctx.get("unitId") or ctx.get("unit_id") or "unit-concombre-01")
    unit_short = unit_id.split("-")[-1] if "-" in unit_id else "01"
    ing_name = str(
        ctx.get("ingredientName")
        or ctx.get("ingredient_name")
        or ctx.get("unitName")
        or ctx.get("name")
        or ("Concombre Bio de Provence" if style == "french_bistrot" else ("Cetriolo Toscano" if style == "italian_osteria" else "Concombre Kyuri"))
    )
    unit_measure = str(ctx.get("unit") or "g")
    qty_used = ctx.get("qtyUsed") if ctx.get("qtyUsed") is not None else (ctx.get("qty_used") or ctx.get("qty") or 30.0)
    qty_before = ctx.get("qtyBefore") if ctx.get("qtyBefore") is not None else (ctx.get("qty_before") or ctx.get("initialQty") or 150.0)
    qty_after = (
        ctx.get("qtyAfter")
        if ctx.get("qtyAfter") is not None
        else (ctx.get("qty_after") if ctx.get("qty_after") is not None else max(0.0, float(qty_before) - float(qty_used)))
    )
    shelf_label = str(ctx.get("shelfLabel") or ctx.get("shelf_label") or venue["defaultShelfLabel"])
    shelf_tier = int(ctx.get("shelfTier") or ctx.get("shelf_tier") or 2)
    slot_index = int(ctx.get("slotIndex") if ctx.get("slotIndex") is not None else (ctx.get("slot_index") or 0))
    wait_sec = int(ctx.get("waitDurationSec") if ctx.get("waitDurationSec") is not None else (ctx.get("wait_duration_sec") or 11))
    other_ings = ctx.get("otherIngredients") or ctx.get("other_ingredients") or ["Tomates Cœur de Bœuf", "Olives de Nice AOP", "Huile d'Olive Vierge"]
    other_ings_str = ", ".join(str(x) for x in other_ings[:3])

    # Extract bar bottle details
    bottle_name = str(
        ctx.get("bottleName")
        or ctx.get("bottle_name")
        or ctx.get("ingredientName")
        or (drink_name if "unit" not in ctx else ing_name)
    )
    bottle_idx = int(ctx.get("bottleIndex") or ctx.get("bottle_index") or 1)
    total_bottles = int(ctx.get("totalBottles") or ctx.get("total_bottles") or 1)
    bar_shelf_label = str(ctx.get("shelfLabel") or venue["defaultBarShelfLabel"])
    pour_ml = ctx.get("qtyUsed") or ctx.get("pourMl") or ctx.get("qty_ml") or 50.0
    bottle_before_ml = ctx.get("qtyBefore") or ctx.get("bottleBeforeMl") or 700.0
    bottle_after_ml = ctx.get("qtyAfter") if ctx.get("qtyAfter") is not None else max(0.0, float(bottle_before_ml) - float(pour_ml))

    # Payment details
    paid_cents = int(ctx.get("paidCents") or ctx.get("paid_cents") or ctx.get("subtotalCents") or 8400)
    tip_cents = int(ctx.get("tipCents") or ctx.get("tip_cents") or 700)
    paid_eur = f"{paid_cents / 100.0:.2f} €"
    tip_eur = f"{tip_cents / 100.0:.2f} €"

    turns: List[Dict[str, Any]] = []
    summary_bubble = ""

    # =========================================================================
    # 1. CUSTOMER_ARRIVAL
    # =========================================================================
    if interaction_type == "CUSTOMER_ARRIVAL":
        if style == "french_bistrot":
            greetings = [
                f"Bonsoir ! Nous avons une table réservée pour {party_size} personnes au nom de {guest_display}.",
                f"Bonjour ! Table pour {party_size} au nom de {guest_display}, s'il vous plaît.",
            ]
            g_line = local_rng.choice(greetings)
            summary_bubble = f"« Bonsoir ! Table pour {party_size} réservée au nom de {guest_display}. »"
            turns = [
                {"speakerName": guest_display, "speakerRole": "Customer", "speakerAgentId": customer_agent_id, "text": g_line, "offsetSec": 0},
                {"speakerName": host_name, "speakerRole": "Host", "speakerAgentId": host_agent_id, "text": f"Bonsoir et bienvenue au Bistrot Lumière ! Je vérifie le registre... Parfait, table {table_label} pour {party_size} couverts.", "offsetSec": 3},
                {"speakerName": guest_display, "speakerRole": "Customer", "speakerAgentId": customer_agent_id, "text": "Merci beaucoup, l'ambiance de la salle est superbe ce soir.", "offsetSec": 6},
            ]
        elif style == "italian_osteria":
            summary_bubble = f"« Buonasera ! Tavolo per {party_size} a nome {guest_display}. »"
            turns = [
                {"speakerName": guest_display, "speakerRole": "Customer", "speakerAgentId": customer_agent_id, "text": f"Buonasera ! Nous avons réservé une table pour {party_size} personnes au nom de {guest_display}.", "offsetSec": 0},
                {"speakerName": host_name, "speakerRole": "Host", "speakerAgentId": host_agent_id, "text": f"Buonasera e benvenuti all'Osteria Bellavista ! Votre table {table_label} est prête près de la pergola.", "offsetSec": 3},
                {"speakerName": guest_display, "speakerRole": "Customer", "speakerAgentId": customer_agent_id, "text": "Grazie mille ! Le parfum de la griglia toscane donne déjà faim.", "offsetSec": 6},
            ]
        else:
            summary_bubble = f"« Konbanwa ! Réservation pour {party_size} au nom de {guest_display}. »"
            turns = [
                {"speakerName": guest_display, "speakerRole": "Customer", "speakerAgentId": customer_agent_id, "text": f"Konbanwa ! Nous avons une réservation pour {party_size} personnes au nom de {guest_display}.", "offsetSec": 0},
                {"speakerName": host_name, "speakerRole": "Host", "speakerAgentId": host_agent_id, "text": f"Irasshaimase ! Bienvenue chez Sakana-Tei 魚亭. Votre table {table_label} en cyprès Hinoki vous attend.", "offsetSec": 3},
                {"speakerName": guest_display, "speakerRole": "Customer", "speakerAgentId": customer_agent_id, "text": "Arigatō, nous avons hâte de découvrir la sélection du Maître Itamae.", "offsetSec": 6},
            ]

    # =========================================================================
    # 2. PARTY_SEATED
    # =========================================================================
    elif interaction_type == "PARTY_SEATED":
        if style == "french_bistrot":
            summary_bubble = f"« Voici la table {table_label} et notre ardoise du marché, bonne installation ! »"
            turns = [
                {"speakerName": waiter_name, "speakerRole": "Waiter", "speakerAgentId": waiter_agent_id, "text": f"Je vous en prie, installez-vous à la table {table_label}. Voici la carte et l'ardoise du jour avec notre {venue['defaultDailySpecial']}.", "offsetSec": 0},
                {"speakerName": guest_display, "speakerRole": "Customer", "speakerAgentId": customer_agent_id, "text": "Merci ! Nous allons regarder la carte des vins et les spécialités niçoises.", "offsetSec": 4},
            ]
        elif style == "italian_osteria":
            summary_bubble = f"« Accomodatevi al Tavolo {table_label} — voici la carte des pâtes fraîches et de la braise ! »"
            turns = [
                {"speakerName": waiter_name, "speakerRole": "Waiter", "speakerAgentId": waiter_agent_id, "text": f"Prego, voici le Tavolo {table_label}. Aujourd'hui Giulia a façonné les tagliatelle aux 32 jaunes d'œufs et la truffe noire de Norcia vient d'arriver.", "offsetSec": 0},
                {"speakerName": guest_display, "speakerRole": "Customer", "speakerAgentId": customer_agent_id, "text": "Magnifique, laissez-nous deux minutes pour choisir nos antipasti et le vin.", "offsetSec": 4},
            ]
        else:
            summary_bubble = f"« Table {table_label} installée — voici les oshibori chauds et la carte Omakase. »"
            turns = [
                {"speakerName": waiter_name, "speakerRole": "Waiter", "speakerAgentId": waiter_agent_id, "text": f"Voici votre table {table_label} et vos serviettes oshibori chaudes. L'arrivage de thon rouge Hon-Maguro et de Wagyu Miyazaki A5 est exceptionnel.", "offsetSec": 0},
                {"speakerName": guest_display, "speakerRole": "Customer", "speakerAgentId": customer_agent_id, "text": "Parfait, merci pour votre accueil.", "offsetSec": 4},
            ]

    # =========================================================================
    # 3. ORDER_CREATED
    # =========================================================================
    elif interaction_type == "ORDER_CREATED":
        joined_items = ", ".join(item_names[:3]) if item_names else f"{starter_name}, {main_name}"
        if style == "french_bistrot":
            summary_bubble = f"« Commande prise table {table_label} : {joined_items} & {drink_name}. »"
            turns = [
                {"speakerName": waiter_name, "speakerRole": "Waiter", "speakerAgentId": waiter_agent_id, "text": f"Puis-je prendre votre commande pour la table {table_label} ?", "offsetSec": 0},
                {"speakerName": guest_display, "speakerRole": "Customer", "speakerAgentId": customer_agent_id, "text": f"Oui ! Nous allons partager {starter_name} en entrée, puis {main_name}, et côté cave {drink_name}.", "offsetSec": 3},
                {"speakerName": waiter_name, "speakerRole": "Waiter", "speakerAgentId": waiter_agent_id, "text": f"C'est bien noté pour {party_size} couverts ! Je lance l'annonce en cuisine et au comptoir immédiatement.", "offsetSec": 7},
            ]
        elif style == "italian_osteria":
            summary_bubble = f"« Ordine Tavolo {table_label} : {joined_items} & {drink_name}. »"
            turns = [
                {"speakerName": waiter_name, "speakerRole": "Waiter", "speakerAgentId": waiter_agent_id, "text": f"Siete pronti per ordinare al Tavolo {table_label} ?", "offsetSec": 0},
                {"speakerName": guest_display, "speakerRole": "Customer", "speakerAgentId": customer_agent_id, "text": f"Avec plaisir : en antipasto {starter_name}, suivi de {main_name}, accompagnés de {drink_name}.", "offsetSec": 3},
                {"speakerName": waiter_name, "speakerRole": "Waiter", "speakerAgentId": waiter_agent_id, "text": "Scelta eccellente ! J'envoie la commande à Chef Marco et à l'Enoteca.", "offsetSec": 7},
            ]
        else:
            summary_bubble = f"« Commande Table {table_label} : {joined_items} & {drink_name}. »"
            turns = [
                {"speakerName": waiter_name, "speakerRole": "Waiter", "speakerAgentId": waiter_agent_id, "text": f"Souhaitez-vous lancer votre dégustation pour la table {table_label} ?", "offsetSec": 0},
                {"speakerName": guest_display, "speakerRole": "Customer", "speakerAgentId": customer_agent_id, "text": f"Oui, nous commencerons par {starter_name}, puis {main_name}, avec {drink_name}.", "offsetSec": 3},
                {"speakerName": waiter_name, "speakerRole": "Waiter", "speakerAgentId": waiter_agent_id, "text": "Kashikomarimashita ! Je transmets immédiatement au comptoir Hinoki et au grill Binchotan.", "offsetSec": 7},
            ]

    # =========================================================================
    # 4. ORDER_LINES_SENT_TO_STATION
    # =========================================================================
    elif interaction_type == "ORDER_LINES_SENT_TO_STATION":
        course_num = int(ctx.get("course") or 1)
        items_str = ", ".join(item_names) if item_names else dish_name
        if style == "french_bistrot":
            summary_bubble = f"« Annonce cuisine ! Table {table_label} (Suite {course_num}) : {items_str} — Marche ! »"
            turns = [
                {"speakerName": waiter_name, "speakerRole": "Waiter", "speakerAgentId": waiter_agent_id, "text": f"Annonce pour la table {table_label}, suite {course_num} : {items_str} ! Marche directe !", "offsetSec": 0},
                {"speakerName": chef_name, "speakerRole": "Chef", "speakerAgentId": chef_agent_id, "text": f"Oui Chef ! Reçu table {table_label} pour {items_str}, je vais chercher mes produits en chambre froide !", "offsetSec": 2},
            ]
        elif style == "italian_osteria":
            summary_bubble = f"« Ordine in cucina ! Tavolo {table_label} : {items_str} — Via ! »"
            turns = [
                {"speakerName": waiter_name, "speakerRole": "Waiter", "speakerAgentId": waiter_agent_id, "text": f"Ordine ! Tavolo {table_label} (Portata {course_num}) : {items_str} !", "offsetSec": 0},
                {"speakerName": chef_name, "speakerRole": "Chef", "speakerAgentId": chef_agent_id, "text": f"Sì, ricevuto per il Tavolo {table_label} ! Je prélève les produits frais en cella frigorifera.", "offsetSec": 2},
            ]
        else:
            summary_bubble = f"« Omakase start ! Table {table_label} : {items_str} — Hai, Yorokonde ! »"
            turns = [
                {"speakerName": waiter_name, "speakerRole": "Waiter", "speakerAgentId": waiter_agent_id, "text": f"Chūmon onegaishimasu ! Table {table_label} : {items_str} !", "offsetSec": 0},
                {"speakerName": chef_name, "speakerRole": "Chef", "speakerAgentId": chef_agent_id, "text": f"Hai, yorokonde ! Je prépare {items_str} pour la table {table_label}.", "offsetSec": 2},
            ]

    # =========================================================================
    # 5. INGREDIENT_UNIT_TAKEN
    # =========================================================================
    elif interaction_type == "INGREDIENT_UNIT_TAKEN":
        q_before_s = _fmt_qty(qty_before, unit_measure)
        q_used_s = _fmt_qty(qty_used, unit_measure)
        q_after_s = _fmt_qty(qty_after, unit_measure)
        summary_bubble = (
            f"« Prise {ing_name} #{unit_short} ({q_before_s}) sur {shelf_label} : "
            f"-{q_used_s} pour {dish_name} ({q_after_s} restant). »"
        )
        turns = [
            {
                "speakerName": chef_name,
                "speakerRole": "Chef",
                "speakerAgentId": chef_agent_id,
                "text": (
                    f"Je prends l'unité physique {ing_name} #{unit_short} ({q_before_s}, Niveau {shelf_tier}, emplacement #{slot_index + 1}) "
                    f"sur {shelf_label} : je taille {q_used_s} pour {dish_name} (Table {table_label}), il restera {q_after_s}."
                ),
                "offsetSec": 0,
            }
        ]

    # =========================================================================
    # 6. INGREDIENT_CONTENTION_DEFERRED
    # =========================================================================
    elif interaction_type == "INGREDIENT_CONTENTION_DEFERRED":
        summary_bubble = (
            f"« {ing_name} #{unit_short} est déjà pris par {contended_cook_name} — "
            f"je prends d'abord mes autres ingrédients ({other_ings_str}) et je réessaie ! »"
        )
        turns = [
            {
                "speakerName": chef_name,
                "speakerRole": "Chef",
                "speakerAgentId": chef_agent_id,
                "text": (
                    f"Ah ! L'unique unité active de {ing_name} (#{unit_short}) sur {shelf_label} est actuellement entre les mains "
                    f"de {contended_cook_name} à son poste !"
                ),
                "offsetSec": 0,
            },
            {
                "speakerName": contended_cook_name,
                "speakerRole": "Chef",
                "speakerAgentId": contended_cook_agent_id,
                "text": (
                    f"Je termine ma découpe sur {ing_name} #{unit_short} dans quelques secondes et je le repose immédiatement à son emplacement !"
                ),
                "offsetSec": 2,
            },
            {
                "speakerName": chef_name,
                "speakerRole": "Chef",
                "speakerAgentId": chef_agent_id,
                "text": (
                    f"Parfait, pas de temps perdu : je rassemble d'abord mes autres ingrédients ({other_ings_str}) pour {dish_name} et je reviens vérifier l'étagère !"
                ),
                "offsetSec": 4,
            },
        ]

    # =========================================================================
    # 7. INGREDIENT_CONTENTION_RETRY
    # =========================================================================
    elif interaction_type == "INGREDIENT_CONTENTION_RETRY":
        summary_bubble = (
            f"« Autres ingrédients rassemblés pour {dish_name} — "
            f"je revérifie l'emplacement de {ing_name} #{unit_short} sur {shelf_label}. »"
        )
        turns = [
            {
                "speakerName": chef_name,
                "speakerRole": "Chef",
                "speakerAgentId": chef_agent_id,
                "text": (
                    f"J'ai réuni {other_ings_str} à mon poste pour {dish_name} (Table {table_label}). "
                    f"Je retourne devant {shelf_label} vérifier si {ing_name} #{unit_short} est revenu à l'emplacement #{slot_index + 1}."
                ),
                "offsetSec": 0,
            }
        ]

    # =========================================================================
    # 8. INGREDIENT_WAIT_FOR_UNIT
    # =========================================================================
    elif interaction_type == "INGREDIENT_WAIT_FOR_UNIT":
        q_before_s = _fmt_qty(qty_before, unit_measure)
        q_used_s = _fmt_qty(qty_used, unit_measure)
        q_after_s = _fmt_qty(qty_after, unit_measure)
        summary_bubble = (
            f"« Attente {wait_sec}s devant l'étagère que {contended_cook_name} repose {ing_name} #{unit_short} "
            f"({q_before_s} → {q_after_s}). »"
        )
        turns = [
            {
                "speakerName": chef_name,
                "speakerRole": "Chef",
                "speakerAgentId": chef_agent_id,
                "text": (
                    f"{contended_cook_name} termine tout juste avec {ing_name} #{unit_short}. "
                    f"Je patiente {wait_sec}s devant {shelf_label} jusqu'à son retour."
                ),
                "offsetSec": 0,
            },
            {
                "speakerName": contended_cook_name,
                "speakerRole": "Chef",
                "speakerAgentId": contended_cook_agent_id,
                "text": (
                    f"Voilà, je repose {ing_name} #{unit_short} avec {q_before_s} restants sur le Niveau {shelf_tier}, il est tout à toi {chef_name} !"
                ),
                "offsetSec": max(1, wait_sec - 1),
            },
            {
                "speakerName": chef_name,
                "speakerRole": "Chef",
                "speakerAgentId": chef_agent_id,
                "text": (
                    f"Merci ! Je prends {ing_name} #{unit_short} ({q_before_s}) et je prélève {q_used_s} pour {dish_name} ({q_before_s} → {q_after_s})."
                ),
                "offsetSec": wait_sec,
            },
        ]

    # =========================================================================
    # 9. INGREDIENT_UNIT_RETURNED
    # =========================================================================
    elif interaction_type == "INGREDIENT_UNIT_RETURNED":
        q_after_s = _fmt_qty(qty_after, unit_measure)
        summary_bubble = (
            f"« Retour {ing_name} #{unit_short} ({q_after_s} restant) sur {shelf_label} "
            f"(Niveau {shelf_tier}, slot #{slot_index + 1}). »"
        )
        turns = [
            {
                "speakerName": chef_name,
                "speakerRole": "Chef",
                "speakerAgentId": chef_agent_id,
                "text": (
                    f"Découpe terminée pour {dish_name} : je replace {ing_name} #{unit_short} ({q_after_s} restants) "
                    f"exactement à son emplacement trié #{slot_index + 1} sur {shelf_label} (Niveau {shelf_tier})."
                ),
                "offsetSec": 0,
            }
        ]

    # =========================================================================
    # 10. BAR_BOTTLE_TAKEN
    # =========================================================================
    elif interaction_type == "BAR_BOTTLE_TAKEN":
        b_before_s = _fmt_qty(bottle_before_ml, "ml")
        summary_bubble = (
            f"« [1 bouteille à la fois #{bottle_idx}/{total_bottles}] Prise {bottle_name} ({b_before_s}) "
            f"sur {bar_shelf_label}. »"
        )
        turns = [
            {
                "speakerName": barman_name,
                "speakerRole": "Barman",
                "speakerAgentId": barman_agent_id,
                "text": (
                    f"Service bar pour {drink_name} (Table {table_label}) — bouteille {bottle_idx}/{total_bottles} : "
                    f"je prends uniquement la bouteille {bottle_name} ({b_before_s}) à l'emplacement #{slot_index + 1} (Niveau {shelf_tier})."
                ),
                "offsetSec": 0,
            }
        ]

    # =========================================================================
    # 11. BAR_DRINK_POURED
    # =========================================================================
    elif interaction_type == "BAR_DRINK_POURED":
        pour_s = _fmt_qty(pour_ml, "ml")
        b_before_s = _fmt_qty(bottle_before_ml, "ml")
        b_after_s = _fmt_qty(bottle_after_ml, "ml")
        summary_bubble = (
            f"« Versement précis de {pour_s} de {bottle_name} pour {drink_name} "
            f"({b_before_s} → {b_after_s}). »"
        )
        turns = [
            {
                "speakerName": barman_name,
                "speakerRole": "Barman",
                "speakerAgentId": barman_agent_id,
                "text": (
                    f"Je verse exactement {pour_s} de {bottle_name} au doseur pour {drink_name} (Table {table_label}) — "
                    f"volume restant dans la bouteille : {b_after_s}."
                ),
                "offsetSec": 0,
            }
        ]

    # =========================================================================
    # 12. BAR_BOTTLE_RETURNED
    # =========================================================================
    elif interaction_type == "BAR_BOTTLE_RETURNED":
        b_after_s = _fmt_qty(bottle_after_ml, "ml")
        next_note = (
            "avant de saisir la bouteille suivante."
            if bottle_idx < total_bottles
            else "service bouteille terminé."
        )
        summary_bubble = (
            f"« Retour {bottle_name} ({b_after_s}) à son emplacement #{slot_index + 1} sur l'étagère bar "
            f"({bottle_idx}/{total_bottles}). »"
        )
        turns = [
            {
                "speakerName": barman_name,
                "speakerRole": "Barman",
                "speakerAgentId": barman_agent_id,
                "text": (
                    f"Je repose la bouteille {bottle_name} ({b_after_s} restant) à son emplacement exact #{slot_index + 1} "
                    f"(Niveau {shelf_tier}) sur {bar_shelf_label}, {next_note}"
                ),
                "offsetSec": 0,
            }
        ]

    # =========================================================================
    # 13. ITEM_PREP_STARTED
    # =========================================================================
    elif interaction_type == "ITEM_PREP_STARTED":
        workstation_label = str(ctx.get("workstationLabel") or ctx.get("stationLabel") or "poste de cuisson")
        if style == "french_bistrot":
            summary_bubble = f"« Mise en cuisson de {dish_name} (Table {table_label}) par {chef_name} ! »"
            turns = [
                {"speakerName": chef_name, "speakerRole": "Chef", "speakerAgentId": chef_agent_id, "text": f"Tous les ingrédients pesés sont sur ma planche : je lance la préparation de {dish_name} pour la table {table_label} ({workstation_label}) !", "offsetSec": 0},
            ]
        elif style == "italian_osteria":
            summary_bubble = f"« In cottura : {dish_name} (Tavolo {table_label}) avec {chef_name} ! »"
            turns = [
                {"speakerName": chef_name, "speakerRole": "Chef", "speakerAgentId": chef_agent_id, "text": f"Mise en place complète : je lance la cuisson minute de {dish_name} pour le Tavolo {table_label} !", "offsetSec": 0},
            ]
        else:
            summary_bubble = f"« Préparation Omakase / Binchotan : {dish_name} (Table {table_label}) ! »"
            turns = [
                {"speakerName": chef_name, "speakerRole": "Chef", "speakerAgentId": chef_agent_id, "text": f"Tous les produits sont découpés : je façonne {dish_name} pour la table {table_label}.", "offsetSec": 0},
            ]

    # =========================================================================
    # 14. ITEM_READY_AT_PASS
    # =========================================================================
    elif interaction_type == "ITEM_READY_AT_PASS":
        if style == "french_bistrot":
            summary_bubble = f"« Service chaud au passe ! {dish_name} prêt pour la table {table_label} ! »"
            turns = [
                {"speakerName": chef_name, "speakerRole": "Chef", "speakerAgentId": chef_agent_id, "text": f"Service chaud au passe ! {dish_name} dressé sous la rampe cuivre pour la table {table_label}, {waiter_name} !", "offsetSec": 0},
                {"speakerName": waiter_name, "speakerRole": "Waiter", "speakerAgentId": waiter_agent_id, "text": f"Oui Chef, j'enlève au passe tout de suite pour la table {table_label} !", "offsetSec": 2},
            ]
        elif style == "italian_osteria":
            summary_bubble = f"« Pronto al pass ! {dish_name} per il Tavolo {table_label} ! »"
            turns = [
                {"speakerName": chef_name, "speakerRole": "Chef", "speakerAgentId": chef_agent_id, "text": f"Pronto al pass sotto le lampade ! {dish_name} per il Tavolo {table_label}, {waiter_name} !", "offsetSec": 0},
                {"speakerName": waiter_name, "speakerRole": "Waiter", "speakerAgentId": waiter_agent_id, "text": f"Subito Chef, j'arrive au pass de marbre !", "offsetSec": 2},
            ]
        else:
            summary_bubble = f"« Passe Hinoki prêt : {dish_name} pour la table {table_label} ! »"
            turns = [
                {"speakerName": chef_name, "speakerRole": "Chef", "speakerAgentId": chef_agent_id, "text": f"Omatase itashimashita ! {dish_name} est dressé au passe Hinoki pour la table {table_label} !", "offsetSec": 0},
                {"speakerName": waiter_name, "speakerRole": "Waiter", "speakerAgentId": waiter_agent_id, "text": f"Hai ! Je prends le plateau immédiatement pour la table {table_label}.", "offsetSec": 2},
            ]

    # =========================================================================
    # 15. ORDER_PICKED_UP_FROM_PASS
    # =========================================================================
    elif interaction_type == "ORDER_PICKED_UP_FROM_PASS":
        summary_bubble = f"« Enlèvement au passe par {waiter_name} : {dish_name} direction table {table_label}. »"
        turns = [
            {"speakerName": waiter_name, "speakerRole": "Waiter", "speakerAgentId": waiter_agent_id, "text": f"Dressage impeccable Chef {chef_name}, j'emporte {dish_name} vers la table {table_label}.", "offsetSec": 0},
            {"speakerName": chef_name, "speakerRole": "Chef", "speakerAgentId": chef_agent_id, "text": "Bon service en salle !", "offsetSec": 2},
        ]

    # =========================================================================
    # 16. ORDER_DELIVERED_TO_TABLE
    # =========================================================================
    elif interaction_type == "ORDER_DELIVERED_TO_TABLE":
        items_str = ", ".join(item_names) if item_names else dish_name
        if style == "french_bistrot":
            summary_bubble = f"« Voici votre {items_str} — très bon appétit à la table {table_label} ! »"
            turns = [
                {"speakerName": waiter_name, "speakerRole": "Waiter", "speakerAgentId": waiter_agent_id, "text": f"Et voici pour vous à la table {table_label} : {items_str}. Je vous souhaite un excellent appétit !", "offsetSec": 0},
                {"speakerName": guest_display, "speakerRole": "Customer", "speakerAgentId": customer_agent_id, "text": "Merci beaucoup, le dressage et les arômes sont magnifiques !", "offsetSec": 3},
            ]
        elif style == "italian_osteria":
            summary_bubble = f"« Ecco a voi {items_str} al Tavolo {table_label} — Buon appetito ! »"
            turns = [
                {"speakerName": waiter_name, "speakerRole": "Waiter", "speakerAgentId": waiter_agent_id, "text": f"Ecco a voi al Tavolo {table_label} : {items_str}. Buon appetito !", "offsetSec": 0},
                {"speakerName": guest_display, "speakerRole": "Customer", "speakerAgentId": customer_agent_id, "text": "Che meraviglia, grazie mille !", "offsetSec": 3},
            ]
        else:
            summary_bubble = f"« Dōzo meshiagare ! {items_str} servi à la table {table_label}. »"
            turns = [
                {"speakerName": waiter_name, "speakerRole": "Waiter", "speakerAgentId": waiter_agent_id, "text": f"Voici votre {items_str} fraîchement dressé pour la table {table_label}. Dōzo meshiagare !", "offsetSec": 0},
                {"speakerName": guest_display, "speakerRole": "Customer", "speakerAgentId": customer_agent_id, "text": "Itadakimasu ! C'est un véritable chef-d'œuvre.", "offsetSec": 3},
            ]

    # =========================================================================
    # 17. PAYMENT_COMPLETED
    # =========================================================================
    elif interaction_type == "PAYMENT_COMPLETED":
        if style == "french_bistrot":
            summary_bubble = f"« Règlement table {table_label} ({paid_eur}, pourboire {tip_eur}) — Merci pour ce moment ! »"
            turns = [
                {"speakerName": guest_display, "speakerRole": "Customer", "speakerAgentId": customer_agent_id, "text": f"Tout était délicieux du début à la fin. Voici le règlement par carte ({paid_eur} avec {tip_eur} pour l'équipe).", "offsetSec": 0},
                {"speakerName": waiter_name, "speakerRole": "Waiter", "speakerAgentId": waiter_agent_id, "text": f"Merci infiniment {guest_display} ! Toute la brigade du Bistrot Lumière vous remercie.", "offsetSec": 3},
            ]
        elif style == "italian_osteria":
            summary_bubble = f"« Conto saldato Tavolo {table_label} ({paid_eur}, mancia {tip_eur}) — Grazie mille ! »"
            turns = [
                {"speakerName": guest_display, "speakerRole": "Customer", "speakerAgentId": customer_agent_id, "text": f"Un vrai voyage en Toscane ! Voici le règlement de {paid_eur} (dont {tip_eur} de pourboire).", "offsetSec": 0},
                {"speakerName": waiter_name, "speakerRole": "Waiter", "speakerAgentId": waiter_agent_id, "text": f"Grazie di cuore {guest_display}, c'était un plaisir de vous recevoir !", "offsetSec": 3},
            ]
        else:
            summary_bubble = f"« Addition réglée Table {table_label} ({paid_eur}, pourboire {tip_eur}) — Arigatō gozaimasu ! »"
            turns = [
                {"speakerName": guest_display, "speakerRole": "Customer", "speakerAgentId": customer_agent_id, "text": f"Une expérience Omakase inoubliable. Voici notre règlement de {paid_eur} (avec {tip_eur} pour la brigade).", "offsetSec": 0},
                {"speakerName": waiter_name, "speakerRole": "Waiter", "speakerAgentId": waiter_agent_id, "text": f"Arigatō gozaimasu {guest_display} ! Maître Kenji et toute l'équipe vous remercient.", "offsetSec": 3},
            ]

    # =========================================================================
    # 18. CUSTOMER_DEPARTED
    # =========================================================================
    elif interaction_type == "CUSTOMER_DEPARTED":
        if style == "french_bistrot":
            summary_bubble = f"« Au revoir et belle promenade sur la Rue de la Lumière, {guest_display} ! »"
            turns = [
                {"speakerName": host_name, "speakerRole": "Host", "speakerAgentId": host_agent_id, "text": f"Merci de votre visite {guest_display}, très belle soirée sur la Rue de la Lumière et à bientôt !", "offsetSec": 0},
                {"speakerName": guest_display, "speakerRole": "Customer", "speakerAgentId": customer_agent_id, "text": "Bonsoir à toute l'équipe, nous reviendrons très vite !", "offsetSec": 2},
            ]
        elif style == "italian_osteria":
            summary_bubble = f"« Arrivederci e buona serata sulla Rue de la Lumière, {guest_display} ! »"
            turns = [
                {"speakerName": host_name, "speakerRole": "Host", "speakerAgentId": host_agent_id, "text": f"Arrivederci {guest_display} ! Buona passeggiata a Nizza e a presto !", "offsetSec": 0},
                {"speakerName": guest_display, "speakerRole": "Customer", "speakerAgentId": customer_agent_id, "text": "Buona serata a tutti, grazie ancora !", "offsetSec": 2},
            ]
        else:
            summary_bubble = f"« Mata okoshi kudasai — À très bientôt chez Sakana-Tei, {guest_display} ! »"
            turns = [
                {"speakerName": host_name, "speakerRole": "Host", "speakerAgentId": host_agent_id, "text": f"Arigatō gozaimashita {guest_display} ! Mata okoshi kudasai !", "offsetSec": 0},
                {"speakerName": guest_display, "speakerRole": "Customer", "speakerAgentId": customer_agent_id, "text": "Merci et très belle fin de soirée !", "offsetSec": 2},
            ]

    # =========================================================================
    # Fallback for any auxiliary event types (e.g. TABLE_CLEARED, etc.)
    # =========================================================================
    else:
        summary_bubble = f"« [{venue['name']}] {interaction_type} — Table {table_label} ({dish_name}). »"
        turns = [
            {
                "speakerName": waiter_name,
                "speakerRole": "Waiter",
                "speakerAgentId": waiter_agent_id,
                "text": f"Opération {interaction_type} effectuée pour la table {table_label}.",
                "offsetSec": 0,
            }
        ]

    # Construct deterministic dialogueId
    hash_input = f"{business_id}:{interaction_type}:{order_id}:{unit_id}:{dish_name}:{table_label}:{summary_bubble}"
    dlg_hash = hashlib.sha256(hash_input.encode("utf-8")).hexdigest()[:10]
    dialogue_id = f"dlg-{business_id.split('-')[-1][:4]}-{interaction_type.lower().replace('_', '-')[:18]}-{dlg_hash}"

    return {
        "dialogueId": dialogue_id,
        "businessId": business_id,
        "interactionType": interaction_type,
        "summaryBubble": summary_bubble,
        "turns": turns,
    }


class DialogueSimulator:
    """
    Object-oriented wrapper around `generate_interaction_dialogue` with deterministic
    seed control and multi-venue hospitality vocabulary.
    """

    def __init__(self, seed: Optional[Union[int, str]] = 42):
        self.base_seed = seed

    def generate_interaction_dialogue(
        self,
        business_id: str,
        interaction_type: str,
        context: Optional[Dict[str, Any]] = None,
        rng: Optional[Union[random.Random, int, str]] = None,
    ) -> Dict[str, Any]:
        return generate_interaction_dialogue(
            business_id=business_id,
            interaction_type=interaction_type,
            context=context,
            rng=rng,
        )

    def generate(
        self,
        business_id: str,
        interaction_type: str,
        context: Optional[Dict[str, Any]] = None,
        rng: Optional[Union[random.Random, int, str]] = None,
    ) -> Dict[str, Any]:
        return self.generate_interaction_dialogue(
            business_id=business_id,
            interaction_type=interaction_type,
            context=context,
            rng=rng,
        )


build_event_dialogue = generate_interaction_dialogue

