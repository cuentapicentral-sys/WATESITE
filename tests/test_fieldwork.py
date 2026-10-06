from datetime import datetime
from zoneinfo import ZoneInfo

from services.fieldwork import assigned_vehicle, build_day_close, catalog_item, citizen_status, with_vehicle


def test_vehicle_tag_roundtrip():
    text = with_vehicle("[RAD-7K2M9Q] Contenedor lleno", "tr-04")
    assert assigned_vehicle(text) == "TR-04"
    assert "Contenedor lleno" in text
    assert citizen_status("assigned", "TR-04") == "en_camino"


def test_catalog_and_day_close():
    assert catalog_item("bolsa")["points_cost"] == 40
    today = datetime.now(ZoneInfo("America/Bogota")).date().isoformat() + "T08:00:00-05:00"
    report = build_day_close(
        [{"title": "Recolección confirmada · CT-001", "description": "Se retiraron 88 kg", "created_at": today}],
        [
            {"status": "resolved", "category": "Acumulación", "created_at": today},
            {"status": "reported", "category": "Donación de reciclaje", "created_at": today},
        ],
        [{"points": 15}],
    )
    assert report["containers_emptied"] == 1
    assert report["kg_collected"] == 88
    assert report["points_awarded"] == 5
    assert report["points_in_circulation"] == 15
