from services.routes.dijkstra import DEPOT, dijkstra, nearest_node, plan_collection, shortest_loop


def test_dijkstra_follows_the_street_grid_instead_of_a_straight_jump():
    start = nearest_node(DEPOT["latitude"], DEPOT["longitude"])
    goal = nearest_node(8.7416, -75.9068)

    path, distance = dijkstra(start, goal)

    assert path[0] == start
    assert path[-1] == goal
    assert len(path) > 2
    assert distance > 0


def test_collection_plan_visits_the_nearest_full_container_first():
    stops = [
        {"code": "LEJOS", "latitude": 8.7186, "longitude": -75.9068, "fill_level": 90},
        {"code": "CERCA", "latitude": 8.7638, "longitude": -75.8608, "fill_level": 80},
    ]

    plan = plan_collection(DEPOT, stops)

    assert plan["algorithm"] == "dijkstra"
    assert [stop["code"] for stop in plan["stops"]] == ["CERCA", "LEJOS"]
    assert plan["path"][0]["place"].startswith("Patio de flota")
    assert plan["path"][-1]["place"].startswith("Patio de flota")
    assert len(plan["path"]) > len(stops)


def test_shortest_loop_returns_to_the_first_stop():
    stops = [
        {"place": "Alcaldía", "latitude": 8.7472, "longitude": -75.8836},
        {"place": "Ronda del Sinú", "latitude": 8.7526, "longitude": -75.8812},
        {"place": "Mercado", "latitude": 8.7558, "longitude": -75.8864},
    ]

    path, distance = shortest_loop(stops)

    assert distance > 0
    assert path[0]["lat"] == path[-1]["lat"]
    assert path[0]["lng"] == path[-1]["lng"]
    assert len(path) > 3
