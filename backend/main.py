import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.supabase_routes import router as supabase_router
from backend.supabase_client import supabase
from services.containers.main import normalize_container_type
from services.fieldwork import route_eta_for
from services.operations import operational_snapshot


@asynccontextmanager
async def lifespan(_app):
    stop = asyncio.Event()

    async def sensor_cycle_loop():
        while not stop.is_set():
            try:
                from services.database import supabase as sensor_db
                from services.sensors.cycle import apply_sensor_cycle

                await asyncio.to_thread(apply_sensor_cycle, sensor_db)
            except Exception as exc:
                print(f"Ciclo de sensores omitido: {exc}")
            try:
                await asyncio.wait_for(stop.wait(), timeout=300)
            except TimeoutError:
                continue

    task = asyncio.create_task(sensor_cycle_loop())
    yield
    stop.set()
    await asyncio.gather(task, return_exceptions=True)


app = FastAPI(title="WasteWise API", version="1.0.0", lifespan=lifespan)
app.include_router(supabase_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def safe_supabase_query(table_name: str, select_fields: str, fallback):
    try:
        data = supabase.table(table_name).select(select_fields).execute().data
        return data if data is not None else fallback
    except Exception as exc:  # pragma: no cover - defensive fallback for transient network/Supabase issues
        print(f"Supabase fallback activated for {table_name}: {exc}")
        return fallback


def build_dashboard_data():
    containers = safe_supabase_query(
        "containers",
        "id,code,zone,container_type,fill_level,status,latitude,longitude",
        [],
    )
    routes_data = safe_supabase_query(
        "routes",
        "route_code,area,eta,status",
        [],
    )
    alerts_data = safe_supabase_query(
        "alerts",
        "title,description,severity,created_at",
        [],
    )
    vehicles = safe_supabase_query(
        "vehicles",
        "plate,type,state,load_level",
        [],
    )
    citizens = safe_supabase_query(
        "citizens",
        "name,points",
        [],
    )
    rewards = safe_supabase_query("rewards", "id,status", [])
    incidents = safe_supabase_query("citizen_incidents", "status,category,description", [])
    type_counts = {"organica": 0, "reciclable": 0, "general": 0, "vidrio": 0}
    for container in containers:
        type_counts[normalize_container_type(container.get("container_type") or container.get("type"))] += 1

    zones_map = {}
    for container in containers:
        zone = str(container.get("zone") or "Sin zona")
        bucket = zones_map.setdefault(zone, {"fills": [], "status": "Normal"})
        bucket["fills"].append(int(container.get("fill_level") or 0))
        if str(container.get("status") or "").lower() in {"critical", "urgente", "alerta"}:
            bucket["status"] = "Alerta"

    zones = []
    for zone, data in zones_map.items():
        fills = data["fills"]
        fill_value = round(sum(fills) / len(fills)) if fills else 0
        zones.append({
            "name": zone,
            "fill": fill_value,
            "trucks": max(1, len([vehicle for vehicle in vehicles if str(vehicle.get("state") or "").lower() in {"operativo", "en_ruta"}])) if vehicles else 1,
            "status": data["status"],
        })

    route_entries = []
    for route in routes_data:
        area = route.get("area") or "General"
        zone_containers = [item for item in containers if str(item.get("zone") or "") == str(area)]
        eta = route.get("eta") or route_eta_for(area, len(zone_containers), str(route.get("status") or "").lower() == "urgent")
        route_entries.append({
            "route": route.get("route_code") or f"R-{len(route_entries) + 1:03d}",
            "area": area,
            "eta": eta,
            "status": str(route.get("status") or "scheduled").replace("in_progress", "En progreso").replace("urgent", "Urgente").replace("scheduled", "Programada"),
            "color": "red" if str(route.get("status") or "").lower() == "urgent" else "green" if str(route.get("status") or "").lower() == "in_progress" else "blue",
        })

    alerts = [
        f"{alert.get('title') or 'Alerta'}: {alert.get('description') or 'Sin detalle'}"
        for alert in alerts_data
    ] or ["Sin alertas nuevas registradas en esta jornada."]

    critical_count = sum(1 for item in containers if str(item.get("status") or "").lower() in {"critical", "urgente", "alerta"} or int(item.get("fill_level") or 0) >= 90)
    total_points = sum(int(citizen.get("points") or 0) for citizen in citizens)
    pending_rewards = sum(1 for reward in rewards if str(reward.get("status") or "").lower() in {"pending", "pending_review", "pending_delivery"})

    return {
        "stats": [
            {"label": "Contenedores activos", "value": str(len(containers)), "change": "En vivo", "tone": "positive"},
            {"label": "Puntos en circulación", "value": str(total_points), "change": "Ciudadanía", "tone": "positive"},
            {"label": "Rutas en curso", "value": str(sum(1 for item in routes_data if str(item.get("status") or "").lower() == "in_progress")), "change": "Operación", "tone": "neutral"},
            {"label": "Alertas críticas", "value": str(critical_count), "change": "Monitoreo", "tone": "negative"},
        ],
        "containers": containers,
        "zones": zones,
        "routes": route_entries,
        "alerts": alerts,
        "container_types": type_counts,
        "kpis": [
            {"label": "Premios pendientes", "value": str(pending_rewards)},
            {"label": "Incidencias abiertas", "value": str(sum(1 for item in incidents if str(item.get("status") or "").lower() in {"reported", "assigned"}))},
            {"label": "Ciudadanos activos", "value": str(len(citizens))},
        ],
    }


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "WasteWise API"}


