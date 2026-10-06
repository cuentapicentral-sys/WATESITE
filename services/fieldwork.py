from datetime import datetime
from zoneinfo import ZoneInfo

COLLECTION_SCHEDULE = (
    {"zone": "Centro", "days": "Martes y viernes", "hours": "06:00–10:00", "note": "Ronda del Sinú, Bolívar y mercado"},
    {"zone": "Norte", "days": "Lunes y jueves", "hours": "06:00–10:00", "note": "La Granja, Mogambo y terminal"},
    {"zone": "Sur", "days": "Miércoles y sábado", "hours": "06:00–11:00", "note": "El Recreo, Cantaclaro y Mocarí"},
    {"zone": "Este", "days": "Lunes y viernes", "hours": "13:00–17:00", "note": "Villa Caribe, El Dorado y rancherías"},
    {"zone": "Oeste", "days": "Martes y sábado", "hours": "13:00–17:00", "note": "P5, La Pradera y rondas del occidente"},
)

REWARD_CATALOG = (
    {"code": "BOLSA", "reward_name": "Bolsa reutilizable", "points_cost": 40, "detail": "Se entrega en el punto de reciclaje más cercano."},
    {"code": "FERIA", "reward_name": "10% en la feria campesina", "points_cost": 80, "detail": "Vale para un sábado en la plaza de mercado."},
    {"code": "ARBOL", "reward_name": "Árbol para tu barrio", "points_cost": 120, "detail": "La alcaldía lo siembra en la zona que elijas."},
)


def catalog_item(code: str) -> dict | None:
    wanted = (code or "").strip().upper()
    return next((item for item in REWARD_CATALOG if item["code"] == wanted), None)


def assigned_vehicle(description: str | None) -> str | None:
    text = description or ""
    start = text.rfind("[VEH:")
    if start < 0:
        return None
    end = text.find("]", start)
    plate = text[start + 5:end].strip().upper()
    return plate or None


def with_vehicle(description: str | None, plate: str) -> str:
    text = description or ""
    start = text.rfind("[VEH:")
    if start >= 0:
        end = text.find("]", start)
        text = (text[:start] + text[end + 1:] if end >= 0 else text[:start]).strip()
    return f"{text} [VEH:{plate.strip().upper()}]"[:500]


def citizen_status(status: str | None, vehicle: str | None) -> str:
    if status == "assigned" and vehicle:
        return "en_camino"
    return status or "reported"


def _today() -> str:
    return datetime.now(ZoneInfo("America/Bogota")).date().isoformat()


def _is_today(value: str | None, today: str) -> bool:
    return str(value or "").startswith(today)


def _kilos(text: str | None) -> int:
    raw = text or ""
    marker = " kg"
    index = raw.find(marker)
    if index < 0:
        return 0
    digits = ""
    cursor = index - 1
    while cursor >= 0 and raw[cursor].isdigit():
        digits = raw[cursor] + digits
        cursor -= 1
    return int(digits) if digits else 0


def build_day_close(alerts: list[dict], incidents: list[dict], citizens: list[dict]) -> dict:
    today = _today()
    collections = []
    for alert in alerts:
        title = alert.get("title") or ""
        if "Recolección confirmada" not in title or not _is_today(alert.get("created_at"), today):
            continue
        collections.append({
            "code": title.split("·")[-1].strip(),
            "kg": _kilos(alert.get("description")),
            "created_at": alert.get("created_at"),
        })
    resolved = [
        item for item in incidents
        if item.get("status") == "resolved" and _is_today(item.get("created_at"), today)
    ]
    donations = [
        item for item in incidents
        if item.get("category") == "Donación de reciclaje" and _is_today(item.get("created_at"), today)
    ]
    return {
        "date": today,
        "city": "Montería",
        "containers_emptied": len(collections),
        "kg_collected": sum(item["kg"] for item in collections),
        "requests_resolved": len(resolved),
        "donations": len(donations),
        "points_awarded": len(donations) * 5,
        "points_in_circulation": sum(int(item.get("points") or 0) for item in citizens),
        "collections": collections[:12],
    }
