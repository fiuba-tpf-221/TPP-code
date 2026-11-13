"""Valida el JWT de Keycloak y exige el rol de administrador para los datos sensibles.

La central no tiene login propio: reutiliza el mismo realm que ya usa el front principal
(frontend/src/config/services.js -> KEYCLOAK) para no duplicar usuarios ni roles.
"""

import time

import httpx
from fastapi import HTTPException, Request
from jose import jwt
from jose.exceptions import JWTError

from .config import KEYCLOAK, KEYCLOAK_REALM, REQUIRED_ROLE

_JWKS_TTL = 300  # Keycloak rota las claves poco frecuentemente; alcanza con revalidar cada 5 minutos.
_jwks_cache: dict = {"keys": None, "fetched_at": 0.0}


async def _jwks(client: httpx.AsyncClient) -> list[dict]:
    now = time.monotonic()
    if _jwks_cache["keys"] is None or now - _jwks_cache["fetched_at"] > _JWKS_TTL:
        response = await client.get(
            f"{KEYCLOAK}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/certs"
        )
        response.raise_for_status()
        _jwks_cache["keys"] = response.json()["keys"]
        _jwks_cache["fetched_at"] = now
    return _jwks_cache["keys"]


def _extract_token(request: Request) -> str | None:
    header = request.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        return header[7:]
    # La carga inicial del iframe no puede mandar headers propios: el front la pasa por query string.
    return request.query_params.get("token")


async def require_admin(request: Request) -> dict:
    """Dependencia de FastAPI: 401 sin token válido, 403 sin el rol requerido."""
    token = _extract_token(request)
    if not token:
        raise HTTPException(401, "Esta información requiere haber iniciado sesión.")
    try:
        header = jwt.get_unverified_header(token)
        keys = await _jwks(request.app.state.client)
        key = next((k for k in keys if k.get("kid") == header.get("kid")), None)
        if key is None:
            raise JWTError("Clave de firma desconocida.")
        # No se valida issuer/audience: el hostname con el que el navegador pidió el token
        # (localhost, una IP de LAN, etc.) no tiene por qué coincidir con el de este contenedor;
        # la firma contra las claves públicas del realm ya garantiza que el token es genuino.
        claims = jwt.decode(
            token,
            key,
            algorithms=[key.get("alg", "RS256")],
            options={"verify_aud": False, "verify_iss": False},
        )
    except (JWTError, httpx.HTTPError, KeyError, ValueError):
        raise HTTPException(401, "El token no es válido o expiró.") from None
    roles = claims.get("realm_access", {}).get("roles", [])
    if REQUIRED_ROLE not in roles:
        raise HTTPException(403, "Tu usuario no tiene permiso para ver esta información.")
    return claims
