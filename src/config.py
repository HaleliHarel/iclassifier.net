"""
Configuration module for iClassifier.

All configuration is read from environment variables with sensible defaults
for local development.
"""
import os

# Base URL for the application (used for redirects and template rendering)
# Default is localhost for development; set to 'https://iclassifier.pw' in production
BASE_URL = os.environ.get('ICLASSIFIER_BASE_URL', 'http://127.0.0.1:8000')

# Allowed origin for CORS (used in Access-Control-Allow-Origin header)
# Should match the domain where the app is hosted
# Default is 'localhost' for development; set to 'iclassifier.pw' in production
ALLOWED_ORIGIN = os.environ.get('ICLASSIFIER_ALLOWED_ORIGIN', 'http://127.0.0.1:8000')
