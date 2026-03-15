# 🔐 Security Architecture & Best Practices

## Overview

This document outlines the comprehensive security measures implemented in the LinkedIn Content Automation SaaS platform. Every security decision is documented for audit and compliance purposes.

---

## 🛡️ Security Principles

### Defense in Depth
Multiple layers of security controls:
1. **Network Layer**: HTTPS, CORS, security headers
2. **Application Layer**: Input validation, rate limiting, authentication
3. **Data Layer**: RLS, encryption at rest, secure tokens
4. **Audit Layer**: Comprehensive logging, monitoring

### Principle of Least Privilege
- Users can only access their own data
- Service role key used only when necessary
- RLS enforces data isolation at database level

### Fail Securely
- All errors handled gracefully
- No sensitive information in error messages
- Default deny for all operations

---

## 🔒 Authentication & Authorization

### Multi-Provider Authentication
Supported methods:
- **Email/Password**: Bcrypt hashing, strength validation
- **Google OAuth 2.0**: Industry-standard OAuth flow
- **LinkedIn OAuth 2.0**: Official API integration

### Password Security
```python
# Password requirements enforced:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- Bcrypt hashing with automatic salting
```

### JWT Token Management
- **Algorithm**: HS256 (HMAC with SHA-256)
- **Expiration**: 30 minutes (configurable)
- **Claims**: User ID, email, issued at, expiration
- **Secret Key**: Minimum 32 characters, validated on startup

**Security Notes**:
- Tokens signed with SECRET_KEY (never shared)
- Tokens transmitted over HTTPS only
- Client-side storage in httpOnly cookies (recommended)
- No sensitive data in token payload

### Session Management
- Stateless JWT-based sessions
- No server-side session storage required
- Token refresh handled client-side
- Logout via token deletion (client-side)

---

## 🚦 Rate Limiting

### Implementation
Using SlowAPI with in-memory storage (Redis recommended for production).

### Rate Limits by Endpoint Type

| Endpoint Type | Limit | Reason |
|--------------|-------|--------|
| Authentication | 5/minute | Prevent brute force attacks |
| Content Generation | 10/minute | Prevent API abuse, cost control |
| LinkedIn Posting | 5/minute | Prevent spam, comply with LinkedIn limits |
| Public Endpoints | 100/minute | General abuse prevention |
| Default | 60/minute, 1000/hour | Baseline protection |

### Rate Limit Strategy
- **IP-based**: Primary identifier
- **User-based**: Secondary (for authenticated requests)
- **Fixed-window**: Simple, effective
- **Graceful degradation**: 429 status with Retry-After header

### Production Recommendations
```python
# Use Redis for distributed rate limiting
RATE_LIMIT_STORAGE = "redis://localhost:6379"

# Adjust limits based on usage patterns
RATE_LIMIT_PER_MINUTE = 60
RATE_LIMIT_PER_HOUR = 1000
```

---

## 🔍 Input Validation & Sanitization

### Validation Layers

#### 1. Schema Validation (Pydantic)
All API inputs validated against strict schemas:
```python
class UserSignup(BaseModel):
    email: EmailStr  # RFC-compliant email validation
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=100)
```

#### 2. Sanitization
All user inputs sanitized to prevent injection:
```python
def sanitize_input(text: str, max_length: Optional[int] = None) -> str:
    # Remove HTML tags
    # Strip whitespace
    # Enforce length limits
    # Prevent script injection
```

#### 3. Type Checking
TypeScript on frontend, Pydantic on backend ensures type safety.

### Specific Protections

**XSS Prevention**:
- HTML tags stripped from all inputs
- Content-Security-Policy headers
- React's built-in XSS protection

**SQL Injection Prevention**:
- Parameterized queries only
- Supabase client handles escaping
- No raw SQL from user input

**Command Injection Prevention**:
- No shell commands from user input
- All external API calls validated

**Path Traversal Prevention**:
- No file system access from user input
- Validated file paths only

---

## 🔐 Secrets Management

### Environment Variables Only
**Never** hardcode secrets. All sensitive data in environment variables:

```bash
# ✅ CORRECT
OPENAI_API_KEY=sk-...
SECRET_KEY=...

# ❌ WRONG
openai_key = "sk-..."  # NEVER DO THIS
```

### Secret Validation
Startup validation prevents common mistakes:
```python
@validator("SECRET_KEY")
def validate_secret_key(cls, v):
    if v == "your-secret-key-here":
        raise ValueError("SECRET_KEY must be changed from default")
    if len(v) < 32:
        raise ValueError("SECRET_KEY must be at least 32 characters")
    return v
```

### Key Rotation
Support for key rotation without downtime:
1. Generate new secret key
2. Update environment variable
3. Restart application
4. Old tokens expire naturally

### Separation of Concerns
- **Development**: Separate API keys
- **Staging**: Separate API keys
- **Production**: Separate API keys

---

## 🗄️ Database Security

### Row Level Security (RLS)
Every table has RLS enabled:

```sql
-- Users can only view their own data
CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (auth.uid() = id);

-- Users can only update their own data
CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (auth.uid() = id);
```

### Multi-Tenant Isolation
- All tables have `user_id` foreign key
- RLS policies enforce user_id matching
- No cross-user data access possible

### Encryption
- **At Rest**: Supabase encrypts all data at rest
- **In Transit**: HTTPS for all connections
- **Tokens**: Stored encrypted in database

### Backup & Recovery
- Automated daily backups (Supabase)
- Point-in-time recovery available
- Backup encryption enabled

---

## 🌐 Network Security

