"""
Authentication API routes.

Handles:
- User signup (email/password)
- User login
- Google OAuth
- LinkedIn OAuth
- Token refresh
- Logout

Security:
- Rate limiting on all auth endpoints
- Password strength validation
- CSRF protection for OAuth
- Audit logging
"""

from datetime import timedelta
from fastapi import APIRouter, HTTPException, status, Request, Depends
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from typing import Optional
import secrets
from urllib.parse import urlencode

from ..models.schemas import (
    UserSignup,
    UserLogin,
    SignupResponse,
    TokenResponse,
    UserProfile,
    OAuthCallback
)
from ..core.security import (
    hash_password,
    verify_password,
    create_access_token,
    log_security_event,
    get_client_ip
)
from ..core.config import settings, logger
from ..core.datetime_utils import utc_now, is_future_datetime
from ..services.database import (
    supabase_client,
    create_user_record,
    get_user_by_id,
    log_audit_event,
    normalize_full_name
)
from ..services.linkedin import linkedin_service
from ..middleware.rate_limit import limiter, AUTH_RATE_LIMIT
from ..middleware.admin_auth import get_current_user_id


router = APIRouter()
_LINKEDIN_STATE_TTL_MINUTES = 10


def _frontend_base_url() -> str:
    """Resolve the frontend base URL used for OAuth redirects."""
    if settings.FRONTEND_APP_URL:
        return settings.FRONTEND_APP_URL.rstrip("/")

    if settings.BACKEND_CORS_ORIGINS:
        return settings.BACKEND_CORS_ORIGINS[0].rstrip("/")

    return "http://localhost:3000"


def _frontend_redirect(path: str, **query_params: Optional[str]) -> str:
    """Build a frontend redirect URL with optional query params."""
    normalized_path = path if path.startswith("/") else f"/{path}"
    filtered_params = {
        key: value
        for key, value in query_params.items()
        if value not in (None, "")
    }
    query = urlencode(filtered_params)
    return f"{_frontend_base_url()}{normalized_path}" + (f"?{query}" if query else "")


def _create_oauth_state(user_id: str, provider: str) -> str:
    """Create a signed, short-lived OAuth state token."""
    now = utc_now()
    payload = {
        "sub": user_id,
        "provider": provider,
        "type": "oauth_state",
        "iat": now,
        "exp": now + timedelta(minutes=_LINKEDIN_STATE_TTL_MINUTES),
        "jti": secrets.token_urlsafe(16),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _decode_oauth_state(state: str, provider: str) -> str:
    """Validate OAuth state token and return the bound user id."""
    try:
        payload = jwt.decode(state, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OAuth state"
        ) from exc

    user_id = payload.get("sub")
    if (
        payload.get("type") != "oauth_state"
        or payload.get("provider") != provider
        or not isinstance(user_id, str)
        or not user_id
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OAuth state payload"
        )

    return user_id


def _is_email_confirmation_error_message(message: str) -> bool:
    """Identify Supabase email-confirmation login failures."""
    lowered = message.lower()
    return (
        "email not confirmed" in lowered
        or "confirm your email" in lowered
        or "verify your email" in lowered
    )


# =============================================================================
# EMAIL/PASSWORD AUTHENTICATION
# =============================================================================

@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(AUTH_RATE_LIMIT)
async def signup(request: Request, user_data: UserSignup):
    """
    Register a new user with email and password.
    
    Security:
    - Password strength validated by Pydantic model
    - Supabase confirmation email flow is used
    - Rate limited to prevent abuse
    - Audit logged
    
    Args:
        user_data: User signup data
        
    Returns:
        Signup status with email confirmation requirements
        
    Raises:
        HTTPException: If email already exists or signup fails
    """
    try:
        # Check if user already exists
        existing = supabase_client.admin.table("users").select("id").eq(
            "email", user_data.email
        ).execute()
        
        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        redirect_to = _frontend_redirect("/auth/v1/callback")

        # Create the user through the standard signup flow so Supabase sends
        # the confirmation email when Confirm email is enabled.
        auth_response = supabase_client.client.auth.sign_up({
            "email": user_data.email,
            "password": user_data.password,
            "options": {
                "email_redirect_to": redirect_to,
                "data": {
                    "full_name": user_data.full_name,
                },
            },
        })

        if not auth_response.user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Signup failed. Please try again."
            )

        user_id = auth_response.user.id
        confirmation_required = auth_response.session is None
        
        # Log audit event
        await log_audit_event(
            user_id=user_id,
            event_type="user_signup",
            details={
                "email": user_data.email,
                "provider": "email",
                "email_confirmation_required": confirmation_required,
            },
            ip_address=get_client_ip(request)
        )

        if confirmation_required:
            logger.info(f"New user signup pending confirmation: {user_data.email}")
            return SignupResponse(
                user_id=user_id,
                email_confirmation_required=True,
                message="Account created. Please check your email and confirm your address before signing in."
            )

        logger.warning(
            "Signup for %s returned an immediate session. Confirm email may be disabled in Supabase.",
            user_data.email,
        )
        return SignupResponse(
            user_id=user_id,
            email_confirmation_required=False,
            message="Account created successfully."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signup failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Signup failed. Please try again."
        )


