from supabase import create_client
import os

SUPABASE_URL = "https://fpeimulivxmikmgmrqrn.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwZWltdWxpdnhtaWttZ21ycXJuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE1MzYxMCwiZXhwIjoyMDgzNzI5NjEwfQ.Nj7nzwbeqXZz6wzp8sSoh_52vED4xzlXni5lhfJJsCc"

def create_confirmed_user():
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    email = "test@example.com"
    password = "Password123!"
    
    try:
        # Create user through Auth Admin
        user = supabase.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True
        })
        print(f"User created: {user}")
    except Exception as e:
        print(f"Error creating user: {e}")

if __name__ == "__main__":
    create_confirmed_user()
