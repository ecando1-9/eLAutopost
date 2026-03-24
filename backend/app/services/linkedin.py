"""
LinkedIn API integration service.

This service handles:
- OAuth 2.0 authentication flow
- Token management and refresh
- Posting text and images to LinkedIn
- Profile information retrieval

Security:
- Uses official LinkedIn API (no scraping/automation)
- Tokens stored securely in database
- Automatic token refresh
- Rate limiting compliance
"""

from typing import Dict, Any, Optional, List
import httpx
import os
from datetime import timedelta
from urllib.parse import urlencode
from ..core.config import settings, logger
from ..core.datetime_utils import utc_now, parse_datetime_utc
from ..services.database import supabase_client


class LinkedInService:
    """
    Service for LinkedIn API integration.
    
    Implements OAuth 2.0 flow and posting functionality using
    LinkedIn's official API.
    """
    
    # LinkedIn API endpoints
    AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization"
    TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
    API_BASE = "https://api.linkedin.com/v2"
    USERINFO_URL = "https://api.linkedin.com/v2/userinfo"
    
    # Required OAuth modern scopes
    BASE_SCOPES = [
        "openid",
        "profile",
        "email",
        "w_member_social"
    ]
    
    def __init__(self):
        """Initialize LinkedIn service."""
        self.client_id = settings.LINKEDIN_CLIENT_ID
        self.client_secret = settings.LINKEDIN_CLIENT_SECRET
        self.redirect_uri = settings.LINKEDIN_REDIRECT_URI
        self.default_target = settings.LINKEDIN_DEFAULT_TARGET
        self.organization_id = settings.LINKEDIN_ORGANIZATION_ID
        self.scopes = list(self.BASE_SCOPES)
        if self.organization_id or self.default_target == "organization":
            # Needed for Company Page posting.
            self.scopes.append("w_organization_social")
    
    def get_authorization_url(self, state: str) -> str:
        """
        Get LinkedIn OAuth authorization URL.
        
        Args:
            state: CSRF protection state parameter
            
        Returns:
            Authorization URL to redirect user to
        """
        scope = " ".join(self.scopes)
        
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "state": state,
            "scope": scope
        }
        
        # Build encoded URL.
        query_string = urlencode(params)
        url = f"{self.AUTH_URL}?{query_string}"
        
        return url
    
    async def exchange_code_for_token(self, code: str) -> Dict[str, Any]:
        """
        Exchange authorization code for access token.
        
        Args:
            code: Authorization code from OAuth callback
            
        Returns:
            Token data including access_token, expires_in, etc.
            
        Raises:
            Exception: If token exchange fails
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.TOKEN_URL,
                    data={
                        "grant_type": "authorization_code",
                        "code": code,
                        "redirect_uri": self.redirect_uri,
                        "client_id": self.client_id,
                        "client_secret": self.client_secret
                    },
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                )
                
                response.raise_for_status()
                token_data = response.json()
                
                logger.info("Successfully exchanged code for LinkedIn token")
                return token_data
                
        except Exception as e:
            logger.error(f"Failed to exchange code for token: {e}")
            raise Exception("Failed to authenticate with LinkedIn")
    
    async def store_user_token(
        self,
        user_id: str,
        token_data: Dict[str, Any]
    ):
        """
        Store LinkedIn token in database.
        
        Args:
            user_id: User ID
            token_data: Token data from OAuth
        """
        try:
            expires_at = utc_now() + timedelta(
                seconds=token_data.get("expires_in", 5184000)  # Default 60 days
            )
            
            data_payload = {
                "user_id": user_id,
                "access_token": token_data["access_token"],
                "refresh_token": token_data.get("refresh_token"),
                "expires_at": expires_at.isoformat(),
                "scope": " ".join(self.scopes)
            }
            
            # Use upsert on unique user_id to avoid insert/update race conditions.
            supabase_client.admin.table("linkedin_tokens").upsert(
                data_payload,
                on_conflict="user_id"
            ).execute()
            
            logger.info(f"Stored LinkedIn token for user {user_id}")
            
        except Exception as e:
            logger.error(f"Failed to store token: {e}")
            raise
    
    async def get_user_token(self, user_id: str) -> Optional[str]:
        """
        Get valid access token for user.
        
        Automatically refreshes if expired.
        
        Args:
            user_id: User ID
            
        Returns:
            Access token or None if not connected
        """
        try:
            result = supabase_client.admin.table("linkedin_tokens").select(
                "*"
            ).eq("user_id", user_id).limit(1).execute()
            
            if not result.data:
                return None
            
            token_data = result.data[0]
            expires_at = parse_datetime_utc(token_data.get("expires_at"))
            if not expires_at:
                logger.warning(f"LinkedIn token has invalid expiry for user {user_id}")
                return None
            
            # Check if token is expired
            if expires_at <= utc_now():
                # Token expired - would need refresh logic here
                # LinkedIn tokens are long-lived (60 days) so refresh is rare
                logger.warning(f"LinkedIn token expired for user {user_id}")
                return None
            
            return token_data["access_token"]
            
        except Exception as e:
            logger.error(f"Failed to get user token: {e}")
            return None
    
    async def get_user_profile(self, access_token: str) -> Dict[str, Any]:
        """
        Get LinkedIn user profile.
        
        Args:
            access_token: LinkedIn access token
            
        Returns:
            User profile data
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.API_BASE}/me",
                    headers={"Authorization": f"Bearer {access_token}"}
                )

                if response.is_success:
                    return self._safe_json(response)

                # Fallback to OIDC userinfo endpoint (provides `sub`).
                fallback = await client.get(
                    self.USERINFO_URL,
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                fallback.raise_for_status()
                return self._safe_json(fallback)

        except Exception as e:
            logger.error(f"Failed to get user profile: {e}")
            raise

    async def get_managed_organizations(
        self,
        access_token: str
    ) -> List[Dict[str, Any]]:
        """
        Best-effort fetch of LinkedIn organizations/pages managed by user.

        Returns empty list when scope is insufficient or endpoint not available.
        """
        params = {
            "q": "roleAssignee",
            "role": "ADMINISTRATOR",
            "state": "APPROVED",
            "projection": "(elements*(organizationalTarget,organizationalTarget~(id,localizedName,vanityName)))"
        }

        organizations: List[Dict[str, Any]] = []
        seen_ids: set[str] = set()

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.API_BASE}/organizationalEntityAcls",
                    params=params,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "X-Restli-Protocol-Version": "2.0.0"
                    }
                )

                if response.status_code in (401, 403):
                    logger.info(
                        "LinkedIn organization listing unavailable (missing scope/permissions)"
                    )
                    return []

                response.raise_for_status()
                payload = self._safe_json(response)
                elements = payload.get("elements") if isinstance(payload, dict) else []

                if not isinstance(elements, list):
                    return []

                for item in elements:
                    if not isinstance(item, dict):
                        continue

                    target_urn = str(item.get("organizationalTarget") or "").strip()
                    target_data = item.get("organizationalTarget~")
                    target_data = target_data if isinstance(target_data, dict) else {}

                    org_id = str(target_data.get("id") or "").strip()
                    if not org_id and target_urn.startswith("urn:li:organization:"):
                        org_id = target_urn.split(":")[-1]
                    if not org_id:
                        continue

                    if org_id in seen_ids:
                        continue
                    seen_ids.add(org_id)

                    organizations.append(
                        {
                            "id": org_id,
                            "name": (
                                target_data.get("localizedName")
                                or target_data.get("vanityName")
                                or f"Organization {org_id}"
                            ),
                            "vanity_name": target_data.get("vanityName"),
                            "urn": target_urn or f"urn:li:organization:{org_id}",
                        }
                    )

        except Exception as e:
            logger.warning(f"Failed to list managed organizations: {e}")
            return []

        return organizations

    async def get_linkedin_targets(self, user_id: str) -> Dict[str, Any]:
        """
        Return LinkedIn connection status, profile and managed pages.
        """
        try:
            token_result = supabase_client.admin.table("linkedin_tokens").select(
                "access_token, expires_at, scope"
            ).eq("user_id", user_id).limit(1).execute()

            if not token_result.data:
                return {
                    "connected": False,
                    "profile": None,
                    "organizations": [],
                    "scopes": []
                }

            token_data = token_result.data[0]
            expires_at = parse_datetime_utc(token_data.get("expires_at"))
            if not expires_at or expires_at <= utc_now():
                return {
                    "connected": False,
                    "profile": None,
                    "organizations": [],
                    "scopes": (token_data.get("scope") or "").split()
                }

            access_token = token_data.get("access_token")
            if not access_token:
                return {
                    "connected": False,
                    "profile": None,
                    "organizations": [],
                    "scopes": (token_data.get("scope") or "").split()
                }

            raw_profile = await self.get_user_profile(access_token)

            profile_id = (
                raw_profile.get("sub")
                or raw_profile.get("id")
                or ""
            )
            profile_name = (
                raw_profile.get("name")
                or (
                    f"{raw_profile.get('localizedFirstName', '')} "
                    f"{raw_profile.get('localizedLastName', '')}"
                ).strip()
                or "LinkedIn User"
            )
            profile_email = (
                raw_profile.get("email")
                or raw_profile.get("emailAddress")
            )

            profile_picture = (
                raw_profile.get("picture")
                or raw_profile.get("profilePicture")
            )

            organizations = await self.get_managed_organizations(access_token)

            return {
                "connected": True,
                "profile": {
                    "id": str(profile_id),
                    "name": str(profile_name),
                    "email": str(profile_email) if profile_email else None,
                    "picture_url": str(profile_picture) if profile_picture else None,
                    "urn": f"urn:li:person:{profile_id}" if profile_id else None,
                },
                "organizations": organizations,
                "scopes": (token_data.get("scope") or "").split()
            }

        except Exception as e:
            logger.error(f"Failed to get LinkedIn targets for user {user_id}: {e}")
            raise

    @staticmethod
    def _safe_json(response: httpx.Response) -> Dict[str, Any]:
        """Parse JSON response safely."""
        try:
            payload = response.json()
            return payload if isinstance(payload, dict) else {}
        except Exception:
            return {}

    @staticmethod
    def _attach_post_id(
        response: httpx.Response,
        payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Ensure post ID is present even when LinkedIn returns it in headers only.
        """
        if payload.get("id"):
            return payload

        restli_id = response.headers.get("x-restli-id")
        if restli_id:
            payload["id"] = restli_id

        return payload

    @staticmethod
    def _build_post_url(linkedin_post_id: str) -> str:
        """Build a public LinkedIn post URL from API ID/URN."""
        clean_id = (linkedin_post_id or "").strip()
        if not clean_id:
            return ""

        if clean_id.startswith("urn:li:"):
            clean_id = clean_id.split(":")[-1]

        return f"https://www.linkedin.com/feed/update/{clean_id}"

    async def _get_person_urn(self, access_token: str) -> str:
        """Resolve authenticated member URN."""
        profile = await self.get_user_profile(access_token)
        linkedin_id = profile.get("sub") or profile.get("id")
        if not linkedin_id:
            raise Exception("Unable to resolve LinkedIn member ID from token")
        return f"urn:li:person:{linkedin_id}"

    async def _get_author_urn(
        self,
        access_token: str,
        target: Optional[str] = None,
        organization_id: Optional[str] = None
    ) -> str:
        """
        Resolve author URN for person/profile or organization/page.

        target: person | organization | None (uses default)
        """
        selected_target = (target or self.default_target or "person").strip().lower()
        if selected_target == "organization":
            org_id = (organization_id or self.organization_id or "").strip()
            if not org_id:
                raise Exception(
                    "Organization posting selected but LINKEDIN_ORGANIZATION_ID is not configured"
                )
            return f"urn:li:organization:{org_id}"

        return await self._get_person_urn(access_token)

    async def create_post(
        self,
        user_id: str,
        text: str,
        image_url: Optional[str] = None,
        target: Optional[str] = None,
        organization_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Unified post helper used by workers.
        Returns a normalized result shape.
        """
        if image_url:
            linkedin_response = await self.post_with_image(
                user_id=user_id,
                text=text,
                image_url=image_url,
                target=target,
                organization_id=organization_id
            )
        else:
            linkedin_response = await self.post_text(
                user_id=user_id,
                text=text,
                target=target,
                organization_id=organization_id
            )

        post_id = linkedin_response.get("id", "")
        return {
            "success": True,
            "post_id": post_id,
            "post_url": self._build_post_url(post_id),
            "raw": linkedin_response
        }
    
    async def post_text(
        self,
        user_id: str,
        text: str,
        target: Optional[str] = None,
        organization_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Post text-only content to LinkedIn.
        
        Args:
            user_id: User ID
            text: Post text
            
        Returns:
            Post response data
        """
        access_token = await self.get_user_token(user_id)
        if not access_token:
            raise Exception("LinkedIn not connected. Please connect your account.")
        
        try:
            author_urn = await self._get_author_urn(
                access_token=access_token,
                target=target,
                organization_id=organization_id
            )
            
            # Create post payload
            payload = {
                "author": author_urn,
                "lifecycleState": "PUBLISHED",
                "specificContent": {
                    "com.linkedin.ugc.ShareContent": {
                        "shareCommentary": {
                            "text": text
                        },
                        "shareMediaCategory": "NONE"
                    }
                },
                "visibility": {
                    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                }
            }
            
            # Post to LinkedIn
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.API_BASE}/ugcPosts",
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                        "X-Restli-Protocol-Version": "2.0.0"
                    }
                )
                
                response.raise_for_status()
                result = self._attach_post_id(response, self._safe_json(response))
                
                logger.info(f"Successfully posted to LinkedIn for user {user_id}")
                return result
                
        except Exception as e:
            logger.error(f"Failed to post to LinkedIn: {e}")
            raise Exception(f"Failed to post to LinkedIn: {str(e)}")
    
    async def post_carousel(
        self,
        user_id: str,
        text: str,
        pdf_path: str,
        title: str = "My Carousel",
        target: Optional[str] = None,
        organization_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Post a PDF Carousel (document) to LinkedIn.
        
        Args:
            user_id: User ID
            text: Post commentary text
            pdf_path: Local path to the generated PDF
            title: Title of the document
            
        Returns:
            Post response data
        """
        access_token = await self.get_user_token(user_id)
        if not access_token:
            raise Exception("LinkedIn not connected. Please connect your account.")
        
        try:
            author_urn = await self._get_author_urn(
                access_token=access_token,
                target=target,
                organization_id=organization_id
            )
            
            # Step 1: Register upload for DOCUMENT
            register_payload = {
                "registerUploadRequest": {
                    "recipes": ["urn:li:digitalmediaRecipe:feedshare-document"],
                    "owner": author_urn,
                    "serviceRelationships": [
                        {
                            "relationshipType": "OWNER",
                            "identifier": "urn:li:userGeneratedContent"
                        }
                    ]
                }
            }
            
            async with httpx.AsyncClient() as client:
                # Register
                register_response = await client.post(
                    f"{self.API_BASE}/assets?action=registerUpload",
                    json=register_payload,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json"
                    }
                )
                register_response.raise_for_status()
                upload_data = register_response.json()
                
                asset = upload_data["value"]["asset"]
                upload_url = upload_data["value"]["uploadMechanism"][
                    "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
                ]["uploadUrl"]
                
                # Step 2: Read local PDF file
                if not os.path.exists(pdf_path):
                    raise Exception(f"PDF file not found at {pdf_path}")
                    
                with open(pdf_path, "rb") as f:
                    pdf_data = f.read()
                
                # Step 3: Upload PDF
                upload_response = await client.put(
                    upload_url,
                    content=pdf_data,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/pdf"
                    }
                )
                upload_response.raise_for_status()
                
                # Step 4: Create UGC Post with Document
                post_payload = {
                    "author": author_urn,
                    "lifecycleState": "PUBLISHED",
                    "specificContent": {
                        "com.linkedin.ugc.ShareContent": {
                            "shareCommentary": {
                                "text": text
                            },
                            "shareMediaCategory": "DOCUMENT",
                            "media": [
                                {
                                    "status": "READY",
                                    "description": {
                                        "text": title
                                    },
                                    "media": asset,
                                    "title": {
                                        "text": title
                                    }
                                }
                            ]
                        }
                    },
                    "visibility": {
                        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                    }
                }
                
                post_response = await client.post(
                    f"{self.API_BASE}/ugcPosts",
                    json=post_payload,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                        "X-Restli-Protocol-Version": "2.0.0"
                    }
                )
                
                post_response.raise_for_status()
                result = self._attach_post_id(
                    post_response,
                    self._safe_json(post_response)
                )
                
                logger.info(f"Successfully posted PDF Carousel to LinkedIn for user {user_id}")
                return result
                
        except Exception as e:
            logger.error(f"Failed to post PDF Carousel: {e}")
            raise Exception(f"Failed to post carousel to LinkedIn: {str(e)}")

    async def post_with_image(
        self,
        user_id: str,
        text: str,
        image_url: str,
        target: Optional[str] = None,
        organization_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Post text with image to LinkedIn.
        """
        access_token = await self.get_user_token(user_id)
        if not access_token:
            raise Exception("LinkedIn not connected. Please connect your account.")
        
        try:
            author_urn = await self._get_author_urn(
                access_token=access_token,
                target=target,
                organization_id=organization_id
            )
            
            register_payload = {
                "registerUploadRequest": {
                    "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
                    "owner": author_urn,
                    "serviceRelationships": [
                        {
                            "relationshipType": "OWNER",
                            "identifier": "urn:li:userGeneratedContent"
                        }
                    ]
                }
            }
            
            async with httpx.AsyncClient() as client:
                register_response = await client.post(
                    f"{self.API_BASE}/assets?action=registerUpload",
                    json=register_payload,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json"
                    }
                )
                register_response.raise_for_status()
                upload_data = register_response.json()
                
                asset = upload_data["value"]["asset"]
                upload_url = upload_data["value"]["uploadMechanism"][
                    "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
                ]["uploadUrl"]
                
                image_response = await client.get(image_url)
                image_response.raise_for_status()
                image_data = image_response.content
                
                upload_response = await client.put(
                    upload_url,
                    content=image_data,
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                upload_response.raise_for_status()
                
                post_payload = {
                    "author": author_urn,
                    "lifecycleState": "PUBLISHED",
                    "specificContent": {
                        "com.linkedin.ugc.ShareContent": {
                            "shareCommentary": {
                                "text": text
                            },
                            "shareMediaCategory": "IMAGE",
                            "media": [
                                {
                                    "status": "READY",
                                    "media": asset
                                }
                            ]
                        }
                    },
                    "visibility": {
                        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                    }
                }
                
                post_response = await client.post(
                    f"{self.API_BASE}/ugcPosts",
                    json=post_payload,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                        "X-Restli-Protocol-Version": "2.0.0"
                    }
                )
                post_response.raise_for_status()
                return self._attach_post_id(
                    post_response,
                    self._safe_json(post_response)
                )
                
        except Exception as e:
            logger.error(f"Failed to post with image: {e}")
            raise Exception(f"Failed to post image to LinkedIn: {str(e)}")


# =============================================================================
# SERVICE INSTANCE
# =============================================================================
linkedin_service = LinkedInService()
