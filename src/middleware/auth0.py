"""Auth0 JWT validation middleware.

Validates Bearer tokens issued by Auth0 using the JWKS endpoint.
On success, injects `request.state.user_sub` (Auth0 user ID) and
`request.state.user_email` into the request.

Usage in route handlers:
    from src.middleware.auth0 import require_auth
    async def my_route(request: Request, user=Depends(require_auth)):
        sub = request.state.user_sub
"""

import httpx
from functools import lru_cache
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from src.config import settings

_bearer = HTTPBearer(auto_error=False)


@lru_cache(maxsize=1)
def _get_jwks() -> dict:
    """Fetch JWKS from Auth0. Cached for the process lifetime (restart to rotate keys)."""
    url = f"https://{settings.auth0_domain}/.well-known/jwks.json"
    resp = httpx.get(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


def _decode_token(token: str) -> dict:
    """Decode and validate an Auth0 JWT, returning the claims."""
    jwks = _get_jwks()
    try:
        unverified_header = jwt.get_unverified_header(token)
    except JWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token header: {e}")

    rsa_key = {}
    for key in jwks.get("keys", []):
        if key.get("kid") == unverified_header.get("kid"):
            rsa_key = {
                "kty": key["kty"],
                "kid": key["kid"],
                "use": key["use"],
                "n":   key["n"],
                "e":   key["e"],
            }
            break

    if not rsa_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unable to find matching signing key")

    try:
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            audience=settings.auth0_audience,
            issuer=f"https://{settings.auth0_domain}/",
        )
        return payload
    except JWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Token validation failed: {e}")


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Optional[dict]:
    """Dependency that validates the token if present.

    Returns the JWT payload dict if authenticated, None if no token.
    Injects user_sub + user_email into request.state for convenience.
    """
    if not credentials:
        return None

    payload = _decode_token(credentials.credentials)
    request.state.user_sub = payload.get("sub")
    request.state.user_email = payload.get("email") or payload.get(f"{settings.auth0_audience}/email", "")
    return payload


async def require_auth(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> dict:
    """Dependency that requires a valid token. Raises 401 if missing/invalid."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return await get_current_user(request, credentials)
