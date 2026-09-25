from services.routes.optimization import prioritize_containers


def test_prioritize_containers_filters_threshold_and_sorts_by_fill_level():
    containers = [
        {"code": "C-69", "zone": "Centro", "fill_level": 69},
        {"code": "C-70", "zone": "Centro", "fill_level": 70},
        {"code": "C-95", "zone": "Norte", "fill_level": 95},
        {"code": "C-80", "zone": "Centro", "fill_level": 80},
    ]

    result = prioritize_containers(containers, None, 10)

    assert [container["code"] for container in result] == ["C-95", "C-80", "C-70"]


def test_prioritize_containers_limits_stops_after_zone_filter():
    containers = [
        {"code": "C-91", "zone": "Centro", "fill_level": 91},
        {"code": "N-99", "zone": "Norte", "fill_level": 99},
        {"code": "C-78", "zone": "Centro", "fill_level": 78},
    ]

    result = prioritize_containers(containers, "Centro", 1)

    assert [container["code"] for container in result] == ["C-91"]