### HTTPS Enforcement
Production configuration:
```python
# Strict-Transport-Security header
if settings.ENVIRONMENT == "production":
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
```

### CORS Configuration
Strict CORS policy:
```python
BACKEND_CORS_ORIGINS = [
    "https://yourdomain.com",  # Production frontend
    "http://localhost:3000"     # Development only
]
```

### Security Headers
All responses include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy: ...`

---

## 📊 Audit Logging

### What We Log
All security-relevant events:
- User signup/login/logout
- Failed authentication attempts
- Content generation requests
- LinkedIn post publishing
- Settings changes
- API errors

### Log Format
```python
{
    "timestamp": "2024-01-11T23:00:00Z",
    "event_type": "login_success",
    "user_id": "uuid",
    "ip_address": "1.2.3.4",
    "details": {...}
}
```

### What We DON'T Log
- Passwords (plain or hashed)
- API keys or tokens
- Sensitive user data
- Full request/response bodies

### Log Retention
- Development: 7 days
- Production: 90 days
- Compliance: As required by regulations

### Log Access
- Encrypted at rest
- Access restricted to administrators
- Audit trail of log access

---

## 🚨 Error Handling

### Secure Error Messages
**Production**:
```json
{
    "error": "Internal Server Error",
    "message": "An unexpected error occurred. Please try again later."
}
```

**Development**:
```json
{
    "error": "Internal Server Error",
    "message": "Database connection failed",
    "type": "ConnectionError"
}
```

### Error Logging
- Full stack traces logged server-side
- Generic messages returned to client
- No sensitive data in error messages

---

## 🔄 OAuth Security

### CSRF Protection
State parameter for all OAuth flows:
```python
state = secrets.token_urlsafe(32)  # Cryptographically secure random
```

### Token Storage
- Access tokens encrypted in database
- Refresh tokens encrypted in database
- Automatic token refresh
- Token expiration enforced

### Scope Limitation
Request only necessary scopes:
```python
LINKEDIN_SCOPES = [
    "r_liteprofile",      # Read profile
    "r_emailaddress",     # Read email
    "w_member_social"     # Post on behalf
]
```

---

## 🛠️ API Security

### API Key Protection
- Never exposed to client-side code
- Backend-only access
- Separate keys for each service
- Key rotation supported

### Request Validation
Every API request validated:
1. Authentication (JWT token)
2. Authorization (user permissions)
3. Input validation (Pydantic schemas)
4. Rate limiting (SlowAPI)
5. Sanitization (bleach, validators)

---

## 📱 Frontend Security

### Client-Side Security
- No sensitive data in localStorage
- HTTPS-only cookies for tokens
- CSP headers prevent XSS
- Input validation before API calls

### Dependency Security
```bash
# Regular security audits
npm audit
pip-audit

# Automated updates
dependabot.yml configured
```

---

## ✅ OWASP Top 10 Compliance

| Risk | Mitigation |
|------|-----------|
| A01: Broken Access Control | RLS, JWT validation, user_id checks |
| A02: Cryptographic Failures | HTTPS, bcrypt, encrypted tokens |
| A03: Injection | Parameterized queries, input sanitization |
| A04: Insecure Design | Security by design, threat modeling |
| A05: Security Misconfiguration | Secure defaults, validation |
| A06: Vulnerable Components | Dependency scanning, updates |
| A07: Authentication Failures | Strong passwords, rate limiting, MFA-ready |
| A08: Software Integrity Failures | Signed packages, verified dependencies |
| A09: Logging Failures | Comprehensive audit logging |
| A10: SSRF | URL validation, whitelist approach |

---

## 🔍 Security Testing

### Automated Testing
- Unit tests for security functions
- Integration tests for auth flows
- Dependency vulnerability scanning

### Manual Testing
- Penetration testing recommended
- Security code review
- OAuth flow testing

### Monitoring
- Failed login attempts
- Rate limit violations
- Unusual API usage patterns
- Error rate monitoring

---

## 📋 Security Checklist

### Pre-Deployment
- [ ] All secrets in environment variables
- [ ] SECRET_KEY changed from default
- [ ] DEBUG=False in production
- [ ] HTTPS enabled
- [ ] CORS configured for production domain
- [ ] Rate limiting enabled
- [ ] RLS enabled on all tables
- [ ] Security headers configured
- [ ] Error messages sanitized
- [ ] Audit logging active

### Post-Deployment
- [ ] Monitor logs for suspicious activity
- [ ] Set up error tracking (Sentry)
- [ ] Configure alerts for security events
- [ ] Regular security audits
- [ ] Dependency updates
- [ ] Backup verification

---

## 🆘 Incident Response

### In Case of Security Incident

1. **Immediate Actions**:
   - Isolate affected systems
   - Revoke compromised credentials
   - Enable additional logging

2. **Investigation**:
   - Review audit logs
   - Identify scope of breach
   - Document findings

3. **Remediation**:
   - Patch vulnerabilities
   - Rotate all secrets
   - Notify affected users (if required)

4. **Post-Incident**:
   - Update security measures
   - Document lessons learned
   - Improve monitoring

---

## 📞 Security Contacts

- **Security Issues**: security@yourcompany.com
- **Bug Bounty**: bugbounty@yourcompany.com
- **General Support**: support@yourcompany.com

---

## 📚 References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP API Security](https://owasp.org/www-project-api-security/)
- [Supabase Security](https://supabase.com/docs/guides/platform/security)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)

---

**Last Updated**: 2024-01-11
**Security Review**: Required before production deployment
