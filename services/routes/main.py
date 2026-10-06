from datetime import datetime, timedelta

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.database import supabase
from services.events import consume_events, publish_event
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

    route = {"route_code": f"OPT-{datetime.now().strftime('%H%M%S')}", "area": area, "eta": (datetime.now() + timedelta(minutes=20)).strftime('%H:%M'), "status": "scheduled"}
    response = supabase.table("routes").insert(route).execute()
    publish_event("route.generated", {"route": response.data[0], "stops": plan["stops"], "algorithm": "dijkstra"}, "route.generated")
    return {"status": "optimized", "route": response.data[0], "stops": plan["stops"], "path": plan["path"], "distance_km": round(plan["distance_km"], 2), "algorithm": "dijkstra", "distance_strategy": "camino mínimo de Dijkstra sobre la malla vial de Montería"}


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