import os
# We need to set the PYTHONPATH or work from backend/
import sys
sys.path.append(os.getcwd())

from app.core.config import settings
print(f"CORS_ORIGINS: {settings.BACKEND_CORS_ORIGINS}")
print(f"LINKEDIN_REDIRECT_URI: {settings.LINKEDIN_REDIRECT_URI}")
print(f"ENVIRONMENT: {settings.ENVIRONMENT}")
