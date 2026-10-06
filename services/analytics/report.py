from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from services.fieldwork import COLLECTION_SCHEDULE, assigned_vehicle
from services.operations import SERVICE_ZONES, collected_kg, vehicle_is_operating

ZONE_CENTERS = {
    "Centro": (8.7526, -75.8812),
    "Norte": (8.7784, -75.8608),
    "Sur": (8.7242, -75.8874),
    "Este": (8.7504, -75.8518),
    "Oeste": (8.7416, -75.9068),
}
WEEKDAYS = ("lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo")


def _moment(now) -> datetime:
    if now is None:
        return datetime.now(ZoneInfo("America/Bogota"))
    if now.tzinfo is None:
        return now.replace(tzinfo=ZoneInfo("America/Bogota"))
    return now.astimezone(ZoneInfo("America/Bogota"))


def _kilos(text: str | None) -> int:
    raw = text or ""
    index = raw.find(" kg")
    if index < 0:
        return 0
    digits = ""
    cursor = index - 1
    while cursor >= 0 and raw[cursor].isdigit():
        digits = raw[cursor] + digits
        cursor -= 1
    return int(digits) if digits else 0


def zone_name(record: dict) -> str | None:
    raw = str(record.get("zone") or record.get("area") or "")
    for zone in SERVICE_ZONES:
        if zone.lower() in raw.lower():
            return zone
    latitude = record.get("latitude")
    longitude = record.get("longitude")
    if latitude is None or longitude is None:
        return None
    nearest = min(
        ZONE_CENTERS,
        key=lambda zone: (ZONE_CENTERS[zone][0] - float(latitude)) ** 2 + (ZONE_CENTERS[zone][1] - float(longitude)) ** 2,
    )
    return nearest


def collects_on(days: str, moment: datetime) -> bool:
    return WEEKDAYS[moment.weekday()] in days.lower()


def municipal_report(containers, routes=None, vehicles=None, incidents=None, citizens=None, alerts=None, now=None) -> dict:
    moment = _moment(now)
    today = moment.date().isoformat()
    containers = list(containers or [])
    routes = list(routes or [])
    vehicles = list(vehicles or [])
    incidents = list(incidents or [])
    citizens = list(citizens or [])
    alerts = list(alerts or [])

    collections = []
    for alert in alerts:
        title = alert.get("title") or ""
        if "Recolección confirmada" not in title or not str(alert.get("created_at") or "").startswith(today):
            continue
        collections.append(_kilos(alert.get("description")))

    open_requests = [item for item in incidents if item.get("status") in {"reported", "assigned"}]
    resolved = [item for item in incidents if item.get("status") == "resolved"]
    en_camino = [item for item in open_requests if item.get("status") == "assigned" and assigned_vehicle(item.get("description"))]
    operating = [item for item in vehicles if vehicle_is_operating(item.get("state"))]
    ready_to_redeem = [item for item in citizens if int(item.get("points") or 0) >= 40]
    schedule = {item["zone"]: item for item in COLLECTION_SCHEDULE}

    zones = []
    for zone in SERVICE_ZONES:
        bins = [item for item in containers if zone_name(item) == zone]
        zone_requests = [item for item in open_requests if zone_name(item) == zone]
        fills = [int(item.get("fill_level") or 0) for item in bins]
        plan = schedule[zone]
        zones.append({
            "zone": zone,
            "containers": len(bins),
            "avg_fill": round(sum(fills) / len(fills)) if fills else 0,
            "pending_kg": sum(collected_kg(level) for level in fills if level >= 75),
            "critical": sum(1 for level in fills if level >= 90),
            "open_requests": len(zone_requests),
            "collects_today": collects_on(plan["days"], moment),
            "schedule": f"{plan['days']} · {plan['hours']}",
        })

    week = []
    for offset in range(6, -1, -1):
        day = (moment.date() - timedelta(days=offset)).isoformat()
        week.append({
            "date": day[5:],
            "requests": sum(1 for item in incidents if str(item.get("created_at") or "").startswith(day)),
            "kg": sum(_kilos(item.get("description")) for item in alerts if "Recolección confirmada" in (item.get("title") or "") and str(item.get("created_at") or "").startswith(day)),
        })

    decisions = []
    for zone in zones:
        if zone["critical"] and not zone["collects_today"]:
            decisions.append({
                "tone": "critical",
                "title": f"Adelantar la ruta de {zone['zone']}",
                "detail": f"{zone['critical']} contenedor(es) crítico(s) y {zone['pending_kg']} kg pendientes. Hoy no es día de recolección ({zone['schedule']}).",
            })
        elif zone["critical"] and zone["collects_today"]:
            decisions.append({
                "tone": "attention",
                "title": f"{zone['zone']} se recoge hoy",
                "detail": f"Hay {zone['critical']} contenedor(es) crítico(s). La franja de hoy es {zone['schedule']}.",
            })
        elif zone["containers"] == 0:
            decisions.append({
                "tone": "attention",
                "title": f"{zone['zone']} no tiene contenedores",
                "detail": "No se puede medir el llenado de esa zona hasta registrar al menos un punto.",
            })
    if open_requests and not operating:
        decisions.append({
            "tone": "critical",
            "title": "Solicitudes sin vehículo en ruta",
            "detail": f"Hay {len(open_requests)} solicitudes abiertas y ningún vehículo operativo.",
        })
    elif open_requests and len(en_camino) < len(open_requests):
        decisions.append({
            "tone": "attention",
            "title": "Faltan solicitudes por asignar",
            "detail": f"{len(open_requests) - len(en_camino)} de {len(open_requests)} todavía no dicen “en camino”.",
        })
    if ready_to_redeem:
        decisions.append({
            "tone": "ok",
            "title": "Hay premios listos para entregar",
            "detail": f"{len(ready_to_redeem)} ciudadano(s) ya tienen al menos 40 puntos, el valor de la bolsa reutilizable.",
        })
    if not decisions:
        decisions.append({
            "tone": "ok",
            "title": "La operación está al día",
            "detail": "No hay contenedores críticos ni solicitudes sin atender.",
        })

    pending_kg = sum(zone["pending_kg"] for zone in zones)
    summary = {
        "containers": len(containers),
        "avg_fill": round(sum(int(item.get("fill_level") or 0) for item in containers) / len(containers)) if containers else 0,
        "pending_kg": pending_kg,
        "critical": sum(zone["critical"] for zone in zones),
        "open_requests": len(open_requests),
        "resolved_requests": len(resolved),
        "response_rate_pct": round(100 * len(resolved) / len(incidents)) if incidents else 100,
        "en_camino": len(en_camino),
        "fleet_operating": len(operating),
        "fleet_total": len(vehicles),
        "citizens": len(citizens),
        "points": sum(int(item.get("points") or 0) for item in citizens),
        "kg_collected_today": sum(collections),
        "containers_emptied_today": len(collections),
        "active_routes": sum(1 for item in routes if item.get("status") == "in_progress"),
    }
    return {
        "city": "Montería",
        "date": today,
        "generated_at": moment.isoformat(),
        "summary": summary,
        "zones": zones,
        "week": week,
        "decisions": decisions[:6],
        "volume": {"containers": summary["containers"], "critical_containers": summary["critical"]},
        "operations": {"routes": len(routes), "active_routes": summary["active_routes"], "vehicles": summary["fleet_total"]},
        "citizen_impact": {"citizens": summary["citizens"], "points": summary["points"], "incidents_resolved": summary["resolved_requests"]},
    }
