import logging

logger = logging.getLogger(__name__)

FILL_WARNING_THRESHOLD = 80
FILL_CRITICAL_THRESHOLD = 90


def fill_transition_notification(container: dict, previous_fill: int | None, current_fill: int) -> dict | None:
    previous = int(previous_fill) if previous_fill is not None else None
    current = int(current_fill)
    code = container.get("code") or "Contenedor"
    zone = container.get("zone") or "zona desconocida"

    if current >= FILL_CRITICAL_THRESHOLD and (previous is None or previous < FILL_CRITICAL_THRESHOLD):
        return {
            "title": "Contenedor crítico",
            "description": f"{code} en {zone} alcanzó {current}% de llenado (umbral crítico: {FILL_CRITICAL_THRESHOLD}%).",
            "severity": "critical",
        }
    if current >= FILL_WARNING_THRESHOLD and (previous is None or previous < FILL_WARNING_THRESHOLD):
        return {
            "title": "Contenedor próximo a desbordarse",
            "description": f"{code} en {zone} alcanzó {current}% de llenado (umbral de aviso: {FILL_WARNING_THRESHOLD}%).",
            "severity": "high",
        }
    return None


def create_notification(client, title: str, description: str, severity: str = "medium") -> dict | None:
    try:
        response = client.table("alerts").insert({
            "title": title,
            "description": description,
            "severity": severity,
        }).execute()
        return response.data[0] if response.data else None
    except Exception as error:
        logger.warning("Could not persist notification '%s': %s", title, error)
        return None


def notify_fill_transition(client, container: dict, previous_fill: int | None, current_fill: int) -> dict | None:
    notification = fill_transition_notification(container, previous_fill, current_fill)
    if not notification:
        return None
    return create_notification(client, **notification)