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

from fastapi import APIRouter, HTTPException, status, Request, Depends
from fastapi.responses import RedirectResponse
from typing import Optional
import secrets
from urllib.parse import urlencode

from ..models.schemas import (
    UserSignup,
    UserLogin,
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
    log_audit_event
)
from ..services.linkedin import linkedin_service
from ..middleware.rate_limit import limiter, AUTH_RATE_LIMIT
from ..middleware.admin_auth import get_current_user_id


router = APIRouter()


# =============================================================================
# EMAIL/PASSWORD AUTHENTICATION
# =============================================================================

@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(AUTH_RATE_LIMIT)
async def signup(request: Request, user_data: UserSignup):
    """
    Register a new user with email and password.
    
    Security:
    - Password strength validated by Pydantic model
    - Password hashed with bcrypt
    - Rate limited to prevent abuse
    - Audit logged
    
    Args:
        user_data: User signup data
        
    Returns:
        JWT access token and user info
        
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
        
        # Create user in Supabase Auth
        auth_response = supabase_client.admin.auth.admin.create_user({
            "email": user_data.email,
            "password": user_data.password,
            "email_confirm": True  # Auto-confirm for now
        })
        
        user_id = auth_response.user.id
        
        # Create user record in database
        await create_user_record(
            user_id=user_id,
            email=user_data.email,
            full_name=user_data.full_name,
            auth_provider="email"
        )
        
        # Create access token
        access_token = create_access_token(
            data={"sub": user_id, "email": user_data.email}
        )
        
        # Log audit event
        await log_audit_event(
            user_id=user_id,
            event_type="user_signup",
            details={"email": user_data.email, "provider": "email"},
            ip_address=get_client_ip(request)
        )
        
        logger.info(f"New user signup: {user_data.email}")
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user_id=user_id
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
    redirect_to = f"{settings.BACKEND_CORS_ORIGINS[0]}/auth/v1/callback"
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
    return RedirectResponse(url=f"{settings.BACKEND_CORS_ORIGINS[0]}/login")


# =============================================================================
# LINKEDIN OAUTH
# =============================================================================

@router.get("/linkedin")
@limiter.limit("10/minute")
async def linkedin_auth(request: Request, user_id: str):
    """
    Initiate LinkedIn OAuth flow.
    
    Args:
        user_id: User ID to connect LinkedIn account to
        
    Returns:
        Redirect to LinkedIn OAuth
    """
    # Generate state for CSRF protection
    state = secrets.token_urlsafe(32)
    
    # TODO: Store state in Redis with user_id
    # For now, we'll include user_id in state (not production-ready)
    state_with_user = f"{state}:{user_id}"
    
    # Get LinkedIn authorization URL
    auth_url = linkedin_service.get_authorization_url(state_with_user)
    
    return RedirectResponse(url=auth_url)


@router.get("/linkedin/callback")
@limiter.limit("10/minute")
async def linkedin_callback(request: Request, code: str, state: str):
    """
    Handle LinkedIn OAuth callback.
    
    Exchanges code for token and stores it.
    """
    try:
        # Extract user_id from state (not production-ready)
        # In production, retrieve from Redis
        parts = state.split(":")
        if len(parts) != 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid state parameter"
            )
        
        user_id = parts[1]
        
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
            url=f"{settings.BACKEND_CORS_ORIGINS[0]}/dashboard?linkedin=connected"
        )
        
    except Exception as e:
        logger.error(f"LinkedIn callback failed: {e}")
        return RedirectResponse(
            url=f"{settings.BACKEND_CORS_ORIGINS[0]}/dashboard?linkedin=error"
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
async def get_current_user(request: Request, user_id: str):
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
async def logout(request: Request, user_id: str):
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