@app.get("/api/day-close")
def day_close():
    from services.fieldwork import build_day_close

    alerts = safe_supabase_query("alerts", "title,description,created_at", [])
    incidents = safe_supabase_query("citizen_incidents", "status,category,created_at", [])
    citizens = safe_supabase_query("citizens", "points", [])
    return build_day_close(alerts, incidents, citizens)


@app.get("/api/analytics")
def municipal_analytics():
    from services.analytics.report import municipal_report

    containers = safe_supabase_query("containers", "code,zone,fill_level,status,latitude,longitude", [])
    routes = safe_supabase_query("routes", "status,area", [])
    vehicles = safe_supabase_query("vehicles", "state,plate", [])
    incidents = safe_supabase_query("citizen_incidents", "status,category,description,latitude,longitude,created_at", [])
    citizens = safe_supabase_query("citizens", "points", [])
    alerts = safe_supabase_query("alerts", "title,description,created_at", [])
    return municipal_report(containers, routes, vehicles, incidents, citizens, alerts)


@app.get("/api/dashboard")
def dashboard():
    data = build_dashboard_data()
    containers = safe_supabase_query(
        "containers",
        "id,code,zone,container_type,fill_level,status,latitude,longitude",
        [],
    )
    routes_data = safe_supabase_query(
        "routes",
        "route_code,area,eta,status",
        [],
    )
    vehicles = safe_supabase_query(
        "vehicles",
        "plate,type,state,load_level",
        [],
    )
    incidents = safe_supabase_query("citizen_incidents", "status", [])
    operations = operational_snapshot(containers, routes_data, vehicles, incidents)

    data["operations"] = operations
    data["kpis"] = [
        {"label": "Contenedores críticos", "value": str(operations["critical_containers"])},
        {"label": "Kilos por recoger", "value": str(operations["pending_kg"])},
        {"label": "Incidencias abiertas", "value": str(operations["open_incidents"])},
    ]
    return data


@app.get("/api/containers")
def containers():
    return {
        "containers": [
            {"id": "C-240", "zone": "Centro", "fill": 92, "status": "critical"},
            {"id": "C-155", "zone": "Norte", "fill": 64, "status": "normal"},
            {"id": "C-311", "zone": "Sur", "fill": 88, "status": "critical"},
            {"id": "C-178", "zone": "Este", "fill": 54, "status": "normal"},
        ]
    }


@app.get("/api/routes")
def routes():
    return build_dashboard_data()["routes"]


@app.get("/api/alerts")
def alerts():
    return {"alerts": build_dashboard_data()["alerts"]}
