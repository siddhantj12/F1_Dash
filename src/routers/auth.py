"""Auth router — placeholder kept for Swagger UI OAuth2 compatibility.

Real authentication is handled by Auth0 (see src/middleware/auth0.py).
The frontend uses the Auth0 SPA SDK; the backend validates JWTs via JWKS.
"""

from fastapi import APIRouter
from fastapi.security import OAuth2AuthorizationCodeBearer

from src.config import settings

router = APIRouter(tags=["Authentication"])

# Kept so FastAPI's OpenAPI spec shows the auth flow in Swagger UI
oauth2_scheme = OAuth2AuthorizationCodeBearer(
    authorizationUrl=f"https://{settings.auth0_domain}/authorize",
    tokenUrl=f"https://{settings.auth0_domain}/oauth/token",
    auto_error=False,
)