@router.post("/login", response_model=TokenResponse)
@limiter.limit(AUTH_RATE_LIMIT)
async def login(request: Request, credentials: UserLogin):
    """
    Login with email and password.
    
    Security:
    - Rate limited to prevent brute force
    - Failed attempts logged
    - Constant-time password comparison
    
    Args:
        credentials: Login credentials
        
    Returns:
        JWT access token
        
    Raises:
        HTTPException: If credentials are invalid
    """
    try:
        # Authenticate with Supabase
        auth_response = supabase_client.client.auth.sign_in_with_password({
            "email": credentials.email,
            "password": credentials.password
        })
        
        if not auth_response.user:
            # Log failed attempt
            await log_audit_event(
                user_id=None,
                event_type="login_failed",
                details={"email": credentials.email, "reason": "invalid_credentials"},
                ip_address=get_client_ip(request)
            )
            
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        user_id = auth_response.user.id
        
        # Update last login time
        supabase_client.admin.table("users").update({
            "last_login_at": utc_now().isoformat()
        }).eq("id", user_id).execute()
        
        # Create access token
        access_token = create_access_token(
            data={"sub": user_id, "email": credentials.email}
        )
        
        # Log successful login
        await log_audit_event(
            user_id=user_id,
            event_type="login_success",
            details={"email": credentials.email},
            ip_address=get_client_ip(request)
        )
        
        logger.info(f"User login: {credentials.email}")
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user_id=user_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        error_message = str(e)
        if _is_email_confirmation_error_message(error_message):
            await log_audit_event(
                user_id=None,
                event_type="login_failed",
                details={"email": credentials.email, "reason": "email_not_confirmed"},
                ip_address=get_client_ip(request)
            )

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Please confirm your email before signing in."
            )

        logger.error(f"Login failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )


# =============================================================================
# GOOGLE OAUTH
# =============================================================================

@router.get("/google")
@limiter.limit("10/minute")
async def google_auth(request: Request):
    """
    Initiate Google OAuth flow.
    
    Redirects user to Supabase OAuth (Google provider).
    """
    redirect_to = _frontend_redirect("/auth/v1/callback")
    query = urlencode(
        {
            "provider": "google",
            "redirect_to": redirect_to,
        }
    )
    supabase_oauth_url = f"{settings.SUPABASE_URL}/auth/v1/authorize?{query}"

    return RedirectResponse(url=supabase_oauth_url)


@router.get("/google/callback")
@limiter.limit("10/minute")
async def google_callback(request: Request, code: str, state: str):
    """
    Handle Google OAuth callback.
    
    Legacy endpoint retained for compatibility.
    Google OAuth is handled through Supabase callback flow.
    """
    logger.info("Legacy /google/callback hit; redirecting to frontend login flow")
    return RedirectResponse(url=_frontend_redirect("/login"))


# =============================================================================
# LINKEDIN OAUTH
# =============================================================================

@router.get("/linkedin")
@limiter.limit("10/minute")
async def linkedin_auth(
    request: Request,
    user_id: str = Depends(get_current_user_id)
):
    """
    Initiate LinkedIn OAuth flow.
    
    Args:
        user_id: Authenticated user ID to connect LinkedIn account to
        
    Returns:
        Authorization URL for LinkedIn OAuth
    """
    state = _create_oauth_state(user_id, "linkedin")

    # Get LinkedIn authorization URL
    auth_url = linkedin_service.get_authorization_url(state)

    return {"authorization_url": auth_url}


@router.get("/linkedin/callback")
@limiter.limit("10/minute")
async def linkedin_callback(
    request: Request, 
    code: Optional[str] = None, 
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None
):
    """
    Handle LinkedIn OAuth callback.
    
    Exchanges code for token and stores it.
    """
    try:
        if error:
            logger.error(f"LinkedIn OAuth error: {error} - {error_description}")
            return RedirectResponse(
                url=_frontend_redirect(
                    "/settings",
                    linkedin="error",
                    detail=error,
                    description=error_description,
                )
            )

        if not code or not state:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing authorization code or state"
            )

        user_id = _decode_oauth_state(state, "linkedin")
        
        # Exchange code for token
        token_data = await linkedin_service.exchange_code_for_token(code)
        
        # Store token
        await linkedin_service.store_user_token(user_id, token_data)
        
        # Log event
        await log_audit_event(
            user_id=user_id,
            event_type="linkedin_connected",
            details={"scope": token_data.get("scope")},
            ip_address=get_client_ip(request)
        )
        
        logger.info(f"LinkedIn connected for user {user_id}")
        
        # Redirect to frontend success page
        return RedirectResponse(
            url=_frontend_redirect("/settings", linkedin="connected")
        )
        
    except Exception as e:
        logger.error(f"LinkedIn callback failed: {e}")
        return RedirectResponse(
            url=_frontend_redirect("/settings", linkedin="error")
        )


