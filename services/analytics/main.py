import os
import threading
import time

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
    from services.analytics.report import municipal_report

    containers = supabase.table("containers").select("code,zone,fill_level,status,latitude,longitude").execute().data
    routes = supabase.table("routes").select("status,area").execute().data
    vehicles = supabase.table("vehicles").select("state,plate").execute().data
    citizens = supabase.table("citizens").select("points").execute().data
    try:
        incidents = supabase.table("citizen_incidents").select("status,category,description,latitude,longitude,created_at").execute().data
    except Exception:
        incidents = []
    try:
        alerts = supabase.table("alerts").select("title,description,created_at").execute().data
    except Exception:
        alerts = []
    return municipal_report(containers, routes, vehicles, incidents, citizens, alerts)


def refresh_kpis():
    global latest_kpis
    try:
        report = calculate_kpis()
    except Exception:
        report = latest_kpis or {"summary": {}, "zones": [], "week": [], "decisions": []}
    with refresh_lock:
        latest_kpis = report


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
