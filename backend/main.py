import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.supabase_routes import router as supabase_router
from backend.supabase_client import supabase


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
    return {
        "stats": [
            {"label": "Contenedores activos", "value": "1,284", "change": "+8.4%", "tone": "positive"},
            {"label": "Reciclaje hoy", "value": "68.2%", "change": "+5.1%", "tone": "positive"},
            {"label": "Rutas en curso", "value": "42", "change": "-3.2%", "tone": "neutral"},
            {"label": "Alertas críticas", "value": "17", "change": "-12%", "tone": "negative"},
        ],
        "zones": [
            {"name": "Centro", "fill": 82, "trucks": 9, "status": "Alerta"},
            {"name": "Norte", "fill": 64, "trucks": 7, "status": "Normal"},
            {"name": "Sur", "fill": 89, "trucks": 10, "status": "Alerta"},
            {"name": "Este", "fill": 54, "trucks": 6, "status": "Normal"},
            {"name": "Oeste", "fill": 71, "trucks": 8, "status": "Atento"},
        ],
        "routes": [
            {"route": "R-204", "area": "Centro", "eta": "08:40", "status": "En progreso", "color": "green"},
            {"route": "R-118", "area": "Norte", "eta": "09:15", "status": "Programada", "color": "blue"},
            {"route": "R-330", "area": "Sur", "eta": "09:45", "status": "Urgente", "color": "red"},
            {"route": "R-077", "area": "Este", "eta": "10:10", "status": "En progreso", "color": "green"},
        ],
        "alerts": [
            "Contenedor C-240 con nivel de llenado superior al 90%.",
            "Ruta R-330 reprogramada por tráfico en Avenida Principal.",
            "6 ciudadanos registrados en programa de reciclaje hoy.",
            "Mantenimiento programado para 2 camiones de recolección.",
        ],
        "kpis": [
            {"label": "Kg reciclados", "value": "18,420"},
            {"label": "Coste por ruta", "value": "$1,240"},
            {"label": "Tiempo medio", "value": "42 min"},
        ],
    }


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "WasteWise API"}


@app.get("/api/dashboard")
def dashboard():
    containers = safe_supabase_query(
        "containers",
        "id,code,zone,fill_level,status,latitude,longitude",
        [
            {"id": 1, "code": "C-240", "zone": "Centro", "fill_level": 92, "status": "critical", "latitude": 8.7526, "longitude": -75.8812},
            {"id": 2, "code": "C-155", "zone": "Norte", "fill_level": 64, "status": "normal", "latitude": 8.7784, "longitude": -75.8608},
            {"id": 3, "code": "C-311", "zone": "Sur", "fill_level": 88, "status": "critical", "latitude": 8.7242, "longitude": -75.8874},
            {"id": 4, "code": "C-178", "zone": "Este", "fill_level": 54, "status": "normal", "latitude": 8.7504, "longitude": -75.8518},
        ],
    )
    routes_data = safe_supabase_query(
        "routes",
        "route_code,area,eta,status",
        [
            {"route_code": "R-204", "area": "Centro", "eta": "08:40", "status": "in_progress"},
            {"route_code": "R-118", "area": "Norte", "eta": "09:15", "status": "scheduled"},
            {"route_code": "R-330", "area": "Sur", "eta": "09:45", "status": "urgent"},
        ],
    )
    alerts_data = safe_supabase_query(
        "alerts",
        "title,description,severity",
        [
            {"title": "Contenedor crítico", "description": "Nivel de llenado por encima del 90%.", "severity": "high"},
            {"title": "Ruta reprogramada", "description": "Tráfico en Avenida Principal.", "severity": "medium"},
        ],
    )
    vehicles = safe_supabase_query(
        "vehicles",
        "plate,type,state,load_level",
        [
            {"plate": "TR-01", "type": "Camión compactador", "state": "operativo", "load_level": 74},
            {"plate": "TR-12", "type": "Vehículo de reciclaje", "state": "en_ruta", "load_level": 58},
        ],
    )
    citizens = safe_supabase_query(
        "citizens",
        "name,points",
        [{"name": "Ana", "points": 420}, {"name": "Luis", "points": 260}],
    )
    rewards = safe_supabase_query("rewards", "id", [{"id": 1}, {"id": 2}])

    zones_by_name = {}
    for container in containers:
        zone = container["zone"]
        zone_data = zones_by_name.setdefault(zone, {"fills": [], "trucks": 0, "status": "Normal"})
        zone_data["fills"].append(container["fill_level"])
        zone_data["status"] = "Alerta" if container["status"] == "critical" else "Normal"

    zones = [
        {
            "name": zone,
            "fill": round(sum(data["fills"]) / len(data["fills"])),
            "trucks": data["trucks"],
            "status": data["status"],
        }
        for zone, data in zones_by_name.items()
    ]
    routes = [
        {
            "route": route["route_code"],
            "area": route["area"],
            "eta": route["eta"] or "Sin ETA",
            "status": route["status"],
            "color": "red" if route["status"] == "urgent" else "green" if route["status"] == "in_progress" else "blue",
        }
        for route in routes_data
    ]
    alerts = [
        f"{alert['title']}: {alert['description']}"
        for alert in alerts_data
    ]
    fleet = [
        {"id": vehicle["plate"], "type": vehicle["type"], "state": vehicle["state"], "load": f"{vehicle['load_level']}%"}
        for vehicle in vehicles
    ]
    citizen_summary = [
        {"label": "Participación ciudadana", "value": str(len(citizens))},
        {"label": "Puntos acumulados", "value": str(sum(citizen["points"] for citizen in citizens))},
        {"label": "Recompensas canjeadas", "value": str(len(rewards))},
    ]
    reports = [
        {"label": "Contenedores registrados", "value": str(len(containers))},
        {"label": "Vehículos registrados", "value": str(len(vehicles))},
        {"label": "Ciudadanos registrados", "value": str(len(citizens))},
    ]

    return {
        "stats": [
            {"label": "Contenedores activos", "value": str(len(containers)), "change": "Supabase", "tone": "positive"},
            {"label": "Zonas supervisadas", "value": str(len(zones)), "change": "En vivo", "tone": "positive"},
            {"label": "Rutas en curso", "value": str(sum(route["status"] == "in_progress" for route in routes_data)), "change": "Supabase", "tone": "neutral"},
            {"label": "Alertas críticas", "value": str(sum(alert["severity"] == "high" for alert in alerts_data)), "change": "En vivo", "tone": "negative"},
        ],
        "containers": containers,
        "zones": zones,
        "routes": routes,
        "alerts": alerts,
        "fleet": fleet,
        "citizens": citizen_summary,
        "reports": reports,
        "kpis": [
            {"label": "Contenedores críticos", "value": str(sum(container["status"] == "critical" for container in containers))},
            {"label": "Alertas registradas", "value": str(len(alerts_data))},
            {"label": "Rutas registradas", "value": str(len(routes_data))},
        ],
    }


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
