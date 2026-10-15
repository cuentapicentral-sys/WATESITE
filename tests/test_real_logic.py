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
