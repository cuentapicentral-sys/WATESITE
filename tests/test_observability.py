from fastapi.testclient import TestClient


def test_backend_health_and_metrics_are_exposed():
    from backend.main import app

    client = TestClient(app)
    health = client.get("/api/health")
    metrics = client.get("/metrics")

    assert health.status_code == 200
    assert health.json()["status"] == "ok"
    assert metrics.status_code == 200
    assert "http_requests_total" in metrics.text


def test_microservice_health_and_metrics_endpoints():
    from services.analytics.main import app as analytics_app
    from services.citizens.main import app as citizens_app
    from services.containers.main import app as containers_app
    from services.fleet.main import app as fleet_app
    from services.notifications.main import app as notifications_app
    from services.reporting.main import app as reporting_app
    from services.routes.main import app as routes_app
    from services.sensors.main import app as sensors_app

    apps = (
        ("analytics", analytics_app),
        ("citizens", citizens_app),
        ("containers", containers_app),
        ("fleet", fleet_app),
        ("notifications", notifications_app),
        ("reporting", reporting_app),
        ("routes", routes_app),
        ("sensors", sensors_app),
    )

    for name, app in apps:
        client = TestClient(app)
        health = client.get("/health")
        metrics = client.get("/metrics")

        assert health.status_code == 200, name
        assert metrics.status_code == 200, name
        assert "http_requests_total" in metrics.text, name
