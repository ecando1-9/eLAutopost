import json
from supabase import create_client
import os

SUPABASE_URL = "https://fpeimulivxmikmgmrqrn.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwZWltdWxpdnhtaWttZ21ycXJuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE1MzYxMCwiZXhwIjoyMDgzNzI5NjEwfQ.Nj7nzwbeqXZz6wzp8sSoh_52vED4xzlXni5lhfJJsCc"

def do_everything():
    s = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # 1. Get a user
    res_users = s.table('users').select('*').limit(1).execute()
    if not res_users.data:
        print("NO USERS FOUND")
        return
    
    user_id = res_users.data[0]['id']
    email = res_users.data[0]['email']
    print(f"Testing with User: {email} ({user_id})")
    
    # 2. Check if posts can be inserted with new columns
    dummy_post = {
        "user_id": user_id,
        "topic": "test",
        "hook": "test",
        "image_prompt": "test",
        "caption": "test",
        "content_type": "insight",
        "status": "draft",
        "target": "person",
        "organization_id": None
    }
    
    try:
        r = s.table('posts').insert(dummy_post).execute()
        print("Table 'posts' HAS 'target' and 'organization_id' columns.")
        # Cleanup
        s.table('posts').delete().eq('id', r.data[0]['id']).execute()
    except Exception as e:
        if "column" in str(e).lower() and ("target" in str(e).lower() or "organization_id" in str(e).lower()):
            print(f"Table 'posts' is MISSING columns: {e}")
        else:
            print(f"Post insert failed for other reason: {e}")
            
    # 3. Check if settings can be updated
    try:
        r = s.table('settings').select('*').eq('user_id', user_id).execute()
        if r.data:
            print(f"Settings for user {email} ALREADY EXIST.")
        else:
            print(f"Settings for user {email} DO NOT EXIST.")
    except Exception as e:
        print(f"Settings select failed: {e}")

if __name__ == "__main__":
    do_everything()
