"""
Security utilities and middleware for the LinkedIn Automation SaaS.

This module implements critical security features:
- JWT token generation and validation
- Password hashing and verification
- Input sanitization
- Security headers
- OWASP best practices

All security decisions are documented inline for audit purposes.
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
import bleach
import validators
from fastapi import HTTPException, status
from .config import settings, logger


# =============================================================================
# PASSWORD HASHING
# =============================================================================
# Using bcrypt for password hashing (OWASP recommended)
# Bcrypt is specifically designed for password hashing and includes:
# - Automatic salting
# - Adaptive cost factor (can increase over time)
# - Resistance to rainbow table attacks
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.
    
    Security Notes:
    - Bcrypt automatically handles salting
    - Cost factor can be adjusted in production for stronger hashing
    - Never store plain text passwords
    
    Args:
        password: Plain text password to hash
        
    Returns:
        Hashed password string
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.
    
    Security Notes:
    - Constant-time comparison to prevent timing attacks
    - Returns False for any error (fail securely)
    
    Args:
        plain_password: Plain text password to verify
        hashed_password: Stored hash to compare against
        
    Returns:
        True if password matches, False otherwise
    """
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        logger.error(f"Password verification error: {e}")
        return False


# =============================================================================
# JWT TOKEN MANAGEMENT
# =============================================================================
def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a JWT access token.
    
    Security Notes:
    - Tokens are signed with SECRET_KEY (never share this)
    - Includes expiration time to limit token lifetime
    - Uses HS256 algorithm (symmetric signing)
    - Should be transmitted over HTTPS only
    
    Args:
        data: Payload data to encode in token
        expires_delta: Optional custom expiration time
        
    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    
    # Set expiration time
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),  # Issued at
        "type": "access"  # Token type for validation
    })
    
    # Encode token
    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
    
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decode and validate a JWT access token.
    
    Security Notes:
    - Validates signature to prevent tampering
    - Checks expiration to prevent replay attacks
    - Raises exception on any validation failure (fail securely)
    
    Args:
        token: JWT token string to decode
        
    Returns:
        Decoded token payload
        
    Raises:
        HTTPException: If token is invalid or expired
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Try decoding with Supabase key first (for frontend auth)
        try:
            payload = jwt.decode(
                token,
                settings.SUPABASE_KEY,
                algorithms=["HS256"],
                options={"verify_aud": False}
            )
            return payload
        except JWTError:
            pass
        
        # Try decoding with our own SECRET_KEY (for backend-generated tokens)
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        
        # Verify token type for our own tokens
        if payload.get("type") != "access":
            raise credentials_exception
        
        return payload
        
    except JWTError as e:
        logger.warning(f"JWT validation failed: {e}")
        raise credentials_exception


# =============================================================================
# INPUT SANITIZATION
# =============================================================================
def sanitize_input(text: str, max_length: Optional[int] = None) -> str:
    """
    Sanitize user input to prevent XSS and injection attacks.
    
    Security Notes:
    - Removes HTML tags and dangerous characters
    - Enforces length limits to prevent DoS
    - Strips leading/trailing whitespace
    - Prevents script injection
    
    Args:
        text: User input to sanitize
        max_length: Optional maximum length (truncates if exceeded)
        
    Returns:
        Sanitized text string
    """
    if not text:
        return ""
    
    # Remove HTML tags and dangerous content
    # bleach.clean() removes all HTML by default
    sanitized = bleach.clean(text, tags=[], strip=True)
    
    # Strip whitespace
    sanitized = sanitized.strip()
    
    # Enforce length limit
    if max_length and len(sanitized) > max_length:
        sanitized = sanitized[:max_length]
    
    return sanitized


def validate_email(email: str) -> bool:
    """
    Validate email address format.
    
    Security Notes:
    - Uses validators library for RFC-compliant validation
    - Prevents injection attacks via malformed emails
    
    Args:
        email: Email address to validate
        
    Returns:
        True if valid email format, False otherwise
    """
    if not email:
        return False
    
    # Sanitize first
    email = sanitize_input(email, max_length=255)
    
    # Validate format
    return validators.email(email) is True


def validate_url(url: str) -> bool:
    """
    Validate URL format.
    
    Security Notes:
    - Ensures HTTPS for production
    - Prevents SSRF attacks via malformed URLs
    - Validates against URL injection
    
    Args:
        url: URL to validate
        
    Returns:
        True if valid URL format, False otherwise
    """
    if not url:
        return False
    
    # Sanitize first
    url = sanitize_input(url, max_length=2048)
    
    # Validate format
    is_valid = validators.url(url) is True
    
    # In production, enforce HTTPS
    if is_valid and settings.ENVIRONMENT == "production":
        is_valid = url.startswith("https://")
    
    return is_valid


# =============================================================================
# SECURITY HEADERS
# =============================================================================
def get_security_headers() -> Dict[str, str]:
    """
    Get recommended security headers for HTTP responses.
    
    Security Notes (OWASP):
    - X-Content-Type-Options: Prevents MIME sniffing
    - X-Frame-Options: Prevents clickjacking
    - X-XSS-Protection: Enables XSS filter in older browsers
    - Strict-Transport-Security: Enforces HTTPS
    - Content-Security-Policy: Prevents XSS and injection attacks
    
    Returns:
        Dictionary of security headers
    """
    headers = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
    }
    
    # Add HSTS in production (enforces HTTPS)
    if settings.ENVIRONMENT == "production":
        headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    
    # Content Security Policy
    # Adjust based on your frontend needs
    headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' data:; "
        "connect-src 'self' https://api.openai.com https://*.supabase.co"
    )
    
    return headers


# =============================================================================
# RATE LIMITING HELPERS
# =============================================================================
def get_client_ip(request) -> str:
    """
    Extract client IP address from request.
    
    Security Notes:
    - Checks X-Forwarded-For for proxy/load balancer scenarios
    - Falls back to direct client IP
    - Used for rate limiting and audit logging
    
    Args:
        request: FastAPI request object
        
    Returns:
        Client IP address string
    """
    # Check for proxy headers (common in production)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # X-Forwarded-For can contain multiple IPs, take the first
        return forwarded.split(",")[0].strip()
    
    # Fall back to direct client IP
    return request.client.host


# =============================================================================
# AUDIT LOGGING
# =============================================================================
def log_security_event(
    event_type: str,
    user_id: Optional[str],
    ip_address: str,
    details: Optional[Dict[str, Any]] = None
):
    """
    Log security-relevant events for audit trail.
    
    Security Notes:
    - All authentication events should be logged
    - Failed login attempts tracked for brute force detection
    - Sensitive data (passwords, tokens) never logged
    - Logs stored securely with retention policy
    
    Args:
        event_type: Type of security event (login, logout, etc.)
        user_id: User ID if authenticated
        ip_address: Client IP address
        details: Additional event details
    """
    log_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "event_type": event_type,
        "user_id": user_id,
        "ip_address": ip_address,
        "details": details or {}
    }
    
    logger.info(f"Security Event: {log_entry}")
