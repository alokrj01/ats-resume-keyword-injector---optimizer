"""Serve a built frontend and the real API from one origin for local previews.

Build frontend/ first, then run:

    uv run uvicorn serve_site:app --port 5173

The API-only Docker deployment still uses app.main:app.
"""

from pathlib import Path

from starlette.exceptions import HTTPException
from starlette.routing import Match, Mount
from starlette.staticfiles import StaticFiles

from app.main import app

DIST = Path(__file__).resolve().parents[1] / "frontend" / "dist"


def _is_api_url_path(url_path: str) -> bool:
    """Keep the complete API namespace out of the static-site handler."""
    return url_path == "/api" or url_path.startswith("/api/")


def _is_api_request(scope) -> bool:
    """Check the actual URL path, not StaticFiles' normalized file path."""
    return _is_api_url_path(scope.get("path", ""))


class StudioFiles(StaticFiles):
    async def _index_response(self, scope, status_code: int = 200):
        # StaticFiles allows GET and HEAD only, so preserve its method checks.
        response = await super().get_response("index.html", scope)
        response.status_code = status_code
        return response

    async def get_response(self, path, scope):
        # Explicit SPA routes.
        if path.strip("/") in {"", ".", "index.html", "privacy", "terms"}:
            return await self._index_response(scope)

        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            accepts_html = any(
                key.lower() == b"accept" and b"text/html" in value.lower()
                for key, value in scope.get("headers", [])
            )

            # Preserve the SPA fallback for unknown website pages, but never
            # serve HTML for an API URL.
            if (
                exc.status_code == 404
                and not _is_api_request(scope)
                and accepts_html
            ):
                return await self._index_response(scope, status_code=404)

            raise


class StudioMount(Mount):
    """Mount the frontend only outside the API URL namespace."""

    def matches(self, scope):
        # Let FastAPI own every /api and /api/... request. This preserves
        # method errors, CORS behavior, and trailing-slash redirects.
        if scope["type"] in {"http", "websocket"} and _is_api_request(scope):
            return Match.NONE, {}

        return super().matches(scope)


app.router.routes.append(
    StudioMount("/", app=StudioFiles(directory=DIST), name="studio")
)