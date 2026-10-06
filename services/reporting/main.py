import re
import secrets

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.database import supabase
from services.events import publish_event
from services.fieldwork import assigned_vehicle, citizen_status, with_vehicle

TRACKING_RE = re.compile(r"\[(RAD-[A-Z0-9]{6})\]")
TRACKING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

app = FastAPI(title="WasteWise Citizen Reporting Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def new_tracking_code() -> str:
    return "RAD-" + "".join(secrets.choice(TRACKING_ALPHABET) for _ in range(6))


def tracking_code_of(incident: dict) -> str | None:
    if incident.get("tracking_code"):
        return incident["tracking_code"]
    match = TRACKING_RE.search(incident.get("description") or "")
    return match.group(1) if match else None


def public_incident(incident: dict) -> dict:
    description = incident.get("description") or ""
    photo = incident.get("photo_url")
    return {
        "id": incident.get("id"),
        "tracking_code": tracking_code_of(incident),
        "category": incident.get("category"),
        "status": incident.get("status"),
        "assigned_vehicle": assigned_vehicle(description),
        "display_status": citizen_status(incident.get("status"), assigned_vehicle(description)),
        "description": description,
        "public_description": TRACKING_RE.sub("", description).replace(f"[VEH:{assigned_vehicle(description) or ''}]", "").strip(),
        "latitude": incident.get("latitude"),
        "longitude": incident.get("longitude"),
        "created_at": incident.get("created_at"),
        "has_photo": bool(photo),
    }


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
    code = new_tracking_code()
    record = payload.model_dump()
    record["description"] = f"[{code}] {record['description'].strip()}"[:500]
    try:
        try:
            response = supabase.table("citizen_incidents").insert({**record, "tracking_code": code}).execute()
        except Exception:
            response = supabase.table("citizen_incidents").insert(record).execute()
        saved = response.data[0]
        publish_event("incident.reported", public_incident(saved), "incident.reported")
        return {"data": public_incident(saved), "tracking_code": code}
    except Exception as error:
        raise HTTPException(status_code=400, detail="No se pudo registrar la incidencia") from error


@app.get("/incidents/track/{code}")
def track_incident(code: str):
    wanted = code.strip().upper().strip("[]")
    if not re.fullmatch(r"RAD-[A-Z0-9]{6}", wanted):
        raise HTTPException(status_code=422, detail="El radicado debe verse como RAD-7K2M9Q")
    rows = (
        supabase.table("citizen_incidents")
        .select("id,category,description,status,latitude,longitude,created_at,photo_url")
        .order("created_at", desc=True)
        .limit(200)
        .execute()
        .data
    )
    found = next((item for item in rows if tracking_code_of(item) == wanted), None)
    if not found:
        raise HTTPException(status_code=404, detail="No encontramos ese radicado")
    return {"data": public_incident(found)}


@app.get("/incidents")
def list_incidents(status: str | None = None):
    query = supabase.table("citizen_incidents").select("*").order("created_at", desc=True)
    if status:
        query = query.eq("status", status)
    return {"data": query.execute().data}


@app.patch("/incidents/{incident_id}/assign")
def assign_incident(incident_id: str, vehicle: str):
    plate = vehicle.strip().upper()
    if not re.fullmatch(r"[A-Z0-9-]{2,16}", plate):
        raise HTTPException(status_code=422, detail="La placa no es válida")
    current = supabase.table("citizen_incidents").select("id,description,status").eq("id", incident_id).limit(1).execute().data
    if not current:
        raise HTTPException(status_code=404, detail="No encontramos esa solicitud")
    updated = (
        supabase.table("citizen_incidents")
        .update({"status": "assigned", "description": with_vehicle(current[0].get("description"), plate)})
        .eq("id", incident_id)
        .execute()
    )
    return {"data": public_incident(updated.data[0])}


@app.patch("/incidents/{incident_id}/status")
def update_incident(incident_id: str, status: str):
    if status not in {"reported", "assigned", "resolved", "rejected"}:
        raise HTTPException(status_code=422, detail="Estado de incidencia no válido")
    response = supabase.table("citizen_incidents").update({"status": status}).eq("id", incident_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")
    publish_event("incident.status.changed", response.data[0], "incident.status.changed")
    return {"data": response.data[0]}
