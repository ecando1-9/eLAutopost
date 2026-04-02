from supabase import create_client
import os

SUPABASE_URL = "https://fpeimulivxmikmgmrqrn.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwZWltdWxpdnhtaWttZ21ycXJuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE1MzYxMCwiZXhwIjoyMDgzNzI5NjEwfQ.Nj7nzwbeqXZz6wzp8sSoh_52vED4xzlXni5lhfJJsCc"

def check_posts_columns():
    s = create_client(SUPABASE_URL, SUPABASE_KEY)
    # Using RPC or REST to get table info? REST doesn't directly expose schema easily without data.
    # But we can try to insert a minimal row and let it fail to see the error,
    # OR we can try to use the 'admin-js' trick if it was JS, but here we can try to use a raw RPC if available.
    # Actually, I'll just try to insert a row with TARGET and see if Postgres complains.
    
    dummy_post = {
        "user_id": "da9df341-f50f-4fd6-81ee-d9883c78b948", # test@example.com
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
        print("Insert SUCCESS - Columns 'target' and 'organization_id' exist.")
        # Clean up
        s.table('posts').delete().eq('id', r.data[0]['id']).execute()
    except Exception as e:
        print(f"Insert FAILED: {e}")

if __name__ == "__main__":
    check_posts_columns()
