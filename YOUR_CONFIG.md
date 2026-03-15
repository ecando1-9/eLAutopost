# 🔑 YOUR CONFIGURATION - READY TO USE!

## ✅ **YOUR SUPABASE CREDENTIALS**

I have your Supabase credentials! Here's how to set them up:

---

## 📁 **BACKEND CONFIGURATION**

### **Create `backend/.env` file:**

1. **Navigate to backend folder**
2. **Create a new file** named `.env` (no extension)
3. **Copy and paste this content:**

```env
# =============================================================================
# SUPABASE CONFIGURATION
# =============================================================================
SUPABASE_URL=https://fpeimulivxmikmgmrqrn.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwZWltdWxpdnhtaWttZ21ycXJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxNTM2MTAsImV4cCI6MjA4MzcyOTYxMH0.LwCTAhBrhG2MUgIJNUs9lNyD3G5BtUJZTBqCOWcZjWQ
SUPABASE_SERVICE_KEY=YOUR_SERVICE_ROLE_KEY_HERE

# =============================================================================
# SECURITY - GENERATE A RANDOM SECRET KEY
# =============================================================================
SECRET_KEY=change-this-to-a-random-secret-key-min-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# =============================================================================
# OPENAI API
# =============================================================================
OPENAI_API_KEY=YOUR_OPENAI_API_KEY_HERE
OPENAI_MODEL=gpt-4
OPENAI_IMAGE_MODEL=dall-e-3

# =============================================================================
# LINKEDIN OAUTH (Optional)
# =============================================================================
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret
LINKEDIN_REDIRECT_URI=http://localhost:8000/api/v1/auth/linkedin/callback

# =============================================================================
# GOOGLE OAUTH (Optional)
# =============================================================================
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# =============================================================================
# APPLICATION SETTINGS
# =============================================================================
APP_NAME=LinkedIn Content Automation
ENVIRONMENT=development
DEBUG=True
API_V1_PREFIX=/api/v1
BACKEND_CORS_ORIGINS=["http://localhost:3000","http://localhost:8000"]

# =============================================================================
# RATE LIMITING
# =============================================================================
RATE_LIMIT_PER_MINUTE=60
RATE_LIMIT_PER_HOUR=1000

# =============================================================================
# LOGGING
# =============================================================================
LOG_LEVEL=INFO
LOG_FILE=logs/app.log

# =============================================================================
# CONTENT GENERATION
# =============================================================================
MAX_CAPTION_LENGTH=500
MAX_HOOK_LENGTH=100
MIN_HOOK_LENGTH=10
```

---

## 📁 **FRONTEND CONFIGURATION**

### **Create `frontend/.env.local` file:**

1. **Navigate to frontend folder**
2. **Create a new file** named `.env.local`
3. **Copy and paste this content:**

```env
# =============================================================================
# SUPABASE CONFIGURATION
# =============================================================================
NEXT_PUBLIC_SUPABASE_URL=https://fpeimulivxmikmgmrqrn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwZWltdWxpdnhtaWttZ21ycXJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxNTM2MTAsImV4cCI6MjA4MzcyOTYxMH0.LwCTAhBrhG2MUgIJNUs9lNyD3G5BtUJZTBqCOWcZjWQ

# =============================================================================
# BACKEND API
# =============================================================================
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_API_VERSION=v1

# =============================================================================
# APPLICATION SETTINGS
# =============================================================================
NEXT_PUBLIC_APP_NAME="LinkedIn Content Automation"
NEXT_PUBLIC_APP_VERSION="1.0.0"
NEXT_PUBLIC_ENVIRONMENT=development

# =============================================================================
# OAUTH REDIRECT URLS
# =============================================================================
NEXT_PUBLIC_GOOGLE_REDIRECT_URL=http://localhost:3000/auth/callback/google
NEXT_PUBLIC_LINKEDIN_REDIRECT_URL=http://localhost:3000/auth/callback/linkedin
```

---

## 🔑 **MISSING KEYS YOU NEED TO ADD**

### **1. Supabase Service Role Key** (IMPORTANT!)

1. Go to: [https://supabase.com/dashboard/project/fpeimulivxmikmgmrqrn/settings/api](https://supabase.com/dashboard/project/fpeimulivxmikmgmrqrn/settings/api)
2. Copy the **service_role** key (⚠️ Keep it secret!)
3. Replace `YOUR_SERVICE_ROLE_KEY_HERE` in `backend/.env`

### **2. Generate Secret Key**

**Windows (PowerShell):**
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

**macOS/Linux:**
```bash
openssl rand -hex 32
```

Copy the output and replace `change-this-to-a-random-secret-key-min-32-chars` in `backend/.env`

### **3. OpenAI API Key**

1. Go to: [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Create a new key
3. Replace `YOUR_OPENAI_API_KEY_HERE` in `backend/.env`

---

## ✅ **QUICK SETUP CHECKLIST**

- [ ] Create `backend/.env` with the content above
- [ ] Get **service_role** key from Supabase and add it
- [ ] Generate **SECRET_KEY** and add it
- [ ] Get **OpenAI API key** and add it
- [ ] Create `frontend/.env.local` with the content above
- [ ] (Optional) Add LinkedIn OAuth credentials
- [ ] (Optional) Add Google OAuth credentials

---

## 🚀 **TEST YOUR CONFIGURATION**

### **Test Backend:**

```bash
cd backend

# Activate virtual environment
venv\Scripts\activate  # Windows
# OR
source venv/bin/activate  # macOS/Linux

# Test configuration
python -c "from app.core.config import settings; print(f'✅ Supabase URL: {settings.SUPABASE_URL}')"
```

Should print:
```
✅ Supabase URL: https://fpeimulivxmikmgmrqrn.supabase.co
```

### **Start Backend:**

```bash
uvicorn app.main:app --reload
```

Visit: [http://localhost:8000/health](http://localhost:8000/health)

### **Start Frontend:**

```bash
cd frontend
npm run dev
```

Visit: [http://localhost:3000](http://localhost:3000)

---

## 📋 **SUMMARY**

### **What's Already Configured:**
- ✅ Supabase URL
- ✅ Supabase anon key

### **What You Need to Add:**
1. ⚠️ **Supabase service_role key** (from Supabase dashboard)
2. ⚠️ **SECRET_KEY** (generate random)
3. ⚠️ **OpenAI API key** (from OpenAI platform)
4. (Optional) LinkedIn OAuth credentials
5. (Optional) Google OAuth credentials

---

## 🆘 **NEED HELP?**

### **Where to find service_role key:**
1. Go to your Supabase project
2. Settings → API
3. Look for "service_role" (secret) key
4. Click "Reveal" and copy

### **Can't find OpenAI key:**
1. Go to [platform.openai.com](https://platform.openai.com)
2. Click on your profile → "API keys"
3. Create new secret key
4. Copy and save it (you won't see it again!)

---

**Your Supabase is ready! Just add the missing keys and you're good to go!** 🚀
