# 🔐 Admin Dashboard - Complete Documentation

## Overview

The Admin Dashboard provides complete control and visibility over the LinkedIn Content Automation SaaS platform. This is an **enterprise-grade admin system** with full user management, subscription control, usage tracking, and security auditing.

---

## 🎯 Features

### ✅ User Management
- View all registered users
- Search by email/name
- Filter by subscription status
- View detailed user profiles
- Block/unblock users
- Track user activity

### ✅ Subscription Management
- ₹299/month plan with 7-day free trial
- View all subscriptions
- Extend trials manually
- Activate subscriptions
- Cancel subscriptions
- Track trial conversions

### ✅ Usage Tracking
- Posts generated per user
- Images generated per user
- LinkedIn posts published
- API calls made
- Last activity tracking
- Usage reset capability

### ✅ Analytics & Insights
- Total users & growth
- Active subscribers
- Monthly Recurring Revenue (MRR)
- Trial → Paid conversion rate
- Revenue analytics by month
- Usage analytics by day

### ✅ Audit Logging
- All admin actions logged
- User blocks/unblocks
- Subscription changes
- Trial extensions
- Usage resets
- IP address tracking

---

## 🔐 Security & Access Control

### Role-Based Access Control (RBAC)

Only users with `role = admin` can access admin endpoints.

**Enforcement Layers:**
1. **API Layer**: `require_admin` middleware
2. **Database Layer**: RLS policies
3. **Audit Layer**: All actions logged

### Creating First Admin

After first user signup, run this SQL in Supabase:

```sql
-- Replace with your admin email
UPDATE roles 
SET role = 'admin' 
WHERE user_id = (
    SELECT id FROM users 
    WHERE email = 'admin@yourcompany.com'
);
```

### Admin Authentication

All admin endpoints require:
1. Valid JWT token in `Authorization: Bearer <token>` header
2. User must have `role = 'admin'` in database
3. Unauthorized attempts are logged

---

## 📊 Database Schema

### Tables Added

