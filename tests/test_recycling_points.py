from services.citizens.points import (
    PHOTO_POINTS,
    find_recycling_point,
    normalize_phone,
    photo_is_valid,
    points_after_photo,
    public_name,
    tagged_name,
)


def test_each_photo_adds_exactly_five_points():
    assert PHOTO_POINTS == 5
    assert points_after_photo(0) == 5
    assert points_after_photo(15) == 20


def test_recycling_points_are_in_monteria_and_have_unique_qr_codes():
    first = find_recycling_point("qr-ronda")
    assert first["place"] == "Ronda del Sinú"
    assert 8.68 <= first["latitude"] <= 8.82
    assert find_recycling_point("QR-NO-EXISTE") is None


def test_phone_is_kept_with_the_citizen_without_showing_it_as_the_name():
    stored = tagged_name("Ana López", "300 123 4567")
    assert public_name(stored) == "Ana López"
    assert normalize_phone("300 123 4567") in stored


def test_donation_requires_an_image():
    assert photo_is_valid("data:image/jpeg;base64," + ("a" * 40))
    assert not photo_is_valid("https://example.com/foto.jpg")
    assert not photo_is_valid("")
