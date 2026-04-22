"""ERPNext credentials management routes (per-user)."""

import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.dependencies import get_current_user
from app.db.models import User

router = APIRouter(prefix="/api/erpnext", tags=["erpnext"])


class ErpnextCredentials(BaseModel):
    url: Optional[str] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None


def get_env_file(user_id: str) -> Path:
    """Get the per-user ERPNext credentials file path."""
    data_dir = Path(os.environ.get("PLATFORM_CONTAINER_DATA_DIR", "/data/openclaw-users"))
    return data_dir / f".env.erpnext.{user_id}"


@router.get("/credentials")
async def get_credentials(user: User = Depends(get_current_user)) -> ErpnextCredentials:
    """Read current user's ERPNext credentials."""
    env_file = get_env_file(user.id)

    if not env_file.exists():
        return ErpnextCredentials()

    content = env_file.read_text(encoding="utf-8")
    result = {}

    for line in content.split("\n"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if key == "ERPNEXT_URL":
            result["url"] = value
        elif key == "ERPNEXT_API_KEY":
            result["api_key"] = value
        elif key == "ERPNEXT_API_SECRET":
            result["api_secret"] = value

    return ErpnextCredentials(**result)


@router.put("/credentials")
async def save_credentials(
    credentials: ErpnextCredentials,
    user: User = Depends(get_current_user),
) -> dict:
    """Save current user's ERPNext credentials."""
    env_file = get_env_file(user.id)
    env_file.parent.mkdir(parents=True, exist_ok=True)

    lines = ["# SCMClaw ERPNext Credentials (per-user, auto-generated)"]
    if credentials.url:
        lines.append(f"ERPNEXT_URL={credentials.url}")
    if credentials.api_key:
        lines.append(f"ERPNEXT_API_KEY={credentials.api_key}")
    if credentials.api_secret:
        lines.append(f"ERPNEXT_API_SECRET={credentials.api_secret}")

    env_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return {"ok": True}


@router.delete("/credentials")
async def delete_credentials(user: User = Depends(get_current_user)) -> dict:
    """Delete current user's ERPNext credentials."""
    env_file = get_env_file(user.id)
    if env_file.exists():
        env_file.unlink()
    return {"ok": True}
