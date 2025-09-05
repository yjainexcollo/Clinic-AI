"""
FastAPI application factory and main app configuration.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from clinicai.api.routers import health, patients, intake
from clinicai.core.config import get_settings
from clinicai.domain.errors import DomainError


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    settings = get_settings()
    print(f"🚀 Starting Clinic-AI Intake Assistant v{settings.app_version}")
    print(f"📊 Environment: {settings.app_env}")
    print(f"🔧 Debug mode: {settings.debug}")
    # Initialize database connection and DI via composition root
    try:
        # Echo effective Mongo settings to verify env resolution
        mongo_uri = settings.database.uri
        db_name = settings.database.db_name
        print(f"🔗 Connecting to MongoDB at {mongo_uri}")
        print(f"🗄 Using database: {db_name}")
        from clinicai.bootstrap import initialize_database
        await initialize_database()
        print("✅ MongoDB/Beanie initialized")
    except Exception as exc:
        print(f"⚠️  Skipping MongoDB init (reason: {exc})")

    yield

    # Shutdown
    print("🛑 Shutting down Clinic-AI Intake Assistant")


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="Clinic-AI Intake Assistant",
        description="AI-powered clinical intake system for small and mid-sized clinics",
        version=settings.app_version,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        lifespan=lifespan,
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors.allowed_origins,
        allow_credentials=settings.cors.allow_credentials,
        allow_methods=settings.cors.allowed_methods,
        allow_headers=settings.cors.allowed_headers,
    )

    # Include routers
    app.include_router(health.router)
    app.include_router(patients.router)
    app.include_router(intake.router)

    # Global exception handler for domain errors
    @app.exception_handler(DomainError)
    async def domain_error_handler(request, exc: DomainError):
        return JSONResponse(
            status_code=400,
            content={
                "error": exc.error_code or "DOMAIN_ERROR",
                "message": exc.message,
                "details": exc.details,
            },
        )

    # Global exception handler for validation errors
    @app.exception_handler(ValueError)
    async def validation_error_handler(request, exc: ValueError):
        return JSONResponse(
            status_code=422,
            content={"error": "VALIDATION_ERROR", "message": str(exc), "details": {}},
        )

    return app


# Create the app instance
app = create_app()


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information."""
    settings = get_settings()
    return {
        "service": "Clinic-AI Intake Assistant",
        "version": settings.app_version,
        "environment": settings.app_env,
        "status": "running",
        "docs": "/docs" if settings.debug else "disabled",
        "endpoints": {
            "health": "/health",
            "register_patient": "POST /patients/",
            "answer_intake": "POST /patients/consultations/answer",
            "start_intake": "POST /intake/start",
            "submit_intake": "POST /intake/submit",
            "visit_history": "GET /intake/patients/{id}/visits",
        },
    }
