from supabase import create_client
import os

SUPABASE_URL = "https://fpeimulivxmikmgmrqrn.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwZWltdWxpdnhtaWttZ21ycXJuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE1MzYxMCwiZXhwIjoyMDgzNzI5NjEwfQ.Nj7nzwbeqXZz6wzp8sSoh_52vED4xzlXni5lhfJJsCc"

def check_posts():
    s = create_client(SUPABASE_URL, SUPABASE_KEY)
    # Find the user first to get the correct UUID
    u = s.table('users').select('id').eq('email', 'test@example.com').execute()
    if not u.data:
        print("User not found")
        return
    
    uid = u.data[0]['id']
    print(f"Checking posts for user {uid}")
    
    r = s.table('posts').select('*').eq('user_id', uid).execute()
    print(f"Posts found: {len(r.data)}")
    for post in r.data:
        print(f" - {post['id']}: topic='{post['topic']}', status='{post['status']}'")

if __name__ == "__main__":
    check_posts()
