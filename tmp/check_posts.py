
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
    
    # Check scheduled posts
    now = datetime.now(timezone.utc).isoformat()
    print(f"Current time (UTC): {now}")
    
    try:
        # Get count of scheduled posts
        res = client.table("posts").select("id", "status", "scheduled_at", "retry_count", "error_message").eq("status", "scheduled").execute()
        scheduled_posts = res.data or []
        print(f"Found {len(scheduled_posts)} scheduled posts")
        
        due_posts = [p for p in scheduled_posts if p['scheduled_at'] <= now]
        print(f"Found {len(due_posts)} due posts (scheduled_at <= now)")
        
        for p in due_posts:
            print(f"  - Post ID: {p['id']}, Scheduled At: {p['scheduled_at']}, Retries: {p['retry_count']}")

        # Check failed posts
        res_failed = client.table("posts").select("id", "status", "error_message").eq("status", "failed").execute()
        failed_posts = res_failed.data or []
        print(f"Found {len(failed_posts)} failed posts")
        for p in failed_posts[:5]: # Show first 5
             print(f"  - Post ID: {p['id']}, Error: {p['error_message']}")

        # Check running posts (might be stuck)
        res_running = client.table("posts").select("id", "status", "updated_at").eq("status", "running").execute()
        running_posts = res_running.data or []
        print(f"Found {len(running_posts)} running posts (potential stuck posts)")
        for p in running_posts:
            print(f"  - Post ID: {p['id']}, Updated At: {p.get('updated_at')}")

    except Exception as e:
        print(f"Error querying database: {e}")

if __name__ == "__main__":
    asyncio.run(check_posts())
