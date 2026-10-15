from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.database import supabase
from services.events import publish_event
from services.notifications.logic import create_notification

app = FastAPI(title="WasteWise Notification Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
        notification = create_notification(supabase, payload.title, payload.message, payload.severity)
        if not notification:
            raise RuntimeError("Notification was not persisted")
        publish_event("notification.published", notification, "notification.published")
        return {"data": notification, "channels": ["dashboard", "operator_feed"]}
    except Exception as error:
        raise HTTPException(status_code=400, detail="No se pudo publicar la notificación") from error


@app.get("/notifications")
def list_notifications(severity: str | None = None):
    query = supabase.table("alerts").select("*").order("created_at", desc=True)
    if severity:
        query = query.eq("severity", severity)
    return {"data": query.execute().data}
