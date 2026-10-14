"""
main.py - FastAPI application entry point for Health Copilot.

Responsibilities:
  - Create the FastAPI app with metadata.
  - Configure CORS middleware using settings.ALLOWED_ORIGINS.
  - Mount a GET /health liveness endpoint.
  - Include the records router under the /api prefix.
"""


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import records

settings = get_settings()

app = FastAPI(
    title="Health Copilot API",
    description=(
        "AI-powered personal health assistant backend. "
        "Analyses health documents (prescriptions, lab reports, discharge summaries) "
        "using Google Gemini and returns structured FHIR-style bundles with "
        "patient-friendly summaries."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# CORS middleware
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Liveness probe
# ---------------------------------------------------------------------------


@app.get("/health", tags=["System"], summary="Liveness probe")
async def health_check() -> dict:
    """Return a simple status check so orchestrators can confirm the app is alive."""
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(records.router, prefix="/api")