#### 1. `roles`
```sql
- id: UUID (primary key)
- user_id: UUID (foreign key to users)
- role: VARCHAR ('admin' | 'user')
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### 2. `subscriptions`
```sql
- id: UUID (primary key)
- user_id: UUID (foreign key to users)
- plan_name: VARCHAR (default: 'monthly')
- price: DECIMAL (default: 299.00)
- currency: VARCHAR (default: 'INR')
- status: VARCHAR ('trial' | 'active' | 'expired' | 'cancelled' | 'blocked')
- trial_start: TIMESTAMP
- trial_end: TIMESTAMP (7 days from trial_start)
- subscription_start: TIMESTAMP
- renewal_date: TIMESTAMP
- last_payment_date: TIMESTAMP
- payment_method: VARCHAR
```

#### 3. `usage_metrics`
```sql
- id: UUID (primary key)
- user_id: UUID (foreign key to users)
- posts_generated: INTEGER (default: 0)
- images_generated: INTEGER (default: 0)
- linkedin_posts: INTEGER (default: 0)
- api_calls: INTEGER (default: 0)
- last_activity: TIMESTAMP
```

#### 4. `admin_audit_logs`
```sql
- id: UUID (primary key)
- admin_id: UUID (foreign key to users)
- action: VARCHAR
- target_user_id: UUID (foreign key to users)
- details: JSONB
- ip_address: INET
- user_agent: TEXT
- created_at: TIMESTAMP
```

### Database Functions

#### `is_admin(user_id UUID)`
Check if user is admin.

#### `has_active_subscription(user_id UUID)`
Check if user has active subscription (trial or paid).

#### `increment_usage(user_id UUID, metric VARCHAR, increment INTEGER)`
Increment usage metrics for a user.

### Triggers

#### `create_default_subscription()`
Automatically creates:
- 7-day trial subscription
- Default 'user' role
- Usage metrics record

Triggered on user signup.

#### `check_trial_expiration()`
Automatically updates subscription status when trial expires.

---

## 🚀 API Endpoints

Base URL: `/api/v1/admin`

All endpoints require admin authentication.

### Dashboard & Analytics

#### `GET /admin/dashboard/stats`
Get dashboard statistics.

**Response:**
```json
{
    "total_users": 150,
    "active_subscribers": 45,
    "trial_users": 30,
    "expired_trials": 25,
    "blocked_users": 2,
    "mrr": 13455.00,
    "new_users_this_month": 20,
    "new_subscribers_this_month": 8
}
```

#### `GET /admin/analytics/revenue`
Get revenue analytics by month.

**Response:**
```json
[
    {
        "month": "2024-01-01T00:00:00Z",
        "new_subscriptions": 8,
        "revenue": 2392.00,
        "mrr_added": 2392.00
    }
]
```

#### `GET /admin/analytics/usage?days=30`
Get usage analytics for last N days.

**Response:**
```json
[
    {
        "date": "2024-01-11T00:00:00Z",
        "active_users": 45,
        "total_posts": 120,
        "total_images": 95,
        "total_linkedin_posts": 80,
        "total_api_calls": 450
    }
]
```

### User Management

#### `POST /admin/users/search`
Search and filter users.

**Request:**
```json
{
    "search": "john",
    "status": "trial",
    "page": 1,
    "page_size": 50
}
```

**Response:**
```json
{
    "users": [...],
    "total": 100,
    "page": 1,
    "page_size": 50,
    "total_pages": 2
}
```

#### `GET /admin/users/{user_id}`
Get detailed user information.

**Response:**
```json
{
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "signup_date": "2024-01-01T00:00:00Z",
    "last_login_at": "2024-01-11T10:00:00Z",
    "role": "user",
    "subscription_status": "trial",
    "trial_end": "2024-01-08T00:00:00Z",
    "posts_generated": 5,
    "linkedin_posts": 3,
    "last_activity": "2024-01-11T09:00:00Z"
}
```

#### `POST /admin/users/block`
Block a user.

**Request:**
```json
{
    "user_id": "uuid",
    "reason": "Abuse detected"
}
```

**Response:**
```json
{
    "success": true,
    "message": "User blocked successfully",
    "subscription": {...}
}
```

#### `POST /admin/users/unblock`
Unblock a user.

**Request:**
```json
{
    "user_id": "uuid"
}
```

### Subscription Management

#### `GET /admin/subscriptions?status=trial`
Get all subscriptions with optional filter.

**Query Params:**
- `status`: trial | active | expired | cancelled | blocked

#### `POST /admin/subscriptions/extend-trial`
Extend user's trial.

**Request:**
```json
{
    "user_id": "uuid",
    "days": 7
}
```

#### `POST /admin/subscriptions/activate`
Manually activate subscription.

**Request:**
```json
{
    "user_id": "uuid"
}
```

#### `POST /admin/subscriptions/cancel`
Cancel subscription.

**Request:**
```json
{
    "user_id": "uuid"
}
```

### Usage Tracking

#### `GET /admin/usage?user_id=uuid`
Get usage metrics (all users or specific user).

#### `POST /admin/usage/reset`
Reset usage metrics for a user.

**Request:**
```json
{
    "user_id": "uuid"
}
```

### Audit Logs

#### `GET /admin/audit-logs`
Get audit logs with pagination.

**Query Params:**
- `page`: Page number
- `page_size`: Items per page
- `admin_filter`: Filter by admin ID
- `action_filter`: Filter by action type

**Response:**
```json
{
    "logs": [
        {
            "id": "uuid",
            "admin_id": "uuid",
            "action": "user_blocked",
            "target_user_id": "uuid",
            "details": {"reason": "Abuse"},
            "ip_address": "1.2.3.4",
            "created_at": "2024-01-11T10:00:00Z"
        }
    ],
    "total": 50,
    "page": 1,
    "page_size": 50,
    "total_pages": 1
}
```

---

## 💳 Subscription Logic

### 7-Day Free Trial

**Automatic on Signup:**
1. User signs up
2. Trigger creates subscription with:
   - `status = 'trial'`
   - `trial_start = NOW()`
   - `trial_end = NOW() + 7 days`
3. User has full access during trial

**Trial Expiration:**
1. Trigger checks trial_end on every update
2. If `trial_end < NOW()`, status → 'expired'
3. User loses access to premium features
4. Must upgrade to continue

### ₹299/Month Plan

**Manual Activation (by admin):**
```
POST /admin/subscriptions/activate
```

**Automatic (via payment integration - to be added):**
- Payment gateway webhook
- Verify payment
- Update subscription:
  - `status = 'active'`
  - `subscription_start = NOW()`
  - `renewal_date = NOW() + 30 days`

### Subscription States

| Status | Description | Access |
|--------|-------------|--------|
| `trial` | 7-day free trial active | ✅ Full access |
| `active` | Paid subscription active | ✅ Full access |
| `expired` | Trial/subscription expired | ❌ No access |
| `cancelled` | User cancelled | ❌ No access |
| `blocked` | Admin blocked | ❌ No access |

---

## 🛡️ Security Features

### Input Validation
- All requests validated with Pydantic schemas
- Sanitization applied to text inputs
- Type checking enforced

### Rate Limiting
- Dashboard endpoints: 60 req/min
- User management: 10 req/min (destructive actions)
- Analytics: 60 req/min

### Audit Logging
Every admin action logged with:
- Admin ID
- Action type
- Target user
- Timestamp
- IP address
- Details (JSON)

### RLS Policies
- Users can only view their own data
- Admins can view all data
- Service role for system operations

---

## 📈 Usage Tracking

### Automatic Tracking

Usage is automatically tracked when users:
- Generate content → `posts_generated++`
- Generate images → `images_generated++`
- Post to LinkedIn → `linkedin_posts++`
- Make API calls → `api_calls++`

### Manual Tracking

Use database function:
```sql
SELECT increment_usage('user_id', 'posts_generated', 1);
```

### Usage Limits (Future)

Can be implemented by checking usage_metrics before allowing actions:
```python
if usage.posts_generated >= limit:
    raise HTTPException(402, "Usage limit reached")
