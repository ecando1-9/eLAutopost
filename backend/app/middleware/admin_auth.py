"""
Admin authentication middleware.

This middleware ensures that only users with admin role can access admin endpoints.

Security:
- Verifies JWT token
- Checks admin role in database
- Logs unauthorized access attempts
- Returns 403 Forbidden for non-admins
"""

from fastapi import Request, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from ..core.security import decode_access_token, get_client_ip
from ..core.config import logger
from ..services.admin import admin_service
from ..services.database import log_audit_event


# HTTP Bearer token scheme
security = HTTPBearer()


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    """
    Extract and validate user ID from Supabase JWT token.
    
    Uses Supabase's getUser API to verify tokens, which handles
    both legacy HS256 and new ECC (ES256) tokens automatically.
    
    Args:
        credentials: HTTP Bearer credentials
        
    Returns:
        User ID from token
        
    Raises:
        HTTPException: If token is invalid
    """
    try:
        from ..services.database import supabase_client
        
        # Use Supabase to verify the token - it handles all algorithms
        response = supabase_client.client.auth.get_user(credentials.credentials)
        
        if not response or not response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
        
        return response.user.id
        
    except Exception as e:
        logger.warning(f"Token validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"}
        )


async def require_admin(
    request: Request,
    user_id: str = Depends(get_current_user_id)
) -> str:
    """
    Verify that the current user is an admin.
    
    This dependency should be used on all admin endpoints.
    
    Usage:
        @app.get("/admin/users")
        async def get_users(admin_id: str = Depends(require_admin)):
            ...
    
    Args:
        request: FastAPI request object
        user_id: User ID from JWT token
        
    Returns:
        Admin user ID
        
    Raises:
        HTTPException: If user is not an admin
    """
    try:
        # Check if user is admin
        is_admin = await admin_service.verify_admin(user_id)
        
        if not is_admin:
            # Log unauthorized access attempt
            await log_audit_event(
                user_id=user_id,
                event_type="unauthorized_admin_access",
                details={
                    "path": request.url.path,
                    "method": request.method
                },
                ip_address=get_client_ip(request)
            )
            
            logger.warning(
                f"Non-admin user {user_id} attempted to access admin endpoint: "
                f"{request.url.path}"
            )
            
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Admin privileges required."
            )
        
        return user_id
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify admin privileges"
        )


async def check_subscription_access(
    user_id: str = Depends(get_current_user_id)
) -> str:
    """
    Check if user has active subscription (trial or paid).
    
    This dependency should be used on endpoints that require active subscription.
    
    Usage:
        @app.post("/content/generate")
        async def generate(user_id: str = Depends(check_subscription_access)):
            ...
    
    Args:
        user_id: User ID from JWT token
        
    Returns:
        User ID if subscription is active
        
    Raises:
        HTTPException: If subscription is not active
    """
    try:
        # Check subscription status using database function
        from ..services.database import supabase_client
        
        result = supabase_client.admin.rpc(
            "has_active_subscription",
            {"check_user_id": user_id}
        ).execute()
        
        has_active = result.data if result.data is not None else False
        
        if not has_active:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={
                    "error": "Subscription Required",
                    "message": "Your trial has expired or subscription is inactive. Please upgrade to continue.",
                    "upgrade_url": "/pricing"
                }
            )
        
        return user_id
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Subscription check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify subscription status"
        )


async def get_admin_with_ip(
    request: Request,
    admin_id: str = Depends(require_admin)
) -> tuple[str, str]:
    """
    Get admin ID and IP address for audit logging.
    
    Convenience dependency that combines admin verification with IP extraction.
    
    Usage:
        @app.post("/admin/block-user")
        async def block_user(admin_data: tuple = Depends(get_admin_with_ip)):
            admin_id, ip_address = admin_data
            ...
    
    Args:
        request: FastAPI request object
        admin_id: Admin user ID
        
    Returns:
        Tuple of (admin_id, ip_address)
    """
    ip_address = get_client_ip(request)
    return (admin_id, ip_address)
