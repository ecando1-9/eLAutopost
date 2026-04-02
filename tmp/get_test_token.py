from supabase import create_client
import os

SUPABASE_URL = "https://fpeimulivxmikmgmrqrn.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwZWltdWxpdnhtaWttZ21ycXJuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE1MzYxMCwiZXhwIjoyMDgzNzI5NjEwfQ.Nj7nzwbeqXZz6wzp8sSoh_52vED4xzlXni5lhfJJsCc"

def get_token():
    s = create_client(SUPABASE_URL, SUPABASE_KEY)
    # Signs in as test@example.com / password123
    try:
        res = s.auth.sign_in_with_password({"email": "test@example.com", "password": "password123"})
        print(f"ACCESS_TOKEN: {res.session.access_token}")
        print(f"USER_ID: {res.user.id}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    get_token()