@router.get("/linkedin/targets")
@limiter.limit("60/minute")
async def get_linkedin_targets(
    request: Request,
    user_id: str = Depends(get_current_user_id)
):
    """
    Get LinkedIn connection metadata for the authenticated user.

    Returns:
    - connected status
    - connected LinkedIn account/profile
    - managed organization pages (if scope permits)
    """
    try:
        data = await linkedin_service.get_linkedin_targets(user_id)
        return data
    except Exception as e:
        logger.error(f"Failed to get LinkedIn targets for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve LinkedIn connection details"
        )


# =============================================================================
# USER PROFILE
# =============================================================================

@router.get("/me", response_model=UserProfile)
@limiter.limit("60/minute")
async def get_current_user(
    request: Request,
    user_id: str = Depends(get_current_user_id)
):
    """
    Get current user profile.
    
    Args:
        user_id: User ID from JWT token (would be extracted from token)
        
    Returns:
        User profile data
    """
    try:
        user = await get_user_by_id(user_id)
        
        if not user:
            # Self-heal missing user profile row (common for OAuth users when DB trigger was absent).
            auth_user = supabase_client.admin.auth.admin.get_user_by_id(user_id)
            auth_record = getattr(auth_user, "user", None)
            if auth_record:
                auth_email = getattr(auth_record, "email", None)
                auth_meta = getattr(auth_record, "user_metadata", {}) or {}
                raw_name = auth_meta.get("full_name") if isinstance(auth_meta, dict) else None
                resolved_name = normalize_full_name(raw_name, auth_email)

                await create_user_record(
                    user_id=user_id,
                    email=auth_email or f"{user_id}@unknown.local",
                    full_name=resolved_name,
                    auth_provider="oauth"
                )
                user = await get_user_by_id(user_id)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Check LinkedIn connection
        linkedin_token = supabase_client.admin.table("linkedin_tokens").select(
            "expires_at"
        ).eq("user_id", user_id).execute()
        
        linkedin_connected = False
        if linkedin_token.data:
            linkedin_connected = is_future_datetime(
                linkedin_token.data[0].get("expires_at")
            )
        
        return UserProfile(
            id=user["id"],
            email=user["email"],
            full_name=user["full_name"],
            created_at=user["created_at"],
            linkedin_connected=linkedin_connected,
            google_connected=user.get("auth_provider") == "google"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get user profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user profile"
        )


# =============================================================================
# LOGOUT
# =============================================================================

@router.post("/logout")
@limiter.limit("60/minute")
async def logout(
    request: Request,
    user_id: str = Depends(get_current_user_id)
):
    """
    Logout user.
    
    Note: With JWT, logout is handled client-side by discarding the token.
    This endpoint is for audit logging purposes.
    """
    await log_audit_event(
        user_id=user_id,
        event_type="logout",
        details={},
        ip_address=get_client_ip(request)
    )
    
    return {"message": "Logged out successfully"}
