# 🚀 LinkedIn Content Automation - Complete Setup Guide

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Backend Setup](#backend-setup)
3. [Supabase Setup](#supabase-setup)
4. [Frontend Setup](#frontend-setup)
5. [API Keys Configuration](#api-keys-configuration)
6. [Running the Application](#running-the-application)
7. [Testing](#testing)
8. [Deployment](#deployment)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software
- **Node.js** 18+ and npm/yarn
- **Python** 3.11+
- **Git**
- **PostgreSQL** (via Supabase)

### Required Accounts
1. **Supabase** - [https://supabase.com](https://supabase.com)
2. **OpenAI** - [https://platform.openai.com](https://platform.openai.com)
3. **LinkedIn Developer** - [https://www.linkedin.com/developers](https://www.linkedin.com/developers)
4. **Google Cloud Console** - [https://console.cloud.google.com](https://console.cloud.google.com)

---

## Backend Setup

### 1. Navigate to Backend Directory
```bash
cd backend
```

### 2. Create Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables
```bash
# Copy example env file
copy .env.example .env  # Windows
# OR
cp .env.example .env    # macOS/Linux
```

Edit `.env` and fill in all required values (see [API Keys Configuration](#api-keys-configuration))

### 5. Verify Installation
```bash
python -c "from app.core.config import settings; print(f'App: {settings.APP_NAME}')"
```

---

## Supabase Setup

### 1. Create New Supabase Project
1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Fill in project details
4. Wait for project to be created

### 2. Get API Keys
1. Go to Project Settings → API
2. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_KEY`
   - **service_role** key → `SUPABASE_SERVICE_KEY` (⚠️ Keep secret!)

### 3. Run Database Migration
1. Go to SQL Editor in Supabase Dashboard
2. Create a new query
3. Copy contents of `supabase/schema.sql`
4. Run the query
5. Verify tables are created in Table Editor

### 4. Configure Authentication Providers

#### Email Authentication
1. Go to Authentication → Providers
2. Enable "Email"
3. Configure email templates (optional)

#### Google OAuth
1. Go to Authentication → Providers
2. Enable "Google"
3. Add your Google Client ID and Secret
4. Add redirect URL: `https://your-project.supabase.co/auth/v1/callback`

#### LinkedIn OAuth
LinkedIn OAuth is handled by our backend, not Supabase directly.

### 5. Enable Row Level Security
RLS is already enabled in the schema. Verify in Table Editor that all tables show "RLS enabled".

---

## Frontend Setup

### 1. Navigate to Frontend Directory
```bash
cd frontend
```

### 2. Install Dependencies
```bash
npm install
# OR
yarn install
```

### 3. Configure Environment Variables
```bash
# Copy example env file
copy .env.local.example .env.local  # Windows
# OR
cp .env.local.example .env.local    # macOS/Linux
```

Edit `.env.local` and fill in:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 4. Verify Installation
```bash
npm run type-check
```

---

## API Keys Configuration

### 🔑 OpenAI API Key

1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click "Create new secret key"
3. Copy the key
4. Add to backend `.env`:
   ```env
   OPENAI_API_KEY=sk-...your-key...
   ```

### 🔑 LinkedIn Developer App

1. Go to [https://www.linkedin.com/developers/apps](https://www.linkedin.com/developers/apps)
2. Click "Create app"
3. Fill in app details:
   - **App name**: LinkedIn Content Automation
   - **LinkedIn Page**: Your company page
   - **Privacy policy URL**: Your privacy policy
   - **App logo**: Upload a logo
4. Go to "Auth" tab
5. Add redirect URL: `http://localhost:8000/api/v1/auth/linkedin/callback`
6. Request access to:
   - `r_liteprofile`
   - `r_emailaddress`
   - `w_member_social`
7. Copy:
   - **Client ID** → `LINKEDIN_CLIENT_ID`
   - **Client Secret** → `LINKEDIN_CLIENT_SECRET`

### 🔑 Google OAuth Credentials

1. Go to [https://console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable "Google+ API"
4. Go to "Credentials"
5. Click "Create Credentials" → "OAuth client ID"
6. Choose "Web application"
7. Add authorized redirect URIs:
   - `http://localhost:8000/api/v1/auth/google/callback`
   - `https://your-project.supabase.co/auth/v1/callback`
8. Copy:
   - **Client ID** → `GOOGLE_CLIENT_ID`
   - **Client Secret** → `GOOGLE_CLIENT_SECRET`

### 🔐 Secret Key Generation

Generate a secure secret key for JWT:
```bash
# Windows (PowerShell)
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# macOS/Linux
openssl rand -hex 32
```

Add to backend `.env`:
```env
SECRET_KEY=your-generated-secret-key
```

---

## Running the Application

### Development Mode

#### Terminal 1: Backend
```bash
cd backend
venv\Scripts\activate  # Windows
# OR
source venv/bin/activate  # macOS/Linux

uvicorn app.main:app --reload --port 8000
```

Backend will be available at: [http://localhost:8000](http://localhost:8000)
API docs: [http://localhost:8000/api/docs](http://localhost:8000/api/docs)

#### Terminal 2: Frontend
```bash
cd frontend
npm run dev
```

Frontend will be available at: [http://localhost:3000](http://localhost:3000)

### Verify Everything Works

1. **Backend Health Check**:
   ```bash
   curl http://localhost:8000/health
   ```
   Should return: `{"status":"healthy",...}`

2. **Frontend**: Open [http://localhost:3000](http://localhost:3000)

3. **Create Test Account**:
   - Click "Sign Up"
   - Enter email and password
   - Verify you can log in

---

## Testing

### Backend Tests
```bash
cd backend
pytest
```

### Frontend Type Checking
```bash
cd frontend
npm run type-check
```

### Manual Testing Checklist
- [ ] User signup works
- [ ] User login works
- [ ] Content generation works
- [ ] LinkedIn connection works
- [ ] Post creation works
- [ ] Post publishing works
- [ ] Settings update works

---

## Deployment

### Backend Deployment (Railway/Render/Fly.io)

1. **Prepare for deployment**:
   - Set `ENVIRONMENT=production` in env vars
   - Set `DEBUG=False`
   - Update `BACKEND_CORS_ORIGINS` with frontend URL

2. **Deploy**:
   ```bash
   # Example for Railway
   railway up
   ```

3. **Set environment variables** in deployment platform

### Frontend Deployment (Vercel/Netlify)

1. **Connect GitHub repository**

2. **Configure build settings**:
   - Build command: `npm run build`
   - Output directory: `.next`

3. **Set environment variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_URL` (your deployed backend URL)

4. **Deploy**

### Post-Deployment Checklist
- [ ] Update OAuth redirect URLs with production URLs
- [ ] Update CORS origins in backend
- [ ] Test all authentication flows
- [ ] Monitor logs for errors
- [ ] Set up error tracking (Sentry)
- [ ] Configure CDN for static assets

---

## Troubleshooting

### Backend Issues

#### "Module not found" errors
```bash
# Ensure virtual environment is activated
pip install -r requirements.txt
```

#### "Could not validate credentials"
- Check `SECRET_KEY` is set and not default value
- Verify JWT token is being sent in Authorization header

#### "Supabase connection failed"
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are correct
- Check network connectivity

### Frontend Issues

#### "Failed to fetch"
- Ensure backend is running on correct port
- Check `NEXT_PUBLIC_API_URL` in `.env.local`
- Verify CORS is configured in backend

#### Build errors
```bash
# Clear cache and reinstall
rm -rf .next node_modules
npm install
npm run build
```

### Database Issues

#### RLS preventing access
- Verify user is authenticated
- Check RLS policies in Supabase dashboard
- Use service role key for admin operations

#### Migration errors
- Drop all tables and re-run schema
- Check for syntax errors in SQL
- Verify PostgreSQL version compatibility

---

## Security Checklist

Before going to production:

- [ ] All API keys in environment variables
- [ ] `DEBUG=False` in production
- [ ] HTTPS enabled
- [ ] CORS configured properly
- [ ] Rate limiting enabled
- [ ] RLS enabled on all tables
- [ ] Audit logging active
- [ ] Error messages don't expose internals
- [ ] Dependencies up to date
- [ ] Security headers configured

---

## Support

For issues or questions:
- Check this documentation
- Review error logs
- Check GitHub issues
- Contact: support@yourcompany.com

---

## Next Steps

1. ✅ Complete setup
2. 📝 Create your first post
3. 🔗 Connect LinkedIn account
4. 🚀 Start automating content
5. 📊 Monitor analytics
6. 🎨 Customize branding

---

**Congratulations! Your LinkedIn Content Automation SaaS is ready! 🎉**
