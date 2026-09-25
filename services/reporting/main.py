from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.database import supabase
from services.events import publish_event

app = FastAPI(title="WasteWise Citizen Reporting Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class IncidentPayload(BaseModel):
    citizen_id: str | None = None
    category: str = Field(min_length=3, max_length=60)
    description: str = Field(min_length=5, max_length=500)
    photo_url: str | None = None
    latitude: float | None = None
    longitude: float | None = None


@app.get("/health")
def health():
    return {"status": "ok", "service": "reporting-service"}


@app.post("/incidents", status_code=201)
def create_incident(payload: IncidentPayload):
    try:
        response = supabase.table("citizen_incidents").insert(payload.model_dump()).execute()
        publish_event("incident.reported", response.data[0], "incident.reported")
        return {"data": response.data[0]}
    except Exception as error:
        raise HTTPException(status_code=400, detail="No se pudo registrar la incidencia") from error


@app.get("/incidents")
def list_incidents(status: str | None = None):
    query = supabase.table("citizen_incidents").select("*").order("created_at", desc=True)
    if status:
        query = query.eq("status", status)
    return {"data": query.execute().data}


@app.patch("/incidents/{incident_id}/status")
def update_incident(incident_id: str, status: str):
    if status not in {"reported", "assigned", "resolved", "rejected"}:
        raise HTTPException(status_code=422, detail="Estado de incidencia no válido")
    response = supabase.table("citizen_incidents").update({"status": status}).eq("id", incident_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")
    publish_event("incident.status.changed", response.data[0], "incident.status.changed")
    return {"data": response.data[0]}
