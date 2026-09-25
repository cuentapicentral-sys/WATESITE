import os
import threading
import time
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from services.database import supabase
from services.events import consume_events

app = FastAPI(title="WasteWise Municipal Analytics Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

latest_kpis = {}
refresh_lock = threading.Lock()


def calculate_kpis():
    containers = supabase.table("containers").select("fill_level,status").execute().data
    routes = supabase.table("routes").select("status").execute().data
    vehicles = supabase.table("vehicles").select("load_level").execute().data
    citizens = supabase.table("citizens").select("points").execute().data
    try:
        incidents = supabase.table("citizen_incidents").select("status").execute().data
    except Exception:
        incidents = []
    return {
        "volume": {"containers": len(containers), "critical_containers": sum(item["status"] == "critical" for item in containers)},
        "operations": {"routes": len(routes), "active_routes": sum(item["status"] == "in_progress" for item in routes), "vehicles": len(vehicles)},
        "citizen_impact": {"citizens": len(citizens), "points": sum(item["points"] for item in citizens), "incidents_resolved": sum(item["status"] == "resolved" for item in incidents)},
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def refresh_kpis():
    global latest_kpis
    with refresh_lock:
        latest_kpis = calculate_kpis()


def handle_operational_event(event: dict) -> None:
    refresh_kpis()


def periodic_refresh():
    interval = max(30, int(os.getenv("ANALYTICS_REFRESH_SECONDS", "300")))
    while True:
        refresh_kpis()
        time.sleep(interval)


@app.on_event("startup")
def start_analytics_workers():
    refresh_kpis()
    threading.Thread(target=periodic_refresh, name="analytics-etl", daemon=True).start()
    consume_events("analytics-events", ["container.fill_level.updated", "route.generated", "fleet.vehicle.registered", "recycling.verified", "incident.status.changed"], handle_operational_event)


@app.get("/health")
def health():
    return {"status": "ok", "service": "analytics-service"}


@app.get("/kpis")
def municipal_kpis():
    if not latest_kpis:
        refresh_kpis()
    return latest_kpis
