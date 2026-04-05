"""
User Settings API routes.

Handles:
- Getting user settings
- Updating user settings
- Resetting to defaults

Security:
- User can only access their own settings (RLS)
- Input validation
"""

from fastapi import APIRouter, HTTPException, status, Request, Depends

from ..models.schemas import UserSettings, UserSettingsUpdate
from ..core.config import logger
from ..services.database import supabase_client, update_user_settings, log_audit_event
from ..core.security import get_client_ip
from ..middleware.rate_limit import limiter
from ..middleware.admin_auth import get_current_user_id


router = APIRouter()


# =============================================================================
# SETTINGS OPERATIONS
# =============================================================================

@router.get("/", response_model=UserSettings)
@limiter.limit("60/minute")
async def get_settings(
    request: Request,
    user_id: str = Depends(get_current_user_id)
):
    """
    Get user settings.
    
    Args:
        user_id: Authenticated user ID
        
    Returns:
        User settings
    """
    try:
        result = supabase_client.admin.table("settings").select("*").eq(
            "user_id", user_id
        ).execute()
        
        if not result.data:
            # Return default settings if none exist
            return UserSettings()
        
        settings_data = result.data[0]
        
        return UserSettings(
            default_tone=settings_data.get("default_tone", "professional"),
            auto_post=settings_data.get("auto_post", False),
            notification_email=settings_data.get("notification_email", True),
            preferred_content_types=settings_data.get("preferred_content_types", []),
            default_goal=settings_data.get("default_goal", "Authority"),
            default_audience=settings_data.get("default_audience", "General Professionals"),
            default_style=settings_data.get("default_style", "Carousel slides"),
            emoji_density=settings_data.get("emoji_density", "Medium"),
            auto_format_reach=settings_data.get("auto_format_reach", True),
            publish_target=settings_data.get("publish_target", "person"),
            organization_id=settings_data.get("organization_id"),
            max_posts_per_day=settings_data.get("max_posts_per_day", 1),
        )
        
    except Exception as e:
        logger.error(f"Failed to get settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve settings"
        )


@router.patch("/", response_model=UserSettings)
@limiter.limit("30/minute")
async def update_settings(
    request: Request,
    settings_update: UserSettingsUpdate,
    user_id: str = Depends(get_current_user_id)
):
    """
    Update user settings.
    
    Args:
        settings_update: Settings to update
        user_id: Authenticated user ID
        
    Returns:
        Updated settings
    """
    try:
        # Build update data (only include non-None fields)
        update_data = {}
        if settings_update.default_tone is not None:
            update_data["default_tone"] = settings_update.default_tone
        if settings_update.auto_post is not None:
            update_data["auto_post"] = settings_update.auto_post
        if settings_update.notification_email is not None:
            update_data["notification_email"] = settings_update.notification_email
        if settings_update.preferred_content_types is not None:
            update_data["preferred_content_types"] = [
                ct.value for ct in settings_update.preferred_content_types
            ]
        if settings_update.default_goal is not None:
            update_data["default_goal"] = settings_update.default_goal
        if settings_update.default_audience is not None:
            update_data["default_audience"] = settings_update.default_audience
        if settings_update.default_style is not None:
            update_data["default_style"] = settings_update.default_style
        if settings_update.emoji_density is not None:
            update_data["emoji_density"] = settings_update.emoji_density
        if settings_update.auto_format_reach is not None:
            update_data["auto_format_reach"] = settings_update.auto_format_reach
        if settings_update.publish_target is not None:
            update_data["publish_target"] = settings_update.publish_target
        if settings_update.organization_id is not None:
            update_data["organization_id"] = settings_update.organization_id
        if settings_update.max_posts_per_day is not None:
            update_data["max_posts_per_day"] = settings_update.max_posts_per_day
        
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No update data provided"
            )
        
        # Update settings
        try:
            updated_settings = await update_user_settings(user_id, update_data)
        except Exception as update_error:
            # Backward-compatible fallback when new columns are not migrated yet.
            if "column" in str(update_error).lower() and "does not exist" in str(update_error).lower():
                fallback_keys = {
                    "default_tone",
                    "auto_post",
                    "notification_email",
                    "preferred_content_types",
                    "max_posts_per_day",
                }
                # Later settings columns are intentionally excluded here so
                # older databases can still save the legacy subset instead of failing.
                fallback_update = {
                    key: value
                    for key, value in update_data.items()
                    if key in fallback_keys
                }
                if not fallback_update:
                    raise
                updated_settings = await update_user_settings(user_id, fallback_update)
            else:
                raise
        
        # Log event
        await log_audit_event(
            user_id=user_id,
            event_type="settings_updated",
            details={"updates": list(update_data.keys())},
            ip_address=get_client_ip(request)
        )
        
        logger.info(f"Settings updated for user {user_id}")
        
        return UserSettings(
            default_tone=updated_settings.get("default_tone", "professional"),
            auto_post=updated_settings.get("auto_post", False),
            notification_email=updated_settings.get("notification_email", True),
            preferred_content_types=updated_settings.get("preferred_content_types", []),
            default_goal=updated_settings.get("default_goal", "Authority"),
            default_audience=updated_settings.get("default_audience", "General Professionals"),
            default_style=updated_settings.get("default_style", "Carousel slides"),
            emoji_density=updated_settings.get("emoji_density", "Medium"),
            auto_format_reach=updated_settings.get("auto_format_reach", True),
            publish_target=updated_settings.get("publish_target", "person"),
            organization_id=updated_settings.get("organization_id"),
            max_posts_per_day=updated_settings.get("max_posts_per_day", 1),
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update settings"
        )


@router.post("/reset", response_model=UserSettings)
@limiter.limit("10/minute")
async def reset_settings(
    request: Request,
    user_id: str = Depends(get_current_user_id)
):
    """
    Reset settings to defaults.
    
    Args:
        user_id: Authenticated user ID
        
    Returns:
        Default settings
    """
    try:
        default_settings = {
            "default_tone": "professional",
            "auto_post": False,
            "notification_email": True,
            "preferred_content_types": [],
            "default_goal": "Authority",
            "default_audience": "General Professionals",
            "default_style": "Carousel slides",
            "emoji_density": "Medium",
            "auto_format_reach": True,
            "publish_target": "person",
            "organization_id": None,
            "max_posts_per_day": 1,
        }
        
        await update_user_settings(user_id, default_settings)
        
        # Log event
        await log_audit_event(
            user_id=user_id,
            event_type="settings_reset",
            details={},
            ip_address=get_client_ip(request)
        )
        
        logger.info(f"Settings reset for user {user_id}")
        
        return UserSettings(**default_settings)
        
    except Exception as e:
        logger.error(f"Failed to reset settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset settings"
        )
