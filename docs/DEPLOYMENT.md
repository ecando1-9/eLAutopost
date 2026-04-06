# Deployment Guide

## Goal

For reliable scheduled posting, deploy the backend API and the background scheduler as
two separate services. If the scheduler only lives inside the web app process, posts can
be delayed whenever the web service is asleep, restarted, or receives no traffic.

## Recommended Production Shape

- Frontend: Vercel
- Backend API: Render web service
- Scheduler: Render worker service

## Render Blueprint

This repo now includes [render.yaml](../render.yaml).

It defines:

- `elautopost-backend`
  Purpose: serves the FastAPI API
- `elautopost-scheduler`
  Purpose: runs the APScheduler posting and auto-generation loops continuously

## Important Environment Variables

Configure the same backend environment variables on both the API service and the worker:

- `ENVIRONMENT`
- `DEBUG`
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `SUPABASE_SERVICE_KEY`
- `SECRET_KEY`
- `GOOGLE_API_KEY`
- `GOOGLE_MODEL`
- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `LINKEDIN_REDIRECT_URI`
- `LINKEDIN_ENABLE_ORGANIZATION_SCOPES`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `BACKEND_CORS_ORIGINS`
- `FRONTEND_APP_URL`

Also set:

- `ENABLE_EMBEDDED_SCHEDULER=false`

That keeps the API service from running a duplicate scheduler, because the dedicated
worker will own posting and auto-generation.

## Why This Fixes Late Posts

The scheduler worker runs even when nobody is opening the frontend. That means:

- scheduled posts are checked every minute
- upcoming posts are auto-generated every 15 minutes
- logging into the app is no longer what “wakes up” posting

## Local Development

For local development, the API can still run the embedded scheduler by default.

Start the backend normally:

```powershell
cd backend
uvicorn app.main:app --reload
```

Or run the standalone scheduler worker:

```powershell
cd backend
python -m app.worker.service
```
