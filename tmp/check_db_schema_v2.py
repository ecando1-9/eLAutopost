from supabase import create_client
import os
import json

SUPABASE_URL = "https://fpeimulivxmikmgmrqrn.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwZWltdWxpdnhtaWttZ21ycXJuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE1MzYxMCwiZXhwIjoyMDgzNzI5NjEwfQ.Nj7nzwbeqXZz6wzp8sSoh_52vED4xzlXni5lhfJJsCc"

def check_schema():
    s = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    tables = ['settings', 'posts', 'users', 'subscriptions', 'linkedin_tokens']
    for table in tables:
        try:
            r = s.table(table).select("*").limit(1).execute()
            print(f"Table '{table}': {len(r.data)} rows")
            if r.data:
                print(f"Sample row for '{table}': {json.dumps(r.data[0], indent=2)}")
        except Exception as e:
            print(f"Table '{table}': ERROR - {e}")

if __name__ == "__main__":
    check_schema()
