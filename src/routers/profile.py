"""User profile routes.

GET  /api/me               — return authenticated user's profile + favorites
PUT  /api/me/preferences   — update favorite_driver_code + favorite_team_id
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from typing import Optional

from src.middleware.auth0 import require_auth
from src.config import settings

router = APIRouter(tags=["Profile"])


@router.get("/auth0-config")
async def auth0_config():
    """Return non-sensitive Auth0 public config values for the SPA."""
    return {
        "domain":   settings.auth0_domain,
        "clientId": settings.auth0_client_id,
        "audience": settings.auth0_audience,
    }


class PreferencesUpdate(BaseModel):
    favorite_driver_code: Optional[str] = None
    favorite_team_id: Optional[str] = None
    onboarding_complete: bool = True


def _get_supabase():
    from supabase import create_client
    return create_client(settings.supabase_url, settings.supabase_key)


@router.get("/me")
async def get_me(request: Request, _user: dict = Depends(require_auth)):
    """Return the current user's profile. Creates a new profile row if first login."""
    sub = request.state.user_sub
    email = getattr(request.state, "user_email", "")

    sb = _get_supabase()
    result = sb.table("user_profiles").select("*").eq("auth0_sub", sub).maybe_single().execute()

    if result.data:
        return result.data

    # First login — insert a new profile row
    name = email.split("@")[0] if email else "F1 Fan"
    avatar = _user.get("picture", "")
    new_profile = {
        "auth0_sub": sub,
        "email": email,
        "display_name": _user.get("name", name),
        "avatar_url": avatar,
        "onboarding_complete": False,
    }
    insert_result = sb.table("user_profiles").insert(new_profile).execute()
    if not insert_result.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create profile")
    return insert_result.data[0]


@router.put("/me/preferences")
async def update_preferences(
    prefs: PreferencesUpdate,
    request: Request,
    _user: dict = Depends(require_auth),
):
    """Update favorite driver, favorite team, and onboarding status."""
    sub = request.state.user_sub
    sb = _get_supabase()

    update_data = {"onboarding_complete": prefs.onboarding_complete}
    if prefs.favorite_driver_code is not None:
        update_data["favorite_driver_code"] = prefs.favorite_driver_code
    if prefs.favorite_team_id is not None:
        update_data["favorite_team_id"] = prefs.favorite_team_id

    result = (
        sb.table("user_profiles")
        .update(update_data)
        .eq("auth0_sub", sub)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return result.data[0]
