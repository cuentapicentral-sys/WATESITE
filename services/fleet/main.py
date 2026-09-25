from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.database import supabase
from services.events import publish_event

app = FastAPI(title="WasteWise Fleet Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class VehiclePayload(BaseModel):
    plate: str = Field(min_length=2, max_length=30)
    type: str = Field(min_length=2, max_length=80)
    state: str = Field(default="operativo", pattern="^(operativo|en_ruta|revision|fuera_de_servicio)$")
    load_level: int = Field(default=0, ge=0, le=100)
    driver_name: str | None = None


@app.get("/health")
def health():
    return {"status": "ok", "service": "fleet-service"}


@app.get("/fleet")
def list_vehicles():
    try:
        response = supabase.table("vehicles").select("*").execute()
        return {"data": response.data}
    except Exception as error:
        raise HTTPException(status_code=502, detail="No se pudo consultar la flota") from error


@app.post("/fleet/vehicles", status_code=201)
def register_vehicle(payload: VehiclePayload):
    vehicle = payload.model_dump(exclude_none=True)
    try:
        response = supabase.table("vehicles").insert(vehicle).execute()
        publish_event("fleet.vehicle.registered", response.data[0], "fleet.vehicle.registered")
        return {"data": response.data[0]}
    except Exception as error:
        if "duplicate key" in str(error).lower() or "23505" in str(error):
            raise HTTPException(status_code=409, detail="Ya existe un vehículo con esa matrícula") from error

        # Compatibilidad con tablas creadas antes de añadir driver_name y los estados normalizados.
        legacy_vehicle = {**vehicle, "state": {"en_ruta": "en ruta", "revision": "en revisión", "fuera_de_servicio": "fuera de servicio"}.get(vehicle["state"], vehicle["state"])}
        legacy_vehicle.pop("driver_name", None)
        try:
            response = supabase.table("vehicles").insert(legacy_vehicle).execute()
            publish_event("fleet.vehicle.registered", response.data[0], "fleet.vehicle.registered")
            return {"data": response.data[0]}
        except Exception as legacy_error:
            if "duplicate key" in str(legacy_error).lower() or "23505" in str(legacy_error):
                raise HTTPException(status_code=409, detail="Ya existe un vehículo con esa matrícula") from legacy_error
            raise HTTPException(status_code=400, detail="No se pudo registrar el vehículo") from legacy_error


@app.patch("/fleet/vehicles/{vehicle_id}/state")
def update_vehicle_state(vehicle_id: str, state: str):
    if state not in {"operativo", "en_ruta", "revision", "fuera_de_servicio"}:
        raise HTTPException(status_code=422, detail="Estado de vehículo no válido")
    response = supabase.table("vehicles").update({"state": state}).eq("id", vehicle_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")
    return {"data": response.data[0]}