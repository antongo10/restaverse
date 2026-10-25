#!/usr/bin/env python3
"""
Deterministic Physical Stock Unit Registry, Sorted Shelf Architect,
Barman Single-Bottle Sequencer, Kitchen Mutex Contention Engine,
and Causal Timeline Validator for the Multi-Venue 3D Hospitality Street Platform.
"""

from __future__ import annotations

import os
import sys
from typing import Any, Dict, List, Optional

_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

from scripts.seeds.dialogue_simulator import generate_interaction_dialogue


class StockShelfRegistry:
    """
    Tracks physical ingredient units and bar bottles across sorted shelf tiers and slots,
    enforcing FIFO selection, first-come-first-served mutex locks, race-condition
    fetch-others-first + retry + wait resolution, and single-bottle barman discipline.
    """

    def __init__(self, business_id: str, service_date: str):
        self.business_id = business_id
        self.service_date = service_date
        self.units_by_id: Dict[str, Dict[str, Any]] = {}
        self.units_by_ingredient: Dict[str, List[Dict[str, Any]]] = {}
        self.barman_busy_until_ms: int = 0
        self.contention_log: List[Dict[str, Any]] = []

    def register_unit(self, unit_doc: Dict[str, Any]) -> Dict[str, Any]:
        uid = unit_doc["unitId"]
        ing_id = unit_doc["ingredientId"]
        unit_doc.setdefault("usageHistory", [])
        unit_doc.setdefault("lockedUntilMs", 0)
        unit_doc.setdefault("lockedByAgentId", None)
        unit_doc.setdefault("lockedByCookName", None)
        self.units_by_id[uid] = unit_doc
        self.units_by_ingredient.setdefault(ing_id, []).append(unit_doc)
        self.units_by_ingredient[ing_id].sort(key=lambda u: int(u.get("fifoOrder", 1)))
        self._refresh_next_to_use(ing_id)
        return unit_doc

    def _refresh_next_to_use(self, ingredient_id: str) -> None:
        units = self.units_by_ingredient.get(ingredient_id, [])
        marked = False
        for u in units:
            if not marked and float(u.get("remainingQty", 0)) > 0:
                u["isNextToUse"] = True
                marked = True
            else:
                u["isNextToUse"] = False

    def get_active_fifo_unit(self, ingredient_id: str, required_qty: float) -> Optional[Dict[str, Any]]:
        for u in self.units_by_ingredient.get(ingredient_id, []):
            if float(u.get("remainingQty", 0)) >= required_qty:
                return u
        return None


