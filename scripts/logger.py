from datetime import datetime

import os
import time
import json
from datetime import datetime
from config import IDLE_THRESHOLD, TRACK_INTERVAL, LOG_FILE, LOG_DIR
from utils import get_active_window, get_idle_time
from openai import OpenAI


from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")

# Initialize OpenAI client
openai_client = OpenAI()

# === CACHE UTILITIES ===
def load_cache():
    """
    Load the category cache from disk, or return empty dict if none exists.
    """
    cache_file = os.path.join(LOG_DIR, "category_cache.json")
    if os.path.exists(cache_file):
        with open(cache_file, 'r') as f:
            return json.load(f)
    return {}


def save_cache(cache):
    """
    Save the category cache back to disk.
    """
    cache_file = os.path.join(LOG_DIR, "category_cache.json")
    with open(cache_file, 'w') as f:
        json.dump(cache, f, indent=2)


def categorize_windows(batch, cache):
    """
    Batch: list of {"window_title": str, "app_name": str}.
    Uses OpenAI client to categorize uncached items, updates cache, and returns categories in order.
    """
    uncached = []
    keys = []
    for item in batch:
        key = f"{item['window_title']}|{item['app_name']}"
        if key not in cache:
            uncached.append(item)
            keys.append(key)

    # Query OpenAI only for new items
    if uncached:
        prompt = (
            "Categorize the following window titles and app names into high-level activity categories like 'work',"
            " 'coding', 'social media', 'entertainment', 'communication', 'gaming', 'utility', or 'browsing'." +
            "\n\n"
        )
        for i, it in enumerate(uncached, 1):
            prompt += f"{i}. Window: '{it['window_title']}', App: '{it['app_name']}'\n"
        prompt += "\nRespond with only the list of categories, one per line."

        try:
            response = openai_client.chat.completions.create(
                model="gpt-4",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
            )
            results = response.choices[0].message.content.strip().splitlines()

            # Update cache
            for k, cat in zip(keys, results):
                cache[k] = cat.strip()
            save_cache(cache)
        except Exception as e:
            print(f"Categorization error: {e}")

    # Return categories for the full batch
    return [cache.get(f"{it['window_title']}|{it['app_name']}", "unknown") for it in batch]


def log_usage():
    """
    Main function to continuously log user activity.
    This runs in a separate thread.
    """
    print("Starting activity logger...")
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
    if not os.path.exists(LOG_FILE):
        with open(LOG_FILE, 'w') as f:
            json.dump([], f)

    cache = load_cache()
    last_window_title = None
    last_app_name = None
    last_status = None

    while True:
        try:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            idle_time = get_idle_time()

            current_window_title = "idle"
            current_app_name = "idle"
            current_status = "idle"

            if idle_time < IDLE_THRESHOLD:
                window_title, app_name = get_active_window()
                if window_title and app_name:
                    current_window_title = window_title
                    current_app_name = app_name
                    current_status = "active"

            if (current_window_title != last_window_title or
                current_app_name != last_app_name or
                current_status != last_status):

                if last_status == "active":
                    closed_entry = {
                        "timestamp": timestamp,
                        "window_title": last_window_title,
                        "app_name": last_app_name,
                        "category": "",
                        "status": "closed"
                    }
                    with open(LOG_FILE, 'r+') as f:
                        data = json.load(f)
                        data.append(closed_entry)
                        f.seek(0)
                        json.dump(data, f, indent=2)
                        f.truncate()

                entry = {
                    "timestamp": timestamp,
                    "window_title": current_window_title,
                    "app_name": current_app_name,
                    "category": "" if current_status != "idle" else "N/A",
                    "status": current_status
                }

                with open(LOG_FILE, 'r+') as f:
                    data = json.load(f)
                    data.append(entry)
                    f.seek(0)
                    json.dump(data, f, indent=2)
                    f.truncate()

                last_window_title = current_window_title
                last_app_name = current_app_name
                last_status = current_status

            # After sleeping, categorize any uncategorized 'active' entries in batch
            with open(LOG_FILE, 'r+') as f:
                data = json.load(f)
                uncategorized = [e for e in data if e["category"] == "" and e["status"] == "active"]
                if uncategorized:
                    batch = [{"window_title": e["window_title"], "app_name": e["app_name"]} for e in uncategorized]
                    categories = categorize_windows(batch, cache)
                    for e, cat in zip(uncategorized, categories):
                        e["category"] = cat
                    f.seek(0)
                    json.dump(data, f, indent=2)
                    f.truncate()

            time.sleep(TRACK_INTERVAL)
        except Exception as e:
            print(f"Error in activity logger: {e}")
            time.sleep(TRACK_INTERVAL)

if __name__ == "__main__":
    log_usage()
