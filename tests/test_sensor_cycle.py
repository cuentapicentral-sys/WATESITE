from datetime import datetime, timedelta, timezone

from services.sensors.cycle import TICK_SECONDS, container_cycle


def test_fill_stays_between_zero_and_one_hundred_and_changes_each_tick():
    start = datetime(2026, 10, 5, 12, 0, tzinfo=timezone.utc)
    levels = [container_cycle("C-240", start + timedelta(seconds=TICK_SECONDS * tick))["fill_level"] for tick in range(12)]

    assert all(0 <= level <= 100 for level in levels)
    assert len(set(levels)) > 1


def test_cycle_fills_then_empties():
    start = datetime(2026, 10, 5, 12, 0, tzinfo=timezone.utc)
    phases = [container_cycle("C-155", start + timedelta(seconds=TICK_SECONDS * tick))["phase"] for tick in range(16)]

    assert "llenando" in phases
    assert "vaciado" in phases
    empty_index = phases.index("vaciado")
    if empty_index > 0:
        assert phases[empty_index - 1] == "llenando"


def test_same_moment_is_stable_and_countdown_matches_the_five_minute_clock():
    moment = datetime(2026, 10, 5, 15, 7, tzinfo=timezone.utc)
    first = container_cycle("C-311", moment)
    second = container_cycle("C-311", moment)
    levels = {container_cycle(code, moment)["fill_level"] for code in ("C-240", "C-155", "C-311", "C-178", "C-402")}

    assert first == second
    assert first["seconds_until_next"] == 180
    assert len(levels) > 1
