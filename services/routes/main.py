from datetime import datetime, timedelta
import unicodedata

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.database import supabase
from services.events import consume_events, publish_event
from services.notifications.logic import create_notification
from services.routes.dijkstra import DEPOT, plan_collection
from services.routes.optimization import prioritize_containers

app = FastAPI(title="WasteWise Route Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class OptimizationRequest(BaseModel):
    zone: str | None = None
    max_stops: int = Field(default=10, ge=1, le=50)


def select_available_vehicle(vehicles: list[dict], busy_vehicle_ids: set[str] | None = None) -> dict | None:
    busy = busy_vehicle_ids or set()
    available = []
    for vehicle in vehicles:
        vehicle_id = str(vehicle.get("id") or "")
        state = str(vehicle.get("state") or "").strip().lower().replace(" ", "_")
        vehicle_type = unicodedata.normalize("NFKD", str(vehicle.get("type") or ""))
        vehicle_type = vehicle_type.encode("ascii", "ignore").decode().lower()
        compatible = any(kind in vehicle_type for kind in ("camion", "vehiculo", "furgon"))
        if state == "operativo" and vehicle_id not in busy and compatible:
            available.append(vehicle)
    return min(available, key=lambda vehicle: (int(vehicle.get("load_level") or 0), str(vehicle.get("plate") or ""))) if available else None


def generate_priority_route(zone: str | None, max_stops: int):
    query = supabase.table("containers").select("code,zone,fill_level,latitude,longitude").gte("fill_level", 70)
    if zone:
        query = query.eq("zone", zone)
    containers = prioritize_containers(query.execute().data, zone, max_stops)
    if not containers:
        return {"status": "no_stops", "stops": [], "path": [], "algorithm": "dijkstra", "message": "No hay contenedores prioritarios"}

    plan = plan_collection(DEPOT, containers)
    area = zone or containers[0]["zone"]
    existing = supabase.table("routes").select("route_code").eq("area", area).in_("status", ["scheduled", "in_progress"]).limit(1).execute().data
    if existing:
        return {"status": "already_scheduled", "stops": plan["stops"], "path": plan["path"], "distance_km": round(plan["distance_km"], 2), "algorithm": "dijkstra", "message": f"Ya existe una ruta activa para {area}"}

    vehicles = supabase.table("vehicles").select("id,plate,type,state,load_level").execute().data or []
    active_routes = supabase.table("routes").select("vehicle_id").in_("status", ["scheduled", "in_progress"]).execute().data or []
    busy_vehicle_ids = {str(route["vehicle_id"]) for route in active_routes if route.get("vehicle_id")}
    vehicle = select_available_vehicle(vehicles, busy_vehicle_ids)
    if not vehicle:
        return {"status": "no_vehicle", "stops": plan["stops"], "path": plan["path"], "distance_km": round(plan["distance_km"], 2), "algorithm": "dijkstra", "message": "No hay un camión operativo y disponible para esta ruta"}

    vehicle_update = supabase.table("vehicles").update({"state": "en_ruta"}).eq("id", vehicle["id"]).eq("state", vehicle["state"]).execute().data
    if not vehicle_update:
        return {"status": "no_vehicle", "stops": plan["stops"], "path": plan["path"], "distance_km": round(plan["distance_km"], 2), "algorithm": "dijkstra", "message": "El vehículo dejó de estar disponible; actualiza e inténtalo otra vez"}

    route = {
        "route_code": f"OPT-{datetime.now().strftime('%H%M%S')}",
        "area": area,
        "eta": (datetime.now() + timedelta(minutes=20)).strftime('%H:%M'),
        "status": "in_progress",
        "vehicle_id": vehicle["id"],
        "vehicle_plate": vehicle["plate"],
    }
    try:
        response = supabase.table("routes").insert(route).execute()
    except Exception:
        supabase.table("vehicles").update({"state": vehicle["state"]}).eq("id", vehicle["id"]).execute()
        raise
    created_route = response.data[0]
    create_notification(
        supabase,
        "Vehículo en ruta",
        f"{vehicle['plate']} inició la ruta {created_route['route_code']} en {area} con {len(plan['stops'])} paradas.",
        "medium",
    )
    publish_event("route.generated", {"route": created_route, "stops": plan["stops"], "algorithm": "dijkstra"}, "route.generated")
    return {"status": "optimized", "route": created_route, "stops": plan["stops"], "path": plan["path"], "distance_km": round(plan["distance_km"], 2), "algorithm": "dijkstra", "distance_strategy": "camino mínimo de Dijkstra sobre la malla vial de Montería"}


def handle_fill_level_event(event: dict) -> None:
    payload = event.get("payload", {})
    if payload.get("fill_level", 0) >= 70:
        generate_priority_route(payload.get("zone"), 10)


@app.on_event("startup")
def start_route_consumer():
    consume_events("route-optimization-events", ["container.fill_level.updated"], handle_fill_level_event)


@app.get("/health")
def health():
    return {"status": "ok", "service": "route-service"}


@app.get("/routes")
def list_routes():
    try:
        response = supabase.table("routes").select("*").execute()
        return {"data": response.data}
    except Exception as error:
        raise HTTPException(status_code=502, detail="No se pudieron consultar las rutas") from error


@app.post("/routes/optimize")
def optimize_route(request: OptimizationRequest):
    return generate_priority_route(request.zone, request.max_stops)


@app.patch("/routes/{route_code}/complete")
def complete_route(route_code: str):
    rows = supabase.table("routes").select("*").eq("route_code", route_code).limit(1).execute().data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Ruta no encontrada")
    route = rows[0]
    if route.get("status") == "completed":
        raise HTTPException(status_code=409, detail="La ruta ya fue finalizada")

    updated = supabase.table("routes").update({"status": "completed"}).eq("id", route["id"]).execute().data[0]
    vehicle_id = route.get("vehicle_id")
    if vehicle_id:
        supabase.table("vehicles").update({"state": "operativo"}).eq("id", vehicle_id).eq("state", "en_ruta").execute()
        create_notification(
            supabase,
            "Ruta completada",
            f"{route.get('vehicle_plate') or 'El vehículo'} finalizó la ruta {route_code} en {route.get('area') or 'su zona'} y quedó disponible.",
            "low",
        )
    publish_event("route.completed", updated, "route.completed")
    return {"data": updated}