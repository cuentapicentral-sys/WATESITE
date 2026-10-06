"""Reglas operativas que convierten lecturas de sensores en decisiones de recolección."""

KG_PER_FILL_PERCENT = 1.1
URGENT_FILL = 75
CRITICAL_FILL = 90
SERVICE_ZONES = ("Centro", "Norte", "Sur", "Este", "Oeste")
STOPPED_STATES = {"revision", "revisión", "fuera_de_servicio", "fuera de servicio"}


def collected_kg(fill_level) -> int:
    """Estima los kilos de un contenedor de 1.100 L a 0,1 kg por litro."""
    level = max(0, min(100, int(fill_level or 0)))
    return round(level * KG_PER_FILL_PERCENT)


def collection_status(fill_level) -> str:
    level = int(fill_level or 0)
    if level >= CRITICAL_FILL:
        return "critical"
    if level >= URGENT_FILL:
        return "attention"
    return "normal"


def vehicle_is_operating(state) -> bool:
    return str(state or "").strip().lower() not in STOPPED_STATES


def operational_snapshot(containers, routes=None, vehicles=None, incidents=None) -> dict:
    containers = list(containers or [])
    routes = list(routes or [])
    vehicles = list(vehicles or [])
    incidents = list(incidents or [])
    urgent = [item for item in containers if int(item.get("fill_level") or 0) >= URGENT_FILL]
    critical = [
        item
        for item in containers
        if item.get("status") == "critical" or int(item.get("fill_level") or 0) >= CRITICAL_FILL
    ]
    total = len(containers) or 1
    present = {str(item.get("zone") or "").strip().lower() for item in containers}
    covered = sum(1 for zone in SERVICE_ZONES if zone.lower() in present)
    operating = [item for item in vehicles if vehicle_is_operating(item.get("state"))]
    open_incidents = [item for item in incidents if item.get("status") in {"reported", "assigned"}]
    resolved = [item for item in incidents if item.get("status") == "resolved"]
    priority = sorted(urgent, key=lambda item: int(item.get("fill_level") or 0), reverse=True)[:6]
    return {
        "efficiency_pct": round(100 * (len(containers) - len(critical)) / total) if containers else 0,
        "urgent_containers": len(urgent),
        "critical_containers": len(critical),
        "pending_kg": sum(collected_kg(item.get("fill_level")) for item in urgent),
        "coverage_pct": round(100 * covered / len(SERVICE_ZONES)),
        "routes": len(routes),
        "active_routes": sum(1 for item in routes if item.get("status") == "in_progress"),
        "fleet_operating": len(operating),
        "fleet_stopped": max(0, len(vehicles) - len(operating)),
        "open_incidents": len(open_incidents),
        "resolved_incidents": len(resolved),
        "response_rate_pct": round(100 * len(resolved) / len(incidents)) if incidents else 100,
        "priority": [
            {
                "id": item.get("id"),
                "code": item.get("code"),
                "zone": item.get("zone"),
                "fill_level": int(item.get("fill_level") or 0),
                "collected_kg": collected_kg(item.get("fill_level")),
            }
            for item in priority
        ],
    }
