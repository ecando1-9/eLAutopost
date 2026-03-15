# 🚀 Quick Start Guide

Get up and running in 10 minutes!

## Prerequisites
- Python 3.11+
- Node.js 18+
- Supabase account
- OpenAI API key

## Step 1: Clone & Setup (2 min)

```bash
cd linkedin_automation

# Backend setup
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
copy .env.example .env

# Frontend setup
cd ../frontend
npm install
copy .env.local.example .env.local
```

## Step 2: Get API Keys (5 min)

### Supabase
1. Create project at [supabase.com](https://supabase.com)
2. Copy URL and anon key to both `.env` files
3. Run `supabase/schema.sql` in SQL Editor

### OpenAI
1. Get API key from [platform.openai.com](https://platform.openai.com)
2. Add to backend `.env`: `OPENAI_API_KEY=sk-...`

### Secret Key
```bash
# Generate and add to backend .env
openssl rand -hex 32
```

## Step 3: Run Application (1 min)

### Terminal 1 - Backend
```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload
```

### Terminal 2 - Frontend
```bash
cd frontend
npm run dev
```

## Step 4: Test (2 min)

1. Open [http://localhost:3000](http://localhost:3000)
2. Sign up with email/password
3. Generate your first LinkedIn post!

## Next Steps

- Connect LinkedIn account
- Customize settings
- Explore API docs at [http://localhost:8000/api/docs](http://localhost:8000/api/docs)

## Need Help?

- Full setup guide: `docs/SETUP.md`
- Security info: `docs/SECURITY.md`
- Issues: Check error logs in `backend/logs/`

---

**That's it! You're ready to automate LinkedIn content! 🎉**
