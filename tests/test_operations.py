from services.operations import collected_kg, collection_status, operational_snapshot


def test_collected_weight_uses_bin_capacity():
    assert collected_kg(0) == 0
    assert collected_kg(100) == 110
    assert collected_kg(92) == 101
    assert collected_kg(150) == 110


def test_collection_status_thresholds():
    assert collection_status(40) == "normal"
    assert collection_status(75) == "attention"
    assert collection_status(90) == "critical"


def test_snapshot_prioritizes_full_containers_and_hides_fake_totals():
    snapshot = operational_snapshot(
        [
            {"id": "1", "code": "C-240", "zone": "Centro", "fill_level": 92, "status": "critical"},
            {"id": "2", "code": "C-155", "zone": "Norte", "fill_level": 64, "status": "normal"},
            {"id": "3", "code": "C-311", "zone": "Sur", "fill_level": 80, "status": "attention"},
        ],
        routes=[{"status": "in_progress"}, {"status": "scheduled"}],
        vehicles=[{"state": "en_ruta"}, {"state": "revision"}],
        incidents=[{"status": "reported"}, {"status": "resolved"}],
    )

    assert snapshot["efficiency_pct"] == 67
    assert snapshot["urgent_containers"] == 2
    assert snapshot["pending_kg"] == collected_kg(92) + collected_kg(80)
    assert snapshot["coverage_pct"] == 60
    assert snapshot["fleet_operating"] == 1
    assert snapshot["fleet_stopped"] == 1
    assert snapshot["open_incidents"] == 1
    assert snapshot["response_rate_pct"] == 50
    assert [item["code"] for item in snapshot["priority"]] == ["C-240", "C-311"]
