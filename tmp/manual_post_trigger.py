
import os
import asyncio
import sys
from datetime import datetime, timezone

# Add backend to sys.path
backend_path = r"c:\Users\yuvak\Downloads\ecantech_esolutions\projects\linkedin_automation\backend"
sys.path.append(backend_path)

# Set environment variables
env_path = os.path.join(backend_path, ".env")
with open(env_path, "r") as f:
    for line in f:
        if "=" in line and not line.startswith("#"):
            key, value = line.strip().split("=", 1)
            os.environ[key] = value.strip('"').strip("'")

# Mock logger to avoid dependency issues if needed, or just import
from app.core.config import logger
from app.worker.posting import posting_worker

async def run_manual_posting():
    print(f"Starting manual posting run at {datetime.now(timezone.utc)}")
    try:
        stats = await posting_worker.process_due_posts()
        print(f"Stats: {stats}")
    except Exception as e:
        print(f"Error during manual posting: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run_manual_posting())
