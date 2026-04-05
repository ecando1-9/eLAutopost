"""
Pydantic models for request/response validation.

This module defines all data models used in the API with:
- Strict type validation
- Length constraints
- Format validation
- Sanitization
- Clear error messages

All models follow OWASP input validation best practices.
"""

from pydantic import BaseModel, Field, validator, EmailStr
from typing import Optional, List, Literal
from datetime import datetime
from enum import Enum
from ..core.security import sanitize_input, validate_email
from ..core.text_utils import strip_markdown_formatting


# =============================================================================
# ENUMS
# =============================================================================
class ContentType(str, Enum):
    """Content classification types for LinkedIn posts."""
    ALERT = "alert"
    CURIOSITY = "curiosity"
    INSIGHT = "insight"
    FUTURE = "future"


class PostStatus(str, Enum):
    """Status of a LinkedIn post."""
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"  # Auto-generated, awaiting user approval
    SCHEDULED = "scheduled"
    RUNNING = "running"              # Currently being posted (prevents double-post)
    PENDING = "pending"
    POSTED = "posted"
    FAILED = "failed"


# =============================================================================
# AUTHENTICATION MODELS
# =============================================================================
class UserSignup(BaseModel):
    """
    User signup request model.
    
    Security:
    - Email validated for format
    - Password minimum length enforced
    - All inputs sanitized
    """
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Password (min 8 characters)"
    )
    full_name: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="User's full name"
    )
    
    @validator("full_name")
    def sanitize_name(cls, v):
        """Sanitize name to prevent XSS."""
        return sanitize_input(v, max_length=100)
    
    @validator("password")
    def validate_password_strength(cls, v):
        """
        Validate password strength.
        
        Requirements:
        - At least 8 characters
        - Contains uppercase and lowercase
        - Contains at least one number
        """
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        
        return v


class UserLogin(BaseModel):
    """User login request model."""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., description="User password")


