import sys
import os

# Add current directory to path
sys.path.insert(0, os.getcwd())

try:
    from app.main import app
    print("SUCCESS: Backend app imported and validated settings.")
except Exception as e:
    import traceback
    print("FAILURE: Backend import error")
    traceback.print_exc()
