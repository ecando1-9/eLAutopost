# 🚀 LinkedIn Content Automation SaaS

**Enterprise-grade, multi-tenant SaaS platform for automated LinkedIn content creation and posting.**

## 🎯 Overview

This application enables users to:
- Generate viral LinkedIn content (image hooks, captions, AI prompts)
- Post directly to LinkedIn via official API
- Manage content history and settings
- Collaborate in a secure, multi-tenant environment

## 🏗️ Architecture

### Tech Stack
- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS
- **Backend:** FastAPI (Python 3.11+)
- **Database:** Supabase PostgreSQL with Row Level Security
- **Authentication:** Supabase Auth (Email, Google, LinkedIn OAuth)
- **AI:** OpenAI GPT-4, DALL-E 3
- **Security:** Rate limiting, input validation, OWASP compliance

### Key Features
- ✅ Multi-tenant architecture with data isolation
- ✅ Secure authentication (Email, Google, LinkedIn)
- ✅ AI-powered content generation
- ✅ LinkedIn official API integration
- ✅ Real-time post status tracking
- ✅ Dark/Light mode with smooth animations
- ✅ Enterprise-grade security hardening

## 📋 Prerequisites

- **Node.js** 18+ and npm/yarn
- **Python** 3.11+
- **Supabase** account
- **OpenAI** API key
- **LinkedIn** Developer App credentials
- **Google** OAuth credentials

## 🚀 Quick Start

### 1. Clone and Setup

```bash
cd linkedin_automation
```

### 2. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your credentials
uvicorn app.main:app --reload
```

### 3. Frontend Setup

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Edit .env.local with your credentials
npm run dev
```

### 4. Supabase Setup

1. Create a new Supabase project
2. Run migrations: `supabase db push`
3. Enable Row Level Security on all tables
4. Configure OAuth providers in Supabase dashboard

## 🔐 Security Features

- **Rate Limiting:** IP and user-based throttling
- **Input Validation:** Pydantic schemas with strict validation
- **Secure Secrets:** Environment variables only, no hardcoded keys
- **OWASP Compliance:** Following Top 10 best practices
- **RLS:** Database-level multi-tenancy
- **Audit Logging:** All critical actions logged

## 📚 Documentation

- [Setup Guide](./docs/SETUP.md)
- [API Documentation](./docs/API.md)
- [Security Guide](./docs/SECURITY.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

## 📦 Deployment

See [DEPLOYMENT.md](./docs/DEPLOYMENT.md) for production deployment instructions.

## 📄 License

Proprietary - All rights reserved

## 👥 Support

For issues or questions, contact: support@yourcompany.com