class TokenResponse(BaseModel):
    """JWT token response model."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: str


class UserProfile(BaseModel):
    """User profile response model."""
    id: str
    email: str
    full_name: str
    created_at: datetime
    linkedin_connected: bool = False
    google_connected: bool = False


# =============================================================================
# CONTENT GENERATION MODELS
# =============================================================================
class ContentGenerationRequest(BaseModel):
    """
    Request model for AI content generation with growth strategy.
    
    Now supports user goals, target audience, and content style.
    """
    topic: str = Field(
        ...,
        min_length=3,
        max_length=200,
        description="Topic for content generation"
    )
    goal: Optional[str] = Field(
        "Authority",
        description="Goal: Reach, Knowledge, Authority, Discussion, Promotion, Research"
    )
    audience: Optional[str] = Field(
        "General professionals",
        description="Target: Students, Developers, Founders, Recruiters, Business owners, etc."
    )
    style: Optional[str] = Field(
        "Carousel slides",
        description="Format: Storytelling, List format, Question format, Thread style, Carousel slides, Problem → Solution"
    )
    tone: Optional[str] = Field(
        "professional",
        max_length=50,
        description="Tone: professional, casual, bold, witty, academic"
    )
    instructions: Optional[str] = Field(
        "",
        max_length=500,
        description="Optional custom instructions"
    )
    
    @validator("topic", "goal", "audience", "style", "tone", "instructions")
    def sanitize_all_inputs(cls, v):
        """Sanitize all string inputs."""
        if v:
            return sanitize_input(v)
        return v


class GeneratedContent(BaseModel):
    """Response model for generated content including strategy insights."""
    hook: str = Field(..., description="Main viral hook")
    caption: str = Field(..., description="LinkedIn caption")
    image_prompt: Optional[str] = Field(default=None, description="Optional image prompt")
    slides: List[str] = Field(..., min_items=6, max_items=10, description="Content for carousel slides")
    cta: str = Field(..., description="Call to action question")
    hashtags: List[str] = Field(default=[], description="Suggested hashtags")
    hook_variations: List[str] = Field(default=[], description="5 alternative hooks for testing")
    engagement_score: int = Field(default=80, ge=0, le=100, description="Predicted engagement score")
    quality_score: int = Field(default=85, ge=0, le=100, description="Content quality score (clarity, value, structure)")
    content_type: ContentType = Field(default=ContentType.INSIGHT)


# =============================================================================
# LINKEDIN POSTING MODELS
# =============================================================================
class LinkedInPostRequest(BaseModel):
    """
    Request model for posting to LinkedIn.
    
    Security:
    - All text fields sanitized
    - Image URL validated
    - User authorization checked
    """
    caption: str = Field(
        ...,
        max_length=3000,  # LinkedIn's limit
        description="Post caption"
    )
    image_url: Optional[str] = Field(
        None,
        max_length=2048,
        description="URL of image to post"
    )
    
    @validator("caption")
    def sanitize_caption(cls, v):
        """Sanitize caption while preserving formatting."""
        # LinkedIn allows some formatting, so we're more lenient here
        # but still prevent script injection
        return strip_markdown_formatting(sanitize_input(v, max_length=3000))


class LinkedInPostResponse(BaseModel):
    """Response model for LinkedIn post."""
    post_id: str
    status: PostStatus
    posted_at: Optional[datetime]
    linkedin_url: Optional[str]
    error_message: Optional[str]


# =============================================================================
# POST MANAGEMENT MODELS
# =============================================================================
class PostCreate(BaseModel):
    """Model for creating a new post draft."""
    topic: str = Field(..., max_length=200)
    hook: str = Field(..., max_length=100)
    image_prompt: str = Field(..., max_length=500)
    caption: str = Field(..., max_length=3000)
    content_type: ContentType
    image_url: Optional[str] = None
    target: Optional[Literal["person", "organization"]] = Field(
        default="person",
        description="LinkedIn publish target"
    )
    organization_id: Optional[str] = Field(
        default=None,
        max_length=64,
        description="LinkedIn organization/page ID for page posting"
    )
    
    @validator("topic", "hook", "image_prompt", "caption")
    def sanitize_fields(cls, v):
        """Sanitize all text fields."""
        return strip_markdown_formatting(sanitize_input(v))

    @validator("organization_id")
    def sanitize_organization_id(cls, v):
        if v is None:
            return v
        return sanitize_input(v, max_length=64).strip()


class PostUpdate(BaseModel):
    """Model for updating an existing post."""
    topic: Optional[str] = Field(None, max_length=200)
    hook: Optional[str] = Field(None, max_length=100)
    caption: Optional[str] = Field(None, max_length=3000)
    image_url: Optional[str] = None
    status: Optional[PostStatus] = None
    target: Optional[Literal["person", "organization"]] = None
    organization_id: Optional[str] = Field(None, max_length=64)
    
    @validator("topic", "hook", "caption")
    def sanitize_fields(cls, v):
        """Sanitize text fields."""
        if v:
            return strip_markdown_formatting(sanitize_input(v))
        return v

    @validator("organization_id")
    def sanitize_update_organization_id(cls, v):
        if v is None:
            return v
        return sanitize_input(v, max_length=64).strip()


class PostResponse(BaseModel):
    """Response model for post data."""
    id: str
    user_id: str
    topic: str
    hook: str
    image_prompt: str
    caption: str
    content_type: ContentType
    image_url: Optional[str]
    target: Optional[str] = "person"
    organization_id: Optional[str] = None
    status: PostStatus
    created_at: datetime
    updated_at: datetime
    posted_at: Optional[datetime]
    linkedin_post_id: Optional[str]
    linkedin_url: Optional[str]
    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    impressions_count: int = 0
    last_stats_update: Optional[datetime] = None


# =============================================================================
# USER SETTINGS MODELS
# =============================================================================
class UserSettings(BaseModel):
    """User preferences and settings."""
    default_tone: str = Field(default="professional", max_length=50)
    auto_post: bool = Field(default=False, description="Auto-post to LinkedIn")
    notification_email: bool = Field(default=True)
    preferred_content_types: List[ContentType] = Field(default=[])
    default_goal: str = Field(default="Authority", max_length=80)
    default_audience: str = Field(default="General Professionals", max_length=120)
    default_style: str = Field(default="Carousel slides", max_length=120)
    emoji_density: Literal["None", "Low", "Medium", "High"] = Field(default="Medium")
    auto_format_reach: bool = Field(default=True)
    publish_target: str = Field(default="person", pattern="^(person|organization|both)$")
    organization_id: Optional[str] = Field(default=None, max_length=64)
    max_posts_per_day: int = Field(default=1, ge=1, le=10, description="Max posts per day")
    
    @validator("default_tone", "default_goal", "default_audience", "default_style")
    def sanitize_settings_text(cls, v):
        """Sanitize settings text fields."""
        if v:
            return sanitize_input(v, max_length=120)
        return v

    @validator("organization_id")
    def sanitize_org_id(cls, v):
        """Sanitize optional organization/page id."""
        if v:
            return sanitize_input(v, max_length=64).strip()
        return v


class UserSettingsUpdate(BaseModel):
    """Model for updating user settings."""
    default_tone: Optional[str] = Field(None, max_length=50)
    auto_post: Optional[bool] = None
    notification_email: Optional[bool] = None
    preferred_content_types: Optional[List[ContentType]] = None
    default_goal: Optional[str] = Field(None, max_length=80)
    default_audience: Optional[str] = Field(None, max_length=120)
    default_style: Optional[str] = Field(None, max_length=120)
    emoji_density: Optional[Literal["None", "Low", "Medium", "High"]] = None
    auto_format_reach: Optional[bool] = None
    publish_target: Optional[str] = Field(None, pattern="^(person|organization|both)$")
    organization_id: Optional[str] = Field(None, max_length=64)
    max_posts_per_day: Optional[int] = Field(None, ge=1, le=10)
    
    @validator("default_tone", "default_goal", "default_audience", "default_style")
    def sanitize_update_text_fields(cls, v):
        """Sanitize settings text fields."""
        if v:
            return sanitize_input(v, max_length=120)
        return v

    @validator("organization_id")
    def sanitize_update_org_id(cls, v):
        """Sanitize optional organization/page id."""
        if v:
            return sanitize_input(v, max_length=64).strip()
        return v


# =============================================================================
# OAUTH MODELS
# =============================================================================
class OAuthCallback(BaseModel):
    """OAuth callback data."""
    code: str = Field(..., description="OAuth authorization code")
    state: Optional[str] = Field(None, description="CSRF protection state")
    
    @validator("code", "state")
    def sanitize_oauth_params(cls, v):
        """Sanitize OAuth parameters."""
        if v:
            return sanitize_input(v, max_length=500)
        return v


# =============================================================================
# ERROR MODELS
# =============================================================================
class ErrorResponse(BaseModel):
    """Standard error response model."""
    error: str
    message: str
    details: Optional[dict] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# =============================================================================
# PAGINATION MODELS
# =============================================================================
class PaginationParams(BaseModel):
    """Pagination parameters for list endpoints."""
    page: int = Field(default=1, ge=1, description="Page number")
    page_size: int = Field(default=20, ge=1, le=100, description="Items per page")


class PaginatedResponse(BaseModel):
    """Generic paginated response."""
    items: List[dict]
    total: int
    page: int
    page_size: int
    total_pages: int
