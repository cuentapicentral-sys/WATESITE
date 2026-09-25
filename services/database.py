import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

project_root = Path(__file__).resolve().parent.parent
candidate_files = [project_root / ".env", project_root / "backend" / ".env"]
for env_file in candidate_files:
    if env_file.exists():
        load_dotenv(env_file)

supabase_url = os.getenv("SUPABASE_URL")
supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase_key = os.getenv("SUPABASE_KEY")

key = supabase_service_role_key or supabase_key

if not supabase_url or not key:
    raise RuntimeError("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY/SUPABASE_KEY en el archivo .env")

supabase_url = supabase_url.removesuffix("/rest/v1/").removesuffix("/rest/v1").rstrip("/")
supabase = create_client(supabase_url, key)