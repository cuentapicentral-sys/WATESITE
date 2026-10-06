PHOTO_POINTS = 5

RECYCLING_POINTS = [
    {"code": "QR-RONDA", "place": "Ronda del Sinú", "zone": "Centro", "latitude": 8.7526, "longitude": -75.8812},
    {"code": "QR-BOLIVAR", "place": "Parque Simón Bolívar", "zone": "Centro", "latitude": 8.7489, "longitude": -75.8818},
    {"code": "QR-MERCADO", "place": "Mercado del Centro", "zone": "Centro", "latitude": 8.7558, "longitude": -75.8864},
    {"code": "QR-GRANJA", "place": "La Granja", "zone": "Norte", "latitude": 8.7784, "longitude": -75.8608},
    {"code": "QR-UNICOR", "place": "Universidad de Córdoba", "zone": "Norte", "latitude": 8.7892, "longitude": -75.8586},
    {"code": "QR-JIMENEZ", "place": "Villa Jiménez", "zone": "Sur", "latitude": 8.7242, "longitude": -75.8874},
    {"code": "QR-ROBLES", "place": "Los Robles", "zone": "Este", "latitude": 8.7504, "longitude": -75.8518},
    {"code": "QR-AMPARO", "place": "El Amparo", "zone": "Oeste", "latitude": 8.7416, "longitude": -75.9068},
]


def find_recycling_point(code: str):
    wanted = (code or "").strip().upper()
    return next((point for point in RECYCLING_POINTS if point["code"] == wanted), None)


def normalize_phone(phone: str | None) -> str:
    digits = "".join(char for char in str(phone or "") if char.isdigit())
    return digits[-10:] if len(digits) >= 10 else digits


def tagged_name(name: str, phone: str | None) -> str:
    clean_name = " ".join(name.split())
    clean_phone = normalize_phone(phone)
    return f"{clean_name} #{clean_phone}" if clean_phone else clean_name


def public_name(stored_name: str) -> str:
    return stored_name.split(" #", 1)[0].strip()


def phone_from_name(stored_name: str) -> str | None:
    if " #" not in stored_name:
        return None
    return stored_name.split(" #", 1)[1].strip() or None


def points_after_photo(current_points: int) -> int:
    return int(current_points) + PHOTO_POINTS


def photo_is_valid(photo_url: str | None) -> bool:
    value = photo_url or ""
    return value.startswith("data:image/") and 32 <= len(value) <= 1_200_000
