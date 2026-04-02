import json
from supabase import create_client
import os

SUPABASE_URL = "https://fpeimulivxmikmgmrqrn.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwZWltdWxpdnhtaWttZ21ycXJuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE1MzYxMCwiZXhwIjoyMDgzNzI5NjEwfQ.Nj7nzwbeqXZz6wzp8sSoh_52vED4xzlXni5lhfJJsCc"

def do_everything():
    s = create_client(SUPABASE_URL, SUPABASE_KEY)
    final_output = []
    
    # 1. Get a user
    res_users = s.table('users').select('*').limit(1).execute()
    if not res_users.data:
        final_output.append("NO USERS FOUND")
    else:
        user_id = res_users.data[0]['id']
        email = res_users.data[0]['email']
        final_output.append(f"Testing with User: {email} ({user_id})")
        
        # 2. Check posts columns
        dummy_post = {
            "user_id": user_id, "topic": "test", "hook": "test", 
            "image_prompt": "test", "caption": "test", 
            "content_type": "insight", "status": "draft", 
            "target": "person", "organization_id": None
        }
        try:
            r = s.table('posts').insert(dummy_post).execute()
            final_output.append("Table 'posts' HAS 'target' and 'organization_id' columns.")
            # Cleanup
            s.table('posts').delete().eq('id', r.data[0]['id']).execute()
        except Exception as e:
            final_output.append(f"Post insert result: {str(e)}")
                
        # 3. Check settings
        try:
            r = s.table('settings').select('*').eq('user_id', user_id).execute()
            if r.data:
                final_output.append(f"Settings for user {email} EXIST.")
            else:
                final_output.append(f"Settings for user {email} DO NOT EXIST.")
        except Exception as e:
            final_output.append(f"Settings select result: {str(e)}")

    with open('final_db_check.txt', 'w') as f:
        f.write("\n".join(final_output))
    print("Check complete: final_db_check.txt")

if __name__ == "__main__":
    do_everything()
