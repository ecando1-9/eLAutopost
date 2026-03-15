"""
Supabase client initialization and database utilities.

This module provides:
- Supabase client setup
- Database connection management
- Row Level Security (RLS) helpers
- Multi-tenant data isolation

Security:
- Service role key used only for admin operations
- Anon key for client-side operations
- RLS enforced on all tables
- User context passed to all queries
"""

from supabase import create_client, Client
from typing import Optional, Dict, Any
from ..core.config import settings, logger


class SupabaseClient:
    """
    Wrapper for Supabase client with security best practices.
    
    Provides two clients:
    - Admin client (service role): For server-side operations
    - User client (anon key): For user-scoped operations
    """
    
    def __init__(self):
        """
        Initialize Supabase clients.
        
        Security Notes:
        - Service role key has full access (use carefully)
        - Anon key respects RLS policies
        - Never expose service role key to client
        """
        # Admin client for server-side operations
        self._admin_client: Client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_KEY
        )
        
        # User client for RLS-protected operations
        self._user_client: Client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_KEY
        )
        
        logger.info("Supabase clients initialized")
    
    @property
    def admin(self) -> Client:
        """
        Get admin client with full access.
        
        WARNING: Use only for:
        - User creation
        - Admin operations
        - Migrations
        
        Never use for user-scoped queries (use get_user_client instead)
        """
        return self._admin_client
    
    @property
    def client(self) -> Client:
        """Get standard client (respects RLS)."""
        return self._user_client
    
    def get_user_client(self, access_token: str) -> Client:
        """
        Get a client scoped to a specific user.
        
        This client will respect RLS policies and only access
        data belonging to the authenticated user.
        
        Args:
            access_token: User's JWT access token
            
        Returns:
            Supabase client with user context
        """
        client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_KEY
        )
        
        # Set user context
        client.auth.set_session(access_token, "")
        
        return client
    
    async def verify_user_access(
        self,
        user_id: str,
        resource_id: str,
        table: str
    ) -> bool:
        """
        Verify user has access to a specific resource.
        
        This is an additional security check beyond RLS.
        
        Args:
            user_id: User ID to check
            resource_id: Resource ID to check access for
            table: Table name
            
        Returns:
            True if user has access, False otherwise
        """
        try:
            result = self._admin_client.table(table).select("id").eq(
                "id", resource_id
            ).eq("user_id", user_id).execute()
            
            return len(result.data) > 0
            
        except Exception as e:
            logger.error(f"Access verification failed: {e}")
            return False


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================
supabase_client = SupabaseClient()


# =============================================================================
# DATABASE HELPERS
# =============================================================================
async def create_user_record(
    user_id: str,
    email: str,
    full_name: str,
    auth_provider: str = "email"
) -> Dict[str, Any]:
    """
    Create a user record in the database.
    
    This is called after successful authentication to create
    the user's profile in our database.
    
    Args:
        user_id: Supabase auth user ID
        email: User email
        full_name: User's full name
        auth_provider: Authentication provider (email, google, linkedin)
        
    Returns:
        Created user record
    """
    try:
        result = supabase_client.admin.table("users").insert({
            "id": user_id,
            "email": email,
            "full_name": full_name,
            "auth_provider": auth_provider
        }).execute()
        
        logger.info(f"Created user record for {email}")
        return result.data[0]
        
    except Exception as e:
        logger.error(f"Failed to create user record: {e}")
        raise


async def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """
    Get user record by ID.
    
    Args:
        user_id: User ID
        
    Returns:
        User record or None if not found
    """
    try:
        result = supabase_client.admin.table("users").select("*").eq(
            "id", user_id
        ).single().execute()
        
        return result.data
        
    except Exception as e:
        logger.warning(f"User not found: {user_id}")
        return None


async def update_user_settings(
    user_id: str,
    settings_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Update user settings.
    
    Args:
        user_id: User ID
        settings_data: Settings to update
        
    Returns:
        Updated settings record
    """
    try:
        # Check if settings exist
        existing = supabase_client.admin.table("settings").select("*").eq(
            "user_id", user_id
        ).execute()
        
        if existing.data:
            # Update existing
            result = supabase_client.admin.table("settings").update(
                settings_data
            ).eq("user_id", user_id).execute()
        else:
            # Create new
            settings_data["user_id"] = user_id
            result = supabase_client.admin.table("settings").insert(
                settings_data
            ).execute()
        
        return result.data[0]
        
    except Exception as e:
        logger.error(f"Failed to update settings: {e}")
        raise


async def log_audit_event(
    user_id: Optional[str],
    event_type: str,
    details: Dict[str, Any],
    ip_address: Optional[str] = None
):
    """
    Log an audit event.
    
    All security-relevant events should be logged for compliance
    and security monitoring.
    
    Args:
        user_id: User ID (if authenticated)
        event_type: Type of event
        details: Event details
        ip_address: Client IP address
    """
    try:
        supabase_client.admin.table("audit_logs").insert({
            "user_id": user_id,
            "event_type": event_type,
            "details": details,
            "ip_address": ip_address
        }).execute()
        
    except Exception as e:
        logger.error(f"Failed to log audit event: {e}")
        # Don't raise - logging failure shouldn't break the app
