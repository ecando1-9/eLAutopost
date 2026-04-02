"""
Core configuration module for the LinkedIn Automation SaaS application.

This module handles:
- Environment variable loading and validation
- Application settings management
- Security configuration
- API credentials management

Security Notes:
- All sensitive data loaded from environment variables
- No hardcoded secrets
- Validates required configuration on startup
- Supports multiple environments (dev, staging, prod)
"""

from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator, model_validator
import os
from pathlib import Path


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    
    All sensitive configuration (API keys, secrets) must be provided
    via environment variables. This prevents accidental exposure in
    version control and supports secure deployment practices.
    """
    
    # =============================================================================
    # APPLICATION SETTINGS
    # =============================================================================
    APP_NAME: str = "LinkedIn Content Automation"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = Field(default="development", env="ENVIRONMENT")
    DEBUG: bool = Field(default=False, env="DEBUG")
    
    # API Configuration
    API_V1_PREFIX: str = "/api/v1"
    BACKEND_CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:3000"],
        env="BACKEND_CORS_ORIGINS"
    )
    
    # =============================================================================
    # SUPABASE CONFIGURATION
    # =============================================================================
    SUPABASE_URL: Optional[str] = Field(default=None, env="SUPABASE_URL")
    SUPABASE_KEY: Optional[str] = Field(default=None, env="SUPABASE_KEY")
    SUPABASE_SERVICE_KEY: Optional[str] = Field(default=None, env="SUPABASE_SERVICE_KEY")
    
    # =============================================================================
    # SECURITY SETTINGS
    # =============================================================================
    SECRET_KEY: Optional[str] = Field(default=None, env="SECRET_KEY")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 4320  # 3 days (3 * 24 * 60)
    
    # =============================================================================
    # OPENAI CONFIGURATION
    # =============================================================================
    OPENAI_API_KEY: Optional[str] = Field(default=None, env="OPENAI_API_KEY")
    OPENAI_MODEL: str = Field(default="gpt-4-turbo-preview", env="OPENAI_MODEL")
    OPENAI_IMAGE_MODEL: str = Field(default="dall-e-3", env="OPENAI_IMAGE_MODEL")

    # =============================================================================
    # GOOGLE GEMINI CONFIGURATION (FREE TEXT GENERATION)
    # =============================================================================
    GOOGLE_API_KEY: Optional[str] = Field(default=None, env="GOOGLE_API_KEY")
    GOOGLE_MODEL: str = Field(default="gemini-2.5-flash", env="GOOGLE_MODEL")
    
    # =============================================================================
    # LINKEDIN API CONFIGURATION
    # =============================================================================
    LINKEDIN_CLIENT_ID: Optional[str] = Field(default=None, env="LINKEDIN_CLIENT_ID")
    LINKEDIN_CLIENT_SECRET: Optional[str] = Field(default=None, env="LINKEDIN_CLIENT_SECRET")
    LINKEDIN_REDIRECT_URI: Optional[str] = Field(default=None, env="LINKEDIN_REDIRECT_URI")
    LINKEDIN_ORGANIZATION_ID: Optional[str] = Field(
        default=None, env="LINKEDIN_ORGANIZATION_ID"
    )
    LINKEDIN_DEFAULT_TARGET: str = Field(
        default="person", env="LINKEDIN_DEFAULT_TARGET"
    )
    
    # =============================================================================
    # GOOGLE OAUTH CONFIGURATION
    # =============================================================================
    GOOGLE_CLIENT_ID: str = Field(..., env="GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET: str = Field(..., env="GOOGLE_CLIENT_SECRET")
    
    # =============================================================================
    # RATE LIMITING
    # =============================================================================
    RATE_LIMIT_PER_MINUTE: int = Field(default=60, env="RATE_LIMIT_PER_MINUTE")
    RATE_LIMIT_PER_HOUR: int = Field(default=1000, env="RATE_LIMIT_PER_HOUR")
    
    # =============================================================================
    # LOGGING
    # =============================================================================
    LOG_LEVEL: str = Field(default="INFO", env="LOG_LEVEL")
    LOG_FILE: str = Field(default="logs/app.log", env="LOG_FILE")
    
    # =============================================================================
    # CONTENT GENERATION SETTINGS
    # =============================================================================
    MAX_CAPTION_LENGTH: int = 120
    MAX_HOOK_LENGTH: int = 7
    MIN_HOOK_LENGTH: int = 3
    
    # =============================================================================
    # DATABASE SETTINGS
    # =============================================================================
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20
    
    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v):
        """
        Parse CORS origins from string or list.
        Supports comma-separated string from environment variables.
        """
        if isinstance(v, str):
            # Strip brackets and quotes if present (JSON-like strings)
            cleaned = v.strip().lstrip("[").rstrip("]").replace("\"", "").replace("'", "")
            return [origin.strip() for origin in cleaned.split(",")]
        return v

    @model_validator(mode="after")
    def require_sensitive_fields(cls, values):
        """
        Require sensitive fields in production and warn in development.

        This runs after field validation, so we can inspect multiple fields and
        environment state together.
        """
        required_fields = [
            "SUPABASE_URL",
            "SUPABASE_KEY",
            "SUPABASE_SERVICE_KEY",
            "SECRET_KEY",
            "LINKEDIN_CLIENT_ID",
            "LINKEDIN_CLIENT_SECRET",
            "LINKEDIN_REDIRECT_URI",
            "GOOGLE_CLIENT_ID",
            "GOOGLE_CLIENT_SECRET",
        ]

        environment = (values.ENVIRONMENT or "development").lower()
        for field_name in required_fields:
            value = getattr(values, field_name, None)
            if not value:
                if environment == "production":
                    raise ValueError(
                        f"{field_name} is required in production. "
                        f"Set it in backend/.env (see YOUR_CONFIG.md)."
                    )
                print(
                    f"[WARNING] {field_name} is not set; running in development mode with reduced functionality."
                )

        return values

    @field_validator("SECRET_KEY")
    def validate_secret_key(cls, v):
        """
        Ensure SECRET_KEY is properly set and not using default/example value.
        This is critical for JWT token security.
        """
        if v is None:
            return v
        if v == "your-secret-key-here-generate-with-openssl":
            raise ValueError(
                "SECRET_KEY must be set to a secure random value. "
                "Generate one with: openssl rand -hex 32"
            )
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long")
        return v
    
    @field_validator("SUPABASE_URL")
    def validate_supabase_url(cls, v):
        """Ensure Supabase URL is properly formatted."""
        if v is None:
            return v
        if not v or "your-project" in v:
            raise ValueError("SUPABASE_URL must be set to your actual Supabase project URL")
        if not v.startswith("https://"):
            raise ValueError("SUPABASE_URL must use HTTPS")
        return v

    @field_validator("OPENAI_API_KEY")
    def validate_openai_key(cls, v):
        """Ensure OpenAI API key is set."""
        """Ensure OpenAI API key is set if provided."""
        if v and v.startswith("your-"):
            # Don't raise error, just return None or allow it if user ignores warning
            return v
        return v

    @field_validator("LINKEDIN_DEFAULT_TARGET")
    def validate_linkedin_default_target(cls, v):
        """Validate LinkedIn post target mode."""
        normalized = (v or "person").strip().lower()
        if normalized not in {"person", "organization"}:
            raise ValueError(
                "LINKEDIN_DEFAULT_TARGET must be either 'person' or 'organization'"
            )
        return normalized
    
    class Config:
        """Pydantic configuration."""
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================
# Create a single instance of settings to be imported throughout the app
# This ensures configuration is loaded once and validated on startup
settings = Settings()


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================
def get_settings() -> Settings:
    """
    Dependency injection function for FastAPI routes.
    
    Usage:
        @app.get("/")
        def read_root(settings: Settings = Depends(get_settings)):
            return {"app_name": settings.APP_NAME}
    """
    return settings


def is_production() -> bool:
    """Check if running in production environment."""
    return settings.ENVIRONMENT.lower() == "production"


def is_development() -> bool:
    """Check if running in development environment."""
    return settings.ENVIRONMENT.lower() == "development"


# =============================================================================
# LOGGING SETUP
# =============================================================================
def setup_logging():
    """
    Configure application logging.
    
    Creates log directory if it doesn't exist and sets up
    structured logging with rotation.
    """
    log_path = Path(settings.LOG_FILE)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    
    from loguru import logger
    import sys
    
    # Remove default handler
    logger.remove()
    
    # Add console handler
    logger.add(
        sys.stdout,
        level=settings.LOG_LEVEL,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>"
    )
    
    # Add file handler with rotation
    logger.add(
        settings.LOG_FILE,
        rotation="500 MB",
        retention="10 days",
        level=settings.LOG_LEVEL,
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function} - {message}"
    )
    
    return logger


# Initialize logger
logger = setup_logging()
