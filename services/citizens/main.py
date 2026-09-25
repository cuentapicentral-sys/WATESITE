from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.database import supabase
from services.events import publish_event

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


class ScanPayload(BaseModel):
    qr_code: str = Field(min_length=3, max_length=120)
    points: int = Field(default=10, ge=1, le=500)


@app.get("/health")
def health():
    return {"status": "ok", "service": "citizen-service"}


@app.get("/citizens")
def list_citizens():
    try:
        response = supabase.table("citizens").select("*").execute()
        return {"data": response.data}
    except Exception as error:
        raise HTTPException(status_code=502, detail="No se pudieron consultar los ciudadanos") from error


@app.post("/citizens", status_code=201)
def create_citizen(payload: CitizenPayload):
    response = supabase.table("citizens").insert(payload.model_dump()).execute()
    publish_event("citizen.registered", response.data[0], "citizen.registered")
    return {"data": response.data[0]}


@app.post("/citizens/{citizen_id}/scans")
def register_qr_scan(citizen_id: str, payload: ScanPayload):
    citizen = supabase.table("citizens").select("points").eq("id", citizen_id).single().execute().data
    updated_points = citizen["points"] + payload.points
    response = supabase.table("citizens").update({"points": updated_points}).eq("id", citizen_id).execute()
    publish_event("recycling.verified", {"citizen_id": citizen_id, "qr_code": payload.qr_code, "earned_points": payload.points, "total_points": updated_points}, "recycling.verified")
    return {"data": response.data[0], "qr_code": payload.qr_code, "earned_points": payload.points}


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