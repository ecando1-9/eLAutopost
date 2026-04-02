import json
from supabase import create_client
import os

SUPABASE_URL = "https://fpeimulivxmikmgmrqrn.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwZWltdWxpdnhtaWttZ21ycXJuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE1MzYxMCwiZXhwIjoyMDgzNzI5NjEwfQ.Nj7nzwbeqXZz6wzp8sSoh_52vED4xzlXni5lhfJJsCc"

def generate_report():
    s = create_client(SUPABASE_URL, SUPABASE_KEY)
    report = {}
    
    tables = ['settings', 'posts', 'users', 'subscriptions', 'linkedin_tokens']
    for table in tables:
        try:
            r = s.table(table).select("*").limit(1).execute()
            report[table] = {
                "exists": True,
                "rows_count_sample": len(r.data),
                "columns": list(r.data[0].keys()) if r.data else []
            }
            if not r.data:
              # try to find columns by inserting then deleting? No that's risky.
              # Let's just say we don't have sample rows.
              pass
        except Exception as e:
            report[table] = {"exists": False, "error": str(e)}
            
    with open('db_schema_report.json', 'w') as f:
        json.dump(report, f, indent=2)
    print("Report generated: db_schema_report.json")

if __name__ == "__main__":
    generate_report()
