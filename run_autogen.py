import asyncio
import os
import sys

# Load env safely
sys.path.append(os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv('backend/.env')

from backend.app.worker.auto_generator import auto_generator_worker

async def trigger():
    print("Running AutoGen worker manually...")
    await auto_generator_worker.process_auto_generation()
    print("Done!")

if __name__ == "__main__":
    asyncio.run(trigger())
