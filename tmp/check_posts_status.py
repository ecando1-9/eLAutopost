import os
import asyncio
from datetime import datetime
from supabase import create_client, Client

# Hardcoded for quick check based on .env
SUPABASE_URL = "https://fpeimulivxmikmgmrqrn.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwZWltdWxpdnhtaWttZ21ycXJuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE1MzYxMCwiZXhwIjoyMDgzNzI5NjEwfQ.Nj7nzwbeqXZz6wzp8sSoh_52vED4xzlXni5lhfJJsCc"

async def check_posts():
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    print(f"Current UTC time: {datetime.utcnow().isoformat()}")
    
    # Check all statuses
    result = supabase.table("posts").select("id, status, scheduled_at, user_id, error_message").execute()
    posts = result.data
    
    if not posts:
        print("No posts found in database.")
        return

    stats = {}
    due_count = 0
    now = datetime.utcnow().isoformat()
    
    for post in posts:
        status = post.get("status")
        stats[status] = stats.get(status, 0) + 1
        
        scheduled_at = post.get("scheduled_at")
        if status == "scheduled":
            print(f"SCHEDULED: Post {post.get('id')} for user {post.get('user_id')} at {scheduled_at}")
            if scheduled_at <= now:
                due_count += 1
                print(f"  -> THIS POST IS DUE!")
        
        if status == "pending_review":
            print(f"PENDING REVIEW: Post {post.get('id')} for user {post.get('user_id')} at {scheduled_at}")

    print("\nStatus Statistics:")
    for status, count in stats.items():
        print(f" - {status}: {count}")
    
    print(f"\nTotal Due Posts: {due_count}")

if __name__ == "__main__":
    asyncio.run(check_posts())
