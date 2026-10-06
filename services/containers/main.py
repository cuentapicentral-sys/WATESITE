from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.database import supabase
from services.events import publish_event
from services.operations import collected_kg, collection_status

app = FastAPI(title="WasteWise Container Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ContainerPayload(BaseModel):
    code: str = Field(min_length=2, max_length=40)
    zone: str = Field(min_length=2, max_length=80)
    latitude: float | None = None
    longitude: float | None = None
    fill_level: int = Field(default=0, ge=0, le=100)
    status: str = Field(default="normal", pattern="^(normal|attention|critical)$")


@app.get("/health")
def health():
    return {"status": "ok", "service": "container-service"}


@app.get("/containers")
def list_containers():
    try:
        response = supabase.table("containers").select("*").execute()
        return {"data": response.data}
    except Exception as error:
        raise HTTPException(status_code=502, detail="No se pudieron consultar los contenedores") from error


@app.post("/containers", status_code=201)
def create_container(payload: ContainerPayload):
    try:
        response = supabase.table("containers").insert(payload.model_dump()).execute()
        return {"data": response.data[0]}
    except Exception as error:
        raise HTTPException(status_code=400, detail="No se pudo registrar el contenedor") from error


class CollectionPayload(BaseModel):
    operator: str | None = None
    vehicle_plate: str | None = None


@app.post("/containers/{container_id}/collect")
def collect_container(container_id: str, payload: CollectionPayload | None = None):
    payload = payload or CollectionPayload()
    query = supabase.table("containers").select("*").eq("id", container_id).limit(1).execute()
    if not query.data:
        query = supabase.table("containers").select("*").eq("code", container_id).limit(1).execute()
    if not query.data:
        raise HTTPException(status_code=404, detail="Contenedor no encontrado")
    container = query.data[0]
    kilos = collected_kg(container.get("fill_level"))
    updated = supabase.table("containers").update({"fill_level": 0, "status": "normal"}).eq("id", container["id"]).execute().data[0]
    try:
        supabase.table("sensor_readings").insert({"container_id": container["id"], "fill_level": 0}).execute()
    except Exception:
        pass
    who = payload.operator or payload.vehicle_plate or "operador"
    supabase.table("alerts").insert({
        "title": f"Recolección confirmada · {container['code']}",
        "description": f"{who} vació {container['code']} en {container['zone']}. Se retiraron {kilos} kg estimados.",
        "severity": "low",
    }).execute()
    publish_event("container.collected", {"container_id": container["id"], "code": container["code"], "collected_kg": kilos}, "container.collected")
    return {"data": updated, "collected_kg": kilos, "previous_fill": container.get("fill_level"), "status": collection_status(0)}


@app.get("/containers/critical")
def critical_containers():
    response = supabase.table("containers").select("*").in_("status", ["attention", "critical"]).order("fill_level", desc=True).execute()
    return {"data": response.data}