from unittest.mock import patch

from services.fieldwork import citizen_status, route_eta_for


def test_route_eta_is_calculated_from_workload():
    assert route_eta_for("Centro", container_count=6, urgent=True) == "12 min"
    assert route_eta_for("Norte", container_count=2, urgent=False) == "18 min"


def test_assigned_incidents_show_public_status():
    assert citizen_status("assigned", "TR-01") == "en_camino"
    assert citizen_status("reported", None) == "reported"


def test_container_types_are_normalized():
    from services.containers.main import normalize_container_type

    assert normalize_container_type("organica") == "organica"
    assert normalize_container_type("Reciclable") == "reciclable"
    assert normalize_container_type("vidrio ") == "vidrio"
    assert normalize_container_type("otra") == "general"


def test_dashboard_returns_container_rows():
    from backend import main as backend_main

    containers = [{"id": "container-1", "code": "C-001", "container_type": "vidrio"}]

    def query(table_name, _select_fields, _fallback):
        return containers if table_name == "containers" else []

    with patch.object(backend_main, "safe_supabase_query", side_effect=query):
        dashboard = backend_main.build_dashboard_data()

    assert dashboard["containers"] == containers


def test_dashboard_returns_registered_fleet_vehicles():
    from backend import main as backend_main

    vehicles = [{"id": "vehicle-1", "plate": "TR-88", "type": "Camión", "state": "en ruta", "load_level": 56}]

    def query(table_name, _select_fields, _fallback):
        return vehicles if table_name == "vehicles" else []

    with patch.object(backend_main, "safe_supabase_query", side_effect=query):
        dashboard = backend_main.build_dashboard_data()

    assert dashboard["fleet"] == [{
        "id": "TR-88",
        "plate": "TR-88",
        "type": "Camión",
        "state": "en ruta",
        "load_level": 56,
        "load": "56%",
    }]


def test_fill_notifications_fire_only_when_crossing_thresholds():
    from services.notifications.logic import fill_transition_notification

    container = {"code": "C-001", "zone": "Centro"}
    warning = fill_transition_notification(container, 79, 80)
    critical = fill_transition_notification(container, 89, 90)

    assert warning["severity"] == "high"
    assert critical["severity"] == "critical"
    assert fill_transition_notification(container, 84, 86) is None
    assert fill_transition_notification(container, 92, 95) is None


def test_routes_select_only_an_available_compatible_vehicle():
    from services.routes.main import select_available_vehicle

    vehicles = [
        {"id": "bike", "plate": "BIKE-01", "type": "Bicicleta electrica", "state": "operativo", "load_level": 0},
        {"id": "busy", "plate": "TR-12", "type": "Camión compactador", "state": "operativo", "load_level": 10},
        {"id": "available", "plate": "TR-88", "type": "Furgón de mantenimiento", "state": "operativo", "load_level": 30},
        {"id": "moving", "plate": "TR-22", "type": "Camión compactador", "state": "en_ruta", "load_level": 0},
    ]

    chosen = select_available_vehicle(vehicles, {"busy"})

    assert chosen["plate"] == "TR-88"
    assert select_available_vehicle(vehicles, {"busy", "available"}) is None


def test_dashboard_routes_include_assigned_vehicle():
    from backend import main as backend_main

    routes = [{
        "route_code": "OPT-001",
        "area": "Centro",
        "status": "in_progress",
        "vehicle_id": "vehicle-1",
        "vehicle_plate": "TR-88",
    }]

    def query(table_name, _select_fields, _fallback):
        return routes if table_name == "routes" else []

    with patch.object(backend_main, "safe_supabase_query", side_effect=query):
        dashboard = backend_main.build_dashboard_data()

    assert dashboard["routes"][0]["vehicle_plate"] == "TR-88"
    assert dashboard["routes"][0]["status_code"] == "in_progress"
