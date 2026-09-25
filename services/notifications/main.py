from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.database import supabase
from services.events import consume_events, publish_event

app = FastAPI(title="WasteWise Notification Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def handle_operational_event(event: dict) -> None:
    event_type = event.get("event_type", "operational.event")
    payload = event.get("payload", {})
    if event_type == "container.critical":
        title = "Contenedor crítico"
        description = f"{payload.get('code', 'Contenedor')} alcanzó {payload.get('fill_level', '?')}% de llenado."
        severity = "high"
    else:
        title = "Nueva incidencia ciudadana"
        description = payload.get("description", "Se registró una nueva incidencia ciudadana.")
        severity = "medium"
    supabase.table("alerts").insert({"title": title, "description": description, "severity": severity}).execute()


@app.on_event("startup")
def start_event_consumer():
    consume_events("notification-service-events", ["container.critical", "incident.reported"], handle_operational_event)


class NotificationPayload(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    message: str = Field(min_length=5, max_length=500)
    severity: str = Field(default="medium", pattern="^(low|medium|high|critical)$")


@app.get("/health")
def health():
    return {"status": "ok", "service": "notification-service"}


@app.post("/notifications", status_code=201)
def publish_notification(payload: NotificationPayload):
    try:
        response = supabase.table("alerts").insert({"title": payload.title, "description": payload.message, "severity": payload.severity}).execute()
        publish_event("notification.published", response.data[0], "notification.published")
        return {"data": response.data[0], "channels": ["dashboard", "operator_feed"]}
    except Exception as error:
        raise HTTPException(status_code=400, detail="No se pudo publicar la notificación") from error


@app.get("/notifications")
def list_notifications(severity: str | None = None):
    query = supabase.table("alerts").select("*").order("created_at", desc=True)
    if severity:
        query = query.eq("severity", severity)
    return {"data": query.execute().data}