```

---

## 🎨 Admin UI (To Be Built)

### Dashboard Page
- Stats cards (users, MRR, trials)
- Revenue chart
- Usage chart
- Recent activity

### Users Page
- Search bar
- Filter dropdown
- Users table with:
  - Email, name
  - Subscription status
  - Usage stats
  - Actions (block, view, edit)

### Subscriptions Page
- Subscriptions table
- Status filters
- Actions (extend, activate, cancel)

### Analytics Page
- Revenue charts
- Usage charts
- Growth metrics
- Conversion funnel

### Audit Logs Page
- Filterable log table
- Export functionality
- Search by admin/action

---

## 🚀 Setup Instructions

### 1. Run Database Migration

In Supabase SQL Editor:
```sql
-- Run admin_schema.sql
```

### 2. Create First Admin

```sql
UPDATE roles 
SET role = 'admin' 
WHERE user_id = (SELECT id FROM users WHERE email = 'your-email@example.com');
```

### 3. Test Admin Access

```bash
# Login as admin
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your-password"}'

# Get dashboard stats
curl -X GET http://localhost:8000/api/v1/admin/dashboard/stats \
  -H "Authorization: Bearer <your-token>"
```

---

## 🧪 Testing

### Test Admin Endpoints

```python
# Test admin authentication
def test_admin_access():
    # Non-admin should get 403
    response = client.get("/api/v1/admin/dashboard/stats")
    assert response.status_code == 403
    
    # Admin should get 200
    response = client.get(
        "/api/v1/admin/dashboard/stats",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
```

### Test Subscription Logic

```python
# Test trial creation
def test_trial_creation():
    user = create_user()
    subscription = get_subscription(user.id)
    assert subscription.status == "trial"
    assert subscription.trial_end > datetime.now()
```

---

## 📋 Admin Checklist

### Daily Tasks
- [ ] Monitor dashboard stats
- [ ] Review new signups
- [ ] Check trial conversions
- [ ] Review audit logs for suspicious activity

### Weekly Tasks
- [ ] Analyze revenue trends
- [ ] Review usage patterns
- [ ] Identify heavy users
- [ ] Check for abuse

### Monthly Tasks
- [ ] Generate revenue report
- [ ] Analyze conversion rates
- [ ] Review blocked users
- [ ] Plan capacity scaling

---

## 🆘 Troubleshooting

### "Access denied. Admin privileges required"
- Verify user has `role = 'admin'` in database
- Check JWT token is valid
- Ensure token includes correct user_id

### Trial not expiring automatically
- Check `check_trial_expiration()` trigger is active
- Manually run: `UPDATE subscriptions SET status = 'expired' WHERE trial_end < NOW()`

### Usage not incrementing
- Check `increment_usage()` function exists
- Verify function is being called in code
- Check usage_metrics record exists for user

---

## 📞 Support

For admin-related issues:
- Check audit logs for recent actions
- Review database RLS policies
- Verify admin role assignment
- Contact: admin@yourcompany.com

---

**Last Updated**: 2024-01-11  
**Version**: 1.0.0  
**Status**: Production Ready
