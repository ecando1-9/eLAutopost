
import os
import asyncio
from supabase import create_client, Client
from datetime import datetime, timezone

# Load env variables from backend/.env
env_path = r"c:\Users\yuvak\Downloads\ecantech_esolutions\projects\linkedin_automation\backend\.env"
env_vars = {}
with open(env_path, "r") as f:
    for line in f:
        if "=" in line and not line.startswith("#"):
            key, value = line.strip().split("=", 1)
            env_vars[key] = value.strip('"').strip("'")

SUPABASE_URL = env_vars.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = env_vars.get("SUPABASE_SERVICE_KEY")

async def report():
    client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    now = datetime.now(timezone.utc).isoformat()
    
    # Scheduled posts
    res = client.table("posts").select("*").eq("status", "scheduled").execute()
    scheduled = res.data or []
    due = [p for p in scheduled if p['scheduled_at'] <= now]
    
    # Posted posts
    res_posted = client.table("posts").select("*").eq("status", "posted").order("posted_at", desc=True).limit(1).execute()
    last_posted = res_posted.data[0] if res_posted.data else None
    
    print("-" * 30)
    print(f"REPORT AT: {now}")
    print(f"LAST POSTED: {last_posted['posted_at'] if last_posted else 'Never'}")
    print(f"TOTAL SCHEDULED: {len(scheduled)}")
    print(f"TOTALLY DUE RIGHT NOW: {len(due)}")
    print("-" * 30)

if __name__ == "__main__":
    asyncio.run(report())
