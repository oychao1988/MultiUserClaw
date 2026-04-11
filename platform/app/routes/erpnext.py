"""ERPNext credentials management routes."""

import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/erpnext", tags=["erpnext"])


class ErpnextCredentials(BaseModel):
    url: Optional[str] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None


def get_openclaw_home() -> Path:
    """Get the OpenClaw home directory."""
    return Path(os.environ.get("OPENCLAW_HOME", Path.home() / ".openclaw"))


def get_env_file() -> Path:
    """Get the ERPNext credentials file path.

    使用 /data/openclaw-users/.env.erpnext，与 userdata 卷挂载一致。
    """
    return Path("/data/openclaw-users/.env.erpnext")


@router.get("/credentials")
async def get_credentials() -> ErpnextCredentials:
    """Read current credentials from ~/.openclaw/.env.erpnext"""
    env_file = get_env_file()

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
async def save_credentials(credentials: ErpnextCredentials) -> dict:
    """Save credentials to ~/.openclaw/.env.erpnext"""
    openclaw_home = get_openclaw_home()
    env_file = get_env_file()

    # Ensure directory exists
    openclaw_home.mkdir(parents=True, exist_ok=True)

    lines = ["# SCMClaw ERPNext Credentials (auto-generated, do not edit manually)"]

    if credentials.url:
        lines.append(f"ERPNEXT_URL={credentials.url}")
    if credentials.api_key:
        lines.append(f"ERPNEXT_API_KEY={credentials.api_key}")
    if credentials.api_secret:
        lines.append(f"ERPNEXT_API_SECRET={credentials.api_secret}")

    env_file.write_text("\n".join(lines) + "\n", encoding="utf-8")

    return {"ok": True}


@router.delete("/credentials")
async def delete_credentials() -> dict:
    """Delete ~/.openclaw/.env.erpnext"""
    env_file = get_env_file()

    if env_file.exists():
        env_file.unlink()

    return {"ok": True}
