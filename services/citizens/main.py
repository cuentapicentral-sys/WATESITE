from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.citizens.points import (
    PHOTO_POINTS,
    RECYCLING_POINTS,
    find_recycling_point,
    normalize_phone,
    phone_from_name,
    photo_is_valid,
    points_after_photo,
    public_name,
    tagged_name,
)
from services.database import supabase
from services.events import publish_event
from services.fieldwork import REWARD_CATALOG, catalog_item

app = FastAPI(title="WasteWise Citizen Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CitizenPayload(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str | None = Field(default=None, max_length=20)


class ScanPayload(BaseModel):
    qr_code: str = Field(min_length=3, max_length=120)
    points: int = Field(default=PHOTO_POINTS, ge=1, le=500)


class DonationPayload(BaseModel):
    citizen_id: str
    qr_code: str = Field(min_length=3, max_length=120)
    photo_url: str


def present_citizen(citizen: dict) -> dict:
    return {**citizen, "name": public_name(citizen["name"]), "phone": phone_from_name(citizen["name"])}


@app.get("/recycling-points")
def list_recycling_points():
    return {"data": RECYCLING_POINTS, "points_per_photo": PHOTO_POINTS}


@app.get("/citizens")
def list_citizens():
    try:
        response = supabase.table("citizens").select("*").execute()
        return {"data": [present_citizen(citizen) for citizen in response.data]}
    except Exception as error:
        raise HTTPException(status_code=502, detail="No se pudieron consultar los ciudadanos") from error


@app.post("/citizens", status_code=201)
def create_citizen(payload: CitizenPayload):
    stored_name = tagged_name(payload.name, payload.phone)
    phone = normalize_phone(payload.phone)
    if phone:
        existing = supabase.table("citizens").select("*").ilike("name", f"%#{phone}").execute().data
        if existing:
            return {"data": present_citizen(existing[0]), "existing": True}
    response = supabase.table("citizens").insert({"name": stored_name}).execute()
    publish_event("citizen.registered", response.data[0], "citizen.registered")
    return {"data": present_citizen(response.data[0])}


def award_photo_points(citizen_id: str, qr_code: str, photo_url: str | None = None):
    point = find_recycling_point(qr_code)
    if not point:
        raise HTTPException(status_code=404, detail="Ese código QR no corresponde a un punto de reciclaje")
    citizen = supabase.table("citizens").select("*").eq("id", citizen_id).single().execute().data
    if not citizen:
        raise HTTPException(status_code=404, detail="Regístrate antes de enviar la foto")
    updated_points = points_after_photo(citizen["points"])
    response = supabase.table("citizens").update({"points": updated_points}).eq("id", citizen_id).execute()
    if photo_url:
        try:
            supabase.table("citizen_incidents").insert({
                "citizen_id": citizen_id,
                "category": "Donación de reciclaje",
                "description": f"Foto en {point['place']} · {point['code']} · +{PHOTO_POINTS} puntos",
                "photo_url": photo_url,
                "latitude": point["latitude"],
                "longitude": point["longitude"],
                "status": "resolved",
            }).execute()
        except Exception:
            pass
    publish_event("recycling.verified", {"citizen_id": citizen_id, "qr_code": point["code"], "earned_points": PHOTO_POINTS, "total_points": updated_points}, "recycling.verified")
    return {"data": present_citizen(response.data[0]), "qr_code": point["code"], "place": point["place"], "earned_points": PHOTO_POINTS, "total_points": updated_points}


@app.post("/donations")
def submit_donation(payload: DonationPayload):
    if not photo_is_valid(payload.photo_url):
        raise HTTPException(status_code=422, detail="Adjunta una foto de la donación")
    return award_photo_points(payload.citizen_id, payload.qr_code, payload.photo_url)


@app.post("/citizens/{citizen_id}/scans")
def register_qr_scan(citizen_id: str, payload: ScanPayload):
    return award_photo_points(citizen_id, payload.qr_code)


class CatalogRedeemPayload(BaseModel):
    phone: str = Field(min_length=7, max_length=20)
    code: str = Field(min_length=3, max_length=20)


@app.get("/rewards/catalog")
def reward_catalog():
    return {"data": REWARD_CATALOG}


@app.post("/rewards/redeem")
def redeem_catalog(payload: CatalogRedeemPayload):
    item = catalog_item(payload.code)
    if not item:
        raise HTTPException(status_code=404, detail="Ese premio no está en el catálogo")
    phone = normalize_phone(payload.phone)
    matches = supabase.table("citizens").select("*").ilike("name", f"%#{phone}").execute().data
    if not matches:
        raise HTTPException(status_code=404, detail="No hay un ciudadano con ese celular. Primero debe registrarse.")
    citizen = matches[0]
    if int(citizen.get("points") or 0) < item["points_cost"]:
        raise HTTPException(status_code=400, detail="Puntos insuficientes")
    remaining = int(citizen["points"]) - item["points_cost"]
    supabase.table("citizens").update({"points": remaining}).eq("id", citizen["id"]).execute()
    try:
        supabase.table("rewards").insert({
            "citizen_id": citizen["id"],
            "reward_name": item["reward_name"],
            "points_cost": item["points_cost"],
        }).execute()
    except Exception:
        pass
    publish_event("reward.redeemed", {"citizen_id": citizen["id"], "reward": item["reward_name"], "points": item["points_cost"]}, "reward.redeemed")
    return {"status": "redeemed", "reward_name": item["reward_name"], "points": remaining}


@app.get("/rewards")
def list_rewards():
    response = supabase.table("rewards").select("*").execute()
    return {"data": response.data}


@app.post("/citizens/{citizen_id}/rewards/{reward_id}/redeem")
def redeem_reward(citizen_id: str, reward_id: str):
    reward = supabase.table("rewards").select("*").eq("id", reward_id).single().execute().data
    citizen = supabase.table("citizens").select("points").eq("id", citizen_id).single().execute().data
    if citizen["points"] < reward["points_cost"]:
        raise HTTPException(status_code=400, detail="Puntos insuficientes")
    supabase.table("citizens").update({"points": citizen["points"] - reward["points_cost"]}).eq("id", citizen_id).execute()
    publish_event("reward.redeemed", {"citizen_id": citizen_id, "reward_id": reward_id, "reward": reward["reward_name"], "points": reward["points_cost"]}, "reward.redeemed")
    return {"status": "redeemed", "reward": reward["reward_name"]}