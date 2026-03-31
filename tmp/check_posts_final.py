
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

async def check_posts():
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("Missing Supabase credentials")
        return

    client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    now = datetime.now(timezone.utc).isoformat()
    print(f"REPORT_TIME: {now}")
    
    try:
        # Get count of scheduled posts
        res_sched = client.table("posts").select("*").eq("status", "scheduled").execute()
        scheduled_posts = res_sched.data or []
        print(f"COUNT_SCHEDULED: {len(scheduled_posts)}")
        
        due_posts = [p for p in scheduled_posts if p['scheduled_at'] <= now]
        print(f"COUNT_DUE: {len(due_posts)}")
        for i, p in enumerate(due_posts):
            print(f"DUE_{i}: ID={p['id']}, Time={p['scheduled_at']}")

        # Check failed posts
        res_failed = client.table("posts").select("*").eq("status", "failed").execute()
        failed_posts = res_failed.data or []
        print(f"COUNT_FAILED: {len(failed_posts)}")
        for i, p in enumerate(failed_posts):
             print(f"FAILED_{i}: ID={p['id']}, Error={p.get('error_message')}")

        # Check running posts
        res_running = client.table("posts").select("*").eq("status", "running").execute()
        running_posts = res_running.data or []
        print(f"COUNT_RUNNING: {len(running_posts)}")
        for i, p in enumerate(running_posts):
            print(f"RUNNING_{i}: ID={p['id']}")

        # Check posted posts
        res_posted = client.table("posts").select("id,posted_at").eq("status", "posted").order("posted_at", desc=True).limit(5).execute()
        posted_posts = res_posted.data or []
        print(f"COUNT_POSTED_RECENT: {len(posted_posts)}")
        for i, p in enumerate(posted_posts):
            print(f"POSTED_{i}: ID={p['id']}, PostedAt={p.get('posted_at')}")

    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(check_posts())
