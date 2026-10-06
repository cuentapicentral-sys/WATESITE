import math
from heapq import heappop, heappush

AVENUES = [
    (8.7186, "Sur"),
    (8.7242, "Villa Jiménez"),
    (8.7318, "Cantaclaro"),
    (8.7338, "Rancho Grande"),
    (8.7416, "El Amparo"),
    (8.7446, "La Pradera"),
    (8.7472, "Alcaldía"),
    (8.7489, "Simón Bolívar"),
    (8.7504, "Los Robles"),
    (8.7526, "Ronda del Sinú"),
    (8.7558, "Mercado"),
    (8.7638, "Patio de flota"),
    (8.7688, "El Recreo"),
    (8.7784, "La Granja"),
    (8.7892, "Universidad de Córdoba"),
]
STREETS = [
    (-75.9068, "Oeste"),
    (-75.9012, "Sur-oeste"),
    (-75.8874, "Jiménez"),
    (-75.8864, "Mercado"),
    (-75.8836, "Alcaldía"),
    (-75.8818, "Bolívar"),
    (-75.8812, "Centro"),
    (-75.8742, "Cantaclaro"),
    (-75.8706, "Recreo"),
    (-75.8688, "Rancho"),
    (-75.8672, "Patio"),
    (-75.8608, "Granja"),
    (-75.8586, "Unicor"),
    (-75.8518, "Robles"),
    (-75.8462, "Pradera"),
]
DEPOT = {"place": "Patio de flota", "latitude": 8.7638, "longitude": -75.8672}


def _node_id(avenue_index: int, street_index: int) -> str:
    return f"a{avenue_index}-s{street_index}"


def build_graph():
    nodes = {}
    for avenue_index, (latitude, avenue) in enumerate(AVENUES):
        for street_index, (longitude, street) in enumerate(STREETS):
            node_id = _node_id(avenue_index, street_index)
            nodes[node_id] = {
                "id": node_id,
                "lat": latitude,
                "lng": longitude,
                "place": f"{avenue} / {street}",
            }
    adjacency = {node_id: [] for node_id in nodes}
    for avenue_index in range(len(AVENUES)):
        for street_index in range(len(STREETS)):
            current = _node_id(avenue_index, street_index)
            if street_index + 1 < len(STREETS):
                _link(adjacency, nodes, current, _node_id(avenue_index, street_index + 1))
            if avenue_index + 1 < len(AVENUES):
                _link(adjacency, nodes, current, _node_id(avenue_index + 1, street_index))
    return nodes, adjacency


def _link(adjacency, nodes, left, right):
    weight = haversine_km(nodes[left], nodes[right])
    adjacency[left].append((right, weight))
    adjacency[right].append((left, weight))


def haversine_km(origin, destination) -> float:
    radius = 6371.0
    lat_delta = math.radians(destination["lat"] - origin["lat"])
    lng_delta = math.radians(destination["lng"] - origin["lng"])
    lat_origin = math.radians(origin["lat"])
    lat_destination = math.radians(destination["lat"])
    arc = math.sin(lat_delta / 2) ** 2 + math.cos(lat_origin) * math.cos(lat_destination) * math.sin(lng_delta / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(arc))


NODES, ADJACENCY = build_graph()


def nearest_node(latitude, longitude) -> str:
    target = {"lat": float(latitude), "lng": float(longitude)}
    return min(NODES, key=lambda node_id: haversine_km(target, NODES[node_id]))


def dijkstra(start: str, goal: str):
    if start not in ADJACENCY or goal not in ADJACENCY:
        return [], math.inf
    distances = {start: 0.0}
    previous = {}
    pending = [(0.0, start)]
    while pending:
        cost, node = heappop(pending)
        if cost != distances.get(node):
            continue
        if node == goal:
            break
        for neighbor, weight in ADJACENCY[node]:
            alternative = cost + weight
            if alternative < distances.get(neighbor, math.inf):
                distances[neighbor] = alternative
                previous[neighbor] = node
                heappush(pending, (alternative, neighbor))
    if goal not in distances:
        return [], math.inf
    path = [goal]
    while path[-1] != start:
        path.append(previous[path[-1]])
    path.reverse()
    return path, distances[goal]


def coordinates(path):
    return [dict(NODES[node_id]) for node_id in path]


def shortest_loop(stops):
    if not stops:
        depot = nearest_node(DEPOT["latitude"], DEPOT["longitude"])
        return coordinates([depot]), 0.0
    snapped = [nearest_node(stop["latitude"], stop["longitude"]) for stop in stops]
    route = []
    total = 0.0
    for index, start in enumerate(snapped):
        goal = snapped[(index + 1) % len(snapped)]
        segment, distance = dijkstra(start, goal)
        points = coordinates(segment)
        route.extend(points if not route else points[1:])
        total += distance
    return route, total


def plan_collection(origin, stops):
    located = [
        stop for stop in stops
        if stop.get("latitude") is not None and stop.get("longitude") is not None
    ]
    current = nearest_node(origin["latitude"], origin["longitude"])
    remaining = located[:]
    ordered = []
    route = coordinates([current])
    total = 0.0
    while remaining:
        best_index = 0
        best_path = [current]
        best_distance = math.inf
        for index, stop in enumerate(remaining):
            segment, distance = dijkstra(current, nearest_node(stop["latitude"], stop["longitude"]))
            if distance < best_distance:
                best_index = index
                best_path = segment
                best_distance = distance
        chosen = remaining.pop(best_index)
        ordered.append(chosen)
        route.extend(coordinates(best_path)[1:])
        current = best_path[-1]
        total += 0 if best_distance is math.inf else best_distance
    back, back_distance = dijkstra(current, nearest_node(origin["latitude"], origin["longitude"]))
    route.extend(coordinates(back)[1:])
    total += 0 if back_distance is math.inf else back_distance
    return {"stops": ordered, "path": route, "distance_km": total, "algorithm": "dijkstra"}
