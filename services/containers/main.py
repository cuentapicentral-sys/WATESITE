from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.database import supabase

app = FastAPI(title="WasteWise Container Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ContainerPayload(BaseModel):
    code: str = Field(min_length=2, max_length=40)
    zone: str = Field(min_length=2, max_length=80)
    latitude: float | None = None
    longitude: float | None = None
    fill_level: int = Field(default=0, ge=0, le=100)
    status: str = Field(default="normal", pattern="^(normal|attention|critical)$")


@app.get("/health")
def health():
    return {"status": "ok", "service": "container-service"}


@app.get("/containers")
def list_containers():
    try:
        response = supabase.table("containers").select("*").execute()
        return {"data": response.data}
    except Exception as error:
        raise HTTPException(status_code=502, detail="No se pudieron consultar los contenedores") from error


@app.post("/containers", status_code=201)
def create_container(payload: ContainerPayload):
    try:
        response = supabase.table("containers").insert(payload.model_dump()).execute()
        return {"data": response.data[0]}
    except Exception as error:
        raise HTTPException(status_code=400, detail="No se pudo registrar el contenedor") from error


@app.get("/containers/critical")
def critical_containers():
    response = supabase.table("containers").select("*").in_("status", ["attention", "critical"]).order("fill_level", desc=True).execute()
    return {"data": response.data}