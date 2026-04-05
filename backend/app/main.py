"""
Main FastAPI application entry point.

This module initializes and configures the FastAPI application with:
- CORS middleware
- Rate limiting
- Security headers
- API routes
- Error handling
- Logging

Security hardening applied throughout.
"""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
import time

from .core.config import settings, logger
from .core.security import get_security_headers
from .middleware.rate_limit import setup_rate_limiting, limiter
from .api import auth, content, posts, settings as settings_api, admin, user_content


# =============================================================================
# LIFESPAN CONTEXT
# =============================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan context manager.
    
    Handles startup and shutdown events.
    """
    # Startup
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Debug mode: {settings.DEBUG}")
    
    # Initialize background scheduler
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from .worker.posting import posting_worker
    from .worker.auto_generator import auto_generator_worker
    
    scheduler = AsyncIOScheduler()
    
    # Schedule posting worker to run every 5 minutes
    scheduler.add_job(
        posting_worker.process_due_posts,
        'interval',
        minutes=5,
        id='posting_worker',
        replace_existing=True
    )
    
    # Schedule auto-generator worker to run every 60 minutes
    scheduler.add_job(
        auto_generator_worker.process_auto_generation,
        'interval',
        minutes=60,
        id='auto_generator',
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("Background scheduler started - posting worker runs every 5 mins, auto-generator every arg 60 mins")
    
    yield
    
    # Shutdown
    scheduler.shutdown()
    logger.info("Shutting down application")


# =============================================================================
# APPLICATION INITIALIZATION
# =============================================================================
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Enterprise-grade LinkedIn content automation SaaS platform",
    docs_url="/api/docs" if settings.DEBUG else None,  # Disable in production
    redoc_url="/api/redoc" if settings.DEBUG else None,
    lifespan=lifespan
)


# =============================================================================
# MIDDLEWARE CONFIGURATION
# =============================================================================

# CORS Middleware
# Security Note: Configure allowed origins carefully in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count", "X-Page", "X-Page-Size"]
)


# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """
    Add request processing time to response headers.
    Useful for performance monitoring.
    """
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response


# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """
    Add security headers to all responses.
    Implements OWASP best practices.
    """
    response = await call_next(request)
    
    # Add security headers
    security_headers = get_security_headers()
    for header, value in security_headers.items():
        response.headers[header] = value
    
    return response


# Rate limiting setup
setup_rate_limiting(app)


# =============================================================================
# EXCEPTION HANDLERS
# =============================================================================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Handle validation errors with user-friendly messages.
    
    Security Note:
    - Don't expose internal validation details
    - Log full error for debugging
    - Return sanitized error to user
    """
    logger.warning(f"Validation error on {request.url.path}: {exc.errors()}")
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "Validation Error",
            "message": "Invalid request data. Please check your input.",
            **({"details": exc.errors()} if settings.DEBUG else {})
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """
    Handle unexpected errors gracefully.
    
    Security Note:
    - Never expose stack traces to users
    - Log full error for debugging
    - Return generic error message
    """
    logger.error(f"Unexpected error on {request.url.path}: {exc}", exc_info=True)
    
    # In production, return generic error
    if settings.ENVIRONMENT == "production":
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "Internal Server Error",
                "message": "An unexpected error occurred. Please try again later."
            }
        )
    else:
        # In development, include error details
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "Internal Server Error",
                "message": str(exc),
                "type": type(exc).__name__
            }
        )


# =============================================================================
# ROUTES
# =============================================================================

# Health check endpoint (no rate limiting)
@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint for monitoring.
    
    Returns application status and version.
    """
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT
    }


# Root endpoint
@app.get("/", tags=["Root"])
@limiter.limit("100/minute")
async def root(request: Request):
    """
    Root endpoint with API information.
    """
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/api/docs" if settings.DEBUG else "Documentation disabled in production",
        "health": "/health"
    }


# Include API routers
app.include_router(
    auth.router,
    prefix=f"{settings.API_V1_PREFIX}/auth",
    tags=["Authentication"]
)

app.include_router(
    content.router,
    prefix=f"{settings.API_V1_PREFIX}/content",
    tags=["Content Generation"]
)

app.include_router(
    posts.router,
    prefix=f"{settings.API_V1_PREFIX}/posts",
    tags=["Posts"]
)

app.include_router(
    settings_api.router,
    prefix=f"{settings.API_V1_PREFIX}/settings",
    tags=["Settings"]
)

app.include_router(
    admin.router,
    prefix=f"{settings.API_V1_PREFIX}/admin",
    tags=["Admin"]
)

app.include_router(
    user_content.router,
    prefix=f"{settings.API_V1_PREFIX}/user",
    tags=["User Content & Automation"]
)


# =============================================================================
# HEALTH CHECK ENDPOINT
# =============================================================================
# This endpoint is designed to be pinged by UptimeRobot every 5 minutes.
# It prevents the Render free plan from spinning down the service,
# which would otherwise kill the APScheduler background jobs.

@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint.
    Used by monitoring services to keep the server alive on Render.
    """
    from .core.datetime_utils import utc_now
    return {
        "status": "ok",
        "timestamp": utc_now().isoformat(),
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION
    }


# =============================================================================
# STARTUP MESSAGE
# =============================================================================
if __name__ == "__main__":
    import uvicorn
    
    logger.info(f"Starting {settings.APP_NAME} on http://localhost:8000")
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )
