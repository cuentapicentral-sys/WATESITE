from datetime import datetime
from zoneinfo import ZoneInfo

from services.analytics.report import municipal_report, zone_name


def test_zone_comes_from_coordinates_when_the_label_is_missing():
    assert zone_name({"latitude": 8.724, "longitude": -75.887}) == "Sur"


def test_report_recommends_advancing_a_route_outside_collection_day():
    moment = datetime(2026, 10, 6, 9, 0, tzinfo=ZoneInfo("America/Bogota"))
    report = municipal_report(
        containers=[{"code": "C-1", "zone": "Sur", "fill_level": 96, "status": "critical"}],
        vehicles=[{"state": "revision"}],
        incidents=[{"status": "reported", "latitude": 8.7242, "longitude": -75.8874, "created_at": "2026-10-06T08:00:00-05:00"}],
        citizens=[{"points": 45}],
        alerts=[{"title": "Recolección confirmada · C-9", "description": "Se retiraron 40 kg", "created_at": "2026-10-06T07:00:00-05:00"}],
        now=moment,
    )
    assert report["summary"]["pending_kg"] == 106
    assert report["summary"]["kg_collected_today"] == 40
    assert report["zones"][2]["collects_today"] is False
    assert any("Adelantar la ruta de Sur" in item["title"] for item in report["decisions"])
    assert report["week"][-1]["requests"] == 1
