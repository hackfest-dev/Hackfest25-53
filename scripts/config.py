import os
script_dir = os.path.dirname(os.path.abspath(__file__))
print(os.path.abspath(__file__))
# Go up one level from scripts directory to the project root
project_root = os.path.dirname(script_dir)
LOG_DIR = os.path.join(project_root, "frontend", "public")
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOG_DIR, "usage_log.json")
CATEGORY_FILE = os.path.join(LOG_DIR, "categorized_log.json")
API_LOG_FILE = os.path.join(LOG_DIR, "api_log.txt")
API_CALL_COUNT_FILE = os.path.join(LOG_DIR, "api_calls.txt")

OPENAI_API_KEY = "YOUR_API_KEY"

# Timing configurations
TRACK_INTERVAL = 5  # Track activity every 5 seconds
CATEGORY_UPDATE_INTERVAL = 30  # Process categories every 30 seconds in memory
IDLE_THRESHOLD = 300  # seconds
