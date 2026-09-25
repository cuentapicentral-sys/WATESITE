import hashlib

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from backend.supabase_client import supabase

router = APIRouter(prefix="/api", tags=["supabase"])


class ContainerPayload(BaseModel):
    code: str = Field(min_length=1, max_length=40)
    zone: str = Field(min_length=1, max_length=80)
    fill_level: int = Field(default=0, ge=0, le=100)
    status: str = Field(default="normal", min_length=1, max_length=30)


class RegisterPayload(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=128)
    role: str = Field(default="operator", min_length=1, max_length=32)


class LoginPayload(BaseModel):
    email: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=128)


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


@router.post("/auth/register")
async def register_profile(payload: RegisterPayload):
    email = payload.email.strip().lower()
    existing = supabase.table("profiles").select("id").eq("email", email).limit(1).execute().data
    if existing:
        raise HTTPException(status_code=409, detail="Ya existe una cuenta con este correo.")

    profile = {
        "email": email,
        "full_name": payload.name.strip(),
        "role": payload.role or "operator",
        "password_hash": hash_password(payload.password),
    }

    response = supabase.table("profiles").insert(profile).execute()
    saved = response.data[0]
    return {
        "user": {
            "name": saved.get("full_name") or email,
            "email": saved.get("email"),
            "role": saved.get("role", "operator"),
        }
    }


@router.post("/auth/login")
async def login_profile(payload: LoginPayload):
    email = payload.email.strip().lower()
    user = supabase.table("profiles").select("*").eq("email", email).limit(1).execute().data
    if not user:
        raise HTTPException(status_code=401, detail="El correo o la contraseña no son correctos.")

    stored = user[0]
    if stored.get("password_hash") != hash_password(payload.password):
        raise HTTPException(status_code=401, detail="El correo o la contraseña no son correctos.")

    return {
        "user": {
            "name": stored.get("full_name") or email,
            "email": stored.get("email"),
            "role": stored.get("role", "operator"),
        }
    }


@router.get("/supabase/containers")
async def get_supabase_containers():
    response = supabase.table("containers").select("*").execute()
    return {"data": response.data}


@router.post("/supabase/containers")
async def create_supabase_container(payload: ContainerPayload):
    try:
        response = supabase.table("containers").insert(payload.model_dump()).execute()
        return {"data": response.data[0]}
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.patch("/supabase/containers/{container_id}")
async def update_supabase_container(container_id: str, payload: ContainerPayload):
    try:
        response = supabase.table("containers").update(payload.model_dump()).eq("id", container_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Contenedor no encontrado")
        return {"data": response.data[0]}
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.delete("/supabase/containers/{container_id}")
async def delete_supabase_container(container_id: str):
    try:
        response = supabase.table("containers").delete().eq("id", container_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Contenedor no encontrado")
        return {"deleted": response.data[0]["id"]}
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/supabase/routes")
async def get_supabase_routes():
    response = supabase.table("routes").select("*").execute()
    return {"data": response.data}


@router.get("/supabase/alerts")
async def get_supabase_alerts():
    response = supabase.table("alerts").select("*").execute()
    return {"data": response.data}
