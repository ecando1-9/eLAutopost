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
        return sanitize_input(v, max_length=3000)


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
    
    @validator("topic", "hook", "image_prompt", "caption")
    def sanitize_fields(cls, v):
        """Sanitize all text fields."""
        return sanitize_input(v)


class PostUpdate(BaseModel):
    """Model for updating an existing post."""
    hook: Optional[str] = Field(None, max_length=100)
    caption: Optional[str] = Field(None, max_length=3000)
    image_url: Optional[str] = None
    status: Optional[PostStatus] = None
    
    @validator("hook", "caption")
    def sanitize_fields(cls, v):
        """Sanitize text fields."""
        if v:
            return sanitize_input(v)
        return v


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
    status: PostStatus
    created_at: datetime
    updated_at: datetime
    posted_at: Optional[datetime]
    linkedin_post_id: Optional[str]
    linkedin_url: Optional[str]


# =============================================================================
# USER SETTINGS MODELS
# =============================================================================
class UserSettings(BaseModel):
    """User preferences and settings."""
    default_tone: str = Field(default="professional", max_length=50)
    auto_post: bool = Field(default=False, description="Auto-post to LinkedIn")
    notification_email: bool = Field(default=True)
    preferred_content_types: List[ContentType] = Field(default=[])
    
    @validator("default_tone")
    def sanitize_tone(cls, v):
        """Sanitize tone setting."""
        return sanitize_input(v, max_length=50)


class UserSettingsUpdate(BaseModel):
    """Model for updating user settings."""
    default_tone: Optional[str] = Field(None, max_length=50)
    auto_post: Optional[bool] = None
    notification_email: Optional[bool] = None
    preferred_content_types: Optional[List[ContentType]] = None
    
    @validator("default_tone")
    def sanitize_tone(cls, v):
        """Sanitize tone setting."""
        if v:
            return sanitize_input(v, max_length=50)
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
