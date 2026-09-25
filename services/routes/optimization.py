def prioritize_containers(
    containers: list[dict], zone: str | None, max_stops: int
) -> list[dict]:
    candidates = [
        container
        for container in containers
        if container["fill_level"] >= 70 and (zone is None or container["zone"] == zone)
    ]
    return sorted(
        candidates, key=lambda container: container["fill_level"], reverse=True
    )[:max_stops]
