from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.database import supabase
from services.events import publish_event
from services.sensors.cycle import apply_sensor_cycle

app = FastAPI(title="WasteWise Sensor Ingestion Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SensorReading(BaseModel):
    container_id: str
    fill_level: int = Field(ge=0, le=100)


@app.get("/health")
def health():
    return {"status": "ok", "service": "sensor-service"}


@app.post("/readings", status_code=201)
def ingest_reading(payload: SensorReading):
    try:
        container = None
        try:
            container_query = supabase.table("containers").select("id, code, zone, fill_level, status").eq("id", payload.container_id).limit(1).execute()
            if container_query.data:
                container = container_query.data[0]
        except Exception:
            container = None

        if not container:
            code_query = supabase.table("containers").select("id, code, zone, fill_level, status").eq("code", payload.container_id).limit(1).execute()
            if code_query.data:
                container = code_query.data[0]

        if not container:
            raise HTTPException(status_code=404, detail="Contenedor no encontrado")

        reading = supabase.table("sensor_readings").insert({"container_id": container["id"], "fill_level": payload.fill_level}).execute().data[0]

        if payload.fill_level >= 90:
            status = "critical"
        elif payload.fill_level >= 75:
            status = "attention"
        else:
            status = "normal"

        supabase.table("containers").update({"fill_level": payload.fill_level, "status": status}).eq("id", container["id"]).execute()
        if payload.fill_level >= 90:
            supabase.table("alerts").insert({"title": "Contenedor próximo a desbordarse", "description": f"Sensor reportó {payload.fill_level}% de llenado para {container['code']} ({container['zone']}).", "severity": "high"}).execute()
            publish_event("container.critical", {"container_id": container["id"], "code": container["code"], "zone": container["zone"], "fill_level": payload.fill_level}, "container.critical")
        publish_event("container.fill_level.updated", {"container_id": container["id"], "code": container["code"], "fill_level": payload.fill_level, "status": status}, "container.fill_level.updated")
        return {"data": reading, "container_status": status, "published": payload.fill_level >= 90, "container": container}
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=400, detail="No se pudo procesar la lectura del sensor") from error


@app.post("/cycle")
def run_fill_cycle():
    try:
        return apply_sensor_cycle(supabase)
    except Exception as error:
        raise HTTPException(status_code=400, detail="No se pudo actualizar el ciclo de sensores") from error


@app.get("/readings/container/{container_id}")
def container_history(container_id: str):
    response = supabase.table("sensor_readings").select("*").eq("container_id", container_id).order("recorded_at", desc=True).limit(100).execute()
    return {"data": response.data}
