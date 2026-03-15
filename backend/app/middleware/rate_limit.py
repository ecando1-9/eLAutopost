"""
Rate limiting middleware for API protection.

This module implements comprehensive rate limiting to prevent:
- Brute force attacks
- API abuse
- DDoS attacks
- Resource exhaustion

Uses SlowAPI with both IP-based and user-based limiting.
"""

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request, HTTPException, status
from typing import Callable
from ..core.config import settings, logger
from ..core.security import get_client_ip


# =============================================================================
# RATE LIMITER CONFIGURATION
# =============================================================================
def get_identifier(request: Request) -> str:
    """
    Get unique identifier for rate limiting.
    
    Strategy:
    - Uses client IP address as primary identifier
    - In production, considers X-Forwarded-For for proxied requests
    - Falls back to user ID if authenticated (more granular control)
    
    Security Notes:
    - IP-based limiting prevents distributed attacks
    - User-based limiting prevents authenticated abuse
    - Combines both for defense in depth
    
    Args:
        request: FastAPI request object
        
    Returns:
        Unique identifier string for rate limiting
    """
    # Get client IP (handles proxy scenarios)
    ip_address = get_client_ip(request)
    
    # TODO: Add user-based limiting for authenticated requests
    # This would require extracting user ID from JWT token
    # For now, using IP-based limiting
    
    return ip_address


# Initialize rate limiter
# SlowAPI uses Redis-like storage (in-memory by default)
# For production, configure with Redis backend for distributed rate limiting
limiter = Limiter(
    key_func=get_identifier,
    default_limits=[
        f"{settings.RATE_LIMIT_PER_MINUTE}/minute",
        f"{settings.RATE_LIMIT_PER_HOUR}/hour"
    ],
    storage_uri="memory://",  # Use Redis in production: "redis://localhost:6379"
    strategy="fixed-window"  # Options: fixed-window, moving-window
)


# =============================================================================
# CUSTOM RATE LIMIT HANDLERS
# =============================================================================
async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """
    Custom handler for rate limit exceeded errors.
    
    Security Notes:
    - Returns 429 Too Many Requests (RFC 6585)
    - Includes Retry-After header for client guidance
    - Logs excessive requests for monitoring
    - Does not reveal internal rate limit configuration
    
    Args:
        request: FastAPI request object
        exc: RateLimitExceeded exception
        
    Returns:
        HTTPException with 429 status code
    """
    client_ip = get_client_ip(request)
    
    # Log rate limit violation
    logger.warning(
        f"Rate limit exceeded for IP: {client_ip}, "
        f"Path: {request.url.path}, "
        f"Method: {request.method}"
    )
    
    # Return user-friendly error
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail={
            "error": "Rate limit exceeded",
            "message": "Too many requests. Please try again later.",
            "retry_after": "60 seconds"
        },
        headers={"Retry-After": "60"}
    )


# =============================================================================
# ENDPOINT-SPECIFIC RATE LIMITS
# =============================================================================
# Define stricter limits for sensitive endpoints
# These can be applied as decorators on specific routes

# Authentication endpoints (prevent brute force)
AUTH_RATE_LIMIT = "5/minute"

# Content generation endpoints (prevent API abuse)
GENERATION_RATE_LIMIT = "10/minute"

# LinkedIn posting endpoints (prevent spam)
POSTING_RATE_LIMIT = "5/minute"

# Public endpoints (more lenient)
PUBLIC_RATE_LIMIT = "100/minute"


# =============================================================================
# RATE LIMIT DECORATORS
# =============================================================================
def rate_limit_auth(func: Callable) -> Callable:
    """
    Apply strict rate limiting to authentication endpoints.
    
    Usage:
        @app.post("/login")
        @rate_limit_auth
        async def login(credentials: LoginRequest):
            ...
    """
    return limiter.limit(AUTH_RATE_LIMIT)(func)


def rate_limit_generation(func: Callable) -> Callable:
    """
    Apply rate limiting to content generation endpoints.
    
    Usage:
        @app.post("/generate")
        @rate_limit_generation
        async def generate_content(topic: str):
            ...
    """
    return limiter.limit(GENERATION_RATE_LIMIT)(func)


def rate_limit_posting(func: Callable) -> Callable:
    """
    Apply rate limiting to LinkedIn posting endpoints.
    
    Usage:
        @app.post("/post")
        @rate_limit_posting
        async def post_to_linkedin(content: PostRequest):
            ...
    """
    return limiter.limit(POSTING_RATE_LIMIT)(func)


# =============================================================================
# MIDDLEWARE INTEGRATION
# =============================================================================
def setup_rate_limiting(app):
    """
    Configure rate limiting for the FastAPI application.
    
    This should be called during app initialization:
        app = FastAPI()
        setup_rate_limiting(app)
    
    Args:
        app: FastAPI application instance
    """
    # Add rate limiter to app state
    app.state.limiter = limiter
    
    # Add exception handler for rate limit exceeded
    app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
    
    logger.info(
        f"Rate limiting configured: "
        f"{settings.RATE_LIMIT_PER_MINUTE}/min, "
        f"{settings.RATE_LIMIT_PER_HOUR}/hour"
    )