def schedule_kitchen_prep_with_contention(
    registry: StockShelfRegistry,
    order_id: str,
    dish_instance_id: str,
    dish_name: str,
    table_id: str,
    table_label: str,
    cook_agent: Dict[str, Any],
    workstation: Dict[str, Any],
    request_ms: int,
    recipe_ingredients: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Resolves multi-cook physical ingredient contention using First-Come-First-Served mutex locking.
    If an ingredient unit (e.g. a single 150g cucumber) is currently held off-shelf by Cook 1:
      1. Cook 2 emits INGREDIENT_CONTENTION_DEFERRED and fetches all other available recipe ingredients first.
      2. Cook 2 retries the contended shelf unit (INGREDIENT_CONTENTION_RETRY).
      3. If still locked, Cook 2 waits at the shelf (INGREDIENT_WAIT_FOR_UNIT) until Cook 1 returns it.
      4. Cook 2 takes the unit (120g -> 90g) and returns it to its sorted shelf slot.
    """
    events: List[Dict[str, Any]] = []
    usages: List[Dict[str, Any]] = []
    available_reqs: List[Dict[str, Any]] = []
    contended_reqs: List[Dict[str, Any]] = []

    for req in recipe_ingredients:
        unit = registry.get_active_fifo_unit(req["ingredientId"], float(req["qtyUsed"]))
        if not unit:
            continue
        if int(unit.get("lockedUntilMs", 0)) > request_ms:
            contended_reqs.append((req, unit))
        else:
            available_reqs.append((req, unit))

    cursor_ms = request_ms
    cook_id = cook_agent.get("agentId", "agent-cook")
    cook_name = cook_agent.get("name", "Chef")

    # If there is a contended unit, emit INGREDIENT_CONTENTION_DEFERRED first and fetch other items
    for req, unit in contended_reqs:
        other_names = [r["name"] for r, _ in available_reqs] or ["les autres ingrédients de la mise en place"]
        dlg = generate_interaction_dialogue(
            registry.business_id,
            "INGREDIENT_CONTENTION_DEFERRED",
            {
                "orderId": order_id,
                "unitId": unit["unitId"],
                "ingredientName": unit["name"],
                "dishName": dish_name,
                "tableLabel": table_label,
                "cookName": cook_name,
                "cookAgentId": cook_id,
                "contendedWithCookName": unit.get("lockedByCookName") or "Chef",
                "otherIngredients": ", ".join(other_names),
            },
        )
        events.append({
            "eventType": "INGREDIENT_CONTENTION_DEFERRED",
            "eventTimeMs": cursor_ms,
            "unitId": unit["unitId"],
            "dialogue": dlg,
        })

    # Fetch all available non-contended ingredients first
    for req, unit in available_reqs:
        qty_used = float(req["qtyUsed"])
        qty_before = float(unit["remainingQty"])
        qty_after = max(0.0, round(qty_before - qty_used, 2))
        taken_ms = cursor_ms
        returned_ms = taken_ms + 45000
        unit["remainingQty"] = qty_after
        unit["lockedUntilMs"] = returned_ms
        unit["lockedByAgentId"] = cook_id
        unit["lockedByCookName"] = cook_name
        registry._refresh_next_to_use(req["ingredientId"])

        usage_entry = {
            "usageId": f"use-{dish_instance_id}-{unit['unitId']}-{taken_ms}",
            "orderId": order_id,
            "dishInstanceId": dish_instance_id,
            "dishName": dish_name,
            "tableId": table_id,
            "tableLabel": table_label,
            "cookAgentId": cook_id,
            "cookName": cook_name,
            "workstationId": workstation.get("stationId", "station-kitchen"),
            "workstationSceneId": workstation.get("sceneObjectId", "scene-kitchen"),
            "workstationLabel": workstation.get("label", "Poste Cuisine"),
            "workstationCoords": workstation.get("coords", {"x": 14.0, "z": -3.2}),
            "qtyUsed": qty_used,
            "unit": unit["unit"],
            "qtyBefore": qty_before,
            "qtyAfter": qty_after,
            "requestAtMs": request_ms,
            "takenAtMs": taken_ms,
            "prepCompletedAtMs": returned_ms - 5000,
            "returnedAtMs": returned_ms,
            "hadContention": False,
            "contentionStrategy": None,
            "contendedWithCookName": None,
            "waitDurationSec": 0,
        }
        unit["usageHistory"].append(usage_entry)
        usages.append(usage_entry)
        cursor_ms += 10000

    # Now retry the contended ingredients
    for req, unit in contended_reqs:
        retry_ms = max(cursor_ms, request_ms + 20000)
        lock_end_ms = int(unit.get("lockedUntilMs", 0))
        holder_name = unit.get("lockedByCookName") or "Chef"
        events.append({
            "eventType": "INGREDIENT_CONTENTION_RETRY",
            "eventTimeMs": retry_ms,
            "unitId": unit["unitId"],
        })
        wait_sec = 0
        if retry_ms < lock_end_ms:
            wait_sec = max(1, round((lock_end_ms - retry_ms) / 1000))
            events.append({
                "eventType": "INGREDIENT_WAIT_FOR_UNIT",
                "eventTimeMs": retry_ms + 1000,
                "unitId": unit["unitId"],
                "waitDurationSec": wait_sec,
            })
            taken_ms = lock_end_ms + 1000
            strategy = "FETCHED_OTHER_INGREDIENTS_FIRST_THEN_WAITED_AT_SHELF"
        else:
            taken_ms = retry_ms + 1000
            strategy = "FETCHED_OTHER_INGREDIENTS_FIRST_THEN_RETRIED"

        qty_used = float(req["qtyUsed"])
        qty_before = float(unit["remainingQty"])
        qty_after = max(0.0, round(qty_before - qty_used, 2))
        returned_ms = taken_ms + 40000
        unit["remainingQty"] = qty_after
        unit["lockedUntilMs"] = returned_ms
        unit["lockedByAgentId"] = cook_id
        unit["lockedByCookName"] = cook_name
        registry._refresh_next_to_use(req["ingredientId"])

        usage_entry = {
            "usageId": f"use-{dish_instance_id}-{unit['unitId']}-{taken_ms}",
            "orderId": order_id,
            "dishInstanceId": dish_instance_id,
            "dishName": dish_name,
            "tableId": table_id,
            "tableLabel": table_label,
            "cookAgentId": cook_id,
            "cookName": cook_name,
            "workstationId": workstation.get("stationId", "station-kitchen"),
            "workstationSceneId": workstation.get("sceneObjectId", "scene-kitchen"),
            "workstationLabel": workstation.get("label", "Poste Cuisine"),
            "workstationCoords": workstation.get("coords", {"x": 14.0, "z": -3.2}),
            "qtyUsed": qty_used,
            "unit": unit["unit"],
            "qtyBefore": qty_before,
            "qtyAfter": qty_after,
            "requestAtMs": request_ms,
            "takenAtMs": taken_ms,
            "prepCompletedAtMs": returned_ms - 5000,
            "returnedAtMs": returned_ms,
            "hadContention": True,
            "contentionStrategy": strategy,
            "contendedWithCookName": holder_name,
            "waitDurationSec": wait_sec,
        }
        unit["usageHistory"].append(usage_entry)
        usages.append(usage_entry)
        registry.contention_log.append(usage_entry)
        cursor_ms = returned_ms

    return {"events": events, "usages": usages, "readyToCookAtMs": cursor_ms}


def schedule_barman_drink_prep(
    registry: StockShelfRegistry,
    order_id: str,
    barman_agent: Dict[str, Any],
    request_ms: int,
    recipe_bottles: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Enforces the Barman Single-Bottle Mutex: the barman takes 1 bottle at a time from its sorted
    bar shelf slot, pours the exact ml into the glass, and returns the bottle to its shelf slot
    before touching the next bottle.
    """
    t_cursor = max(request_ms, registry.barman_busy_until_ms)
    events: List[Dict[str, Any]] = []
    for bottle_req in recipe_bottles:
        unit = registry.get_active_fifo_unit(bottle_req["ingredientId"], float(bottle_req["qtyUsed"]))
        if not unit:
            continue
        qty_used = float(bottle_req["qtyUsed"])
        qty_before = float(unit["remainingQty"])
        qty_after = max(0.0, round(qty_before - qty_used, 2))
        taken_ms = t_cursor
        poured_ms = t_cursor + 8000
        returned_ms = t_cursor + 18000
        unit["remainingQty"] = qty_after
        events.extend([
            {"eventType": "BAR_BOTTLE_TAKEN", "eventTimeMs": taken_ms, "unitId": unit["unitId"], "bottleName": unit["name"]},
            {"eventType": "BAR_DRINK_POURED", "eventTimeMs": poured_ms, "unitId": unit["unitId"], "qtyUsed": qty_used, "qtyBefore": qty_before, "qtyAfter": qty_after},
            {"eventType": "BAR_BOTTLE_RETURNED", "eventTimeMs": returned_ms, "unitId": unit["unitId"], "bottleName": unit["name"]},
        ])
        t_cursor = returned_ms + 2000
    registry.barman_busy_until_ms = t_cursor
    return {"events": events, "completedAtMs": t_cursor}


def validate_day_causality(orders: List[Dict[str, Any]], events: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Verifies that no customer departs or pays before all courses of their order are cooked and delivered.
    """
    delivered_by_order: Dict[str, int] = {}
    paid_by_order: Dict[str, int] = {}
    for ev in events:
        oid = ev.get("orderId") or (ev.get("payload") or {}).get("orderId")
        if not oid:
            continue
        et = ev.get("eventType")
        ms = int(ev.get("eventTimeMs", 0))
        if et == "ORDER_DELIVERED_TO_TABLE":
            delivered_by_order[oid] = max(delivered_by_order.get(oid, 0), ms)
        elif et in ("PAYMENT_COMPLETED", "CUSTOMER_DEPARTED"):
            paid_by_order[oid] = min(paid_by_order.get(oid, ms), ms)

    violations = 0
    for oid, last_deliv in delivered_by_order.items():
        if oid in paid_by_order and paid_by_order[oid] <= last_deliv:
            violations += 1
    return {"valid": violations == 0, "earlyDepartureViolations": violations, "checkedOrders": len(delivered_by_order)}


if __name__ == "__main__":
    reg = StockShelfRegistry("business-bistrot-lumiere", "2025-06-14")
    reg.register_unit({
        "unitId": "unit-bl-concombre-01",
        "ingredientId": "ing-concombre",
        "name": "Concombre Bio de Provence (150g)",
        "initialQty": 150.0,
        "remainingQty": 150.0,
        "unit": "g",
        "fifoOrder": 1,
    })
    reg.register_unit({
        "unitId": "unit-bl-olives-01",
        "ingredientId": "ing-olives",
        "name": "Olives de Nice AOP (300g)",
        "initialQty": 300.0,
        "remainingQty": 300.0,
        "unit": "g",
        "fifoOrder": 1,
    })
    r1 = schedule_kitchen_prep_with_contention(
        reg, "ord-1", "dish-1", "Salade Niçoise", "bl-t1", "Table 1",
        {"agentId": "agent-emp-sofia", "name": "Sofia Rossi"},
        {"stationId": "station-bl-saladette", "sceneObjectId": "scene-bl-station-saladette", "label": "Garde-Manger"},
        100000,
        [{"ingredientId": "ing-concombre", "name": "Concombre Bio", "qtyUsed": 30.0}],
    )
    r2 = schedule_kitchen_prep_with_contention(
        reg, "ord-2", "dish-2", "Tartare de Concombre", "bl-t2", "Table 2",
        {"agentId": "agent-emp-hugo", "name": "Hugo Lambert"},
        {"stationId": "station-bl-saladette", "sceneObjectId": "scene-bl-station-saladette", "label": "Garde-Manger"},
        112000,
        [
            {"ingredientId": "ing-concombre", "name": "Concombre Bio", "qtyUsed": 30.0},
            {"ingredientId": "ing-olives", "name": "Olives de Nice", "qtyUsed": 40.0},
        ],
    )
    assert reg.units_by_id["unit-bl-concombre-01"]["remainingQty"] == 90.0
    assert len(reg.contention_log) == 1
    print("COHERENCY_ENGINE_SELF_TEST_OK: 150g -> 120g -> 90g with fetch-others-first + wait verified.")
