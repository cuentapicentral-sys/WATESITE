import math
from datetime import datetime, timezone

TICK_SECONDS = 5 * 60


def _aware(moment: datetime | None) -> datetime:
    current = moment or datetime.now(timezone.utc)
    if current.tzinfo is None:
        return current.replace(tzinfo=timezone.utc)
    return current


def seconds_until_next_tick(moment: datetime | None = None) -> int:
    elapsed = int(_aware(moment).timestamp()) % TICK_SECONDS
    return TICK_SECONDS if elapsed == 0 else TICK_SECONDS - elapsed


def status_for_fill(fill_level: int) -> str:
    if fill_level >= 90:
        return "critical"
    if fill_level >= 75:
        return "attention"
    return "normal"


def container_cycle(code: str, moment: datetime | None = None) -> dict:
    """Simula un ciclo de llenado y vaciado alineado a bloques de 5 minutos."""
    current = _aware(moment)
    epoch = int(current.timestamp() // TICK_SECONDS)
    seed = sum((index + 1) * ord(char) for index, char in enumerate(code or "C"))
    step = 8 + (seed % 5) * 2
    empty_level = 8 + (seed % 4) * 3
    ticks_to_full = max(1, math.ceil((100 - empty_level) / step))
    cycle_length = ticks_to_full + 1
    position = (epoch + seed) % cycle_length

    if position >= ticks_to_full:
        fill_level = empty_level
        phase = "vaciado"
    else:
        fill_level = min(100, empty_level + position * step)
        phase = "llenando"

    return {
        "fill_level": fill_level,
        "status": status_for_fill(fill_level),
        "phase": phase,
        "step": step,
        "seconds_until_next": seconds_until_next_tick(current),
    }


def apply_sensor_cycle(client, moment: datetime | None = None) -> dict:
    current = _aware(moment)
    containers = client.table("containers").select("id,code,zone,fill_level,status").execute().data or []
    updated = []

    for container in containers:
        state = container_cycle(container.get("code") or "", current)
        changed = container.get("fill_level") != state["fill_level"] or container.get("status") != state["status"]
        if changed:
            client.table("containers").update(
                {"fill_level": state["fill_level"], "status": state["status"]}
            ).eq("id", container["id"]).execute()
            client.table("sensor_readings").insert(
                {"container_id": container["id"], "fill_level": state["fill_level"]}
            ).execute()
        updated.append({**container, **state, "changed": changed})

    return {
        "interval_seconds": TICK_SECONDS,
        "seconds_until_next": seconds_until_next_tick(current),
        "updated": sum(item["changed"] for item in updated),
        "containers": updated,
    }
